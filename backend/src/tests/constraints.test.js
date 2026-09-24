const {
  checkDivisionConflict,
  checkFacultyConflict,
  checkClassroomConflict,
  checkRoomCapacity,
  checkRoomType,
  checkFacultyAvailability,
  validateCandidate,
} = require('../scheduler/ConstraintValidator');

function makeEntities() {
  return {
    divisionsById: new Map([['d1', { id: 'd1', studentCount: 50 }]]),
    classroomsById: new Map([
      ['c1', { id: 'c1', capacity: 60, roomType: 'classroom', availableSlots: [] }],
      ['c2', { id: 'c2', capacity: 20, roomType: 'classroom', availableSlots: [] }],
      ['lab1', { id: 'lab1', capacity: 60, roomType: 'lab', availableSlots: [] }],
    ]),
    facultyById: new Map([
      ['f1', { id: 'f1', name: 'F1', availableSlots: [] }],
      ['f2', { id: 'f2', name: 'F2', availableSlots: [{ day: 'Monday', period: 1 }] }],
    ]),
    timeConfig: { days: ['Monday', 'Tuesday'], periodsPerDay: 6 },
  };
}

function makeSession(overrides = {}) {
  return {
    id: 'SESS-1',
    subjectId: 'sub1',
    divisionId: 'd1',
    facultyId: 'f1',
    requiresLab: false,
    duration: 1,
    ...overrides,
  };
}

describe('ConstraintValidator - hard constraints', () => {
  test('detects division conflict when division already occupied', () => {
    const occupancy = { division: new Map([['d1|Monday|1', 'OTHER']]), faculty: new Map(), classroom: new Map() };
    const result = checkDivisionConflict({ day: 'Monday', period: 1 }, makeSession(), occupancy);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('DIVISION_CONFLICT');
  });

  test('detects faculty conflict when faculty already teaching', () => {
    const occupancy = { division: new Map(), faculty: new Map([['f1|Monday|1', 'OTHER']]), classroom: new Map() };
    const result = checkFacultyConflict({ day: 'Monday', period: 1 }, makeSession(), occupancy);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('FACULTY_CONFLICT');
  });

  test('detects classroom conflict when room already booked', () => {
    const occupancy = { division: new Map(), faculty: new Map(), classroom: new Map([['c1|Monday|1', 'OTHER']]) };
    const result = checkClassroomConflict({ day: 'Monday', period: 1, classroomId: 'c1' }, makeSession(), occupancy);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ROOM_CONFLICT');
  });

  test('rejects room whose capacity is below the division size', () => {
    const entities = makeEntities();
    const result = checkRoomCapacity({ classroomId: 'c2' }, makeSession(), entities);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ROOM_CAPACITY');
  });

  test('accepts room whose capacity meets the division size', () => {
    const entities = makeEntities();
    const result = checkRoomCapacity({ classroomId: 'c1' }, makeSession(), entities);
    expect(result.ok).toBe(true);
  });

  test('rejects a non-lab room for a subject requiring a lab', () => {
    const entities = makeEntities();
    const result = checkRoomType({ classroomId: 'c1' }, makeSession({ requiresLab: true }), entities);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ROOM_TYPE');
  });

  test('accepts a lab room for a subject requiring a lab', () => {
    const entities = makeEntities();
    const result = checkRoomType({ classroomId: 'lab1' }, makeSession({ requiresLab: true }), entities);
    expect(result.ok).toBe(true);
  });

  test('rejects a slot outside faculty availability', () => {
    const entities = makeEntities();
    const result = checkFacultyAvailability(
      { day: 'Tuesday', period: 3 },
      makeSession({ facultyId: 'f2' }),
      entities
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('FACULTY_UNAVAILABLE');
  });

  test('accepts a slot inside faculty availability', () => {
    const entities = makeEntities();
    const result = checkFacultyAvailability(
      { day: 'Monday', period: 1 },
      makeSession({ facultyId: 'f2' }),
      entities
    );
    expect(result.ok).toBe(true);
  });

  test('validateCandidate runs the full pipeline and returns first failure', () => {
    const entities = makeEntities();
    const occupancy = { division: new Map(), faculty: new Map(), classroom: new Map() };
    const good = validateCandidate({ day: 'Monday', period: 1, classroomId: 'c1' }, makeSession(), entities, occupancy);
    expect(good.ok).toBe(true);

    const bad = validateCandidate({ day: 'Monday', period: 1, classroomId: 'c2' }, makeSession(), entities, occupancy);
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('ROOM_CAPACITY');
  });
});
