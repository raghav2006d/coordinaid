import Assignment from '../models/Assignment.js';
import AssignmentHistory from '../models/AssignmentHistory.js';
import Event from '../models/Event.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { rankVolunteersForRole, autoAllocateVolunteers, calculateMatchScore } from '../utils/allocationService.js';
import { createNotification } from '../utils/notificationService.js';
import { computeVolunteerMetrics } from '../utils/leaderboardService.js';
import { rankVolunteersForRecommendation } from '../utils/recommendationService.js';
import { updateLearningOnAssignmentResponse } from '../utils/learningService.js';
import {
  buildDefaultSlots,
  findBestTimeSlot,
  getWorkloadIndicator,
} from '../utils/aiAssistantService.js';
import PDFDocument from 'pdfkit';

const buildRoleContext = (role, event) => ({
  ...(typeof role?.toObject === 'function' ? role.toObject() : role),
  eventDate: event?.date,
  eventIsFullDay: event?.isFullDay,
  eventStartTime: event?.startTime,
  eventEndTime: event?.endTime,
});

const logAssignmentHistory = async ({
  assignment,
  action,
  fromStatus = '',
  toStatus = '',
  note = '',
  actorId = null,
  actorRole = '',
  previousVolunteerId = null,
  newVolunteerId = null,
}) => {
  if (!assignment) return;
  await AssignmentHistory.create({
    assignmentId: assignment._id,
    eventId: assignment.eventId,
    roleId: assignment.roleId,
    volunteerId: newVolunteerId || assignment.volunteerId,
    previousVolunteerId,
    newVolunteerId,
    action,
    fromStatus,
    toStatus,
    note,
    actorId,
    actorRole,
  });
};

const isSameDay = (dateA, dateB) =>
  dateA && dateB && new Date(dateA).toDateString() === new Date(dateB).toDateString();

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const resolveTimeRange = (eventDoc, roleDoc) => ({
  isFullDay: roleDoc?.isFullDay ?? eventDoc?.isFullDay ?? false,
  startTime: roleDoc?.startTime || eventDoc?.startTime || '',
  endTime: roleDoc?.endTime || eventDoc?.endTime || '',
});

const hasTimeOverlap = (rangeA, rangeB) => {
  if (rangeA?.isFullDay || rangeB?.isFullDay) {
    return true;
  }

  const startA = parseTimeToMinutes(rangeA?.startTime);
  const endA = parseTimeToMinutes(rangeA?.endTime);
  const startB = parseTimeToMinutes(rangeB?.startTime);
  const endB = parseTimeToMinutes(rangeB?.endTime);

  if (startA === null || endA === null || startB === null || endB === null) {
    return true;
  }

  return Math.max(startA, startB) < Math.min(endA, endB);
};

const ACTIVE_LOAD_STATUSES = ['pending', 'accepted'];
const DEFAULT_MAX_ASSIGNMENTS = 5;

const inferMaxAssignments = (volunteer) => {
  const availabilityCount = Array.isArray(volunteer?.availability) ? volunteer.availability.length : 0;
  return Math.max(DEFAULT_MAX_ASSIGNMENTS, Math.min(12, availabilityCount + 4));
};

const withLoadProfile = async (volunteers, { excludeEventId = null } = {}) => {
  if (!Array.isArray(volunteers) || volunteers.length === 0) {
    return [];
  }

  const volunteerIds = volunteers.map((volunteer) => volunteer._id);
  const loadCounts = await Assignment.aggregate([
    {
      $match: {
        volunteerId: { $in: volunteerIds },
        status: { $in: ACTIVE_LOAD_STATUSES },
        ...(excludeEventId ? { eventId: { $ne: excludeEventId } } : {}),
      },
    },
    {
      $group: {
        _id: '$volunteerId',
        count: { $sum: 1 },
      },
    },
  ]);

  const loadMap = new Map(loadCounts.map((entry) => [entry._id.toString(), entry.count]));

  return volunteers.map((volunteer) => {
    const plainVolunteer =
      typeof volunteer?.toObject === 'function' ? volunteer.toObject() : { ...volunteer };
    const currentAssignments = loadMap.get(plainVolunteer._id.toString()) || 0;
    const maxAssignments = Number(plainVolunteer.maxAssignments) || inferMaxAssignments(plainVolunteer);
    const loadScore = maxAssignments ? currentAssignments / maxAssignments : 0;

    return {
      ...plainVolunteer,
      currentAssignments,
      maxAssignments,
      workloadLevel: getWorkloadIndicator(loadScore),
      overloaded: loadScore > 0.8,
      loadScore: Math.round(loadScore * 100),
    };
  });
};

