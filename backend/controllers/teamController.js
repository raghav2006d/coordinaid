import mongoose from 'mongoose';
import Team from '../models/Team.js';
import User from '../models/User.js';

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
