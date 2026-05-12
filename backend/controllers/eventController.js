import Event from '../models/Event.js';
import Role from '../models/Role.js';
import { generateEventPlan } from '../utils/aiAssistantService.js';

export const createEvent = async (req, res) => {
  try {
    const {
      eventName,
      description,
      date,
      venue,
      maxVolunteers,
      category,
      eventType,
      expectedAttendees,
      durationHours,
      isFullDay,
      startTime,
      endTime,
      eventLogo,
      mottoText,
      mottoImage,
    } = req.body;
    if (!isFullDay) {
      const [startHour, startMinute] = String(startTime || '').split(':').map((value) => Number(value));
      const [endHour, endMinute] = String(endTime || '').split(':').map((value) => Number(value));
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
        return res.status(400).json({ message: 'End time must be later than start time.' });
      }
    }

    const event = new Event({
      eventName,
      description,
      eventLogo: eventLogo || '',
      mottoText: mottoText || '',
      mottoImage: mottoImage || '',
      date,
      venue,
      maxVolunteers,
      category: category || 'general',
      eventType: eventType || category || 'general',
      expectedAttendees: Number(expectedAttendees) || 0,
      durationHours: Number(durationHours) || 0,
      isFullDay: Boolean(isFullDay),
      startTime: isFullDay ? '' : startTime || '',
      endTime: isFullDay ? '' : endTime || '',
      createdBy: req.user.userId,
    });

    await event.save();

    res.status(201).json({
      message: 'Event created successfully',
      event,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create event' });
  }
};

export const getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const filter = status ? { status } : {};

    const events = await Event.find(filter)
      .populate('createdBy', 'name email')
      .populate('roles')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });

    const total = await Event.countDocuments(filter);

    res.json({
      total,
      page,
      limit,
      events,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'roles',
        populate: {
          path: 'eventId',
        },
      });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch event' });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const {
      eventName,
      description,
      date,
      venue,
      status,
      maxVolunteers,
      category,
      eventType,
      expectedAttendees,
      durationHours,
      isFullDay,
      startTime,
      endTime,
      eventLogo,
      mottoText,
      mottoImage,
    } = req.body;

    if (isFullDay === false || isFullDay === 'false') {
      const [startHour, startMinute] = String(startTime || '').split(':').map((value) => Number(value));
      const [endHour, endMinute] = String(endTime || '').split(':').map((value) => Number(value));
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
        return res.status(400).json({ message: 'End time must be later than start time.' });
      }
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        ...(eventName && { eventName }),
        ...(description && { description }),
        ...(date && { date }),
        ...(venue && { venue }),
        ...(status && { status }),
        ...(maxVolunteers && { maxVolunteers }),
        ...(category && { category }),
        ...(eventType && { eventType }),
        ...(expectedAttendees !== undefined && { expectedAttendees: Number(expectedAttendees) || 0 }),
        ...(durationHours !== undefined && { durationHours: Number(durationHours) || 0 }),
        ...(eventLogo !== undefined && { eventLogo }),
        ...(mottoText !== undefined && { mottoText }),
        ...(mottoImage !== undefined && { mottoImage }),
        ...(isFullDay !== undefined && { isFullDay: Boolean(isFullDay) }),
        ...(isFullDay ? { startTime: '', endTime: '' } : {}),
        ...(startTime && !isFullDay && { startTime }),
        ...(endTime && !isFullDay && { endTime }),
      },
      { new: true }
    ).populate('roles');

    res.json({
      message: 'Event updated',
      event,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update event' });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    await Role.deleteMany({ eventId: req.params.id });

    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete event' });
  }
};

export const addRoleToEvent = async (req, res) => {
  try {
    const { roleName, description, requiredSkills, requiredCount, preferredExperienceLevel, isFullDay, startTime, endTime } =
      req.body;

    if (!isFullDay) {
      const [startHour, startMinute] = String(startTime || '').split(':').map((value) => Number(value));
      const [endHour, endMinute] = String(endTime || '').split(':').map((value) => Number(value));
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
        return res.status(400).json({ message: 'Role end time must be later than start time.' });
      }
    }

    const role = new Role({
      eventId: req.params.id,
      roleName,
      description,
      requiredSkills,
      requiredCount,
      preferredExperienceLevel,
      isFullDay: Boolean(isFullDay),
      startTime: isFullDay ? '' : startTime || '',
      endTime: isFullDay ? '' : endTime || '',
    });

    await role.save();

    // Add role to event
    await Event.findByIdAndUpdate(
      req.params.id,
      {
        $push: { roles: role._id },
      },
      { new: true }
    );

    res.status(201).json({
      message: 'Role added to event',
      role,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add role' });
  }
};

export const generateAiEventPlan = async (req, res) => {
  try {
    const { eventType, attendees, durationHours } = req.body;

    if (attendees === undefined || attendees === null || Number(attendees) < 0) {
      return res.status(400).json({ message: 'Please provide a valid attendee count.' });
    }

    const plan = generateEventPlan({
      eventType: eventType || 'general',
      attendees: Number(attendees),
      durationHours: Number(durationHours) || 0,
    });

    res.json({
      message: 'AI event plan generated successfully.',
      plan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate AI event plan.' });
  }
};

export const uploadEventLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No logo image uploaded.' });
    }

    const fileUrl = `/uploads/events/${req.file.filename}`;
    res.json({
      message: 'Event logo uploaded.',
      fileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload event logo.' });
  }
};

export const uploadMottoImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No motto image uploaded.' });
    }

    const fileUrl = `/uploads/events/${req.file.filename}`;
    res.json({
      message: 'Motto image uploaded.',
      fileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload motto image.' });
  }
};

export const updateRoleInEvent = async (req, res) => {
  try {
    const { eventId, roleId } = req.params;
    const {
      roleName,
      description,
      requiredSkills,
      requiredCount,
      preferredExperienceLevel,
      isFullDay,
      startTime,
      endTime,
    } = req.body;

    if (!isFullDay) {
      const [startHour, startMinute] = String(startTime || '').split(':').map((value) => Number(value));
      const [endHour, endMinute] = String(endTime || '').split(':').map((value) => Number(value));
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
        return res.status(400).json({ message: 'Role end time must be later than start time.' });
      }
    }

    const role = await Role.findOneAndUpdate(
      { _id: roleId, eventId },
      {
        ...(roleName && { roleName }),
        ...(description !== undefined && { description }),
        ...(requiredSkills && { requiredSkills }),
        ...(requiredCount !== undefined && { requiredCount }),
        ...(preferredExperienceLevel && { preferredExperienceLevel }),
        ...(isFullDay !== undefined && { isFullDay: Boolean(isFullDay) }),
        ...(isFullDay ? { startTime: '', endTime: '' } : {}),
        ...(startTime && !isFullDay && { startTime }),
        ...(endTime && !isFullDay && { endTime }),
      },
      { new: true }
    );

    if (!role) {
      return res.status(404).json({ message: 'Role not found.' });
    }

    res.json({ message: 'Role updated', role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update role' });
  }
};

export const deleteRoleFromEvent = async (req, res) => {
  try {
    const { eventId, roleId } = req.params;

    const role = await Role.findOneAndDelete({ _id: roleId, eventId });
    if (!role) {
      return res.status(404).json({ message: 'Role not found.' });
    }

    await Event.findByIdAndUpdate(eventId, { $pull: { roles: roleId } });

    res.json({ message: 'Role deleted', roleId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete role' });
  }
};
