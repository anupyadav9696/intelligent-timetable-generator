/**
 * ConstraintValidator.js
 *
 * Pure, stateless hard-constraint checks used both DURING the CSP search
 * (constraint propagation, before a candidate is accepted) and AFTER the
 * search finishes (independent final validation pass, see section 13 of
 * the spec / APPROACH.md).
 *
 * Every function here is a pure function of (candidate, session, entities,
 * occupancy) -> { ok: boolean, code?: string, message?: string }.
 * No function mutates its inputs.
 */

/** Build the list of periods a session occupies, given its start period and duration. */
function occupiedPeriods(period, duration) {
  const periods = [];
  for (let i = 0; i < duration; i += 1) periods.push(period + i);
  return periods;
}

function isWithinDay(period, duration, periodsPerDay) {
  return period >= 1 && period + duration - 1 <= periodsPerDay;
}

function slotAllowed(availableSlots, day, period) {
  // Empty availableSlots means "available at all configured slots".
  if (!availableSlots || availableSlots.length === 0) return true;
  return availableSlots.some((s) => s.day === day && s.period === period);
}

/** Division conflict: division cannot have two sessions in the same day+period. */
function checkDivisionConflict(candidate, session, occupancy) {
  const periods = occupiedPeriods(candidate.period, session.duration);
  for (const p of periods) {
    const key = `${session.divisionId}|${candidate.day}|${p}`;
    if (occupancy.division.has(key)) {
      return { ok: false, code: 'DIVISION_CONFLICT', message: `Division already has a session on ${candidate.day} period ${p}` };
    }
  }
  return { ok: true };
}

/** Faculty conflict: a faculty member cannot teach two sessions in the same day+period. */
function checkFacultyConflict(candidate, session, occupancy) {
  const periods = occupiedPeriods(candidate.period, session.duration);
  for (const p of periods) {
    const key = `${session.facultyId}|${candidate.day}|${p}`;
    if (occupancy.faculty.has(key)) {
      return { ok: false, code: 'FACULTY_CONFLICT', message: `Faculty already teaching on ${candidate.day} period ${p}` };
    }
  }
  return { ok: true };
}

/** Classroom conflict: a classroom cannot host two sessions in the same day+period. */
function checkClassroomConflict(candidate, session, occupancy) {
  const periods = occupiedPeriods(candidate.period, session.duration);
  for (const p of periods) {
    const key = `${candidate.classroomId}|${candidate.day}|${p}`;
    if (occupancy.classroom.has(key)) {
      return { ok: false, code: 'ROOM_CONFLICT', message: `Classroom already occupied on ${candidate.day} period ${p}` };
    }
  }
  return { ok: true };
}

/** Room capacity: classroom.capacity must be >= division.studentCount. */
function checkRoomCapacity(candidate, session, entities) {
  const classroom = entities.classroomsById.get(candidate.classroomId);
  const division = entities.divisionsById.get(session.divisionId);
  if (classroom.capacity < division.studentCount) {
    return { ok: false, code: 'ROOM_CAPACITY', message: `Room ${classroom.name} capacity ${classroom.capacity} < division size ${division.studentCount}` };
  }
  return { ok: true };
}

/** Room type / lab requirement: subjects requiring a lab may only use lab rooms. */
function checkRoomType(candidate, session, entities) {
  const classroom = entities.classroomsById.get(candidate.classroomId);
  if (session.requiresLab && classroom.roomType !== 'lab') {
    return { ok: false, code: 'ROOM_TYPE', message: `Subject requires a laboratory but room ${classroom.name} is type ${classroom.roomType}` };
  }
  return { ok: true };
}

/** Faculty availability: faculty can only be assigned during their available slots. */
function checkFacultyAvailability(candidate, session, entities) {
  const faculty = entities.facultyById.get(session.facultyId);
  const periods = occupiedPeriods(candidate.period, session.duration);
  const available = periods.every((p) => slotAllowed(faculty.availableSlots, candidate.day, p));
  if (!available) {
    return { ok: false, code: 'FACULTY_UNAVAILABLE', message: `Faculty ${faculty.name} not available on ${candidate.day} period ${candidate.period}` };
  }
  return { ok: true };
}

/** Classroom availability: classrooms can only be assigned during their available slots. */
function checkClassroomAvailability(candidate, session, entities) {
  const classroom = entities.classroomsById.get(candidate.classroomId);
  const periods = occupiedPeriods(candidate.period, session.duration);
  const available = periods.every((p) => slotAllowed(classroom.availableSlots, candidate.day, p));
  if (!available) {
    return { ok: false, code: 'ROOM_UNAVAILABLE', message: `Room ${classroom.name} not available on ${candidate.day} period ${candidate.period}` };
  }
  return { ok: true };
}

