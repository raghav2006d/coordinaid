// AI Allocation Algorithm
// Base Score = (Skill Match x 0.5) + (Experience x 0.2) + (Availability x 0.2) + (Performance x 0.1)
// Learning Boost = (Acceptance Rate x 0.2) + (Attendance Rate x 0.2) + (Role Preference x 0.2)
import { applyLoadPenalty, getLoadMetrics } from './aiAssistantService.js';

const levelMap = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const normalizeLevel = (level) => levelMap[level] || 1;

const normalizeSkillName = (skillName = '') => skillName.trim().toLowerCase();

const normalizeRate = (value) => {
  if (Number.isNaN(value) || value === null || value === undefined) return 0;
  if (value > 1) return Math.min(value / 100, 1);
  if (value < 0) return 0;
  return value;
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const getRolePreferenceScore = (volunteer, roleName) => {
  if (!volunteer?.rolePreferenceScores || !roleName) return 0;
  const key = roleName.trim().toLowerCase();
  if (typeof volunteer.rolePreferenceScores.get === 'function') {
    return volunteer.rolePreferenceScores.get(key) || 0;
  }
  return volunteer.rolePreferenceScores[key] || 0;
};

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

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

export const calculateMatchScore = (volunteer, roleSample) => {
  const skillDetails = calculateSkillMatch(volunteer.skills, roleSample.requiredSkills);
  const experienceMatch = calculateExperienceMatch(
    volunteer.participationHistory?.length || 0,
    volunteer.performanceScore,
    roleSample.preferredExperienceLevel
  );
  const availabilityMatch = calculateAvailabilityMatch(
    volunteer.availability,
    roleSample.eventDate,
    {
      isFullDay: roleSample.isFullDay || roleSample.eventIsFullDay,
      startTime: roleSample.startTime || roleSample.eventStartTime,
      endTime: roleSample.endTime || roleSample.eventEndTime,
    }
  );
  const performanceMatch = (volunteer.performanceScore || 0) / 100;

  const baseScore =
    skillDetails.score * 0.5 +
    experienceMatch * 0.2 +
    availabilityMatch * 0.2 +
    performanceMatch * 0.1;

  const acceptanceRate = normalizeRate(
    volunteer.acceptanceRate ??
      ((volunteer.acceptedAssignments || 0) / (volunteer.totalAssignments || 1))
  );
  const attendanceRate = normalizeRate(
    volunteer.attendanceRate ??
      ((volunteer.attendedEvents || 0) / (volunteer.assignedEvents || 1))
  );
  const rolePreferenceScore = normalizeRate(getRolePreferenceScore(volunteer, roleSample.roleName));

  const learningBoost =
    acceptanceRate * 0.2 + attendanceRate * 0.2 + rolePreferenceScore * 0.2;

  const baseScoreWithLearning = clamp(baseScore + learningBoost);
  const loadMetrics = getLoadMetrics({
    currentAssignments: volunteer.currentAssignments,
    maxAssignments: volunteer.maxAssignments,
  });
  const totalScore = applyLoadPenalty(baseScoreWithLearning, loadMetrics);
  const reliabilityScore = Math.round(
    (acceptanceRate * 0.4 + attendanceRate * 0.4 + rolePreferenceScore * 0.2) * 100
  );

  return {
    skillMatch: Math.round(skillDetails.score * 100),
    experienceMatch: Math.round(experienceMatch * 100),
    availabilityMatch: Math.round(availabilityMatch * 100),
    performanceMatch: Math.round(performanceMatch * 100),
    baseScore: Math.round(baseScore * 100),
    learningBoost: Math.round(learningBoost * 100),
    acceptanceRate: Math.round(acceptanceRate * 100),
    attendanceRate: Math.round(attendanceRate * 100),
    rolePreferenceScore: Math.round(rolePreferenceScore * 100),
    reliabilityScore,
    rawTotalScore: Math.round(baseScoreWithLearning * 100),
    totalScore: Math.round(totalScore * 100),
    loadScore: Math.round(loadMetrics.loadScore * 100),
    loadPenalty: Math.round(loadMetrics.loadPenalty * 100),
    workloadLevel: loadMetrics.workloadLevel,
    overloaded: loadMetrics.overloaded,
    currentAssignments: loadMetrics.currentAssignments,
    maxAssignments: loadMetrics.maxAssignments,
    matchedRequiredSkills: skillDetails.matchedRequiredSkills,
    totalRequiredSkills: skillDetails.totalRequiredSkills,
    fullyQualified: skillDetails.fullyQualified,
  };
};

const calculateSkillMatch = (volunteerSkills = [], requiredSkills = []) => {
  if (!requiredSkills.length) {
    return {
      score: 1,
      matchedRequiredSkills: 0,
      totalRequiredSkills: 0,
      fullyQualified: true,
    };
  }

  let matchedRequiredSkills = 0;
  let levelFitScore = 0;

  requiredSkills.forEach((requiredSkill) => {
    const volunteerSkill = volunteerSkills.find(
      (skill) => normalizeSkillName(skill.name) === normalizeSkillName(requiredSkill.name)
    );

    if (!volunteerSkill) {
      return;
    }

    matchedRequiredSkills += 1;

    const requiredLevel = normalizeLevel(requiredSkill.minimumLevel);
    const volunteerLevel = normalizeLevel(volunteerSkill.level);

    levelFitScore += Math.min(volunteerLevel / requiredLevel, 1);
  });

  const coverageRatio = matchedRequiredSkills / requiredSkills.length;
  const levelRatio = matchedRequiredSkills ? levelFitScore / requiredSkills.length : 0;
  const score = Math.min(coverageRatio * 0.75 + levelRatio * 0.25, 1);

  return {
    score,
    matchedRequiredSkills,
    totalRequiredSkills: requiredSkills.length,
    fullyQualified: matchedRequiredSkills === requiredSkills.length,
  };
};

const calculateExperienceMatch = (
  participationCount,
  performanceScore,
  preferredExperienceLevel = 'intermediate'
) => {
  const expectedParticipation = {
    beginner: 1,
    intermediate: 3,
    advanced: 5,
  };

  const targetParticipation = expectedParticipation[preferredExperienceLevel] || 3;
  const experienceScore = Math.min(participationCount / targetParticipation, 1);
  const performanceBonus = (performanceScore || 0) / 200;

  return Math.min(experienceScore * 0.7 + performanceBonus * 0.3, 1);
};

const calculateAvailabilityMatch = (availability = [], eventDate, eventTimeRange) => {
  if (!availability || availability.length === 0) return 0.25;
  if (!eventDate) return Math.min(0.45 + availability.length * 0.18, 1);

  const eventDay = new Date(eventDate).toDateString();
  const matchingSlot = availability.find((slot) => {
    if (new Date(slot.date).toDateString() !== eventDay) {
      return false;
    }

    if (!eventTimeRange) {
      return true;
    }

    const slotRange = {
      isFullDay: false,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
    return hasTimeOverlap(slotRange, eventTimeRange);
  });

  if (matchingSlot) {
    return 1;
  }

  return 0.2;
};

export const rankVolunteersForRole = (volunteers, role) => {
  const rankedVolunteers = volunteers.map((volunteer) => ({
    volunteer,
    matchScore: calculateMatchScore(volunteer, role),
  }));

  rankedVolunteers.sort((a, b) => {
    if (a.matchScore.fullyQualified !== b.matchScore.fullyQualified) {
      return Number(b.matchScore.fullyQualified) - Number(a.matchScore.fullyQualified);
    }

    if (a.matchScore.skillMatch !== b.matchScore.skillMatch) {
      return b.matchScore.skillMatch - a.matchScore.skillMatch;
    }

    if (a.matchScore.totalScore !== b.matchScore.totalScore) {
      return b.matchScore.totalScore - a.matchScore.totalScore;
    }

    return (b.volunteer.performanceScore || 0) - (a.volunteer.performanceScore || 0);
  });

  return rankedVolunteers;
};

export const autoAllocateVolunteers = (volunteers, role, requiredCount) => {
  const ranked = rankVolunteersForRole(volunteers, role);
  const allocated = [];

  for (let index = 0; index < Math.min(requiredCount, ranked.length); index += 1) {
    allocated.push({
      volunteer: ranked[index].volunteer,
      matchScore: ranked[index].matchScore,
      priority: index + 1,
    });
  }

  return allocated;
};
