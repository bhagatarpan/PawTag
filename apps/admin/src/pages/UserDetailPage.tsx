import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { UserDetailContent, type UserRecord } from './Users';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [rbacRoles, setRbacRoles] = useState<any[]>([]);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [userRes, rolesRes] = await Promise.all([
        api.get(API.admin.users.get(id)),
        api.get('/admin/rbac/roles'),
      ]);
      setUser(userRes.data.data);
      setRbacRoles(rolesRes.data.data || []);
    } catch {
      toast.error('Failed to load user');
      navigate('/users/customers');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary-600" />
        <span className="ml-3 text-gray-500">Loading user...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/users/customers')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft size={16} /> Back to Users
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <UserDetailContent
          user={user}
          onRefresh={fetchUser}
          rbacRoles={rbacRoles}
          fullWidth
        />
      </div>
    </div>
  );
}
