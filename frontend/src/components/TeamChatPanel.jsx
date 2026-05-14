import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Megaphone, MessageCircle, RefreshCcw, Send } from 'lucide-react';
import { teamAPI } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const TeamChatPanel = ({ team }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [announcementInput, setAnnouncementInput] = useState('');
  const [actionState, setActionState] = useState({ key: '', message: '', type: 'idle' });
  const listRef = useRef(null);

  const canAnnounce = useMemo(
    () => ['organizer', 'admin'].includes(user?.role),
    [user?.role]
  );

  const fetchMessages = async () => {
    if (!team?._id) return;
    try {
      setLoading(true);
      const response = await teamAPI.getTeamMessages(team._id, { limit: 60 });
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load team chat:', error);
      setActionState({
        key: '',
        type: 'error',
        message: error.response?.data?.message || 'Could not load team chat.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [team?._id]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const content = chatInput.trim();
    if (!content || !team?._id) return;

    try {
      setActionState({ key: 'chat', type: 'idle', message: '' });
      const response = await teamAPI.sendTeamMessage(team._id, { content });
      setMessages((current) => [...current, response.data.teamMessage]);
      setChatInput('');
    } catch (error) {
      setActionState({
        key: '',
        type: 'error',
        message: error.response?.data?.message || 'Failed to send message.',
      });
    } finally {
      setActionState((current) => ({ ...current, key: '' }));
    }
  };

  const sendAnnouncement = async () => {
    const content = announcementInput.trim();
    if (!content || !team?._id) return;

    try {
      setActionState({ key: 'announcement', type: 'idle', message: '' });
      const response = await teamAPI.sendTeamAnnouncement(team._id, { content });
      setMessages((current) => [...current, response.data.teamMessage]);
      setAnnouncementInput('');
      setActionState({
        key: '',
        type: 'success',
        message: 'Announcement posted to team chat.',
      });
    } catch (error) {
      setActionState({
        key: '',
        type: 'error',
        message: error.response?.data?.message || 'Failed to send announcement.',
      });
    } finally {
      setActionState((current) => ({ ...current, key: '' }));
    }
  };

  if (!team?._id) return null;

  return (
    <div className="rounded-2xl bg-white/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#766e97]">
          <MessageCircle size={14} />
          Secure Team Chat
        </p>
        <button
          type="button"
          onClick={fetchMessages}
          className="rounded-xl bg-[#f8f5ff] p-2 text-[#5b3cc4] transition hover:bg-[#efe7ff]"
          disabled={loading}
        >
          <RefreshCcw size={13} />
        </button>
      </div>

      {actionState.message && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-xs font-medium ${
            actionState.type === 'success' ? 'bg-[#eef8f3] text-[#0f9f75]' : 'bg-[#fff1ee] text-[#7f2ea8]'
          }`}
        >
          {actionState.message}
        </div>
      )}

      <div
        ref={listRef}
        className="max-h-56 overflow-y-auto rounded-xl border border-[#eee9ff] bg-[#fcfbff] p-2"
      >
        {loading ? (
          <p className="px-2 py-2 text-xs text-[#5f5a7a]">Loading messages...</p>
        ) : messages.length ? (
          <div className="space-y-2">
            {messages.map((message) => (
              <div key={message._id} className="rounded-lg bg-white px-2.5 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#1d1736]">
                    {message.senderId?.name || 'Team user'}
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-[#766e97]">
                      {message.messageType === 'announcement' ? 'Announcement' : 'Message'}
                    </span>
                  </p>
                  <p className="text-[10px] text-[#766e97]">
                    {message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}
                  </p>
                </div>
                <p className="text-xs leading-5 text-[#403b63]">{message.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-2 py-2 text-xs text-[#5f5a7a]">No messages yet.</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder="Send a secure team message"
          className="input-field text-sm"
          maxLength={1500}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={actionState.key === 'chat' || !chatInput.trim()}
          className="flex items-center gap-1 rounded-xl bg-[#1d1736] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2b2457] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={13} />
          <span>{actionState.key === 'chat' ? 'Sending' : 'Send'}</span>
        </button>
      </div>

      {canAnnounce && (
        <div className="mt-3 rounded-xl bg-[#f2f6ff] p-2">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b46c8]">
            <Megaphone size={12} />
            Team Announcement
          </p>
          <div className="flex gap-2">
            <input
              value={announcementInput}
              onChange={(event) => setAnnouncementInput(event.target.value)}
              placeholder="Post announcement to team members"
              className="input-field text-sm"
              maxLength={2000}
            />
            <button
              type="button"
              onClick={sendAnnouncement}
              disabled={actionState.key === 'announcement' || !announcementInput.trim()}
              className="rounded-xl bg-[#4b46c8] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3f3aaa] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionState.key === 'announcement' ? 'Posting' : 'Announce'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamChatPanel;
