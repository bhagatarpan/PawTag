import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Zap, Shield, Monitor, Clock, AlertTriangle, CheckCircle, XCircle, Loader2, Trash2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface WebhookStatus {
  layer1_webhooks: {
    label: string;
    description: string;
    direction: string;
    latency: string;
    stats: {
      totalEventsLast24h: number;
      completed: number;
      failed: number;
      deadLettered: number;
      successRate: number;
    };
    recentEvents: Array<{
      event: string;
      eventId: string;
      status: string;
      attempts: number;
      createdAt: string;
      processedAt?: string;
      lastError?: string;
    }>;
  };
  layer2_reconciliation: {
    label: string;
    description: string;
    direction: string;
    latency: string;
    enabled: boolean;
    intervalSeconds: number;
    skipRecentMinutes: number;
    ordersNeedingSync: number;
  };
  layer3_polling: {
    label: string;
    description: string;
    direction: string;
    latency: string;
    enabled: boolean;
    intervalSeconds: number;
  };
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

function LayerCard({
  title,
  icon: Icon,
  color,
  description,
  direction,
  latency,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  description: string;
  direction: string;
  latency: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{latency}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
          <div className="pt-4 space-y-2">
            <p className="text-sm text-gray-700">{description}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ArrowRight size={12} />
              <span>{direction}</span>
            </div>
          </div>
          {children}
        </div>
      )}
    </div>
  );
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
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [deadLetters, setDeadLetters] = useState<DeadLetterEvent[]>([]);
  const [showDeadLetters, setShowDeadLetters] = useState(false);
  const [settings, setSettings] = useState({
    reconciliationEnabled: true,
    reconciliationIntervalSeconds: 60,
    reconciliationSkipRecentMinutes: 5,
    pollingEnabled: true,
    pollingIntervalSeconds: 30,
  });
  const [saving, setSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/webhooks/status');
      setStatus(res.data.data);
      setSettings({
        reconciliationEnabled: res.data.data.layer2_reconciliation.enabled,
        reconciliationIntervalSeconds: res.data.data.layer2_reconciliation.intervalSeconds,
        reconciliationSkipRecentMinutes: res.data.data.layer2_reconciliation.skipRecentMinutes,
        pollingEnabled: res.data.data.layer3_polling.enabled,
        pollingIntervalSeconds: res.data.data.layer3_polling.intervalSeconds,
      });
    } catch {
      toast.error('Failed to load sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeadLetters = useCallback(async () => {
    try {
      const res = await api.get('/admin/webhooks/dead-letter');
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

  const triggerAction = async (action: string, label: string) => {
    setTriggering(action);
    try {
      await api.post(`/admin/webhooks/${action}`);
      toast.success(`${label} triggered successfully`);
      setTimeout(fetchStatus, 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to trigger ${label}`);
    } finally {
      setTriggering(null);
    }
  };

  const retryEvent = async (eventId: string) => {
    try {
      await api.post(`/admin/webhooks/retry/${eventId}`);
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
      const res = await api.post('/admin/webhooks/retry-all');
      toast.success(res.data.data.message);
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
      const res = await api.delete('/admin/webhooks/dead-letter');
      toast.success(`Purged ${res.data.data.deletedCount} dead-letter events`);
      fetchDeadLetters();
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Purge failed');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/admin/webhooks/settings', settings);
      toast.success('Settings saved');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!status) {
    return <div className="text-center py-20 text-gray-500">Failed to load sync status</div>;
  }

  const l1 = status.layer1_webhooks;
  const l2 = status.layer2_reconciliation;
  const l3 = status.layer3_polling;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks & Sync</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage the 3-layer PawTag ↔ Medusa sync architecture</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStatus(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Layer 1: Real-time Webhooks */}
      <LayerCard
        title={l1.label}
        icon={Zap}
        color="bg-blue-100 text-blue-600"
        description={l1.description}
        direction={l1.direction}
        latency={l1.latency}
      >
        <div className="flex flex-wrap gap-3">
          <StatBadge label="events (24h)" value={l1.stats.totalEventsLast24h} variant="info" />
          <StatBadge label="completed" value={l1.stats.completed} variant="success" />
          <StatBadge label="failed" value={l1.stats.failed} variant={l1.stats.failed > 0 ? 'warning' : 'success'} />
          <StatBadge label="dead-lettered" value={l1.stats.deadLettered} variant={l1.stats.deadLettered > 0 ? 'danger' : 'success'} />
          <StatBadge label="success rate" value={`${l1.stats.successRate}%`} variant={l1.stats.successRate >= 95 ? 'success' : 'warning'} />
        </div>

        {/* Recent Events */}
        {l1.recentEvents.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Events (last hour)</h4>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Event</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Attempts</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {l1.recentEvents.map((e, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 font-mono text-xs">{e.event}</td>
                      <td className="py-2">
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
                      <td className="py-2 text-gray-600">{e.attempts}</td>
                      <td className="py-2 text-gray-500 text-xs">{new Date(e.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </LayerCard>

      {/* Layer 2: Reconciliation */}
      <LayerCard
        title={l2.label}
        icon={Shield}
        color="bg-amber-100 text-amber-600"
        description={l2.description}
        direction={l2.direction}
        latency={l2.latency}
      >
        <div className="flex flex-wrap gap-3">
          <StatBadge label="enabled" value={l2.enabled ? 'Yes' : 'No'} variant={l2.enabled ? 'success' : 'warning'} />
          <StatBadge label="interval" value={`${l2.intervalSeconds}s`} variant="info" />
          <StatBadge label="skip window" value={`${l2.skipRecentMinutes}m`} variant="info" />
          <StatBadge label="orders needing sync" value={l2.ordersNeedingSync} variant={l2.ordersNeedingSync > 0 ? 'warning' : 'success'} />
        </div>

        <button
          onClick={() => triggerAction('reconcile', 'Reconciliation')}
          disabled={triggering === 'reconcile'}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {triggering === 'reconcile' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Run Reconciliation Now
        </button>
      </LayerCard>

      {/* Layer 3: Frontend Polling */}
      <LayerCard
        title={l3.label}
        icon={Monitor}
        color="bg-green-100 text-green-600"
        description={l3.description}
        direction={l3.direction}
        latency={l3.latency}
      >
        <div className="flex flex-wrap gap-3">
          <StatBadge label="enabled" value={l3.enabled ? 'Yes' : 'No'} variant={l3.enabled ? 'success' : 'warning'} />
          <StatBadge label="interval" value={`${l3.intervalSeconds}s`} variant="info" />
        </div>
      </LayerCard>

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reconciliation Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Reconciliation Job</h4>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.reconciliationEnabled}
                onChange={(e) => setSettings({ ...settings, reconciliationEnabled: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Enabled</span>
            </label>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Interval (seconds)</label>
              <input
                type="number"
                value={settings.reconciliationIntervalSeconds}
                onChange={(e) => setSettings({ ...settings, reconciliationIntervalSeconds: parseInt(e.target.value) || 60 })}
                min={10}
                max={3600}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Skip recent orders (minutes)</label>
              <input
                type="number"
                value={settings.reconciliationSkipRecentMinutes}
                onChange={(e) => setSettings({ ...settings, reconciliationSkipRecentMinutes: parseInt(e.target.value) || 5 })}
                min={1}
                max={60}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Polling Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Customer Polling</h4>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.pollingEnabled}
                onChange={(e) => setSettings({ ...settings, pollingEnabled: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Enabled</span>
            </label>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Interval (seconds)</label>
              <input
                type="number"
                value={settings.pollingIntervalSeconds}
                onChange={(e) => setSettings({ ...settings, pollingIntervalSeconds: parseInt(e.target.value) || 30 })}
                min={10}
                max={300}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
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
            {l1.stats.deadLettered > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                {l1.stats.deadLettered} events
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
