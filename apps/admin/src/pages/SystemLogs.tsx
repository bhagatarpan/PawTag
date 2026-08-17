import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { toast } from '../lib/toast';
import {
  LEVEL_COLORS,
  LEVEL_DOT_COLORS,
  CATEGORY_COLORS,
  LEVEL_ICONS,
  CATEGORY_ICONS,
  formatDuration,
  truncateMessage,
} from '../lib/system-log-utils';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
  AlertTriangle,
  Activity,
  Copy,
  RotateCcw,
  ArrowUpDown,
  Loader2,
  Settings,
  Terminal,
  Link2,
  Info,
  Trash2,
} from 'lucide-react';

interface SystemLogEntry {
  _id: string;
  logId: string;
  timestamp: string;
  level: string;
  message: string;
  category: string;
  service: string;
  environment: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  transactionId?: string;
  userId?: string;
  feature?: string;
  operation?: string;
  error?: {
    name?: string;
    message?: string;
    code?: string;
    fingerprint?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
  durationMs?: number;
  source?: string;
}

interface Summary {
  total: number;
  today: number;
  errors: number;
  warnings: number;
  byCategory: Record<string, number>;
  byLevel: Record<string, number>;
}

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const CATEGORIES = ['HTTP', 'DATABASE', 'AUTH', 'INTEGRATION', 'JOB', 'SECURITY', 'NOTIFICATION', 'CONFIG', 'GENERAL'];

function SummaryCard({ label, value, onClick, active }: { label: string; value: number; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${active ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white hover:bg-gray-50'} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value.toLocaleString()}</p>
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 border border-primary-200">
      {label}
      <button type="button" onClick={onRemove} className="ml-0.5 hover:text-primary-900"><X size={12} /></button>
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-full" /></td>
      ))}
    </tr>
  );
}

