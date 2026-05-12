import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  RefreshCcw,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import { assignmentAPI, eventAPI } from '../utils/api.js';

const AllocationPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [roleRecommendations, setRoleRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningAllocation, setRunningAllocation] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [slotDraft, setSlotDraft] = useState({ startTime: '09:00', endTime: '11:00' });
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [scheduleInsight, setScheduleInsight] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const buildDefaultSlotsFromEvent = (event) => {
    if (!event) return [];
    if (event.isFullDay) {
      return [
        { label: 'Morning', startTime: '08:00', endTime: '12:00' },
        { label: 'Afternoon', startTime: '12:00', endTime: '16:00' },
        { label: 'Evening', startTime: '16:00', endTime: '20:00' },
      ];
    }

    if (event.startTime && event.endTime) {
      return [{ label: `${event.startTime} - ${event.endTime}`, startTime: event.startTime, endTime: event.endTime }];
    }

    return [{ label: 'Default Slot', startTime: '09:00', endTime: '13:00' }];
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await eventAPI.getEvents();
      setEvents(res.data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllocations = async (event) => {
    const res = await assignmentAPI.getAssignments({ eventId: event._id });
    setAllocations(res.data.assignments || []);
  };

  const loadRoleRecommendations = async (event) => {
    try {
      setLoadingRecommendations(true);
      const res = await assignmentAPI.getEventRecommendations(event._id);
      setRoleRecommendations(res.data.roles || []);
    } catch (error) {
      console.error('Failed to load role recommendations:', error);
      setRoleRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleRunAllocation = async (eventId) => {
    try {
      setRunningAllocation(true);
      setActionMessage('');
      const res = await assignmentAPI.runAllocation({ eventId });
      setAllocations(res.data.allocations || []);
      setSelectedEvent((prev) => ({ ...prev, status: 'allocated' }));
      if (selectedEvent) {
        await loadRoleRecommendations(selectedEvent);
      }
      setActionMessage('AI allocation completed using skill, level, experience, and availability signals.');
    } catch (error) {
      console.error('Failed to run allocation:', error);
      setActionMessage('Allocation failed. Please try again.');
    } finally {
      setRunningAllocation(false);
    }
  };

  const handleConfirmAllocations = async () => {
    if (!selectedEvent) return;
    try {
      setConfirming(true);
      await assignmentAPI.confirmEventAllocations(selectedEvent._id);
      setSelectedEvent((prev) => ({ ...prev, status: 'confirmed' }));
      setActionMessage('Allocations confirmed and volunteers notified.');
    } catch (error) {
      console.error('Failed to confirm allocations:', error);
      setActionMessage(error.response?.data?.message || 'Failed to confirm allocations.');
    } finally {
      setConfirming(false);
    }
  };

  const handleExportAllocationsPdf = async () => {
    if (!selectedEvent) return;
    try {
      setExporting(true);
      const response = await assignmentAPI.exportEventAllocationsPdf(selectedEvent._id);
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `allocations-${selectedEvent._id}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      setActionMessage(error.response?.data?.message || 'Failed to export PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handleSelectEvent = async (event) => {
    setSelectedEvent(event);
    setSelectedAssignmentId(null);
    setRecommendations([]);
    setRoleRecommendations([]);
    setScheduleInsight(null);
    setScheduleSlots(buildDefaultSlotsFromEvent(event));
    try {
      await loadAllocations(event);
      await loadRoleRecommendations(event);
    } catch (error) {
      console.error('Failed to fetch allocations:', error);
    }
  };

  const handleSelectAssignment = async (assignmentId) => {
    setSelectedAssignmentId(assignmentId);
    try {
      const res = await assignmentAPI.getRecommendedVolunteers(assignmentId);
      setRecommendations(res.data.recommendations || []);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      setRecommendations([]);
    }
  };

  const handleReplaceVolunteer = async (assignmentId, volunteerId) => {
    try {
      const res = await assignmentAPI.replaceVolunteer(assignmentId, { volunteerId });
      setAllocations((current) =>
        current.map((assignment) =>
          assignment._id === assignmentId ? res.data.assignment : assignment
        )
      );
      setActionMessage('Volunteer replaced using organizer selection and updated AI scoring.');
      await handleSelectAssignment(assignmentId);
    } catch (error) {
      console.error('Failed to replace volunteer:', error);
      setActionMessage(error.response?.data?.message || 'Failed to replace volunteer.');
    }
  };

  const handleManualAssign = async (roleId, volunteerId) => {
    if (!selectedEvent) return;
    try {
      const res = await assignmentAPI.createManualAssignment({
        eventId: selectedEvent._id,
        roleId,
        volunteerId,
      });
      setAllocations((current) => [res.data.assignment, ...current]);
      setActionMessage('Volunteer assigned directly from recommendations.');
      await loadRoleRecommendations(selectedEvent);
    } catch (error) {
      console.error('Failed to assign volunteer:', error);
      setActionMessage(error.response?.data?.message || 'Failed to assign volunteer.');
    }
  };

  const getAssignedCount = (roleId) =>
    allocations.filter((assignment) => assignment.roleId?._id === roleId).length;

  const handleReassignNext = async (assignmentId) => {
    try {
      const res = await assignmentAPI.reassignNextVolunteer(assignmentId);
      setAllocations((current) =>
        current.map((assignment) =>
          assignment._id === assignmentId ? res.data.assignment : assignment
        )
      );
      setActionMessage('Assignment moved to the next best suitable volunteer.');
      await handleSelectAssignment(assignmentId);
    } catch (error) {
      console.error('Failed to reassign volunteer:', error);
      setActionMessage(error.response?.data?.message || 'Failed to reassign volunteer.');
    }
  };

  const handleAddSlot = () => {
    if (!slotDraft.startTime || !slotDraft.endTime || slotDraft.endTime <= slotDraft.startTime) {
      setActionMessage('Please enter a valid slot range before adding.');
      return;
    }

    setScheduleSlots((current) => [
      ...current,
      {
        label: `${slotDraft.startTime} - ${slotDraft.endTime}`,
        startTime: slotDraft.startTime,
        endTime: slotDraft.endTime,
      },
    ]);
  };

  const handleRemoveSlot = (index) => {
    setScheduleSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  };

  const handleAnalyzeSchedule = async () => {
    if (!selectedEvent) return;

    try {
      setLoadingSchedule(true);
      const response = await assignmentAPI.getSmartScheduleSuggestions(selectedEvent._id, {
        slots: scheduleSlots,
      });
      setScheduleInsight(response.data);
      setActionMessage('Smart scheduling analysis complete. Best slot is highlighted.');
    } catch (error) {
      console.error('Failed to analyze schedule:', error);
      setActionMessage(error.response?.data?.message || 'Failed to analyze schedule.');
      setScheduleInsight(null);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleAutoSchedule = async () => {
    if (!selectedEvent) return;

    try {
      setAutoScheduling(true);
      const response = await assignmentAPI.autoScheduleEvent(selectedEvent._id, {
        slots: scheduleSlots,
      });
      setAllocations(response.data.allocations || []);
      setScheduleInsight({
        eventId: response.data.eventId,
        eventName: response.data.eventName,
        bestSlot: response.data.bestSlot,
        slotScores: response.data.slotScores || [],
        schedule: response.data.schedule,
      });
      setSelectedEvent((prev) =>
        prev
          ? {
              ...prev,
              status: 'allocated',
              ...(response.data.bestSlot
                ? {
                    startTime: response.data.bestSlot.startTime,
                    endTime: response.data.bestSlot.endTime,
                  }
                : {}),
            }
          : prev
      );
      setActionMessage('Auto schedule applied and assignments generated.');
      await loadRoleRecommendations(selectedEvent);
    } catch (error) {
      console.error('Failed to auto schedule event:', error);
      setActionMessage(error.response?.data?.message || 'Failed to auto schedule event.');
    } finally {
      setAutoScheduling(false);
    }
  };

  const formatEventTime = (event) => {
    if (!event) return '';
    if (event.isFullDay) return 'Full day';
    if (event.startTime && event.endTime) return `${event.startTime} - ${event.endTime}`;
    return 'Time not set';
  };

  const getWorkloadPillClass = (level) => {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'high') return 'bg-[#fdecee] text-[#a24431]';
    if (normalized === 'medium') return 'bg-[#fff4ea] text-[#8a4224]';
    return 'bg-[#eef8f3] text-[#2f7d6a]';
  };

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <Header
            title="AI Allocation Studio"
            subtitle="Review ranked assignments, remove volunteers when needed, and switch to the next best AI candidate based on skills, level, experience, and availability."
            icon={<BrainCircuit size={28} />}
            showUserProfile={true}
          />

          {actionMessage && (
            <div className="mb-6 rounded-2xl bg-[#eef8f3] px-4 py-3 text-sm font-medium text-[#2f7d6a]">
              {actionMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">
            <Card hoverable={false} className="shell-panel border-0 p-6">
              <h3 className="mb-4 text-xl font-bold text-[#1f1a17]">Events</h3>
              <div className="space-y-3">
                {events.map((event) => (
                  <button
                    key={event._id}
                    onClick={() => handleSelectEvent(event)}
                    className={`w-full rounded-[22px] px-4 py-4 text-left transition ${
                      selectedEvent?._id === event._id
                        ? 'bg-[#1f1a17] text-white'
                        : 'bg-white/80 text-[#1f1a17] hover:bg-[#fff4ea]'
                    }`}
                  >
                    <p className="font-semibold">{event.eventName}</p>
                    <p className="mt-1 text-xs opacity-80">{event.venue}</p>
                  </button>
                ))}
                {!events.length && !loading && <p className="text-sm text-[#6a5d54]">No events found.</p>}
              </div>
            </Card>

            <div className="space-y-6">
              {selectedEvent ? (
                <>
                  <Card hoverable={false} className="shell-panel border-0 p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-[#1f1a17]">{selectedEvent.eventName}</h3>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#6a5d54]">
                          <span className="flex items-center gap-2">
                            <Calendar size={15} />
                            {new Date(selectedEvent.date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-2">
                            <Calendar size={15} />
                            {formatEventTime(selectedEvent)}
                          </span>
                          <span className="flex items-center gap-2">
                            <MapPin size={15} />
                            {selectedEvent.venue}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleRunAllocation(selectedEvent._id)}
                          disabled={runningAllocation}
                          className="flex items-center gap-2 rounded-2xl bg-[#1f1a17] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#362822] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles size={16} />
                          <span>{runningAllocation ? 'Running...' : 'Run Allocation'}</span>
                        </button>
                        <button
                          onClick={handleConfirmAllocations}
                          disabled={confirming || allocations.length === 0}
                          className="flex items-center gap-2 rounded-2xl bg-[#2f7d6a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#256453] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle2 size={16} />
                          <span>{confirming ? 'Confirming...' : 'Confirm Allocations'}</span>
                        </button>
                        <button
                          onClick={handleExportAllocationsPdf}
                          disabled={exporting || allocations.length === 0}
                          className="flex items-center gap-2 rounded-2xl bg-[#fff4ea] px-5 py-3 text-sm font-semibold text-[#8a4224] transition hover:bg-[#ffeadb] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileText size={16} />
                          <span>{exporting ? 'Exporting...' : 'Export PDF'}</span>
                        </button>
                      </div>
                    </div>
                  </Card>

                  <Card hoverable={false} className="shell-panel border-0 p-6">
                    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-[#1f1a17]">AI Smart Scheduling Assistant</h3>
                        <p className="mt-1 text-sm text-[#6a5d54]">
                          Compare slot availability, highlight the best time, and auto-create a balanced schedule.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleAnalyzeSchedule}
                          disabled={loadingSchedule}
                          className="flex items-center gap-2 rounded-2xl bg-[#1f1a17] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#362822] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Clock3 size={15} />
                          <span>{loadingSchedule ? 'Analyzing...' : 'Analyze Slots'}</span>
                        </button>
                        <button
                          onClick={handleAutoSchedule}
                          disabled={autoScheduling}
                          className="flex items-center gap-2 rounded-2xl bg-[#2f7d6a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#256453] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles size={15} />
                          <span>{autoScheduling ? 'Scheduling...' : 'Auto Schedule'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <input
                        type="time"
                        value={slotDraft.startTime}
                        onChange={(event) =>
                          setSlotDraft((current) => ({ ...current, startTime: event.target.value }))
                        }
                        className="input-field"
                      />
                      <input
                        type="time"
                        value={slotDraft.endTime}
                        onChange={(event) =>
                          setSlotDraft((current) => ({ ...current, endTime: event.target.value }))
                        }
                        className="input-field"
                      />
                      <button
                        onClick={handleAddSlot}
                        className="rounded-2xl bg-[#fff4ea] px-4 py-3 text-sm font-semibold text-[#8a4224] transition hover:bg-[#ffeadb]"
                      >
                        Add Slot
                      </button>
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                      {scheduleSlots.map((slot, index) => (
                        <button
                          key={`${slot.startTime}-${slot.endTime}-${index}`}
                          onClick={() => handleRemoveSlot(index)}
                          className="rounded-2xl bg-white/90 px-3 py-2 text-xs font-semibold text-[#5f5a7a] transition hover:bg-[#ffe9de]"
                        >
                          {slot.label} x
                        </button>
                      ))}
                      {!scheduleSlots.length && <p className="text-sm text-[#6a5d54]">No slots added yet.</p>}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {(scheduleInsight?.slotScores || []).map((slot) => {
                        const isBest =
                          scheduleInsight?.bestSlot?.startTime === slot.startTime &&
                          scheduleInsight?.bestSlot?.endTime === slot.endTime;

                        return (
                          <div
                            key={`${slot.startTime}-${slot.endTime}`}
                            className={`rounded-[20px] border p-4 ${
                              isBest ? 'border-[#2f7d6a] bg-[#eef8f3]' : 'border-white/60 bg-white/90'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-[#1f1a17]">{slot.label || `${slot.startTime} - ${slot.endTime}`}</p>
                              {isBest && <span className="badge badge-success">Best slot</span>}
                            </div>
                            <p className="mt-2 text-sm text-[#6a5d54]">
                              {slot.availableCount || 0} volunteers available
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {scheduleInsight?.schedule?.workloadSummary && (
                      <div className="mt-5 rounded-[20px] bg-white/85 p-4 text-sm text-[#5f5a7a]">
                        <p className="font-semibold text-[#1f1a17]">Workload outlook for selected slot</p>
                        <p className="mt-1">
                          Low: {scheduleInsight.schedule.workloadSummary.low} | Medium:{' '}
                          {scheduleInsight.schedule.workloadSummary.medium} | High:{' '}
                          {scheduleInsight.schedule.workloadSummary.high}
                        </p>
                      </div>
                    )}

                    {scheduleInsight?.schedule?.roles?.length > 0 && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {scheduleInsight.schedule.roles.map((role) => (
                          <div key={role.roleId} className="rounded-[18px] bg-white/85 p-3">
                            <p className="text-sm font-semibold text-[#1f1a17]">{role.roleName}</p>
                            <p className="text-xs text-[#6a5d54]">
                              {role.assignedCount}/{role.requiredCount} scheduled
                              {role.shortage > 0 ? ` (${role.shortage} short)` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card hoverable={false} className="shell-panel border-0 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-[#1f1a17]">Role-based recommendations</h3>
                        <p className="mt-1 text-sm text-[#6a5d54]">
                          Suggestions per role using skills, availability, attendance, and reliability.
                        </p>
                      </div>
                      <Sparkles size={18} className="text-[#8a4224]" />
                    </div>

                    {loadingRecommendations ? (
                      <p className="text-sm text-[#6a5d54]">Loading recommendations...</p>
                    ) : (
                      <div className="space-y-6">
                        {roleRecommendations.map((role) => {
                          const assignedCount = getAssignedCount(role.roleId);
                          const isRoleFull = assignedCount >= role.requiredCount;

                          return (
                            <div key={role.roleId} className="rounded-[24px] bg-white/82 p-5">
                              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="text-lg font-bold text-[#1f1a17]">{role.roleName}</p>
                                  <p className="text-sm text-[#6a5d54]">
                                    {assignedCount}/{role.requiredCount} volunteers assigned
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(role.requiredSkills || []).map((skill) => (
                                    <span key={`${role.roleId}-${skill.name}`} className="badge badge-primary">
                                      {skill.name} - {skill.minimumLevel}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="grid gap-4 lg:grid-cols-2">
                                {(role.recommendations || []).map((recommendation) => (
                                  <div
                                    key={`${role.roleId}-${recommendation.volunteer._id}`}
                                    className={`rounded-[20px] border p-4 ${
                                      recommendation.overloaded
                                        ? 'border-[#f2b4a6] bg-[#fff6f3]'
                                        : 'border-white/60 bg-white/90'
                                    }`}
                                  >
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-bold text-[#1f1a17]">
                                          {recommendation.volunteer.name}
                                        </p>
                                        <p className="text-xs text-[#8d7a6a]">
                                          {recommendation.volunteer.email}
                                        </p>
                                        <p className="text-xs text-[#6a5d54]">
                                          {recommendation.volunteer.department || 'Department not set'}
                                        </p>
                                      </div>
                                      <span className="badge badge-success">
                                        {recommendation.recommendationScore ?? 0}%
                                      </span>
                                    </div>

                                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                                      <span
                                        className={`rounded-2xl px-3 py-1 font-semibold ${getWorkloadPillClass(
                                          recommendation.workloadLevel
                                        )}`}
                                      >
                                        Workload {recommendation.workloadLevel || 'Low'}
                                      </span>
                                      <span className="text-[#6a5d54]">
                                        {recommendation.currentAssignments ?? 0}/
                                        {recommendation.maxAssignments ?? 0} active
                                      </span>
                                      {recommendation.overloaded && (
                                        <span className="flex items-center gap-1 rounded-2xl bg-[#fdecee] px-3 py-1 font-semibold text-[#a24431]">
                                          <AlertTriangle size={12} />
                                          High load
                                        </span>
                                      )}
                                    </div>

                                    <div className="mb-3 text-xs text-[#6a5d54]">
                                      Skill match {recommendation.skillMatch ?? 0}% - Availability {recommendation.availabilityMatch ?? 0}% - Attendance {recommendation.attendanceRate ?? 0}%
                                    </div>

                                    <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-[#2f7d6a]">
                                      <span>Reliability {recommendation.reliabilityScore ?? 0}%</span>
                                      <span>Role success {recommendation.roleSuccessIndicator ?? 0}%</span>
                                      {recommendation.recommendedByLearning && (
                                        <span className="rounded-2xl bg-[#eef8f3] px-3 py-1">
                                          Recommended based on past performance
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs text-[#6a5d54]">
                                      {(recommendation.reasons || []).map((reason) => (
                                        <span
                                          key={`${recommendation.volunteer._id}-${reason}`}
                                          className="rounded-2xl bg-[#fff4ea] px-3 py-1 text-[#8a4224]"
                                        >
                                          {reason}
                                        </span>
                                      ))}
                                    </div>

                                    <button
                                      onClick={() =>
                                        handleManualAssign(role.roleId, recommendation.volunteer._id)
                                      }
                                      disabled={isRoleFull}
                                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f7d6a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#256453] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <CheckCircle2 size={15} />
                                      <span>{isRoleFull ? 'Role filled' : 'Assign volunteer'}</span>
                                    </button>
                                  </div>
                                ))}

                                {!role.recommendations?.length && (
                                  <p className="text-sm text-[#6a5d54]">
                                    No recommendations yet for this role.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {!roleRecommendations.length && (
                          <p className="text-sm text-[#6a5d54]">No roles found for this event.</p>
                        )}
                      </div>
                    )}
                  </Card>

                  <Card hoverable={false} className="shell-panel border-0 p-6">
                    <h3 className="mb-4 text-xl font-bold text-[#1f1a17]">Assigned volunteers</h3>
                    <div className="space-y-4">
                      {allocations.map((allocation) => (
                        <div
                          key={allocation._id}
                          className={`rounded-[24px] border p-4 transition ${
                            selectedAssignmentId === allocation._id
                              ? 'border-[#8a4224] bg-[#fff4ea]'
                              : allocation.matchScore?.overloaded
                                ? 'border-[#f2b4a6] bg-[#fff6f3]'
                              : 'border-white/60 bg-white/82'
                          }`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                              <p className="font-bold text-[#1f1a17]">{allocation.volunteerId?.name}</p>
                              <p className="text-sm text-[#6a5d54]">{allocation.roleId?.roleName}</p>
                              <p className="text-xs text-[#8d7a6a]">{allocation.volunteerId?.email}</p>
                            </div>
                            <span className="badge badge-success">{allocation.matchScore?.totalScore || 0}%</span>
                          </div>

                          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`rounded-2xl px-3 py-1 font-semibold ${getWorkloadPillClass(
                                allocation.matchScore?.workloadLevel
                              )}`}
                            >
                              Workload {allocation.matchScore?.workloadLevel || 'Low'}
                            </span>
                            <span className="text-[#6a5d54]">
                              {allocation.matchScore?.currentAssignments ?? 0}/
                              {allocation.matchScore?.maxAssignments ?? 0} active
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm text-[#6a5d54] md:grid-cols-4">
                            <div>Skills {allocation.matchScore?.skillMatch || 0}%</div>
                            <div>Exp {allocation.matchScore?.experienceMatch || 0}%</div>
                            <div>Avail {allocation.matchScore?.availabilityMatch || 0}%</div>
                            <div>Perf {allocation.matchScore?.performanceMatch || 0}%</div>
                          </div>

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <button
                              onClick={() => handleSelectAssignment(allocation._id)}
                              className="rounded-2xl bg-[#1f1a17] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#362822]"
                            >
                              View AI alternatives
                            </button>
                            <button
                              onClick={() => handleReassignNext(allocation._id)}
                              className="flex items-center justify-center gap-2 rounded-2xl bg-[#a24431] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#893827]"
                            >
                              <RefreshCcw size={15} />
                              <span>Remove and assign next best</span>
                            </button>
                          </div>
                        </div>
                      ))}
                      {!allocations.length && (
                        <p className="text-sm text-[#6a5d54]">Run allocation or pick an event with assignments.</p>
                      )}
                    </div>
                  </Card>
                </>
              ) : (
                <Card hoverable={false} className="shell-panel border-0 p-8 text-center text-[#6a5d54]">
                  Select an event to inspect AI allocations.
                </Card>
              )}
            </div>

            <Card hoverable={false} className="shell-panel border-0 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#1f1a17]">Next best volunteers</h3>
                <UserPlus size={18} className="text-[#8a4224]" />
              </div>

              <div className="space-y-4">
                {recommendations.map((recommendation) => (
                  <div
                    key={recommendation.volunteer._id}
                    className={`rounded-[22px] p-4 ${
                      recommendation.overloaded ? 'bg-[#fff6f3]' : 'bg-white/82'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[#1f1a17]">{recommendation.volunteer.name}</p>
                        <p className="text-xs text-[#8d7a6a]">{recommendation.volunteer.email}</p>
                        <p className="text-xs text-[#6a5d54]">{recommendation.volunteer.department || 'No department set'}</p>
                      </div>
                      <span className="badge badge-primary">{recommendation.recommendationScore ?? 0}%</span>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-2xl px-3 py-1 font-semibold ${getWorkloadPillClass(
                          recommendation.workloadLevel
                        )}`}
                      >
                        Workload {recommendation.workloadLevel || 'Low'}
                      </span>
                      <span className="text-[#6a5d54]">
                        {recommendation.currentAssignments ?? 0}/{recommendation.maxAssignments ?? 0} active
                      </span>
                      {recommendation.overloaded && (
                        <span className="flex items-center gap-1 rounded-2xl bg-[#fdecee] px-3 py-1 font-semibold text-[#a24431]">
                          <AlertTriangle size={12} />
                          High load
                        </span>
                      )}
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {(recommendation.volunteer.skills || []).slice(0, 3).map((skill) => (
                        <span key={`${recommendation.volunteer._id}-${skill.name}`} className="badge badge-primary">
                          {skill.name} - {skill.level}
                        </span>
                      ))}
                    </div>

                    <div className="mb-4 text-xs text-[#6a5d54]">
                      Skill fit {recommendation.skillMatch ?? 0}% - Availability {recommendation.availabilityMatch ?? 0}% - Attendance {recommendation.attendanceRate ?? 0}%
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-[#2f7d6a]">
                      <span>Reliability {recommendation.reliabilityScore ?? 0}%</span>
                      <span>Role success {recommendation.roleSuccessIndicator ?? 0}%</span>
                      {recommendation.recommendedByLearning && (
                        <span className="rounded-2xl bg-[#eef8f3] px-3 py-1">
                          Recommended based on past performance
                        </span>
                      )}
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2 text-xs text-[#6a5d54]">
                      {(recommendation.reasons || []).map((reason) => (
                        <span key={`${recommendation.volunteer._id}-${reason}`} className="rounded-2xl bg-[#fff4ea] px-3 py-1 text-[#8a4224]">
                          {reason}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => handleReplaceVolunteer(selectedAssignmentId, recommendation.volunteer._id)}
                      disabled={!selectedAssignmentId}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f7d6a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#256453] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={15} />
                      <span>Assign this volunteer</span>
                    </button>
                  </div>
                ))}

                {!recommendations.length && (
                  <p className="text-sm text-[#6a5d54]">
                    Select an assigned volunteer to view ranked alternatives.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllocationPage;
