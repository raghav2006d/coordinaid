import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
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
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'marked-late'],
      required: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
    proofImage: {
      type: String,
      default: '',
    },
    volunteerNotes: {
      type: String,
      default: '',
    },
    proofSubmittedAt: Date,
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: Date,
    organizerNotes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Attendance', attendanceSchema);
