import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  applyToTeam,
  approveJoinRequest,
  createTeam,
  exportTeamAllocationsCsv,
  exportTeamAllocationsPdf,
  getTeamMessages,
  getTeams,
  getTeamReport,
  joinTeamByCode,
  regenerateJoinCode,
  rejectJoinRequest,
  removeTeamMember,
  runTeamAllocation,
  sendTeamAnnouncement,
  sendTeamMessage,
  updateTeamDetails,
  uploadTeamLogo,
} from '../controllers/teamController.js';
import { teamLogoUpload } from '../middleware/upload.js';

const router = express.Router();

router.get('/', authenticateToken, getTeams);
router.get('/:teamId/messages', authenticateToken, getTeamMessages);
router.post('/:teamId/messages', authenticateToken, sendTeamMessage);
router.post(
  '/:teamId/announcements',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  sendTeamAnnouncement
);
router.post('/', authenticateToken, authorizeRole('organizer', 'admin'), createTeam);
router.put('/:teamId', authenticateToken, authorizeRole('organizer', 'admin'), updateTeamDetails);
router.post(
  '/:teamId/logo',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  teamLogoUpload,
  uploadTeamLogo
);
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
router.post(
  '/:teamId/allocation/run',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  runTeamAllocation
);
router.get(
  '/:teamId/report',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  getTeamReport
);
router.get(
  '/:teamId/allocation/export-csv',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  exportTeamAllocationsCsv
);
router.get(
  '/:teamId/allocation/export-pdf',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  exportTeamAllocationsPdf
);

export default router;
