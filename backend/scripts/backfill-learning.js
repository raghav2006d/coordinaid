import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runLearningBackfill } from '../utils/learningBackfill.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer-system';

const run = async () => {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  await runLearningBackfill();

  await mongoose.disconnect();
  console.log('Backfill complete.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
