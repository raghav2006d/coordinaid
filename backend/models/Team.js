import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema(
  {
    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const joinRequestSchema = new mongoose.Schema(
  {
    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      trim: true,
      default: '',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 400,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    focusArea: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    preferredEventTypes: {
      type: [String],
      default: [],
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    members: {
      type: [teamMemberSchema],
      default: [],
    },
    pendingRequests: {
      type: [joinRequestSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model('Team', teamSchema);
