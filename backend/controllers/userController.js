import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import Event from '../models/Event.js';
import Role from '../models/Role.js';
import Assignment from '../models/Assignment.js';
import AssignmentHistory from '../models/AssignmentHistory.js';
import Attendance from '../models/Attendance.js';
import Notification from '../models/Notification.js';

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, contactNumber, department, profileImage, skills, availability } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        ...(name && { name }),
        ...(contactNumber !== undefined && { contactNumber }),
        ...(department !== undefined && { department }),
        ...(profileImage !== undefined && { profileImage }),
        ...(skills && { skills }),
        ...(availability && { availability }),
      },
      { new: true }
    ).select('-password');

    res.json({ message: 'Profile updated', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No profile image uploaded.' });
    }

    const fileUrl = `/uploads/profiles/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profileImage: fileUrl },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile image uploaded',
      fileUrl,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload profile image' });
  }
};

export const addSkill = async (req, res) => {
  try {
    const { name, level } = req.body;
    const normalizedName = name?.trim();

    if (!normalizedName) {
      return res.status(400).json({ message: 'Skill name is required.' });
    }

    const existingUser = await User.findById(req.user.userId).select('skills');
    const duplicateSkill = existingUser?.skills?.some(
      (skill) => skill.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (duplicateSkill) {
      return res.status(409).json({ message: 'Skill already exists in profile.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $push: { skills: { name: normalizedName, level: level || 'beginner' } },
      },
      { new: true }
    ).select('-password');

    res.json({ message: 'Skill added', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add skill' });
  }
};

export const removeSkill = async (req, res) => {
  try {
    const { skillName } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $pull: { skills: { name: skillName } },
      },
      { new: true }
    ).select('-password');

    res.json({ message: 'Skill removed', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to remove skill' });
  }
};

export const updateAvailability = async (req, res) => {
  try {
    const { availability } = req.body;

    if (Array.isArray(availability)) {
      const normalizeDate = (value) => new Date(value).toDateString();
      const toMinutes = (value) => {
        const [hour, minute] = String(value || '').split(':').map((part) => Number(part));
        if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
        return hour * 60 + minute;
      };

      for (let i = 0; i < availability.length; i += 1) {
        const slot = availability[i];
        if (!slot?.date || !slot?.startTime || !slot?.endTime) {
          return res.status(400).json({ message: 'Availability slots must include date, start time, and end time.' });
        }

        const start = toMinutes(slot.startTime);
        const end = toMinutes(slot.endTime);
        if (start === null || end === null || end <= start) {
          return res.status(400).json({ message: 'Availability end time must be later than start time.' });
        }

        for (let j = i + 1; j < availability.length; j += 1) {
          const other = availability[j];
          if (normalizeDate(other?.date) !== normalizeDate(slot.date)) {
            continue;
          }
          const otherStart = toMinutes(other.startTime);
          const otherEnd = toMinutes(other.endTime);
          if (otherStart === null || otherEnd === null) {
            continue;
          }
          const overlap = Math.max(start, otherStart) < Math.min(end, otherEnd);
          if (overlap) {
            return res.status(400).json({ message: 'Availability slots cannot overlap on the same day.' });
          }
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { availability },
      { new: true }
    ).select('-password');

    res.json({ message: 'Availability updated', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update availability' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;

    const filter = role ? { role } : {};

    const users = await User.find(filter)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      total,
      page,
      limit,
      users,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

export const updateUserById = async (req, res) => {
  try {
    const { name, email, role, contactNumber, department, profileImage, isActive } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role }),
        ...(contactNumber !== undefined && { contactNumber }),
        ...(department !== undefined && { department }),
        ...(profileImage !== undefined && { profileImage }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated', user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

export const deleteUserById = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

export const deleteOwnAccount = async (req, res) => {
  try {
    const { currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const userId = user._id;
    const userEventIds = (await Event.find({ createdBy: userId }).select('_id')).map((event) => event._id);
    const userRoleIds = (await Role.find({ eventId: { $in: userEventIds } }).select('_id')).map((role) => role._id);

    await Promise.all([
      Assignment.deleteMany({
        $or: [{ volunteerId: userId }, { eventId: { $in: userEventIds } }, { roleId: { $in: userRoleIds } }],
      }),
      AssignmentHistory.deleteMany({
        $or: [
          { volunteerId: userId },
          { previousVolunteerId: userId },
          { newVolunteerId: userId },
          { actorId: userId },
          { eventId: { $in: userEventIds } },
          { roleId: { $in: userRoleIds } },
        ],
      }),
      Attendance.deleteMany({
        $or: [{ volunteerId: userId }, { eventId: { $in: userEventIds } }, { roleId: { $in: userRoleIds } }],
      }),
      Notification.deleteMany({ userId }),
      Role.deleteMany({ eventId: { $in: userEventIds } }),
      Event.deleteMany({ createdBy: userId }),
      User.findByIdAndDelete(userId),
    ]);

    res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete account' });
  }
};
