import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi } from '../../api/notifications';

export default function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotifs, setLatestNotifs] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch unread count & setup polling (every 30s)
  const fetchUnreadCount = async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      if (res.success && res.data) {
        setUnreadCount(res.data.unread_count);
      }
    } catch (err) {
      // quiet fail on background poll
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch latest 8 notifications when dropdown opens
  const fetchLatest = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getList({ page: 1, limit: 8 });
      if (res.success && res.data) {
        setLatestNotifs(res.data.items || []);
      }
    } catch (err) {
      console.error('Error fetching latest notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      fetchLatest();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setLatestNotifs((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await notificationsApi.markRead(notif.notification_id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setLatestNotifs((prev) =>
          prev.map((n) => (n.notification_id === notif.notification_id ? { ...n, is_read: 1 } : n))
        );
      }
    } catch (err) {
      // quiet fail
    }
    setIsOpen(false);

    const type = notif.notification_type || notif.type;
    if (type === 'VERIFICATION_REQUEST' && notif.verification_id) {
      navigate(`/officer/incoming/${notif.verification_id}`);
    } else if (notif.application_id) {
      if (user?.role === 'CITIZEN') {
        navigate(`/citizen/applications/${notif.application_id}`);
      } else {
        navigate(`/officer/applications/${notif.application_id}`);
      }
    } else {
      navigate('/notifications');
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-muted hover:text-ink hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary-100"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-soft border border-line z-50 overflow-hidden animate-scaleUp">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-ink">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {loading ? (
              <div className="py-8 text-center text-xs text-muted">Loading notifications...</div>
            ) : latestNotifs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">No notifications right now</div>
            ) : (
              latestNotifs.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 text-left cursor-pointer transition hover:bg-slate-50 flex items-start gap-3 ${
                    !n.is_read ? 'bg-primary-50/40' : ''
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      !n.is_read ? 'bg-primary-600' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">{n.title}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-line text-center bg-slate-50/70">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="w-full py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1 rounded-lg hover:bg-primary-50 transition"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
