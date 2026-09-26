/**
 * TimetableService.js
 *
 * Orchestrates one end-to-end timetable generation request:
 *   1. Normalize input entities (from request payload, sample data, or DB).
 *   2. Run PreflightValidator (cheap feasibility checks).
 *   3. Run TimetableSolver (CSP + MRV + backtracking).
 *   4. Run an INDEPENDENT final validation pass over the resulting schedule.
 *   5. Assemble the API response shape (status/message/schedule/diagnostics/statistics).
 *
 * This module contains no Express-specific code so it can be unit tested
 * directly and reused by both the HTTP controller and the seed/demo scripts.
 */

const { runPreflightChecks } = require('../scheduler/PreflightValidator');
const { solve, generateDomain } = require('../scheduler/TimetableSolver');
const { finalValidate, occupiedPeriods } = require('../scheduler/ConstraintValidator');
const { getSampleDataset } = require('../seed/seedData');

const DEFAULT_TIME_CONFIG = {
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  periodsPerDay: 6,
  maxSearchNodes: 200000,
  timeoutMs: 8000,
};

function toId(value) {
  return String(value);
}

/** Converts raw arrays of divisions/subjects/faculty/classrooms into id-indexed maps. */
function buildEntities({ divisions, subjects, faculty, classrooms, timeConfig }) {
  const resolvedTimeConfig = {
    days: timeConfig?.days?.length ? timeConfig.days : DEFAULT_TIME_CONFIG.days,
    periodsPerDay: timeConfig?.periodsPerDay || DEFAULT_TIME_CONFIG.periodsPerDay,
    maxSearchNodes: timeConfig?.maxSearchNodes || DEFAULT_TIME_CONFIG.maxSearchNodes,
    timeoutMs: timeConfig?.timeoutMs || DEFAULT_TIME_CONFIG.timeoutMs,
  };

  const divisionsById = new Map();
  for (const d of divisions) {
    divisionsById.set(toId(d.id), {
      id: toId(d.id),
      name: d.name,
      code: d.code,
      studentCount: d.studentCount,
      availableSlots: d.availableSlots || [],
    });
  }

  const facultyById = new Map();
  for (const f of faculty) {
    facultyById.set(toId(f.id), {
      id: toId(f.id),
      name: f.name,
      availableSlots: f.availableSlots || [],
      maxWeeklySessions: f.maxWeeklySessions ?? null,
    });
  }

  const classroomsById = new Map();
  for (const c of classrooms) {
    classroomsById.set(toId(c.id), {
      id: toId(c.id),
      name: c.name,
      roomNumber: c.roomNumber,
      capacity: c.capacity,
      roomType: c.roomType || 'classroom',
      availableSlots: c.availableSlots || [],
    });
  }

  const subjectsById = new Map();
  for (const s of subjects) {
    const divisionId = toId(s.division);
    const facultyId = toId(s.faculty);
    // Fail with a clear 400 here rather than crashing deep inside the solver later:
    // a subject that references a division/faculty id which doesn't exist in this
    // request is a bad request, not a server bug.
    if (!divisionsById.has(divisionId)) {
      const err = new Error(
        `Subject "${s.name || s.id}" references division id "${s.division}", which is not in the supplied divisions list.`
      );
      err.status = 400;
      throw err;
    }
    if (!facultyById.has(facultyId)) {
      const err = new Error(
        `Subject "${s.name || s.id}" references faculty id "${s.faculty}", which is not in the supplied faculty list.`
      );
      err.status = 400;
      throw err;
    }
    subjectsById.set(toId(s.id), {
      id: toId(s.id),
      name: s.name,
      code: s.code,
      weeklyFrequency: s.weeklyFrequency,
      requiresLab: !!s.requiresLab,
      duration: s.duration || 1,
      divisionId,
      facultyId,
    });
  }

  return { divisionsById, subjectsById, facultyById, classroomsById, timeConfig: resolvedTimeConfig };
}

const DIAGNOSTIC_MESSAGES = {
  NO_AVAILABLE_SLOT: 'No day/period combination could fit this session without exceeding the day.',
  FACULTY_CONFLICT: 'Every remaining slot conflicts with another class the same faculty member teaches.',
  ROOM_CONFLICT: 'Every suitable classroom is already booked at the remaining slots.',
  DIVISION_CONFLICT: 'The division already has a class in every remaining slot.',
  ROOM_CAPACITY: 'No classroom with sufficient capacity was free at any remaining slot.',
  ROOM_TYPE: 'No laboratory room was free at any remaining slot.',
  FACULTY_UNAVAILABLE: "The remaining slots fall outside the faculty member's declared availability.",
  ROOM_UNAVAILABLE: "The remaining slots fall outside the classroom's declared availability.",
  DIVISION_UNAVAILABLE: "The remaining slots fall outside the division's declared availability.",
  SCHEDULING_DEADLOCK: 'No valid candidate remained for this session given everything already scheduled.',
  SOLVER_SEARCH_LIMIT_REACHED: 'The solver reached its search-node/time budget before finding a complete schedule.',
};

function buildOccupancyFromSchedule(schedule, entities) {
  const occupancy = { division: new Map(), faculty: new Map(), classroom: new Map() };
  for (const entry of schedule) {
    const subject = entities.subjectsById.get(
      // subjectId already present on entry
      entry.subjectId
    );
    const duration = subject ? subject.duration : 1;
    for (const p of occupiedPeriods(entry.period, duration)) {
      occupancy.division.set(`${entry.divisionId}|${entry.day}|${p}`, entry.sessionId);
      occupancy.faculty.set(`${entry.facultyId}|${entry.day}|${p}`, entry.sessionId);
      occupancy.classroom.set(`${entry.classroomId}|${entry.day}|${p}`, entry.sessionId);
    }
  }
  return occupancy;
}

