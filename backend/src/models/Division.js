const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    period: { type: Number, required: true },
  },
  { _id: false }
);

const DivisionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    studentCount: { type: Number, required: true, min: 1 },
    // If availableSlots is empty, the division is treated as available on ALL
    // configured day/period combinations (see TimeConfig).
    availableSlots: { type: [SlotSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Division', DivisionSchema);
