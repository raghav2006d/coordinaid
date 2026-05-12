import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  BrainCircuit,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const iconMap = {
  dashboard: Home,
  skills: Sparkles,
  availability: CalendarRange,
  assignments: ClipboardList,
  history: CheckSquare,
  create: Sparkles,
  allocation: BrainCircuit,
  volunteers: Users,
  attendance: CheckSquare,
  reports: BarChart3,
  users: Users,
  events: CalendarRange,
};

const Sidebar = () => {
  const { user, logout, darkMode, toggleDarkMode } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = {
    volunteer: [
      { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
      { label: 'Skills', path: '/dashboard#skills', icon: 'skills' },
      { label: 'Availability', path: '/dashboard#availability', icon: 'availability' },
      { label: 'Assignments', path: '/assignments', icon: 'assignments' },
      { label: 'History', path: '/dashboard#history', icon: 'history' },
    ],
    organizer: [
      { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
      { label: 'Create Event', path: '/events/create', icon: 'create' },
      { label: 'AI Allocation', path: '/allocation', icon: 'allocation' },
      { label: 'Volunteers', path: '/dashboard#volunteers', icon: 'volunteers' },
      { label: 'Attendance', path: '/attendance', icon: 'attendance' },
      { label: 'Reports', path: '/analytics', icon: 'reports' },
    ],
    admin: [
      { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
      { label: 'Users', path: '/dashboard#users', icon: 'users' },
      { label: 'Events', path: '/dashboard#events', icon: 'events' },
      { label: 'Reports', path: '/analytics', icon: 'reports' },
    ],
  };

  const items = menuItems[user?.role] || [];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 rounded-2xl border border-white/50 bg-white/80 p-3 text-[#5b3cc4] shadow-lg backdrop-blur md:hidden"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <motion.aside
        initial={{ x: -320 }}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ duration: 0.35 }}
        className="shell-panel fixed left-0 top-0 z-40 flex h-screen w-[285px] flex-col rounded-r-[32px] px-5 py-6 md:relative md:translate-x-0"
      >
        <div className="surface-glow bright-grid relative mb-8 mt-12 rounded-[28px] gradient-primary px-5 py-6 text-white shadow-glow md:mt-0">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Sparkles size={22} />
          </div>
          <h1 className="relative text-2xl font-bold">SmartVolunteer</h1>
          <p className="relative mt-2 text-sm text-violet-100">Volunteer operations with a smarter, premium control panel.</p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {items.map((item) => {
            const Icon = iconMap[item.icon] || Home;
            const isActive =
              item.path === '/dashboard'
                ? location.pathname === '/dashboard'
                : item.path.startsWith('/dashboard#')
                ? location.pathname === '/dashboard'
                : location.pathname === item.path;

            return (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`interactive-lift flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                  isActive
                    ? 'bg-[#1d1736] text-white shadow-lg'
                    : 'text-[#403b63] hover:bg-white/70'
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    isActive ? 'bg-white/12 text-white' : 'bg-[#f1ecff] text-[#5b3cc4]'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="text-sm font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-[28px] bg-white/70 p-4 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4dcff] text-[#5b3cc4]">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-[#766e97]">Signed in</p>
              <p className="truncate text-sm font-bold text-[#1d1736]">{user?.name}</p>
              <p className="mt-1 text-xs capitalize text-[#5f5a7a]">{user?.role}</p>
            </div>
          </div>

          <button
            onClick={toggleDarkMode}
            className="interactive-lift mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ddd5fb] bg-[#f8f5ff] px-4 py-3 text-sm font-semibold text-[#403b63] transition hover:bg-white"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>{darkMode ? 'Light' : 'Dark'} Mode</span>
          </button>

          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="interactive-lift mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ddd5fb] bg-white px-4 py-3 text-sm font-semibold text-[#403b63] transition hover:bg-[#f8f5ff]"
          >
            <Settings size={18} />
            <span>Settings</span>
          </Link>

          <button
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
            className="interactive-lift flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1736] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2457]"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#1d1736]/45 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
