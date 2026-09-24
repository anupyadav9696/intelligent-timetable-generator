const { generateTimetable, buildEntities } = require('../services/TimetableService');
const { finalValidate } = require('../scheduler/ConstraintValidator');
const { buildSessions } = require('../scheduler/TimetableSolver');
const { VALID_DATASET, IMPOSSIBLE_DATASET } = require('../seed/seedData');

describe('TimetableSolver / TimetableService', () => {
  test('valid dataset resolves to SUCCESS with every required session scheduled', () => {
    const result = generateTimetable({ useSample: 'valid' });
    expect(result.status).toBe('SUCCESS');
    expect(result.statistics.scheduledSessions).toBe(result.statistics.requiredSessions);
    expect(result.unscheduled).toHaveLength(0);
  });

  test('impossible dataset never returns SUCCESS', () => {
    const result = generateTimetable({ useSample: 'conflict' });
    expect(result.status).not.toBe('SUCCESS');
    expect(['FAILED', 'PARTIAL']).toContain(result.status);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  test('a SUCCESS schedule passes independent final validation with zero hard-constraint violations', () => {
    const result = generateTimetable({ useSample: 'valid' });
    const entities = buildEntities(VALID_DATASET);
    const sessions = buildSessions(entities.subjectsById);
    const normalized = result.schedule.map((e) => ({
      sessionId: e.sessionId,
      divisionId: e.division,
      subjectId: e.subject,
      facultyId: e.faculty,
      classroomId: e.classroom,
      day: e.day,
      period: e.period,
    }));
    const validation = finalValidate(normalized, sessions, entities);
    expect(validation.valid).toBe(true);
    expect(validation.problems).toHaveLength(0);
  });

  test('exact weekly frequency: every subject gets exactly weeklyFrequency sessions on SUCCESS', () => {
    const result = generateTimetable({ useSample: 'valid' });
    const countsBySubject = {};
    for (const entry of result.schedule) {
      countsBySubject[entry.subject] = (countsBySubject[entry.subject] || 0) + 1;
    }
    for (const subject of VALID_DATASET.subjects) {
      expect(countsBySubject[subject.id]).toBe(subject.weeklyFrequency);
    }
  });

  test('no duplicate sessions appear in a SUCCESS schedule', () => {
    const result = generateTimetable({ useSample: 'valid' });
    const ids = result.schedule.map((e) => e.sessionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('impossible dataset schedule (if PARTIAL) has zero hard-constraint violations among what WAS scheduled', () => {
    const result = generateTimetable({ useSample: 'conflict' });
    const entities = buildEntities(IMPOSSIBLE_DATASET);
    const sessions = buildSessions(entities.subjectsById);
    const normalized = result.schedule.map((e) => ({
      sessionId: e.sessionId,
      divisionId: e.division,
      subjectId: e.subject,
      facultyId: e.faculty,
      classroomId: e.classroom,
      day: e.day,
      period: e.period,
    }));
    // Even a partial/failed run's scheduled entries must never violate hard constraints themselves.
    const validation = finalValidate(normalized, sessions, entities);
    const nonMissingProblems = validation.problems.filter((p) => p.code !== 'MISSING_SESSION');
    expect(nonMissingProblems).toHaveLength(0);
  });
});
