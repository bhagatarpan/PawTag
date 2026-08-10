import { useEffect, useState, useCallback, useRef } from 'react';
import api, { PaginatedData } from '../lib/api';
import { toast } from '../lib/toast';
import {
  Search, X, ChevronDown, ChevronLeft, ChevronRight, Download,
  Trash2, Plus, Edit2, Save, Tag as TagIcon, QrCode, Printer,
  Copy, Loader2, AlertTriangle, Shield, Lock, Unlock, RotateCcw,
  Database, FileText, User, Settings, Activity, CheckCircle,
  AlertCircle, Info, Clock, ExternalLink, Eye,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TagItem {
  _id: string;
  tagId: string;
  tagType?: string;
  petId: { _id: string; name: string; petId: string; petType: string; breed: string; color: string; status: string } | null;
  ownerId: { _id: string; fullName: string; email: string; phoneNumber?: string } | null;
  status: 'active' | 'inactive' | 'lost';
  lastScannedAt?: string;
  createdAt: string;
}

interface SummaryData {
  total: number;
  active: number;
  qr: number;
  nfc: number;
  lost: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

function getStatusBadge(status: string): { className: string; icon: React.ReactNode } {
  switch (status) {
    case 'active': return { className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: <CheckCircle size={13} /> };
    case 'lost': return { className: 'bg-red-100 text-red-700 border border-red-200', icon: <AlertCircle size={13} /> };
    case 'inactive': return { className: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <Info size={13} /> };
    default: return { className: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <Info size={13} /> };
  }
}

function getTypeBadge(type: string): { className: string; label: string } {
  if (type === 'nfc') return { className: 'bg-blue-100 text-blue-700 border border-blue-200', label: 'NFC' };
  return { className: 'bg-purple-100 text-purple-700 border border-purple-200', label: 'QR' };
}

/* ------------------------------------------------------------------ */
/*  Owner Search Component                                             */
/* ------------------------------------------------------------------ */

function OwnerSearch({ owners, value, onSelect, required }: { owners: any[]; value: string; onSelect: (id: string) => void; required?: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = owners.find((o: any) => o._id === value);

  const normPhone = (p: string) => {
    if (!p) return '';
    let n = p.replace(/[\s\-()]/g, '');
    if (n.startsWith('+64')) n = '0' + n.slice(3);
    return n.toLowerCase();
  };

  const filtered = query.trim()
    ? owners.filter((o: any) => {
        const q = query.toLowerCase();
        if ((o.fullName || '').toLowerCase().includes(q)) return true;
        if ((o.email || '').toLowerCase().includes(q)) return true;
        if (normPhone(o.phoneNumber || '').includes(normPhone(query))) return true;
        return false;
      })
    : owners;

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((prev) => Math.min(prev + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((prev) => Math.max(prev - 1, 0)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); onSelect(filtered[highlighted]._id); setQuery(''); setOpen(false); setHighlighted(-1); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="relative" ref={ref}>
      {selected && !open ? (
        <div className="w-full border rounded-md px-3 py-2 text-sm flex items-center justify-between bg-white cursor-pointer hover:border-gray-400" onClick={() => { setOpen(true); setQuery(''); setHighlighted(-1); }}>
          <span className="truncate">{selected.fullName} <span className="text-gray-400">({selected.email}){selected.phoneNumber ? ` · ${selected.phoneNumber}` : ''}</span></span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(''); }} className="text-gray-400 hover:text-red-500 ml-1 shrink-0"><X size={14} /></button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlighted(-1); }}
          onFocus={() => { setOpen(true); setHighlighted(-1); }}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, email, or phone..."
          className="w-full border rounded-md px-3 py-2 text-sm"
          required={required && !value}
          autoFocus
        />
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.slice(0, 20).map((o: any, i: number) => (
            <button
              key={o._id}
              type="button"
              onClick={() => { onSelect(o._id); setQuery(''); setOpen(false); setHighlighted(-1); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-3 py-2 text-sm flex flex-col ${i === highlighted ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            >
              <span className="font-medium">{o.fullName}</span>
              <span className="text-xs text-gray-500">{o.email}{o.phoneNumber ? ` · ${o.phoneNumber}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">No matching owners</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-3 hidden xl:table-cell"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

function DetailDrawer({
  tag,
  onClose,
  onRefresh,
}: {
  tag: TagItem | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'qr'>('info');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    if (!tag) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [tag, onClose]);

  useEffect(() => {
    if (tag) setActiveTab('info');
  }, [tag]);

  if (!tag) return null;

  const handleStatusChange = async (status: string) => {
    setActionLoading('status');
    try {
      await api.put(`/admin/tags/${tag._id}`, { status });
      toast.success(`Tag marked as ${status}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete tag "${tag.tagId}"? This cannot be undone.`)) return;
    setActionLoading('delete');
    try {
      await api.delete(`/admin/tags/${tag._id}`);
      toast.success('Tag deleted');
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const downloadQR = async () => {
    try {
      const res = await fetch(`${apiBase}/tags/${tag.tagId}/qr?size=400`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${tag.tagId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('QR downloaded');
    } catch {
      toast.error('Failed to download QR');
    }
  };

  const printQR = () => {
    const url = `${apiBase}/tags/${tag.tagId}/qr?size=400`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>QR - ${tag.tagId}</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:sans-serif}.card{text-align:center;border:2px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}img{width:250px;height:250px}.tag{font-size:20px;font-weight:700;font-family:monospace;margin-top:8px}.pet{font-size:14px;color:#666;margin-top:4px}@media print{body{background:white}.card{box-shadow:none}}</style></head><body><div class="card"><img src="${url}" /><div class="tag">${tag.tagId}</div>${tag.petId ? `<div class="pet">${tag.petId.name}${tag.petId.petId ? ` (${tag.petId.petId})` : ''}</div>` : ''}</div></body></html>`);
    win.document.close();
    win.print();
  };

  const tabs = [
    { key: 'info' as const, label: 'Tag Info' },
    { key: 'qr' as const, label: tag.tagType === 'nfc' ? 'NFC Info' : 'QR Code' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Tag details: ${tag.tagId}`}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div ref={drawerRef} className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <TagIcon size={20} className="text-primary-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 font-mono">{tag.tagId}</h2>
              <p className="text-sm text-gray-500">{tag.petId?.name || 'Unlinked'} · {tag.petId?.petType || ''}</p>
            </div>
            {(() => {
              const badge = getStatusBadge(tag.status);
              return (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                  {badge.icon} {tag.status}
                </span>
              );
            })()}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <Section title="Tag Details" icon={<TagIcon size={16} />}>
                <DetailRow label="Tag ID" value={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{tag.tagId}</span>
                    <button onClick={() => copyToClipboard(tag.tagId)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                  </span>
                } />
                <DetailRow label="Type" value={
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(tag.tagType || 'qr').className}`}>
                    {tag.tagType === 'nfc' ? <Nfc size={13} /> : <QrCode size={13} />}
                    {getTypeBadge(tag.tagType || 'qr').label}
                  </span>
                } />
                <DetailRow label="Status" value={
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(tag.status).className}`}>
                    {getStatusBadge(tag.status).icon} {tag.status}
                  </span>
                } />
                <DetailRow label="Created" value={formatDate(tag.createdAt)} />
                <DetailRow label="Last Scanned" value={tag.lastScannedAt ? timeAgo(tag.lastScannedAt) : 'Never'} />
              </Section>

              {tag.petId && (
                <Section title="Linked Pet" icon={<span className="text-base">🐾</span>}>
                  <DetailRow label="Name" value={tag.petId.name} />
                  <DetailRow label="Pet ID" value={
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">{tag.petId.petId}</span>
                      <button onClick={() => copyToClipboard(tag.petId!.petId)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                    </span>
                  } />
                  <DetailRow label="Type" value={tag.petId.petType} />
                  <DetailRow label="Breed" value={tag.petId.breed} />
                  <DetailRow label="Color" value={tag.petId.color} />
                  <DetailRow label="Status" value={
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      tag.petId!.status === 'safe' ? 'bg-emerald-100 text-emerald-700' :
                      tag.petId!.status === 'lost' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {tag.petId!.status}
                    </span>
                  } />
                </Section>
              )}

              {tag.ownerId && (
                <Section title="Owner" icon={<User size={16} />}>
                  <DetailRow label="Name" value={tag.ownerId.fullName} />
                  <DetailRow label="Email" value={
                    <span className="flex items-center gap-2">
                      {tag.ownerId.email}
                      <button onClick={() => copyToClipboard(tag.ownerId!.email)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                    </span>
                  } />
                  {tag.ownerId.phoneNumber && <DetailRow label="Phone" value={tag.ownerId.phoneNumber} />}
                </Section>
              )}

              <Section title="Quick Actions" icon={<Settings size={16} />}>
                <div className="flex flex-wrap gap-2">
                  {tag.status !== 'active' && (
                    <button
                      onClick={() => handleStatusChange('active')}
                      disabled={actionLoading === 'status'}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'status' && <Loader2 size={12} className="animate-spin" />}
                      Activate
                    </button>
                  )}
                  {tag.status !== 'inactive' && (
                    <button
                      onClick={() => handleStatusChange('inactive')}
                      disabled={actionLoading === 'status'}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'status' && <Loader2 size={12} className="animate-spin" />}
                      Deactivate
                    </button>
                  )}
                  {tag.status !== 'lost' && (
                    <button
                      onClick={() => handleStatusChange('lost')}
                      disabled={actionLoading === 'status'}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'status' && <Loader2 size={12} className="animate-spin" />}
                      Mark Lost
                    </button>
                  )}
                  <button
                    onClick={() => window.open(`${apiBase}/tags/${tag.tagId}/sticker`, '_blank')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg"
                  >
                    <Printer size={13} /> Sticker
                  </button>
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="space-y-6">
              {tag.tagType === 'nfc' ? (
                <Section title="NFC Tag Info" icon={<Nfc size={16} />}>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium mb-2">NFC URL to encode:</p>
                    <p className="text-xs text-blue-600 font-mono break-all bg-white p-3 rounded border border-blue-100">
                      {`${apiBase.replace('/api', '')}/finder/${tag.tagId}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-3">Write this URL to the NFC tag using an NFC writer app.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(`${apiBase.replace('/api', '')}/finder/${tag.tagId}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Copy size={14} /> Copy URL
                    </button>
                    <button
                      onClick={() => window.open(`${apiBase}/tags/${tag.tagId}/sticker`, '_blank')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
                    >
                      <Printer size={14} /> Print Sticker
                    </button>
                  </div>
                </Section>
              ) : (
                <Section title="QR Code" icon={<QrCode size={16} />}>
                  <div className="flex justify-center">
                    <img
                      src={`${apiBase}/tags/${tag.tagId}/qr?size=400`}
                      alt={`QR ${tag.tagId}`}
                      className="w-64 h-64 rounded-lg border"
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center">Scan to view pet info on Finder</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={downloadQR} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">
                      <Download size={14} /> Download
                    </button>
                    <button onClick={printQR} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100">
                      <Printer size={14} /> Print
                    </button>
                    <button
                      onClick={() => window.open(`${apiBase}/tags/${tag.tagId}/sticker`, '_blank')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Sticker
                    </button>
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nfc icon (not in lucide)                                           */
/* ------------------------------------------------------------------ */

function Nfc(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M4 12V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
      <path d="M10 12V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
      <path d="M16 12v-2a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Small reusable components for the drawer                           */
/* ------------------------------------------------------------------ */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5 text-sm">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-gray-700 min-w-0">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Tags() {
  // Data state
  const [data, setData] = useState<PaginatedData<TagItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Summary
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // UI state
  const [selectedTag, setSelectedTag] = useState<TagItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [form, setForm] = useState({ petId: '', ownerId: '', tagId: '', tagType: 'qr', status: 'active' });
  const [pets, setPets] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  // Fetch supporting data
  useEffect(() => {
    api.get('/admin/pets', { params: { limit: 500 } }).then((r) => setPets(r.data.data.items || [])).catch(console.error);
    api.get('/admin/users', { params: { limit: 500 } }).then((r) => setOwners(r.data.data.items || [])).catch(console.error);
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/admin/tags', { params: { limit: 10000 } });
      const items = res.data.data.items || [];
      const total = res.data.data.total || 0;
      const active = items.filter((t: TagItem) => t.status === 'active').length;
      const qr = items.filter((t: TagItem) => t.tagType === 'qr').length;
      const nfc = items.filter((t: TagItem) => t.tagType === 'nfc').length;
      const lost = items.filter((t: TagItem) => t.status === 'lost').length;
      setSummary({ total, active, qr, nfc, lost });
    } catch {
      // Non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.tagType = typeFilter;
      const res = await api.get('/admin/tags', { params });
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Form handlers
  const startAdd = () => { setEditingTag(null); setForm({ petId: '', ownerId: '', tagId: '', tagType: 'qr', status: 'active' }); setFormError(''); setShowForm(true); };
  const startEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setForm({
      petId: tag.petId?._id || '', ownerId: tag.ownerId?._id || '',
      tagId: tag.tagId, tagType: tag.tagType || 'qr', status: tag.status,
    });
    setFormError('');
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditingTag(null); setForm({ petId: '', ownerId: '', tagId: '', tagType: 'qr', status: 'active' }); setFormError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError('');
    try {
      if (editingTag) {
        await api.put(`/admin/tags/${editingTag._id}`, { petId: form.petId || undefined, ownerId: form.ownerId || undefined, tagType: form.tagType, status: form.status });
        toast.success('Tag updated');
      } else {
        await api.post('/admin/tags', { petId: form.petId, ownerId: form.ownerId, tagId: form.tagId || undefined, tagType: form.tagType, status: form.status });
        toast.success('Tag created');
      }
      cancelForm();
      fetchTags();
      fetchSummary();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Operation failed');
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setFormSaving(false);
    }
  };

  // Export
  const handleExport = async (format: 'csv' | 'json') => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const params: Record<string, unknown> = { format, limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.tagType = typeFilter;
      const res = await api.get('/admin/tags', { params });
      const items = res.data.data.items || [];
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `tags-${new Date().toISOString().slice(0, 10)}.json`; a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const headers = ['Tag ID', 'Type', 'Pet', 'Owner', 'Email', 'Phone', 'Status', 'Last Scanned', 'Created'];
        const rows = items.map((t: TagItem) => [
          t.tagId, t.tagType || 'qr', t.petId?.name || 'Unlinked', t.ownerId?.fullName || 'N/A',
          t.ownerId?.email || '', t.ownerId?.phoneNumber || '', t.status,
          t.lastScannedAt ? timeAgo(t.lastScannedAt) : 'Never', formatDate(t.createdAt),
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `tags-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        window.URL.revokeObjectURL(url);
      }
      toast.success(`Exported ${items.length} tags`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  // Filter helpers
  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [];
  if (debouncedSearch) activeFilters.push({ key: 'search', label: `Search: "${debouncedSearch}"`, clear: () => { setSearch(''); setDebouncedSearch(''); } });
  if (statusFilter) activeFilters.push({ key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('') });
  if (typeFilter) activeFilters.push({ key: 'type', label: `Type: ${typeFilter === 'qr' ? 'QR' : 'NFC'}`, clear: () => setTypeFilter('') });

  const clearAllFilters = () => {
    setSearch(''); setDebouncedSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1);
  };

  const startIdx = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIdx = data ? Math.min(page * pageSize, data.total) : 0;

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tag Management</h1>
              <p className="mt-1 text-sm text-gray-500">Manage QR and NFC tags, link to pets, and generate print materials.</p>
            </div>
            <div className="flex items-center gap-2">
              {data && data.items.length > 0 && (
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('admin_token');
                    const tagIds = data.items.map((t) => t._id);
                    try {
                      const res = await fetch(`${apiBase}/admin/tags/qr-bulk`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ tagIds }),
                      });
                      const html = await res.text();
                      const w = window.open('', '_blank');
                      if (w) { w.document.write(html); w.document.close(); }
                    } catch { toast.error('Failed to generate bulk QR'); }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <Printer size={15} /> Print All QR
                </button>
              )}
              <button onClick={startAdd} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
                <Plus size={15} /> Create Tag
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {exportLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Export
                  <ChevronDown size={14} />
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"><FileText size={14} /> Export CSV</button>
                      <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"><Database size={14} /> Export JSON</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryCard label="Total Tags" value={summary.total} icon={<TagIcon size={20} />} loading={summaryLoading} />
            <SummaryCard label="Active" value={summary.active} icon={<CheckCircle size={20} />} color="emerald" loading={summaryLoading} onClick={() => { setStatusFilter(statusFilter === 'active' ? '' : 'active'); setPage(1); }} active={statusFilter === 'active'} />
            <SummaryCard label="QR Codes" value={summary.qr} icon={<QrCode size={20} />} color="primary" loading={summaryLoading} onClick={() => { setTypeFilter(typeFilter === 'qr' ? '' : 'qr'); setPage(1); }} active={typeFilter === 'qr'} />
            <SummaryCard label="NFC Tags" value={summary.nfc} icon={<Nfc size={20} />} color="amber" loading={summaryLoading} onClick={() => { setTypeFilter(typeFilter === 'nfc' ? '' : 'nfc'); setPage(1); }} active={typeFilter === 'nfc'} />
            <SummaryCard label="Lost" value={summary.lost} icon={<AlertCircle size={20} />} color="red" loading={summaryLoading} onClick={() => { setStatusFilter(statusFilter === 'lost' ? '' : 'lost'); setPage(1); }} active={statusFilter === 'lost'} />
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingTag ? `Edit Tag ${editingTag.tagId}` : 'Create New Tag'}</h2>
              <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
            {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{formError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tag ID (auto-generated if empty)</label>
                <input value={form.tagId} onChange={(e) => setForm({ ...form, tagId: e.target.value })} placeholder="PT-123456" className="w-full border rounded-md px-3 py-2 text-sm font-mono" disabled={!!editingTag} />
                {!editingTag && <p className="text-xs text-gray-400 mt-1">Format: PT-NNNNNN (6 digits)</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tag Type *</label>
                <select value={form.tagType} onChange={(e) => setForm({ ...form, tagType: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" disabled={!!editingTag}>
                  <option value="qr">QR Code</option>
                  <option value="nfc">NFC Tag</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Link to Pet *</label>
                <select value={form.petId} onChange={(e) => setForm({ ...form, petId: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required>
                  <option value="">Select pet...</option>
                  {pets.map((p: any) => <option key={p._id} value={p._id}>{p.name} ({p.petId || 'no ID'}) — {p.ownerId?.fullName || 'unknown'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Owner *</label>
                <OwnerSearch owners={owners} value={form.ownerId} onSelect={(id) => setForm({ ...form, ownerId: id })} required />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={formSaving} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50">
                {formSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editingTag ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={cancelForm} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </form>
        )}

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tag ID, pet name, owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {search && (
              <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="lost">Lost</option>
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Types</option>
            <option value="qr">QR Code</option>
            <option value="nfc">NFC Tag</option>
          </select>
        </div>

        {/* Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activeFilters.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                {f.label}
                <button onClick={f.clear} className="hover:bg-primary-200 rounded-full p-0.5 transition-colors"><X size={12} /></button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">Clear All</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tag ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Pet</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Last Scanned</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle size={32} className="text-red-400" />
                      <p className="text-sm text-red-600">{error}</p>
                      <button onClick={fetchTags} className="text-sm text-primary-600 hover:underline flex items-center gap-1"><RotateCcw size={14} /> Try Again</button>
                    </div>
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <TagIcon size={32} className="text-gray-300" />
                      <p className="text-sm text-gray-500">No tags found</p>
                      {activeFilters.length > 0 && <button onClick={clearAllFilters} className="text-sm text-primary-600 hover:underline">Clear Filters</button>}
                    </div>
                  </td>
                </tr>
              ) : (
                data?.items.map((tag) => (
                  <tr key={tag._id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedTag(tag)}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-mono font-medium text-gray-900">
                        <TagIcon size={14} className="text-primary-500" />
                        {tag.tagId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => { const badge = getTypeBadge(tag.tagType || 'qr'); return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
                          {tag.tagType === 'nfc' ? <Nfc size={12} /> : <QrCode size={12} />}
                          {badge.label}
                        </span>
                      ); })()}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {tag.petId ? (
                        <div>
                          <span className="font-medium text-gray-900">{tag.petId.name}</span>
                          <span className="text-xs text-gray-400 ml-1 font-mono">({tag.petId.petId})</span>
                        </div>
                      ) : <span className="text-gray-400">Unlinked</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{tag.ownerId?.fullName || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {(() => { const badge = getStatusBadge(tag.status); return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.icon} {tag.status}
                        </span>
                      ); })()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">
                      {tag.lastScannedAt ? timeAgo(tag.lastScannedAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedTag(tag); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
            <span className="text-sm text-gray-500">Showing {startIdx}–{endIdx} of {data.total} tags</span>
            <div className="flex items-center gap-3">
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"><ChevronLeft size={14} /></button>
                <span className="px-3 py-1 text-sm text-gray-700">Page {page} of {data.totalPages}</span>
                <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Drawer */}
        <DetailDrawer tag={selectedTag} onClose={() => setSelectedTag(null)} onRefresh={() => { fetchTags(); fetchSummary(); }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card                                                       */
/* ------------------------------------------------------------------ */

function SummaryCard({ label, value, icon, color = 'primary', loading, onClick, active }: {
  label: string; value: number; icon: React.ReactNode;
  color?: 'primary' | 'emerald' | 'red' | 'amber';
  loading?: boolean; onClick?: () => void; active?: boolean;
}) {
  const colorMap = {
    primary: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  };
  const c = colorMap[color];
  return (
    <button onClick={onClick} disabled={!onClick || loading}
      className={`text-left p-4 rounded-xl border transition-all ${active ? `${c.bg} ${c.border} ring-2 ring-offset-1 ring-${color === 'primary' ? 'primary' : color}-400` : 'bg-white border-gray-200 hover:border-gray-300'} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${loading ? 'text-gray-300' : 'text-gray-900'}`}>{loading ? '—' : value.toLocaleString()}</span>
        <span className={`${c.text}`}>{icon}</span>
      </div>
      <span className="text-sm text-gray-500 mt-1 block">{label}</span>
    </button>
  );
}
