import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Clock, CheckCircle, AlertTriangle, XCircle, Eye, Mail,
  ChevronDown, ChevronRight, Filter,
} from 'lucide-react';
import api from '../../lib/api';
import { API } from '@pawtag/shared/api';

interface AuditRecord {
  _id: string;
  templateSlug: string;
  templateVersion?: number;
  businessFlow: string;
  recipientEmail: string;
  recipientName?: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  previewText?: string;
  status: string;
  provider: string;
  providerMessageId?: string;
  failureReason?: string;
  isTest: boolean;
  relatedEntityType?: string;
  relatedEntityDisplay?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  queued: { icon: <Clock size={14} />, color: 'bg-gray-100 text-gray-600', label: 'Queued' },
  processing: { icon: <Clock size={14} />, color: 'bg-blue-100 text-blue-600', label: 'Processing' },
  sent: { icon: <Mail size={14} />, color: 'bg-blue-100 text-blue-600', label: 'Sent' },
  delivered: { icon: <CheckCircle size={14} />, color: 'bg-green-100 text-green-600', label: 'Delivered' },
  opened: { icon: <CheckCircle size={14} />, color: 'bg-green-100 text-green-700', label: 'Opened' },
  clicked: { icon: <CheckCircle size={14} />, color: 'bg-green-100 text-green-700', label: 'Clicked' },
  bounced: { icon: <XCircle size={14} />, color: 'bg-red-100 text-red-600', label: 'Bounced' },
  failed: { icon: <AlertTriangle size={14} />, color: 'bg-red-100 text-red-600', label: 'Failed' },
  complained: { icon: <AlertTriangle size={14} />, color: 'bg-orange-100 text-orange-600', label: 'Complained' },
};

const FLOW_LABELS: Record<string, string> = {
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

export default function CommunicationsAudit() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [flowFilter, setFlowFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (flowFilter) params.set('businessFlow', flowFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get(`${API.admin.cms.communications.audit.list}?${params}`);
      setRecords(res.data.data.items);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } catch (err) {
      console.error('Failed to fetch audit records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [page, search, statusFilter, flowFilter, dateFrom, dateTo]);

  const formatDate = (iso: string) => new Date(iso).toLocaleString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Audit</h1>
        <p className="text-sm text-gray-500 mt-1">Track every email sent by PawTag — delivery status, recipients, and history.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by recipient, subject, provider ID..."
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
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
          </select>
          <select
            value={flowFilter}
            onChange={(e) => { setFlowFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Flows</option>
            {Object.entries(FLOW_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <Filter size={14} /> Date Range {showFilters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline mt-5"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Template</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Recipient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Subject</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Provider</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Business Entity</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-40" /></td>
                  <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-12 ml-auto" /></td>
                </tr>
              ))
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Mail size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No email audit records found</p>
                </td>
              </tr>
            ) : (
              records.map((record) => {
                const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.queued;
                return (
                  <tr
                    key={record._id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/communications/audit/${record._id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{formatDate(record.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{record.templateSlug}</p>
                      {record.templateVersion && (
                        <p className="text-xs text-gray-400">v{record.templateVersion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{record.recipientEmail}</p>
                      {record.recipientName && (
                        <p className="text-xs text-gray-400">{record.recipientName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-gray-600 truncate max-w-[250px]">{record.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        {statusConfig.icon} {statusConfig.label}
                      </span>
                      {record.isTest && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600">TEST</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{record.provider}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {record.relatedEntityType && (
                        <span className="text-xs text-gray-500">
                          {record.relatedEntityType}: {record.relatedEntityDisplay || record.relatedEntityType}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/communications/audit/${record._id}`); }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}</p>
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
