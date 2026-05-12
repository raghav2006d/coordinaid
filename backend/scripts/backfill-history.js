import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runAssignmentHistoryBackfill } from '../utils/historyBackfill.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer-system';

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    const result = await runAssignmentHistoryBackfill();
    console.log(`History backfill complete: ${result.createdCount} created out of ${result.total}`);
  } catch (error) {
    console.error('History backfill failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

run();
