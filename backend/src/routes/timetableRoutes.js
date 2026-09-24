const express = require('express');
const timetableController = require('../controllers/timetableController');
const { createCrudController } = require('../controllers/crudControllerFactory');
const Division = require('../models/Division');
const Subject = require('../models/Subject');
const Faculty = require('../models/Faculty');
const Classroom = require('../models/Classroom');
const {
  DivisionInputSchema,
  SubjectInputSchema,
  FacultyInputSchema,
  ClassroomInputSchema,
} = require('../validators/inputValidators');

const router = express.Router();

// --- Core timetable endpoints -------------------------------------------
router.post('/timetable/generate', timetableController.generate);
router.get('/timetable/sample', timetableController.sample);
router.get('/timetable/sample-conflict', timetableController.sampleConflict);
router.get('/timetable/sample-data/:kind', timetableController.getRawSample);
router.post('/timetable/validate', timetableController.validateTimetable);
router.get('/timetable/history', timetableController.history);

// --- Simple CRUD resources -----------------------------------------------
function mountCrud(path, Model, schema) {
  const c = createCrudController(Model, schema);
  router.get(`/${path}`, c.list);
  router.get(`/${path}/:id`, c.get);
  router.post(`/${path}`, c.create);
  router.put(`/${path}/:id`, c.update);
  router.delete(`/${path}/:id`, c.remove);
}

mountCrud('divisions', Division, DivisionInputSchema);
mountCrud('subjects', Subject, SubjectInputSchema);
mountCrud('faculty', Faculty, FacultyInputSchema);
mountCrud('classrooms', Classroom, ClassroomInputSchema);

module.exports = router;
