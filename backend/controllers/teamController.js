import mongoose from 'mongoose';
import Team from '../models/Team.js';
import TeamMessage from '../models/TeamMessage.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Role from '../models/Role.js';
import Assignment from '../models/Assignment.js';
import Attendance from '../models/Attendance.js';
import { calculateMatchScore } from '../utils/allocationService.js';
import { createNotification } from '../utils/notificationService.js';
import { computeVolunteerMetrics } from '../utils/leaderboardService.js';
import { decryptTeamMessage, encryptTeamMessage } from '../utils/teamChatCrypto.js';
import PDFDocument from 'pdfkit';

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

const isTeamMember = ({ team, userId }) =>
  (team?.members || []).some((member) => String(member.volunteerId) === String(userId));

const canAccessTeamMessages = ({ team, user }) => {
  if (!team || !user) return false;
  if (user.role === 'admin') return true;
  if (String(team.organizerId) === String(user.userId)) return true;
  return isTeamMember({ team, userId: user.userId });
};

const touchTeamActivity = async (teamId) => {
  await Team.findByIdAndUpdate(teamId, { lastActivityAt: new Date() });
};

const notifyTeamParticipants = async ({
  team,
  title,
  message,
  data = {},
  excludeUserIds = [],
}) => {
  const excluded = new Set((excludeUserIds || []).map((id) => String(id)));
  const recipientIds = new Set();

  if (team?.organizerId) {
    recipientIds.add(String(team.organizerId));
  }
  (team?.members || []).forEach((member) => {
    if (member?.volunteerId) recipientIds.add(String(member.volunteerId));
  });

  await Promise.all(
    Array.from(recipientIds)
      .filter((id) => !excluded.has(String(id)))
      .map((userId) =>
        createNotification({
          userId,
          title,
          message,
          type: 'team',
          data: {
            ...data,
            teamId: team?._id,
          },
        })
      )
  );
};

