import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Event from '../models/Event.js';
import Team from '../models/Team.js';
import User from '../models/User.js';

const QUICK_SUGGESTIONS_BY_ROLE = {
  volunteer: [
    'What is my assigned role?',
    'When is my event?',
    'Show my availability',
    'Show my teams',
    'Who is assigned to technical support?',
  ],
  organizer: [
    'List volunteers for this event',
    'Show pending team requests',
    'Who is assigned to technical support?',
    'When is my next event?',
    'Show pending assignments',
  ],
  admin: [
    'List volunteers for this event',
    'Show pending team requests',
    'Who is assigned to technical support?',
    'When is the next event?',
    'Show pending assignments',
  ],
};

const formatDate = (value) => new Date(value).toLocaleDateString();

const formatTimeRange = (eventDoc, roleDoc = null) => {
  const isFullDay = roleDoc?.isFullDay ?? eventDoc?.isFullDay ?? false;
  const startTime = roleDoc?.startTime || eventDoc?.startTime || '';
  const endTime = roleDoc?.endTime || eventDoc?.endTime || '';

  if (isFullDay) return 'Full day';
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return 'Time not set';
};

const parseEventIdFromPath = (currentPath = '') => {
  const segments = currentPath.split('/').filter(Boolean);
  const eventId = segments.find((segment) => /^[a-f\d]{24}$/i.test(segment));
  return eventId || null;
};

const parseIntent = (query = '') => {
  const normalized = query.toLowerCase();

  if (normalized.includes('availability')) {
    return 'availability';
  }

  if (
    normalized.includes('my role') ||
    normalized.includes('assigned role') ||
    normalized.includes('assignment')
  ) {
    return 'my_role';
  }

  if (
    normalized.includes('team') ||
    normalized.includes('join code') ||
    normalized.includes('group')
  ) {
    return 'teams';
  }

  if (
    normalized.includes('technical') ||
    normalized.includes('volunteer') ||
    normalized.includes('who is assigned') ||
    normalized.includes('show volunteers')
  ) {
    return 'volunteers_by_role';
  }

  if (
    normalized.includes('my event') ||
    normalized.includes('event time') ||
    normalized.includes('when is') ||
    normalized.includes('event')
  ) {
    return 'event_details';
  }

  if (normalized.includes('pending')) {
    return 'pending_assignments';
  }

  return 'fallback';
};

const parseRoleKeyword = (query = '') => {
  const normalized = query.toLowerCase();
  if (normalized.includes('technical')) return 'technical';
  if (normalized.includes('registration')) return 'registration';
  if (normalized.includes('crowd')) return 'crowd';
  if (normalized.includes('support')) return 'support';
  return '';
};

const getQuickSuggestions = (role = 'volunteer') =>
  QUICK_SUGGESTIONS_BY_ROLE[role] || QUICK_SUGGESTIONS_BY_ROLE.volunteer;

const getUpcomingVolunteerAssignment = async (userId) => {
  const assignments = await Assignment.find({
    volunteerId: userId,
    status: { $in: ['pending', 'accepted', 'completed'] },
  })
    .populate('eventId', 'eventName date venue isFullDay startTime endTime')
    .populate('roleId', 'roleName isFullDay startTime endTime')
    .sort({ createdAt: -1 })
    .limit(30);

  const now = new Date();
  const upcoming = assignments
    .filter((assignment) => assignment.eventId?.date)
    .sort((a, b) => new Date(a.eventId.date) - new Date(b.eventId.date))
    .find((assignment) => new Date(assignment.eventId.date) >= new Date(now.setHours(0, 0, 0, 0)));

  return upcoming || assignments[0] || null;
};

const getUpcomingOrganizerEvent = async (user) => {
  const filter = user.role === 'organizer' ? { createdBy: user.userId } : {};
  const events = await Event.find(filter).sort({ date: 1 }).limit(20);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcoming = events.find((event) => new Date(event.date) >= todayStart);
  return upcoming || events[0] || null;
};

const canAccessEvent = async ({ user, eventId }) => {
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return false;
  if (user.role === 'admin') return true;

  if (user.role === 'organizer') {
    const event = await Event.findOne({ _id: eventId, createdBy: user.userId }).select('_id');
    return Boolean(event);
  }

  const assignment = await Assignment.findOne({ eventId, volunteerId: user.userId }).select('_id');
  return Boolean(assignment);
};

