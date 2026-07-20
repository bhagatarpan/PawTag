import { useEffect, useState, useRef } from 'react';
import api, { PaginatedData } from '../lib/api';
import { Search, Trash2, Plus, Edit2, Save, X, Tag as TagIcon, QrCode, Printer, Download, Copy } from 'lucide-react';

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

const emptyForm = { petId: '', ownerId: '', tagId: '', tagType: 'qr' as string, status: 'active' as string };

function OwnerSearch({ owners, value, onSelect, required }: { owners: any[]; value: string; onSelect: (id: string) => void; required?: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = owners.find((o) => o._id === value);

  const normPhone = (p: string) => {
    if (!p) return '';
    let n = p.replace(/[\s\-()]/g, '');
    if (n.startsWith('+64')) n = '0' + n.slice(3);
    return n.toLowerCase();
  };

  const filtered = query.trim()
    ? owners.filter((o) => {
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
          {filtered.slice(0, 20).map((o, i) => (
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

export default function Tags() {
  const [data, setData] = useState<PaginatedData<TagItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pets, setPets] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [qrModal, setQrModal] = useState<{ tagId: string; petName?: string; petId?: string; tagType?: string } | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState('');

  const fetchTags = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.tagType = typeFilter;
    api.get('/admin/tags', { params }).then((res) => setData(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  const fetchPets = () => api.get('/admin/pets', { params: { limit: 200 } }).then((r) => setPets(r.data.data.items)).catch(console.error);
  const fetchOwners = () => api.get('/admin/users', { params: { role: 'customer', limit: 200 } }).then((r) => setOwners(r.data.data.items)).catch(console.error);

  useEffect(() => { fetchTags(); }, [page, statusFilter, typeFilter]);
  useEffect(() => { fetchPets(); fetchOwners(); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchTags(); };

  const startAdd = () => {
    setEditingTag(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const startEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setForm({
      petId: tag.petId?._id || '',
      ownerId: tag.ownerId?._id || '',
      tagId: tag.tagId,
      tagType: tag.tagType || 'qr',
      status: tag.status,
    });
    setError('');
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingTag(null); setForm(emptyForm); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingTag) {
        await api.put(`/admin/tags/${editingTag._id}`, {
          petId: form.petId || undefined,
          ownerId: form.ownerId || undefined,
          tagType: form.tagType,
          status: form.status,
        });
      } else {
        await api.post('/admin/tags', {
          petId: form.petId,
          ownerId: form.ownerId,
          tagId: form.tagId || undefined,
          tagType: form.tagType,
          status: form.status,
        });
      }
      cancelForm();
      fetchTags();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const deleteTag = async (id: string) => {
    if (!confirm('Delete this tag? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/tags/${id}`);
      fetchTags();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/admin/tags/${id}`, { status });
      fetchTags();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Update failed');
    }
  };

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  const openQRModal = async (tag: TagItem) => {
    const url = `${apiBase}/tags/${tag.tagId}/qr?size=400`;
    setQrImageUrl(url);
    setQrModal({ tagId: tag.tagId, petName: tag.petId?.name, petId: tag.petId?.petId, tagType: tag.tagType });
  };

  const downloadQR = async (tagId: string) => {
    const res = await fetch(`${apiBase}/tags/${tagId}/qr?size=400`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${tagId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printQR = () => {
    if (!qrModal) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>QR - ${qrModal.tagId}</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:sans-serif}.card{text-align:center;border:2px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}img{width:250px;height:250px}.tag{font-size:20px;font-weight:700;font-family:monospace;margin-top:8px}.pet{font-size:14px;color:#666;margin-top:4px}@media print{body{background:white}.card{box-shadow:none}}</style></head><body><div class="card"><img src="${qrImageUrl}" /><div class="tag">${qrModal.tagId}</div>${qrModal.petName ? `<div class="pet">${qrModal.petName}${qrModal.petId ? ` (${qrModal.petId})` : ''}</div>` : ''}</div></body></html>`);
    win.document.close();
    win.print();
  };

  const copyNfcUrl = (tagId: string) => {
    const url = `${apiBase.replace('/api', '')}/finder/${tagId}`;
    navigator.clipboard.writeText(url);
  };

  const openSticker = (tagId: string) => {
    window.open(`${apiBase}/tags/${tagId}/sticker`, '_blank');
  };

  const printBulkQR = () => {
    if (!data?.items.length) return;
    const token = localStorage.getItem('admin_token');
    const tagIds = data.items.map((t) => t._id);
    // Open a new window with POST to bulk QR endpoint
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${apiBase}/admin/tags/qr-bulk`;
    form.target = '_blank';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'tagIds';
    input.value = JSON.stringify(tagIds);
    form.appendChild(input);
    // Also add auth header via a hidden field won't work for auth, so use fetch instead
    form.remove();
    // Use fetch + blob approach
    fetch(`${apiBase}/admin/tags/qr-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tagIds }),
    }).then((res) => res.text()).then((html) => {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    });
  };

  const statusColor = (s: string) => s === 'active' ? 'bg-green-100 text-green-700' : s === 'lost' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tag Management</h1>
        <div className="flex gap-2">
          {data && data.items.length > 0 && (
            <button onClick={printBulkQR} className="border border-primary-300 text-primary-700 px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-50">
              <Printer size={14} /> Print All QR
            </button>
          )}
          <button onClick={startAdd} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
            <Plus size={14} /> Create Tag
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{editingTag ? `Edit Tag ${editingTag.tagId}` : 'Create New Tag'}</h2>
            <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            {!editingTag && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tag ID (auto-generated if empty)</label>
                <input value={form.tagId} onChange={(e) => setForm({ ...form, tagId: e.target.value })} placeholder="PT-123456" className="w-full border rounded-md px-3 py-2 text-sm font-mono" />
                <p className="text-xs text-gray-400 mt-1">Format: PT-NNNNNN (6 digits)</p>
              </div>
            )}
            {editingTag && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tag ID</label>
                <input value={form.tagId} disabled className="w-full border rounded-md px-3 py-2 text-sm font-mono bg-gray-50" />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tag Type *</label>
              <select value={form.tagType} onChange={(e) => setForm({ ...form, tagType: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" disabled={!!editingTag}>
                <option value="qr">QR Code</option>
                <option value="nfc">NFC Tag</option>
              </select>
              {editingTag && <p className="text-xs text-gray-400 mt-1">Tag type cannot be changed after creation</p>}
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
                {pets.map((p: any) => (
                  <option key={p._id} value={p._id}>{p.name} ({p.petId || 'no ID'}) — {p.ownerId?.fullName || 'unknown owner'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Owner *</label>
              <OwnerSearch owners={owners} value={form.ownerId} onSelect={(id) => setForm({ ...form, ownerId: id })} required />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Save size={14} /> {editingTag ? 'Update' : 'Create'}</button>
            <button type="button" onClick={cancelForm} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Search by tag ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64"
          />
          <button type="submit" className="bg-primary-600 text-white px-3 py-2 rounded-md text-sm hover:bg-primary-700"><Search size={14} /></button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="lost">Lost</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="qr">QR Code</option>
          <option value="nfc">NFC Tag</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Tag ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pet</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Last Scanned</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No tags found</td></tr>
            ) : (
              data?.items.map((tag) => (
                <tr key={tag._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium flex items-center gap-1.5">
                    <TagIcon size={14} className="text-primary-500" />
                    {tag.tagId}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${tag.tagType === 'nfc' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {tag.tagType === 'nfc' ? 'NFC' : 'QR'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {tag.petId ? (
                      <div>
                        <span className="font-medium">{tag.petId.name}</span>
                        {tag.petId.petId && <span className="text-xs text-gray-400 ml-1 font-mono">({tag.petId.petId})</span>}
                        <span className="text-xs text-gray-500 block">{tag.petId.petType} — {tag.petId.breed}</span>
                      </div>
                    ) : <span className="text-gray-400">Unlinked</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{tag.ownerId?.fullName || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{tag.ownerId?.phoneNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{tag.ownerId?.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColor(tag.status)}`}>
                      {tag.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {tag.lastScannedAt ? new Date(tag.lastScannedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <button onClick={() => startEdit(tag)} className="text-primary-500 hover:text-primary-700 p-1" title="Edit"><Edit2 size={13} /></button>
                      <button onClick={() => openQRModal(tag)} className="text-blue-500 hover:text-blue-700 p-1" title={tag.tagType === 'nfc' ? 'View NFC Info' : 'View QR Code'}><QrCode size={13} /></button>
                      <button onClick={() => openSticker(tag.tagId)} className="text-purple-500 hover:text-purple-700 p-1" title="Print Sticker"><Printer size={13} /></button>
                      {tag.status !== 'active' && (
                        <button onClick={() => updateStatus(tag._id, 'active')} className="text-green-500 hover:text-green-700 text-xs px-1.5 py-0.5 rounded hover:bg-green-50" title="Activate">Activate</button>
                      )}
                      {tag.status !== 'inactive' && (
                        <button onClick={() => updateStatus(tag._id, 'inactive')} className="text-gray-500 hover:text-gray-700 text-xs px-1.5 py-0.5 rounded hover:bg-gray-100" title="Deactivate">Deactivate</button>
                      )}
                      {tag.status !== 'lost' && (
                        <button onClick={() => updateStatus(tag._id, 'lost')} className="text-red-500 hover:text-red-700 text-xs px-1.5 py-0.5 rounded hover:bg-red-50" title="Mark Lost">Lost</button>
                      )}
                      <button onClick={() => deleteTag(tag._id)} className="text-red-400 hover:text-red-600 p-1" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total tags</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <span className="px-3 py-1">Page {page} of {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setQrModal(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-1">{qrModal.tagType === 'nfc' ? 'NFC Tag' : 'QR Code'}</h3>
              <p className="text-sm text-gray-500 font-mono mb-4">{qrModal.tagId}</p>
              {qrModal.petName && <p className="text-sm text-gray-600 mb-1">{qrModal.petName}{qrModal.petId ? ` (${qrModal.petId})` : ''}</p>}
              {qrModal.tagType === 'nfc' ? (
                <div className="my-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium mb-2">NFC URL to encode:</p>
                  <p className="text-xs text-blue-600 font-mono break-all bg-white p-2 rounded border border-blue-100">{`${apiBase.replace('/api', '')}/finder/${qrModal.tagId}`}</p>
                  <p className="text-xs text-gray-500 mt-2">Write this URL to the NFC tag using an NFC writer app.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center my-4">
                    <img src={qrImageUrl} alt={`QR ${qrModal.tagId}`} className="w-64 h-64 rounded-lg border" />
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Scan to view pet info on Finder</p>
                </>
              )}
              <div className="flex gap-2 justify-center">
                {qrModal.tagType !== 'nfc' && (
                  <>
                    <button onClick={() => downloadQR(qrModal.tagId)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
                      <Download size={14} /> Download
                    </button>
                    <button onClick={printQR} className="border border-primary-300 text-primary-700 px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-50">
                      <Printer size={14} /> Print
                    </button>
                  </>
                )}
                <button onClick={() => window.open(`${apiBase}/tags/${qrModal.tagId}/sticker`, '_blank')} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-gray-50">
                  Sticker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
