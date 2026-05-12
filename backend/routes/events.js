import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  addRoleToEvent,
  updateRoleInEvent,
  deleteRoleFromEvent,
  generateAiEventPlan,
  uploadEventLogo,
  uploadMottoImage,
} from '../controllers/eventController.js';
import { eventLogoUpload, eventMottoImageUpload } from '../middleware/upload.js';

const router = express.Router();

router.get('/', authenticateToken, getEvents);
router.post('/', authenticateToken, authorizeRole('organizer', 'admin'), createEvent);
router.post(
  '/upload/logo',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  eventLogoUpload,
  uploadEventLogo
);
router.post(
  '/upload/motto-image',
  authenticateToken,
  authorizeRole('organizer', 'admin'),
  eventMottoImageUpload,
  uploadMottoImage
);
router.post('/ai/plan', authenticateToken, authorizeRole('organizer', 'admin'), generateAiEventPlan);
router.get('/:id', authenticateToken, getEventById);
router.put('/:id', authenticateToken, authorizeRole('organizer', 'admin'), updateEvent);
router.delete('/:id', authenticateToken, authorizeRole('organizer', 'admin'), deleteEvent);

router.post('/:id/roles', authenticateToken, authorizeRole('organizer', 'admin'), addRoleToEvent);
router.put('/:eventId/roles/:roleId', authenticateToken, authorizeRole('organizer', 'admin'), updateRoleInEvent);
router.delete('/:eventId/roles/:roleId', authenticateToken, authorizeRole('organizer', 'admin'), deleteRoleFromEvent);

export default router;
