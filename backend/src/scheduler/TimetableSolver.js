/**
 * TimetableSolver.js
 *
 * The real CSP engine: variables = required subject sessions, domains =
 * {day, period, classroom} candidates (faculty is fixed per subject),
 * hard constraints enforced during search (ConstraintValidator.js),
 * candidates ranked by soft constraints (ScoringEngine.js), variable
 * selection via Minimum Remaining Values (MRV), and recursive
 * backtracking with correct undo of state on failure.
 *
 * See APPROACH.md for the full algorithm write-up.
 */

const { validateCandidate, occupiedPeriods } = require('./ConstraintValidator');
const { orderCandidates } = require('./ScoringEngine');

class SearchLimitError extends Error {
  constructor(kind) {
    super(`Solver search limit reached: ${kind}`);
    this.kind = kind; // 'NODES' | 'TIMEOUT'
  }
}

/** Builds one scheduling variable per required weekly session of every subject. */
function buildSessions(subjectsById) {
  const sessions = [];
  for (const subject of subjectsById.values()) {
    for (let i = 1; i <= subject.weeklyFrequency; i += 1) {
      sessions.push({
        id: `${subject.code}-S${i}`,
        subjectId: subject.id,
        divisionId: subject.divisionId,
        facultyId: subject.facultyId,
        requiresLab: subject.requiresLab,
        duration: subject.duration,
      });
    }
  }
  return sessions;
}

/**
 * Generates every hard-constraint-valid candidate for a session given the
 * current occupancy state, and a tally of why rejected candidates failed
 * (useful for diagnostics when the domain turns out to be empty).
 */
function generateDomain(session, entities, occupancy) {
  const candidates = [];
  const failureTally = {};
  const { days, periodsPerDay } = entities.timeConfig;

  for (const day of days) {
    for (let period = 1; period <= periodsPerDay; period += 1) {
      for (const classroom of entities.classroomsById.values()) {
        const candidate = { day, period, classroomId: classroom.id };
        const result = validateCandidate(candidate, session, entities, occupancy);
        if (result.ok) {
          candidates.push(candidate);
        } else {
          failureTally[result.code] = (failureTally[result.code] || 0) + 1;
        }
      }
    }
  }
  return { candidates, failureTally };
}

function applyAssignment(session, candidate, occupancy) {
  const periods = occupiedPeriods(candidate.period, session.duration);
  for (const p of periods) {
    occupancy.division.set(`${session.divisionId}|${candidate.day}|${p}`, session.id);
    occupancy.faculty.set(`${session.facultyId}|${candidate.day}|${p}`, session.id);
    occupancy.classroom.set(`${candidate.classroomId}|${candidate.day}|${p}`, session.id);
  }
}

function undoAssignment(session, candidate, occupancy) {
  const periods = occupiedPeriods(candidate.period, session.duration);
  for (const p of periods) {
    occupancy.division.delete(`${session.divisionId}|${candidate.day}|${p}`);
    occupancy.faculty.delete(`${session.facultyId}|${candidate.day}|${p}`);
    occupancy.classroom.delete(`${candidate.classroomId}|${candidate.day}|${p}`);
  }
}

/**
 * Recursive backtracking search over the remaining unassigned sessions.
 * Uses MRV to pick the next variable: at each step it (re)computes the
 * domain of every remaining session against the CURRENT occupancy (this is
 * the constraint-propagation step) and picks the session with the fewest
 * legal candidates, so the most constrained sessions are resolved first
 * and dead ends are discovered as early as possible.
 */
