import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Play, Pause, Settings, Clock,
  CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface BackgroundJob {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  enabled: boolean;
  intervalMs: number;
  lockName: string;
  lockLeaseMs: number;
  processTarget: string;
  filePath: string;
  functionName: string;
  status: string;
  lastRunAt?: string;
  lastRunDurationMs?: number;
  lastRunResult?: string;
  lastError?: string;
  maxHistorySize: number;
  runHistory: Array<{
    startedAt: string;
    completedAt: string;
    durationMs: number;
    result: string;
    error?: string;
    itemsProcessed?: number;
    workerId?: string;
  }>;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  createdAt: string;
  updatedAt: string;
}

function formatInterval(ms: number): string {
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}min`;
  if (ms < 86400000) return `${ms / 3600000}hour`;
  return `${ms / 86400000}days`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Pacific/Auckland',
  }).format(new Date(dateStr));
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return 'Never';
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(new Date(dateStr));
}

function getStatusColor(status: string, enabled: boolean) {
  if (!enabled) return 'bg-gray-100 text-gray-600';
  switch (status) {
    case 'running': return 'bg-blue-100 text-blue-700';
    case 'error': return 'bg-red-100 text-red-700';
    case 'idle': return 'bg-green-100 text-green-700';
    default: return 'bg-yellow-100 text-yellow-700';
  }
}

function getStatusIcon(status: string, enabled: boolean) {
  if (!enabled) return <Pause size={16} className="text-gray-400" />;
  switch (status) {
    case 'running': return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
    case 'error': return <XCircle size={16} className="text-red-500" />;
    case 'idle': return <CheckCircle size={16} className="text-green-500" />;
    default: return <AlertTriangle size={16} className="text-yellow-500" />;
  }
}

export default function BackgroundJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<BackgroundJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [historyPage, setHistoryPage] = useState(1);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeDays, setPurgeDays] = useState(30);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(API.admin.backgroundJobs.get(id));
      setJob(res.data.data);
      setEditForm({
        intervalMs: res.data.data.intervalMs,
        lockLeaseMs: res.data.data.lockLeaseMs,
        processTarget: res.data.data.processTarget,
        maxHistorySize: res.data.data.maxHistorySize || 500,
        notifyOnSuccess: res.data.data.notifyOnSuccess,
        notifyOnFailure: res.data.data.notifyOnFailure,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(API.admin.backgroundJobs.update(id), editForm);
      toast.success('Job configuration saved');
      await fetchJob();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!id) return;
    try {
      await api.post(API.admin.backgroundJobs.toggle(id));
      toast.success(job?.enabled ? 'Job disabled' : 'Job enabled');
      await fetchJob();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle job');
    }
  };

  const handleRunNow = async () => {
    if (!id) return;
    setRunning(true);
    try {
      await api.post(API.admin.backgroundJobs.run(id));
      toast.success('Job executed');
      await fetchJob();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to run job');
    } finally {
      setRunning(false);
    }
  };

  const handlePurgeHistory = async () => {
    if (!id) return;
    try {
      await api.delete(`${API.admin.backgroundJobs.purgeHistory(id)}?olderThan=${purgeDays}d`);
      toast.success(`Purged history older than ${purgeDays} days`);
      setShowPurgeConfirm(false);
      await fetchJob();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to purge history');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <Link to="/background-jobs" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={16} /> Back to Background Jobs
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error || 'Job not found'}
        </div>
      </div>
    );
  }

  const history = (job.runHistory || [])
    .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const historyPageSize = 20;
  const historyTotal = history.length;
  const historyStart = (historyPage - 1) * historyPageSize;
  const paginatedHistory = history.slice(historyStart, historyStart + historyPageSize);
  const historyPages = Math.ceil(historyTotal / historyPageSize);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link to="/background-jobs" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2">
          <ArrowLeft size={16} /> Back to Background Jobs
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{job.displayName}</h1>
            <p className="text-gray-500 mt-1">{job.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunNow}
              disabled={running || !job.enabled}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors duration-150"
            >
              {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              Run Now
            </button>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Status</div>
            <div className="flex items-center gap-2">
              {getStatusIcon(job.status, job.enabled)}
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status, job.enabled)}`}>
                {!job.enabled ? 'disabled' : job.status}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Last Run</div>
            <div className="text-sm font-medium text-gray-900">{formatDateTime(job.lastRunAt)}</div>
            {job.lastRunDurationMs != null && (
              <div className="text-xs text-gray-500 mt-0.5">{formatDuration(job.lastRunDurationMs)} — {job.lastRunResult}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Interval</div>
            <div className="text-sm font-medium text-gray-900">{formatInterval(job.intervalMs)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">History</div>
            <div className="text-sm font-medium text-gray-900">{historyTotal} runs</div>
          </div>
        </div>

        {job.lastError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-xs font-medium text-red-700 mb-1">Last Error</div>
            <div className="text-sm text-red-600 font-mono">{job.lastError}</div>
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings size={18} /> Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Enabled */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Enabled</label>
            <button
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                job.enabled ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                job.enabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interval (ms)</label>
            <input
              type="number"
              value={editForm.intervalMs}
              onChange={(e) => setEditForm({ ...editForm, intervalMs: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">= {formatInterval(editForm.intervalMs)}</p>
          </div>

          {/* Lock Lease */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lock Lease (ms)</label>
            <input
              type="number"
              value={editForm.lockLeaseMs}
              onChange={(e) => setEditForm({ ...editForm, lockLeaseMs: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Process Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Process Target</label>
            <select
              value={editForm.processTarget}
              onChange={(e) => setEditForm({ ...editForm, processTarget: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="worker">Worker Only</option>
              <option value="api">API Only</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Max History */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max History Entries</label>
            <input
              type="number"
              value={editForm.maxHistorySize}
              onChange={(e) => setEditForm({ ...editForm, maxHistorySize: parseInt(e.target.value) || 500 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Notifications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Per-Job Notifications</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editForm.notifyOnSuccess}
                  onChange={(e) => setEditForm({ ...editForm, notifyOnSuccess: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Notify on success</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editForm.notifyOnFailure}
                  onChange={(e) => setEditForm({ ...editForm, notifyOnFailure: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Notify on failure</span>
              </label>
            </div>
          </div>
        </div>

        {/* File Reference */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 space-y-1">
            <div><span className="font-medium text-gray-600">File:</span> {job.filePath}</div>
            <div><span className="font-medium text-gray-600">Function:</span> {job.functionName}</div>
            <div><span className="font-medium text-gray-600">Lock:</span> {job.lockName}</div>
            <div><span className="font-medium text-gray-600">Created:</span> {formatDateTime(job.createdAt)}</div>
            <div><span className="font-medium text-gray-600">Updated:</span> {formatDateTime(job.updatedAt)}</div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors duration-150"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Execution History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock size={18} /> Execution History
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPurgeConfirm(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors duration-150"
            >
              Purge History
            </button>
            <button
              onClick={fetchJob}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-150"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {paginatedHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No execution history yet.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedHistory.map((entry: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900 font-mono">{formatTime(entry.startedAt)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatDuration(entry.durationMs)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.result === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {entry.result}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{entry.itemsProcessed ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 font-mono">{entry.workerId || '—'}</td>
                      <td className="px-4 py-2 text-xs text-red-600 max-w-xs truncate">{entry.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  Showing {historyStart + 1}–{Math.min(historyStart + historyPageSize, historyTotal)} of {historyTotal}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                    disabled={historyPage === 1}
                    className="px-3 py-1 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">Page {historyPage} of {historyPages}</span>
                  <button
                    onClick={() => setHistoryPage(Math.min(historyPages, historyPage + 1))}
                    disabled={historyPage === historyPages}
                    className="px-3 py-1 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Purge Execution History</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete execution history entries older than the specified number of days.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delete entries older than</label>
              <select
                value={purgeDays}
                onChange={(e) => setPurgeDays(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPurgeConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeHistory}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
