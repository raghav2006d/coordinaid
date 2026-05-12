import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import OrganizerTeamManager from '../components/OrganizerTeamManager.jsx';
import { assignmentAPI, eventAPI } from '../utils/api.js';

const statusStyles = {
  completed: 'badge-success',
  allocated: 'badge-primary',
  planning: 'badge-warning',
  'allocation-in-progress': 'badge-warning',
};

const OrganizerDashboard = () => {
  const [events, setEvents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [eventsRes, assignRes, historyRes] = await Promise.all([
        eventAPI.getEvents(),
        assignmentAPI.getAssignments(),
        assignmentAPI.getAssignmentHistory({ limit: 8 }),
      ]);

      setEvents(eventsRes.data.events || []);
      const rawAssignments = assignRes.data.assignments || [];
      const uniqueMap = new Map();
      rawAssignments
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .forEach((assignment) => {
          const key = `${assignment.eventId?._id || assignment.eventId}-${assignment.roleId?._id || assignment.roleId}-${assignment.volunteerId?._id || assignment.volunteerId}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, assignment);
          }
        });
      setAssignments(Array.from(uniqueMap.values()));
      setHistoryEntries(historyRes.data.history || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeEvents = events.filter((event) => event.status !== 'completed').length;
  const acceptedAssignments = assignments.filter((assignment) => assignment.status === 'accepted').length;
  const pendingAssignments = assignments.filter((assignment) => assignment.status === 'pending').length;
  const averageMatchScore = assignments.length
    ? Math.round(
        assignments.reduce(
          (sum, assignment) => sum + (assignment.matchScore?.totalScore || 0),
          0
        ) / assignments.length
      )
    : 0;

  const upcomingEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4),
    [events]
  );

  const strongestAssignments = useMemo(
    () =>
      [...assignments]
        .sort((a, b) => (b.matchScore?.totalScore || 0) - (a.matchScore?.totalScore || 0))
        .slice(0, 5),
    [assignments]
  );

  const recentHistory = useMemo(
    () =>
      [...historyEntries]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 6),
    [historyEntries]
  );

  const formatHistoryText = (entry) => {
    if (!entry) return 'Update recorded';
    const fromStatus = entry.fromStatus ? `${entry.fromStatus}` : '';
    const toStatus = entry.toStatus ? `${entry.toStatus}` : '';
    const previousName = entry.previousVolunteerId?.name;
    const newName = entry.newVolunteerId?.name;

    switch (entry.action) {
      case 'created':
        return 'AI assigned (pending)';
      case 'manual-assigned':
        return 'Manual assignment (pending)';
      case 'status-changed':
        return `Status: ${fromStatus || 'unknown'} -> ${toStatus || 'updated'}`;
      case 'volunteer-replaced':
      case 'reassigned-next':
      case 'auto-reassigned':
        if (previousName && newName) {
          return `Reassigned: ${previousName} -> ${newName}`;
        }
        return 'Volunteer reassigned';
      default:
        return 'Assignment updated';
    }
  };

  const resolveActorLabel = (entry) => {
    if (!entry) return '';
    if (entry.actorId?.name) {
      return entry.actorId.role
        ? `${entry.actorId.name} (${entry.actorId.role})`
        : entry.actorId.name;
    }
    return entry.actorRole || '';
  };

  const stats = [
    {
      title: 'Active Events',
      value: activeEvents,
      note: 'Live planning and execution workload',
      icon: Calendar,
      tint: 'bg-[#e4dcff] text-[#5b3cc4]',
    },
    {
      title: 'Assigned Volunteers',
      value: assignments.length,
      note: 'All volunteer placements across events',
      icon: Users,
      tint: 'bg-[#dcf8ee] text-[#0f9f75]',
    },
    {
      title: 'Accepted',
      value: acceptedAssignments,
      note: 'Confirmed volunteers ready to show up',
      icon: CheckCircle2,
      tint: 'bg-[rgba(51,99,187,0.12)] text-[#4b46c8]',
    },
    {
      title: 'Avg Match',
      value: `${averageMatchScore}%`,
      note: 'Average AI confidence across assignments',
      icon: BrainCircuit,
      tint: 'bg-[rgba(214,164,55,0.18)] text-[#6b56cc]',
    },
  ];

  if (loading) {
    return (
      <div className="app-shell gradient-light flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4 h-14 w-14"></div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#766e97]">Loading organizer workspace</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="Organizer Mission Control"
            subtitle="Oversee events, monitor volunteer readiness, and run stronger allocations with better visibility into match quality."
            icon={<Sparkles size={28} />}
            showUserProfile={true}
          />

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]"
          >
            <div
              className="hero-image relative overflow-hidden rounded-[34px] gradient-primary px-7 py-8 text-white shadow-glow-lg"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1700&q=80')",
              }}
            >
              <div className="absolute right-[-18px] top-[-18px] h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-violet-100">Operations Layer</p>
                  <h2 className="text-3xl font-black leading-tight md:text-5xl">
                    Every event, role, and allocation in one cleaner view.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-violet-50 md:text-base">
                    Track planning status, spot weak matches faster, and move from event creation to allocation with less friction.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to="/events/create" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#5b3cc4] transition hover:bg-[#fff2e8]">
                    Create Event
                  </Link>
                  <Link to="/events" className="rounded-2xl bg-white/12 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                    Manage Events
                  </Link>
                  <Link to="/allocation" className="rounded-2xl bg-white/12 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                    Open AI Allocation
                  </Link>
                </div>
              </div>
            </div>

            <Card hoverable={false} className="shell-panel border-0 p-7">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Allocation Pulse</p>
                  <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Live readiness</h3>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#eef8f3] text-[#0f9f75]">
                  <BarChart3 size={22} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[22px] bg-[#f8f5ff] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#766e97]">Pending responses</p>
                  <p className="mt-2 text-3xl font-black text-[#1d1736]">{pendingAssignments}</p>
                </div>
                <div className="rounded-[22px] bg-[#eef8f3] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#6b8d80]">Average match confidence</p>
                  <p className="mt-2 text-3xl font-black text-[#1d1736]">{averageMatchScore}%</p>
                </div>
                <div className="rounded-[22px] bg-white/80 p-4">
                  <p className="text-sm leading-7 text-[#5f5a7a]">
                    The allocation engine now prioritizes volunteers whose skill sets and skill levels most closely satisfy role requirements before considering secondary factors.
                  </p>
                </div>
              </div>
            </Card>
          </motion.section>

          <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => {
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

          <section className="grid grid-cols-1 gap-8 xl:grid-cols-[1.12fr_0.88fr]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Event Queue</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Upcoming events</h3>
                  </div>
                  <Link
                    to="/events/create"
                    className="flex items-center gap-2 rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457]"
                  >
                    <Plus size={16} />
                    <span>New Event</span>
                  </Link>
                </div>

                <div className="space-y-4">
                  {upcomingEvents.length ? (
                    upcomingEvents.map((event) => (
                      <div key={event._id} className="rounded-[28px] border border-white/60 bg-white/82 p-5">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/80">
                              {event.eventLogo ? (
                                <img src={event.eventLogo} alt={`${event.eventName} logo`} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#766e97]">LOGO</div>
                              )}
                            </div>
                            <div>
                            <p className="text-lg font-bold text-[#1d1736]">{event.eventName}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#5f5a7a]">
                              <span className="flex items-center gap-2">
                                <Calendar size={15} />
                                {new Date(event.date).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-2">
                                <MapPin size={15} />
                                {event.venue}
                              </span>
                            </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${statusStyles[event.status] || 'badge-primary'}`}>{event.status}</span>
                            <Link
                              to={`/events/${event._id}/edit`}
                              className="rounded-2xl bg-[#1d1736] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2b2457]"
                            >
                              Edit
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-[22px] bg-[#f8f5ff] px-4 py-4 text-sm leading-7 text-[#5f5a7a]">
                          {event.description || 'No event summary added yet.'}
                        </div>
                        {(event.mottoText || event.mottoImage) && (
                          <div className="mt-3 rounded-[20px] bg-white/75 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#766e97]">Motto</p>
                            {event.mottoText && <p className="mt-1 text-sm font-medium text-[#403b63]">{event.mottoText}</p>}
                            {event.mottoImage && (
                              <img
                                src={event.mottoImage}
                                alt={`${event.eventName} motto`}
                                className="mt-2 h-20 w-full rounded-lg object-cover"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] bg-white/70 px-5 py-10 text-center text-[#5f5a7a]">
                      No events available yet.
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Strongest Matches</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Top assignment quality</h3>
                  </div>
                  <BrainCircuit size={22} className="text-[#5b3cc4]" />
                </div>

                <div className="space-y-4">
                  {strongestAssignments.length ? (
                    strongestAssignments.map((assignment) => (
                      <div key={assignment._id} className="rounded-[24px] bg-white/82 p-4">
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <div>
                            <p className="font-bold text-[#1d1736]">{assignment.volunteerId?.name}</p>
                            <p className="text-sm text-[#5f5a7a]">{assignment.roleId?.roleName}</p>
                            <p className="text-xs text-[#766e97]">{assignment.eventId?.eventName}</p>
                          </div>
                          <span className="badge badge-success">{assignment.matchScore?.totalScore || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-[#5f5a7a]">
                          <span>Skill fit {assignment.matchScore?.skillMatch || 0}%</span>
                          <span>Perf {assignment.matchScore?.performanceMatch || 0}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] bg-white/70 px-5 py-8 text-center text-[#5f5a7a]">
                      Run allocations to see match quality insights here.
                    </div>
                  )}
                </div>
              </Card>

              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Assignment History</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Recent volunteer activity</h3>
                  </div>
                  <Calendar size={22} className="text-[#0f9f75]" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200">
                      <tr className="text-xs uppercase tracking-wide text-[#766e97]">
                        <th className="px-3 py-3">Volunteer</th>
                        <th className="px-3 py-3">Event</th>
                        <th className="px-3 py-3">Role</th>
                        <th className="px-3 py-3">History</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentHistory.map((entry) => (
                        <tr key={entry._id} className="hover:bg-[#f8f5ff]">
                          <td className="px-3 py-3 font-semibold text-[#1d1736]">
                            {entry.volunteerId?.name || entry.newVolunteerId?.name || 'Volunteer'}
                          </td>
                          <td className="px-3 py-3 text-[#5f5a7a]">
                            {entry.eventId?.eventName || 'Event'}
                          </td>
                          <td className="px-3 py-3 text-[#5f5a7a]">
                            {entry.roleId?.roleName || 'Role'}
                          </td>
                          <td className="px-3 py-3 text-[#5f5a7a]">
                            {formatHistoryText(entry)}
                            {entry.createdAt && (
                              <span className="ml-2 text-xs text-[#766e97]">
                                ({new Date(entry.createdAt).toLocaleDateString()})
                              </span>
                            )}
                            {resolveActorLabel(entry) && (
                              <span className="ml-2 text-xs font-semibold text-[#403b63]">
                                {resolveActorLabel(entry)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!recentHistory.length && (
                        <tr>
                          <td colSpan="4" className="px-3 py-6 text-center text-[#5f5a7a]">
                            No assignment history yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card hoverable={false} className="shell-panel border-0 p-7">
                <OrganizerTeamManager events={events} />
              </Card>

              <Card hoverable={false} className="shell-panel border-0 p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#766e97]">Quick Actions</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#1d1736]">Move faster</h3>
                  </div>
                  <ArrowRight size={22} className="text-[#0f9f75]" />
                </div>

                <div className="space-y-3">
                  <Link to="/events/create" className="flex items-center justify-between rounded-[22px] bg-[#f1ecff] px-4 py-4 text-sm font-semibold text-[#5b3cc4] transition hover:bg-[#ece4ff]">
                    <span>Create new event</span>
                    <Plus size={16} />
                  </Link>
                  <Link to="/allocation" className="flex items-center justify-between rounded-[22px] bg-[#eef8f3] px-4 py-4 text-sm font-semibold text-[#0f9f75] transition hover:bg-[#dff3ea]">
                    <span>Run AI allocation</span>
                    <BrainCircuit size={16} />
                  </Link>
                  <Link to="/attendance" className="flex items-center justify-between rounded-[22px] bg-white px-4 py-4 text-sm font-semibold text-[#403b63] transition hover:bg-[#f8f5ff]">
                    <span>Mark attendance</span>
                    <Clock3 size={16} />
                  </Link>
                  <Link to="/assignments/history" className="flex items-center justify-between rounded-[22px] bg-[#f2f6ff] px-4 py-4 text-sm font-semibold text-[#4b46c8] transition hover:bg-[#e6eeff]">
                    <span>View assignment history</span>
                    <Calendar size={16} />
                  </Link>
                  <Link to="/analytics" className="flex items-center justify-between rounded-[22px] bg-[#f4f0ff] px-4 py-4 text-sm font-semibold text-[#6a4ad2] transition hover:bg-[#e9e1ff]">
                    <span>View analytics</span>
                    <BarChart3 size={16} />
                  </Link>
                </div>
              </Card>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;
