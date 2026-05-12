import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Card from '../components/Card.jsx';
import { assignmentAPI } from '../utils/api.js';
import { Check, X } from 'lucide-react';

const AssignmentPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await assignmentAPI.getAssignments({ status: 'pending' });
      setAssignments(res.data.assignments);
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (assignmentId, status) => {
    try {
      setUpdating(assignmentId);
      await assignmentAPI.updateAssignmentStatus(assignmentId, { status });
      setAssignments((prev) => prev.filter((a) => a._id !== assignmentId));
    } catch (error) {
      console.error('Failed to update assignment:', error);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading assignments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 overflow-auto md:ml-0">
        <div className="p-6 md:p-8 max-w-4xl">
          <Header title="My Assignments" subtitle="Review and respond to event assignments" showUserProfile={true} />

          {assignments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card text-center py-12"
            >
              <p className="text-gray-500 text-lg">No pending assignments</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment, idx) => (
                <motion.div
                  key={assignment._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Event</p>
                      <p className="text-lg font-semibold">{assignment.eventId?.eventName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Role</p>
                      <p className="text-lg font-semibold">{assignment.roleId?.roleName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Date</p>
                      <p className="text-lg font-semibold">
                        {new Date(assignment.eventId?.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b">
                    <p className="text-gray-600 text-sm font-medium mb-2">Match Score Breakdown</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-primary-600">
                          {assignment.matchScore.totalScore}%
                        </p>
                        <p className="text-xs text-gray-600">Total Match</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {assignment.matchScore.skillMatch}%
                        </p>
                        <p className="text-xs text-gray-600">Skills</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {assignment.matchScore.availabilityMatch}%
                        </p>
                        <p className="text-xs text-gray-600">Availability</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">
                          {assignment.matchScore.performanceMatch}%
                        </p>
                        <p className="text-xs text-gray-600">Performance</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleUpdateStatus(assignment._id, 'accepted')}
                      disabled={updating === assignment._id}
                      className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      Accept
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleUpdateStatus(assignment._id, 'declined')}
                      disabled={updating === assignment._id}
                      className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <X size={18} />
                      Decline
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentPage;
