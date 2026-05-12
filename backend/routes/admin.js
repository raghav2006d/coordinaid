import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { backfillLearningMetrics, backfillAssignmentHistory } from '../controllers/adminController.js';

const router = express.Router();

router.post('/backfill-learning', authenticateToken, authorizeRole('admin'), backfillLearningMetrics);
router.post('/backfill-history', authenticateToken, authorizeRole('admin'), backfillAssignmentHistory);

export default router;
