import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Database,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import apiClient, { assignmentAPI, eventAPI, userAPI } from '../utils/api.js';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningBackfill, setRunningBackfill] = useState(false);
  const [runningHistoryBackfill, setRunningHistoryBackfill] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, eventsRes, assignRes] = await Promise.all([
        userAPI.getAllUsers({ limit: 200 }),
        eventAPI.getEvents({ limit: 200 }),
        assignmentAPI.getAssignments({ limit: 200 }),
      ]);

      const users = usersRes.data.users || [];
      setUsers(users);
      const events = eventsRes.data.events || [];
      const assignments = assignRes.data.assignments || [];
      const volunteerCount = users.filter((user) => user.role === 'volunteer').length;
      const acceptedAssignments = assignments.filter((assignment) => assignment.status === 'accepted').length;
      const totalAssignments = assignments.length;
      const averageMatchScore = totalAssignments
        ? Math.round(
            assignments.reduce(
              (sum, assignment) => sum + (assignment.matchScore?.totalScore || 0),
              0
            ) / totalAssignments
          )
        : 0;

      setStats({
        totalUsers: usersRes.data.total || users.length,
        totalEvents: eventsRes.data.total || events.length,
        totalAssignments: assignRes.data.total || totalAssignments,
        volunteerCount,
        acceptedAssignments,
        averageMatchScore,
        liveEvents: events.filter((event) => event.status !== 'completed').length,
        completionRate: totalAssignments ? Math.round((acceptedAssignments / totalAssignments) * 100) : 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = filterRole === 'all' ? true : user.role === filterRole;
      const matchesSearch =
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [users, filterRole, searchTerm]);

  const handleUserChange = (userId, field, value) => {
    setUsers((prev) =>
      prev.map((user) => (user._id === userId ? { ...user, [field]: value } : user))
    );
  };

  const handleSaveUser = async (userId) => {
    try {
      setUpdatingUserId(userId);
      const user = users.find((item) => item._id === userId);
      const response = await userAPI.updateUserById(userId, {
        name: user.name,
        role: user.role,
        department: user.department,
        contactNumber: user.contactNumber,
        isActive: user.isActive,
      });
      setUsers((prev) =>
        prev.map((item) => (item._id === userId ? response.data.user : item))
      );
    } catch (error) {
      console.error('Failed to update user:', error);
      alert(error.response?.data?.message || 'Failed to update user');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingUserId(userId);
      await userAPI.deleteUserById(userId);
      setUsers((prev) => prev.filter((user) => user._id !== userId));
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleBackfill = async () => {
    if (!window.confirm('Run adaptive learning backfill now?')) {
      return;
    }

    try {
      setRunningBackfill(true);
      setBackfillMessage('');
      await apiClient.post('/admin/backfill-learning');
      setBackfillMessage('Backfill completed. Learning metrics updated.');
    } catch (error) {
      setBackfillMessage(error.response?.data?.message || 'Backfill failed.');
    } finally {
      setRunningBackfill(false);
    }
  };

  const handleHistoryBackfill = async () => {
    if (!window.confirm('Run assignment history backfill now?')) {
      return;
    }

    try {
      setRunningHistoryBackfill(true);
      setBackfillMessage('');
      const response = await apiClient.post('/admin/backfill-history');
      setBackfillMessage(
        response.data?.message ||
          `History backfill complete (${response.data?.createdCount || 0}).`
      );
    } catch (error) {
      setBackfillMessage(error.response?.data?.message || 'History backfill failed.');
    } finally {
      setRunningHistoryBackfill(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell gradient-light flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4 h-14 w-14"></div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#766e97]">Loading admin workspace</p>
          </div>
        </div>
      </div>
    );
  }

  const dashboardStats = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      note: 'Everyone currently on the platform',
      icon: Users,
      tint: 'bg-[#e4dcff] text-[#5b3cc4]',
    },
    {
      title: 'Live Events',
      value: stats?.liveEvents || 0,
      note: 'Events still active in planning or delivery',
      icon: Calendar,
      tint: 'bg-[#dcf8ee] text-[#0f9f75]',
    },
    {
      title: 'Allocations',
      value: stats?.totalAssignments || 0,
      note: 'Assignments generated across the system',
      icon: Workflow,
      tint: 'bg-[rgba(51,99,187,0.12)] text-[#4b46c8]',
    },
    {
      title: 'Avg Match',
      value: `${stats?.averageMatchScore || 0}%`,
      note: 'Average confidence from the allocation engine',
      icon: BrainCircuit,
      tint: 'bg-[rgba(214,164,55,0.18)] text-[#6b56cc]',
    },
  ];

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="System Oversight Console"
            subtitle="Monitor platform growth, allocation quality, and operational health from a cleaner admin command center."
            icon={<ShieldCheck size={28} />}
            showUserProfile={true}
          />

          {backfillMessage && (
            <div className="mb-6 rounded-2xl bg-[#eef8f3] px-4 py-3 text-sm font-medium text-[#0f9f75]">
              {backfillMessage}
            </div>
          )}

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]"
          >
            <div
              className="hero-image relative overflow-hidden rounded-[34px] gradient-primary px-7 py-8 text-white shadow-glow-lg"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1700&q=80')",
              }}
            >
              <div className="absolute right-[-20px] top-[-22px] h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-violet-100">Admin Signal</p>
                <h2 className="max-w-3xl text-3xl font-black leading-tight md:text-5xl">
                  Platform health, AI match quality, and operational volume in one view.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-violet-50 md:text-base">
                  This dashboard now reflects the improved allocation engine, so you can monitor whether skill-driven matching is producing stronger volunteer-role fit across the system.
                </p>
              </div>
            </div>

            <Card hoverable={false} className="shell-panel border-0 p-7">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">System Snapshot</p>
                  <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Operational health</h3>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#fff1e6] text-[#5b3cc4]">
                  <Activity size={22} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[22px] bg-[#f8f5ff] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#766e97]">Volunteers</p>
                  <p className="mt-2 text-3xl font-black text-[#1d1736]">{stats?.volunteerCount || 0}</p>
                </div>
                <div className="rounded-[22px] bg-[#eef8f3] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#6b8d80]">Acceptance</p>
                  <p className="mt-2 text-3xl font-black text-[#1d1736]">{stats?.completionRate || 0}%</p>
                </div>
              </div>
            </Card>
          </motion.section>

          <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((stat, index) => {
              const Icon = stat.icon;

              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Card hoverable={false} className="shell-panel border-0 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#5f5a7a]">{stat.title}</p>
                        <p className="mt-3 text-4xl font-black text-[#1d1736]">{stat.value}</p>
                        <p className="mt-3 text-sm leading-6 text-[#726c90]">{stat.note}</p>
                      </div>
                      <div className={`flex h-14 w-14 items-center justify-center rounded-[22px] ${stat.tint}`}>
                        <Icon size={22} />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-8 xl:grid-cols-[1.08fr_0.92fr]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Core Services</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">System status</h3>
                  </div>
                  <Server size={22} className="text-[#0f9f75]" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-[24px] bg-white/82 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef8f3] text-[#0f9f75]">
                        <Server size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1d1736]">API Server</p>
                        <p className="text-sm text-[#5f5a7a]">Request handling and auth routing</p>
                      </div>
                    </div>
                    <span className="badge badge-success">Active</span>
                  </div>

                  <div className="flex items-center justify-between rounded-[24px] bg-white/82 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1ecff] text-[#5b3cc4]">
                        <Database size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1d1736]">Database</p>
                        <p className="text-sm text-[#5f5a7a]">Profiles, events, attendance, and assignments</p>
                      </div>
                    </div>
                    <span className="badge badge-success">Connected</span>
                  </div>

                  <div className="flex items-center justify-between rounded-[24px] bg-white/82 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4f0ff] text-[#6a4ad2]">
                        <BrainCircuit size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1d1736]">Allocation Engine</p>
                        <p className="text-sm text-[#5f5a7a]">Skill-priority ranking with smarter reallocation</p>
                      </div>
                    </div>
                    <span className="badge badge-success">Operational</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Admin Insights</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">What changed</h3>
                  </div>
                  <Sparkles size={22} className="text-[#5b3cc4]" />
                </div>

                <div className="space-y-3 text-sm leading-7 text-[#5f5a7a]">
                  <div className="rounded-[22px] bg-[#f8f5ff] px-4 py-4">
                    Skill coverage now has the highest weight in volunteer-role matching, so volunteers with the right required skills are ranked first.
                  </div>
                  <div className="rounded-[22px] bg-[#eef8f3] px-4 py-4">
                    Skill level fit is now evaluated against each role’s minimum level instead of relying on a lighter bonus-only signal.
                  </div>
                  <div className="rounded-[22px] bg-white px-4 py-4">
                    Declined assignments now reallocate using the same ranking logic rather than assigning the next available volunteer arbitrarily.
                  </div>
                </div>
              </Card>

              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Executive Summary</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Platform quality</h3>
                  </div>
                  <CheckCircle2 size={22} className="text-[#0f9f75]" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-[22px] bg-[#f1ecff] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#766e97]">Accepted Assignments</p>
                    <p className="mt-2 text-3xl font-black text-[#1d1736]">{stats?.acceptedAssignments || 0}</p>
                  </div>
                  <div className="rounded-[22px] bg-[#eef8f3] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#6b8d80]">Total Events</p>
                    <p className="mt-2 text-3xl font-black text-[#1d1736]">{stats?.totalEvents || 0}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </section>

          <motion.section
            id="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
          >
            <Card hoverable={false} className="shell-panel border-0 p-7">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">User Management</p>
                  <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Manage platform users</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name or email"
                    className="input-field min-w-[220px]"
                  />
                  <select
                    value={filterRole}
                    onChange={(event) => setFilterRole(event.target.value)}
                    className="input-field"
                  >
                    <option value="all">All roles</option>
                    <option value="volunteer">Volunteer</option>
                    <option value="organizer">Organizer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleBackfill}
                    disabled={runningBackfill}
                    className="rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {runningBackfill ? 'Running backfill...' : 'Run Learning Backfill'}
                  </button>
                  <button
                    type="button"
                    onClick={handleHistoryBackfill}
                    disabled={runningHistoryBackfill}
                    className="rounded-2xl bg-[#4b46c8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f3f86] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {runningHistoryBackfill ? 'Running history backfill...' : 'Run History Backfill'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200">
                    <tr className="text-xs uppercase tracking-wide text-[#766e97]">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-[#f8f5ff]">
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={user.name}
                            onChange={(event) =>
                              handleUserChange(user._id, 'name', event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-200 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-3 text-[#5f5a7a]">{user.email}</td>
                        <td className="px-3 py-3">
                          <select
                            value={user.role}
                            onChange={(event) =>
                              handleUserChange(user._id, 'role', event.target.value)
                            }
                            className="rounded-lg border border-gray-200 px-2 py-1"
                          >
                            <option value="volunteer">Volunteer</option>
                            <option value="organizer">Organizer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={user.department || ''}
                            onChange={(event) =>
                              handleUserChange(user._id, 'department', event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-200 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.isActive ? 'active' : 'inactive'}
                            onChange={(event) =>
                              handleUserChange(user._id, 'isActive', event.target.value === 'active')
                            }
                            className="rounded-lg border border-gray-200 px-2 py-1"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSaveUser(user._id)}
                              disabled={updatingUserId === user._id}
                              className="rounded-lg bg-[#1d1736] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {updatingUserId === user._id ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              disabled={deletingUserId === user._id}
                              className="rounded-lg bg-[#7f2ea8] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {deletingUserId === user._id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-3 py-6 text-center text-[#5f5a7a]">
                          No users found for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.section>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