function backtrack(remaining, entities, occupancy, assigned, stats, deadline, bestPartial) {
  stats.searchNodes += 1;
  if (stats.maxSearchNodes && stats.searchNodes > stats.maxSearchNodes) {
    throw new SearchLimitError('NODES');
  }
  if (deadline && Date.now() > deadline) {
    throw new SearchLimitError('TIMEOUT');
  }

  if (assigned.length > bestPartial.assigned.length) {
    bestPartial.assigned = [...assigned];
  }

  if (remaining.length === 0) {
    return { success: true };
  }

  // --- MRV: evaluate the domain of every remaining session -------------
  let chosenIndex = -1;
  let chosenDomain = null;
  let chosenFailureTally = null;
  let minSize = Infinity;

  for (let i = 0; i < remaining.length; i += 1) {
    const { candidates, failureTally } = generateDomain(remaining[i], entities, occupancy);
    if (candidates.length < minSize) {
      minSize = candidates.length;
      chosenIndex = i;
      chosenDomain = candidates;
      chosenFailureTally = failureTally;
      if (minSize === 0) break; // can't do better than a dead end; report it immediately
    }
  }

  const session = remaining[chosenIndex];

  if (chosenDomain.length === 0) {
    return {
      success: false,
      deadEndSessionId: session.id,
      failureTally: chosenFailureTally,
    };
  }

  const ordered = orderCandidates(chosenDomain, session, assigned);
  const restRemaining = remaining.filter((_, idx) => idx !== chosenIndex);

  let lastFailure = null;
  for (const candidate of ordered) {
    applyAssignment(session, candidate, occupancy);
    assigned.push({
      sessionId: session.id,
      subjectId: session.subjectId,
      divisionId: session.divisionId,
      facultyId: session.facultyId,
      classroomId: candidate.classroomId,
      day: candidate.day,
      period: candidate.period,
    });

    const outcome = backtrack(restRemaining, entities, occupancy, assigned, stats, deadline, bestPartial);
    if (outcome.success) return outcome;

    // Undo: backtrack.
    lastFailure = outcome;
    assigned.pop();
    undoAssignment(session, candidate, occupancy);
    stats.backtracks += 1;
  }

  return lastFailure || { success: false, deadEndSessionId: session.id, failureTally: chosenFailureTally };
}

/**
 * Runs the full solve. Returns:
 *  { outcome: 'COMPLETE' | 'LIMIT_REACHED' | 'EXHAUSTED',
 *    schedule, unscheduledSessionIds, stats, limitKind? }
 *
 * 'COMPLETE'       -> every session was scheduled.
 * 'LIMIT_REACHED'  -> node/time budget ran out; `schedule` holds the best
 *                     partial assignment found so far.
 * 'EXHAUSTED'       -> backtracking proved no complete assignment exists;
 *                     `schedule` holds the best partial assignment found
 *                     during the search.
 */
function solve(entities, options = {}) {
  const sessions = buildSessions(entities.subjectsById);
  const occupancy = { division: new Map(), faculty: new Map(), classroom: new Map() };
  const stats = { searchNodes: 0, backtracks: 0, maxSearchNodes: options.maxSearchNodes || 200000 };
  const deadline = options.timeoutMs ? Date.now() + options.timeoutMs : null;
  const bestPartial = { assigned: [] };

  const startedAt = Date.now();
  let result;
  let limitKind = null;
  try {
    result = backtrack(sessions, entities, occupancy, [], stats, deadline, bestPartial);
  } catch (err) {
    if (err instanceof SearchLimitError) {
      limitKind = err.kind;
      result = { success: false, limitReached: true };
    } else {
      throw err;
    }
  }
  const durationMs = Date.now() - startedAt;

  if (result.success) {
    return {
      outcome: 'COMPLETE',
      schedule: bestPartial.assigned,
      unscheduledSessionIds: [],
      sessions,
      stats: { ...stats, durationMs },
    };
  }

  const scheduledIds = new Set(bestPartial.assigned.map((e) => e.sessionId));
  const unscheduledSessionIds = sessions.filter((s) => !scheduledIds.has(s.id)).map((s) => s.id);

  return {
    outcome: limitKind ? 'LIMIT_REACHED' : 'EXHAUSTED',
    limitKind,
    schedule: bestPartial.assigned,
    unscheduledSessionIds,
    deadEndSessionId: result.deadEndSessionId,
    failureTally: result.failureTally,
    sessions,
    stats: { ...stats, durationMs },
  };
}

module.exports = { solve, buildSessions, generateDomain, SearchLimitError };
