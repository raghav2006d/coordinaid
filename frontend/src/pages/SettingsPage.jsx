import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, User, Bell, Lock, Eye, EyeOff, Image, Phone, Building2, Calendar, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import { userAPI } from '../utils/api.js';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, login, logout, darkMode, toggleDarkMode } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    contactNumber: user?.contactNumber || '',
    department: user?.department || '',
    profileImage: user?.profileImage || '',
  });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [availability, setAvailability] = useState([]);
  const [availabilityDraft, setAvailabilityDraft] = useState({
    date: '',
    startTime: '',
    endTime: '',
  });
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success',
  });
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await userAPI.getProfile();
        const profile = response.data;
        setProfileForm({
          name: profile.name || '',
          contactNumber: profile.contactNumber || '',
          department: profile.department || '',
          profileImage: profile.profileImage || '',
        });
        setAvailability(profile.availability || []);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      setNotification({
        show: true,
        message: 'Passwords do not match',
        type: 'error',
      });
      return;
    }
    setNotification({
      show: true,
      message: 'Password updated successfully',
      type: 'success',
    });
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileImageFileChange = (e) => {
    const file = e.target.files?.[0];
    setProfileImageFile(file || null);
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setNotification({ show: false, message: '', type: 'success' });

    try {
      let updatedUser = null;

      if (profileImageFile) {
        const formData = new FormData();
        formData.append('profileImage', profileImageFile);
        const uploadResponse = await userAPI.uploadProfileImage(formData);
        updatedUser = uploadResponse.data.user;
      }

      const response = await userAPI.updateProfile({
        ...profileForm,
        profileImage: updatedUser?.profileImage || profileForm.profileImage,
      });
      updatedUser = response.data.user;
      login(updatedUser, localStorage.getItem('token'));
      setProfileImageFile(null);
      setNotification({
        show: true,
        message: 'Profile updated successfully.',
        type: 'success',
      });
    } catch (error) {
      setNotification({
        show: true,
        message: error.response?.data?.message || 'Failed to update profile.',
        type: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvailabilityDraftChange = (e) => {
    const { name, value } = e.target;
    setAvailabilityDraft((prev) => ({ ...prev, [name]: value }));
  };

  const addAvailabilitySlot = () => {
    setAvailabilityError('');
    if (!availabilityDraft.date || !availabilityDraft.startTime || !availabilityDraft.endTime) {
      setAvailabilityError('Please fill date, start time, and end time.');
      setNotification({
        show: true,
        message: 'Please fill date, start time, and end time.',
        type: 'error',
      });
      return;
    }

    const [startHour, startMinute] = availabilityDraft.startTime.split(':').map((value) => Number(value));
    const [endHour, endMinute] = availabilityDraft.endTime.split(':').map((value) => Number(value));
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) {
      setAvailabilityError('End time must be later than start time.');
      setNotification({
        show: true,
        message: 'End time must be later than start time.',
        type: 'error',
      });
      return;
    }

    const overlapExists = availability.some((slot) => {
      if (new Date(slot.date).toDateString() !== new Date(availabilityDraft.date).toDateString()) {
        return false;
      }
      const [slotStartHour, slotStartMinute] = slot.startTime.split(':').map((value) => Number(value));
      const [slotEndHour, slotEndMinute] = slot.endTime.split(':').map((value) => Number(value));
      const slotStart = slotStartHour * 60 + slotStartMinute;
      const slotEnd = slotEndHour * 60 + slotEndMinute;
      return Math.max(slotStart, startTotal) < Math.min(slotEnd, endTotal);
    });
    if (overlapExists) {
      setAvailabilityError('This availability overlaps with an existing slot.');
      setNotification({
        show: true,
        message: 'This availability overlaps with an existing slot.',
        type: 'error',
      });
      return;
    }

    setAvailability((prev) => [
      ...prev,
      {
        date: availabilityDraft.date,
        startTime: availabilityDraft.startTime,
        endTime: availabilityDraft.endTime,
      },
    ]);
    setAvailabilityDraft({ date: '', startTime: '', endTime: '' });
  };

  const removeAvailabilitySlot = (index) => {
    setAvailability((prev) => prev.filter((_, slotIndex) => slotIndex !== index));
  };

  const handleAvailabilitySave = async () => {
    try {
      setSavingAvailability(true);
      const response = await userAPI.updateAvailability({ availability });
      const updatedUser = response.data.user;
      login(updatedUser, localStorage.getItem('token'));
      setNotification({
        show: true,
        message: 'Availability updated successfully.',
        type: 'success',
      });
    } catch (error) {
      setNotification({
        show: true,
        message: error.response?.data?.message || 'Failed to update availability.',
        type: 'error',
      });
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setNotification({
        show: true,
        message: 'Please enter your current password to delete account.',
        type: 'error',
      });
      return;
    }

    if (!window.confirm('This will permanently delete your account and related data. Continue?')) {
      return;
    }

    try {
      setDeletingAccount(true);
      await userAPI.deleteOwnAccount({ currentPassword: deletePassword });
      logout();
      navigate('/register');
    } catch (error) {
      setNotification({
        show: true,
        message: error.response?.data?.message || 'Failed to delete account.',
        type: 'error',
      });
    } finally {
      setDeletingAccount(false);
      setDeletePassword('');
    }
  };

  return (
    <div className="app-shell gradient-light flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
          <Header title="Settings Studio" subtitle="Manage profile, availability, and account controls with a cleaner bright workspace." showUserProfile={true} />
        
        <div className="mx-auto max-w-5xl px-2 pb-8">
          {/* Notification */}
          {notification.show && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg ${
                notification.type === 'success'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-red-100 text-red-700 border border-red-300'
              }`}
            >
              {notification.message}
            </motion.div>
          )}

          <div className="grid gap-8">
            {/* Account Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="shell-panel rounded-[28px] border-0 p-7"
            >
              <div className="flex items-center gap-3 mb-6">
                <User className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold">Account Settings</h2>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-6">
                {loadingProfile && (
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    Loading profile...
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                      {profileForm.profileImage ? (
                        <img
                          src={profileForm.profileImage}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image className="text-gray-500" size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Profile Image
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageFileChange}
                        className="input-field"
                      />
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Upload a JPG, PNG, or WebP image (max 5MB).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300 font-medium">
                      {user?.email}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contact Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-gray-500" size={18} />
                      <input
                        type="text"
                        name="contactNumber"
                        value={profileForm.contactNumber}
                        onChange={handleProfileChange}
                        className="input-field pl-10"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Department
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 text-gray-500" size={18} />
                      <input
                        type="text"
                        name="department"
                        value={profileForm.department}
                        onChange={handleProfileChange}
                        className="input-field pl-10"
                        placeholder="Operations"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Role
                    </label>
                    <div className="px-4 py-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                      <span className="px-3 py-1 bg-primary-600 text-white rounded-full text-sm font-semibold capitalize">
                        {user?.role}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </motion.div>

            {/* Availability Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="shell-panel rounded-[28px] border-0 p-7"
            >
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold">Availability</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <input
                  type="date"
                  name="date"
                  value={availabilityDraft.date}
                  onChange={handleAvailabilityDraftChange}
                  className="input-field"
                />
                <input
                  type="time"
                  name="startTime"
                  value={availabilityDraft.startTime}
                  onChange={handleAvailabilityDraftChange}
                  className="input-field"
                />
                <input
                  type="time"
                  name="endTime"
                  value={availabilityDraft.endTime}
                  onChange={handleAvailabilityDraftChange}
                  className="input-field"
                />
              </div>

              {availabilityError && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {availabilityError}
                </div>
              )}

              <button
                type="button"
                onClick={addAvailabilitySlot}
                className="mb-6 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                <Plus size={18} />
                Add time slot
              </button>

              <div className="space-y-3">
                {availability.length === 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No availability slots added yet.
                  </p>
                )}
                {availability.map((slot, index) => (
                  <div
                    key={`${slot.date}-${slot.startTime}-${index}`}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-200">
                        {new Date(slot.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {slot.startTime} - {slot.endTime}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAvailabilitySlot(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAvailabilitySave}
                disabled={savingAvailability}
                className="mt-6 w-full px-4 py-3 bg-secondary-600 text-white rounded-lg font-medium hover:bg-secondary-700 transition-colors disabled:opacity-50"
              >
                {savingAvailability ? 'Saving...' : 'Save availability'}
              </button>
            </motion.div>

            {/* Security Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="shell-panel rounded-[28px] border-0 p-7"
            >
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-6 h-6 text-secondary-600" />
                <h2 className="text-2xl font-bold">Security</h2>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    placeholder="Enter current password"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      placeholder="Enter new password"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-600 dark:text-gray-400"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-secondary-600 text-white rounded-lg font-medium hover:bg-secondary-700 transition-colors"
                >
                  Update Password
                </button>
              </form>
            </motion.div>

            {/* Preferences */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="shell-panel rounded-[28px] border-0 p-7"
            >
              <div className="flex items-center gap-3 mb-6">
                <Bell className="w-6 h-6 text-orange-600" />
                <h2 className="text-2xl font-bold">Preferences</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {darkMode ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      darkMode
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {darkMode ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Notifications are enabled. You will receive updates about events and assignments.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Logout Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-[28px] border border-[#f3d4ce] bg-[#fff4f1] p-7"
            >
              <div className="flex items-center gap-3 mb-4">
                <LogOut className="w-6 h-6 text-red-600 dark:text-red-400" />
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Logout</h2>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Click the button below to logout from your account. You'll be redirected to the login page.
              </p>

              <button
                onClick={handleLogout}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-bold text-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={24} />
                Logout
              </button>
            </motion.div>

            {/* Danger Zone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="shell-panel rounded-[28px] border-0 border-l-4 border-red-500 p-7"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                These actions cannot be undone. Please proceed with caution.
              </p>
              <div className="space-y-3">
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className="input-field"
                  placeholder="Enter current password to confirm"
                />
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingAccount ? 'Deleting account...' : 'Delete Account'}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default SettingsPage;
