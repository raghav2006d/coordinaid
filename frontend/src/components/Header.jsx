import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationAPI } from '../utils/api.js';

const Header = ({ title, subtitle, icon, showUserProfile = true }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const [listRes, countRes] = await Promise.all([
        notificationAPI.getNotifications({ limit: 6 }),
        notificationAPI.getUnreadCount(),
      ]);
      setNotifications(listRes.data.notifications || []);
      setUnreadCount(countRes.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (!showUserProfile) {
      return;
    }
    fetchNotifications();
  }, [showUserProfile]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const handleOpenNotifications = async () => {
    const nextOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpen);
    if (nextOpen) {
      await fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <>
      {showUserProfile && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative z-[70] mb-8 flex items-center justify-between rounded-[28px] border border-[rgba(76,63,145,0.14)] bg-white/70 px-5 py-4 shadow-sm backdrop-blur"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#766e97]">Control Center</p>
            <p className="mt-1 text-sm text-[#5f5a7a]">Track energy, coordination, and volunteer momentum in one place.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={handleOpenNotifications}
                className="interactive-lift relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ddd5fb] bg-[#f8f5ff] text-[#5b3cc4]"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#7f2ea8] px-1 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 z-[90] mt-3 w-80 rounded-[24px] border border-[rgba(76,63,145,0.14)] bg-[rgba(250,247,255,0.98)] p-3 shadow-2xl"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-[#1d1736]">Notifications</p>
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-[#5b3cc4] hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>

                    {loadingNotifications ? (
                      <div className="rounded-2xl bg-white/70 px-4 py-4 text-sm text-[#5f5a7a]">
                        Loading notifications...
                      </div>
                    ) : notifications.length ? (
                      <div className="space-y-2">
                        {notifications.map((note) => (
                          <button
                            key={note._id}
                            onClick={() => handleMarkAsRead(note._id)}
                            className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition ${
                              note.isRead ? 'bg-white/70 text-[#5f5a7a]' : 'bg-[#f1ecff] text-[#1d1736]'
                            }`}
                          >
                            <p className="font-semibold">{note.title}</p>
                            <p className="mt-1 text-xs">{note.message}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-white/70 px-4 py-4 text-sm text-[#5f5a7a]">
                        No notifications yet.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={profileRef}>
              <motion.button
                type="button"
                onClick={() => setIsDropdownOpen((open) => !open)}
                whileTap={{ scale: 0.98 }}
                className="interactive-lift flex items-center gap-3 rounded-2xl bg-[#1d1736] px-4 py-2.5 text-white shadow-lg"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12">
                  <User size={17} />
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-none">{user?.name?.split(' ')[0]}</p>
                  <p className="mt-1 text-xs capitalize text-violet-100">{user?.role}</p>
                </div>
                <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </motion.button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 z-[90] mt-3 w-56 rounded-[24px] border border-[rgba(76,63,145,0.14)] bg-[rgba(250,247,255,0.98)] p-2 shadow-2xl"
                  >
                    <div className="rounded-2xl bg-[#f1ecff] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#766e97]">Account</p>
                      <p className="mt-2 text-sm font-bold text-[#1d1736]">{user?.name}</p>
                      <p className="text-xs capitalize text-[#5f5a7a]">{user?.role}</p>
                    </div>

                    <div className="mt-2 space-y-1">
                      <Link
                        to="/settings"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[#403b63] transition hover:bg-[#f1ecff]"
                      >
                        <Settings size={16} />
                        <span>Settings</span>
                      </Link>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[#7f2ea8] transition hover:bg-[#f6eeff]"
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-4">
              {icon && (
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#1d1736] text-white shadow-glow">
                  {icon}
                </div>
              )}
              <span className="animate-gradient-shift rounded-full bg-gradient-to-r from-[#e4dcff] via-[#dff7ee] to-[#e4dcff] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-[#5b3cc4]">
                Live Workspace
              </span>
            </div>

            <h1 className="max-w-2xl text-4xl font-black leading-tight text-[#1d1736] md:text-6xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#5f5a7a] md:text-lg">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default Header;
