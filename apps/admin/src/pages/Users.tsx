import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';
import { Plus, X, Save } from 'lucide-react';

export default function Users() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ email: '', password: '', fullName: '', phoneNumber: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    api.get('/admin/users', { params }).then((res) => setData(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page, roleFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers(); };
  const updateRole = async (id: string, role: string) => { await api.put(`/admin/users/${id}/role`, { role }); fetchUsers(); };
  const updateStatus = async (id: string, status: string) => { await api.put(`/admin/users/${id}/status`, { status }); fetchUsers(); };

  const registerOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(''); setRegSuccess('');
    try {
      await api.post('/admin/owners/register', regForm);
      setRegSuccess('Owner registered successfully!');
      setRegForm({ email: '', password: '', fullName: '', phoneNumber: '' });
      fetchUsers();
      setTimeout(() => setRegSuccess(''), 3000);
    } catch (err: any) {
      setRegError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button onClick={() => setShowRegister(!showRegister)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
          <Plus size={14} /> Register Owner
        </button>
      </div>

      {showRegister && (
        <form onSubmit={registerOwner} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Register Owner on Behalf</h2>
            <button type="button" onClick={() => { setShowRegister(false); setRegError(''); setRegSuccess(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          <p className="text-sm text-gray-500">For customers who cannot register themselves (e.g. elderly owners).</p>
          {regError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{regError}</div>}
          {regSuccess && <div className="bg-green-50 text-green-600 text-sm p-3 rounded">{regSuccess}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name *</label>
              <input value={regForm.fullName} onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email *</label>
              <input type="email" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Password *</label>
              <input type="password" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required minLength={8} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
              <input value={regForm.phoneNumber} onChange={(e) => setRegForm({ ...regForm, phoneNumber: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Save size={14} /> Register Owner</button>
            <button type="button" onClick={() => setShowRegister(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex gap-4 items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Search</button>
        </form>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="support">Support</option>
          <option value="customer">Customer</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No users found</td></tr>
            ) : data?.items.map((user: any) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{user.fullName}</td>
                <td className="px-5 py-3 text-gray-600">{user.email}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{user.phoneNumber || '—'}</td>
                <td className="px-5 py-3">
                  <select value={user.role} onChange={(e) => updateRole(user._id, e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs">
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="support">Support</option>
                    <option value="customer">Customer</option>
                  </select>
                </td>
                <td className="px-5 py-3">
                  <select value={user.status} onChange={(e) => updateStatus(user._id, e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending_verification">Pending Verification</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total users</span>
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
