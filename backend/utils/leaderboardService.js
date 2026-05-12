import Attendance from '../models/Attendance.js';
import Assignment from '../models/Assignment.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeParticipation = (count) => clamp((count / 10) * 100, 0, 100);
const normalizeSkillDiversity = (count) => clamp((count / 8) * 100, 0, 100);

export const computeVolunteerMetrics = async ({
  volunteerId,
  eventIds = null,
  sinceDate = null,
  participationCount = 0,
  performanceScore = 0,
  skillDiversity = 0,
}) => {
  const assignmentFilter = { volunteerId };
  const attendanceFilter = { volunteerId };

  if (eventIds) {
    assignmentFilter.eventId = { $in: eventIds };
    attendanceFilter.eventId = { $in: eventIds };
  }

  if (sinceDate) {
    assignmentFilter.createdAt = { $gte: sinceDate };
    attendanceFilter.createdAt = { $gte: sinceDate };
  }

  const [assignments, attendance] = await Promise.all([
    Assignment.find(assignmentFilter).select('status assignedAt respondedAt'),
    Attendance.find(attendanceFilter).select('status'),
  ]);

  const acceptedCount = assignments.filter((a) => a.status === 'accepted').length;
  const declinedCount = assignments.filter((a) => a.status === 'declined').length;
  const responseCount = acceptedCount + declinedCount;
  const acceptanceRate = responseCount ? Math.round((acceptedCount / responseCount) * 100) : 0;

  const attendedCount = attendance.filter((a) => a.status === 'present').length;
  const attendanceRate = attendance.length
    ? Math.round((attendedCount / attendance.length) * 100)
    : 0;

  const responseTimes = assignments
    .filter((a) => a.respondedAt && a.assignedAt)
    .map((a) => (a.respondedAt - a.assignedAt) / 3600000);
  const avgResponseHours = responseTimes.length
    ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
    : null;

  const score =
    normalizeParticipation(participationCount) * 0.35 +
    attendanceRate * 0.25 +
    acceptanceRate * 0.2 +
    (performanceScore || 0) * 0.15 +
    normalizeSkillDiversity(skillDiversity) * 0.05;

  return {
    participationCount,
    attendanceRate,
    acceptanceRate,
    performanceScore: performanceScore || 0,
    skillDiversity,
    avgResponseHours,
    leaderboardScore: Math.round(score),
  };
};

export const getBadges = ({ attendanceRate, acceptanceRate, skillDiversity, avgResponseHours }) => {
  const badges = [];

  if (acceptanceRate >= 90 && attendanceRate >= 90) {
    badges.push('Most Reliable');
  }

  if (attendanceRate >= 95) {
    badges.push('Best Attendance');
  }

  if (avgResponseHours !== null && avgResponseHours <= 6) {
    badges.push('Quick Responder');
  }

  if (skillDiversity >= 5) {
    badges.push('Multi-Skilled Volunteer');
  }

  return badges;
};

export const getImprovementTips = ({ attendanceRate, acceptanceRate, skillDiversity, performanceScore }) => {
  const tips = [];
  if (attendanceRate < 85) tips.push('Improve attendance consistency');
  if (acceptanceRate < 80) tips.push('Respond to assignments faster');
  if (performanceScore < 80) tips.push('Focus on quality feedback');
  if (skillDiversity < 4) tips.push('Add more skill categories');
  return tips.length ? tips : ['You are performing strongly. Keep it up!'];
};