const isVolunteerAvailableForSlot = ({ volunteer, eventDate, slot }) => {
  if (!eventDate || !slot) return false;

  return (volunteer?.availability || []).some((availabilitySlot) => {
    if (!availabilitySlot?.date) return false;
    if (new Date(availabilitySlot.date).toDateString() !== new Date(eventDate).toDateString()) {
      return false;
    }

    return hasTimeOverlap(
      {
        isFullDay: false,
        startTime: availabilitySlot.startTime,
        endTime: availabilitySlot.endTime,
      },
      {
        isFullDay: false,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }
    );
  });
};

const normalizeSlotInput = (event, providedSlots = []) => {
  const fallbackSlots = buildDefaultSlots({
    isFullDay: event?.isFullDay,
    startTime: event?.startTime,
    endTime: event?.endTime,
  });

  if (!Array.isArray(providedSlots) || providedSlots.length === 0) {
    return fallbackSlots;
  }

  const slots = providedSlots
    .map((slot) => ({
      label:
        slot?.label ||
        `${String(slot?.startTime || '').slice(0, 5)} - ${String(slot?.endTime || '').slice(0, 5)}`,
      startTime: String(slot?.startTime || ''),
      endTime: String(slot?.endTime || ''),
    }))
    .filter((slot) => {
      const start = parseTimeToMinutes(slot.startTime);
      const end = parseTimeToMinutes(slot.endTime);
      return start !== null && end !== null && end > start;
    });

  return slots.length ? slots : fallbackSlots;
};

const buildSchedulePreview = async ({ event, volunteers, selectedSlot, eventId }) => {
  const roleSummaries = [];
  const reservedVolunteerIds = new Set();

  for (const role of event.roles || []) {
    const conflictingVolunteerIds = await getConflictingVolunteerIds({
      eventDate: event?.date,
      eventTimeRange: {
        isFullDay: false,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      },
      excludeEventId: eventId,
    });

    const eligibleVolunteers = volunteers.filter(
      (volunteer) =>
        !reservedVolunteerIds.has(volunteer._id.toString()) &&
        !conflictingVolunteerIds.includes(volunteer._id.toString()) &&
        isVolunteerAvailableForSlot({ volunteer, eventDate: event?.date, slot: selectedSlot })
    );

    const roleWithSelectedSlot = {
      ...(typeof role?.toObject === 'function' ? role.toObject() : role),
      isFullDay: false,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
    };

    const rankedCandidates = rankVolunteersForRole(
      eligibleVolunteers,
      buildRoleContext(roleWithSelectedSlot, {
        ...event.toObject(),
        isFullDay: false,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      })
    );

    const selectedCandidates = rankedCandidates.slice(0, role.requiredCount);
    selectedCandidates.forEach((entry) => reservedVolunteerIds.add(entry.volunteer._id.toString()));

    roleSummaries.push({
      roleId: role._id,
      roleName: role.roleName,
      requiredCount: role.requiredCount,
      assignedCount: selectedCandidates.length,
      shortage: Math.max(0, role.requiredCount - selectedCandidates.length),
      volunteers: selectedCandidates.map((entry) => ({
        volunteerId: entry.volunteer._id,
        name: entry.volunteer.name,
        email: entry.volunteer.email,
        department: entry.volunteer.department || '',
        workloadLevel: entry.matchScore.workloadLevel || entry.volunteer.workloadLevel || 'Low',
        currentAssignments:
          entry.matchScore.currentAssignments ?? entry.volunteer.currentAssignments ?? 0,
        maxAssignments: entry.matchScore.maxAssignments ?? entry.volunteer.maxAssignments ?? 5,
        matchScore: entry.matchScore,
      })),
    });
  }

  const assignedVolunteers = roleSummaries.flatMap((role) => role.volunteers);
  const workloadSummary = assignedVolunteers.reduce(
    (summary, volunteer) => {
      const level = String(volunteer.workloadLevel || 'Low').toLowerCase();
      if (level === 'high') summary.high += 1;
      else if (level === 'medium') summary.medium += 1;
      else summary.low += 1;
      return summary;
    },
    { low: 0, medium: 0, high: 0 }
  );

  return {
    selectedSlot,
    roles: roleSummaries,
    totalAssignments: assignedVolunteers.length,
    workloadSummary,
  };
};

