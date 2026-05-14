import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Attendance from '../models/Attendance.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import Role from '../models/Role.js';
import Team from '../models/Team.js';
import TeamMessage from '../models/TeamMessage.js';
import User from '../models/User.js';
import { decryptTeamMessage } from '../utils/teamChatCrypto.js';

const QUICK_SUGGESTIONS_BY_ROLE = {
  volunteer: [
    'What is my assigned role?',
    'When is my event?',
    'Show my availability',
    'What assignments are pending for me?',
    'Show my attendance summary',
    'Show my performance score',
    'Any team announcements?',
    'Show my teams',
    'Who is assigned to technical support?',
  ],
  organizer: [
    'List volunteers for this event',
    'Show staffing gaps for this event',
    'Show attendance summary for this event',
    'Show top volunteers for my events',
    'What is my organizer dashboard summary?',
    'Any team announcements?',
    'Show pending team requests',
    'Who is assigned to technical support?',
    'When is my next event?',
    'Show pending assignments',
  ],
  admin: [
    'List volunteers for this event',
    'Show system overview',
    'Show staffing gaps for this event',
    'Show top volunteers overall',
    'Show attendance summary for this event',
    'Any team announcements?',
    'Show pending team requests',
    'Who is assigned to technical support?',
    'When is the next event?',
    'Show pending assignments',
  ],
};

const formatDate = (value) => new Date(value).toLocaleDateString();
const ACTIVE_ASSIGNMENT_STATUSES = ['pending', 'accepted', 'completed'];

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

  if (
    normalized.includes('system overview') ||
    normalized.includes('dashboard summary') ||
    normalized.includes('dashboard overview')
  ) {
    return 'dashboard_overview';
  }

  if (
    normalized.includes('assignment summary') ||
    normalized.includes('pending for me') ||
    normalized.includes('my assignments') ||
    normalized.includes('workload')
  ) {
    return 'assignment_overview';
  }

  if (
    normalized.includes('attendance') ||
    normalized.includes('present') ||
    normalized.includes('absent') ||
    normalized.includes('late')
  ) {
    return 'attendance_summary';
  }

  if (
    normalized.includes('performance') ||
    normalized.includes('top volunteers') ||
    normalized.includes('best performers') ||
    normalized.includes('score')
  ) {
    return 'performance_summary';
  }

  if (
    normalized.includes('staffing gap') ||
    normalized.includes('coverage') ||
    normalized.includes('unfilled role') ||
    normalized.includes('volunteers needed')
  ) {
    return 'staffing_insights';
  }

  if (
    normalized.includes('announcement') ||
    normalized.includes('team updates') ||
    normalized.includes('team news')
  ) {
    return 'team_announcements';
  }

  if (normalized.includes('notification') || normalized.includes('alert')) {
    return 'notifications';
  }

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

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

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

const handleAssignmentOverviewIntent = async ({ user }) => {
  if (user.role === 'volunteer') {
    const assignments = await Assignment.find({ volunteerId: user.userId }).select('status');
    if (!assignments.length) {
      return 'You do not have assignment history yet.';
    }

    const stats = assignments.reduce(
      (summary, assignment) => {
        summary.total += 1;
        summary[assignment.status] = (summary[assignment.status] || 0) + 1;
        return summary;
      },
      { total: 0, pending: 0, accepted: 0, declined: 0, completed: 0, 'no-show': 0 }
    );

    return `Your assignment summary:\nTotal: ${stats.total}\nPending: ${stats.pending}\nAccepted: ${stats.accepted}\nCompleted: ${stats.completed}\nDeclined: ${stats.declined}\nNo-show: ${stats['no-show']}`;
  }

  const eventFilter = user.role === 'organizer' ? { createdBy: user.userId } : {};
  const events = await Event.find(eventFilter).select('_id');
  const eventIds = events.map((event) => event._id);

  if (!eventIds.length) {
    return user.role === 'organizer'
      ? 'No events found for your organizer account.'
      : 'No events found in the system.';
  }

  const assignments = await Assignment.find({
    eventId: { $in: eventIds },
  }).select('status');
  const stats = assignments.reduce(
    (summary, assignment) => {
      summary.total += 1;
      summary[assignment.status] = (summary[assignment.status] || 0) + 1;
      return summary;
    },
    { total: 0, pending: 0, accepted: 0, declined: 0, completed: 0, 'no-show': 0 }
  );

  return `Assignment summary across ${user.role === 'organizer' ? 'your events' : 'the system'}:\nTotal: ${stats.total}\nPending: ${stats.pending}\nAccepted: ${stats.accepted}\nCompleted: ${stats.completed}\nDeclined: ${stats.declined}\nNo-show: ${stats['no-show']}`;
};

