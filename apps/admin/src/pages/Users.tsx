import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';
import { Plus, X, Save, Key, Lock, Unlock, Trash2, Edit2 } from 'lucide-react';

export default function Users() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ email: '', password: '', fullName: '', phoneNumber: '', roleId: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [resetPwUser, setResetPwUser] = useState<any>(null);
  const [newPw, setNewPw] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rbacRoles, setRbacRoles] = useState<any[]>([]);
  const [roleDropdownUser, setRoleDropdownUser] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', phoneNumber: '', responsibilityScore: 0 });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const fetchRoles = () => {
    api.get('/admin/rbac/roles').then((res) => setRbacRoles(res.data.data || [])).catch(console.error);
  };

  const fetchUsers = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    if (roleFilter) params.roleId = roleFilter;
    api.get('/admin/users', { params }).then((res) => setData(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoles(); }, []);
  useEffect(() => { fetchUsers(); }, [page, roleFilter]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-role-dropdown]')) {
        setRoleDropdownUser(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers(); };
  const updateRole = async (id: string, roleId: string) => {
    if (!roleId) return;
    await api.put(`/admin/users/${id}/role`, { roleId });
    fetchUsers();
  };
  const updateStatus = async (id: string, status: string) => { await api.put(`/admin/users/${id}/status`, { status }); fetchUsers(); };

  const registerOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(''); setRegSuccess('');
    try {
      await api.post('/admin/owners/register', regForm);
      setRegSuccess('User registered successfully!');
      setRegForm({ email: '', password: '', fullName: '', phoneNumber: '', roleId: '' });
      fetchUsers();
      setTimeout(() => setRegSuccess(''), 3000);
    } catch (err: any) {
      setRegError(err.response?.data?.error || 'Registration failed');
    }
  };

  const resetPassword = async () => {
    if (!resetPwUser || !newPw) return;
    setActionLoading(resetPwUser._id);
    try {
      await api.post(`/admin/users/${resetPwUser._id}/reset-password`, { newPassword: newPw });
      setResetMsg('Password reset successfully');
      setResetPwUser(null); setNewPw('');
      setTimeout(() => setResetMsg(''), 3000);
    } catch (err: any) {
      setResetMsg(err.response?.data?.error || 'Failed to reset password');
    } finally { setActionLoading(null); }
  };

  const lockUser = async (id: string) => {
    setActionLoading(id);
    try { await api.put(`/admin/users/${id}/lock`); fetchUsers(); } catch (err: any) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const unlockUser = async (id: string) => {
    setActionLoading(id);
    try { await api.put(`/admin/users/${id}/unlock`); fetchUsers(); } catch (err: any) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Soft-delete user "${name}"? They will be hidden from lists but data is preserved.`)) return;
    setActionLoading(id);
    try { await api.delete(`/admin/users/${id}`); fetchUsers(); } catch (err: any) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const openEdit = (user: any) => {
    setEditUser(user);
    setEditForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      responsibilityScore: user.responsibilityScore || 0,
    });
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditSaving(true);
    setEditError('');
    try {
      await api.put(`/admin/users/${editUser._id}`, editForm);
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button onClick={() => setShowRegister(!showRegister)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
          <Plus size={14} /> Register User
        </button>
      </div>

      {showRegister && (
        <form onSubmit={registerOwner} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Register New User</h2>
            <button type="button" onClick={() => { setShowRegister(false); setRegError(''); setRegSuccess(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          <p className="text-sm text-gray-500">Create a new user account and assign a role.</p>
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
              <label className="block text-xs text-gray-500 mb-1">Phone Number *</label>
              <input value={regForm.phoneNumber} onChange={(e) => setRegForm({ ...regForm, phoneNumber: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Role *</label>
              <select value={regForm.roleId} onChange={(e) => setRegForm({ ...regForm, roleId: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required>
                <option value="">Select a role...</option>
                {rbacRoles.map((r: any) => (
                  <option key={r._id} value={r._id}>{r.displayName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Save size={14} /> Register User</button>
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
          {rbacRoles.map((r: any) => (
            <option key={r._id} value={r._id}>{r.displayName}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Score</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Joined</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">No users found</td></tr>
            ) : data?.items.map((user: any) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{user.fullName}</td>
                <td className="px-5 py-3 text-gray-600">{user.email}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{user.phoneNumber || '—'}</td>
                <td className="px-5 py-3">
                  {user.rbacRoles && user.rbacRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.rbacRoles.map((ur: any) => (
                        <span key={ur._id} className={`text-xs px-2 py-0.5 rounded-full ${
                          ur.roleId?.isSuperAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ur.roleId?.displayName || ur.roleId?.name || 'Unknown'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No role assigned</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <select value={user.status} onChange={(e) => updateStatus(user._id, e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending_verification">Pending Verification</option>
                  </select>
                </td>
                <td className="px-5 py-3">
                  {user.rbacRoles?.some((ur: any) => ur.roleId?.name === 'PET_OWNER') ? (
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                      (user.responsibilityScore || 0) === 0 ? 'bg-green-100 text-green-700' :
                      (user.responsibilityScore || 0) <= 2 ? 'bg-amber-100 text-amber-700' :
                      (user.responsibilityScore || 0) <= 4 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>{user.responsibilityScore || 0}</span>
                  ) : <span className="text-gray-300 text-sm">—</span>}
                </td>
                <td className="px-5 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 relative">
                    <button onClick={() => openEdit(user)} title="Edit user" className="p-1.5 rounded hover:bg-blue-100 text-blue-600">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { setRoleDropdownUser(roleDropdownUser === user._id ? null : user._id); }} title="Assign role" className="p-1.5 rounded hover:bg-blue-100 text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                    </button>
                    {roleDropdownUser === user._id && (
                      <div data-role-dropdown className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px]">
                        <div className="text-xs text-gray-500 px-2 py-1 mb-1">Assign Role</div>
                        {rbacRoles.map((r: any) => {
                          const assigned = user.rbacRoles?.some((ur: any) => ur.roleId?._id === r._id);
                          return (
                            <button
                              key={r._id}
                              onClick={async () => {
                                await updateRole(user._id, r._id);
                                setRoleDropdownUser(null);
                              }}
                              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center justify-between ${assigned ? 'font-medium text-primary-600' : 'text-gray-700'}`}
                            >
                              <span>{r.displayName}</span>
                              {assigned && <span className="text-green-500 text-xs">&#10003;</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={() => { setResetPwUser(user); setResetMsg(''); setNewPw(''); }} title="Reset password" className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600"><Key size={14} /></button>
                    {user.status === 'active' || user.status === 'pending_verification' ? (
                      <button onClick={() => lockUser(user._id)} title="Lock account" disabled={actionLoading === user._id} className="p-1.5 rounded hover:bg-red-100 text-red-500 disabled:opacity-50"><Lock size={14} /></button>
                    ) : (
                      <button onClick={() => unlockUser(user._id)} title="Unlock account" disabled={actionLoading === user._id} className="p-1.5 rounded hover:bg-green-100 text-green-600 disabled:opacity-50"><Unlock size={14} /></button>
                    )}
                    <button onClick={() => deleteUser(user._id, user.fullName)} title="Soft-delete user" disabled={actionLoading === user._id} className="p-1.5 rounded hover:bg-red-100 text-red-500 disabled:opacity-50"><Trash2 size={14} /></button>
                  </div>
                </td>
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

      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit User — {editUser.fullName}</h3>
              <button onClick={() => { setEditUser(null); setEditError(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
            {editError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{editError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
                <input value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Responsibility Score (0-10)</label>
                <input type="number" min={0} max={10} value={editForm.responsibilityScore} onChange={(e) => setEditForm({ ...editForm, responsibilityScore: parseInt(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleEditSave} disabled={editSaving} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50">
                <Save size={14} /> {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => { setEditUser(null); setEditError(''); }} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {resetPwUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Reset Password for {resetPwUser.fullName}</h3>
              <button onClick={() => { setResetPwUser(null); setResetMsg(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
            {resetMsg && <div className="bg-green-50 text-green-600 text-sm p-3 rounded">{resetMsg}</div>}
            <div>
              <label className="block text-xs text-gray-500 mb-1">New Password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required minLength={8} />
            </div>
            <div className="flex gap-2">
              <button onClick={resetPassword} disabled={!newPw || newPw.length < 8} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50"><Key size={14} /> Reset Password</button>
              <button onClick={() => { setResetPwUser(null); setResetMsg(''); }} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
