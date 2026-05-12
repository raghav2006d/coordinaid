const ROLE_DISTRIBUTION = [
  { key: 'registration', label: 'Registration', percentage: 0.2 },
  { key: 'crowdManagement', label: 'Crowd Management', percentage: 0.3 },
  { key: 'technical', label: 'Technical', percentage: 0.25 },
  { key: 'support', label: 'Support', percentage: 0.25 },
];

const EVENT_TYPE_SKILL_LIBRARY = {
  'tech-fest': {
    registration: ['Registration Desk', 'Data Entry', 'Communication'],
    crowdManagement: ['Crowd Management', 'Conflict Resolution', 'First Aid'],
    technical: ['Technical Support', 'AV Setup', 'Networking Basics'],
    support: ['Logistics', 'Hospitality', 'Volunteer Coordination'],
  },
  cultural: {
    registration: ['Registration Desk', 'Communication', 'Hospitality'],
    crowdManagement: ['Crowd Management', 'Stage Coordination', 'Conflict Resolution'],
    technical: ['Audio Mixing', 'Lighting Control', 'Technical Support'],
    support: ['Hospitality', 'Logistics', 'Public Speaking'],
  },
  workshop: {
    registration: ['Registration Desk', 'Data Entry', 'Communication'],
    crowdManagement: ['Crowd Management', 'Classroom Discipline', 'First Aid'],
    technical: ['Technical Support', 'Presentation Tools', 'Troubleshooting'],
    support: ['Logistics', 'Participant Support', 'Documentation'],
  },
  general: {
    registration: ['Registration Desk', 'Communication', 'Data Entry'],
    crowdManagement: ['Crowd Management', 'Conflict Resolution', 'Safety Protocols'],
    technical: ['Technical Support', 'Equipment Setup', 'Troubleshooting'],
    support: ['Hospitality', 'Logistics', 'Volunteer Coordination'],
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hours, minutes] = String(timeValue)
    .split(':')
    .map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatTimeFromMinutes = (minutes) => {
  const bounded = clamp(Math.round(minutes), 0, 24 * 60);
  const hours = String(Math.floor(bounded / 60)).padStart(2, '0');
  const mins = String(bounded % 60).padStart(2, '0');
  return `${hours}:${mins}`;
};

const normalizeEventType = (eventType = '') => {
  const key = eventType.trim().toLowerCase().replace(/\s+/g, '-');
  if (EVENT_TYPE_SKILL_LIBRARY[key]) return key;

  if (['technical', 'hackathon'].includes(key)) return 'tech-fest';
  if (['culture', 'cultural-event'].includes(key)) return 'cultural';
  if (['training', 'session'].includes(key)) return 'workshop';
  return 'general';
};

const distributeVolunteerCounts = (totalVolunteers) => {
  if (totalVolunteers <= 0) {
    return ROLE_DISTRIBUTION.map((role) => ({ ...role, count: 0 }));
  }

  const rawDistribution = ROLE_DISTRIBUTION.map((role) => ({
    ...role,
    rawCount: totalVolunteers * role.percentage,
    count: Math.floor(totalVolunteers * role.percentage),
  }));

  let remaining = totalVolunteers - rawDistribution.reduce((sum, role) => sum + role.count, 0);

  rawDistribution
    .slice()
    .sort((a, b) => b.rawCount - b.count - (a.rawCount - a.count))
    .forEach((role) => {
      if (remaining <= 0) return;
      const match = rawDistribution.find((item) => item.key === role.key);
      if (match) {
        match.count += 1;
        remaining -= 1;
      }
    });

  return rawDistribution.map(({ key, label, percentage, count }) => ({
    key,
    label,
    percentage,
    count,
  }));
};

const buildRoleSkillRequirements = (eventTypeKey) => {
  const skillSet = EVENT_TYPE_SKILL_LIBRARY[eventTypeKey] || EVENT_TYPE_SKILL_LIBRARY.general;
  const experienceMap = {
    registration: 'beginner',
    crowdManagement: 'intermediate',
    technical: 'intermediate',
    support: 'beginner',
  };

  return ROLE_DISTRIBUTION.map((role) => ({
    key: role.key,
    roleName: role.label,
    requiredSkills: (skillSet[role.key] || []).map((name, index) => ({
      name,
      minimumLevel:
        role.key === 'technical' && index === 0
          ? 'advanced'
          : role.key === 'crowdManagement' && index === 0
            ? 'intermediate'
            : 'beginner',
    })),
    preferredExperienceLevel: experienceMap[role.key] || 'intermediate',
  }));
};

const workloadThresholds = {
  medium: 0.5,
  high: 0.8,
};

export const getWorkloadIndicator = (loadScore = 0) => {
  if (loadScore >= workloadThresholds.high) return 'High';
  if (loadScore >= workloadThresholds.medium) return 'Medium';
  return 'Low';
};

export const getLoadMetrics = ({ currentAssignments = 0, maxAssignments = 5 } = {}) => {
  const safeMax = Math.max(1, Number(maxAssignments) || 5);
  const safeCurrent = Math.max(0, Number(currentAssignments) || 0);
  const loadScore = safeCurrent / safeMax;
  const loadPenalty = clamp(safeCurrent * 0.05, 0, 0.45);
  const overloaded = loadScore > workloadThresholds.high;

  return {
    currentAssignments: safeCurrent,
    maxAssignments: safeMax,
    loadScore,
    loadPenalty,
    overloaded,
    workloadLevel: getWorkloadIndicator(loadScore),
  };
};

export const applyLoadPenalty = (baseScore, loadMetrics) => {
  const overloadPenalty = loadMetrics.overloaded
    ? (loadMetrics.loadScore - workloadThresholds.high) * 0.2
    : 0;
  return clamp(baseScore - loadMetrics.loadPenalty - overloadPenalty, 0, 1);
};

export const generateEventPlan = ({ eventType, attendees, durationHours }) => {
  const safeAttendees = Math.max(0, Number(attendees) || 0);
  const safeDuration = Math.max(0, Number(durationHours) || 0);
  const totalVolunteers = Math.ceil(safeAttendees / 25);
  const distribution = distributeVolunteerCounts(totalVolunteers);
  const eventTypeKey = normalizeEventType(eventType);
  const roleSkills = buildRoleSkillRequirements(eventTypeKey);

  const roles = distribution.map((distributionRole) => {
    const skillRole = roleSkills.find((item) => item.key === distributionRole.key);
    return {
      roleKey: distributionRole.key,
      roleName: distributionRole.label,
      percentage: distributionRole.percentage,
      requiredCount: distributionRole.count,
      requiredSkills: skillRole?.requiredSkills || [],
      preferredExperienceLevel: skillRole?.preferredExperienceLevel || 'intermediate',
    };
  });

  return {
    eventType: eventTypeKey,
    attendees: safeAttendees,
    durationHours: safeDuration,
    totalVolunteers,
    formula: 'ceil(attendees / 25)',
    roles,
  };
};

export const buildDefaultSlots = ({ isFullDay = false, startTime = '', endTime = '' }) => {
  if (isFullDay) {
    return [
      { label: 'Morning', startTime: '08:00', endTime: '12:00' },
      { label: 'Afternoon', startTime: '12:00', endTime: '16:00' },
      { label: 'Evening', startTime: '16:00', endTime: '20:00' },
    ];
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return [{ label: 'Default Slot', startTime: '09:00', endTime: '13:00' }];
  }

  const duration = endMinutes - startMinutes;
  const slotSize = duration >= 360 ? 120 : 90;
  const slots = [];
  let cursor = startMinutes;

  while (cursor < endMinutes) {
    const slotEnd = Math.min(cursor + slotSize, endMinutes);
    slots.push({
      label: `${formatTimeFromMinutes(cursor)} - ${formatTimeFromMinutes(slotEnd)}`,
      startTime: formatTimeFromMinutes(cursor),
      endTime: formatTimeFromMinutes(slotEnd),
    });
    cursor += slotSize;
  }

  return slots.length ? slots : [{ label: 'Default Slot', startTime, endTime }];
};

export const hasTimeOverlap = (rangeA, rangeB) => {
  if (rangeA?.isFullDay || rangeB?.isFullDay) {
    return true;
  }

  const startA = parseTimeToMinutes(rangeA?.startTime);
  const endA = parseTimeToMinutes(rangeA?.endTime);
  const startB = parseTimeToMinutes(rangeB?.startTime);
  const endB = parseTimeToMinutes(rangeB?.endTime);

  if (startA === null || endA === null || startB === null || endB === null) {
    return false;
  }

  return Math.max(startA, startB) < Math.min(endA, endB);
};

export const countAvailableVolunteersForSlot = ({ volunteers, eventDate, slot }) =>
  volunteers.filter((volunteer) => {
    const availability = volunteer.availability || [];
    return availability.some((entry) => {
      if (!entry?.date || !eventDate) return false;
      const sameDay = new Date(entry.date).toDateString() === new Date(eventDate).toDateString();
      if (!sameDay) return false;

      return hasTimeOverlap(
        { isFullDay: false, startTime: entry.startTime, endTime: entry.endTime },
        { isFullDay: false, startTime: slot.startTime, endTime: slot.endTime }
      );
    });
  }).length;

export const findBestTimeSlot = ({ volunteers, slots, eventDate }) => {
  if (!slots?.length) {
    return {
      bestSlot: null,
      slotScores: [],
    };
  }

  const slotScores = slots.map((slot) => ({
    ...slot,
    availableCount: countAvailableVolunteersForSlot({ volunteers, eventDate, slot }),
  }));

  slotScores.sort((a, b) => {
    if (b.availableCount !== a.availableCount) return b.availableCount - a.availableCount;
    const aStart = parseTimeToMinutes(a.startTime) ?? 0;
    const bStart = parseTimeToMinutes(b.startTime) ?? 0;
    return aStart - bStart;
  });

  return {
    bestSlot: slotScores[0] || null,
    slotScores,
  };
};
