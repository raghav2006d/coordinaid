import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    roleName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    requiredSkills: [
      {
        name: String,
        minimumLevel: {
          type: String,
          enum: ['beginner', 'intermediate', 'advanced'],
          default: 'beginner',
        },
      },
    ],
    requiredCount: {
      type: Number,
      required: true,
      min: 1,
    },
    assignedCount: {
      type: Number,
      default: 0,
    },
    preferredExperienceLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
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
  },
  { timestamps: true }
);

export default mongoose.model('Role', roleSchema);
