import mongoose from 'mongoose';

const assignmentHistorySchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
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
    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    previousVolunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    newVolunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      enum: [
        'created',
        'manual-assigned',
        'status-changed',
        'volunteer-replaced',
        'auto-reassigned',
        'reassigned-next',
      ],
      required: true,
    },
    fromStatus: String,
    toStatus: String,
    note: String,
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorRole: String,
  },
  { timestamps: true }
);

export default mongoose.model('AssignmentHistory', assignmentHistorySchema);
