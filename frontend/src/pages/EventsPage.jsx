import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import { eventAPI } from '../utils/api.js';

const statusBadge = {
  planning: 'badge-warning',
  'allocation-in-progress': 'badge-warning',
  allocated: 'badge-primary',
  confirmed: 'badge-success',
  completed: 'badge-success',
};

const EventsPage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await eventAPI.getEvents({ limit: 200 });
      setEvents(res.data.events || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesQuery =
        event.eventName?.toLowerCase().includes(query.toLowerCase()) ||
        event.venue?.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter ? event.status === statusFilter : true;
      return matchesQuery && matchesStatus;
    });
  }, [events, query, statusFilter]);

  const handleDelete = async (eventId) => {
    const confirmed = window.confirm('Delete this event and all associated roles?');
    if (!confirmed) return;
    try {
      setDeletingId(eventId);
      await eventAPI.deleteEvent(eventId);
      setEvents((prev) => prev.filter((event) => event._id !== eventId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (event) => {
    if (event.isFullDay) return 'Full day';
    if (event.startTime && event.endTime) return `${event.startTime} - ${event.endTime}`;
    return 'Time not set';
  };

  if (loading) {
    return (
      <div className="app-shell gradient-light flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm font-semibold text-[#6a5d54]">Loading events...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="Event Manager"
            subtitle="Search, edit, and maintain every event from one place."
            showUserProfile={true}
          />

          {error && (
            <div className="mb-6 rounded-2xl bg-[#fff1ee] px-4 py-4 text-sm font-medium text-[#a24431]">
              {error}
            </div>
          )}

          <Card hoverable={false} className="shell-panel border-0 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-3 text-[#8d7a6a]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="input-field pl-10"
                    placeholder="Search by event or venue"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="input-field md:w-48"
                >
                  <option value="">All statuses</option>
                  <option value="planning">Planning</option>
                  <option value="allocation-in-progress">Allocation in progress</option>
                  <option value="allocated">Allocated</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <Link
                to="/events/create"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1f1a17] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#362822]"
              >
                <Plus size={16} />
                <span>Create event</span>
              </Link>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {filteredEvents.map((event) => (
              <Card key={event._id} hoverable={false} className="shell-panel border-0 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/80">
                      {event.eventLogo ? (
                        <img src={event.eventLogo} alt={`${event.eventName} logo`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-[#8d7a6a]">
                          LOGO
                        </div>
                      )}
                    </div>
                    <div>
                    <p className="text-lg font-bold text-[#1f1a17]">{event.eventName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#6a5d54]">
                      <span className="flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar size={14} />
                        {formatTime(event)}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin size={14} />
                        {event.venue}
                      </span>
                    </div>
                    </div>
                  </div>
                  <span className={`badge ${statusBadge[event.status] || 'badge-primary'}`}>{event.status}</span>
                </div>

                <p className="mt-4 text-sm text-[#6a5d54]">
                  {event.description || 'No description available.'}
                </p>

                {(event.mottoText || event.mottoImage) && (
                  <div className="mt-4 rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8d7a6a]">Motto</p>
                    {event.mottoText && <p className="mt-1 text-sm font-medium text-[#4d3e34]">{event.mottoText}</p>}
                    {event.mottoImage && (
                      <img
                        src={event.mottoImage}
                        alt={`${event.eventName} motto`}
                        className="mt-2 h-24 w-full rounded-lg object-cover"
                      />
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/events/${event._id}/edit`)}
                    className="rounded-2xl bg-[#2f7d6a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#256453]"
                  >
                    Edit event
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(event._id)}
                    disabled={deletingId === event._id}
                    className="flex items-center gap-2 rounded-2xl bg-[#a24431] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#893827] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                    <span>{deletingId === event._id ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </Card>
            ))}

            {!filteredEvents.length && (
              <Card hoverable={false} className="shell-panel border-0 p-8 text-center text-[#6a5d54]">
                No events match your filters.
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventsPage;