/** Division availability: divisions can only be scheduled during their available slots. */
function checkDivisionAvailability(candidate, session, entities) {
  const division = entities.divisionsById.get(session.divisionId);
  const periods = occupiedPeriods(candidate.period, session.duration);
  const available = periods.every((p) => slotAllowed(division.availableSlots, candidate.day, p));
  if (!available) {
    return { ok: false, code: 'DIVISION_UNAVAILABLE', message: `Division not available on ${candidate.day} period ${candidate.period}` };
  }
  return { ok: true };
}

/** Session must stay within the configured day (duration cannot spill past the last period). */
function checkWithinDay(candidate, session, entities) {
  if (!isWithinDay(candidate.period, session.duration, entities.timeConfig.periodsPerDay)) {
    return { ok: false, code: 'NO_AVAILABLE_SLOT', message: 'Session duration would spill past the end of the day' };
  }
  return { ok: true };
}

/**
 * Runs every hard constraint against a candidate for a given session.
 * Returns the first failing check, or { ok: true } if all pass.
 * Order matters only for diagnostic clarity (cheapest/most-specific checks first).
 */
function validateCandidate(candidate, session, entities, occupancy) {
  const checks = [
    checkWithinDay,
    checkRoomCapacity,
    checkRoomType,
    checkFacultyAvailability,
    checkClassroomAvailability,
    checkDivisionAvailability,
    (c, s) => checkDivisionConflict(c, s, occupancy),
    (c, s) => checkFacultyConflict(c, s, occupancy),
    (c, s) => checkClassroomConflict(c, s, occupancy),
  ];
  for (const check of checks) {
    const result = check(candidate, session, entities, occupancy);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Independent final validation pass over a COMPLETE proposed schedule.
 * Re-derives occupancy from scratch and re-checks every hard constraint,
 * plus schedule-level invariants (weekly frequency, duplicates, references).
 * This never trusts the solver's own bookkeeping.
 */
function finalValidate(schedule, sessions, entities) {
  const problems = [];
  const occupancy = { division: new Map(), faculty: new Map(), classroom: new Map() };
  const seenSessionIds = new Set();

  for (const entry of schedule) {
    const session = sessions.find((s) => s.id === entry.sessionId);
    if (!session) {
      problems.push({ code: 'INVALID_REFERENCE', message: `Schedule entry references unknown session ${entry.sessionId}` });
      continue;
    }
    if (seenSessionIds.has(entry.sessionId)) {
      problems.push({ code: 'DUPLICATE_SESSION', message: `Session ${entry.sessionId} scheduled more than once`, sessionId: entry.sessionId });
      continue;
    }
    seenSessionIds.add(entry.sessionId);

    if (!entities.divisionsById.has(entry.divisionId) || !entities.subjectsById.has(entry.subjectId) ||
        !entities.facultyById.has(entry.facultyId) || !entities.classroomsById.has(entry.classroomId)) {
      problems.push({ code: 'INVALID_REFERENCE', message: `Schedule entry ${entry.sessionId} references an invalid entity`, sessionId: entry.sessionId });
      continue;
    }

    const candidate = { day: entry.day, period: entry.period, classroomId: entry.classroomId };
    const result = validateCandidate(candidate, session, entities, occupancy);
    if (!result.ok) {
      problems.push({ code: result.code, message: `${entry.sessionId}: ${result.message}`, sessionId: entry.sessionId });
      continue;
    }

    const periods = occupiedPeriods(entry.period, session.duration);
    for (const p of periods) {
      occupancy.division.set(`${session.divisionId}|${entry.day}|${p}`, entry.sessionId);
      occupancy.faculty.set(`${session.facultyId}|${entry.day}|${p}`, entry.sessionId);
      occupancy.classroom.set(`${entry.classroomId}|${entry.day}|${p}`, entry.sessionId);
    }
  }

  // Exact weekly frequency: every required session must appear exactly once.
  for (const session of sessions) {
    if (!seenSessionIds.has(session.id)) {
      problems.push({ code: 'MISSING_SESSION', message: `Required session ${session.id} was not scheduled`, sessionId: session.id });
    }
  }

  return { valid: problems.length === 0, problems };
}

module.exports = {
  occupiedPeriods,
  isWithinDay,
  slotAllowed,
  validateCandidate,
  finalValidate,
  checkDivisionConflict,
  checkFacultyConflict,
  checkClassroomConflict,
  checkRoomCapacity,
  checkRoomType,
  checkFacultyAvailability,
  checkClassroomAvailability,
  checkDivisionAvailability,
  checkWithinDay,
};
