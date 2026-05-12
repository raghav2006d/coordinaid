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
const getRolePreferenceScore = (volunteer, roleName) => {
  if (!volunteer?.rolePreferenceScores || !roleName) return 0;
  const key = roleName.trim().toLowerCase();
  if (typeof volunteer.rolePreferenceScores.get === 'function') {
    return volunteer.rolePreferenceScores.get(key) || 0;
  }
  return volunteer.rolePreferenceScores[key] || 0;
};

const calculateSkillMatch = (volunteerSkills = [], requiredSkills = []) => {
  if (!requiredSkills.length) {
    return {
      score: 100,
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
  const score = Math.min(coverageRatio * 0.75 + levelRatio * 0.25, 1) * 100;

  return {
    score: Math.round(score),
    matchedRequiredSkills,
    totalRequiredSkills: requiredSkills.length,
    fullyQualified: matchedRequiredSkills === requiredSkills.length,
  };
};

const calculateAvailabilityMatch = (availability = [], eventDate) => {
  if (!availability || availability.length === 0) {
    return {
      score: 25,
      isAvailable: false,
    };
  }

  if (!eventDate) {
    const score = Math.min(45 + availability.length * 18, 100);
    return {
      score: Math.round(score),
      isAvailable: false,
    };
  }

  const eventDay = new Date(eventDate).toDateString();
  const matchingSlot = availability.find((slot) => new Date(slot.date).toDateString() === eventDay);

  if (matchingSlot) {
    return {
      score: 100,
      isAvailable: true,
    };
  }

  return {
    score: 20,
    isAvailable: false,
  };
};

export const buildRecommendation = ({
  volunteer,
  role,
  metrics,
  eventDate,
}) => {
  const skillDetails = calculateSkillMatch(volunteer.skills || [], role.requiredSkills || []);
  const availabilityDetails = calculateAvailabilityMatch(volunteer.availability || [], eventDate);
  const performanceScore = Math.round(volunteer.performanceScore || 0);
  const attendanceRate =
    volunteer.attendanceRate !== undefined ? Math.round(volunteer.attendanceRate * 100) : metrics?.attendanceRate ?? 0;
  const acceptanceRate =
    volunteer.acceptanceRate !== undefined ? Math.round(volunteer.acceptanceRate * 100) : metrics?.acceptanceRate ?? 0;
  const rolePreferenceScore = Math.round(
    normalizeRate(getRolePreferenceScore(volunteer, role.roleName)) * 100
  );

  const recommendationScore =
    skillDetails.score * 0.4 +
    availabilityDetails.score * 0.2 +
    performanceScore * 0.15 +
    attendanceRate * 0.1 +
    acceptanceRate * 0.1 +
    rolePreferenceScore * 0.05;
  const loadMetrics = getLoadMetrics({
    currentAssignments: volunteer.currentAssignments,
    maxAssignments: volunteer.maxAssignments,
  });
  const adjustedRecommendationScore = applyLoadPenalty(recommendationScore / 100, loadMetrics) * 100;

  const reliabilityScore = Math.round(
    (acceptanceRate * 0.4 + attendanceRate * 0.4 + rolePreferenceScore * 0.2)
  );
  const roleSuccessIndicator = rolePreferenceScore;
  const recommendedByLearning = reliabilityScore >= 70 || roleSuccessIndicator >= 70;

  const reasons = [
    role.requiredSkills?.length
      ? `Matched ${skillDetails.matchedRequiredSkills}/${skillDetails.totalRequiredSkills} required skills`
      : 'No required skills listed for this role',
    availabilityDetails.isAvailable ? 'Available on the event date' : 'Availability not confirmed',
    `Attendance rate ${attendanceRate}%`,
    `Acceptance reliability ${acceptanceRate}%`,
    `Performance score ${performanceScore}/100`,
    recommendedByLearning ? 'Recommended based on past performance' : 'Building historical confidence',
    `Workload ${loadMetrics.workloadLevel} (${loadMetrics.currentAssignments}/${loadMetrics.maxAssignments})`,
  ];

  return {
    volunteer,
    baseRecommendationScore: Math.round(recommendationScore),
    recommendationScore: Math.round(adjustedRecommendationScore),
    skillMatch: skillDetails.score,
    availabilityMatch: availabilityDetails.score,
    attendanceRate,
    acceptanceRate,
    performanceScore,
    reliabilityScore,
    roleSuccessIndicator,
    recommendedByLearning,
    rolePreferenceScore,
    workloadLevel: loadMetrics.workloadLevel,
    loadScore: Math.round(loadMetrics.loadScore * 100),
    loadPenalty: Math.round(loadMetrics.loadPenalty * 100),
    overloaded: loadMetrics.overloaded,
    currentAssignments: loadMetrics.currentAssignments,
    maxAssignments: loadMetrics.maxAssignments,
    matchedRequiredSkills: skillDetails.matchedRequiredSkills,
    totalRequiredSkills: skillDetails.totalRequiredSkills,
    fullyQualified: skillDetails.fullyQualified,
    availabilityStatus: availabilityDetails.isAvailable,
    reasons,
  };
};

export const rankVolunteersForRecommendation = ({
  volunteers,
  role,
  metricsByVolunteer,
  eventDate,
}) => {
  const ranked = volunteers.map((volunteer) =>
    buildRecommendation({
      volunteer,
      role,
      metrics: metricsByVolunteer.get(volunteer._id.toString()),
      eventDate,
    })
  );

  ranked.sort((a, b) => {
    if (a.fullyQualified !== b.fullyQualified) {
      return Number(b.fullyQualified) - Number(a.fullyQualified);
    }
    if (a.skillMatch !== b.skillMatch) {
      return b.skillMatch - a.skillMatch;
    }
    return b.recommendationScore - a.recommendationScore;
  });

  return ranked;
};