const getConflictingVolunteerIds = async ({ eventDate, eventTimeRange, excludeEventId = null }) => {
  if (!eventDate) return [];

  const assignments = await Assignment.find({
    status: { $in: ['pending', 'accepted', 'completed'] },
    ...(excludeEventId ? { eventId: { $ne: excludeEventId } } : {}),
  })
    .populate('eventId', 'date isFullDay startTime endTime')
    .populate('roleId', 'isFullDay startTime endTime');

  const conflicts = assignments.filter((assignment) => {
    if (!isSameDay(assignment.eventId?.date, eventDate)) {
      return false;
    }

    const assignmentRange = resolveTimeRange(assignment.eventId, assignment.roleId);
    return hasTimeOverlap(assignmentRange, eventTimeRange);
  });
  return conflicts.map((assignment) => assignment.volunteerId.toString());
};

const buildMetricsMap = async ({ volunteers, eventIds = null }) => {
  const metricsEntries = await Promise.all(
    volunteers.map(async (volunteer) => {
      const metrics = await computeVolunteerMetrics({
        volunteerId: volunteer._id,
        eventIds,
        participationCount: volunteer.totalParticipations || 0,
        performanceScore: volunteer.performanceScore || 0,
        skillDiversity: volunteer.skills?.length || 0,
      });
      return [volunteer._id.toString(), metrics];
    })
  );

  return new Map(metricsEntries);
};

const buildRecommendationList = async ({
  volunteers,
  role,
  eventDate,
  eventIds = null,
  metricsByVolunteer = null,
}) => {
  const resolvedMetrics = metricsByVolunteer || (await buildMetricsMap({ volunteers, eventIds }));
  return rankVolunteersForRecommendation({
    volunteers,
    role,
    metricsByVolunteer: resolvedMetrics,
    eventDate,
  });
};

const findNextBestCandidate = async ({ eventId, role, event, excludedAssignmentId = null }) => {
  const existingAssignments = await Assignment.find({ eventId });
  const excludedVolunteerIds = existingAssignments
    .filter((assignment) => assignment._id.toString() !== excludedAssignmentId)
    .map((assignment) => assignment.volunteerId);

  const conflictingVolunteerIds = await getConflictingVolunteerIds({
    eventDate: event?.date,
    eventTimeRange: resolveTimeRange(event, role),
    excludeEventId: eventId,
  });

  const rawVolunteers = await User.find({
    role: 'volunteer',
    _id: { $nin: [...excludedVolunteerIds, ...conflictingVolunteerIds] },
  }).select('name email skills availability performanceScore totalParticipations department acceptanceRate attendanceRate rolePreferenceScores declinePatterns acceptedAssignments totalAssignments attendedEvents assignedEvents');
  const volunteers = await withLoadProfile(rawVolunteers);

  const rankedCandidates = await buildRecommendationList({
    volunteers,
    role,
    eventDate: event?.date,
  });
  const filteredCandidates = rankedCandidates.filter(
    (entry) => !conflictingVolunteerIds.includes(entry.volunteer?._id?.toString())
  );
  const bestCandidate = filteredCandidates[0];
  if (!bestCandidate) return null;

  return {
    volunteer: bestCandidate.volunteer,
    recommendation: bestCandidate,
    matchScore: calculateMatchScore(bestCandidate.volunteer, buildRoleContext(role, event)),
  };
};

