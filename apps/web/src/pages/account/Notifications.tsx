import { useState, useEffect } from 'react';
import {
  Bell, AlertTriangle, CheckCircle, Phone, Mail, Clock, X,
  QrCode, Info,
} from 'lucide-react';
import { EmptyState } from '@pawtag/ui';
import api from '../../lib/api';
import type { Notification } from '../../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div className="bg-white rounded-lg border p-4 animate-shimmer">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-full mb-1" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/customer/notifications')
      .then((r) => setNotifications(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimers: Record<string, string> = {};
      notifications.forEach((n) => {
        if ((n.type === 'pet_found' || n.type === 'finder_reminder') && n.data?.foundAt && !n.read) {
          const elapsed = Date.now() - new Date(n.data.foundAt).getTime();
          if (elapsed > 0) {
            const hours = Math.floor(elapsed / (1000 * 60 * 60));
            const mins = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
            newTimers[n._id] = `${hours}h ${mins}m`;
          }
        }
      });
      setTimers(newTimers);
    }, 1000);
    return () => clearInterval(interval);
  }, [notifications]);

  const markRead = async (id: string) => {
    try {
      await api.put(`/customer/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/customer/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const clearRead = async () => {
    try {
      await api.delete('/customer/notifications/clear-read');
      setNotifications((prev) => prev.filter((n) => !n.read));
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  const notifIcon = (type: string, read: boolean) => {
    switch (type) {
      case 'pet_lost': return <AlertTriangle size={18} className={read ? 'text-gray-400' : 'text-red-500'} />;
      case 'pet_found': return <CheckCircle size={18} className={read ? 'text-gray-400' : 'text-green-500'} />;
      case 'finder_reminder': return <Bell size={18} className={read ? 'text-gray-400' : 'text-orange-500'} />;
      case 'finder_scan': return <QrCode size={18} className={read ? 'text-gray-400' : 'text-blue-500'} />;
      case 'order_update': return <Info size={18} className={read ? 'text-gray-400' : 'text-blue-500'} />;
      default: return <Bell size={18} className="text-gray-400" />;
    }
  };

  const notifBorder = (n: Notification) => {
    if (!n.read) {
      if (n.type === 'pet_found' || n.type === 'finder_reminder') return 'border-l-4 border-l-green-500';
      if (n.priority === 'high') return 'border-l-4 border-l-red-500';
      return 'border-teal-200 bg-teal-50/30';
    }
    if (n.type === 'pet_found') return 'border-l-4 border-l-green-300 bg-green-50/30';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Stay updated on your pets and orders.</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-sm text-teal-600 hover:text-teal-800 font-medium">
              Mark all read
            </button>
          )}
          {readCount > 0 && (
            <button onClick={clearRead} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1">
              <X size={14} /> Clear read ({readCount})
            </button>
          )}
          {unreadCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={20} className="text-gray-400" />}
          message="No notifications yet"
          description="You'll see updates about your pets and orders here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`bg-white rounded-lg border p-4 flex items-start gap-3 transition-colors ${notifBorder(n)}`}
            >
              <div className="mt-1 shrink-0">{notifIcon(n.type, n.read)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${n.read ? 'text-gray-500' : 'text-gray-900'}`}>
                    {n.title || 'Notification'}
                  </p>
                  {n.priority === 'high' && !n.read && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">HIGH</span>
                  )}
                  {n.read && (
                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Read</span>
                  )}
                </div>
                <p className={`text-sm mt-0.5 whitespace-pre-line ${n.read ? 'text-gray-400' : 'text-gray-600'}`}>
                  {n.message}
                </p>

                {/* Found timer */}
                {(n.type === 'pet_found' || n.type === 'finder_reminder') && timers[n._id] && !n.read && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-2 inline-flex items-center gap-2">
                    <Clock size={14} className="text-blue-600" />
                    <span className="text-sm font-mono font-semibold text-blue-700">{timers[n._id]}</span>
                    <span className="text-xs text-blue-500">since found</span>
                  </div>
                )}

                {/* Reunited badge */}
                {n.type === 'pet_found' && n.read && n.data?.foundAt && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-md p-2 inline-flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="text-sm text-green-700">Pet reunited</span>
                  </div>
                )}

                {/* Finder contact actions */}
                {!n.read && n.data?.finderPhone && (
                  <a
                    href={`tel:${n.data.finderPhone}`}
                    className="mt-2 inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Phone size={14} /> Call Finder: {n.data.finderPhone}
                  </a>
                )}
                {!n.read && n.data?.finderEmail && (
                  <a
                    href={`mailto:${n.data.finderEmail}`}
                    className="mt-2 ml-2 inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Mail size={14} /> Email Finder: {n.data.finderEmail}
                  </a>
                )}

                <p className="text-xs text-gray-400 mt-2">{formatDateTime(n.createdAt)}</p>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead(n._id)}
                  className="text-xs text-teal-600 hover:text-teal-800 shrink-0 font-medium"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
