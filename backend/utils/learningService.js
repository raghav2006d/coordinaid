import User from '../models/User.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const normalizeRoleKey = (roleName = '') => roleName.trim().toLowerCase();

const readMapValue = (mapValue, key) => {
  if (!mapValue) return 0;
  if (typeof mapValue.get === 'function') {
    return mapValue.get(key) ?? 0;
  }
  return mapValue[key] ?? 0;
};

const writeMapValue = (mapValue, key, value) => {
  if (!mapValue) return;
  if (typeof mapValue.set === 'function') {
    mapValue.set(key, value);
    return;
  }
  mapValue[key] = value;
};

const updateRateFields = (user) => {
  const totalAssignments = user.totalAssignments || 0;
  const acceptedAssignments = user.acceptedAssignments || 0;
  const assignedEvents = user.assignedEvents || 0;
  const attendedEvents = user.attendedEvents || 0;

  user.acceptanceRate = totalAssignments ? acceptedAssignments / totalAssignments : 0;
  user.attendanceRate = assignedEvents ? attendedEvents / assignedEvents : 0;
};

export const updateLearningOnAssignmentResponse = async ({
  volunteerId,
  roleName,
  accepted,
}) => {
  const user = await User.findById(volunteerId);
  if (!user) return;

  user.totalAssignments = (user.totalAssignments || 0) + 1;
  if (accepted) {
    user.acceptedAssignments = (user.acceptedAssignments || 0) + 1;
  } else {
    const roleKey = normalizeRoleKey(roleName);
    const declineCount = readMapValue(user.declinePatterns, roleKey) + 1;
    writeMapValue(user.declinePatterns, roleKey, declineCount);

    const currentPref = readMapValue(user.rolePreferenceScores, roleKey);
    writeMapValue(user.rolePreferenceScores, roleKey, clamp(currentPref - 0.05));
    user.markModified('rolePreferenceScores');
    user.markModified('declinePatterns');
  }

  updateRateFields(user);
  await user.save();
};

export const updateLearningOnAttendance = async ({
  volunteerId,
  roleName,
  attended,
  accepted,
}) => {
  const user = await User.findById(volunteerId);
  if (!user) return;

  user.assignedEvents = (user.assignedEvents || 0) + 1;
  if (attended) {
    user.attendedEvents = (user.attendedEvents || 0) + 1;
  }

  const roleKey = normalizeRoleKey(roleName);
  const currentPref = readMapValue(user.rolePreferenceScores, roleKey);

  if (attended && accepted) {
    writeMapValue(user.rolePreferenceScores, roleKey, clamp(currentPref + 0.1));
  } else if (!attended) {
    writeMapValue(user.rolePreferenceScores, roleKey, clamp(currentPref - 0.05));
  }

  user.markModified('rolePreferenceScores');
  updateRateFields(user);
  await user.save();
};

export const getRolePreferenceScore = (volunteer, roleName) => {
  const roleKey = normalizeRoleKey(roleName);
  return readMapValue(volunteer?.rolePreferenceScores, roleKey) || 0;
};

export const getDeclineCount = (volunteer, roleName) => {
  const roleKey = normalizeRoleKey(roleName);
  return readMapValue(volunteer?.declinePatterns, roleKey) || 0;
};
