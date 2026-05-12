import mongoose from 'mongoose';
import Team from '../models/Team.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Role from '../models/Role.js';
import Assignment from '../models/Assignment.js';
import Attendance from '../models/Attendance.js';
import { autoAllocateVolunteers } from '../utils/allocationService.js';
import { createNotification } from '../utils/notificationService.js';
import { computeVolunteerMetrics } from '../utils/leaderboardService.js';

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateJoinCode = (length = 6) =>
  Array.from({ length }, () => JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)]).join('');

const generateUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateJoinCode(6);
    const exists = await Team.exists({ joinCode: code });
    if (!exists) return code;
  }
  return `${generateJoinCode(4)}${Date.now().toString().slice(-4)}`;
};

const parseTeamForVolunteer = ({ team, volunteerId }) => {
  const plain = typeof team?.toObject === 'function' ? team.toObject() : { ...team };
  const volunteerKey = String(volunteerId);
  const currentRequest = (plain.pendingRequests || []).find(
    (request) => String(request?.volunteerId?._id || request?.volunteerId) === volunteerKey
  );

  const isMember = (plain.members || []).some(
    (member) => String(member?.volunteerId?._id || member?.volunteerId) === volunteerKey
  );
  const isPending = Boolean(currentRequest);
  const { joinCode, pendingRequests, ...safeTeam } = plain;

  return {
    ...safeTeam,
    isMember,
    isPending,
    pendingRequests: currentRequest ? [currentRequest] : [],
    requestStatus: isMember ? 'member' : isPending ? 'pending' : 'none',
  };
};

const ensureTeamId = (value) => mongoose.Types.ObjectId.isValid(value);

const findManageableTeam = async ({ teamId, user }) => {
  if (user.role === 'admin') {
    return Team.findOne({ _id: teamId, isActive: true });
  }
  return Team.findOne({ _id: teamId, organizerId: user.userId, isActive: true });
};

const ACTIVE_ASSIGNMENT_STATUSES = ['pending', 'accepted', 'completed'];
const DEFAULT_MAX_ASSIGNMENTS = 5;

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hours, minutes] = String(timeValue).split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const hasTimeOverlap = (rangeA, rangeB) => {
  if (rangeA?.isFullDay || rangeB?.isFullDay) return true;
  const startA = parseTimeToMinutes(rangeA?.startTime);
  const endA = parseTimeToMinutes(rangeA?.endTime);
  const startB = parseTimeToMinutes(rangeB?.startTime);
  const endB = parseTimeToMinutes(rangeB?.endTime);

  if (startA === null || endA === null || startB === null || endB === null) {
    return true;
  }

  return Math.max(startA, startB) < Math.min(endA, endB);
};

const resolveTimeRange = (eventDoc, roleDoc) => ({
  isFullDay: roleDoc?.isFullDay ?? eventDoc?.isFullDay ?? false,
  startTime: roleDoc?.startTime || eventDoc?.startTime || '',
  endTime: roleDoc?.endTime || eventDoc?.endTime || '',
});

const inferMaxAssignments = (volunteer) => {
  const availabilityCount = Array.isArray(volunteer?.availability) ? volunteer.availability.length : 0;
  return Math.max(DEFAULT_MAX_ASSIGNMENTS, Math.min(12, availabilityCount + 4));
};

