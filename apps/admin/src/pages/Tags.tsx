import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';
import { Search, Trash2, Plus, Edit2, Save, X, Tag as TagIcon, QrCode, Printer } from 'lucide-react';

interface TagItem {
  _id: string;
  tagId: string;
  petId: { _id: string; name: string; petId: string; petType: string; breed: string; color: string; status: string } | null;
  ownerId: { _id: string; fullName: string; email: string } | null;
  status: 'active' | 'inactive' | 'lost';
  lastScannedAt?: string;
  createdAt: string;
}

const emptyForm = { petId: '', ownerId: '', tagId: '', status: 'active' as string };

export default function Tags() {
  const [data, setData] = useState<PaginatedData<TagItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pets, setPets] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [error, setError] = useState('');

  const fetchTags = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    api.get('/admin/tags', { params }).then((res) => setData(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  const fetchPets = () => api.get('/admin/pets', { params: { limit: 200 } }).then((r) => setPets(r.data.data.items)).catch(console.error);
  const fetchOwners = () => api.get('/admin/users', { params: { role: 'customer', limit: 200 } }).then((r) => setOwners(r.data.data.items)).catch(console.error);

  useEffect(() => { fetchTags(); }, [page, statusFilter]);
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
          status: form.status,
        });
      } else {
        await api.post('/admin/tags', {
          petId: form.petId,
          ownerId: form.ownerId,
          tagId: form.tagId || undefined,
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

  const downloadQR = async (tagId: string) => {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${apiBase}/admin/tags/${tagId}/qr?size=400`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${tagId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSticker = (tagId: string) => {
    const token = localStorage.getItem('admin_token');
    window.open(`${apiBase}/admin/tags/${tagId}/sticker`, '_blank');
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
              <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required>
                <option value="">Select owner...</option>
                {owners.map((o: any) => <option key={o._id} value={o._id}>{o.fullName} ({o.email})</option>)}
              </select>
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Tag ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pet</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Last Scanned</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No tags found</td></tr>
            ) : (
              data?.items.map((tag) => (
                <tr key={tag._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium flex items-center gap-1.5">
                    <TagIcon size={14} className="text-primary-500" />
                    {tag.tagId}
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
                      <button onClick={() => downloadQR(tag.tagId)} className="text-blue-500 hover:text-blue-700 p-1" title="Download QR Code"><QrCode size={13} /></button>
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
    </div>
  );
}
