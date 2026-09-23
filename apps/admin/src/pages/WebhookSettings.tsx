import { useEffect, useState, useCallback } from 'react';
import { API } from '@pawtag/shared/api';
import { RefreshCw, Zap, AlertTriangle, CheckCircle, XCircle, Clock, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface WebhookStats {
  totalEventsLast24h: number;
  completed: number;
  failed: number;
  deadLettered: number;
  successRate: number;
}

interface WebhookEvent {
  event: string;
  eventId: string;
  status: string;
  attempts: number;
  createdAt: string;
  processedAt?: string;
  lastError?: string;
}

interface DeadLetterEvent {
  _id: string;
  event: string;
  eventId: string;
  source: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

function StatBadge({ label, value, variant }: { label: string; value: string | number; variant?: 'success' | 'warning' | 'danger' | 'info' }) {
  const colors = {
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${colors[variant || 'info']}`}>
      <span className="font-medium">{value}</span>
      <span className="opacity-75">{label}</span>
    </div>
  );
}

export default function WebhookSettings() {
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [deadLetters, setDeadLetters] = useState<DeadLetterEvent[]>([]);
  const [showDeadLetters, setShowDeadLetters] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(API.admin.webhooks.status);
      setStats(res.data.data.stats);
      setRecentEvents(res.data.data.recentEvents || []);
    } catch {
      toast.error('Failed to load webhook status');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeadLetters = useCallback(async () => {
    try {
      const res = await api.get(API.admin.webhooks.deadLetter);
      setDeadLetters(res.data.data.events);
    } catch {
      toast.error('Failed to load dead-letter events');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const retryEvent = async (eventId: string) => {
    try {
      await api.post(API.admin.webhooks.retry(eventId));
      toast.success('Event retried successfully');
      fetchDeadLetters();
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Retry failed');
    }
  };

  const retryAll = async () => {
    setTriggering('retry-all');
    try {
      const res = await api.post(API.admin.webhooks.retryAll);
      toast.success(`${res.data.data.queued} events queued for retry`);
      fetchDeadLetters();
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Batch retry failed');
    } finally {
      setTriggering(null);
    }
  };

  const purgeDeadLetters = async () => {
    try {
      const res = await api.delete(API.admin.webhooks.deleteDeadLetter);
      toast.success(`Purged ${res.data.data.deletedCount} dead-letter events`);
      fetchDeadLetters();
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Purge failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-20 text-gray-500">Failed to load webhook status</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor Stripe webhook events and payment processing</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStatus(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Webhook Events (last 24h)</h3>
            <p className="text-sm text-gray-500">Real-time Stripe webhook event processing</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatBadge label="total events" value={stats.totalEventsLast24h} variant="info" />
          <StatBadge label="completed" value={stats.completed} variant="success" />
          <StatBadge label="failed" value={stats.failed} variant={stats.failed > 0 ? 'warning' : 'success'} />
          <StatBadge label="dead-lettered" value={stats.deadLettered} variant={stats.deadLettered > 0 ? 'danger' : 'success'} />
          <StatBadge label="success rate" value={`${stats.successRate}%`} variant={stats.successRate >= 95 ? 'success' : 'warning'} />
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Events (last hour)</h3>
        </div>
        {recentEvents.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">No recent webhook events</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="px-6 py-3 font-medium">Event</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Attempts</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentEvents.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-xs">{e.event}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.status === 'completed' ? 'bg-green-100 text-green-700' :
                        e.status === 'failed' ? 'bg-red-100 text-red-700' :
                        e.status === 'dead' ? 'bg-gray-100 text-gray-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {e.status === 'completed' ? <CheckCircle size={10} /> :
                         e.status === 'failed' ? <XCircle size={10} /> :
                         <Clock size={10} />}
                        {e.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{e.attempts}</td>
                    <td className="px-6 py-3 text-gray-500 text-xs">{new Date(e.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dead Letter Queue */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => { setShowDeadLetters(!showDeadLetters); if (!showDeadLetters) fetchDeadLetters(); }}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500" />
            <span className="font-medium text-gray-900">Dead Letter Queue</span>
            {stats.deadLettered > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                {stats.deadLettered} events
              </span>
            )}
          </div>
          {showDeadLetters ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showDeadLetters && (
          <div className="px-6 pb-6 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={retryAll}
                disabled={triggering === 'retry-all' || deadLetters.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {triggering === 'retry-all' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Retry All Failed
              </button>
              <button
                onClick={purgeDeadLetters}
                disabled={deadLetters.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 size={12} />
                Purge Old Events
              </button>
            </div>
            {deadLetters.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No dead-letter events</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Event</th>
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium">Attempts</th>
                      <th className="pb-2 font-medium">Error</th>
                      <th className="pb-2 font-medium">Created</th>
                      <th className="pb-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadLetters.map((e) => (
                      <tr key={e._id} className="border-b border-gray-50">
                        <td className="py-2 font-mono text-xs">{e.event}</td>
                        <td className="py-2 text-gray-600">{e.source}</td>
                        <td className="py-2 text-gray-600">{e.attempts}</td>
                        <td className="py-2 text-gray-500 text-xs max-w-[200px] truncate" title={e.lastError}>{e.lastError || '—'}</td>
                        <td className="py-2 text-gray-500 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                        <td className="py-2">
                          <button
                            onClick={() => retryEvent(e.eventId)}
                            className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