const handleAttendanceSummaryIntent = async ({ user, context }) => {
  if (user.role === 'volunteer') {
    const records = await Attendance.find({ volunteerId: user.userId }).select('status');
    if (!records.length) {
      return 'No attendance records found for you yet.';
    }

    const stats = records.reduce(
      (summary, record) => {
        summary.total += 1;
        summary[record.status] = (summary[record.status] || 0) + 1;
        return summary;
      },
      { total: 0, present: 0, absent: 0, 'marked-late': 0 }
    );
    const attendanceRate = stats.total ? (stats.present / stats.total) * 100 : 0;

    return `Your attendance summary:\nMarked: ${stats.total}\nPresent: ${stats.present}\nAbsent: ${stats.absent}\nLate: ${stats['marked-late']}\nAttendance rate: ${formatPercent(attendanceRate)}`;
  }

  const contextEvent = await resolveContextEvent({ user, context });
  if (!contextEvent?._id) {
    return 'Please open an event page or ask with event context to view attendance summary.';
  }

  const [markedCount, presentCount, absentCount, lateCount, assignmentsCount] = await Promise.all([
    Attendance.countDocuments({ eventId: contextEvent._id }),
    Attendance.countDocuments({ eventId: contextEvent._id, status: 'present' }),
    Attendance.countDocuments({ eventId: contextEvent._id, status: 'absent' }),
    Attendance.countDocuments({ eventId: contextEvent._id, status: 'marked-late' }),
    Assignment.countDocuments({
      eventId: contextEvent._id,
      status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
    }),
  ]);

  const coverage = assignmentsCount ? (markedCount / assignmentsCount) * 100 : 0;
  return `Attendance summary for ${contextEvent.eventName}:\nMarked: ${markedCount}/${assignmentsCount}\nPresent: ${presentCount}\nAbsent: ${absentCount}\nLate: ${lateCount}\nMarking coverage: ${formatPercent(coverage)}`;
};

const getScopedEventIds = async ({ user, context }) => {
  if (user.role === 'admin') {
    const contextEvent = await resolveContextEvent({ user, context });
    if (contextEvent?._id) return [contextEvent._id];
    const events = await Event.find({}).select('_id').limit(1000);
    return events.map((event) => event._id);
  }

  if (user.role === 'organizer') {
    const contextEvent = await resolveContextEvent({ user, context });
    if (contextEvent?._id) return [contextEvent._id];
    const events = await Event.find({ createdBy: user.userId }).select('_id');
    return events.map((event) => event._id);
  }

  const assignments = await Assignment.find({ volunteerId: user.userId }).select('eventId');
  return [...new Set(assignments.map((assignment) => String(assignment.eventId)))].filter(
    (id) => mongoose.Types.ObjectId.isValid(id)
  );
};

const handlePerformanceSummaryIntent = async ({ user, context }) => {
  if (user.role === 'volunteer') {
    const profile = await User.findById(user.userId).select(
      'performanceScore acceptanceRate attendanceRate acceptedAssignments totalAssignments'
    );
    if (!profile) {
      return 'Unable to load your performance profile right now.';
    }

    return `Your performance snapshot:\nPerformance score: ${Number(
      profile.performanceScore || 0
    ).toFixed(1)}\nAcceptance rate: ${formatPercent(profile.acceptanceRate || 0)}\nAttendance rate: ${formatPercent(
      profile.attendanceRate || 0
    )}\nAccepted assignments: ${profile.acceptedAssignments || 0}/${
      profile.totalAssignments || 0
    }`;
  }

  const scopedEventIds = await getScopedEventIds({ user, context });
  if (!scopedEventIds.length) {
    return user.role === 'organizer'
      ? 'No event activity found yet for your organizer account.'
      : 'No event activity found yet in the system.';
  }

  const assignments = await Assignment.find({
    eventId: { $in: scopedEventIds },
    status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
  }).select('volunteerId');

  const volunteerIds = [...new Set(assignments.map((assignment) => String(assignment.volunteerId)))];
  if (!volunteerIds.length) {
    return 'No volunteer assignment activity found for this scope yet.';
  }

  const topVolunteers = await User.find({
    _id: { $in: volunteerIds },
    role: 'volunteer',
  })
    .select('name performanceScore acceptanceRate attendanceRate')
    .sort({ performanceScore: -1, attendanceRate: -1 })
    .limit(5);

  if (!topVolunteers.length) {
    return 'No volunteer performance records available yet.';
  }

  const lines = topVolunteers
    .map(
      (volunteer, index) =>
        `${index + 1}. ${volunteer.name} - score ${Number(volunteer.performanceScore || 0).toFixed(
          1
        )}, acceptance ${formatPercent(volunteer.acceptanceRate || 0)}, attendance ${formatPercent(
          volunteer.attendanceRate || 0
        )}`
    )
    .join('\n');

  return `${user.role === 'organizer' ? 'Top volunteers in your event scope' : 'Top volunteers in current scope'}:\n${lines}`;
};

