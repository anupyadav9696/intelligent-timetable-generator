/**
 * crudControllerFactory.js
 *
 * Small helper that generates standard list/get/create/update/delete
 * handlers for a given Mongoose model + Zod input schema, so the four
 * simple entity resources (divisions/subjects/faculty/classrooms) don't
 * need four near-identical hand-written controllers.
 */
const { validate } = require('../validators/inputValidators');

function createCrudController(Model, schema) {
  return {
    async list(req, res, next) {
      try {
        const docs = await Model.find().lean();
        res.json(docs);
      } catch (err) {
        next(err);
      }
    },
    async get(req, res, next) {
      try {
        const doc = await Model.findById(req.params.id).lean();
        if (!doc) return res.status(404).json({ message: 'Not found' });
        res.json(doc);
      } catch (err) {
        next(err);
      }
    },
    async create(req, res, next) {
      try {
        const data = validate(schema, req.body || {});
        const doc = await Model.create(data);
        res.status(201).json(doc);
      } catch (err) {
        next(err);
      }
    },
    async update(req, res, next) {
      try {
        const data = validate(schema.partial ? schema.partial() : schema, req.body || {});
        const doc = await Model.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
        if (!doc) return res.status(404).json({ message: 'Not found' });
        res.json(doc);
      } catch (err) {
        next(err);
      }
    },
    async remove(req, res, next) {
      try {
        const doc = await Model.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Not found' });
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { createCrudController };
