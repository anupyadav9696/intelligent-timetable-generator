const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    weeklyFrequency: { type: Number, required: true, min: 1 },
    requiresLab: { type: Boolean, default: false },
    duration: { type: Number, default: 1, min: 1 }, // periods per session
    division: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', required: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', SubjectSchema);