const handleStaffingInsightsIntent = async ({ user, context }) => {
  if (user.role === 'volunteer') {
    return 'Staffing insights are available for organizers/admin. You can still ask about your role or availability.';
  }

  const event = await resolveContextEvent({ user, context });
  if (!event?._id) {
    return 'No event context found. Open an event page and ask again for staffing insights.';
  }

  const roles = await Role.find({ eventId: event._id }).select('roleName requiredCount');
  if (!roles.length) {
    return `No roles are configured yet for ${event.eventName}. Add event roles first.`;
  }

  const roleIds = roles.map((role) => role._id);
  const assignedByRole = await Assignment.aggregate([
    {
      $match: {
        eventId: event._id,
        roleId: { $in: roleIds },
        status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
      },
    },
    {
      $group: {
        _id: '$roleId',
        count: { $sum: 1 },
      },
    },
  ]);

  const assignedMap = new Map(assignedByRole.map((entry) => [String(entry._id), entry.count]));
  const gaps = roles.map((role) => {
    const assigned = assignedMap.get(String(role._id)) || 0;
    const required = Number(role.requiredCount || 0);
    const shortfall = Math.max(required - assigned, 0);
    return { roleName: role.roleName, required, assigned, shortfall };
  });

  const totalRequired = gaps.reduce((sum, role) => sum + role.required, 0);
  const totalAssigned = gaps.reduce((sum, role) => sum + role.assigned, 0);
  const coverage = totalRequired ? (totalAssigned / totalRequired) * 100 : 0;

  const suggestedVolunteers = Math.ceil((Number(event.expectedAttendees) || 0) / 25);
  const gapLines = gaps
    .filter((role) => role.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall)
    .slice(0, 5)
    .map(
      (role, index) =>
        `${index + 1}. ${role.roleName}: assigned ${role.assigned}/${role.required} (gap ${role.shortfall})`
    );

  const summary = `Staffing insight for ${event.eventName}:\nRole coverage: ${totalAssigned}/${totalRequired} (${formatPercent(
    coverage
  )})\nAI volunteer target by crowd size: ${suggestedVolunteers}`;

  if (!gapLines.length) {
    return `${summary}\nAll configured roles are currently filled.`;
  }

  return `${summary}\nTop gaps:\n${gapLines.join('\n')}`;
};