export default function SystemLogs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<SystemLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('sortDir') as 'asc' | 'desc') || 'desc');

  const [selectedLog, setSelectedLog] = useState<SystemLogEntry | null>(null);
  const [relatedLogs, setRelatedLogs] = useState<SystemLogEntry[]>([]);

  // Purge state
  const [purgeMenuOpen, setPurgeMenuOpen] = useState(false);
  const [purgeRange, setPurgeRange] = useState<{ start: string; end: string; label: string } | null>(null);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), sortDir };
      if (search) params.search = search;
      if (levelFilter) params.level = levelFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate + 'T23:59:59').toISOString();

      const res = await api.get('/admin/system-logs', { params });
      const data = res.data.data;
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast.error('Failed to load system logs');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, levelFilter, categoryFilter, startDate, endDate, sortDir]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/admin/system-logs/summary');
      setSummary(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSearchParams(next);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
      updateParams({ search: value, page: '1' });
    }, 300);
  };

  const handleLevelToggle = (level: string) => {
    const levels = levelFilter ? levelFilter.split(',').filter(Boolean) : [];
    const idx = levels.indexOf(level);
    if (idx >= 0) levels.splice(idx, 1);
    else levels.push(level);
    const val = levels.join(',');
    setLevelFilter(val);
    setPage(1);
    updateParams({ level: val, page: '1' });
  };

  const handleCategoryToggle = (cat: string) => {
    const cats = categoryFilter ? categoryFilter.split(',').filter(Boolean) : [];
    const idx = cats.indexOf(cat);
    if (idx >= 0) cats.splice(idx, 1);
    else cats.push(cat);
    const val = cats.join(',');
    setCategoryFilter(val);
    setPage(1);
    updateParams({ category: val, page: '1' });
  };

  const setDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const s = start.toISOString().split('T')[0];
    const e = end.toISOString().split('T')[0];
    setStartDate(s);
    setEndDate(e);
    setPage(1);
    updateParams({ startDate: s, endDate: e, page: '1' });
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setLevelFilter('');
    setCategoryFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setSearchParams(new URLSearchParams());
  };

  const toggleSort = () => {
    const next = sortDir === 'desc' ? 'asc' : 'desc';
    setSortDir(next);
    updateParams({ sortDir: next });
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params: Record<string, string> = { format };
      if (search) params.search = search;
      if (levelFilter) params.level = levelFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate + 'T23:59:59').toISOString();

      const res = await api.get('/admin/system-logs/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export logs');
    }
  };

  const openDetail = async (log: SystemLogEntry) => {
    setSelectedLog(log);
    setRelatedLogs([]);
    if (log.requestId) {
      try {
        const res = await api.get(`/admin/system-logs/request/${log.requestId}`);
        setRelatedLogs(res.data.data.filter((r: SystemLogEntry) => r.logId !== log.logId));
      } catch { /* ignore */ }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
  };

  // ── Purge ───────────────────────────────────────────────────────

  const getPurgeRange = (option: string): { start: string; end: string; label: string } => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (option) {
      case 'today':
        return { start: todayStart.toISOString(), end: todayEnd.toISOString(), label: 'Today' };
      case 'yesterday': {
        const yStart = new Date(todayStart);
        yStart.setDate(yStart.getDate() - 1);
        const yEnd = new Date(todayEnd);
        yEnd.setDate(yEnd.getDate() - 1);
        return { start: yStart.toISOString(), end: yEnd.toISOString(), label: 'Yesterday' };
      }
      case 'week': {
        const wStart = new Date(todayStart);
        wStart.setDate(wStart.getDate() - 7);
        return { start: wStart.toISOString(), end: todayEnd.toISOString(), label: 'Last 7 Days' };
      }
      case 'month': {
        const mStart = new Date(todayStart);
        mStart.setDate(mStart.getDate() - 30);
        return { start: mStart.toISOString(), end: todayEnd.toISOString(), label: 'Last 30 Days' };
      }
      default:
        return { start: todayStart.toISOString(), end: todayEnd.toISOString(), label: 'Today' };
    }
  };

  const selectPurgeOption = (option: string) => {
    setPurgeMenuOpen(false);
    if (option === 'custom') {
      setCustomRangeOpen(true);
      return;
    }
    const range = getPurgeRange(option);
    setPurgeRange(range);
    setStartDate(range.start.split('T')[0]);
    setEndDate(range.end.split('T')[0]);
    setPage(1);
    updateParams({ startDate: range.start.split('T')[0], endDate: range.end.split('T')[0], page: '1' });
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    const s = new Date(customStart);
    const e = new Date(customEnd + 'T23:59:59');
    if (s >= e) { toast.error('Start date must be before end date'); return; }
    setPurgeRange({ start: s.toISOString(), end: e.toISOString(), label: `${customStart} to ${customEnd}` });
    setCustomRangeOpen(false);
    setStartDate(customStart);
    setEndDate(customEnd);
    setPage(1);
    updateParams({ startDate: customStart, endDate: customEnd, page: '1' });
  };

  const clearPurge = () => {
    setPurgeRange(null);
    setPurgeConfirmOpen(false);
    setStartDate('');
    setEndDate('');
    setPage(1);
    updateParams({ startDate: '', endDate: '', page: '1' });
  };

  const handlePurge = async () => {
    if (!purgeRange) return;
    setPurging(true);
    try {
      const res = await api.post('/admin/system-logs/purge', {
        startDate: purgeRange.start,
        endDate: purgeRange.end,
      });
      const deleted = res.data.data.deleted;
      toast.success(`${deleted.toLocaleString()} log${deleted !== 1 ? 's' : ''} purged`);
      setPurgeRange(null);
      setPurgeConfirmOpen(false);
      fetchLogs();
      fetchSummary();
    } catch {
      toast.error('Failed to purge logs');
    } finally {
      setPurging(false);
    }
  };

  const activeFilterCount = [levelFilter, categoryFilter, startDate, endDate].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><Terminal className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
            <p className="text-sm text-gray-500 mt-1">Application-level structured logs for debugging and monitoring.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => handleExport('csv')} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={15} /> CSV
          </button>
          <button type="button" onClick={() => handleExport('json')} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={15} /> JSON
          </button>

          {/* Purge dropdown */}
          <div className="relative">
            <button type="button" onClick={() => { setPurgeMenuOpen(!purgeMenuOpen); setCustomRangeOpen(false); }} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              <Trash2 size={15} /> Purge <ChevronDown size={14} />
            </button>
            {purgeMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setPurgeMenuOpen(false); setCustomRangeOpen(false); }} />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {[
                    { key: 'today', label: 'Today' },
                    { key: 'yesterday', label: 'Yesterday' },
                    { key: 'week', label: 'Last 7 Days' },
                    { key: 'month', label: 'Last 30 Days' },
                  ].map((opt) => (
                    <button key={opt.key} type="button" onClick={() => selectPurgeOption(opt.key)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      {opt.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100" />
                  <button type="button" onClick={() => selectPurgeOption('custom')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    Custom Range...
                  </button>
                </div>
              </>
            )}
            {/* Custom range popover */}
            {customRangeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCustomRangeOpen(false)} />
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
                  <p className="text-sm font-medium text-gray-900 mb-3">Custom Date Range</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">From</label>
                      <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">To</label>
                      <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                    </div>
                    <button type="button" onClick={applyCustomRange} disabled={!customStart || !customEnd} className="w-full rounded-lg bg-teal-600 text-white py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Purge action button — visible when a range is selected */}
          {purgeRange && (
            <div className="inline-flex items-center gap-1">
              <button type="button" onClick={() => setPurgeConfirmOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                <Trash2 size={15} /> Purge {total.toLocaleString()} log{total !== 1 ? 's' : ''}
              </button>
              <button type="button" onClick={clearPurge} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50" title="Cancel purge">
                <X size={15} />
              </button>
            </div>
          )}

          <button type="button" onClick={() => navigate('/system-log-settings')} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Settings size={15} /> Settings
          </button>
          <button type="button" onClick={() => { fetchLogs(); fetchSummary(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RotateCcw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total Logs" value={summary.total} />
          <SummaryCard label="Today" value={summary.today} onClick={() => { setStartDate(new Date().toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]); setPage(1); }} active={startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]} />
          <SummaryCard label="Errors" value={summary.errors} onClick={() => { setLevelFilter('error,fatal'); setPage(1); updateParams({ level: 'error,fatal', page: '1' }); }} active={levelFilter === 'error,fatal'} />
          <SummaryCard label="Warnings" value={summary.warnings} onClick={() => { setLevelFilter('warn'); setPage(1); updateParams({ level: 'warn', page: '1' }); }} active={levelFilter === 'warn'} />
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search logs by message, request ID, error..."
                className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button type="button" onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showFilters ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
              <Filter size={15} /> Filters {activeFilterCount > 0 && <span className="ml-1 rounded-full bg-primary-600 text-white text-xs px-1.5 py-0.5">{activeFilterCount}</span>}
            </button>
            <button type="button" onClick={toggleSort} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ArrowUpDown size={15} /> {sortDir === 'desc' ? 'Newest' : 'Oldest'}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Log Level</p>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((level) => {
                  const active = levelFilter.split(',').includes(level);
                  return (
                    <button key={level} type="button" onClick={() => handleLevelToggle(level)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${active ? LEVEL_COLORS[level] + ' border-current' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = categoryFilter.split(',').includes(cat);
                  return (
                    <button key={cat} type="button" onClick={() => handleCategoryToggle(cat)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${active ? CATEGORY_COLORS[cat] + ' border-current' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">From Date</p>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); updateParams({ startDate: e.target.value, page: '1' }); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">To Date</p>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); updateParams({ endDate: e.target.value, page: '1' }); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Range</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDatePreset(0)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Today</button>
                  <button type="button" onClick={() => setDatePreset(1)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Yesterday</button>
                  <button type="button" onClick={() => setDatePreset(7)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">7d</button>
                  <button type="button" onClick={() => setDatePreset(30)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">30d</button>
                </div>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">Clear all filters</button>
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-2">
            {levelFilter.split(',').filter(Boolean).map((l) => <FilterChip key={`l-${l}`} label={`Level: ${l}`} onRemove={() => handleLevelToggle(l)} />)}
            {categoryFilter.split(',').filter(Boolean).map((c) => <FilterChip key={`c-${c}`} label={`Category: ${c}`} onRemove={() => handleCategoryToggle(c)} />)}
            {startDate && <FilterChip label={`From: ${startDate}`} onRemove={() => { setStartDate(''); updateParams({ startDate: '' }); }} />}
            {endDate && <FilterChip label={`To: ${endDate}`} onRemove={() => { setEndDate(''); updateParams({ endDate: '' }); }} />}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3 hidden lg:table-cell">Service</th>
                <th className="px-4 py-3 hidden xl:table-cell">Feature</th>
                <th className="px-4 py-3 hidden md:table-cell">Request ID</th>
                <th className="px-4 py-3 hidden xl:table-cell">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Terminal size={32} className="mx-auto mb-2 text-gray-300" />
                    No system logs found
                  </td>
                </tr>
              ) : (
                items.map((log) => {
                  const LevelIcon = LEVEL_ICONS[log.level] || Info;
                  return (
                    <tr key={log.logId} onClick={() => openDetail(log)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${LEVEL_COLORS[log.level] || 'bg-gray-100 text-gray-600'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT_COLORS[log.level]}`} />
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${CATEGORY_COLORS[log.category] || 'bg-gray-100 text-gray-600'}`}>
                          {log.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{truncateMessage(log.message)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">{log.service}</td>
                      <td className="px-4 py-3 hidden xl:table-cell text-gray-500 text-xs">{log.feature || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs font-mono text-gray-400">{log.requestId ? log.requestId.slice(0, 8) + '...' : '—'}</td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500">{log.durationMs != null ? formatDuration(log.durationMs) : '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-gray-200 px-2 py-1 text-sm">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="text-sm text-gray-500">
              Showing {Math.min((page - 1) * limit + 1, total)}—{Math.min(page * limit, total)} of {total.toLocaleString()} logs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button type="button" disabled={page <= 1} onClick={() => { setPage(page - 1); updateParams({ page: String(page - 1) }); }} className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={16} /></button>
            <button type="button" disabled={page >= totalPages} onClick={() => { setPage(page + 1); updateParams({ page: String(page + 1) }); }} className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900">Log Detail</h2>
              <button type="button" onClick={() => setSelectedLog(null)} className="rounded-lg p-1.5 hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Message */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Message</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{selectedLog.message}</p>
              </div>

              {/* Level + Category + Timestamp */}
              <div className="flex flex-wrap gap-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${LEVEL_COLORS[selectedLog.level]}`}>
                  {(() => { const Icon = LEVEL_ICONS[selectedLog.level]; return Icon ? <Icon size={12} /> : null; })()}
                  {selectedLog.level.toUpperCase()}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${CATEGORY_COLORS[selectedLog.category]}`}>
                  {selectedLog.category}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} /> {new Date(selectedLog.timestamp).toLocaleString()}
                </span>
                {selectedLog.durationMs != null && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Activity size={12} /> {formatDuration(selectedLog.durationMs)}
                  </span>
                )}
              </div>

              {/* Context */}
              <div className="grid grid-cols-2 gap-4">
                {selectedLog.service && (
                  <div><p className="text-xs font-medium text-gray-500">Service</p><p className="text-sm text-gray-900">{selectedLog.service}</p></div>
                )}
                {selectedLog.environment && (
                  <div><p className="text-xs font-medium text-gray-500">Environment</p><p className="text-sm text-gray-900">{selectedLog.environment}</p></div>
                )}
                {selectedLog.feature && (
                  <div><p className="text-xs font-medium text-gray-500">Feature</p><p className="text-sm text-gray-900">{selectedLog.feature}</p></div>
                )}
                {selectedLog.operation && (
                  <div><p className="text-xs font-medium text-gray-500">Operation</p><p className="text-sm text-gray-900">{selectedLog.operation}</p></div>
                )}
                {selectedLog.userId && (
                  <div><p className="text-xs font-medium text-gray-500">User ID</p><p className="text-sm text-gray-900 font-mono">{selectedLog.userId}</p></div>
                )}
                {selectedLog.source && (
                  <div><p className="text-xs font-medium text-gray-500">Source</p><p className="text-sm text-gray-900 font-mono">{selectedLog.source}</p></div>
                )}
              </div>

              {/* Identifiers */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Identifiers</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Log ID', value: selectedLog.logId },
                    { label: 'Request ID', value: selectedLog.requestId },
                    { label: 'Correlation ID', value: selectedLog.correlationId },
                    { label: 'Trace ID', value: selectedLog.traceId },
                    { label: 'Transaction ID', value: selectedLog.transactionId },
                  ].filter((i) => i.value).map((id) => (
                    <div key={id.label} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                      <span className="text-xs text-gray-500 flex-1 truncate font-mono">{id.value}</span>
                      <button type="button" onClick={() => copyToClipboard(id.value!)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              {selectedLog.error && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Error</p>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
                    {selectedLog.error.name && <p className="text-sm font-medium text-red-800">{selectedLog.error.name}</p>}
                    {selectedLog.error.message && <p className="text-sm text-red-700">{selectedLog.error.message}</p>}
                    {selectedLog.error.code && <p className="text-xs text-red-600">Code: {selectedLog.error.code}</p>}
                    {selectedLog.error.fingerprint && <p className="text-xs text-red-600 font-mono">Fingerprint: {selectedLog.error.fingerprint}</p>}
                    {selectedLog.error.stack && (
                      <pre className="text-xs text-red-600 bg-red-100 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">{selectedLog.error.stack}</pre>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Metadata</p>
                  <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              )}

              {/* Related Logs */}
              {relatedLogs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                    <Link2 size={12} /> Related Logs (same request)
                  </p>
                  <div className="space-y-1">
                    {relatedLogs.map((r) => (
                      <button key={r.logId} type="button" onClick={() => openDetail(r)} className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT_COLORS[r.level]}`} />
                          <span className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleTimeString()}</span>
                          <span className="text-xs font-medium text-gray-700">{r.level}</span>
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${CATEGORY_COLORS[r.category]}`}>{r.category}</span>
                          <span className="text-xs text-gray-600 truncate flex-1">{truncateMessage(r.message, 80)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Purge Confirmation Dialog */}
      {purgeConfirmOpen && purgeRange && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !purging && setPurgeConfirmOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4 animate-slide-up">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Permanently Delete System Logs?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  You are about to permanently delete <strong className="text-gray-900">{total.toLocaleString()}</strong> log{total !== 1 ? 's' : ''} from <strong className="text-gray-900">{purgeRange.label}</strong>.
                </p>
                <p className="text-sm text-red-600 mt-2 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPurgeConfirmOpen(false)}
                disabled={purging}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurge}
                disabled={purging}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {purging ? <><Loader2 className="animate-spin h-4 w-4" /> Purging...</> : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
