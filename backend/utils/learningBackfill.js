import Assignment from '../models/Assignment.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Role from '../models/Role.js';

const normalizeRoleKey = (roleName = '') => roleName.trim().toLowerCase();
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const runLearningBackfill = async () => {
  const volunteers = await User.find({ role: 'volunteer' });
  const roles = await Role.find({});
  const roleNameMap = new Map(roles.map((role) => [role._id.toString(), role.roleName]));

  for (const volunteer of volunteers) {
    const assignments = await Assignment.find({ volunteerId: volunteer._id });
    const attendance = await Attendance.find({ volunteerId: volunteer._id });

    const acceptedAssignments = assignments.filter(
      (a) => a.status === 'accepted' || a.status === 'completed'
    ).length;
    const totalAssignments = assignments.length;
    const attendedEvents = attendance.filter((a) => a.status === 'present').length;
    const assignedEvents = attendance.length;

    const rolePreferenceScores = {};
    const declinePatterns = {};

    assignments.forEach((assignment) => {
      const roleName = roleNameMap.get(assignment.roleId?.toString()) || 'unknown';
      const roleKey = normalizeRoleKey(roleName);
      if (!rolePreferenceScores[roleKey]) rolePreferenceScores[roleKey] = 0;
      if (!declinePatterns[roleKey]) declinePatterns[roleKey] = 0;

      if (assignment.status === 'declined') {
        declinePatterns[roleKey] += 1;
        rolePreferenceScores[roleKey] = clamp(rolePreferenceScores[roleKey] - 0.05);
      }

      if (assignment.status === 'completed') {
        rolePreferenceScores[roleKey] = clamp(rolePreferenceScores[roleKey] + 0.1);
      }
    });

    volunteer.acceptedAssignments = acceptedAssignments;
    volunteer.totalAssignments = totalAssignments;
    volunteer.attendedEvents = attendedEvents;
    volunteer.assignedEvents = assignedEvents;
    volunteer.acceptanceRate = totalAssignments ? acceptedAssignments / totalAssignments : 0;
    volunteer.attendanceRate = assignedEvents ? attendedEvents / assignedEvents : 0;
    volunteer.rolePreferenceScores = rolePreferenceScores;
    volunteer.declinePatterns = declinePatterns;

    await volunteer.save();
  }
};
