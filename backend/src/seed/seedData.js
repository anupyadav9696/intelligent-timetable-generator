/**
 * seedData.js
 *
 * Provides two hand-crafted demo datasets used both for MongoDB seeding
 * (`npm run seed`) and for the /api/timetable/sample* endpoints:
 *
 *   - VALID_DATASET     -> should produce a SUCCESS timetable.
 *   - IMPOSSIBLE_DATASET -> intentionally infeasible; demonstrates FAILED /
 *                           PARTIAL with meaningful diagnostics.
 *
 * Entities use plain string ids (`d1`, `s1`, `f1`, `c1`, ...) so this file
 * can be used directly by the solver/service layer without a database, and
 * also mapped onto real Mongoose _ids by seed/run-seed.js.
 */

const TIME_CONFIG = {
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  periodsPerDay: 6,
  maxSearchNodes: 200000,
  timeoutMs: 8000,
};

// ---------------------------------------------------------------------
// VALID DATASET — comfortably schedulable.
// 2 divisions, 6 subjects (incl. one lab, varying weekly frequencies),
// 5 faculty, 4 classrooms (incl. a large room and a lab).
// ---------------------------------------------------------------------
const VALID_DATASET = {
  timeConfig: TIME_CONFIG,
  divisions: [
    { id: 'd1', name: 'CSE-A', code: 'CSE-A', studentCount: 55, availableSlots: [] },
    { id: 'd2', name: 'CSE-B', code: 'CSE-B', studentCount: 48, availableSlots: [] },
  ],
  faculty: [
    { id: 'f1', name: 'Dr. Rao', email: 'rao@college.edu', availableSlots: [] },
    { id: 'f2', name: 'Prof. Iyer', email: 'iyer@college.edu', availableSlots: [] },
    { id: 'f3', name: 'Dr. Sharma', email: 'sharma@college.edu', availableSlots: [] },
    { id: 'f4', name: 'Prof. Nair', email: 'nair@college.edu', availableSlots: [] },
    { id: 'f5', name: 'Dr. Fernandes', email: 'fernandes@college.edu', availableSlots: [] },
  ],
  classrooms: [
    { id: 'c1', name: 'Room 101', roomNumber: '101', capacity: 60, roomType: 'classroom', availableSlots: [] },
    { id: 'c2', name: 'Room 102', roomNumber: '102', capacity: 50, roomType: 'classroom', availableSlots: [] },
    { id: 'c3', name: 'Room 201 (Large)', roomNumber: '201', capacity: 80, roomType: 'classroom', availableSlots: [] },
    { id: 'c4', name: 'Programming Lab', roomNumber: 'L1', capacity: 60, roomType: 'lab', availableSlots: [] },
  ],
  subjects: [
    { id: 's1', name: 'Mathematics', code: 'MATH-A', weeklyFrequency: 4, requiresLab: false, duration: 1, division: 'd1', faculty: 'f1' },
    { id: 's2', name: 'Physics', code: 'PHY-A', weeklyFrequency: 3, requiresLab: false, duration: 1, division: 'd1', faculty: 'f2' },
    { id: 's3', name: 'Programming Lab', code: 'PROG-LAB-A', weeklyFrequency: 2, requiresLab: true, duration: 2, division: 'd1', faculty: 'f3' },
    { id: 's4', name: 'Mathematics', code: 'MATH-B', weeklyFrequency: 4, requiresLab: false, duration: 1, division: 'd2', faculty: 'f1' },
    { id: 's5', name: 'Data Structures', code: 'DS-B', weeklyFrequency: 3, requiresLab: false, duration: 1, division: 'd2', faculty: 'f4' },
    { id: 's6', name: 'Programming Lab', code: 'PROG-LAB-B', weeklyFrequency: 2, requiresLab: true, duration: 2, division: 'd2', faculty: 'f5' },
  ],
};

// ---------------------------------------------------------------------
// IMPOSSIBLE DATASET — intentionally infeasible.
// Reuses the same divisions/rooms but:
//   - One faculty member ("Dr. Overloaded") is assigned far more weekly
//     sessions than the days/periods she is available for
//     -> FACULTY_CAPACITY_EXCEEDED.
//   - A subject requires a lab, but no lab room has enough capacity for
//     the division -> NO_SUITABLE_ROOM.
//   - Overall lab demand exceeds combined lab capacity -> INSUFFICIENT_LAB_CAPACITY.
// ---------------------------------------------------------------------
const IMPOSSIBLE_DATASET = {
  timeConfig: TIME_CONFIG,
  divisions: [
    { id: 'd1', name: 'CSE-A', code: 'CSE-A', studentCount: 55, availableSlots: [] },
    { id: 'd2', name: 'ECE-A', code: 'ECE-A', studentCount: 70, availableSlots: [] },
  ],
  faculty: [
    {
      id: 'f1',
      name: 'Dr. Overloaded',
      email: 'overloaded@college.edu',
      // Only available Monday & Tuesday mornings (6 slots) ...
      availableSlots: [
        { day: 'Monday', period: 1 },
        { day: 'Monday', period: 2 },
        { day: 'Monday', period: 3 },
        { day: 'Tuesday', period: 1 },
        { day: 'Tuesday', period: 2 },
        { day: 'Tuesday', period: 3 },
      ],
    },
    { id: 'f2', name: 'Prof. Iyer', email: 'iyer2@college.edu', availableSlots: [] },
    { id: 'f3', name: 'Dr. Sharma', email: 'sharma2@college.edu', availableSlots: [] },
  ],
  classrooms: [
    { id: 'c1', name: 'Room 101', roomNumber: 'IR-101', capacity: 60, roomType: 'classroom', availableSlots: [] },
    {
      id: 'c2',
      name: 'Small Lab',
      roomNumber: 'IR-L1',
      capacity: 20,
      roomType: 'lab',
      // Only open a handful of slots/week, so combined lab demand (22
      // slot-periods, see subjects below) outstrips supply -> INSUFFICIENT_LAB_CAPACITY.
      availableSlots: [
        { day: 'Monday', period: 1 },
        { day: 'Monday', period: 2 },
        { day: 'Tuesday', period: 1 },
        { day: 'Tuesday', period: 2 },
      ],
    },
  ],
  subjects: [
    // ... but she's assigned 10 sessions/week (needs 10 slots, has 6) -> FACULTY_CAPACITY_EXCEEDED.
    { id: 's1', name: 'Overloaded Subject', code: 'OVL-A', weeklyFrequency: 10, requiresLab: false, duration: 1, division: 'd1', faculty: 'f1' },
    // Requires a lab for a 70-student division, but the only lab holds 20 -> NO_SUITABLE_ROOM.
    { id: 's2', name: 'Electronics Lab', code: 'ELAB-B', weeklyFrequency: 3, requiresLab: true, duration: 2, division: 'd2', faculty: 'f2' },
    // Adds more lab demand than the single small lab can ever provide across the week -> INSUFFICIENT_LAB_CAPACITY.
    { id: 's3', name: 'Circuits Lab', code: 'CLAB-A', weeklyFrequency: 8, requiresLab: true, duration: 2, division: 'd1', faculty: 'f3' },
  ],
};

function getSampleDataset(kind) {
  if (kind === 'valid') return VALID_DATASET;
  if (kind === 'conflict') return IMPOSSIBLE_DATASET;
  throw new Error(`Unknown sample dataset kind: ${kind}`);
}

module.exports = { VALID_DATASET, IMPOSSIBLE_DATASET, getSampleDataset, TIME_CONFIG };