const handleTeamAnnouncementsIntent = async ({ user }) => {
  let teamFilter = { isActive: true };
  if (user.role === 'volunteer') {
    teamFilter = { ...teamFilter, 'members.volunteerId': user.userId };
  } else if (user.role === 'organizer') {
    teamFilter = { ...teamFilter, organizerId: user.userId };
  }

  const teams = await Team.find(teamFilter).select('_id name');
  if (!teams.length) {
    return user.role === 'volunteer'
      ? 'You are not in any active team yet, so there are no announcements.'
      : 'No active teams found in your scope.';
  }

  const teamIds = teams.map((team) => team._id);
  const teamNameMap = new Map(teams.map((team) => [String(team._id), team.name]));

  const announcements = await TeamMessage.find({
    teamId: { $in: teamIds },
    messageType: 'announcement',
  })
    .populate('senderId', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  if (!announcements.length) {
    return 'No recent team announcements found.';
  }

  const lines = announcements.map((entry, index) => {
    const content = decryptTeamMessage({
      encryptedContent: entry.encryptedContent,
      iv: entry.iv,
      authTag: entry.authTag,
    });
    const preview = String(content || '').slice(0, 90);
    return `${index + 1}. ${teamNameMap.get(String(entry.teamId)) || 'Team'} - ${
      entry.senderId?.name || 'Organizer'
    }: ${preview}${preview.length >= 90 ? '...' : ''}`;
  });

  return `Recent team announcements:\n${lines.join('\n')}`;
};

const handleNotificationsIntent = async ({ user }) => {
  const [unreadCount, latest] = await Promise.all([
    Notification.countDocuments({ userId: user.userId, isRead: false }),
    Notification.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('title type createdAt'),
  ]);

  if (!latest.length) {
    return unreadCount
      ? `You have ${unreadCount} unread notifications.`
      : 'You do not have notifications yet.';
  }

  const previews = latest
    .map(
      (notification, index) =>
        `${index + 1}. ${notification.title} (${notification.type}, ${formatDate(
          notification.createdAt
        )})`
    )
    .join('\n');

  return `You have ${unreadCount} unread notification(s).\nLatest updates:\n${previews}`;
};

const handleDashboardOverviewIntent = async ({ user, context }) => {
  if (user.role === 'volunteer') {
    const [pending, teams] = await Promise.all([
      Assignment.countDocuments({ volunteerId: user.userId, status: 'pending' }),
      Team.countDocuments({ isActive: true, 'members.volunteerId': user.userId }),
    ]);
    return `Volunteer summary:\nPending assignments: ${pending}\nJoined teams: ${teams}\nTry asking: "Show my performance score" or "Show my attendance summary".`;
  }

  if (user.role === 'organizer') {
    const events = await Event.find({ createdBy: user.userId }).select('_id date eventName');
    const eventIds = events.map((event) => event._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events
      .filter((event) => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    const [pendingAssignments, teamCount, pendingTeamRequests] = await Promise.all([
      Assignment.countDocuments({
        eventId: { $in: eventIds },
        status: 'pending',
      }),
      Team.countDocuments({ organizerId: user.userId, isActive: true }),
      Team.aggregate([
        { $match: { organizerId: new mongoose.Types.ObjectId(user.userId), isActive: true } },
        { $project: { requestCount: { $size: { $ifNull: ['$pendingRequests', []] } } } },
        { $group: { _id: null, total: { $sum: '$requestCount' } } },
      ]),
    ]);

    return `Organizer dashboard summary:\nEvents: ${events.length}\nActive teams: ${teamCount}\nPending assignment responses: ${pendingAssignments}\nPending team join requests: ${
      pendingTeamRequests[0]?.total || 0
    }\nNext event: ${upcoming ? `${upcoming.eventName} on ${formatDate(upcoming.date)}` : 'Not scheduled'}`;
  }

  const [userCounts, eventCounts, teams] = await Promise.all([
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Event.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Team.find({}).select('isActive lastActivityAt'),
  ]);

  const roleMap = new Map(userCounts.map((entry) => [entry._id, entry.count]));
  const statusMap = new Map(eventCounts.map((entry) => [entry._id, entry.count]));
  const threshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const activeTeams = teams.filter(
    (team) => team.isActive && new Date(team.lastActivityAt || team.updatedAt || team.createdAt) >= threshold
  ).length;
  const inactiveTeams = teams.filter(
    (team) => team.isActive && new Date(team.lastActivityAt || team.updatedAt || team.createdAt) < threshold
  ).length;

  return `Admin system overview:\nUsers - Volunteers: ${roleMap.get('volunteer') || 0}, Organizers: ${
    roleMap.get('organizer') || 0
  }, Admins: ${roleMap.get('admin') || 0}\nEvents - Planning: ${
    statusMap.get('planning') || 0
  }, Allocated: ${statusMap.get('allocated') || 0}, Completed: ${
    statusMap.get('completed') || 0
  }\nTeams - Registered: ${teams.length}, Active: ${activeTeams}, Inactive: ${inactiveTeams}`;
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
    } else if (intent === 'assignment_overview') {
      responseText = await handleAssignmentOverviewIntent({ user: req.user });
    } else if (intent === 'attendance_summary') {
      responseText = await handleAttendanceSummaryIntent({ user: req.user, context });
    } else if (intent === 'performance_summary') {
      responseText = await handlePerformanceSummaryIntent({ user: req.user, context });
    } else if (intent === 'staffing_insights') {
      responseText = await handleStaffingInsightsIntent({ user: req.user, context });
    } else if (intent === 'team_announcements') {
      responseText = await handleTeamAnnouncementsIntent({ user: req.user });
    } else if (intent === 'notifications') {
      responseText = await handleNotificationsIntent({ user: req.user });
    } else if (intent === 'dashboard_overview') {
      responseText = await handleDashboardOverviewIntent({ user: req.user, context });
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
      const pending = await Assignment.countDocuments({
        volunteerId: req.user.userId,
        status: 'pending',
      });
      if (pending) {
        reminders.push(`You have ${pending} pending assignment response(s).`);
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
      if (req.user.role === 'admin') {
        const adminSummary = await handleDashboardOverviewIntent({ user: req.user, context });
        reminders.push(adminSummary.split('\n')[0]);
      }
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
