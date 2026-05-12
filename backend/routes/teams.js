import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  applyToTeam,
  approveJoinRequest,
  createTeam,
  getTeams,
  joinTeamByCode,
  regenerateJoinCode,
  rejectJoinRequest,
  removeTeamMember,
} from '../controllers/teamController.js';

const router = express.Router();

router.get('/', authenticateToken, getTeams);
router.post('/', authenticateToken, authorizeRole('organizer', 'admin'), createTeam);
router.post('/join-by-code', authenticateToken, authorizeRole('volunteer'), joinTeamByCode);
router.post('/:teamId/apply', authenticateToken, authorizeRole('volunteer'), applyToTeam);
router.post(
  '/:teamId/requests/:volunteerId/approve',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  approveJoinRequest
);
router.post(
  '/:teamId/requests/:volunteerId/reject',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  rejectJoinRequest
);
router.post(
  '/:teamId/members/:volunteerId/remove',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  removeTeamMember
);
router.post(
  '/:teamId/regenerate-code',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  regenerateJoinCode
);

export default router;