const buildTeamMembershipCountMap = async (volunteerIds = []) => {
  if (!volunteerIds.length) return new Map();

  const counts = await Team.aggregate([
    { $match: { isActive: true, 'members.volunteerId': { $in: volunteerIds } } },
    { $unwind: '$members' },
    { $match: { 'members.volunteerId': { $in: volunteerIds } } },
    { $group: { _id: '$members.volunteerId', count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((entry) => [String(entry._id), entry.count]));
};

const attachMembershipCountsToTeams = async (teams = []) => {
  if (!Array.isArray(teams) || !teams.length) return teams;

  const volunteerIds = teams.flatMap((team) =>
    (team.members || []).map((member) => member?.volunteerId?._id || member?.volunteerId)
  );
  const validVolunteerIds = volunteerIds.filter(Boolean);
  const countMap = await buildTeamMembershipCountMap(validVolunteerIds);

  return teams.map((teamDoc) => {
    const team = typeof teamDoc?.toObject === 'function' ? teamDoc.toObject() : { ...teamDoc };
    const members = (team.members || []).map((member) => {
      const volunteerKey = String(member?.volunteerId?._id || member?.volunteerId || '');
      return {
        ...member,
        teamEnrollmentCount: countMap.get(volunteerKey) || 0,
      };
    });
    return { ...team, members };
  });
};

const safeCsv = (value) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const getEnrichedTeamById = async (teamId) => {
  const populated = await Team.findById(teamId)
    .populate('organizerId', 'name email')
    .populate('members.volunteerId', 'name email department profileImage')
    .populate('pendingRequests.volunteerId', 'name email department profileImage');
  if (!populated) return null;
  const [enriched] = await attachMembershipCountsToTeams([populated]);
  return enriched;
};

const formatTeamMessages = (messages = []) =>
  messages.map((message) => ({
    _id: message._id,
    teamId: message.teamId,
    senderId: message.senderId,
    messageType: message.messageType,
    content: decryptTeamMessage({
      encryptedContent: message.encryptedContent,
      iv: message.iv,
      authTag: message.authTag,
    }),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  }));

const fetchTeamEventAllocations = async ({ teamId, eventId, user }) => {
  const team = await findManageableTeam({ teamId, user });
  if (!team) {
    return { error: { status: 404, message: 'Team not found or access denied.' } };
  }

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return { error: { status: 400, message: 'Invalid eventId.' } };
  }

  const event = await Event.findById(eventId).select('eventName date venue createdBy expectedAttendees');
  if (!event) {
    return { error: { status: 404, message: 'Event not found.' } };
  }

  if (user.role === 'organizer' && String(event.createdBy) !== String(user.userId)) {
    return { error: { status: 403, message: 'You can only export your own event allocations.' } };
  }

  const memberIds = (team.members || []).map((member) => member.volunteerId);
  const teamMembershipCountMap = await buildTeamMembershipCountMap(memberIds);

  const assignments = await Assignment.find({
    eventId,
    volunteerId: { $in: memberIds },
  })
    .populate('volunteerId', 'name email department')
    .populate('roleId', 'roleName')
    .sort({ createdAt: 1 });

  return { team, event, assignments, teamMembershipCountMap };
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

const rankVolunteersForTeamRole = ({ volunteers, roleContext, teamMembershipCountMap }) => {
  return volunteers
    .map((volunteer) => {
      const baseMatch = calculateMatchScore(volunteer, roleContext);
      const teamEnrollmentCount = teamMembershipCountMap.get(String(volunteer._id)) || 1;
      const multiTeamPenalty = Math.max(0, teamEnrollmentCount - 1) * 3;
      const assignmentLoadPenalty = Math.max(0, (volunteer.currentAssignments || 0) - 1) * 2;
      const advancedScore = Math.max(
        0,
        (baseMatch.totalScore || 0) - multiTeamPenalty - assignmentLoadPenalty
      );

      return {
        volunteer,
        teamEnrollmentCount,
        advancedScore,
        matchScore: {
          ...baseMatch,
          totalScore: advancedScore,
        },
      };
    })
    .sort((a, b) => {
      if (a.matchScore.fullyQualified !== b.matchScore.fullyQualified) {
        return Number(b.matchScore.fullyQualified) - Number(a.matchScore.fullyQualified);
      }
      if (a.matchScore.skillMatch !== b.matchScore.skillMatch) {
        return b.matchScore.skillMatch - a.matchScore.skillMatch;
      }
      if (a.advancedScore !== b.advancedScore) {
        return b.advancedScore - a.advancedScore;
      }
      return (b.volunteer.performanceScore || 0) - (a.volunteer.performanceScore || 0);
    });
};

export const createTeam = async (req, res) => {
  try {
    const { name, description = '', focusArea = '', preferredEventTypes = [] } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Team name is required.' });
    }

    const joinCode = await generateUniqueJoinCode();
    const team = await Team.create({
      name: String(name).trim(),
      description: String(description || '').trim(),
      focusArea: String(focusArea || '').trim(),
      preferredEventTypes: Array.isArray(preferredEventTypes)
        ? preferredEventTypes.map((item) => String(item).trim()).filter(Boolean)
        : [],
      organizerId: req.user.userId,
      joinCode,
    });
    await touchTeamActivity(team._id);

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.status(201).json({
      message: 'Team created successfully.',
      team: enrichedTeam,
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
      const enriched = await attachMembershipCountsToTeams(teams);
      return res.json({ teams: enriched });
    }

    if (req.user.role === 'admin') {
      const teams = await Team.find({ isActive: true }).populate(basePopulate).sort({ createdAt: -1 });
      const enriched = await attachMembershipCountsToTeams(teams);
      return res.json({ teams: enriched });
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

export const updateTeamDetails = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description, focusArea, preferredEventTypes } = req.body;

    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    if (name !== undefined) team.name = String(name || '').trim();
    if (description !== undefined) team.description = String(description || '').trim();
    if (focusArea !== undefined) team.focusArea = String(focusArea || '').trim();
    if (preferredEventTypes !== undefined) {
      team.preferredEventTypes = Array.isArray(preferredEventTypes)
        ? preferredEventTypes.map((item) => String(item).trim()).filter(Boolean)
        : [];
    }

    if (!team.name) {
      return res.status(400).json({ message: 'Team name cannot be empty.' });
    }

    await team.save();
    await touchTeamActivity(team._id);
    await notifyTeamParticipants({
      team,
      title: 'Team details updated',
      message: `${team.name} details were updated by organizer.`,
      excludeUserIds: [req.user.userId],
      data: { activity: 'team-updated' },
    });

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.json({
      message: 'Team details updated.',
      team: enrichedTeam,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update team details.' });
  }
};

export const uploadTeamLogo = async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No team logo uploaded.' });
    }

    team.logoUrl = `/uploads/teams/${req.file.filename}`;
    await team.save();
    await touchTeamActivity(team._id);
    await notifyTeamParticipants({
      team,
      title: 'Team logo updated',
      message: `${team.name} has a new logo.`,
      excludeUserIds: [req.user.userId],
      data: { activity: 'team-logo-updated' },
    });

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.json({
      message: 'Team logo updated.',
      team: enrichedTeam,
      fileUrl: team.logoUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload team logo.' });
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
    await touchTeamActivity(team._id);
    await createNotification({
      userId: team.organizerId,
      title: 'New team join request',
      message: `A volunteer requested to join ${team.name}.`,
      type: 'team',
      data: { teamId: team._id, activity: 'team-join-request' },
    });
    await createNotification({
      userId: volunteerId,
      title: 'Join request sent',
      message: `Your request to join ${team.name} was sent.`,
      type: 'team',
      data: { teamId: team._id, activity: 'team-join-request' },
    });

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.json({
      message: 'Join request sent to organizer.',
      team: enrichedTeam,
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
      await touchTeamActivity(team._id);
      await createNotification({
        userId: team.organizerId,
        title: 'Join code request',
        message: `A volunteer used team join code for ${team.name}.`,
        type: 'team',
        data: { teamId: team._id, activity: 'team-join-code-request' },
      });
    }
    await createNotification({
      userId: req.user.userId,
      title: 'Join code submitted',
      message: hasPending
        ? `You already have a pending request for ${team.name}.`
        : `Your join-code request for ${team.name} was sent.`,
      type: 'team',
      data: { teamId: team._id, activity: 'team-join-code-request' },
    });

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.json({
      message: hasPending
        ? 'You already have a pending request for this team.'
        : 'Join request sent to organizer using join code.',
      team: enrichedTeam,
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
    await touchTeamActivity(team._id);
    await createNotification({
      userId: volunteerId,
      title: 'Team request approved',
      message: `Your request to join ${team.name} was approved.`,
      type: 'team',
      data: { teamId: team._id, activity: 'team-request-approved' },
    });

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.json({
      message: 'Volunteer added to the team.',
      team: enrichedTeam,
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
    await touchTeamActivity(team._id);
    await createNotification({
      userId: volunteerId,
      title: 'Team request rejected',
      message: `Your request to join ${team.name} was rejected.`,
      type: 'team',
      data: { teamId: team._id, activity: 'team-request-rejected' },
    });

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.json({
      message: 'Join request rejected.',
      team: enrichedTeam,
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
    await touchTeamActivity(team._id);
    await createNotification({
      userId: volunteerId,
      title: 'Removed from team',
      message: `You were removed from ${team.name}.`,
      type: 'team',
      data: { teamId: team._id, activity: 'team-member-removed' },
    });

    const enrichedTeam = await getEnrichedTeamById(team._id);

    res.json({
      message: 'Volunteer removed from team.',
      team: enrichedTeam,
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
    const teamMembershipCountMap = await buildTeamMembershipCountMap(memberIds);

    const requiredVolunteerTarget = Math.max(
      Math.ceil((Number(event.expectedAttendees) || 0) / 25),
      (event.roles || []).reduce((sum, role) => sum + (Number(role.requiredCount) || 0), 0)
    );

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

      const rankedVolunteers = rankVolunteersForTeamRole({
        volunteers: availableVolunteers,
        roleContext: buildRoleContext(role, event),
        teamMembershipCountMap,
      });

      const allocatedVolunteers = rankedVolunteers.slice(0, remainingRequired);

      for (let index = 0; index < allocatedVolunteers.length; index += 1) {
        const { volunteer, matchScore, teamEnrollmentCount } = allocatedVolunteers[index];
        const priority = index + 1;
        const assignment = new Assignment({
          volunteerId: volunteer._id,
          eventId,
          roleId,
          matchScore,
          status: 'pending',
          notes: `Team allocation (${team.name}) priority ${priority} | teams enrolled ${teamEnrollmentCount}`,
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

    const availabilityCoverage = requiredVolunteerTarget
      ? Math.round((populatedAllocations.length / requiredVolunteerTarget) * 100)
      : 0;
    await touchTeamActivity(team._id);
    await notifyTeamParticipants({
      team,
      title: 'Team allocation completed',
      message: `Team AI allocation ran for ${event.eventName}. ${populatedAllocations.length} assignments generated.`,
      excludeUserIds: [req.user.userId],
      data: { activity: 'team-allocation', eventId: event._id },
    });

    res.json({
      message: 'Team AI allocation completed.',
      team: {
        _id: team._id,
        name: team.name,
        logoUrl: team.logoUrl || '',
      },
      event: {
        _id: event._id,
        eventName: event.eventName,
        date: event.date,
      },
      recommendation: {
        requiredVolunteers: requiredVolunteerTarget,
        teamMembers: memberIds.length,
        allocatedFromTeam: populatedAllocations.length,
        coveragePercent: Math.min(availabilityCoverage, 100),
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
    const teamMembershipCountMap = await buildTeamMembershipCountMap(memberIds);
    if (!memberIds.length) {
      return res.json({
        team: {
          _id: team._id,
          name: team.name,
          description: team.description,
          logoUrl: team.logoUrl || '',
          memberCount: 0,
        },
        summary: {
          totalMembers: 0,
          assignments: 0,
          acceptedAssignments: 0,
          attendanceMarked: 0,
          presentMarked: 0,
          avgTeamsPerVolunteer: 0,
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
          teamEnrollmentCount: teamMembershipCountMap.get(String(member._id)) || 0,
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
    const avgTeamsPerVolunteer = totalMembers
      ? Number(
          (
            memberReportEntries.reduce((sum, item) => sum + (item.teamEnrollmentCount || 0), 0) /
            totalMembers
          ).toFixed(2)
        )
      : 0;

    res.json({
      team: {
        _id: team._id,
        name: team.name,
        description: team.description,
        logoUrl: team.logoUrl || '',
        memberCount: totalMembers,
      },
      summary: {
        totalMembers,
        assignments: assignmentsCount,
        acceptedAssignments,
        attendanceMarked,
        presentMarked,
        avgTeamPerformance,
        avgTeamsPerVolunteer,
      },
      topPerformers,
      memberReports: memberReportEntries.sort((a, b) => b.leaderboardScore - a.leaderboardScore),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate team report.' });
  }
};

export const getTeamMessages = async (req, res) => {
  try {
    const { teamId } = req.params;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 40));

    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }

    const team = await Team.findById(teamId);
    if (!team || !team.isActive) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    if (!canAccessTeamMessages({ team, user: req.user })) {
      return res.status(403).json({ message: 'Access denied for team chat.' });
    }

    const messages = await TeamMessage.find({ teamId })
      .populate('senderId', 'name role profileImage')
      .sort({ createdAt: -1 })
      .limit(limit);

    const formatted = formatTeamMessages(messages).reverse();
    res.json({
      teamId,
      messages: formatted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch team messages.' });
  }
};

export const sendTeamMessage = async (req, res) => {
  try {
    const { teamId } = req.params;
    const content = String(req.body?.content || '').trim();
    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }
    if (!content) {
      return res.status(400).json({ message: 'Message content is required.' });
    }
    if (content.length > 1500) {
      return res.status(400).json({ message: 'Message is too long.' });
    }

    const team = await Team.findById(teamId);
    if (!team || !team.isActive) {
      return res.status(404).json({ message: 'Team not found.' });
    }
    if (!canAccessTeamMessages({ team, user: req.user })) {
      return res.status(403).json({ message: 'Access denied for team chat.' });
    }

    const encrypted = encryptTeamMessage(content);
    const messageDoc = await TeamMessage.create({
      teamId,
      senderId: req.user.userId,
      messageType: 'chat',
      ...encrypted,
    });

    const populated = await TeamMessage.findById(messageDoc._id).populate(
      'senderId',
      'name role profileImage'
    );

    await touchTeamActivity(team._id);
    await notifyTeamParticipants({
      team,
      title: 'New team chat message',
      message: `${populated.senderId?.name || 'A team member'} sent a message in ${team.name}.`,
      excludeUserIds: [req.user.userId],
      data: { activity: 'team-chat-message', teamId: team._id },
    });

    res.status(201).json({
      message: 'Team message sent.',
      teamMessage: formatTeamMessages([populated])[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to send team message.' });
  }
};

export const sendTeamAnnouncement = async (req, res) => {
  try {
    const { teamId } = req.params;
    const content = String(req.body?.content || '').trim();
    if (!ensureTeamId(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID.' });
    }
    if (!content) {
      return res.status(400).json({ message: 'Announcement content is required.' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ message: 'Announcement is too long.' });
    }

    const team = await findManageableTeam({ teamId, user: req.user });
    if (!team) {
      return res.status(404).json({ message: 'Team not found or access denied.' });
    }

    const encrypted = encryptTeamMessage(content);
    const messageDoc = await TeamMessage.create({
      teamId,
      senderId: req.user.userId,
      messageType: 'announcement',
      ...encrypted,
    });

    const populated = await TeamMessage.findById(messageDoc._id).populate(
      'senderId',
      'name role profileImage'
    );

    await touchTeamActivity(team._id);
    await notifyTeamParticipants({
      team,
      title: 'Team announcement',
      message: `New announcement in ${team.name}: ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`,
      excludeUserIds: [req.user.userId],
      data: { activity: 'team-announcement', teamId: team._id },
    });

    res.status(201).json({
      message: 'Team announcement sent.',
      teamMessage: formatTeamMessages([populated])[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to send team announcement.' });
  }
};

export const exportTeamAllocationsCsv = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { eventId } = req.query;

    const result = await fetchTeamEventAllocations({
      teamId,
      eventId,
      user: req.user,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const { team, event, assignments, teamMembershipCountMap } = result;
    const requiredVolunteers = Math.ceil((Number(event.expectedAttendees) || 0) / 25);
    const coveragePercent = requiredVolunteers
      ? Math.min(Math.round((assignments.length / requiredVolunteers) * 100), 100)
      : 0;

    const rows = [
      ['Team Name', safeCsv(team.name)],
      ['Event', safeCsv(event.eventName)],
      ['Event Date', safeCsv(new Date(event.date).toLocaleDateString())],
      ['Venue', safeCsv(event.venue || '')],
      ['Required Volunteers', safeCsv(requiredVolunteers)],
      ['Allocated Volunteers', safeCsv(assignments.length)],
      ['Coverage %', safeCsv(coveragePercent)],
      [],
      [
        'Volunteer Name',
        'Email',
        'Department',
        'Role',
        'Status',
        'Match Score',
        'Teams Enrolled',
      ],
    ];

    assignments.forEach((assignment) => {
      const volunteerId = String(assignment.volunteerId?._id || assignment.volunteerId || '');
      rows.push([
        safeCsv(assignment.volunteerId?.name || ''),
        safeCsv(assignment.volunteerId?.email || ''),
        safeCsv(assignment.volunteerId?.department || ''),
        safeCsv(assignment.roleId?.roleName || ''),
        safeCsv(assignment.status || ''),
        safeCsv(assignment.matchScore?.totalScore || 0),
        safeCsv(teamMembershipCountMap.get(volunteerId) || 0),
      ]);
    });

    const csvContent = rows
      .map((row) => (Array.isArray(row) ? row.join(',') : ''))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="team-${teamId}-event-${eventId}-allocations.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export team allocations CSV.' });
  }
};

export const exportTeamAllocationsPdf = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { eventId } = req.query;

    const result = await fetchTeamEventAllocations({
      teamId,
      eventId,
      user: req.user,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const { team, event, assignments, teamMembershipCountMap } = result;
    const requiredVolunteers = Math.ceil((Number(event.expectedAttendees) || 0) / 25);
    const coveragePercent = requiredVolunteers
      ? Math.min(Math.round((assignments.length / requiredVolunteers) * 100), 100)
      : 0;

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="team-${teamId}-event-${eventId}-allocations.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(20).text(`Team Allocation Report - ${team.name}`, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Event: ${event.eventName}`);
    doc.text(`Date: ${new Date(event.date).toLocaleDateString()}`);
    doc.text(`Venue: ${event.venue || '-'}`);
    doc.text(`Required Volunteers: ${requiredVolunteers}`);
    doc.text(`Allocated Volunteers: ${assignments.length}`);
    doc.text(`Coverage: ${coveragePercent}%`);
    doc.moveDown();

    doc.fontSize(11).text('Volunteer', 40, doc.y, { continued: true });
    doc.text('Role', 190, doc.y, { continued: true });
    doc.text('Status', 300, doc.y, { continued: true });
    doc.text('Score', 370, doc.y, { continued: true });
    doc.text('Teams', 430, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    assignments.forEach((assignment, index) => {
      const volunteerId = String(assignment.volunteerId?._id || assignment.volunteerId || '');
      const teamCount = teamMembershipCountMap.get(volunteerId) || 0;

      doc
        .fontSize(10)
        .text(assignment.volunteerId?.name || '-', 40, doc.y, {
          continued: true,
          width: 140,
        })
        .text(assignment.roleId?.roleName || '-', 190, doc.y, { continued: true, width: 110 })
        .text(assignment.status || '-', 300, doc.y, { continued: true, width: 70 })
        .text(String(assignment.matchScore?.totalScore || 0), 370, doc.y, {
          continued: true,
          width: 60,
        })
        .text(String(teamCount), 430, doc.y);

      doc.moveDown(0.4);
      if ((index + 1) % 25 === 0) {
        doc.addPage();
      }
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export team allocations PDF.' });
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
    await touchTeamActivity(team._id);
    await notifyTeamParticipants({
      team,
      title: 'Team join code regenerated',
      message: `Organizer regenerated join code for ${team.name}.`,
      excludeUserIds: [req.user.userId],
      data: { activity: 'team-join-code-regenerated' },
    });

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
