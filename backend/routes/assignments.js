import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  runAllocation,
  getAssignments,
  getAssignmentById,
  getAssignmentHistory,
  updateAssignmentStatus,
  getRecommendedVolunteers,
  getEventRoleRecommendations,
  getSmartScheduleSuggestions,
  autoScheduleEvent,
  createManualAssignment,
  replaceVolunteer,
  removeVolunteerFromAssignment,
  confirmEventAllocations,
  exportEventAllocationsPdf,
} from '../controllers/assignmentController.js';

const router = express.Router();

router.post('/run', authenticateToken, authorizeRole('organizer', 'admin'), runAllocation);
router.get('/', authenticateToken, getAssignments);
router.get('/history', authenticateToken, getAssignmentHistory);
router.get('/event/:eventId/recommendations', authenticateToken, authorizeRole('organizer', 'admin'), getEventRoleRecommendations);
router.post('/event/:eventId/smart-schedule', authenticateToken, authorizeRole('organizer', 'admin'), getSmartScheduleSuggestions);
router.post('/event/:eventId/auto-schedule', authenticateToken, authorizeRole('organizer', 'admin'), autoScheduleEvent);
router.post('/manual', authenticateToken, authorizeRole('organizer', 'admin'), createManualAssignment);
router.get('/:id/recommendations', authenticateToken, authorizeRole('organizer', 'admin'), getRecommendedVolunteers);
router.get('/:id', authenticateToken, getAssignmentById);
router.put('/:id/status', authenticateToken, updateAssignmentStatus);
router.put('/:id/replace', authenticateToken, authorizeRole('organizer', 'admin'), replaceVolunteer);
router.post('/:id/reassign-next', authenticateToken, authorizeRole('organizer', 'admin'), removeVolunteerFromAssignment);
router.post('/event/:eventId/confirm', authenticateToken, authorizeRole('organizer', 'admin'), confirmEventAllocations);
router.get('/event/:eventId/export-pdf', authenticateToken, authorizeRole('organizer', 'admin'), exportEventAllocationsPdf);

export default router;
