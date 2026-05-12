import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Filter, RefreshCw } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import { assignmentAPI, eventAPI } from '../utils/api.js';

const AssignmentHistoryPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState(searchParams.get('eventId') || '');
  const [roleId, setRoleId] = useState(searchParams.get('roleId') || '');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (eventId) {
      nextParams.set('eventId', eventId);
    } else {
      nextParams.delete('eventId');
    }
    if (roleId) {
      nextParams.set('roleId', roleId);
    } else {
      nextParams.delete('roleId');
    }
    setSearchParams(nextParams, { replace: true });
  }, [eventId, roleId, searchParams, setSearchParams]);

  const fetchData = async () => {
    try {
      const [eventsRes, historyRes] = await Promise.all([
        eventAPI.getEvents(),
        assignmentAPI.getAssignmentHistory({ limit: 200 }),
      ]);

      setEvents(eventsRes.data.events || []);
      setHistoryEntries(historyRes.data.history || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = useMemo(() => {
    if (!eventId) return [];
    const selectedEvent = events.find((event) => event._id === eventId);
    if (!selectedEvent || !selectedEvent.roles) return [];
    return selectedEvent.roles.map((role) => ({
      id: role._id || role,
      name: role.roleName || role.name || 'Role',
    }));
  }, [eventId, events]);

  const filteredHistory = useMemo(() => {
    return historyEntries.filter((entry) => {
      if (eventId && entry.eventId?._id !== eventId) return false;
      if (roleId && entry.roleId?._id !== roleId) return false;
      return true;
    });
  }, [eventId, roleId, historyEntries]);

  const formatHistory = (entry) => {
    const fromStatus = entry.fromStatus || '';
    const toStatus = entry.toStatus || '';
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
    if (entry.actorId?.name) {
      return `${entry.actorId.name} (${entry.actorId.role || entry.actorRole || 'system'})`;
    }
    return entry.actorRole || 'system';
  };

  if (loading) {
    return (
      <div className="app-shell gradient-light flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4 h-14 w-14"></div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8d7a6a]">
              Loading assignment history
            </p>
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
            title="Assignment History"
            subtitle="Track assignment changes, responses, and replacements by event or role."
            icon={<Calendar size={28} />}
            showUserProfile={true}
          />

          <Card hoverable={false} className="shell-panel border-0 p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-[#6a5d54]">
                <Filter size={16} />
                <span className="font-semibold text-[#1f1a17]">Filter history</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={eventId}
                  onChange={(event) => {
                    setEventId(event.target.value);
                    setRoleId('');
                  }}
                  className="rounded-2xl border border-[#eadcd0] bg-white px-4 py-2 text-sm text-[#4d3e34]"
                >
                  <option value="">All events</option>
                  {events.map((event) => (
                    <option key={event._id} value={event._id}>
                      {event.eventName}
                    </option>
                  ))}
                </select>
                <select
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  className="rounded-2xl border border-[#eadcd0] bg-white px-4 py-2 text-sm text-[#4d3e34]"
                  disabled={!eventId}
                >
                  <option value="">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fetchData}
                  className="flex items-center gap-2 rounded-2xl bg-[#1f1a17] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#362822]"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200">
                  <tr className="text-xs uppercase tracking-wide text-[#8d7a6a]">
                    <th className="px-3 py-3">Volunteer</th>
                    <th className="px-3 py-3">Event</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Change</th>
                    <th className="px-3 py-3">Actor</th>
                    <th className="px-3 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHistory.map((entry) => (
                    <tr key={entry._id} className="hover:bg-[#fff8f0]">
                      <td className="px-3 py-3 font-semibold text-[#1f1a17]">
                        {entry.volunteerId?.name || entry.newVolunteerId?.name || 'Volunteer'}
                      </td>
                      <td className="px-3 py-3 text-[#6a5d54]">
                        {entry.eventId?.eventName || 'Event'}
                      </td>
                      <td className="px-3 py-3 text-[#6a5d54]">
                        {entry.roleId?.roleName || 'Role'}
                      </td>
                      <td className="px-3 py-3 text-[#6a5d54]">{formatHistory(entry)}</td>
                      <td className="px-3 py-3 text-[#6a5d54]">
                        {resolveActorLabel(entry)}
                      </td>
                      <td className="px-3 py-3 text-[#6a5d54]">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {!filteredHistory.length && (
                    <tr>
                      <td colSpan="6" className="px-3 py-6 text-center text-[#6a5d54]">
                        No history entries match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6a5d54]">
              <div>{filteredHistory.length} entries</div>
              <Link to="/organizer" className="flex items-center gap-2 font-semibold text-[#1f1a17]">
                <ArrowLeft size={16} />
                Back to dashboard
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AssignmentHistoryPage;
