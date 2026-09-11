import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Search, Filter, ChevronDown, ChevronRight, Edit, Eye, Trash2,
  Send, Clock, CheckCircle, AlertTriangle, Activity, BarChart3, Database,
} from 'lucide-react';
import api from '../../lib/api';
import { API } from '@pawtag/shared/api';

interface Template {
  _id: string;
  name: string;
  slug: string;
  subject: string;
  title: string;
  subtitle?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  preheader?: string;
  footerText?: string;
  senderEmail: string;
  senderName: string;
  variables: string[];
  status: 'active' | 'inactive' | 'draft' | 'archived';
  businessFlow: string;
  purpose: string;
  triggerDescription: string;
  recipientDescription: string;
  emailType: 'transactional' | 'system' | 'marketing';
  isCritical: boolean;
  version: number;
  variableDefinitions: Array<{
    key: string;
    label: string;
    description: string;
    type: string;
    example: string;
    required: boolean;
    source: string;
  }>;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { fullName: string };
  updatedBy?: { fullName: string };
}

interface DashboardData {
  templates: { total: number; active: number; draft: number; disabled: number; archived: number };
  emails: { total: number; sent: number; delivered: number; failed: number; bounced: number; today: number; thisWeek: number };
  recentFailures: Array<{ recipientEmail: string; subject: string; status: string; failureReason: string; createdAt: string; templateSlug: string }>;
  recentlyUpdated: Array<{ name: string; slug: string; status: string; businessFlow: string; updatedAt: string; version: number }>;
}

const BUSINESS_FLOWS: Record<string, string> = {
  account_security: 'Account & Security',
  pet_tag: 'Pet & Tag',
  lost_found: 'Lost & Found',
  orders_commerce: 'Orders & Commerce',
  subscriptions: 'Subscriptions',
  guardian_loyalty: 'Guardian & Loyalty',
  referrals: 'Referrals',
  admin_system: 'Admin / System',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  draft: 'bg-amber-100 text-amber-700 border-amber-200',
  archived: 'bg-blue-100 text-blue-700 border-blue-200',
};

const FLOW_COLORS: Record<string, string> = {
  account_security: 'bg-blue-100 text-blue-700',
  pet_tag: 'bg-purple-100 text-purple-700',
  lost_found: 'bg-red-100 text-red-700',
  orders_commerce: 'bg-orange-100 text-orange-700',
  subscriptions: 'bg-green-100 text-green-700',
  guardian_loyalty: 'bg-yellow-100 text-yellow-700',
  referrals: 'bg-pink-100 text-pink-700',
  admin_system: 'bg-gray-100 text-gray-700',
  other: 'bg-gray-100 text-gray-500',
};

export default function CommunicationsTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [flowFilter, setFlowFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchDashboard = async () => {
    try {
      const res = await api.get(API.admin.cms.communications.dashboard);
      setDashboard(res.data.data);
    } catch (err) {
      console.error('Failed to fetch dashboard', err);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (flowFilter) params.set('businessFlow', flowFilter);
      if (typeFilter) params.set('emailType', typeFilter);
      const res = await api.get(`${API.admin.cms.communications.templates.list}?${params}`);
      setTemplates(res.data.data.items);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } catch (err) {
      console.error('Failed to fetch templates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);
  useEffect(() => { fetchTemplates(); }, [page, search, statusFilter, flowFilter, typeFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/admin/cms/email/email-templates/${id}`);
      fetchTemplates();
      fetchDashboard();
    } catch (err) {
      console.error('Failed to delete template', err);
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="text-sm text-gray-500 mt-1">Manage email templates, business flows, and content across PawTag.</p>
      </div>

      {/* Dashboard Metrics */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900">{dashboard.templates.total}</span>
              <Mail size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Total Templates</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">{dashboard.templates.active}</span>
              <CheckCircle size={20} className="text-green-400" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Active</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-amber-600">{dashboard.templates.draft}</span>
              <Clock size={20} className="text-amber-400" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Draft</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">{dashboard.emails.thisWeek}</span>
              <Activity size={20} className="text-blue-400" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Sent This Week</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">{dashboard.emails.delivered}</span>
              <BarChart3 size={20} className="text-green-400" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Delivered</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-red-600">{dashboard.emails.failed}</span>
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Failed</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={flowFilter}
            onChange={(e) => { setFlowFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Flows</option>
            {Object.entries(BUSINESS_FLOWS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="transactional">Transactional</option>
            <option value="system">System</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Template</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Business Flow</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Trigger</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Recipient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Version</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Updated</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-40" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                  <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-gray-200 rounded w-8" /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16 ml-auto" /></td>
                </tr>
              ))
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Mail size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No templates found</p>
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr
                  key={template._id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/communications/templates/${template._id}`)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{template.slug}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[300px]">{template.subject}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${FLOW_COLORS[template.businessFlow] || 'bg-gray-100 text-gray-600'}`}>
                      {BUSINESS_FLOWS[template.businessFlow] || template.businessFlow}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-gray-600 truncate max-w-[200px]">{template.triggerDescription || '—'}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-gray-600">{template.recipientDescription || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[template.status] || 'bg-gray-100 text-gray-600'}`}>
                      {template.status === 'active' && <CheckCircle size={10} />}
                      {template.status === 'draft' && <Clock size={10} />}
                      {template.status === 'inactive' && <AlertTriangle size={10} />}
                      {template.status}
                    </span>
                    {template.isCritical && (
                      <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">CRITICAL</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-sm text-gray-600">v{template.version}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <p className="text-xs text-gray-500">{formatDate(template.updatedAt)}</p>
                    {template.updatedBy && (
                      <p className="text-xs text-gray-400">by {template.updatedBy.fullName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/communications/templates/${template._id}`)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => navigate(`/communications/templates/${template._id}?edit=true`)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      {!template.isCritical && (
                        <button
                          onClick={() => handleDelete(template._id)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
