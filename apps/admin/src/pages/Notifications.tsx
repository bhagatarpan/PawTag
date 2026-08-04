import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';

interface AdminNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  priority: string;
  createdAt: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/admin/notifications');
      setNotifications(res.data.data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/admin/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch {
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/admin/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const viewOrder = (orderId: string | unknown) => {
    if (orderId) window.location.href = `/orders?id=${orderId}`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse text-gray-500">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell size={24} />
            Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            <CheckCheck size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Bell size={48} className="mx-auto mb-4 opacity-30" />
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif._id}
              className={`p-4 rounded-lg border flex items-start gap-3 ${
                notif.read
                  ? 'bg-white border-gray-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                notif.read ? 'bg-gray-300' : 'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-medium ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {notif.title}
                  </h3>
                  {notif.priority === 'high' && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">High</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(notif.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {typeof notif.data?.orderId === 'string' && (
                  <button
                    onClick={() => viewOrder(notif.data?.orderId as string)}
                    className="text-primary-600 hover:text-primary-800 text-sm flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                    View
                  </button>
                )}
                {!notif.read && (
                  <button
                    onClick={() => markAsRead(notif._id)}
                    className="text-gray-500 hover:text-gray-700 text-xs"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
