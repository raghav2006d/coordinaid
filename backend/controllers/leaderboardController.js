import Event from '../models/Event.js';
import User from '../models/User.js';
import { computeVolunteerMetrics, getBadges, getImprovementTips } from '../utils/leaderboardService.js';

const getSinceDate = (timeRange) => {
  const now = new Date();
  if (timeRange === 'weekly') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (timeRange === 'monthly') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (timeRange === 'semester') return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  return null;
};

export const getLeaderboard = async (req, res) => {
  try {
    const { timeRange = 'all', eventCategory, skill, department } = req.query;
    const sinceDate = getSinceDate(timeRange);

    let eventIds = null;
    if (eventCategory) {
      const events = await Event.find({ category: eventCategory }).select('_id');
      eventIds = events.map((event) => event._id);
    }

    const users = await User.find({
      role: 'volunteer',
      ...(department ? { department } : {}),
      ...(skill ? { skills: { $elemMatch: { name: skill } } } : {}),
    }).select('name email department profileImage skills performanceScore totalParticipations');

    const leaderboard = [];

    for (const user of users) {
      const metrics = await computeVolunteerMetrics({
        volunteerId: user._id,
        eventIds,
        sinceDate,
        participationCount: user.totalParticipations || 0,
        performanceScore: user.performanceScore || 0,
        skillDiversity: user.skills?.length || 0,
      });

      const badges = getBadges(metrics);

      leaderboard.push({
        userId: user._id,
        name: user.name,
        email: user.email,
        department: user.department || '',
        profileImage: user.profileImage || '',
        skills: user.skills || [],
        badges,
        ...metrics,
      });
    }

    leaderboard.sort((a, b) => b.leaderboardScore - a.leaderboardScore);

    const ranked = leaderboard.map((entry, index) => ({
      rank: index + 1,
      ...entry,
      topContributor: index < 3,
    }));

    const currentUserEntry = ranked.find((entry) => entry.userId.toString() === req.user.userId);

    res.json({
      total: ranked.length,
      leaderboard: ranked,
      currentUser: currentUserEntry
        ? {
            rank: currentUserEntry.rank,
            leaderboardScore: currentUserEntry.leaderboardScore,
            badges: currentUserEntry.badges,
            tips: getImprovementTips(currentUserEntry),
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load leaderboard' });
  }
};
