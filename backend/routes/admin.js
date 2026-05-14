import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  backfillLearningMetrics,
  backfillAssignmentHistory,
  getTeamInsights,
} from '../controllers/adminController.js';

const router = express.Router();

router.post('/backfill-learning', authenticateToken, authorizeRole('admin'), backfillLearningMetrics);
router.post('/backfill-history', authenticateToken, authorizeRole('admin'), backfillAssignmentHistory);
router.get('/teams/insights', authenticateToken, authorizeRole('admin'), getTeamInsights);

export default router;
