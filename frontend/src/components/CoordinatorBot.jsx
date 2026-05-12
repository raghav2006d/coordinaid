import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { assistantAPI } from '../utils/api.js';

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'bot',
  text: 'Coordinator Bot is ready. Ask about your role, event, volunteers, or availability.',
  timestamp: new Date().toISOString(),
};

const QUICK_ACTIONS_FALLBACK = [
  'What is my assigned role?',
  'When is my event?',
  'Show volunteers',
  'Show my availability',
];

const REQUIRED_QUICK_ACTIONS = [
  { label: 'My Role', query: 'What is my assigned role?' },
  { label: 'My Event', query: 'When is my event?' },
  { label: 'Show Volunteers', query: 'List volunteers for this event' },
];

const createMessage = (role, text) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  timestamp: new Date().toISOString(),
});

const getPageLabel = (pathname) => {
  if (pathname.startsWith('/events')) return 'Events';
  if (pathname.startsWith('/allocation')) return 'Allocation';
  if (pathname.startsWith('/assignments')) return 'Assignments';
  if (pathname.startsWith('/attendance')) return 'Attendance';
  if (pathname.startsWith('/analytics')) return 'Analytics';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  return 'Workspace';
};

const extractEventId = (pathname = '') => {
  const segments = pathname.split('/').filter(Boolean);
  return segments.find((segment) => /^[a-f\d]{24}$/i.test(segment)) || null;
};

const CoordinatorBot = ({ user }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [quickActions, setQuickActions] = useState(QUICK_ACTIONS_FALLBACK);
  const [reminders, setReminders] = useState([]);
  const messagesRef = useRef(null);

  const context = useMemo(
    () => ({
      currentPath: location.pathname,
      pageLabel: getPageLabel(location.pathname),
      eventId: extractEventId(location.pathname),
    }),
    [location.pathname]
  );

  const historyKey = useMemo(() => {
    if (!user?._id) return '';
    return `coordinator-bot-history-${user._id}`;
  }, [user?._id]);

  useEffect(() => {
    if (!historyKey) return;

    const saved = localStorage.getItem(historyKey);
    if (!saved) {
      setMessages([INITIAL_MESSAGE]);
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        setMessages(parsed.slice(-40));
      } else {
        setMessages([INITIAL_MESSAGE]);
      }
    } catch (error) {
      setMessages([INITIAL_MESSAGE]);
    }
  }, [historyKey]);

  useEffect(() => {
    if (!historyKey) return;
    localStorage.setItem(historyKey, JSON.stringify(messages.slice(-40)));
  }, [historyKey, messages]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isTyping, isOpen]);

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const response = await assistantAPI.getSuggestions({ context });
      setQuickActions(response.data.suggestions?.length ? response.data.suggestions : QUICK_ACTIONS_FALLBACK);
      setReminders(response.data.reminders || []);
    } catch (error) {
      setQuickActions(QUICK_ACTIONS_FALLBACK);
      setReminders([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleToggle = async () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      await loadSuggestions();
    }
  };

  const sendQuery = async (queryText) => {
    const trimmed = String(queryText || '').trim();
    if (!trimmed || isTyping) return;

    const userMessage = createMessage('user', trimmed);
    setMessages((current) => [...current, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const [response] = await Promise.all([
        assistantAPI.query({ query: trimmed, context }),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ]);

      const botReply =
        response.data?.response ||
        'I could not fetch that right now. Please try again in a moment.';

      setMessages((current) => [...current, createMessage('bot', botReply)]);
      if (Array.isArray(response.data?.quickSuggestions) && response.data.quickSuggestions.length) {
        setQuickActions(response.data.quickSuggestions);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage('bot', 'I hit a temporary issue while fetching that. Please try again.'),
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendQuery(inputValue);
  };

  if (!user || !['volunteer', 'organizer', 'admin'].includes(user.role)) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3">
      {isOpen && (
        <div className="pointer-events-auto w-[calc(100vw-1.5rem)] max-w-[390px] rounded-[24px] border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between rounded-t-[24px] bg-gradient-to-r from-[#3348ff] via-[#5f55ff] to-[#7a4dff] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot size={18} />
              <div>
                <p className="text-sm font-bold">Coordinator Bot</p>
                <p className="text-[11px] opacity-90">{context.pageLabel} context</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-white/20 p-1.5 transition hover:bg-white/30"
            >
              <X size={14} />
            </button>
          </div>

          <div className="border-b border-[#ecebff] px-4 py-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {REQUIRED_QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => sendQuery(action.query)}
                  className="rounded-full bg-[#eef0ff] px-3 py-1.5 text-xs font-semibold text-[#3e45b6] transition hover:bg-[#dfe3ff]"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mb-2 flex flex-wrap gap-2">
              {(quickActions || QUICK_ACTIONS_FALLBACK).slice(0, 2).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => sendQuery(action)}
                  className="rounded-full bg-[#f6f7ff] px-3 py-1.5 text-[11px] font-semibold text-[#5a56a1] transition hover:bg-[#edf0ff]"
                >
                  {action}
                </button>
              ))}
            </div>

            {loadingSuggestions ? (
              <p className="text-xs text-[#6a5d54]">Loading smart suggestions...</p>
            ) : reminders.length ? (
              <div className="rounded-2xl bg-[#f5f6ff] px-3 py-2 text-xs text-[#4f4a79]">
                <p className="mb-1 flex items-center gap-1 font-semibold text-[#3d3a66]">
                  <Sparkles size={12} />
                  Smart Reminder
                </p>
                <p>{reminders[0]}</p>
              </div>
            ) : null}
          </div>

          <div ref={messagesRef} className="h-[320px] overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-[#3b59ff] to-[#6e52ff] text-white'
                        : 'bg-[#f2f3ff] text-[#2f2a50]'
                    }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-[#f2f3ff] px-3 py-2 text-sm text-[#2f2a50]">
                    <div className="flex items-center gap-1">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="ml-1 text-xs text-[#5f5a7a]">AI is typing...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#ecebff] p-3">
            <div className="flex items-center gap-2">
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask something..."
                className="input-field h-11 rounded-xl"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#3348ff] to-[#6d50ff] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#2f52ff] via-[#4f5bff] to-[#7a4dff] text-white shadow-[0_18px_34px_rgba(58,77,255,0.45)] transition hover:scale-105"
      >
        <MessageCircle size={22} />
      </button>
    </div>
  );
};

export default CoordinatorBot;
