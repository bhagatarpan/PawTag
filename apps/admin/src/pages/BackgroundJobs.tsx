import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, RefreshCw, Play, Pause, ChevronRight, X,
  CheckCircle, XCircle, AlertTriangle, Settings,
} from 'lucide-react';
import { toast } from '../lib/toast';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

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
  runHistory: any[];
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

interface JobStats {
  total: number;
  active: number;
  running: number;
  error: number;
  disabled: number;
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

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
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

function getStatusColor(status: string, enabled: boolean) {
  if (!enabled) return 'bg-gray-100 text-gray-600';
  switch (status) {
    case 'running': return 'bg-blue-100 text-blue-700';
    case 'error': return 'bg-red-100 text-red-700';
    case 'idle': return 'bg-green-100 text-green-700';
    default: return 'bg-yellow-100 text-yellow-700';
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'financial': return 'bg-red-50 text-red-700';
    case 'notification': return 'bg-blue-50 text-blue-700';
    case 'maintenance': return 'bg-gray-100 text-gray-600';
    case 'reconciliation': return 'bg-purple-50 text-purple-700';
    case 'compliance': return 'bg-amber-50 text-amber-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default function BackgroundJobs() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [stats, setStats] = useState<JobStats>({ total: 0, active: 0, running: 0, error: 0, disabled: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<BackgroundJob | null>(null);
  const [editingJob, setEditingJob] = useState<BackgroundJob | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, statsRes] = await Promise.all([
        api.get(API.admin.backgroundJobs.list),
        api.get(API.admin.backgroundJobs.stats),
      ]);
      setJobs(jobsRes.data.data || []);
      setStats(statsRes.data.data || { total: 0, active: 0, running: 0, error: 0, disabled: 0 });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load background jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async (jobId: string) => {
    try {
      await api.post(API.admin.backgroundJobs.toggle(jobId));
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle job');
    }
  };

  const handleRunNow = async (jobId: string) => {
    setRunningJob(jobId);
    try {
      await api.post(API.admin.backgroundJobs.run(jobId));
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to run job');
    } finally {
      setRunningJob(null);
    }
  };

  const handleEdit = (job: BackgroundJob) => {
    setEditingJob(job);
    setEditForm({
      intervalMs: job.intervalMs,
      lockLeaseMs: job.lockLeaseMs,
      processTarget: job.processTarget,
      maxHistorySize: job.maxHistorySize || 500,
      notifyOnSuccess: job.notifyOnSuccess,
      notifyOnFailure: job.notifyOnFailure,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;
    setSaving(true);
    try {
      await api.put(API.admin.backgroundJobs.update(editingJob._id), editForm);
      setEditingJob(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.category === filter);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-5 gap-4 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/settings" className="text-primary-600 hover:text-primary-700 text-sm mb-2 block">
            ← Back to Settings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Background Jobs</h1>
          <p className="text-gray-500 mt-1">Monitor and manage background job execution</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Active</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Running</div>
          <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Errors</div>
          <div className="text-2xl font-bold text-red-600">{stats.error}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Disabled</div>
          <div className="text-2xl font-bold text-gray-400">{stats.disabled}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {['all', 'financial', 'notification', 'maintenance', 'reconciliation', 'compliance'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Job List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Job Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Interval</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Last Run</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredJobs.map((job) => (
              <tr key={job._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status, job.enabled)}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{job.displayName}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{job.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(job.category)}`}>
                    {job.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status, job.enabled)}`}>
                    {!job.enabled ? 'disabled' : job.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatInterval(job.intervalMs)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatTimeAgo(job.lastRunAt)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {job.lastRunDurationMs ? formatDuration(job.lastRunDurationMs) : '—'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(job)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                      title="Configure"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => handleRunNow(job._id)}
                      disabled={runningJob === job._id || !job.enabled}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 disabled:opacity-50 transition-colors duration-150"
                      title="Run Now"
                    >
                      {runningJob === job._id ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggle(job._id)}
                      className={`p-1.5 rounded-lg ${
                        job.enabled
                          ? 'text-green-500 hover:text-green-700 hover:bg-green-50'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title={job.enabled ? 'Disable' : 'Enable'}
                    >
                      {job.enabled ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <Link
                      to={`/background-jobs/${job._id}`}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                      title="View Details"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">{editingJob.displayName}</h2>
              <button onClick={() => setEditingJob(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto">
              {/* Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interval (ms)</label>
                <input
                  type="number"
                  value={editForm.intervalMs}
                  onChange={(e) => setEditForm({ ...editForm, intervalMs: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">Current: {formatInterval(editForm.intervalMs)}</p>
              </div>

              {/* Lock Lease */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lock Lease (ms)</label>
                <input
                  type="number"
                  value={editForm.lockLeaseMs}
                  onChange={(e) => setEditForm({ ...editForm, lockLeaseMs: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Process Target */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Process Target</label>
                <select
                  value={editForm.processTarget}
                  onChange={(e) => setEditForm({ ...editForm, processTarget: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Notifications */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Per-Job Notifications</label>
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

              {/* File Reference */}
              <div className="border-t pt-4 text-xs text-gray-500">
                <p>File: {editingJob.filePath}</p>
                <p>Function: {editingJob.functionName}</p>
                <p>Lock: {editingJob.lockName}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => setEditingJob(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
