/**
 * ScoringEngine.js
 *
 * Implements the SOFT constraint(s) for the timetable generator.
 * Soft constraints never override hard constraints: this module only
 * ever RANKS candidates that have already passed every hard-constraint
 * check in ConstraintValidator.js. It never rejects a candidate.
 *
 * Soft constraint implemented: Subject Distribution.
 *   Repeated sessions of the same subject should preferably land on
 *   different days rather than being stacked on the same day. We score
 *   each candidate day by how many sessions of the SAME subject are
 *   already scheduled on that day (lower is better), so the search
 *   tries the most-spread-out options first.
 */

function scoreCandidate(candidate, session, scheduledSoFar) {
  const sameSubjectSameDay = scheduledSoFar.filter(
    (entry) => entry.subjectId === session.subjectId && entry.day === candidate.day
  ).length;

  // Lower score = more preferred. Each repeat of the subject on the same
  // day adds a heavy penalty so distribution across days is strongly
  // favored whenever multiple candidates are otherwise hard-constraint-valid.
  let score = sameSubjectSameDay * 100;

  // Mild secondary preference: earlier periods first, for a tidier-looking
  // timetable (purely cosmetic tie-break, never affects feasibility).
  score += candidate.period;

  return score;
}

/** Sorts hard-constraint-valid candidates best-first using the soft constraints. */
function orderCandidates(candidates, session, scheduledSoFar) {
  return [...candidates].sort(
    (a, b) => scoreCandidate(a, session, scheduledSoFar) - scoreCandidate(b, session, scheduledSoFar)
  );
}

module.exports = { scoreCandidate, orderCandidates };
