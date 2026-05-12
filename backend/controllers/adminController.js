import { runLearningBackfill } from '../utils/learningBackfill.js';
import { runAssignmentHistoryBackfill } from '../utils/historyBackfill.js';

export const backfillLearningMetrics = async (req, res) => {
  try {
    await runLearningBackfill();
    res.json({ message: 'Backfill completed successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Backfill failed.' });
  }
};

export const backfillAssignmentHistory = async (req, res) => {
  try {
    const result = await runAssignmentHistoryBackfill();
    res.json({
      message: 'Assignment history backfill completed.',
      ...result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Assignment history backfill failed.' });
  }
};
