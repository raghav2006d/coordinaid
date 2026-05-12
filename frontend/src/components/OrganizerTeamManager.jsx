import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Copy,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { teamAPI } from '../utils/api.js';

const OrganizerTeamManager = ({ events = [] }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [feedback, setFeedback] = useState({ type: 'idle', message: '' });
  const [workingKey, setWorkingKey] = useState('');
  const [selectedEventByTeam, setSelectedEventByTeam] = useState({});
  const [reportsByTeam, setReportsByTeam] = useState({});
  const [allocationByTeam, setAllocationByTeam] = useState({});

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)),
    [events]
  );

  const loadTeams = async () => {
    try {
      const response = await teamAPI.getTeams();
      setTeams(response.data.teams || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      setFeedback({ type: 'error', message: 'Could not load teams right now.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const upsertTeam = (updatedTeam) => {
    setTeams((current) => {
      const exists = current.some((team) => team._id === updatedTeam._id);
      if (exists) {
        return current.map((team) => (team._id === updatedTeam._id ? updatedTeam : team));
      }
      return [updatedTeam, ...current];
    });
  };

  const handleCreateTeam = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFeedback({ type: 'error', message: 'Team name is required.' });
      return;
    }

    try {
      setSubmitting(true);
      const response = await teamAPI.createTeam({
        name: form.name,
        description: form.description,
      });
      upsertTeam(response.data.team);
      setForm({ name: '', description: '' });
      setFeedback({ type: 'success', message: 'Team created. Share join code with volunteers.' });
    } catch (error) {
      console.error('Failed to create team:', error);
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Could not create the team.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async (joinCode) => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setFeedback({ type: 'success', message: `Join code ${joinCode} copied.` });
    } catch (error) {
      setFeedback({ type: 'error', message: 'Could not copy join code.' });
    }
  };

  const withTeamUpdate = async (key, action) => {
    try {
      setWorkingKey(key);
      const response = await action();
      if (response.data?.team) {
        upsertTeam(response.data.team);
      }
      if (response.data?.joinCode && response.data?.teamId) {
        setTeams((current) =>
          current.map((team) =>
            team._id === response.data.teamId ? { ...team, joinCode: response.data.joinCode } : team
          )
        );
      }
      if (response.data?.message) {
        setFeedback({ type: 'success', message: response.data.message });
      }
      return response;
    } catch (error) {
      console.error('Team action failed:', error);
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Action failed. Please try again.',
      });
      return null;
    } finally {
      setWorkingKey('');
    }
  };

  const runTeamAllocation = async (teamId) => {
    const selectedEventId = selectedEventByTeam[teamId];
    if (!selectedEventId) {
      setFeedback({ type: 'error', message: 'Select an event before running team allocation.' });
      return;
    }

    const response = await withTeamUpdate(`allocate-${teamId}`, () =>
      teamAPI.runTeamAllocation(teamId, { eventId: selectedEventId })
    );

    if (response?.data) {
      setAllocationByTeam((current) => ({
        ...current,
        [teamId]: response.data,
      }));
    }
  };

  const loadTeamReport = async (teamId) => {
    const selectedEventId = selectedEventByTeam[teamId];
    const response = await withTeamUpdate(`report-${teamId}`, () =>
      teamAPI.getTeamReport(teamId, selectedEventId ? { eventId: selectedEventId } : {})
    );

    if (response?.data) {
      setReportsByTeam((current) => ({
        ...current,
        [teamId]: response.data,
      }));
    }
  };

  return (
    <div className="space-y-5 rounded-[28px] bg-white/80 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#766e97]">Team Builder</p>
          <h4 className="mt-2 text-xl font-bold text-[#1d1736]">Create organizer teams</h4>
          <p className="mt-1 text-sm text-[#5f5a7a]">
            Build volunteer groups, run team AI allocation, and track team performers.
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef8f3] text-[#0f9f75]">
          <Users size={20} />
        </div>
      </div>

      {feedback.message && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.type === 'success' ? 'bg-[#eef8f3] text-[#0f9f75]' : 'bg-[#fff1ee] text-[#7f2ea8]'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleCreateTeam} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Team name"
          className="input-field md:col-span-1"
          disabled={submitting}
        />
        <input
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          placeholder="Team description"
          className="input-field md:col-span-1"
          disabled={submitting}
        />
        <button
          type="submit"
          className="rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Create Team'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-[#5f5a7a]">Loading teams...</p>
      ) : teams.length ? (
        <div className="space-y-4">
          {teams.map((team) => (
            <div key={team._id} className="rounded-[24px] border border-white/70 bg-white/90 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-[#1d1736]">{team.name}</p>
                  <p className="text-sm text-[#5f5a7a]">{team.description || 'No description added.'}</p>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-[#f8f5ff] px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#766e97]">Code</span>
                  <span className="text-sm font-black text-[#3e2f82]">{team.joinCode}</span>
                  <button
                    type="button"
                    onClick={() => copyCode(team.joinCode)}
                    className="rounded-xl bg-white p-2 text-[#5b3cc4] transition hover:bg-[#efe7ff]"
                    aria-label="Copy code"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      withTeamUpdate(`regen-${team._id}`, () => teamAPI.regenerateCode(team._id))
                    }
                    className="rounded-xl bg-white p-2 text-[#5b3cc4] transition hover:bg-[#efe7ff]"
                    aria-label="Regenerate code"
                    disabled={workingKey === `regen-${team._id}`}
                  >
                    <RefreshCcw size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f2f6ff] p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#4b46c8]">
                  Team AI Controls
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
                  <select
                    className="input-field"
                    value={selectedEventByTeam[team._id] || ''}
                    onChange={(event) =>
                      setSelectedEventByTeam((current) => ({
                        ...current,
                        [team._id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select event for team allocation/report</option>
                    {sortedEvents.map((event) => (
                      <option key={event._id} value={event._id}>
                        {event.eventName} ({event.date ? new Date(event.date).toLocaleDateString() : 'No date'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => runTeamAllocation(team._id)}
                    disabled={workingKey === `allocate-${team._id}` || !sortedEvents.length}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#0f9f75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#198a67] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PlayCircle size={16} />
                    <span>
                      {workingKey === `allocate-${team._id}` ? 'Allocating...' : 'Run Team AI Allocation'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadTeamReport(team._id)}
                    disabled={workingKey === `report-${team._id}`}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <BarChart3 size={16} />
                    <span>{workingKey === `report-${team._id}` ? 'Loading...' : 'Team Report'}</span>
                  </button>
                </div>

                {allocationByTeam[team._id] && (
                  <div className="mt-3 rounded-xl bg-white/90 px-3 py-2 text-sm text-[#403b63]">
                    {allocationByTeam[team._id].totalAssignments || 0} team allocation(s) generated for{' '}
                    {allocationByTeam[team._id].event?.eventName || 'selected event'}.
                  </div>
                )}

                {reportsByTeam[team._id] && (
                  <div className="mt-3 space-y-3 rounded-xl bg-white/90 p-3">
                    <div className="grid grid-cols-2 gap-2 text-xs text-[#5f5a7a] md:grid-cols-4">
                      <div className="rounded-lg bg-[#f8f5ff] p-2">
                        <p className="font-semibold">Members</p>
                        <p className="text-base font-black text-[#1d1736]">
                          {reportsByTeam[team._id].summary?.totalMembers || 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#eef8f3] p-2">
                        <p className="font-semibold">Assignments</p>
                        <p className="text-base font-black text-[#1d1736]">
                          {reportsByTeam[team._id].summary?.assignments || 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f2f6ff] p-2">
                        <p className="font-semibold">Accepted</p>
                        <p className="text-base font-black text-[#1d1736]">
                          {reportsByTeam[team._id].summary?.acceptedAssignments || 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#fff6e7] p-2">
                        <p className="font-semibold">Avg Perf.</p>
                        <p className="text-base font-black text-[#1d1736]">
                          {reportsByTeam[team._id].summary?.avgTeamPerformance || 0}%
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#766e97]">
                        <Trophy size={14} />
                        Best Performers
                      </p>
                      {reportsByTeam[team._id].topPerformers?.length ? (
                        <div className="space-y-2">
                          {reportsByTeam[team._id].topPerformers.slice(0, 3).map((performer) => (
                            <div key={performer.volunteerId} className="flex items-center justify-between rounded-lg bg-[#f8f5ff] px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold text-[#1d1736]">{performer.name}</p>
                                <p className="text-xs text-[#5f5a7a]">
                                  Accept {performer.acceptanceRate}% | Attendance {performer.attendanceRate}%
                                </p>
                              </div>
                              <span className="badge badge-primary">{performer.leaderboardScore}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#5f5a7a]">No report data available yet for this scope.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl bg-[#f8f5ff] p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#766e97]">
                    <UserPlus size={14} />
                    Pending requests ({team.pendingRequests?.length || 0})
                  </p>
                  {team.pendingRequests?.length ? (
                    <div className="space-y-2">
                      {team.pendingRequests.map((request) => {
                        const volunteerId = request.volunteerId?._id || request.volunteerId;
                        return (
                          <div key={String(volunteerId)} className="rounded-xl bg-white/90 p-3">
                            <p className="text-sm font-semibold text-[#1d1736]">
                              {request.volunteerId?.name || 'Volunteer'}
                            </p>
                            <p className="text-xs text-[#5f5a7a]">{request.volunteerId?.email || ''}</p>
                            {request.message && (
                              <p className="mt-1 text-xs text-[#403b63]">{request.message}</p>
                            )}
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                className="rounded-xl bg-[#0f9f75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#198a67]"
                                onClick={() =>
                                  withTeamUpdate(`approve-${team._id}-${volunteerId}`, () =>
                                    teamAPI.approveRequest(team._id, volunteerId)
                                  )
                                }
                                disabled={workingKey === `approve-${team._id}-${volunteerId}`}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="rounded-xl bg-[#7f2ea8] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#702b93]"
                                onClick={() =>
                                  withTeamUpdate(`reject-${team._id}-${volunteerId}`, () =>
                                    teamAPI.rejectRequest(team._id, volunteerId)
                                  )
                                }
                                disabled={workingKey === `reject-${team._id}-${volunteerId}`}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5f5a7a]">No pending requests.</p>
                  )}
                </div>

                <div className="rounded-2xl bg-[#eef8f3] p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6b8d80]">
                    <ShieldCheck size={14} />
                    Team members ({team.members?.length || 0})
                  </p>
                  {team.members?.length ? (
                    <div className="space-y-2">
                      {team.members.map((member) => {
                        const volunteerId = member.volunteerId?._id || member.volunteerId;
                        return (
                          <div
                            key={String(volunteerId)}
                            className="flex items-center justify-between rounded-xl bg-white/85 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-[#1d1736]">
                                {member.volunteerId?.name || 'Volunteer'}
                              </p>
                              <p className="text-xs text-[#5f5a7a]">
                                {member.volunteerId?.department || 'Department not set'}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded-xl bg-[#fff1ee] px-2.5 py-1.5 text-xs font-semibold text-[#7f2ea8] transition hover:bg-[#ffe3dd]"
                              onClick={() =>
                                withTeamUpdate(`remove-${team._id}-${volunteerId}`, () =>
                                  teamAPI.removeMember(team._id, volunteerId)
                                )
                              }
                              disabled={workingKey === `remove-${team._id}-${volunteerId}`}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5f5a7a]">No members yet.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#f8f5ff] px-4 py-5 text-sm text-[#5f5a7a]">
          No teams yet. Create one and share the join code with volunteers.
        </div>
      )}
    </div>
  );
};

export default OrganizerTeamManager;
