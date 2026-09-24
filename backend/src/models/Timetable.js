const mongoose = require('mongoose');

const EntrySchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    division: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    day: { type: String, required: true },
    period: { type: Number, required: true },
  },
  { _id: false }
);

const DiagnosticSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    sessionId: { type: String },
  },
  { _id: false }
);

const TimetableSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Generated Timetable' },
    status: { type: String, enum: ['SUCCESS', 'PARTIAL', 'FAILED'], required: true },
    message: { type: String, required: true },
    schedule: { type: [EntrySchema], default: [] },
    unscheduled: { type: [{ sessionId: String, reasons: [String] }], default: [] },
    diagnostics: { type: [DiagnosticSchema], default: [] },
    statistics: {
      scheduledSessions: { type: Number, default: 0 },
      requiredSessions: { type: Number, default: 0 },
      searchNodes: { type: Number, default: 0 },
      backtracks: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Timetable', TimetableSchema);
