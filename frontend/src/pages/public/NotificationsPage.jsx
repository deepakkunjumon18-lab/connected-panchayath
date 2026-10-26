import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, CheckCircle2, Clock, Filter, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi } from '../../api/notifications';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        unread: filter === 'UNREAD' ? '1' : undefined
      };
      const res = await notificationsApi.getList(params);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [page, filter]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setData((prev) => ({
        ...prev,
        items: prev.items.map((n) => (n.notification_id === id ? { ...n, is_read: 1 } : n))
      }));
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      toast.success('All notifications marked as read');
      setData((prev) => ({
        ...prev,
        items: prev.items.map((n) => ({ ...n, is_read: 1 }))
      }));
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="System alerts, inter-panchayat verification requests, and status updates"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={CheckCheck}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setFilter('ALL');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-primary-600 text-white shadow-soft-sm'
                : 'bg-white border border-line text-muted hover:text-ink'
            }`}
          >
            All Notifications
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('UNREAD');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'UNREAD'
                ? 'bg-primary-600 text-white shadow-soft-sm'
                : 'bg-white border border-line text-muted hover:text-ink'
            }`}
          >
            Unread Only
          </button>
        </div>

        <span className="text-xs text-muted">
          Total: <strong className="text-ink">{data.total}</strong>
        </span>
      </div>

      {/* Notification List */}
      <Card className="divide-y divide-line p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted">
            <Spinner size="md" className="mx-auto mb-2 text-primary-600" />
            <p className="text-xs">Loading notifications...</p>
          </div>
        ) : data.items.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title={filter === 'UNREAD' ? 'No unread notifications' : 'No notifications'}
              message="You are all caught up! Updates regarding applications and verification requests will appear here."
            />
          </div>
        ) : (
          data.items.map((n) => (
            <div
              key={n.notification_id}
              className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition ${
                !n.is_read ? 'bg-primary-50/40' : 'hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    !n.is_read ? 'bg-primary-600 text-white' : 'bg-slate-100 text-muted'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-ink">{n.title}</h4>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{n.message}</p>
                  <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </p>
                </div>
              </div>

              {!n.is_read && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkRead(n.notification_id);
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline shrink-0 font-medium"
                >
                  Mark read
                </button>
              )}

              {(n.application_id || n.verification_id) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!n.is_read) handleMarkRead(n.notification_id);
                    const type = n.notification_type || n.type;
                    if (type === 'VERIFICATION_REQUEST' && n.verification_id) {
                      navigate(`/officer/incoming/${n.verification_id}`);
                    } else if (n.application_id) {
                      if (user?.role === 'CITIZEN') {
                        navigate(`/citizen/applications/${n.application_id}`);
                      } else {
                        navigate(`/officer/applications/${n.application_id}`);
                      }
                    }
                  }}
                  className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline shrink-0 ml-2"
                >
                  <span>View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </Card>

      <Pagination
        currentPage={page}
        totalItems={data.total}
        pageSize={10}
        onPageChange={setPage}
      />
    </div>
  );
}
