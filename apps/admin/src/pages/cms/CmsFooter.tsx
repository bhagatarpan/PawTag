import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Plus, Trash2 } from 'lucide-react';

interface FooterLink { label: string; url: string; target: '_self' | '_blank'; visible: boolean; order: number; }
interface FooterGroup { groupId: string; title: string; links: FooterLink[]; visible: boolean; order: number; }
interface FooterData { _id: string; name: string; groups: FooterGroup[]; copyright?: string; socialLinks?: Record<string, string>; status: string; updatedAt: string; }

export default function CmsFooter() {
  const [footers, setFooters] = useState<FooterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FooterData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', copyright: '', status: 'draft' });
  const [groups, setGroups] = useState<FooterGroup[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const fetchFooters = () => {
    setLoading(true);
    api.get('/admin/cms/footer')
      .then((res) => setFooters(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFooters(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', copyright: '', status: 'draft' });
    setGroups([]);
    setSocialLinks({});
    setShowForm(true);
  };

  const openEdit = (f: FooterData) => {
    setEditing(f);
    setForm({ name: f.name, copyright: f.copyright || '', status: f.status });
    setGroups([...f.groups]);
    setSocialLinks({ ...f.socialLinks } as Record<string, string>);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, groups, socialLinks };
      if (editing) {
        await api.put(`/admin/cms/footer/${editing._id}`, payload);
      } else {
        await api.post('/admin/cms/footer', payload);
      }
      setShowForm(false);
      fetchFooters();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save footer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this footer?')) return;
    await api.delete(`/admin/cms/footer/${id}`);
    fetchFooters();
  };

  const addGroup = () => {
    setGroups([...groups, { groupId: `group_${Date.now()}`, title: '', links: [], visible: true, order: groups.length }]);
  };

  const updateGroup = (idx: number, updates: Partial<FooterGroup>) => {
    setGroups(groups.map((g, i) => i === idx ? { ...g, ...updates } : g));
  };

  const removeGroup = (idx: number) => setGroups(groups.filter((_, i) => i !== idx));

  const addLink = (groupIdx: number) => {
    const newGroups = [...groups];
    newGroups[groupIdx].links.push({ label: '', url: '/', target: '_self', visible: true, order: newGroups[groupIdx].links.length });
    setGroups(newGroups);
  };

  const updateLink = (groupIdx: number, linkIdx: number, updates: Partial<FooterLink>) => {
    const newGroups = [...groups];
    newGroups[groupIdx].links[linkIdx] = { ...newGroups[groupIdx].links[linkIdx], ...updates };
    setGroups(newGroups);
  };

  const removeLink = (groupIdx: number, linkIdx: number) => {
    const newGroups = [...groups];
    newGroups[groupIdx].links = newGroups[groupIdx].links.filter((_, i) => i !== linkIdx);
    setGroups(newGroups);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Footer</h1>
          <p className="text-sm text-gray-500 mt-1">Manage website footer layout, links, and social media</p>
        </div>
        <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">+ New Footer</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Footer' : 'New Footer'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Footer Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Copyright Text</label>
                <input value={form.copyright} onChange={(e) => setForm({ ...form, copyright: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="2024 PawTag" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            {/* Social Links */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Social Media Links</h3>
              <div className="grid grid-cols-3 gap-4">
                {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok'].map((platform) => (
                  <div key={platform}>
                    <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{platform}</label>
                    <input value={socialLinks[platform] || ''} onChange={(e) => setSocialLinks({ ...socialLinks, [platform]: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" placeholder={`https://${platform}.com/...`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Groups */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Footer Groups</h3>
                <button type="button" onClick={addGroup} className="text-primary-600 hover:text-primary-800 text-sm flex items-center gap-1"><Plus className="h-3 w-3" /> Add Group</button>
              </div>
              {groups.map((group, gIdx) => (
                <div key={group.groupId} className="border border-gray-200 rounded-lg p-4 mb-3">
                  <div className="flex gap-2 items-center mb-3">
                    <input value={group.title} onChange={(e) => updateGroup(gIdx, { title: e.target.value })} placeholder="Group title" className="flex-1 border rounded px-3 py-1.5 text-sm" />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={group.visible} onChange={(e) => updateGroup(gIdx, { visible: e.target.checked })} /> Visible</label>
                    <button type="button" onClick={() => removeGroup(gIdx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-2 ml-4">
                    {group.links.map((link, lIdx) => (
                      <div key={lIdx} className="flex gap-2 items-center">
                        <input value={link.label} onChange={(e) => updateLink(gIdx, lIdx, { label: e.target.value })} placeholder="Label" className="w-32 border rounded px-2 py-1 text-sm" />
                        <input value={link.url} onChange={(e) => updateLink(gIdx, lIdx, { url: e.target.value })} placeholder="URL" className="flex-1 border rounded px-2 py-1 text-sm font-mono" />
                        <select value={link.target} onChange={(e) => updateLink(gIdx, lIdx, { target: e.target.value as '_self' | '_blank' })} className="border rounded px-2 py-1 text-xs">
                          <option value="_self">Same</option>
                          <option value="_blank">New</option>
                        </select>
                        <button type="button" onClick={() => removeLink(gIdx, lIdx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addLink(gIdx)} className="text-primary-600 hover:text-primary-800 text-xs">+ Add Link</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Groups</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Social</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : footers.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No footer configurations found</td></tr>
            ) : footers.map((f) => (
              <tr key={f._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{f.name}</td>
                <td className="px-5 py-3 text-gray-500">{f.groups?.length || 0} groups</td>
                <td className="px-5 py-3 text-gray-500">{Object.values(f.socialLinks || {}).filter(Boolean).length} links</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${f.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{f.status}</span>
                </td>
                <td className="px-5 py-3 flex gap-2">
                  <button onClick={() => openEdit(f)} className="text-primary-600 hover:text-primary-800 text-xs">Edit</button>
                  <button onClick={() => handleDelete(f._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
