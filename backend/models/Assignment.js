import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    matchScore: {
      skillMatch: Number,
      experienceMatch: Number,
      availabilityMatch: Number,
      performanceMatch: Number,
      totalScore: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'completed', 'no-show'],
      default: 'pending',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: Date,
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model('Assignment', assignmentSchema);
