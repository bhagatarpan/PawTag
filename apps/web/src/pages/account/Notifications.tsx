import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, Phone, Mail, Clock, X } from 'lucide-react';
import api from '../../lib/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Record<string, string>>({});

  useEffect(() => { api.get('/customer/notifications').then((r) => setNotifications(r.data.data)).catch(console.error).finally(() => setLoading(false)); }, []);

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

  const markRead = async (id: string) => { await api.put(`/customer/notifications/${id}/read`); setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n)); };
  const markAllRead = async () => { await api.put('/customer/notifications/mark-all-read'); setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); };
  const clearRead = async () => { await api.delete('/customer/notifications/clear-read'); setNotifications((prev) => prev.filter((n) => !n.read)); };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  const notifIcon = (type: string, read: boolean) => {
    switch (type) {
      case 'pet_lost': return <AlertTriangle size={18} className={read ? 'text-gray-400' : 'text-red-500'} />;
      case 'pet_found': return <CheckCircle size={18} className={read ? 'text-green-400' : 'text-green-500'} />;
      case 'finder_reminder': return <Bell size={18} className={read ? 'text-gray-400' : 'text-orange-500'} />;
      case 'finder_scan': return <Phone size={18} className={read ? 'text-gray-400' : 'text-blue-500'} />;
      default: return <Bell size={18} className="text-gray-400" />;
    }
  };

  const notifBorder = (n: any) => {
    if (!n.read) {
      if (n.type === 'pet_found' || n.type === 'finder_reminder') return 'border-l-4 border-l-green-500';
      if (n.priority === 'high') return 'border-l-4 border-l-red-500';
      return 'border-teal-200 bg-teal-50/30';
    }
    if (n.type === 'pet_found') return 'border-l-4 border-l-green-300 bg-green-50/30';
    return '';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && <button onClick={markAllRead} className="text-sm text-teal-600 hover:text-teal-800">Mark all read</button>}
          {readCount > 0 && <button onClick={clearRead} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1"><X size={14} /> Clear read ({readCount})</button>}
          {unreadCount > 0 && <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">{unreadCount} unread</span>}
        </div>
      </div>
      {loading ? <p className="text-gray-500">Loading...</p> : notifications.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center"><Bell size={48} className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No notifications yet.</p></div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n._id} className={`bg-white rounded-lg border p-4 flex items-start gap-3 ${notifBorder(n)}`}>
              <div className="mt-1 shrink-0">{notifIcon(n.type, n.read)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${n.read ? 'text-gray-500' : ''}`}>{n.title || 'Notification'}</p>
                  {n.priority === 'high' && !n.read && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">HIGH</span>}
                  {n.read && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Read</span>}
                </div>
                <p className={`text-sm mt-0.5 whitespace-pre-line ${n.read ? 'text-gray-400' : 'text-gray-600'}`}>{n.message}</p>
                {(n.type === 'pet_found' || n.type === 'finder_reminder') && timers[n._id] && !n.read && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-2 inline-flex items-center gap-2"><Clock size={14} className="text-blue-600" /><span className="text-sm font-mono font-semibold text-blue-700">{timers[n._id]}</span><span className="text-xs text-blue-500">since found</span></div>
                )}
                {(n.type === 'pet_found') && n.read && n.data?.foundAt && <div className="mt-2 bg-green-50 border border-green-200 rounded-md p-2 inline-flex items-center gap-2"><CheckCircle size={14} className="text-green-600" /><span className="text-sm text-green-700">Pet reunited</span></div>}
                {!n.read && n.data?.finderPhone && <a href={`tel:${n.data.finderPhone}`} className="mt-2 inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-700"><Phone size={14} /> Call Finder: {n.data.finderPhone}</a>}
                {!n.read && n.data?.finderEmail && <a href={`mailto:${n.data.finderEmail}`} className="mt-2 ml-2 inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"><Mail size={14} /> Email Finder: {n.data.finderEmail}</a>}
                <p className="text-xs text-gray-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.read && <button onClick={() => markRead(n._id)} className="text-xs text-teal-600 hover:text-teal-800 shrink-0">Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
