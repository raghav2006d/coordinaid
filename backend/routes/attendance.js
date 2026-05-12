import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  markAttendance,
  bulkMarkAttendance,
  submitAttendanceProof,
  uploadAttendanceProof,
  verifyAttendanceProof,
  getAttendanceByEvent,
  getAttendanceByVolunteer,
  getLeaderboard,
  exportLeaderboardCsv,
  exportAssignmentsCsv,
  exportLeaderboardPdf,
  exportAssignmentsPdf,
} from '../controllers/attendanceController.js';
import { attendanceProofUpload } from '../middleware/upload.js';

const router = express.Router();

router.post('/mark', authenticateToken, authorizeRole('organizer', 'admin'), markAttendance);
router.post('/bulk-mark', authenticateToken, authorizeRole('organizer', 'admin'), bulkMarkAttendance);
router.post('/proof-upload', authenticateToken, authorizeRole('volunteer'), attendanceProofUpload, uploadAttendanceProof);
router.post('/proof', authenticateToken, authorizeRole('volunteer'), submitAttendanceProof);
router.put('/:id/verify', authenticateToken, authorizeRole('organizer', 'admin'), verifyAttendanceProof);
router.get('/event/:eventId', authenticateToken, getAttendanceByEvent);
router.get('/volunteer/:volunteerId', authenticateToken, getAttendanceByVolunteer);
router.get('/leaderboard/top', authenticateToken, getLeaderboard);
router.get('/leaderboard/export', authenticateToken, authorizeRole('organizer', 'admin'), exportLeaderboardCsv);
router.get('/leaderboard/export-pdf', authenticateToken, authorizeRole('organizer', 'admin'), exportLeaderboardPdf);
router.get('/assignments/export', authenticateToken, authorizeRole('organizer', 'admin'), exportAssignmentsCsv);
router.get('/assignments/export-pdf', authenticateToken, authorizeRole('organizer', 'admin'), exportAssignmentsPdf);

export default router;