export const runAllocation = async (req, res) => {
  try {
    const { eventId } = req.body;

    const event = await Event.findById(eventId).populate('roles');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Clear previous allocations for this event to avoid duplicates
    await Assignment.deleteMany({ eventId });
    await Role.updateMany({ eventId }, { assignedCount: 0 });

    // Get all volunteers
    const rawVolunteers = await User.find({ role: 'volunteer' });
    const volunteers = await withLoadProfile(rawVolunteers, { excludeEventId: eventId });

    const allocations = [];

    // For each role in event
    for (const roleId of event.roles) {
      const role = await Role.findById(roleId);

      const conflictingVolunteerIds = await getConflictingVolunteerIds({
        eventDate: event.date,
        eventTimeRange: resolveTimeRange(event, role),
        excludeEventId: event._id,
      });

      // Get available volunteers for this role
      const availableVolunteers = volunteers.filter(
        (v) =>
          !conflictingVolunteerIds.includes(v._id.toString()) &&
          !allocations.some(
            (a) =>
              a.volunteerId.toString() === v._id.toString() &&
              a.eventId.toString() === eventId
          )
      );

      // Rank and allocate
      const allocated = autoAllocateVolunteers(
        availableVolunteers,
        buildRoleContext(role, event),
        role.requiredCount
      );

      // Create assignments
      for (const { volunteer, matchScore, priority } of allocated) {
        const assignment = new Assignment({
          volunteerId: volunteer._id,
          eventId,
          roleId,
          matchScore,
          status: 'pending',
        });

        await assignment.save();
    await logAssignmentHistory({
      assignment,
      action: 'created',
      toStatus: 'pending',
      actorId: req.user?.userId,
      actorRole: req.user?.role || 'system',
      note: `AI allocation priority ${priority}`,
    });
        allocations.push(assignment);

        await createNotification({
          userId: volunteer._id,
          title: 'New assignment',
          message: `You have been assigned to ${event.eventName} as ${role.roleName}.`,
          type: 'assignment',
          data: { assignmentId: assignment._id, eventId, roleId },
        });
      }

      // Update role assigned count
      await Role.findByIdAndUpdate(roleId, {
        assignedCount: allocated.length,
      });
    }

    // Update event status
    await Event.findByIdAndUpdate(eventId, {
      status: 'allocated',
    });

    const populatedAllocations = await Assignment.find({
      _id: { $in: allocations.map((assignment) => assignment._id) },
    })
      .populate('volunteerId', 'name email skills performanceScore')
      .populate('eventId', 'eventName date venue status')
      .populate('roleId', 'roleName requiredSkills preferredExperienceLevel')
      .sort({ createdAt: -1 });

    res.json({
      message: 'Allocation completed',
      totalAssignments: allocations.length,
      allocations: populatedAllocations,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Allocation failed', error: error.message });
  }
};

export const getAssignments = async (req, res) => {
  try {
    const { volunteerId, eventId, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (req.user.role === 'volunteer') {
      filter.volunteerId = req.user.userId;
    } else if (volunteerId) {
      filter.volunteerId = volunteerId;
    }
    if (eventId) filter.eventId = eventId;
    if (status) filter.status = status;

    const assignments = await Assignment.find(filter)
      .populate('volunteerId', 'name email skills')
      .populate('eventId', 'eventName date venue eventLogo mottoText mottoImage category')
      .populate('roleId', 'roleName requiredSkills')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Assignment.countDocuments(filter);

    res.json({
      total,
      page,
      limit,
      assignments,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch assignments' });
  }
};

export const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('volunteerId')
      .populate('eventId')
      .populate('roleId');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (
      req.user.role === 'volunteer' &&
      assignment.volunteerId?._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: 'You can only view your own assignments.' });
    }

    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch assignment' });
  }
};

export const getAssignmentHistory = async (req, res) => {
  try {
    const { eventId, volunteerId, assignmentId, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'volunteer') {
      filter.volunteerId = req.user.userId;
    } else if (volunteerId) {
      filter.volunteerId = volunteerId;
    }
    if (eventId) filter.eventId = eventId;
    if (assignmentId) filter.assignmentId = assignmentId;

    const history = await AssignmentHistory.find(filter)
      .populate('volunteerId', 'name')
      .populate('previousVolunteerId', 'name')
      .populate('newVolunteerId', 'name')
      .populate('actorId', 'name role')
      .populate('eventId', 'eventName date')
      .populate('roleId', 'roleName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AssignmentHistory.countDocuments(filter);

    res.json({
      total,
      page,
      limit,
      history,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch assignment history' });
  }
};

export const updateAssignmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedVolunteerStatuses = ['accepted', 'declined'];

    if (req.user.role === 'volunteer' && !allowedVolunteerStatuses.includes(status)) {
      return res.status(400).json({ message: 'Volunteers can only accept or decline assignments.' });
    }

  const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (
      req.user.role === 'volunteer' &&
      assignment.volunteerId.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: 'You can only respond to your own assignments.' });
    }

    const previousStatus = assignment.status;
    assignment.status = status;
    assignment.respondedAt = new Date();
    await assignment.save();

    await logAssignmentHistory({
      assignment,
      action: 'status-changed',
      fromStatus: previousStatus,
      toStatus: status,
      actorId: req.user?.userId,
      actorRole: req.user?.role || 'system',
      note: req.user?.role === 'volunteer' ? 'Volunteer response' : 'Status update',
    });

    if (status === 'accepted' || status === 'declined') {
      const event = await Event.findById(assignment.eventId);
      const role = await Role.findById(assignment.roleId);

      await updateLearningOnAssignmentResponse({
        volunteerId: assignment.volunteerId,
        roleName: role?.roleName || '',
        accepted: status === 'accepted',
      });

      await createNotification({
        userId: event?.createdBy,
        title: 'Volunteer response',
        message: `A volunteer ${status} the assignment for ${event?.eventName || 'an event'}.`,
        type: 'assignment',
        data: { assignmentId: assignment._id, eventId: assignment.eventId, status },
      });
    }

    if (status === 'declined') {
      const role = await Role.findById(assignment.roleId);
      const event = await Event.findById(assignment.eventId);
      const nextCandidate = await findNextBestCandidate({
        eventId: assignment.eventId,
        role,
        event,
        excludedAssignmentId: assignment._id.toString(),
      });

      if (nextCandidate) {
        const newAssignment = new Assignment({
          volunteerId: nextCandidate.volunteer._id,
          eventId: assignment.eventId,
          roleId: assignment.roleId,
          matchScore: nextCandidate.matchScore,
          status: 'pending',
        });
        await newAssignment.save();
        await logAssignmentHistory({
          assignment: newAssignment,
          action: 'auto-reassigned',
          toStatus: 'pending',
          actorId: req.user?.userId,
          actorRole: req.user?.role || 'system',
          note: 'Auto reassign after decline',
        });

        await Role.findByIdAndUpdate(assignment.roleId, {
          $inc: { assignedCount: 1 },
        });

        await createNotification({
          userId: nextCandidate.volunteer._id,
          title: 'New reassigned role',
          message: 'You have been assigned a role after a reallocation.',
          type: 'assignment',
          data: { assignmentId: newAssignment._id, eventId: assignment.eventId, roleId: assignment.roleId },
        });
      }
    }

    res.json({
      message: `Assignment ${status}`,
      assignment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update assignment' });
  }
};

export const getRecommendedVolunteers = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const role = await Role.findById(assignment.roleId);
    const event = await Event.findById(assignment.eventId);

    const existingAssignments = await Assignment.find({ eventId: assignment.eventId });
    const excludedVolunteerIds = existingAssignments
      .filter((item) => item._id.toString() !== assignment._id.toString())
      .map((item) => item.volunteerId);

    const conflictingVolunteerIds = await getConflictingVolunteerIds({
      eventDate: event?.date,
      eventTimeRange: resolveTimeRange(event, role),
      excludeEventId: assignment.eventId,
    });

    const rawVolunteers = await User.find({
      role: 'volunteer',
      _id: { $nin: [...excludedVolunteerIds, ...conflictingVolunteerIds] },
    }).select('name email skills availability performanceScore totalParticipations department acceptanceRate attendanceRate rolePreferenceScores declinePatterns acceptedAssignments totalAssignments attendedEvents assignedEvents');
    const volunteers = await withLoadProfile(rawVolunteers);

    const metricsByVolunteer = await buildMetricsMap({ volunteers });
    const recommendations = await buildRecommendationList({
      volunteers,
      role,
      eventDate: event?.date,
      metricsByVolunteer,
    });

    res.json({
      assignmentId: assignment._id,
      recommendations: recommendations.slice(0, 5),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch recommended volunteers' });
  }
};

export const getEventRoleRecommendations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const limit = Number(req.query.limit) || 3;
    const event = await Event.findById(eventId).populate('roles');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const assignments = await Assignment.find({ eventId }).select('volunteerId');
    const assignedVolunteerIds = assignments.map((assignment) => assignment.volunteerId);
    const eventLevelConflicts = await getConflictingVolunteerIds({
      eventDate: event?.date,
      eventTimeRange: resolveTimeRange(event, null),
      excludeEventId: eventId,
    });

    const rawVolunteers = await User.find({
      role: 'volunteer',
      _id: { $nin: [...assignedVolunteerIds, ...eventLevelConflicts] },
    }).select('name email skills availability performanceScore totalParticipations department profileImage acceptanceRate attendanceRate rolePreferenceScores declinePatterns acceptedAssignments totalAssignments attendedEvents assignedEvents');
    const volunteers = await withLoadProfile(rawVolunteers);

    const metricsByVolunteer = await buildMetricsMap({ volunteers });

    const roleRecommendations = [];

    for (const role of event.roles) {
      const conflictingVolunteerIds = await getConflictingVolunteerIds({
        eventDate: event?.date,
        eventTimeRange: resolveTimeRange(event, role),
        excludeEventId: eventId,
      });
      const ranked = await buildRecommendationList({
        volunteers,
        role,
        eventDate: event?.date,
        metricsByVolunteer,
      });

      roleRecommendations.push({
        roleId: role._id,
        roleName: role.roleName,
        requiredSkills: role.requiredSkills || [],
        requiredCount: role.requiredCount,
        recommendations: ranked
          .filter((entry) => !conflictingVolunteerIds.includes(entry.volunteer?._id?.toString()))
          .slice(0, limit),
      });
    }

    res.json({
      eventId: event._id,
      eventName: event.eventName,
      roles: roleRecommendations,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch role recommendations' });
  }
};

export const getSmartScheduleSuggestions = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).populate('roles');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!event.roles?.length) {
      return res.status(400).json({ message: 'Add roles to this event before scheduling.' });
    }

    const slots = normalizeSlotInput(event, req.body?.slots || []);
    const rawVolunteers = await User.find({ role: 'volunteer' }).select(
      'name email skills availability performanceScore totalParticipations department acceptanceRate attendanceRate rolePreferenceScores declinePatterns acceptedAssignments totalAssignments attendedEvents assignedEvents'
    );
    const volunteers = await withLoadProfile(rawVolunteers, { excludeEventId: eventId });

    const { bestSlot, slotScores } = findBestTimeSlot({
      volunteers,
      slots,
      eventDate: event.date,
    });

    if (!bestSlot) {
      return res.status(400).json({ message: 'No valid slots available for scheduling.' });
    }

    const preview = await buildSchedulePreview({
      event,
      volunteers,
      selectedSlot: bestSlot,
      eventId,
    });

    res.json({
      eventId: event._id,
      eventName: event.eventName,
      bestSlot,
      slotScores,
      schedule: preview,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate smart schedule suggestions.' });
  }
};

