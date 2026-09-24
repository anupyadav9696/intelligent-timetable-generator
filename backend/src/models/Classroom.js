const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    period: { type: Number, required: true },
  },
  { _id: false }
);

const ROOM_TYPES = ['classroom', 'lab'];

const ClassroomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    roomNumber: { type: String, required: true, unique: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    roomType: { type: String, enum: ROOM_TYPES, default: 'classroom' },
    availableSlots: { type: [SlotSchema], default: [] },
  },
  { timestamps: true }
);

ClassroomSchema.statics.ROOM_TYPES = ROOM_TYPES;

module.exports = mongoose.model('Classroom', ClassroomSchema);
