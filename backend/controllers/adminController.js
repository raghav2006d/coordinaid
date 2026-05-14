import { runLearningBackfill } from '../utils/learningBackfill.js';
import { runAssignmentHistoryBackfill } from '../utils/historyBackfill.js';
import Team from '../models/Team.js';
import TeamMessage from '../models/TeamMessage.js';

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

export const getTeamInsights = async (req, res) => {
  try {
    const teams = await Team.find({})
      .populate('organizerId', 'name email')
      .populate('members.volunteerId', 'name email')
      .sort({ createdAt: -1 });

    const now = new Date();
    const activeThresholdDays = 14;
    const activeThresholdDate = new Date(now.getTime() - activeThresholdDays * 24 * 60 * 60 * 1000);

    const teamIds = teams.map((team) => team._id);
    const messageCounts = await TeamMessage.aggregate([
      { $match: { teamId: { $in: teamIds } } },
      { $group: { _id: '$teamId', count: { $sum: 1 } } },
    ]);
    const messageCountMap = new Map(messageCounts.map((entry) => [String(entry._id), entry.count]));

    const enrichedTeams = teams.map((teamDoc) => {
      const team = typeof teamDoc.toObject === 'function' ? teamDoc.toObject() : { ...teamDoc };
      const lastActivityAt = team.lastActivityAt || team.updatedAt || team.createdAt;
      const isWorking =
        team.isActive && lastActivityAt && new Date(lastActivityAt) >= activeThresholdDate;

      return {
        ...team,
        memberCount: team.members?.length || 0,
        messageCount: messageCountMap.get(String(team._id)) || 0,
        statusLabel: team.isActive ? (isWorking ? 'active' : 'inactive') : 'registered',
      };
    });

    const registeredTeams = enrichedTeams.length;
    const activeTeams = enrichedTeams.filter((team) => team.statusLabel === 'active').length;
    const inactiveTeams = enrichedTeams.filter((team) => team.statusLabel === 'inactive').length;

    res.json({
      summary: {
        registeredTeams,
        activeTeams,
        inactiveTeams,
      },
      teams: enrichedTeams,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch team insights.' });
  }
};
