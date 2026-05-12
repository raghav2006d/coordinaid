import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import { eventAPI, attendanceAPI, assignmentAPI } from '../utils/api.js';
import { CheckCircle2, X as XIcon, Image as ImageIcon } from 'lucide-react';

const AttendancePage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [organizerNotes, setOrganizerNotes] = useState({});

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await eventAPI.getEvents({ status: 'allocated' });
      setEvents(res.data.events);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = async (event) => {
    setSelectedEvent(event);
    try {
      const res = await attendanceAPI.getAttendanceByEvent(event._id);
      const attendanceData = res.data.attendance || [];

      if (attendanceData.length === 0) {
        const assignmentsRes = await assignmentAPI.getAssignments({ eventId: event._id });
        const assignments = assignmentsRes.data.assignments || [];
        const draftAttendance = assignments.map((assignment) => ({
          _id: assignment._id,
          volunteerId: assignment.volunteerId,
          assignmentId: assignment,
          status: 'absent',
          verificationStatus: 'pending',
          proofImage: '',
          volunteerNotes: '',
        }));
        setAttendance(draftAttendance);
        return;
      }

      setAttendance(attendanceData);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    }
  };

  const toggleAttendance = (volunteerId, status) => {
    setAttendance((prev) =>
      prev.map((record) =>
        record.volunteerId._id === volunteerId
          ? { ...record, status }
          : record
      )
    );
  };

  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      const attendanceData = attendance.map((record) => ({
        volunteerId: record.volunteerId._id,
        eventId: selectedEvent._id,
        assignmentId: record.assignmentId?._id || record.assignmentId,
        status: record.status,
        notes: record.notes,
      }));

      await attendanceAPI.bulkMarkAttendance({ attendanceData });
      alert('Attendance saved successfully');
      handleSelectEvent(selectedEvent);
    } catch (error) {
      console.error('Failed to save attendance:', error);
      alert('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyProof = async (recordId, status) => {
    try {
      setVerifyingId(recordId);
      const response = await attendanceAPI.verifyAttendanceProof(recordId, {
        verificationStatus: status,
        organizerNotes: organizerNotes[recordId] || '',
        status: 'present',
      });

      setAttendance((prev) =>
        prev.map((record) =>
          record._id === recordId ? response.data.attendance : record
        )
      );
    } catch (error) {
      console.error('Failed to verify attendance:', error);
      alert(error.response?.data?.message || 'Failed to verify attendance');
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 overflow-auto md:ml-0">
        <div className="p-6 md:p-8">
          <Header title="Mark Attendance" subtitle="Record volunteer attendance for events" showUserProfile={true} />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Events List */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-1"
            >
              <Card>
                <h3 className="text-lg font-semibold mb-4">Events</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {events.map((event) => (
                    <button
                      key={event._id}
                      onClick={() => handleSelectEvent(event)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedEvent?._id === event._id
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <p className="font-semibold text-sm">{event.eventName}</p>
                      <p className="text-xs opacity-75">{event.venue}</p>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Attendance Table */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-3"
            >
              {selectedEvent ? (
                <Card>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-bold">{selectedEvent.eventName}</h3>
                      <p className="text-gray-600 text-sm">
                        {new Date(selectedEvent.date).toLocaleDateString()}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSaveAttendance}
                      disabled={saving || attendance.length === 0}
                      className="btn-primary disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Attendance'}
                    </motion.button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Volunteer
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Proof
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                            Status
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                            Verification
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendance.map((record) => (
                          <tr key={record._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">
                                {record.volunteerId?.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {record.volunteerId?.email}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-700">
                                {record.assignmentId?.roleId?.roleName}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {record.proofImage ? (
                                <a
                                  href={record.proofImage}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                                >
                                  <ImageIcon size={16} />
                                  View proof
                                </a>
                              ) : (
                                <span className="text-xs text-gray-500">No proof</span>
                              )}
                              {record.volunteerNotes && (
                                <p className="text-xs text-gray-500 mt-1">{record.volunteerNotes}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    toggleAttendance(record.volunteerId._id, 'present')
                                  }
                                  className={`p-2 rounded-lg transition-all ${
                                    record.status === 'present'
                                      ? 'bg-green-500 text-white'
                                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  }`}
                                >
                                  <CheckCircle2 size={18} />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    toggleAttendance(record.volunteerId._id, 'absent')
                                  }
                                  className={`p-2 rounded-lg transition-all ${
                                    record.status === 'absent'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  }`}
                                >
                                  <XIcon size={18} />
                                </motion.button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {record.proofImage ? (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    value={organizerNotes[record._id] || ''}
                                    onChange={(e) =>
                                      setOrganizerNotes((prev) => ({
                                        ...prev,
                                        [record._id]: e.target.value,
                                      }))
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
                                    placeholder="Organizer notes"
                                  />
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleVerifyProof(record._id, 'approved')}
                                      disabled={verifyingId === record._id}
                                      className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-50"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleVerifyProof(record._id, 'rejected')}
                                      disabled={verifyingId === record._id}
                                      className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Status: {record.verificationStatus || 'pending'}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">Awaiting proof</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card>
                  <p className="text-center text-gray-500 py-8">Select an event to mark attendance</p>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
