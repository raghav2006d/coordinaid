import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getLeaderboard } from '../controllers/leaderboardController.js';

const router = express.Router();

router.get('/', authenticateToken, getLeaderboard);

export default router;