const withLoadProfile = async (volunteers, { excludeEventId = null } = {}) => {
  if (!Array.isArray(volunteers) || !volunteers.length) return [];

  const volunteerIds = volunteers.map((volunteer) => volunteer._id);
  const loadCounts = await Assignment.aggregate([
    {
      $match: {
        volunteerId: { $in: volunteerIds },
        status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
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
    return {
      ...plainVolunteer,
      currentAssignments: loadMap.get(plainVolunteer._id.toString()) || 0,
      maxAssignments: Number(plainVolunteer.maxAssignments) || inferMaxAssignments(plainVolunteer),
    };
  });
};

const buildRoleContext = (role, event) => ({
  ...(typeof role?.toObject === 'function' ? role.toObject() : role),
  eventDate: event?.date,
  eventIsFullDay: event?.isFullDay,
  eventStartTime: event?.startTime,
  eventEndTime: event?.endTime,
});

const getConflictingVolunteerIds = async ({ eventDate, eventTimeRange, excludeEventId = null }) => {
  if (!eventDate) return [];

  const assignments = await Assignment.find({
    status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
    ...(excludeEventId ? { eventId: { $ne: excludeEventId } } : {}),
  })
    .populate('eventId', 'date isFullDay startTime endTime')
    .populate('roleId', 'isFullDay startTime endTime');

  const eventDay = new Date(eventDate).toDateString();
  const conflicts = assignments.filter((assignment) => {
    if (!assignment.eventId?.date) return false;
    if (new Date(assignment.eventId.date).toDateString() !== eventDay) return false;

    const assignmentRange = resolveTimeRange(assignment.eventId, assignment.roleId);
    return hasTimeOverlap(assignmentRange, eventTimeRange);
  });

  return conflicts.map((assignment) => assignment.volunteerId.toString());
};

export const createTeam = async (req, res) => {
  try {
    const { name, description = '' } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Team name is required.' });
    }

    const joinCode = await generateUniqueJoinCode();
    const team = await Team.create({
      name: String(name).trim(),
      description: String(description || '').trim(),
      organizerId: req.user.userId,
      joinCode,
    });

    const populated = await Team.findById(team._id)
      .populate('organizerId', 'name email')
      .populate('members.volunteerId', 'name email department profileImage')
      .populate('pendingRequests.volunteerId', 'name email department profileImage');

    res.status(201).json({
      message: 'Team created successfully.',
      team: populated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create team.' });
  }
};

export const getTeams = async (req, res) => {
  try {
    const basePopulate = [
      { path: 'organizerId', select: 'name email' },
      { path: 'members.volunteerId', select: 'name email department profileImage' },
      { path: 'pendingRequests.volunteerId', select: 'name email department profileImage' },
    ];

    if (req.user.role === 'organizer') {
      const teams = await Team.find({ organizerId: req.user.userId, isActive: true })
        .populate(basePopulate)
        .sort({ createdAt: -1 });
      return res.json({ teams });
    }

    if (req.user.role === 'admin') {
      const teams = await Team.find({ isActive: true }).populate(basePopulate).sort({ createdAt: -1 });
      return res.json({ teams });
    }

    const teams = await Team.find({ isActive: true }).populate(basePopulate).sort({ createdAt: -1 });
    const mapped = teams.map((team) =>
      parseTeamForVolunteer({ team, volunteerId: req.user.userId })
    );

    res.json({ teams: mapped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch teams.' });
  }
};

export const applyToTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { message = '' } = req.body;

    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }

    const team = await Team.findOne({ _id: teamId, isActive: true });
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    const volunteerId = req.user.userId;
    const alreadyMember = team.members.some(
      (member) => String(member.volunteerId) === String(volunteerId)
    );
    if (alreadyMember) {
      return res.status(409).json({ message: 'You are already a member of this team.' });
    }

    const hasPending = team.pendingRequests.some(
      (request) => String(request.volunteerId) === String(volunteerId)
    );
    if (hasPending) {
      return res.status(409).json({ message: 'You already have a pending request for this team.' });
    }

    team.pendingRequests.push({
      volunteerId,
      message: String(message || '').trim(),
      requestedAt: new Date(),
    });
    await team.save();

    const populated = await Team.findById(team._id)
      .populate('organizerId', 'name email')
      .populate('members.volunteerId', 'name email department profileImage')
      .populate('pendingRequests.volunteerId', 'name email department profileImage');

    res.json({
      message: 'Join request sent to organizer.',
      team: populated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to apply for team.' });
  }
};

export const joinTeamByCode = async (req, res) => {
  try {
    const code = String(req.body?.joinCode || '')
      .trim()
      .toUpperCase();
    if (!code) {
      return res.status(400).json({ message: 'Join code is required.' });
    }

    const team = await Team.findOne({ joinCode: code, isActive: true });
    if (!team) {
      return res.status(404).json({ message: 'No team found for this join code.' });
    }

    const volunteerId = String(req.user.userId);
    const alreadyMember = team.members.some((member) => String(member.volunteerId) === volunteerId);
    if (alreadyMember) {
      return res.status(409).json({ message: 'You are already a member of this team.' });
    }

    const hasPending = team.pendingRequests.some(
      (request) => String(request.volunteerId) === volunteerId
    );
    if (!hasPending) {
      team.pendingRequests.push({
        volunteerId: req.user.userId,
        message: 'Requested via join code',
        requestedAt: new Date(),
      });
      await team.save();
    }

    const populated = await Team.findById(team._id)
      .populate('organizerId', 'name email')
      .populate('members.volunteerId', 'name email department profileImage')
      .populate('pendingRequests.volunteerId', 'name email department profileImage');

    res.json({
      message: hasPending
        ? 'You already have a pending request for this team.'
        : 'Join request sent to organizer using join code.',
      team: populated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to join team with code.' });
  }
};

export const approveJoinRequest = async (req, res) => {
  try {
    const { teamId, volunteerId } = req.params;
    if (!ensureTeamId(teamId) || !ensureTeamId(volunteerId)) {
      return res.status(400).json({ message: 'Invalid team or volunteer ID.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    const requestIndex = team.pendingRequests.findIndex(
      (request) => String(request.volunteerId) === String(volunteerId)
    );
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Pending request not found.' });
    }

    const volunteer = await User.findOne({ _id: volunteerId, role: 'volunteer' }).select('_id');
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found.' });
    }

    const alreadyMember = team.members.some(
      (member) => String(member.volunteerId) === String(volunteerId)
    );
    if (!alreadyMember) {
      team.members.push({
        volunteerId,
        joinedAt: new Date(),
      });
    }

    team.pendingRequests = team.pendingRequests.filter(
      (request) => String(request.volunteerId) !== String(volunteerId)
    );
    await team.save();

    const populated = await Team.findById(team._id)
      .populate('organizerId', 'name email')
      .populate('members.volunteerId', 'name email department profileImage')
      .populate('pendingRequests.volunteerId', 'name email department profileImage');

    res.json({
      message: 'Volunteer added to the team.',
      team: populated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to approve join request.' });
  }
};

export const rejectJoinRequest = async (req, res) => {
  try {
    const { teamId, volunteerId } = req.params;
    if (!ensureTeamId(teamId) || !ensureTeamId(volunteerId)) {
      return res.status(400).json({ message: 'Invalid team or volunteer ID.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    const pendingBefore = team.pendingRequests.length;
    team.pendingRequests = team.pendingRequests.filter(
      (request) => String(request.volunteerId) !== String(volunteerId)
    );

    if (pendingBefore === team.pendingRequests.length) {
      return res.status(404).json({ message: 'Pending request not found.' });
    }

    await team.save();

    const populated = await Team.findById(team._id)
      .populate('organizerId', 'name email')
      .populate('members.volunteerId', 'name email department profileImage')
      .populate('pendingRequests.volunteerId', 'name email department profileImage');

    res.json({
      message: 'Join request rejected.',
      team: populated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to reject join request.' });
  }
};

export const removeTeamMember = async (req, res) => {
  try {
    const { teamId, volunteerId } = req.params;
    if (!ensureTeamId(teamId) || !ensureTeamId(volunteerId)) {
      return res.status(400).json({ message: 'Invalid team or volunteer ID.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    const memberBefore = team.members.length;
    team.members = team.members.filter(
      (member) => String(member.volunteerId) !== String(volunteerId)
    );

    if (memberBefore === team.members.length) {
      return res.status(404).json({ message: 'Team member not found.' });
    }

    await team.save();

    const populated = await Team.findById(team._id)
      .populate('organizerId', 'name email')
      .populate('members.volunteerId', 'name email department profileImage')
      .populate('pendingRequests.volunteerId', 'name email department profileImage');

    res.json({
      message: 'Volunteer removed from team.',
      team: populated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to remove team member.' });
  }
};

export const runTeamAllocation = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { eventId } = req.body;

    if (!ensureTeamId(teamId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Valid teamId and eventId are required.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    const event = await Event.findById(eventId).populate('roles');
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (req.user.role === 'organizer' && String(event.createdBy) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'You can only allocate volunteers for your own events.' });
    }

    if (!Array.isArray(event.roles) || !event.roles.length) {
      return res.status(400).json({ message: 'Add event roles before running team allocation.' });
    }

    const memberIds = (team.members || []).map((member) => member.volunteerId);
    if (!memberIds.length) {
      return res.status(400).json({ message: 'This team has no members yet.' });
    }

    const rawVolunteers = await User.find({
      _id: { $in: memberIds },
      role: 'volunteer',
    }).select(
      'name email skills availability performanceScore totalParticipations department acceptanceRate attendanceRate rolePreferenceScores declinePatterns acceptedAssignments totalAssignments attendedEvents assignedEvents profileImage'
    );

    if (!rawVolunteers.length) {
      return res.status(400).json({ message: 'No valid team volunteers available for allocation.' });
    }

    const volunteers = await withLoadProfile(rawVolunteers, { excludeEventId: eventId });

    await Assignment.deleteMany({
      eventId,
      volunteerId: { $in: memberIds },
    });

    const allocations = [];
    const reservedVolunteerIds = new Set();

    for (const role of event.roles) {
      const roleId = role._id;
      const activeAssignments = await Assignment.find({
        eventId,
        roleId,
        status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
      }).select('volunteerId');

      const nonTeamAssignedCount = activeAssignments.filter(
        (assignment) => !memberIds.some((memberId) => String(memberId) === String(assignment.volunteerId))
      ).length;
      const remainingRequired = Math.max(0, (role.requiredCount || 0) - nonTeamAssignedCount);

      if (!remainingRequired) {
        continue;
      }

      const conflictingVolunteerIds = await getConflictingVolunteerIds({
        eventDate: event.date,
        eventTimeRange: resolveTimeRange(event, role),
        excludeEventId: event._id,
      });

      const availableVolunteers = volunteers.filter(
        (volunteer) =>
          !reservedVolunteerIds.has(volunteer._id.toString()) &&
          !conflictingVolunteerIds.includes(volunteer._id.toString())
      );

      const allocatedVolunteers = autoAllocateVolunteers(
        availableVolunteers,
        buildRoleContext(role, event),
        remainingRequired
      );

      for (const { volunteer, matchScore, priority } of allocatedVolunteers) {
        const assignment = new Assignment({
          volunteerId: volunteer._id,
          eventId,
          roleId,
          matchScore,
          status: 'pending',
          notes: `Team allocation (${team.name}) priority ${priority}`,
        });
        await assignment.save();

        allocations.push(assignment);
        reservedVolunteerIds.add(volunteer._id.toString());

        await createNotification({
          userId: volunteer._id,
          title: 'Team assignment',
          message: `You have a team-based assignment for ${event.eventName} as ${role.roleName}.`,
          type: 'assignment',
          data: { assignmentId: assignment._id, eventId, roleId },
        });
      }

      const finalRoleCount = await Assignment.countDocuments({
        eventId,
        roleId,
        status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
      });
      await Role.findByIdAndUpdate(roleId, { assignedCount: finalRoleCount });
    }

    const populatedAllocations = await Assignment.find({
      _id: { $in: allocations.map((assignment) => assignment._id) },
    })
      .populate('volunteerId', 'name email department skills performanceScore')
      .populate('eventId', 'eventName date venue status')
      .populate('roleId', 'roleName requiredSkills preferredExperienceLevel')
      .sort({ createdAt: -1 });

    res.json({
      message: 'Team AI allocation completed.',
      team: {
        _id: team._id,
        name: team.name,
      },
      event: {
        _id: event._id,
        eventName: event.eventName,
        date: event.date,
      },
      totalAssignments: populatedAllocations.length,
      allocations: populatedAllocations,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to run team AI allocation.' });
  }
};

export const getTeamReport = async (req, res) => {
  try {
    const { teamId } = req.params;
    const eventId = req.query.eventId || null;

    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }

    if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid eventId.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    const memberIds = (team.members || []).map((member) => member.volunteerId);
    if (!memberIds.length) {
      return res.json({
        team: {
          _id: team._id,
          name: team.name,
          description: team.description,
          memberCount: 0,
        },
        summary: {
          totalMembers: 0,
          assignments: 0,
          acceptedAssignments: 0,
          attendanceMarked: 0,
          presentMarked: 0,
        },
        topPerformers: [],
        memberReports: [],
      });
    }

    let eventFilterIds = null;
    if (req.user.role === 'organizer') {
      const organizerEvents = await Event.find({ createdBy: req.user.userId }).select('_id');
      eventFilterIds = organizerEvents.map((item) => item._id);
    }

    if (eventId) {
      const eventDoc = await Event.findById(eventId).select('_id createdBy eventName date');
      if (!eventDoc) {
        return res.status(404).json({ message: 'Event not found.' });
      }
      if (
        req.user.role === 'organizer' &&
        String(eventDoc.createdBy) !== String(req.user.userId)
      ) {
        return res.status(403).json({ message: 'You can only report on your own events.' });
      }
      eventFilterIds = [eventDoc._id];
    }

    const assignmentFilter = {
      volunteerId: { $in: memberIds },
    };
    if (eventFilterIds) {
      assignmentFilter.eventId = { $in: eventFilterIds };
    }

    const attendanceFilter = {
      volunteerId: { $in: memberIds },
    };
    if (eventFilterIds) {
      attendanceFilter.eventId = { $in: eventFilterIds };
    }

    const [members, assignments, attendance] = await Promise.all([
      User.find({ _id: { $in: memberIds }, role: 'volunteer' }).select(
        'name email department profileImage performanceScore totalParticipations skills acceptedAssignments totalAssignments attendedEvents assignedEvents'
      ),
      Assignment.find(assignmentFilter).select('volunteerId status eventId roleId assignedAt respondedAt'),
      Attendance.find(attendanceFilter).select('volunteerId status eventId'),
    ]);

    const memberReportEntries = await Promise.all(
      members.map(async (member) => {
        const memberAssignments = assignments.filter(
          (assignment) => String(assignment.volunteerId) === String(member._id)
        );
        const memberAttendance = attendance.filter(
          (record) => String(record.volunteerId) === String(member._id)
        );

        const metrics = await computeVolunteerMetrics({
          volunteerId: member._id,
          eventIds: eventFilterIds,
          participationCount: member.totalParticipations || 0,
          performanceScore: member.performanceScore || 0,
          skillDiversity: member.skills?.length || 0,
        });

        return {
          volunteerId: member._id,
          name: member.name,
          email: member.email,
          department: member.department || '',
          profileImage: member.profileImage || '',
          assignmentCount: memberAssignments.length,
          acceptedCount: memberAssignments.filter((assignment) => assignment.status === 'accepted').length,
          pendingCount: memberAssignments.filter((assignment) => assignment.status === 'pending').length,
          attendanceMarked: memberAttendance.length,
          presentCount: memberAttendance.filter((record) => record.status === 'present').length,
          performanceScore: member.performanceScore || 0,
          leaderboardScore: metrics.leaderboardScore,
          acceptanceRate: metrics.acceptanceRate,
          attendanceRate: metrics.attendanceRate,
          skillDiversity: metrics.skillDiversity,
          avgResponseHours: metrics.avgResponseHours,
        };
      })
    );

    const topPerformers = [...memberReportEntries]
      .sort((a, b) => {
        if (b.leaderboardScore !== a.leaderboardScore) {
          return b.leaderboardScore - a.leaderboardScore;
        }
        return b.performanceScore - a.performanceScore;
      })
      .slice(0, 5);

    const totalMembers = memberReportEntries.length;
    const assignmentsCount = assignments.length;
    const acceptedAssignments = assignments.filter((assignment) => assignment.status === 'accepted').length;
    const attendanceMarked = attendance.length;
    const presentMarked = attendance.filter((record) => record.status === 'present').length;
    const avgTeamPerformance = totalMembers
      ? Math.round(
          memberReportEntries.reduce((sum, item) => sum + (item.performanceScore || 0), 0) /
            totalMembers
        )
      : 0;

    res.json({
      team: {
        _id: team._id,
        name: team.name,
        description: team.description,
        memberCount: totalMembers,
      },
      summary: {
        totalMembers,
        assignments: assignmentsCount,
        acceptedAssignments,
        attendanceMarked,
        presentMarked,
        avgTeamPerformance,
      },
      topPerformers,
      memberReports: memberReportEntries.sort((a, b) => b.leaderboardScore - a.leaderboardScore),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate team report.' });
  }
};

export const regenerateJoinCode = async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    team.joinCode = await generateUniqueJoinCode();
    await team.save();

    res.json({
      message: 'Join code regenerated.',
      joinCode: team.joinCode,
      teamId: team._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to regenerate join code.' });
  }
};
