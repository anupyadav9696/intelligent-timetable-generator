const { runPreflightChecks } = require('../scheduler/PreflightValidator');
const { buildEntities } = require('../services/TimetableService');
const { VALID_DATASET, IMPOSSIBLE_DATASET } = require('../seed/seedData');

describe('PreflightValidator', () => {
  test('valid dataset passes all preflight checks', () => {
    const entities = buildEntities(VALID_DATASET);
    const result = runPreflightChecks(entities);
    expect(result.feasible).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  test('flags FACULTY_CAPACITY_EXCEEDED when a faculty member is overloaded', () => {
    const entities = buildEntities(IMPOSSIBLE_DATASET);
    const result = runPreflightChecks(entities);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('FACULTY_CAPACITY_EXCEEDED');
  });

  test('flags NO_SUITABLE_ROOM when no classroom satisfies type/capacity', () => {
    const entities = buildEntities(IMPOSSIBLE_DATASET);
    const result = runPreflightChecks(entities);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('NO_SUITABLE_ROOM');
  });

  test('flags INSUFFICIENT_LAB_CAPACITY when combined lab demand exceeds supply', () => {
    const entities = buildEntities(IMPOSSIBLE_DATASET);
    const result = runPreflightChecks(entities);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('INSUFFICIENT_LAB_CAPACITY');
  });

  test('flags DIVISION_CAPACITY_EXCEEDED when a division needs more slots than exist', () => {
    const overloaded = {
      timeConfig: { days: ['Monday'], periodsPerDay: 2, maxSearchNodes: 1000, timeoutMs: 2000 },
      divisions: [{ id: 'd1', name: 'D1', code: 'D1', studentCount: 10, availableSlots: [] }],
      faculty: [{ id: 'f1', name: 'F1', email: 'f1@x.com', availableSlots: [] }],
      classrooms: [{ id: 'c1', name: 'C1', roomNumber: 'C1', capacity: 20, roomType: 'classroom', availableSlots: [] }],
      subjects: [
        { id: 's1', name: 'S1', code: 'S1', weeklyFrequency: 5, requiresLab: false, duration: 1, division: 'd1', faculty: 'f1' },
      ],
    };
    const entities = buildEntities(overloaded);
    const result = runPreflightChecks(entities);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('DIVISION_CAPACITY_EXCEEDED');
  });
});
