import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getCoordinatorSuggestions,
  queryCoordinatorAssistant,
} from '../controllers/assistantController.js';

const router = express.Router();

router.post('/query', authenticateToken, queryCoordinatorAssistant);
router.post('/suggestions', authenticateToken, getCoordinatorSuggestions);

export default router;
