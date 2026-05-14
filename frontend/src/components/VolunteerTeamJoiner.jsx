import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Send, Users } from 'lucide-react';
import { teamAPI } from '../utils/api.js';
import TeamChatPanel from './TeamChatPanel.jsx';

const VolunteerTeamJoiner = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [workingKey, setWorkingKey] = useState('');
  const [feedback, setFeedback] = useState({ type: 'idle', message: '' });

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

  const myTeams = useMemo(() => teams.filter((team) => team.isMember), [teams]);
  const openTeams = useMemo(() => teams.filter((team) => !team.isMember), [teams]);

  const handleJoinByCode = async (event) => {
    event.preventDefault();
    if (!joinCode.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a valid join code.' });
      return;
    }

    try {
      setWorkingKey('join-code');
      const response = await teamAPI.joinByCode({ joinCode });
      setFeedback({
        type: 'success',
        message: response.data?.message || 'Join request sent.',
      });
      setJoinCode('');
      await loadTeams();
    } catch (error) {
      console.error('Failed to join with code:', error);
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Could not process join code.',
      });
    } finally {
      setWorkingKey('');
    }
  };

  const handleApply = async (teamId) => {
    try {
      setWorkingKey(`apply-${teamId}`);
      const response = await teamAPI.applyToTeam(teamId);
      setFeedback({
        type: 'success',
        message: response.data?.message || 'Join request sent to organizer.',
      });
      await loadTeams();
    } catch (error) {
      console.error('Failed to apply:', error);
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Could not submit request.',
      });
    } finally {
      setWorkingKey('');
    }
  };

  return (
    <div className="space-y-5 rounded-[28px] bg-white/80 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#766e97]">Organizer Teams</p>
          <h4 className="mt-2 text-xl font-bold text-[#1d1736]">Join volunteer groups</h4>
          <p className="mt-1 text-sm text-[#5f5a7a]">
            Apply to teams or enter a join code shared by an organizer.
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1ecff] text-[#5b3cc4]">
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

      <form onSubmit={handleJoinByCode} className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <KeyRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#766e97]" />
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            className="input-field pl-11"
            placeholder="Enter team join code"
            maxLength={10}
            disabled={workingKey === 'join-code'}
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#1d1736] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={workingKey === 'join-code'}
        >
          <Send size={15} />
          <span>{workingKey === 'join-code' ? 'Submitting...' : 'Join by Code'}</span>
        </button>
      </form>

      <div className="rounded-2xl bg-[#eef8f3] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b8d80]">My teams</p>
        {loading ? (
          <p className="mt-2 text-sm text-[#5f5a7a]">Loading teams...</p>
        ) : myTeams.length ? (
          <div className="mt-3 space-y-2">
            {myTeams.map((team) => (
              <div key={team._id} className="rounded-xl bg-white/85 px-3 py-2">
                <p className="text-sm font-semibold text-[#1d1736]">{team.name}</p>
                <p className="text-xs text-[#5f5a7a]">
                  Organizer: {team.organizerId?.name || 'Organizer'} | Members: {team.members?.length || 0}
                </p>
                <div className="mt-2">
                  <TeamChatPanel team={team} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#5f5a7a]">You have not joined any team yet.</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#766e97]">Available organizer teams</p>
        {loading ? (
          <p className="text-sm text-[#5f5a7a]">Loading teams...</p>
        ) : openTeams.length ? (
          openTeams.map((team) => (
            <div key={team._id} className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-base font-bold text-[#1d1736]">{team.name}</p>
                  <p className="text-sm text-[#5f5a7a]">{team.description || 'No description.'}</p>
                  <p className="mt-1 text-xs text-[#766e97]">
                    Organizer: {team.organizerId?.name || 'Organizer'} | Members: {team.members?.length || 0}
                  </p>
                </div>
                {team.isPending ? (
                  <span className="badge badge-warning">Request Pending</span>
                ) : (
                  <button
                    type="button"
                    className="rounded-xl bg-[#0f9f75] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#198a67] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => handleApply(team._id)}
                    disabled={workingKey === `apply-${team._id}`}
                  >
                    {workingKey === `apply-${team._id}` ? 'Applying...' : 'Apply to Join'}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-[#f8f5ff] px-4 py-4 text-sm text-[#5f5a7a]">
            No open teams available right now.
          </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerTeamJoiner;
