import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /.+@.+\..+/,
    },
    contactNumber: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    profileImage: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ['volunteer', 'organizer', 'admin'],
      default: 'volunteer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    skills: [
      {
        name: String,
        level: {
          type: String,
          enum: ['beginner', 'intermediate', 'advanced'],
          default: 'beginner',
        },
      },
    ],
    availability: [
      {
        date: Date,
        startTime: String,
        endTime: String,
      },
    ],
    participationHistory: [
      {
        eventId: mongoose.Schema.Types.ObjectId,
        roleId: mongoose.Schema.Types.ObjectId,
        date: Date,
        status: {
          type: String,
          enum: ['completed', 'declined', 'no-show'],
        },
      },
    ],
    performanceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    acceptedAssignments: {
      type: Number,
      default: 0,
    },
    totalAssignments: {
      type: Number,
      default: 0,
    },
    attendedEvents: {
      type: Number,
      default: 0,
    },
    assignedEvents: {
      type: Number,
      default: 0,
    },
    acceptanceRate: {
      type: Number,
      default: 0,
    },
    attendanceRate: {
      type: Number,
      default: 0,
    },
    rolePreferenceScores: {
      type: Map,
      of: Number,
      default: {},
    },
    declinePatterns: {
      type: Map,
      of: Number,
      default: {},
    },
    totalParticipations: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
