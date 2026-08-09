import { useEffect, useState } from 'react';
import api from '../lib/api';

const SEVERITY = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const OUTCOMES = ['', 'SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING'];
const CATEGORIES = ['', 'AUTH', 'AUTHZ', 'CREATE', 'UPDATE', 'DELETE', 'READ', 'EXPORT', 'TRANSITION', 'FINANCIAL', 'SECURITY', 'ADMIN', 'SYSTEM', 'INTEGRATION', 'FILE', 'CONFIG'];

export default function AuditTrail() {
  const [data, setData] = useState<{ items: any[]; total: number; page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [verify, setVerify] = useState<{ valid: boolean; checked: number; error?: string } | null>(null);

  const [filters, setFilters] = useState({
    action: '',
    eventCategory: '',
    resourceType: '',
    resourceId: '',
    actorType: '',
    severity: '',
    outcome: '',
  });

  const fetchEvents = () => {
    setLoading(true);
    const params: any = { page, limit: 50 };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    api
      .get('/admin/audit', { params })
      .then((res) => {
        setData(res.data.data);
        setVerify(null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, [page, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const runVerify = () => {
    setVerify(null);
    api
      .get('/admin/audit/verify-chain')
      .then((res) => setVerify(res.data.data))
      .catch(console.error);
  };

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Trail</h1>
          <p className="text-sm text-gray-500">Tamper-evident audit event stream (all actors, all resources).</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runVerify}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Verify Integrity
          </button>
          <button
            onClick={() => { setFilters({ action: '', eventCategory: '', resourceType: '', resourceId: '', actorType: '', severity: '', outcome: '' }); setPage(1); }}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {verify && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${verify.valid ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {verify.valid ? `Chain intact — ${verify.checked} event(s) verified.` : `Chain INVALID at ${verify.error || 'unknown event'} — ${verify.checked} event(s) checked.`}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Action / event type"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-52"
          value={filters.action}
          onChange={(e) => setFilter('action', e.target.value)}
        />
        <select value={filters.eventCategory} onChange={(e) => setFilter('eventCategory', e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.actorType} onChange={(e) => setFilter('actorType', e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All Actors</option>
          {['USER', 'ADMIN', 'CSR', 'WEB_EDITOR', 'DESIGNER', 'AUTHOR', 'SERVICE', 'SYSTEM', 'SCHEDULED_JOB', 'API_CLIENT', 'WEBHOOK', 'AI_AGENT', 'FINDER', 'UNKNOWN'].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All Severity</option>
          {SEVERITY.slice(1).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.outcome} onChange={(e) => setFilter('outcome', e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All Outcomes</option>
          {OUTCOMES.slice(1).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input
          placeholder="Resource type (e.g. Pet)"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40"
          value={filters.resourceType}
          onChange={(e) => setFilter('resourceType', e.target.value)}
        />
        <input
          placeholder="Resource ID"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40"
          value={filters.resourceId}
          onChange={(e) => setFilter('resourceId', e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Time</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actor</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Action</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Resource</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No audit events found</td></tr>
            ) : (
              data?.items.map((ev: any) => (
                <tr key={ev.auditEventId} className="hover:bg-gray-50 align-top">
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(ev.occurredAt).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <div className="text-xs font-medium">{ev.actorType}{ev.actorId ? ` · ${ev.actorId}` : ''}</div>
                    {ev.actorEmail && <div className="text-xs text-gray-400">{ev.actorEmail}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      {ev.action}
                    </span>
                    <div className="text-xs text-gray-400 mt-1">{ev.eventType}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {ev.resourceType}
                    {ev.resourceId && <div className="font-mono text-xs text-gray-400">{ev.resourceId}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      ev.outcome === 'FAILURE' ? 'bg-red-100 text-red-700' : ev.outcome === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {ev.outcome}
                    </span>
                    <span className={`ml-1 inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      ev.severity === 'CRITICAL' ? 'bg-red-600 text-white' : ev.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {ev.severity}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total events</span>
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