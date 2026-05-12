import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, TrendingUp, Users } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import { assignmentAPI, attendanceAPI, eventAPI, leaderboardAPI } from '../utils/api.js';

const AnalyticsPage = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentUserCard, setCurrentUserCard] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stats, setStats] = useState({ totalAssignments: 0, acceptanceRate: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(events.map((event) => event.category).filter(Boolean))),
    [events]
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leaderboardRes, assignmentRes, eventRes] = await Promise.all([
        leaderboardAPI.getLeaderboard({
          timeRange,
          eventCategory: selectedCategory || undefined,
          department: selectedDepartment || undefined,
          skill: selectedSkill || undefined,
        }),
        assignmentAPI.getAssignments({ limit: 100 }),
        eventAPI.getEvents({ limit: 200 }),
      ]);

      const assignments = assignmentRes.data.assignments || [];
      const totalAssignments = assignmentRes.data.total || assignments.length || 0;
      const acceptedCount = assignments.filter((assignment) => assignment.status === 'accepted')
        .length;

      setLeaderboardData(leaderboardRes.data.leaderboard || []);
      setCurrentUserCard(leaderboardRes.data.currentUser || null);
      setEvents(eventRes.data.events || []);
      setStats({
        totalAssignments,
        acceptanceRate: totalAssignments ? Math.round((acceptedCount / totalAssignments) * 100) : 0,
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportLeaderboard = async () => {
    try {
      setExporting(true);
      const response = await attendanceAPI.exportLeaderboardCsv();
      downloadBlob(response.data, 'leaderboard.csv');
    } catch (error) {
      console.error('Failed to export leaderboard:', error);
      alert('Failed to export leaderboard');
    } finally {
      setExporting(false);
    }
  };

  const handleExportLeaderboardPdf = async () => {
    try {
      setExporting(true);
      const response = await attendanceAPI.exportLeaderboardPdf();
      downloadBlob(response.data, 'leaderboard.pdf');
    } catch (error) {
      console.error('Failed to export leaderboard PDF:', error);
      alert('Failed to export leaderboard PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportAssignments = async () => {
    try {
      setExporting(true);
      const response = await attendanceAPI.exportAssignmentsCsv(
        selectedEventId ? { eventId: selectedEventId } : {}
      );
      downloadBlob(response.data, 'assignments.csv');
    } catch (error) {
      console.error('Failed to export assignments:', error);
      alert('Failed to export assignments');
    } finally {
      setExporting(false);
    }
  };

  const handleExportAssignmentsPdf = async () => {
    try {
      setExporting(true);
      const response = await attendanceAPI.exportAssignmentsPdf(
        selectedEventId ? { eventId: selectedEventId } : {}
      );
      downloadBlob(response.data, 'assignments.pdf');
    } catch (error) {
      console.error('Failed to export assignments PDF:', error);
      alert('Failed to export assignments PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell gradient-light flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-[#6a5d54]">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  const topThree = leaderboardData.slice(0, 3);

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="Volunteer Leaderboard"
            subtitle="Recognize reliability, attendance, and contribution across every event."
            icon={<Trophy size={28} />}
            showUserProfile={true}
          />

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                icon: <Users className="text-[#2f7d6a]" size={28} />,
                label: 'Total assignments',
                value: stats.totalAssignments,
              },
              {
                icon: <TrendingUp className="text-[#8a4224]" size={28} />,
                label: 'Acceptance rate',
                value: `${stats.acceptanceRate}%`,
              },
              {
                icon: <Sparkles className="text-[#1f1a17]" size={28} />,
                label: 'Volunteers ranked',
                value: leaderboardData.length,
              },
            ].map((stat) => (
              <Card key={stat.label} hoverable={false} className="shell-panel border-0 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#6a5d54]">{stat.label}</p>
                    <p className="mt-2 text-2xl font-bold text-[#1f1a17]">{stat.value}</p>
                  </div>
                  {stat.icon}
                </div>
              </Card>
            ))}
          </div>

          <Card hoverable={false} className="shell-panel border-0 p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#1f1a17]">Filters</h3>
                <p className="text-sm text-[#6a5d54]">Narrow by time range, category, and skill focus.</p>
              </div>
              <button
                onClick={fetchData}
                className="rounded-2xl bg-[#1f1a17] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#362822]"
              >
                Apply filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
                className="input-field"
              >
                <option value="all">All time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="semester">Semester</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="input-field"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="input-field"
                placeholder="Department"
              />
              <input
                type="text"
                value={selectedSkill}
                onChange={(event) => setSelectedSkill(event.target.value)}
                className="input-field"
                placeholder="Skill area"
              />
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_0.9fr]">
            <Card hoverable={false} className="shell-panel border-0 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#1f1a17]">Leaderboard</h3>
                  <p className="text-sm text-[#6a5d54]">Sorted by leaderboard score.</p>
                </div>
              </div>

              <div className="space-y-4">
                {leaderboardData.map((volunteer) => (
                  <div
                    key={volunteer.userId}
                    className="rounded-[24px] border border-white/60 bg-white/90 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="badge badge-primary">#{volunteer.rank}</span>
                          <p className="text-lg font-bold text-[#1f1a17]">{volunteer.name}</p>
                        </div>
                        <p className="text-sm text-[#6a5d54]">{volunteer.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#2f7d6a]">
                          {volunteer.leaderboardScore}
                        </p>
                        <p className="text-xs text-[#6a5d54]">Leaderboard score</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#6a5d54]">
                      <span>Attendance {volunteer.attendanceRate}%</span>
                      <span>Acceptance {volunteer.acceptanceRate}%</span>
                      <span>Skill diversity {volunteer.skillDiversity}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(volunteer.badges || []).map((badge) => (
                        <span key={`${volunteer.userId}-${badge}`} className="badge badge-primary">
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {!leaderboardData.length && (
                  <p className="text-sm text-[#6a5d54]">No leaderboard entries yet.</p>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card hoverable={false} className="shell-panel border-0 p-6">
                <h3 className="mb-3 text-xl font-bold text-[#1f1a17]">Top contributors</h3>
                <div className="space-y-3">
                  {topThree.map((volunteer, index) => (
                    <div key={volunteer.userId} className="rounded-[20px] bg-[#fff4ea] p-4">
                      <p className="text-xs font-semibold text-[#8a4224]">
                        {index === 0 ? 'Gold' : index === 1 ? 'Silver' : 'Bronze'} badge
                      </p>
                      <p className="text-lg font-bold text-[#1f1a17]">{volunteer.name}</p>
                      <p className="text-sm text-[#6a5d54]">Score {volunteer.leaderboardScore}</p>
                    </div>
                  ))}
                  {!topThree.length && (
                    <p className="text-sm text-[#6a5d54]">No top contributors yet.</p>
                  )}
                </div>
              </Card>

              <Card hoverable={false} className="shell-panel border-0 p-6">
                <h3 className="mb-2 text-xl font-bold text-[#1f1a17]">Your rank</h3>
                {currentUserCard ? (
                  <>
                    <p className="text-sm text-[#6a5d54]">Rank #{currentUserCard.rank}</p>
                    <p className="mt-2 text-2xl font-bold text-[#2f7d6a]">
                      {currentUserCard.leaderboardScore}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(currentUserCard.badges || []).map((badge) => (
                        <span key={badge} className="badge badge-primary">
                          {badge}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-sm text-[#6a5d54]">
                      Tips: {currentUserCard.tips?.join(', ')}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#6a5d54]">No personal ranking data yet.</p>
                )}
              </Card>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportLeaderboard}
              className="btn-primary"
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Download Leaderboard CSV'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportLeaderboardPdf}
              className="btn-secondary"
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Download Leaderboard PDF'}
            </motion.button>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="input-field max-w-md"
            >
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.eventName}
                </option>
              ))}
            </select>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportAssignments}
              className="btn-secondary"
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Download Assignments CSV'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportAssignmentsPdf}
              className="btn-primary"
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Download Assignments PDF'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