/** Produces a human-readable diagnostic for each unscheduled session. */
function explainUnscheduled(unscheduledSessionIds, sessions, schedule, entities) {
  const occupancy = buildOccupancyFromSchedule(schedule, entities);
  const explanations = [];
  for (const sessionId of unscheduledSessionIds) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) continue;
    const { candidates, failureTally } = generateDomain(session, entities, occupancy);
    let reasons;
    if (candidates.length > 0) {
      // A candidate existed but the search never reached it (e.g. search limit).
      reasons = ['SCHEDULING_DEADLOCK'];
    } else {
      reasons = Object.keys(failureTally).length ? Object.keys(failureTally) : ['NO_AVAILABLE_SLOT'];
    }
    explanations.push({
      sessionId,
      reasons,
      diagnostics: reasons.map((code) => ({
        code,
        message: DIAGNOSTIC_MESSAGES[code] || 'This session could not be scheduled.',
        sessionId,
      })),
    });
  }
  return explanations;
}

function generateTimetable(payload) {
  const dataset = payload.useSample ? getSampleDataset(payload.useSample) : payload;
  const timeConfig = payload.timeConfig || dataset.timeConfig;
  const entities = buildEntities({ ...dataset, timeConfig });

  const preflight = runPreflightChecks(entities);

  const totalRequiredSessions = Array.from(entities.subjectsById.values()).reduce(
    (sum, s) => sum + s.weeklyFrequency,
    0
  );

  if (totalRequiredSessions === 0) {
    return {
      status: 'FAILED',
      message: 'No subjects/sessions were supplied to schedule.',
      schedule: [],
      unscheduled: [],
      diagnostics: [{ code: 'NO_AVAILABLE_SLOT', message: 'No sessions to schedule.' }],
      statistics: { scheduledSessions: 0, requiredSessions: 0, searchNodes: 0, backtracks: 0, durationMs: 0 },
    };
  }

  const solverResult = solve(entities, {
    maxSearchNodes: entities.timeConfig.maxSearchNodes,
    timeoutMs: entities.timeConfig.timeoutMs,
  });

  const unscheduledExplanations = explainUnscheduled(
    solverResult.unscheduledSessionIds,
    solverResult.sessions,
    solverResult.schedule,
    entities
  );

  let diagnostics = preflight.diagnostics.map((d) => ({ ...d }));
  for (const exp of unscheduledExplanations) diagnostics.push(...exp.diagnostics);

  let status;
  let message;

  if (solverResult.outcome === 'COMPLETE') {
    const validation = finalValidate(solverResult.schedule, solverResult.sessions, entities);
    if (validation.valid) {
      status = 'SUCCESS';
      message = 'Timetable generated successfully. All required sessions were scheduled and independently validated.';
    } else {
      // The independent validator caught something the solver's bookkeeping
      // missed: never report SUCCESS for an invalid schedule.
      status = 'FAILED';
      message = 'The solver produced a schedule that failed independent final validation.';
      diagnostics.push(...validation.problems);
    }
  } else if (solverResult.schedule.length > 0) {
    status = 'PARTIAL';
    message =
      solverResult.outcome === 'LIMIT_REACHED'
        ? 'The solver reached its search limit before scheduling every session. Partial results are shown below.'
        : 'Not every session could be scheduled given the current constraints. Partial results are shown below.';
    if (solverResult.outcome === 'LIMIT_REACHED') {
      diagnostics.push({
        code: 'SOLVER_SEARCH_LIMIT_REACHED',
        message: DIAGNOSTIC_MESSAGES.SOLVER_SEARCH_LIMIT_REACHED,
      });
    }
  } else {
    status = 'FAILED';
    message = 'Unable to generate a timetable: no sessions could be scheduled under the current constraints.';
    if (solverResult.outcome === 'LIMIT_REACHED') {
      diagnostics.push({
        code: 'SOLVER_SEARCH_LIMIT_REACHED',
        message: DIAGNOSTIC_MESSAGES.SOLVER_SEARCH_LIMIT_REACHED,
      });
    }
  }

  return {
    status,
    message,
    schedule: solverResult.schedule.map((e) => ({
      sessionId: e.sessionId,
      division: e.divisionId,
      subject: e.subjectId,
      faculty: e.facultyId,
      classroom: e.classroomId,
      day: e.day,
      period: e.period,
    })),
    unscheduled: unscheduledExplanations.map((e) => ({ sessionId: e.sessionId, reasons: e.reasons })),
    diagnostics,
    statistics: {
      scheduledSessions: solverResult.schedule.length,
      requiredSessions: totalRequiredSessions,
      searchNodes: solverResult.stats.searchNodes,
      backtracks: solverResult.stats.backtracks,
      durationMs: solverResult.stats.durationMs,
    },
  };
}

function validateExistingTimetable(schedule, payload) {
  const dataset = payload.useSample ? getSampleDataset(payload.useSample) : payload;
  const timeConfig = payload.timeConfig || dataset.timeConfig;
  const entities = buildEntities({ ...dataset, timeConfig });
  const { buildSessions } = require('../scheduler/TimetableSolver');
  const sessions = buildSessions(entities.subjectsById);
  const normalized = schedule.map((e) => ({
    sessionId: e.sessionId,
    divisionId: toId(e.division),
    subjectId: toId(e.subject),
    facultyId: toId(e.faculty),
    classroomId: toId(e.classroom),
    day: e.day,
    period: e.period,
  }));
  const result = finalValidate(normalized, sessions, entities);
  return result;
}

module.exports = {
  DEFAULT_TIME_CONFIG,
  buildEntities,
  generateTimetable,
  validateExistingTimetable,
};