export const autoScheduleEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).populate('roles');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!event.roles?.length) {
      return res.status(400).json({ message: 'Add roles to this event before auto scheduling.' });
    }

    const slots = normalizeSlotInput(event, req.body?.slots || []);
    const rawVolunteers = await User.find({ role: 'volunteer' }).select(
      'name email skills availability performanceScore totalParticipations department acceptanceRate attendanceRate rolePreferenceScores declinePatterns acceptedAssignments totalAssignments attendedEvents assignedEvents'
    );
    const volunteers = await withLoadProfile(rawVolunteers, { excludeEventId: eventId });

    const { bestSlot, slotScores } = findBestTimeSlot({
      volunteers,
      slots,
      eventDate: event.date,
    });

    if (!bestSlot) {
      return res.status(400).json({ message: 'No valid slots available for auto scheduling.' });
    }

    const preview = await buildSchedulePreview({
      event,
      volunteers,
      selectedSlot: bestSlot,
      eventId,
    });

    await Assignment.deleteMany({ eventId });
    await Role.updateMany({ eventId }, { assignedCount: 0 });

    const createdAssignments = [];

    for (const roleSummary of preview.roles) {
      for (const volunteer of roleSummary.volunteers) {
        const assignment = new Assignment({
          volunteerId: volunteer.volunteerId,
          eventId,
          roleId: roleSummary.roleId,
          matchScore: volunteer.matchScore,
          status: 'pending',
        });

        await assignment.save();
        await logAssignmentHistory({
          assignment,
          action: 'created',
          toStatus: 'pending',
          actorId: req.user?.userId,
          actorRole: req.user?.role || 'system',
          note: `Auto schedule slot ${bestSlot.startTime}-${bestSlot.endTime}`,
        });

        createdAssignments.push(assignment);

        await createNotification({
          userId: volunteer.volunteerId,
          title: 'New assignment',
          message: `You have been assigned to ${event.eventName} as ${roleSummary.roleName}.`,
          type: 'assignment',
          data: { assignmentId: assignment._id, eventId, roleId: roleSummary.roleId },
        });
      }

      await Role.findByIdAndUpdate(roleSummary.roleId, {
        assignedCount: roleSummary.assignedCount,
      });
    }

    await Event.findByIdAndUpdate(eventId, {
      status: 'allocated',
      ...(event.isFullDay
        ? {}
        : {
            startTime: bestSlot.startTime,
            endTime: bestSlot.endTime,
          }),
    });

    const populatedAllocations = await Assignment.find({
      _id: { $in: createdAssignments.map((assignment) => assignment._id) },
    })
      .populate('volunteerId', 'name email skills performanceScore department')
      .populate('eventId', 'eventName date venue status')
      .populate('roleId', 'roleName requiredSkills preferredExperienceLevel')
      .sort({ createdAt: -1 });

    res.json({
      message: 'Auto scheduling completed.',
      eventId: event._id,
      eventName: event.eventName,
      bestSlot,
      slotScores,
      schedule: preview,
      allocations: populatedAllocations,
      totalAssignments: populatedAllocations.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to auto schedule event.' });
  }
};

