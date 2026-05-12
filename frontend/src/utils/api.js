import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('token');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (token, data) => apiClient.post(`/auth/reset-password/${token}`, data),
};

export const notificationAPI = {
  getNotifications: (params) => apiClient.get('/notifications', { params }),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  markAsRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.put('/notifications/read-all'),
};

export const assistantAPI = {
  query: (data) => apiClient.post('/assistant/query', data),
  getSuggestions: (data) => apiClient.post('/assistant/suggestions', data),
};

export const teamAPI = {
  getTeams: () => apiClient.get('/teams'),
  createTeam: (data) => apiClient.post('/teams', data),
  joinByCode: (data) => apiClient.post('/teams/join-by-code', data),
  applyToTeam: (teamId, data = {}) => apiClient.post(`/teams/${teamId}/apply`, data),
  approveRequest: (teamId, volunteerId) =>
    apiClient.post(`/teams/${teamId}/requests/${volunteerId}/approve`),
  rejectRequest: (teamId, volunteerId) =>
    apiClient.post(`/teams/${teamId}/requests/${volunteerId}/reject`),
  removeMember: (teamId, volunteerId) =>
    apiClient.post(`/teams/${teamId}/members/${volunteerId}/remove`),
  regenerateCode: (teamId) => apiClient.post(`/teams/${teamId}/regenerate-code`),
  runTeamAllocation: (teamId, data) => apiClient.post(`/teams/${teamId}/allocation/run`, data),
  getTeamReport: (teamId, params) => apiClient.get(`/teams/${teamId}/report`, { params }),
};

// User APIs
export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data) => apiClient.put('/users/profile', data),
  deleteOwnAccount: (data) => apiClient.delete('/users/profile', { data }),
  uploadProfileImage: (formData) =>
    apiClient.post('/users/profile/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  addSkill: (data) => apiClient.post('/users/skills', data),
  removeSkill: (data) => apiClient.delete('/users/skills', { data }),
  updateAvailability: (data) => apiClient.put('/users/availability', data),
  getAllUsers: (params) => apiClient.get('/users', { params }),
  getUserById: (id) => apiClient.get(`/users/${id}`),
  updateUserById: (id, data) => apiClient.put(`/users/${id}`, data),
  deleteUserById: (id) => apiClient.delete(`/users/${id}`),
};

// Event APIs
export const eventAPI = {
  getEvents: (params) => apiClient.get('/events', { params }),
  createEvent: (data) => apiClient.post('/events', data),
  uploadEventLogo: (formData) =>
    apiClient.post('/events/upload/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadMottoImage: (formData) =>
    apiClient.post('/events/upload/motto-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  generateAiPlan: (data) => apiClient.post('/events/ai/plan', data),
  getEventById: (id) => apiClient.get(`/events/${id}`),
  updateEvent: (id, data) => apiClient.put(`/events/${id}`, data),
  deleteEvent: (id) => apiClient.delete(`/events/${id}`),
  addRoleToEvent: (eventId, data) => apiClient.post(`/events/${eventId}/roles`, data),
  updateRoleInEvent: (eventId, roleId, data) =>
    apiClient.put(`/events/${eventId}/roles/${roleId}`, data),
  deleteRoleFromEvent: (eventId, roleId) =>
    apiClient.delete(`/events/${eventId}/roles/${roleId}`),
};

export const leaderboardAPI = {
  getLeaderboard: (params) => apiClient.get('/leaderboard', { params }),
};

// Assignment APIs
export const assignmentAPI = {
  runAllocation: (data) => apiClient.post('/assignments/run', data),
  getAssignments: (params) => apiClient.get('/assignments', { params }),
  getAssignmentHistory: (params) => apiClient.get('/assignments/history', { params }),
  getAssignmentById: (id) => apiClient.get(`/assignments/${id}`),
  updateAssignmentStatus: (id, data) => apiClient.put(`/assignments/${id}/status`, data),
  getRecommendedVolunteers: (id) => apiClient.get(`/assignments/${id}/recommendations`),
  getEventRecommendations: (eventId, params) =>
    apiClient.get(`/assignments/event/${eventId}/recommendations`, { params }),
  getSmartScheduleSuggestions: (eventId, data) =>
    apiClient.post(`/assignments/event/${eventId}/smart-schedule`, data),
  autoScheduleEvent: (eventId, data) =>
    apiClient.post(`/assignments/event/${eventId}/auto-schedule`, data),
  createManualAssignment: (data) => apiClient.post('/assignments/manual', data),
  replaceVolunteer: (id, data) => apiClient.put(`/assignments/${id}/replace`, data),
  reassignNextVolunteer: (id) => apiClient.post(`/assignments/${id}/reassign-next`),
  confirmEventAllocations: (eventId) => apiClient.post(`/assignments/event/${eventId}/confirm`),
  exportEventAllocationsPdf: (eventId) =>
    apiClient.get(`/assignments/event/${eventId}/export-pdf`, { responseType: 'blob' }),
};

// Attendance APIs
export const attendanceAPI = {
  markAttendance: (data) => apiClient.post('/attendance/mark', data),
  bulkMarkAttendance: (data) => apiClient.post('/attendance/bulk-mark', data),
  uploadAttendanceProof: (formData) =>
    apiClient.post('/attendance/proof-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  submitAttendanceProof: (data) => apiClient.post('/attendance/proof', data),
  verifyAttendanceProof: (id, data) => apiClient.put(`/attendance/${id}/verify`, data),
  getAttendanceByEvent: (eventId, params) =>
    apiClient.get(`/attendance/event/${eventId}`, { params }),
  getAttendanceByVolunteer: (volunteerId, params) =>
    apiClient.get(`/attendance/volunteer/${volunteerId}`, { params }),
  getLeaderboard: (params) => apiClient.get('/attendance/leaderboard/top', { params }),
  exportLeaderboardCsv: () =>
    apiClient.get('/attendance/leaderboard/export', { responseType: 'blob' }),
  exportLeaderboardPdf: () =>
    apiClient.get('/attendance/leaderboard/export-pdf', { responseType: 'blob' }),
  exportAssignmentsCsv: (params) =>
    apiClient.get('/attendance/assignments/export', { params, responseType: 'blob' }),
  exportAssignmentsPdf: (params) =>
    apiClient.get('/attendance/assignments/export-pdf', { params, responseType: 'blob' }),
};

export default apiClient;
