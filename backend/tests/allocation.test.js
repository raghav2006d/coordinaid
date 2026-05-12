import assert from 'assert';
import { calculateMatchScore } from '../utils/allocationService.js';

const run = () => {
  const volunteer = {
    skills: [{ name: 'Registration Desk', level: 'advanced' }],
    participationHistory: [{ eventId: '1' }],
    performanceScore: 90,
    availability: [{ date: new Date(), startTime: '09:00', endTime: '12:00' }],
    acceptanceRate: 0.9,
    attendanceRate: 0.9,
    rolePreferenceScores: { 'registration desk': 0.8 },
  };

  const role = {
    roleName: 'Registration Desk',
    requiredSkills: [{ name: 'Registration Desk', minimumLevel: 'beginner' }],
    preferredExperienceLevel: 'beginner',
    eventDate: new Date(),
    isFullDay: false,
    startTime: '10:00',
    endTime: '12:00',
  };

  const score = calculateMatchScore(volunteer, role);
  assert.ok(score.totalScore >= 0 && score.totalScore <= 100, 'Score should be in range');
  assert.ok(score.learningBoost >= 0, 'Learning boost should be >= 0');
  assert.ok(score.availabilityMatch > 0, 'Availability should match overlapping slot');

  const roleNoOverlap = {
    ...role,
    startTime: '14:00',
    endTime: '16:00',
  };
  const scoreNoOverlap = calculateMatchScore(volunteer, roleNoOverlap);
  assert.ok(scoreNoOverlap.availabilityMatch < score.availabilityMatch, 'Non-overlap should score lower');

  console.log('allocationService tests passed.');
};

run();