export const createManualAssignment = async (req, res) => {
  try {
    const { eventId, roleId, volunteerId } = req.body;

    if (!eventId || !roleId || !volunteerId) {
      return res.status(400).json({ message: 'Event, role, and volunteer are required.' });
    }

    const [event, role, volunteer] = await Promise.all([
      Event.findById(eventId),
      Role.findById(roleId),
      User.findOne({ _id: volunteerId, role: 'volunteer' }),
    ]);

    if (!event || !role) {
      return res.status(404).json({ message: 'Event or role not found.' });
    }

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found.' });
    }

    const existingAssignment = await Assignment.findOne({
      eventId,
      volunteerId,
    });

    if (existingAssignment) {
      return res.status(409).json({ message: 'Volunteer is already assigned to this event.' });
    }

    const conflictingVolunteerIds = await getConflictingVolunteerIds({
      eventDate: event.date,
      eventTimeRange: resolveTimeRange(event, role),
      excludeEventId: eventId,
    });
    if (conflictingVolunteerIds.includes(volunteerId.toString())) {
      return res
        .status(409)
        .json({ message: 'Volunteer already has an assignment for this event date.' });
    }

    if (role.assignedCount >= role.requiredCount) {
      return res.status(409).json({ message: 'This role already has enough volunteers.' });
    }

    const [volunteerWithLoad] = await withLoadProfile([volunteer]);
    const matchScore = calculateMatchScore(volunteerWithLoad, buildRoleContext(role, event));

    const assignment = new Assignment({
      volunteerId,
      eventId,
      roleId,
      matchScore,
      status: 'pending',
    });
    await assignment.save();
    await logAssignmentHistory({
      assignment,
      action: 'manual-assigned',
      toStatus: 'pending',
      actorId: req.user?.userId,
      actorRole: req.user?.role || 'system',
    });

    await Role.findByIdAndUpdate(roleId, { $inc: { assignedCount: 1 } });

    if (event.status === 'planning') {
      await Event.findByIdAndUpdate(eventId, { status: 'allocation-in-progress' });
    }

    await createNotification({
      userId: volunteerId,
      title: 'New assignment',
      message: `You have been assigned to ${event.eventName} as ${role.roleName}.`,
      type: 'assignment',
      data: { assignmentId: assignment._id, eventId, roleId },
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate('volunteerId', 'name email skills performanceScore department totalParticipations')
      .populate('eventId', 'eventName date venue status')
      .populate('roleId', 'roleName requiredSkills preferredExperienceLevel');

    res.status(201).json({
      message: 'Assignment created.',
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create assignment.' });
  }
};

export const replaceVolunteer = async (req, res) => {
  try {
    const { volunteerId } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const role = await Role.findById(assignment.roleId);
    const event = await Event.findById(assignment.eventId);
    const volunteer = await User.findOne({ _id: volunteerId, role: 'volunteer' });

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    const existingAssignments = await Assignment.find({
      eventId: assignment.eventId,
      volunteerId,
      _id: { $ne: assignment._id },
    });

    if (existingAssignments.length > 0) {
      return res.status(409).json({ message: 'Volunteer is already assigned to this event.' });
    }

    const conflictingVolunteerIds = await getConflictingVolunteerIds({
      eventDate: event?.date,
      eventTimeRange: resolveTimeRange(event, role),
      excludeEventId: assignment.eventId,
    });
    if (conflictingVolunteerIds.includes(volunteerId.toString())) {
      return res
        .status(409)
        .json({ message: 'Volunteer already has an assignment for this event date.' });
    }

    const [volunteerWithLoad] = await withLoadProfile([volunteer]);
    const rankedCandidate = rankVolunteersForRole([volunteerWithLoad], buildRoleContext(role, event))[0];

    const previousVolunteerId = assignment.volunteerId;
    const previousStatus = assignment.status;
    assignment.volunteerId = volunteer._id;
    assignment.matchScore = rankedCandidate.matchScore;
    assignment.status = 'pending';
    assignment.respondedAt = null;
    await assignment.save();
    await logAssignmentHistory({
      assignment,
      action: 'volunteer-replaced',
      fromStatus: previousStatus,
      toStatus: 'pending',
      actorId: req.user?.userId,
      actorRole: req.user?.role || 'system',
      previousVolunteerId,
      newVolunteerId: volunteer._id,
      note: 'Organizer replacement',
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate('volunteerId', 'name email skills performanceScore department totalParticipations')
      .populate('eventId', 'eventName date venue status')
      .populate('roleId', 'roleName requiredSkills preferredExperienceLevel');

    await createNotification({
      userId: volunteer._id,
      title: 'Assignment updated',
      message: `You have been assigned to ${event?.eventName || 'an event'} as ${role?.roleName || 'a role'}.`,
      type: 'assignment',
      data: { assignmentId: assignment._id, eventId: assignment.eventId, roleId: assignment.roleId },
    });

    res.json({
      message: 'Volunteer replaced successfully.',
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to replace volunteer' });
  }
};

export const removeVolunteerFromAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const role = await Role.findById(assignment.roleId);
    const event = await Event.findById(assignment.eventId);
    const nextCandidate = await findNextBestCandidate({
      eventId: assignment.eventId,
      role,
      event,
      excludedAssignmentId: assignment._id.toString(),
    });

    if (!nextCandidate) {
      return res.status(404).json({ message: 'No suitable replacement volunteer found.' });
    }

    const previousVolunteerId = assignment.volunteerId;
    const previousStatus = assignment.status;
    assignment.volunteerId = nextCandidate.volunteer._id;
    assignment.matchScore = nextCandidate.matchScore;
    assignment.status = 'pending';
    assignment.respondedAt = null;
    await assignment.save();
    await logAssignmentHistory({
      assignment,
      action: 'reassigned-next',
      fromStatus: previousStatus,
      toStatus: 'pending',
      actorId: req.user?.userId,
      actorRole: req.user?.role || 'system',
      previousVolunteerId,
      newVolunteerId: nextCandidate.volunteer._id,
      note: 'Organizer triggered next-best replacement',
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate('volunteerId', 'name email skills performanceScore department totalParticipations')
      .populate('eventId', 'eventName date venue status')
      .populate('roleId', 'roleName requiredSkills preferredExperienceLevel');

    await createNotification({
      userId: nextCandidate.volunteer._id,
      title: 'Assignment updated',
      message: `You have been assigned to ${event?.eventName || 'an event'} as ${role?.roleName || 'a role'}.`,
      type: 'assignment',
      data: { assignmentId: assignment._id, eventId: assignment.eventId, roleId: assignment.roleId },
    });

    res.json({
      message: 'Assignment moved to the next best volunteer.',
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to remove and reassign volunteer' });
  }
};

export const confirmEventAllocations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    await Event.findByIdAndUpdate(eventId, { status: 'confirmed' });

    const assignments = await Assignment.find({ eventId }).populate('volunteerId', 'name email');
    await Promise.all(
      assignments.map((assignment) =>
        createNotification({
          userId: assignment.volunteerId?._id,
          title: 'Allocation confirmed',
          message: `Your assignment for ${event.eventName} has been confirmed.`,
          type: 'assignment',
          data: { assignmentId: assignment._id, eventId },
        })
      )
    );

    res.json({ message: 'Allocations confirmed', eventId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to confirm allocations' });
  }
};

export const exportEventAllocationsPdf = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const assignments = await Assignment.find({ eventId })
      .populate('volunteerId', 'name email department')
      .populate('roleId', 'roleName')
      .sort({ createdAt: 1 });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="allocations-${eventId}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text(`Volunteer Allocations - ${event.eventName}`, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Date: ${new Date(event.date).toLocaleDateString()}`);
    doc.text(`Venue: ${event.venue}`);
    doc.moveDown();

    doc.fontSize(12).text('Volunteer', 40, doc.y, { continued: true });
    doc.text('Email', 200, doc.y, { continued: true });
    doc.text('Department', 360, doc.y, { continued: true });
    doc.text('Role', 470, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    assignments.forEach((assignment, index) => {
      doc
        .fontSize(10)
        .text(assignment.volunteerId?.name || '-', 40, doc.y, { continued: true, width: 150 })
        .text(assignment.volunteerId?.email || '-', 200, doc.y, { continued: true, width: 150 })
        .text(assignment.volunteerId?.department || '-', 360, doc.y, { continued: true, width: 90 })
        .text(assignment.roleId?.roleName || '-', 470, doc.y);
      doc.moveDown(0.4);
      if ((index + 1) % 25 === 0) {
        doc.addPage();
      }
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export allocations PDF' });
  }
};
