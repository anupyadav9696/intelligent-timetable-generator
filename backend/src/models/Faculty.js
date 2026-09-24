const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    period: { type: Number, required: true },
  },
  { _id: false }
);

const FacultySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    // If availableSlots is empty, faculty is treated as available on ALL
    // configured day/period combinations.
    availableSlots: { type: [SlotSchema], default: [] },
    maxWeeklySessions: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Faculty', FacultySchema);