const resolveContextEvent = async ({ user, context }) => {
  const contextEventId =
    context?.eventId || parseEventIdFromPath(context?.currentPath || '') || null;

  if (contextEventId && (await canAccessEvent({ user, eventId: contextEventId }))) {
    return Event.findById(contextEventId);
  }

  if (user.role === 'volunteer') {
    const assignment = await getUpcomingVolunteerAssignment(user.userId);
    return assignment?.eventId || null;
  }

  return getUpcomingOrganizerEvent(user);
};

const handleMyRoleIntent = async ({ user }) => {
  if (user.role !== 'volunteer') {
    return 'You are logged in as organizer/admin. Ask "list volunteers for this event" for coordination details.';
  }

  const assignment = await getUpcomingVolunteerAssignment(user.userId);
  if (!assignment) {
    return 'No assignments found yet. You can ask about your availability or upcoming events.';
  }

  return `You are assigned as ${assignment.roleId?.roleName || 'Volunteer'} for ${
    assignment.eventId?.eventName || 'an event'
  } on ${formatDate(assignment.eventId?.date)} at ${formatTimeRange(
    assignment.eventId,
    assignment.roleId
  )}.`;
};

const handleEventIntent = async ({ user, context }) => {
  if (user.role === 'volunteer') {
    const assignment = await getUpcomingVolunteerAssignment(user.userId);
    if (!assignment) {
      return 'No upcoming event found for your assignments.';
    }

    return `Your next event is ${assignment.eventId?.eventName || 'an event'} on ${formatDate(
      assignment.eventId?.date
    )} at ${formatTimeRange(assignment.eventId, assignment.roleId)} in ${
      assignment.eventId?.venue || 'the assigned venue'
    }.`;
  }

  const contextEvent = await resolveContextEvent({ user, context });
  if (!contextEvent) {
    return 'No upcoming event found. Create an event first to use coordinator insights.';
  }

  return `Next event: ${contextEvent.eventName} on ${formatDate(contextEvent.date)} at ${formatTimeRange(
    contextEvent
  )} in ${contextEvent.venue}.`;
};

const handleAvailabilityIntent = async ({ user }) => {
  const profile = await User.findById(user.userId).select('availability');
  const availability = profile?.availability || [];

  if (!availability.length) {
    return 'No availability slots saved yet. Add slots in your profile settings.';
  }

  const preview = availability
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)
    .map(
      (slot) =>
        `${formatDate(slot.date)}: ${slot.startTime || 'Start not set'} - ${slot.endTime || 'End not set'}`
    )
    .join('\n');

  return `Your saved availability:\n${preview}`;
};

const handleVolunteersIntent = async ({ user, query, context }) => {
  const roleKeyword = parseRoleKeyword(query);
  const event = await resolveContextEvent({ user, context });

  if (!event?._id) {
    return 'Please open an event page or ask again with an event context to list volunteers.';
  }

  const assignments = await Assignment.find({
    eventId: event._id,
    status: { $in: ['pending', 'accepted', 'completed'] },
  })
    .populate('volunteerId', 'name email department')
    .populate('roleId', 'roleName')
    .sort({ createdAt: -1 });

  let filtered = assignments;
  if (roleKeyword) {
    filtered = assignments.filter((assignment) =>
      String(assignment.roleId?.roleName || '')
        .toLowerCase()
        .includes(roleKeyword)
    );
  }

  if (!filtered.length) {
    return roleKeyword
      ? `No volunteers are currently assigned for ${roleKeyword} roles in ${event.eventName}.`
      : `No volunteers are assigned yet for ${event.eventName}.`;
  }

  const list = filtered
    .slice(0, 8)
    .map(
      (assignment, index) =>
        `${index + 1}. ${assignment.volunteerId?.name || 'Volunteer'} - ${
          assignment.roleId?.roleName || 'Role'
        }`
    )
    .join('\n');

  return `${roleKeyword ? `${roleKeyword} volunteer assignments` : 'Volunteer assignments'} for ${
    event.eventName
  }:\n${list}`;
};

const handlePendingAssignmentsIntent = async ({ user }) => {
  if (user.role === 'volunteer') {
    const pending = await Assignment.countDocuments({
      volunteerId: user.userId,
      status: 'pending',
    });
    return pending
      ? `You currently have ${pending} pending assignment response(s).`
      : 'You have no pending assignment responses.';
  }

  const eventFilter = user.role === 'organizer' ? { createdBy: user.userId } : {};
  const events = await Event.find(eventFilter).select('_id');
  const pending = await Assignment.countDocuments({
    eventId: { $in: events.map((event) => event._id) },
    status: 'pending',
  });

  return pending
    ? `There are ${pending} pending assignment response(s) across your events.`
    : 'No pending assignment responses found.';
};

