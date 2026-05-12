import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    eventLogo: {
      type: String,
      trim: true,
      default: '',
    },
    mottoText: {
      type: String,
      trim: true,
      default: '',
    },
    mottoImage: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'general',
    },
    eventType: {
      type: String,
      trim: true,
      default: 'general',
    },
    expectedAttendees: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
    },
    isFullDay: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: String,
      default: '',
    },
    endTime: {
      type: String,
      default: '',
    },
    venue: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    status: {
      type: String,
      enum: ['planning', 'allocation-in-progress', 'allocated', 'confirmed', 'completed'],
      default: 'planning',
    },
    maxVolunteers: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Event', eventSchema);
