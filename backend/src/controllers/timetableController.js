const { generateTimetable, validateExistingTimetable } = require('../services/TimetableService');
const { GenerateRequestSchema, validate } = require('../validators/inputValidators');
const Timetable = require('../models/Timetable');
const Division = require('../models/Division');
const Subject = require('../models/Subject');
const Faculty = require('../models/Faculty');
const Classroom = require('../models/Classroom');
const { getSampleDataset } = require('../seed/seedData');

/** Loads divisions/subjects/faculty/classrooms from MongoDB and shapes them for the service layer. */
async function loadEntitiesFromDb() {
  const [divisions, subjects, faculty, classrooms] = await Promise.all([
    Division.find().lean(),
    Subject.find().lean(),
    Faculty.find().lean(),
    Classroom.find().lean(),
  ]);
  return {
    divisions: divisions.map((d) => ({ ...d, id: d._id })),
    subjects: subjects.map((s) => ({ ...s, id: s._id, division: s.division, faculty: s.faculty })),
    faculty: faculty.map((f) => ({ ...f, id: f._id })),
    classrooms: classrooms.map((c) => ({ ...c, id: c._id })),
  };
}

async function generate(req, res, next) {
  try {
    const payload = validate(GenerateRequestSchema, req.body || {});
    let input = payload;

    if (!payload.useSample && !(payload.divisions && payload.subjects && payload.faculty && payload.classrooms)) {
      // No sample requested and no full dataset supplied inline: fall back to whatever is in MongoDB.
      const dbEntities = await loadEntitiesFromDb();
      input = { ...dbEntities, timeConfig: payload.timeConfig };
    }

    const result = generateTimetable(input);

    // Persist the run for audit/history purposes (best-effort; failures here should not break the response).
    try {
      await Timetable.create({
        label: payload.useSample ? `Sample: ${payload.useSample}` : 'Custom generation',
        status: result.status,
        message: result.message,
        schedule: result.schedule.map((e) => ({
          sessionId: e.sessionId,
          division: e.division,
          subject: e.subject,
          faculty: e.faculty,
          classroom: e.classroom,
          day: e.day,
          period: e.period,
        })),
        unscheduled: result.unscheduled,
        diagnostics: result.diagnostics,
        statistics: result.statistics,
      });
    } catch (persistErr) {
      // Non-fatal: generation itself succeeded even if we couldn't save history (e.g. DB not connected).
      req.app?.locals?.logger?.warn?.('Failed to persist timetable run', persistErr);
    }

    const httpStatus = result.status === 'FAILED' ? 200 : 200; // Domain-level failure is still a valid HTTP response.
    res.status(httpStatus).json(result);
  } catch (err) {
    next(err);
  }
}

async function sample(req, res, next) {
  try {
    const result = generateTimetable({ useSample: 'valid' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function sampleConflict(req, res, next) {
  try {
    const result = generateTimetable({ useSample: 'conflict' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getRawSample(req, res, next) {
  try {
    const kind = req.params.kind === 'conflict' ? 'conflict' : 'valid';
    res.json(getSampleDataset(kind));
  } catch (err) {
    next(err);
  }
}

async function validateTimetable(req, res, next) {
  try {
    const { schedule, ...rest } = req.body || {};
    if (!Array.isArray(schedule)) {
      const err = new Error('Request body must include a "schedule" array.');
      err.status = 400;
      throw err;
    }
    let input = rest;
    if (!rest.useSample && !(rest.divisions && rest.subjects && rest.faculty && rest.classrooms)) {
      const dbEntities = await loadEntitiesFromDb();
      input = { ...dbEntities, timeConfig: rest.timeConfig };
    }
    const result = validateExistingTimetable(schedule, input);
    res.json({ valid: result.valid, problems: result.problems });
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const runs = await Timetable.find().sort({ createdAt: -1 }).limit(20).lean();
    res.json(runs);
  } catch (err) {
    next(err);
  }
}

module.exports = { generate, sample, sampleConflict, getRawSample, validateTimetable, history };
