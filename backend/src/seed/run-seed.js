/**
 * run-seed.js
 *
 * Populates MongoDB with the VALID_DATASET demo data (divisions, subjects,
 * faculty, classrooms) so the frontend/API can be exercised against real
 * persisted documents, not just the in-memory sample. Run with:
 *
 *   npm run seed          (from backend/)
 */
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const Division = require('../models/Division');
const Subject = require('../models/Subject');
const Faculty = require('../models/Faculty');
const Classroom = require('../models/Classroom');
const { VALID_DATASET } = require('./seedData');

async function seed() {
  await connectDB();
  console.log('[seed] Clearing existing collections...');
  await Promise.all([
    Division.deleteMany({}),
    Subject.deleteMany({}),
    Faculty.deleteMany({}),
    Classroom.deleteMany({}),
  ]);

  console.log('[seed] Inserting divisions, faculty, classrooms...');
  const divisionDocs = await Division.insertMany(
    VALID_DATASET.divisions.map(({ id, ...d }) => d)
  );
  const facultyDocs = await Faculty.insertMany(
    VALID_DATASET.faculty.map(({ id, ...f }) => f)
  );
  const classroomDocs = await Classroom.insertMany(
    VALID_DATASET.classrooms.map(({ id, ...c }) => c)
  );

  const divisionIdMap = new Map(VALID_DATASET.divisions.map((d, i) => [d.id, divisionDocs[i]._id]));
  const facultyIdMap = new Map(VALID_DATASET.faculty.map((f, i) => [f.id, facultyDocs[i]._id]));

  console.log('[seed] Inserting subjects...');
  const subjectDocs = await Subject.insertMany(
    VALID_DATASET.subjects.map((s) => ({
      name: s.name,
      code: s.code,
      weeklyFrequency: s.weeklyFrequency,
      requiresLab: s.requiresLab,
      duration: s.duration,
      division: divisionIdMap.get(s.division),
      faculty: facultyIdMap.get(s.faculty),
    }))
  );

  // Back-fill faculty.subjects references.
  for (const subjectDoc of subjectDocs) {
    await Faculty.findByIdAndUpdate(subjectDoc.faculty, { $addToSet: { subjects: subjectDoc._id } });
  }

  console.log(`[seed] Done: ${divisionDocs.length} divisions, ${facultyDocs.length} faculty, ` +
    `${classroomDocs.length} classrooms, ${subjectDocs.length} subjects.`);

  await disconnectDB();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  });
