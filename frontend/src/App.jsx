import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';

// Pages
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VolunteerDashboard from './pages/VolunteerDashboard.jsx';
import OrganizerDashboard from './pages/OrganizerDashboard.jsx';
import AssignmentHistoryPage from './pages/AssignmentHistoryPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import CreateEventPage from './pages/CreateEventPage.jsx';
import EditEventPage from './pages/EditEventPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import AllocationPage from './pages/AllocationPage.jsx';
import AssignmentPage from './pages/AssignmentPage.jsx';
import AttendancePage from './pages/AttendancePage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import CoordinatorBot from './components/CoordinatorBot.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-light">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const ProtectedRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  const RoleBasedRoute = ({ children, allowedRoles }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, darkMode, toggleDarkMode }}>
      <Router>
        <div className={darkMode ? 'dark' : ''}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
            <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" /> : <ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={user ? <Navigate to="/dashboard" /> : <ResetPasswordPage />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                user ? (
                  <>
                    {user.role === 'volunteer' && <VolunteerDashboard />}
                    {user.role === 'organizer' && <OrganizerDashboard />}
                    {user.role === 'admin' && <AdminDashboard />}
                  </>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Volunteer Routes */}
            <Route
              path="/assignments"
              element={
                <RoleBasedRoute allowedRoles={['volunteer']}>
                  <AssignmentPage />
                </RoleBasedRoute>
              }
            />

            {/* Organizer Routes */}
            <Route
              path="/events/create"
              element={
                <RoleBasedRoute allowedRoles={['organizer', 'admin']}>
                  <CreateEventPage />
                </RoleBasedRoute>
              }
            />

            <Route
              path="/events"
              element={
                <RoleBasedRoute allowedRoles={['organizer', 'admin']}>
                  <EventsPage />
                </RoleBasedRoute>
              }
            />

            <Route
              path="/events/:id/edit"
              element={
                <RoleBasedRoute allowedRoles={['organizer', 'admin']}>
                  <EditEventPage />
                </RoleBasedRoute>
              }
            />

            <Route
              path="/allocation"
              element={
                <RoleBasedRoute allowedRoles={['organizer', 'admin']}>
                  <AllocationPage />
                </RoleBasedRoute>
              }
            />

            <Route
              path="/assignments/history"
              element={
                <RoleBasedRoute allowedRoles={['organizer', 'admin']}>
                  <AssignmentHistoryPage />
                </RoleBasedRoute>
              }
            />

            <Route
              path="/attendance"
              element={
                <RoleBasedRoute allowedRoles={['organizer', 'admin']}>
                  <AttendancePage />
                </RoleBasedRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <RoleBasedRoute allowedRoles={['organizer', 'admin']}>
                  <AnalyticsPage />
                </RoleBasedRoute>
              }
            />

            {/* Settings Route */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <CoordinatorBot user={user} />
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