const handleTeamsIntent = async ({ user }) => {
  if (user.role === 'volunteer') {
    const teams = await Team.find({
      isActive: true,
      'members.volunteerId': user.userId,
    })
      .populate('organizerId', 'name')
      .select('name organizerId joinCode members');

    if (!teams.length) {
      const pendingCount = await Team.countDocuments({
        isActive: true,
        'pendingRequests.volunteerId': user.userId,
      });
      return pendingCount
        ? `You are waiting for approval in ${pendingCount} team request(s).`
        : 'You have not joined any organizer team yet.';
    }

    const summary = teams
      .slice(0, 5)
      .map(
        (team, index) =>
          `${index + 1}. ${team.name} (Organizer: ${team.organizerId?.name || 'Organizer'})`
      )
      .join('\n');
    return `Your teams:\n${summary}`;
  }

  if (user.role === 'organizer') {
    const teams = await Team.find({
      isActive: true,
      organizerId: user.userId,
    }).select('name pendingRequests members joinCode');

    if (!teams.length) {
      return 'No organizer teams found yet. Create one from your dashboard Team Builder section.';
    }

    const pendingTotal = teams.reduce(
      (sum, team) => sum + (team.pendingRequests?.length || 0),
      0
    );
    const summary = teams
      .slice(0, 5)
      .map(
        (team, index) =>
          `${index + 1}. ${team.name}: ${team.members?.length || 0} members, ${
            team.pendingRequests?.length || 0
          } pending (code ${team.joinCode})`
      )
      .join('\n');

    return `Team overview (${pendingTotal} pending request(s) total):\n${summary}`;
  }

  const totalTeams = await Team.countDocuments({ isActive: true });
  return `There are ${totalTeams} active organizer team(s) in the system.`;
};

const buildFallbackMessage = () =>
  'Sorry, I did not understand that. Try asking about your role, event, volunteers, availability, or teams.';

export const queryCoordinatorAssistant = async (req, res) => {
  try {
    const { query = '', context = {} } = req.body;
    const intent = parseIntent(query);
    let responseText = '';

    if (intent === 'my_role') {
      responseText = await handleMyRoleIntent({ user: req.user });
    } else if (intent === 'event_details') {
      responseText = await handleEventIntent({ user: req.user, context });
    } else if (intent === 'volunteers_by_role') {
      responseText = await handleVolunteersIntent({ user: req.user, query, context });
    } else if (intent === 'availability') {
      responseText = await handleAvailabilityIntent({ user: req.user });
    } else if (intent === 'teams') {
      responseText = await handleTeamsIntent({ user: req.user });
    } else if (intent === 'pending_assignments') {
      responseText = await handlePendingAssignmentsIntent({ user: req.user });
    } else {
      responseText = buildFallbackMessage();
    }

    res.json({
      intent,
      response: responseText,
      quickSuggestions: getQuickSuggestions(req.user.role),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to process coordinator query.' });
  }
};

export const getCoordinatorSuggestions = async (req, res) => {
  try {
    const context = req.body?.context || {};
    const suggestions = getQuickSuggestions(req.user.role);
    const reminders = [];

    if (req.user.role === 'volunteer') {
      const assignment = await getUpcomingVolunteerAssignment(req.user.userId);
      if (assignment?.eventId?.date) {
        const isToday =
          new Date(assignment.eventId.date).toDateString() === new Date().toDateString();
        if (isToday) {
          reminders.push(
            `You have ${assignment.eventId.eventName} today as ${assignment.roleId?.roleName || 'Volunteer'}.`
          );
        }
      }
    } else {
      const contextEvent = await resolveContextEvent({ user: req.user, context });
      if (contextEvent) {
        reminders.push(
          `Current focus event: ${contextEvent.eventName} on ${formatDate(contextEvent.date)}.`
        );
      }
      const pendingSummary = await handlePendingAssignmentsIntent({ user: req.user });
      reminders.push(pendingSummary);
    }

    res.json({
      suggestions,
      reminders,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load coordinator suggestions.' });
  }
};
