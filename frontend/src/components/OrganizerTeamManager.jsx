import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Copy,
  Download,
  ImagePlus,
  PlayCircle,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { teamAPI } from '../utils/api.js';
import TeamChatPanel from './TeamChatPanel.jsx';

const BACKEND_ORIGIN = 'http://localhost:5000';

const getAssetUrl = (value = '') => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `${BACKEND_ORIGIN}${value}`;
  return `${BACKEND_ORIGIN}/${value}`;
};

const OrganizerTeamManager = ({ events = [] }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    focusArea: '',
    preferredEventTypes: '',
  });
  const [feedback, setFeedback] = useState({ type: 'idle', message: '' });
  const [workingKey, setWorkingKey] = useState('');
  const [selectedEventByTeam, setSelectedEventByTeam] = useState({});
  const [reportsByTeam, setReportsByTeam] = useState({});
  const [allocationByTeam, setAllocationByTeam] = useState({});
  const [logoFilesByTeam, setLogoFilesByTeam] = useState({});
  const [teamDrafts, setTeamDrafts] = useState({});

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)),
    [events]
  );

  const syncTeamDrafts = (teamList) => {
    setTeamDrafts((current) => {
      const next = { ...current };
      teamList.forEach((team) => {
        if (!next[team._id]) {
          next[team._id] = {
            name: team.name || '',
            description: team.description || '',
            focusArea: team.focusArea || '',
            preferredEventTypes: (team.preferredEventTypes || []).join(', '),
          };
        }
      });
      return next;
    });
  };

  const loadTeams = async () => {
    try {
      const response = await teamAPI.getTeams();
      const loadedTeams = response.data.teams || [];
      setTeams(loadedTeams);
      syncTeamDrafts(loadedTeams);
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
      const nextTeams = exists
        ? current.map((team) => (team._id === updatedTeam._id ? updatedTeam : team))
        : [updatedTeam, ...current];
      syncTeamDrafts(nextTeams);
      return nextTeams;
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
        focusArea: form.focusArea,
        preferredEventTypes: form.preferredEventTypes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      upsertTeam(response.data.team);
      setForm({ name: '', description: '', focusArea: '', preferredEventTypes: '' });
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

  const saveTeamDetails = async (teamId) => {
    const draft = teamDrafts[teamId] || {};
    await withTeamUpdate(`save-team-${teamId}`, () =>
      teamAPI.updateTeam(teamId, {
        name: draft.name || '',
        description: draft.description || '',
        focusArea: draft.focusArea || '',
        preferredEventTypes: String(draft.preferredEventTypes || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
    );
  };

  const uploadTeamLogo = async (teamId) => {
    const file = logoFilesByTeam[teamId];
    if (!file) {
      setFeedback({ type: 'error', message: 'Choose a logo file first.' });
      return;
    }

    const formData = new FormData();
    formData.append('teamLogo', file);
    await withTeamUpdate(`logo-${teamId}`, () => teamAPI.uploadTeamLogo(teamId, formData));
  };

  const downloadBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportTeamAllocations = async (teamId, type) => {
    const selectedEventId = selectedEventByTeam[teamId];
    if (!selectedEventId) {
      setFeedback({ type: 'error', message: 'Select an event before export.' });
      return;
    }

    try {
      setWorkingKey(`export-${type}-${teamId}`);
      const response =
        type === 'csv'
          ? await teamAPI.exportTeamAllocationsCsv(teamId, { eventId: selectedEventId })
          : await teamAPI.exportTeamAllocationsPdf(teamId, { eventId: selectedEventId });

      downloadBlob(
        response.data,
        `team-${teamId}-event-${selectedEventId}-allocation.${type === 'csv' ? 'csv' : 'pdf'}`
      );
      setFeedback({ type: 'success', message: `Team ${type.toUpperCase()} exported successfully.` });
    } catch (error) {
      console.error('Export failed:', error);
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || `Failed to export ${type.toUpperCase()}.`,
      });
    } finally {
      setWorkingKey('');
    }
  };

  return (
    <div className="space-y-5 rounded-[28px] bg-white/80 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#766e97]">Team Builder</p>
          <h4 className="mt-2 text-xl font-bold text-[#1d1736]">Create organizer teams</h4>
          <p className="mt-1 text-sm text-[#5f5a7a]">
            Manage team identity, advanced allocation, exports, and member intelligence.
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

      <form onSubmit={handleCreateTeam} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Team name"
          className="input-field"
          disabled={submitting}
        />
        <input
          value={form.focusArea}
          onChange={(event) =>
            setForm((current) => ({ ...current, focusArea: event.target.value }))
          }
          placeholder="Focus area (e.g. Technical Ops)"
          className="input-field"
          disabled={submitting}
        />
        <input
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          placeholder="Team description"
          className="input-field"
          disabled={submitting}
        />
        <input
          value={form.preferredEventTypes}
          onChange={(event) =>
            setForm((current) => ({ ...current, preferredEventTypes: event.target.value }))
          }
          placeholder="Preferred event types (comma separated)"
          className="input-field"
          disabled={submitting}
        />
        <button
          type="submit"
          className="md:col-span-2 rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Create Team'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-[#5f5a7a]">Loading teams...</p>
      ) : teams.length ? (
        <div className="space-y-4">
          {teams.map((team) => {
            const draft = teamDrafts[team._id] || {};
            return (
              <div key={team._id} className="rounded-[24px] border border-white/70 bg-white/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-[#f8f5ff]">
                      {team.logoUrl ? (
                        <img
                          src={getAssetUrl(team.logoUrl)}
                          alt={`${team.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#766e97]">
                          LOGO
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[#1d1736]">{team.name}</p>
                      <p className="text-sm text-[#5f5a7a]">{team.description || 'No description added.'}</p>
                      <p className="mt-1 text-xs text-[#766e97]">
                        Focus: {team.focusArea || 'General'} | Preferred: {(team.preferredEventTypes || []).join(', ') || 'All'}
                      </p>
                    </div>
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

                <div className="mt-4 rounded-2xl bg-[#fff7ec] p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a5c19]">Team Identity</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setLogoFilesByTeam((current) => ({
                          ...current,
                          [team._id]: event.target.files?.[0] || null,
                        }))
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => uploadTeamLogo(team._id)}
                      disabled={workingKey === `logo-${team._id}`}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-[#8a5c19] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#734a13] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ImagePlus size={16} />
                      <span>{workingKey === `logo-${team._id}` ? 'Uploading...' : 'Upload Logo'}</span>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      className="input-field"
                      value={draft.name || ''}
                      onChange={(event) =>
                        setTeamDrafts((current) => ({
                          ...current,
                          [team._id]: { ...(current[team._id] || {}), name: event.target.value },
                        }))
                      }
                      placeholder="Team name"
                    />
                    <input
                      className="input-field"
                      value={draft.focusArea || ''}
                      onChange={(event) =>
                        setTeamDrafts((current) => ({
                          ...current,
                          [team._id]: { ...(current[team._id] || {}), focusArea: event.target.value },
                        }))
                      }
                      placeholder="Focus area"
                    />
                    <input
                      className="input-field"
                      value={draft.description || ''}
                      onChange={(event) =>
                        setTeamDrafts((current) => ({
                          ...current,
                          [team._id]: { ...(current[team._id] || {}), description: event.target.value },
                        }))
                      }
                      placeholder="Description"
                    />
                    <input
                      className="input-field"
                      value={draft.preferredEventTypes || ''}
                      onChange={(event) =>
                        setTeamDrafts((current) => ({
                          ...current,
                          [team._id]: {
                            ...(current[team._id] || {}),
                            preferredEventTypes: event.target.value,
                          },
                        }))
                      }
                      placeholder="Preferred event types (comma separated)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => saveTeamDetails(team._id)}
                    disabled={workingKey === `save-team-${team._id}`}
                    className="mt-3 flex items-center gap-2 rounded-2xl bg-[#1d1736] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={14} />
                    <span>{workingKey === `save-team-${team._id}` ? 'Saving...' : 'Save Team Details'}</span>
                  </button>
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

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => exportTeamAllocations(team._id, 'csv')}
                      disabled={workingKey === `export-csv-${team._id}`}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-[#4b46c8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3f3aaa] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download size={16} />
                      <span>{workingKey === `export-csv-${team._id}` ? 'Exporting...' : 'Export CSV'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportTeamAllocations(team._id, 'pdf')}
                      disabled={workingKey === `export-pdf-${team._id}`}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-[#6a4ad2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5a3ec0] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download size={16} />
                      <span>{workingKey === `export-pdf-${team._id}` ? 'Exporting...' : 'Export PDF'}</span>
                    </button>
                  </div>

                  {allocationByTeam[team._id] && (
                    <div className="mt-3 rounded-xl bg-white/90 px-3 py-2 text-sm text-[#403b63]">
                      {allocationByTeam[team._id].totalAssignments || 0} team allocation(s) generated for{' '}
                      {allocationByTeam[team._id].event?.eventName || 'selected event'}.
                      {allocationByTeam[team._id].recommendation && (
                        <span className="ml-1">
                          Required: {allocationByTeam[team._id].recommendation.requiredVolunteers}, Coverage:{' '}
                          {allocationByTeam[team._id].recommendation.coveragePercent}%.
                        </span>
                      )}
                    </div>
                  )}

                  {reportsByTeam[team._id] && (
                    <div className="mt-3 space-y-3 rounded-xl bg-white/90 p-3">
                      <div className="grid grid-cols-2 gap-2 text-xs text-[#5f5a7a] md:grid-cols-5">
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
                        <div className="rounded-lg bg-[#eef8f3] p-2">
                          <p className="font-semibold">Avg Teams/Volunteer</p>
                          <p className="text-base font-black text-[#1d1736]">
                            {reportsByTeam[team._id].summary?.avgTeamsPerVolunteer || 0}
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
                              <div
                                key={performer.volunteerId}
                                className="flex items-center justify-between rounded-lg bg-[#f8f5ff] px-3 py-2"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[#1d1736]">{performer.name}</p>
                                  <p className="text-xs text-[#5f5a7a]">
                                    Accept {performer.acceptanceRate}% | Attendance {performer.attendanceRate}% | Teams {performer.teamEnrollmentCount}
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

                <div className="mt-4">
                  <TeamChatPanel team={team} />
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
                                <p className="text-[11px] font-semibold text-[#4b46c8]">
                                  Enrolled in {member.teamEnrollmentCount || 0} team(s)
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
            );
          })}
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
