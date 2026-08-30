import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { buildChangeRows, formatAuditValue, type AuditChangeRow, getActualChanges, getFieldDisplayName, getEntityDisplayName, getActionDisplayName, type ActualChange } from '../lib/audit-diff';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  Shield,
  Clock,
  AlertTriangle,
  Users,
  Activity,
  Copy,
  ExternalLink,
  FileText,
  Eye,
  RotateCcw,
  ArrowUpDown,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Link2,
  Fingerprint,
  Globe,
  Calendar,
  ChevronUp,
  SlidersHorizontal,
  Ban,
  Trash2,
  Plus,
  Pencil,
  LogIn,
  LogOut,
  Settings,
  Upload,
  Bell,
  Send,
  Tag,
  ShieldAlert,
  ShieldCheck,
  Database,
  Layers,
  Hash,
  Box,
  User,
  Mail,
  Clock3,
  MapPin,
  Smartphone,
  Laptop,
  OctagonAlert,
  Circle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AuditEvent {
  _id: string;
  auditEventId: string;
  transactionId?: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  parentEventId?: string;
  actorType: string;
  actorId?: string;
  actorEmail?: string;
  actorUsername?: string;
  impersonatorId?: string;
  tenantId?: string;
  action: string;
  eventType: string;
  eventCategory: string;
  operationType?: string;
  resourceType?: string;
  resourceId?: string;
  outcome: string;
  severity: string;
  sourceIp?: string;
  userAgent?: string;
  occurredAt: string;
  eventSequenceNumber?: number;
  legalHold?: boolean;
  metadata?: Record<string, unknown>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  businessOperation?: string;
  changedFields?: Array<{ field: string; before: unknown; after: unknown; sensitive?: boolean }>;
}

interface SummaryData {
  total: number;
  today: number;
  failed: number;
  highRisk: number;
  uniqueActors: number;
}

interface Filters {
  search: string;
  actorType: string;
  action: string;
  eventCategory: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  severity: string;
  startDate: string;
  endDate: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACTOR_TYPES = [
  'USER', 'ADMIN', 'CSR', 'WEB_EDITOR', 'DESIGNER', 'AUTHOR',
  'SERVICE', 'SYSTEM', 'SCHEDULED_JOB', 'API_CLIENT', 'WEBHOOK',
  'AI_AGENT', 'FINDER', 'UNKNOWN',
];

const EVENT_CATEGORIES = [
  'AUTH', 'AUTHZ', 'CREATE', 'UPDATE', 'DELETE', 'READ', 'EXPORT',
  'TRANSITION', 'FINANCIAL', 'SECURITY', 'ADMIN', 'SYSTEM',
  'INTEGRATION', 'FILE', 'CONFIG',
];

const OUTCOMES = ['SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING'];

const SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ACTION_GROUPS: Record<string, string[]> = {
  'Create': ['create', 'register', 'add', 'new'],
  'Update': ['update', 'edit', 'modify', 'change', 'set', 'patch'],
  'Delete': ['delete', 'remove', 'destroy', 'trash', 'purge'],
  'Read': ['read', 'view', 'list', 'query', 'search', 'get', 'fetch'],
  'Auth': ['login', 'logout', 'signin', 'signup', 'register', 'authenticate', 'refresh', 'forgot', 'reset', 'verify'],
  'Export': ['export', 'download', 'backup', 'archive'],
  'Transition': ['approve', 'reject', 'complete', 'cancel', 'suspend', 'reactivate'],
  'Financial': ['payment', 'charge', 'refund', 'invoice', 'subscription', 'billing'],
  'Permission': ['permission', 'rbac', 'role', 'grant', 'revoke', 'assign'],
  'Config': ['config', 'setting', 'preference', 'flag', 'toggle', 'policy'],
};

const DATE_PRESETS = [
  { label: 'Today', getRange: () => { const d = new Date(); d.setHours(0,0,0,0); return { start: d.toISOString(), end: new Date().toISOString() }; } },
  { label: 'Yesterday', getRange: () => { const d = new Date(); d.setDate(d.getDate()-1); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return { start: d.toISOString(), end: e.toISOString() }; } },
  { label: 'Last 7 days', getRange: () => { const d = new Date(); d.setDate(d.getDate()-7); return { start: d.toISOString(), end: new Date().toISOString() }; } },
  { label: 'Last 30 days', getRange: () => { const d = new Date(); d.setDate(d.getDate()-30); return { start: d.toISOString(), end: new Date().toISOString() }; } },
];

const PAGE_SIZES = [25, 50, 100];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
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

/* ------------------------------------------------------------------ */
/*  Icon / Color helpers                                               */
/* ------------------------------------------------------------------ */

function getActionIcon(action: string): React.ReactNode {
  const a = action.toLowerCase();
  if (/create|register|add|new|signup/.test(a)) return <Plus size={14} />;
  if (/update|edit|modify|change|set|patch/.test(a)) return <Pencil size={14} />;
  if (/delete|remove|destroy|trash|purge/.test(a)) return <Trash2 size={14} />;
  if (/login|signin|log.?in/.test(a)) return <LogIn size={14} />;
  if (/logout|signout|log.?out/.test(a)) return <LogOut size={14} />;
  if (/export|download|backup/.test(a)) return <Download size={14} />;
  if (/approve|reject|complete|cancel/.test(a)) return <CheckCircle size={14} />;
  if (/permission|rbac|role|grant|revoke/.test(a)) return <Shield size={14} />;
  if (/payment|charge|refund|invoice/.test(a)) return <FileText size={14} />;
  if (/config|setting|preference|flag|toggle/.test(a)) return <Settings size={14} />;
  if (/upload|import/.test(a)) return <Upload size={14} />;
  if (/send|notify|email|sms|notification/.test(a)) return <Send size={14} />;
  if (/verify|auth|token|otp/.test(a)) return <ShieldCheck size={14} />;
  return <Activity size={14} />;
}

function getActionColor(action: string): string {
  const a = action.toLowerCase();
  if (/create|register|add|new|signup/.test(a)) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (/update|edit|modify|change|set|patch/.test(a)) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (/delete|remove|destroy|trash|purge/.test(a)) return 'bg-red-100 text-red-700 border-red-200';
  if (/login|signin|log.?in/.test(a)) return 'bg-violet-100 text-violet-700 border-violet-200';
  if (/logout|signout|log.?out/.test(a)) return 'bg-gray-100 text-gray-600 border-gray-200';
  if (/export|download|backup/.test(a)) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (/approve|reject|complete|cancel/.test(a)) return 'bg-teal-100 text-teal-700 border-teal-200';
  if (/permission|rbac|role|grant|revoke/.test(a)) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (/config|setting|preference/.test(a)) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-600 text-white';
    case 'HIGH': return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    case 'LOW': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'INFO': return 'bg-gray-100 text-gray-600 border border-gray-200';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getOutcomeBadge(outcome: string): string {
  switch (outcome) {
    case 'SUCCESS': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'FAILURE': return 'bg-red-100 text-red-700 border border-red-200';
    case 'PARTIAL': return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'PENDING': return 'bg-blue-100 text-blue-700 border border-blue-200';
    default: return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
}

function getOutcomeIcon(outcome: string): React.ReactNode {
  switch (outcome) {
    case 'SUCCESS': return <CheckCircle size={13} />;
    case 'FAILURE': return <XCircle size={13} />;
    case 'PARTIAL': return <AlertCircle size={13} />;
    case 'PENDING': return <Clock3 size={13} />;
    default: return <Info size={13} />;
  }
}

function getActorTypeBadge(type: string): string {
  switch (type) {
    case 'USER': return 'bg-blue-100 text-blue-700';
    case 'ADMIN': return 'bg-purple-100 text-purple-700';
    case 'CSR': return 'bg-indigo-100 text-indigo-700';
    case 'WEB_EDITOR': return 'bg-cyan-100 text-cyan-700';
    case 'DESIGNER': return 'bg-pink-100 text-pink-700';
    case 'AUTHOR': return 'bg-teal-100 text-teal-700';
    case 'SERVICE': return 'bg-amber-100 text-amber-700';
    case 'SYSTEM': return 'bg-gray-200 text-gray-700';
    case 'SCHEDULED_JOB': return 'bg-orange-100 text-orange-700';
    case 'API_CLIENT': return 'bg-violet-100 text-violet-700';
    case 'WEBHOOK': return 'bg-rose-100 text-rose-700';
    case 'AI_AGENT': return 'bg-fuchsia-100 text-fuchsia-700';
    case 'FINDER': return 'bg-green-100 text-green-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getActorTypeIcon(type: string): React.ReactNode {
  switch (type) {
    case 'USER': return <User size={14} />;
    case 'ADMIN': return <ShieldCheck size={14} />;
    case 'CSR': return <Headphones size={14} />;
    case 'SERVICE': return <Box size={14} />;
    case 'SYSTEM': return <Database size={14} />;
    case 'FINDER': return <Globe size={14} />;
    case 'AI_AGENT': return <Layers size={14} />;
    default: return <User size={14} />;
  }
}

function Headphones(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function formatLabel(str: string): string {
  return str.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActionGroup(action: string): string {
  const a = action.toLowerCase();
  for (const [group, keywords] of Object.entries(ACTION_GROUPS)) {
    if (keywords.some((k) => a.includes(k))) return group;
  }
  return 'Other';
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20 mb-1" /><div className="h-3 bg-gray-200 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24 mb-1" /><div className="h-3 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-24" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-gray-200 rounded w-28 mb-1" /><div className="h-3 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-3 hidden xl:table-cell min-w-[200px]"><div className="h-4 bg-gray-200 rounded w-24 mb-1" /><div className="h-3 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3 hidden xl:table-cell min-w-[200px]"><div className="h-4 bg-gray-200 rounded w-24 mb-1" /><div className="h-3 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-5 bg-gray-200 rounded-full w-8" /></td>
      <td className="px-4 py-3 hidden xl:table-cell"><div className="h-5 bg-gray-200 rounded-full w-8" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter Chip                                                        */
/* ------------------------------------------------------------------ */

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
      {label}
      <button onClick={onRemove} className="hover:bg-primary-200 rounded-full p-0.5 transition-colors" aria-label={`Remove filter: ${label}`}>
        <X size={12} />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

function DetailDrawer({
  event,
  onClose,
  onFilterByActor,
  onFilterByEntity,
  onFilterByTransaction,
}: {
  event: AuditEvent | null;
  onClose: () => void;
  onFilterByActor: (actorId: string) => void;
  onFilterByEntity: (type: string, id: string) => void;
  onFilterByTransaction: (txId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'changes' | 'technical'>('details');
  const [relatedEvents, setRelatedEvents] = useState<AuditEvent[] | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [entityHistory, setEntityHistory] = useState<AuditEvent[] | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [rawJson, setRawJson] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!event) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [event, onClose]);

  useEffect(() => {
    if (!event) {
      setRelatedEvents(null);
      setEntityHistory(null);
      setActiveTab('details');
      setRawJson(false);
    }
  }, [event]);

  const loadRelated = useCallback(async (ev: AuditEvent) => {
    if (!ev.transactionId && !ev.correlationId) return;
    setRelatedLoading(true);
    try {
      const endpoint = ev.transactionId
        ? `/admin/audit/transaction/${ev.transactionId}`
        : `/admin/audit/correlation/${ev.correlationId}`;
      const res = await api.get(endpoint);
      setRelatedEvents((res.data.data || []).filter((e: AuditEvent) => e.auditEventId !== ev.auditEventId));
    } catch {
      setRelatedEvents([]);
    } finally {
      setRelatedLoading(false);
    }
  }, []);

  const loadEntityHistory = useCallback(async (ev: AuditEvent) => {
    if (!ev.resourceType || !ev.resourceId) return;
    setEntityLoading(true);
    try {
      const res = await api.get(`/admin/audit/entity/${ev.resourceType}/${ev.resourceId}`, { params: { limit: 20 } });
      setEntityHistory((res.data.data || []).filter((e: AuditEvent) => e.auditEventId !== ev.auditEventId));
    } catch {
      setEntityHistory([]);
    } finally {
      setEntityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (event) {
      loadRelated(event);
      loadEntityHistory(event);
    }
  }, [event, loadRelated, loadEntityHistory]);

  if (!event) return null;

  const changeRows: AuditChangeRow[] = buildChangeRows({
    changedFields: event.changedFields,
    beforeState: event.beforeState,
    afterState: event.afterState,
  });

  const hasChanges = changeRows.length > 0;

  const tabs = [
    { key: 'details' as const, label: 'Details' },
    ...(hasChanges ? [{ key: 'changes' as const, label: `Changes (${changeRows.length})` }] : []),
    { key: 'technical' as const, label: 'Technical' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Audit event details">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div ref={drawerRef} className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            {event.businessOperation ? (
              <span className="text-sm font-semibold text-gray-900 truncate">{event.businessOperation}</span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getActionColor(event.action)}`}>
                {getActionIcon(event.action)}
                {event.action}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getOutcomeBadge(event.outcome)}`}>
              {getOutcomeIcon(event.outcome)}
              {event.outcome}
            </span>
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
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* What Happened - Narrative */}
              {event.businessOperation && (
                <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-xl p-5 border border-primary-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-primary-600 uppercase tracking-wider font-medium">What Happened</span>
                  </div>
                  <p className="text-base font-semibold text-primary-900">{event.businessOperation}</p>
                </div>
              )}

              {/* Event Details */}
              <Section title="Event Details" icon={<FileText size={16} />}>
                {event.businessOperation && <DetailRow label="Narrative" value={event.businessOperation} />}
                <DetailRow label="Action" value={event.action} />
                <DetailRow label="Event Type" value={event.eventType} />
                <DetailRow label="Category" value={event.eventCategory} />
                {event.operationType && <DetailRow label="Operation" value={event.operationType} />}
                <DetailRow label="Date / Time" value={formatDateTime(event.occurredAt)} />
                <DetailRow label="Result" value={
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getOutcomeBadge(event.outcome)}`}>
                    {getOutcomeIcon(event.outcome)} {event.outcome}
                  </span>
                } />
                <DetailRow label="Severity" value={
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(event.severity)}`}>
                    {event.severity}
                  </span>
                } />
                {event.legalHold && (
                  <DetailRow label="Legal Hold" value={<span className="text-red-600 font-medium">Yes</span>} />
                )}
              </Section>

              {/* Who */}
              <Section title="Who" icon={<User size={16} />}>
                <DetailRow label="Actor Type" value={
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getActorTypeBadge(event.actorType)}`}>
                    {getActorTypeIcon(event.actorType)} {formatLabel(event.actorType)}
                  </span>
                } />
                {event.actorEmail && (
                  <DetailRow
                    label="Email"
                    value={
                      <button onClick={() => onFilterByActor(event.actorId || event.actorEmail || '')} className="text-primary-600 hover:underline text-left">
                        {event.actorEmail}
                      </button>
                    }
                  />
                )}
                {event.actorId && (
                  <DetailRow label="Actor ID" value={
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">{event.actorId}</span>
                      <button onClick={() => copyToClipboard(event.actorId!)} className="text-gray-400 hover:text-gray-600" title="Copy Actor ID">
                        <Copy size={12} />
                      </button>
                    </span>
                  } />
                )}
                {event.actorUsername && <DetailRow label="Username" value={event.actorUsername} />}
                {event.impersonatorId && <DetailRow label="Impersonator ID" value={event.impersonatorId} />}
              </Section>

              {/* What */}
              <Section title="What" icon={<Box size={16} />}>
                {event.resourceType && (
                  <DetailRow label="Entity" value={
                    <button onClick={() => onFilterByEntity(event.resourceType!, event.resourceId || '')} className="text-primary-600 hover:underline">
                      {event.resourceType}
                    </button>
                  } />
                )}
                {event.resourceId && (
                  <DetailRow label="Entity ID" value={
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">{event.resourceId}</span>
                      <button onClick={() => copyToClipboard(event.resourceId!)} className="text-gray-400 hover:text-gray-600" title="Copy Entity ID">
                        <Copy size={12} />
                      </button>
                    </span>
                  } />
                )}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <DetailRow label="Metadata" value={
                    <pre className="text-xs bg-gray-100 rounded p-2 overflow-x-auto max-h-32 font-mono">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  } />
                )}
              </Section>

              {/* Changes */}
              {hasChanges && (
                <Section title={`Changes (${changeRows.length})`} icon={<ArrowUpDown size={16} />}>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setRawJson(false)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${!rawJson ? 'bg-primary-100 text-primary-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Human-readable
                    </button>
                    <button
                      onClick={() => setRawJson(true)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${rawJson ? 'bg-primary-100 text-primary-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Raw JSON
                    </button>
                  </div>
                  {rawJson ? (
                    <pre className="text-xs bg-gray-100 rounded p-3 overflow-x-auto max-h-64 font-mono">
                      {JSON.stringify({ before: event.beforeState, after: event.afterState, changedFields: event.changedFields }, null, 2)}
                    </pre>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 pr-3 font-medium text-gray-500">Field</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Before</th>
                            <th className="text-left py-2 pl-3 font-medium text-gray-500">After</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {changeRows.map((row, i) => (
                            <tr key={i} className={row.changed ? 'bg-primary-50/50' : ''}>
                              <td className="py-2 pr-3 font-medium text-gray-700">
                                {row.field}
                                {row.sensitive && <span className="ml-1 text-orange-500" title="Sensitive field">&#x1f512;</span>}
                              </td>
                              <td className="py-2 px-3 text-gray-500 font-mono">{row.before}</td>
                              <td className="py-2 pl-3 font-mono">
                                {row.changed ? (
                                  <span className="text-primary-700 font-medium">{row.after}</span>
                                ) : (
                                  <span className="text-gray-500">{row.after}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
              )}

              {/* Related Events */}
              {(event.transactionId || event.correlationId) && (
                <Section title="Related Events" icon={<Link2 size={16} />}>
                  {relatedLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 size={14} className="animate-spin" /> Loading related events...
                    </div>
                  ) : relatedEvents && relatedEvents.length > 0 ? (
                    <div className="space-y-1">
                      {event.transactionId && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500">Transaction:</span>
                          <button onClick={() => onFilterByTransaction(event.transactionId!)} className="text-xs font-mono text-primary-600 hover:underline">
                            {event.transactionId}
                          </button>
                          <button onClick={() => copyToClipboard(event.transactionId!)} className="text-gray-400 hover:text-gray-600" title="Copy Transaction ID">
                            <Copy size={11} />
                          </button>
                        </div>
                      )}
                      {relatedEvents.map((re) => (
                        <div key={re.auditEventId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-xs">
                          <span className="text-gray-400 w-16 shrink-0">{formatTime(re.occurredAt)}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${getActionColor(re.action)}`}>
                            {getActionIcon(re.action)} {re.action}
                          </span>
                          <span className="text-gray-600 truncate">{re.resourceType}{re.resourceId ? ` #${re.resourceId}` : ''}</span>
                          <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${getOutcomeBadge(re.outcome)}`}>
                            {getOutcomeIcon(re.outcome)} {re.outcome}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No other events in this transaction.</p>
                  )}
                </Section>
              )}

              {/* Entity History */}
              {event.resourceType && event.resourceId && (
                <Section title="Entity History" icon={<Clock3 size={16} />}>
                  {entityLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 size={14} className="animate-spin" /> Loading entity history...
                    </div>
                  ) : entityHistory && entityHistory.length > 0 ? (
                    <div className="relative pl-4">
                      <div className="absolute left-1 top-1 bottom-1 w-px bg-gray-200" />
                      {entityHistory.map((eh, i) => (
                        <div key={eh.auditEventId} className="relative flex items-start gap-3 pb-3 last:pb-0">
                          <div className="absolute left-[-3px] top-1.5 w-2 h-2 rounded-full bg-primary-400 border-2 border-white" />
                          <div className="ml-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-700">{formatLabel(eh.action)}</span>
                              <span className="text-xs text-gray-400">{timeAgo(eh.occurredAt)}</span>
                            </div>
                            {eh.actorEmail && <div className="text-xs text-gray-400 mt-0.5">{eh.actorEmail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No other history for this entity.</p>
                  )}
                </Section>
              )}

              {/* Quick Actions */}
              <Section title="Quick Actions" icon={<SlidersHorizontal size={16} />}>
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={<Copy size={13} />} label="Copy Event ID" onClick={() => copyToClipboard(event.auditEventId)} />
                  {event.resourceId && <ActionButton icon={<Copy size={13} />} label="Copy Entity ID" onClick={() => copyToClipboard(event.resourceId!)} />}
                  {event.transactionId && <ActionButton icon={<Copy size={13} />} label="Copy Transaction ID" onClick={() => copyToClipboard(event.transactionId!)} />}
                  {event.correlationId && <ActionButton icon={<Copy size={13} />} label="Copy Correlation ID" onClick={() => copyToClipboard(event.correlationId!)} />}
                  {event.actorId && <ActionButton icon={<User size={13} />} label="View User Activity" onClick={() => onFilterByActor(event.actorId!)} />}
                  {event.resourceType && event.resourceId && (
                    <ActionButton icon={<Clock3 size={13} />} label="View Entity History" onClick={() => onFilterByEntity(event.resourceType!, event.resourceId!)} />
                  )}
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'changes' && hasChanges && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRawJson(false)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${!rawJson ? 'bg-primary-100 text-primary-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Human-readable
                </button>
                <button
                  onClick={() => setRawJson(true)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${rawJson ? 'bg-primary-100 text-primary-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Raw JSON
                </button>
              </div>
              {rawJson ? (
                <pre className="text-xs bg-gray-100 rounded-lg p-4 overflow-x-auto font-mono">
                  {JSON.stringify({ before: event.beforeState, after: event.afterState, changedFields: event.changedFields }, null, 2)}
                </pre>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Field</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Before</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {changeRows.map((row, i) => (
                        <tr key={i} className={row.changed ? 'bg-primary-50/50' : 'bg-white'}>
                          <td className="px-4 py-2.5 font-medium text-gray-700">
                            {row.field}
                            {row.sensitive && <span className="ml-1 text-orange-500" title="Sensitive field">&#x1f512;</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{row.before}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {row.changed ? (
                              <span className="text-primary-700 font-semibold bg-primary-100 px-1.5 py-0.5 rounded">{row.after}</span>
                            ) : (
                              <span className="text-gray-500">{row.after}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="space-y-6">
              <Section title="Identifiers" icon={<Fingerprint size={16} />}>
                <DetailRow label="Event ID" value={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{event.auditEventId}</span>
                    <button onClick={() => copyToClipboard(event.auditEventId)} className="text-gray-400 hover:text-gray-600" title="Copy Event ID">
                      <Copy size={12} />
                    </button>
                  </span>
                } />
                {event.transactionId && <DetailRow label="Transaction ID" value={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{event.transactionId}</span>
                    <button onClick={() => copyToClipboard(event.transactionId!)} className="text-gray-400 hover:text-gray-600" title="Copy Transaction ID">
                      <Copy size={12} />
                    </button>
                  </span>
                } />}
                {event.correlationId && <DetailRow label="Correlation ID" value={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{event.correlationId}</span>
                    <button onClick={() => copyToClipboard(event.correlationId!)} className="text-gray-400 hover:text-gray-600" title="Copy Correlation ID">
                      <Copy size={12} />
                    </button>
                  </span>
                } />}
                {event.requestId && <DetailRow label="Request ID" value={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{event.requestId}</span>
                    <button onClick={() => copyToClipboard(event.requestId!)} className="text-gray-400 hover:text-gray-600" title="Copy Request ID">
                      <Copy size={12} />
                    </button>
                  </span>
                } />}
                {event.traceId && <DetailRow label="Trace ID" value={
                  <span className="font-mono text-xs">{event.traceId}</span>
                } />}
                {event.parentEventId && <DetailRow label="Parent Event ID" value={
                  <span className="font-mono text-xs">{event.parentEventId}</span>
                } />}
                {event.eventSequenceNumber != null && <DetailRow label="Sequence #" value={String(event.eventSequenceNumber)} />}
              </Section>

              <Section title="Network" icon={<Globe size={16} />}>
                {event.sourceIp && <DetailRow label="Source IP" value={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{event.sourceIp}</span>
                    <button onClick={() => copyToClipboard(event.sourceIp!)} className="text-gray-400 hover:text-gray-600" title="Copy IP">
                      <Copy size={12} />
                    </button>
                  </span>
                } />}
                {event.userAgent && <DetailRow label="User Agent" value={
                  <span className="text-xs break-all">{event.userAgent}</span>
                } />}
                {event.tenantId && <DetailRow label="Tenant ID" value={event.tenantId} />}
              </Section>

              <Section title="Raw Event" icon={<Database size={16} />}>
                <pre className="text-xs bg-gray-100 rounded-lg p-4 overflow-x-auto max-h-64 font-mono">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
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

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    >
      {icon} {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AuditTrail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Data state
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState<Filters>({
    search: searchParams.get('search') || '',
    actorType: searchParams.get('actorType') || '',
    action: searchParams.get('action') || '',
    eventCategory: searchParams.get('eventCategory') || '',
    resourceType: searchParams.get('resourceType') || '',
    resourceId: searchParams.get('resourceId') || '',
    outcome: searchParams.get('outcome') || '',
    severity: searchParams.get('severity') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    sortBy: 'occurredAt',
    sortDir: 'desc',
  });

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [verify, setVerify] = useState<{ valid: boolean; checked: number; error?: string } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { hasPermission } = useAuth();
  const [activeDatePreset, setActiveDatePreset] = useState<number | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [searchHighlightIdx, setSearchHighlightIdx] = useState(-1);
  const [searchInputValue, setSearchInputValue] = useState(filters.search);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Generate search suggestions from available actions and event types
  const allSearchSuggestions = useMemo(() => {
    const actions = Object.values(ACTION_GROUPS).flat();
    const eventTypes = ['navigation', 'profile_update', 'profile_update_failed', 'login', 'logout', 'register', 'forgot_password', 'reset_password', 'password_changed', 'token_refreshed', 'email_verified', 'phone_verified', 'mfa_otp_sent', 'mfa_verified', 'pet_create', 'pet_update', 'pet_delete', 'pet_mark_lost', 'pet_mark_found', 'tag_redeem', 'order_create', 'order_payment_confirmed', 'cart_item_create', 'cart_item_update', 'cart_item_delete', 'notification_clear_read', 'notification_mark_all_read', 'notification_preferences_update', 'vaccination_create', 'vaccination_update', 'vaccination_delete', 'allergy_create', 'allergy_update', 'allergy_delete', 'medication_create', 'medication_update', 'medication_delete', 'microchip_create', 'microchip_update', 'microchip_delete', 'surgery_create', 'surgery_update', 'surgery_delete', 'weight_create', 'weight_delete', 'health_condition_create', 'health_condition_update', 'health_condition_delete', 'vet_detail_update', 'desexing_update', 'mfa_setting_changed', 'finder_privacy_changed', 'onboarding_completed', 'onboarding_skipped', 'escalation_resolved', 'escalation_forwarded', 'referral_data_viewed', 'referral_data_access'];
    return [...new Set([...actions, ...eventTypes])].sort();
  }, []);

  // Debounced search filter
  const handleSearchChange = (value: string) => {
    setSearchInputValue(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateFilter('search', value);
    }, 300);
    // Generate suggestions
    if (value.trim().length > 0) {
      const matches = allSearchSuggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
      setSearchSuggestions(matches);
      setShowSearchSuggestions(matches.length > 0);
    } else {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
    }
    setSearchHighlightIdx(-1);
  };

  const handleSearchSelect = (suggestion: string) => {
    setSearchInputValue(suggestion);
    updateFilter('search', suggestion);
    setShowSearchSuggestions(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSearchHighlightIdx((i) => Math.min(i + 1, searchSuggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchHighlightIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && searchHighlightIdx >= 0) { e.preventDefault(); handleSearchSelect(searchSuggestions[searchHighlightIdx]); }
    else if (e.key === 'Tab' && searchHighlightIdx >= 0) { e.preventDefault(); handleSearchSelect(searchSuggestions[searchHighlightIdx]); }
    else if (e.key === 'Escape') { setShowSearchSuggestions(false); }
  };

  // Close search suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) setShowSearchSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.actorType) params.actorType = filters.actorType;
    if (filters.action) params.action = filters.action;
    if (filters.eventCategory) params.eventCategory = filters.eventCategory;
    if (filters.resourceType) params.resourceType = filters.resourceType;
    if (filters.resourceId) params.resourceId = filters.resourceId;
    if (filters.outcome) params.outcome = filters.outcome;
    if (filters.severity) params.severity = filters.severity;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    setSearchParams(params, { replace: true });
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/admin/audit/summary');
      setSummary(res.data.data);
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, limit: pageSize };
      if (filters.search) params.search = filters.search;
      if (filters.actorType) params.actorType = filters.actorType;
      if (filters.action) params.action = filters.action;
      if (filters.eventCategory) params.eventCategory = filters.eventCategory;
      if (filters.resourceType) params.resourceType = filters.resourceType;
      if (filters.resourceId) params.resourceId = filters.resourceId;
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.severity) params.severity = filters.severity;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      params.sortBy = filters.sortBy;
      params.sortDir = filters.sortDir;

      const res = await api.get('/admin/audit', { params });
      setEvents(res.data.data.items || []);
      setTotal(res.data.data.total || 0);
      setTotalPages(res.data.data.totalPages || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Verify chain
  const runVerify = async () => {
    setVerifyLoading(true);
    setVerify(null);
    try {
      const res = await api.get('/admin/audit/verify-chain');
      setVerify(res.data.data);
      if (res.data.data.valid) {
        toast.success(`Chain intact — ${res.data.data.checked} event(s) verified`);
      } else {
        toast.error(`Chain invalid at ${res.data.data.error || 'unknown event'}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Verification failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Export
  const handleExport = async (format: 'csv' | 'json') => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const params: Record<string, unknown> = { format };
      if (filters.search) params.search = filters.search;
      if (filters.actorType) params.actorType = filters.actorType;
      if (filters.action) params.action = filters.action;
      if (filters.eventCategory) params.eventCategory = filters.eventCategory;
      if (filters.resourceType) params.resourceType = filters.resourceType;
      if (filters.resourceId) params.resourceId = filters.resourceId;
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.severity) params.severity = filters.severity;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await api.get('/admin/audit/export', { params, responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-events-${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'json'}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  // Filter helpers
  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '', actorType: '', action: '', eventCategory: '',
      resourceType: '', resourceId: '', outcome: '', severity: '',
      startDate: '', endDate: '', sortBy: 'occurredAt', sortDir: 'desc',
    });
    setActiveDatePreset(null);
    setPage(1);
  };

  const applyDatePreset = (index: number) => {
    const preset = DATE_PRESETS[index];
    const range = preset.getRange();
    setActiveDatePreset(index);
    setFilters((f) => ({ ...f, startDate: range.start, endDate: range.end }));
    setPage(1);
  };

  const removeFilter = (key: keyof Filters) => {
    if (key === 'startDate' || key === 'endDate') {
      setActiveDatePreset(null);
      setFilters((f) => ({ ...f, startDate: '', endDate: '' }));
    } else {
      setFilters((f) => ({ ...f, [key]: '' }));
    }
    setPage(1);
  };

  // Active filter chips
  const activeFilters: Array<{ key: keyof Filters; label: string }> = [];
  if (filters.search) activeFilters.push({ key: 'search', label: `Search: "${filters.search}"` });
  if (filters.actorType) activeFilters.push({ key: 'actorType', label: `Actor: ${formatLabel(filters.actorType)}` });
  if (filters.action) activeFilters.push({ key: 'action', label: `Action: ${filters.action}` });
  if (filters.eventCategory) activeFilters.push({ key: 'eventCategory', label: `Category: ${filters.eventCategory}` });
  if (filters.resourceType) activeFilters.push({ key: 'resourceType', label: `Entity: ${filters.resourceType}` });
  if (filters.resourceId) activeFilters.push({ key: 'resourceId', label: `ID: ${filters.resourceId}` });
  if (filters.outcome) activeFilters.push({ key: 'outcome', label: `Result: ${filters.outcome}` });
  if (filters.severity) activeFilters.push({ key: 'severity', label: `Severity: ${filters.severity}` });
  if (filters.startDate && !filters.endDate) activeFilters.push({ key: 'startDate', label: `From: ${formatDateShort(filters.startDate)}` });
  if (!filters.startDate && filters.endDate) activeFilters.push({ key: 'endDate', label: `To: ${formatDateShort(filters.endDate)}` });
  if (filters.startDate && filters.endDate) activeFilters.push({ key: 'startDate', label: `${formatDateShort(filters.startDate)} — ${formatDateShort(filters.endDate)}` });

  const toggleSort = () => {
    setFilters((f) => ({
      ...f,
      sortDir: f.sortDir === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Summary click handlers
  const handleSummaryClick = (type: string) => {
    switch (type) {
      case 'failed': updateFilter('outcome', 'FAILURE'); break;
      case 'highRisk': updateFilter('severity', 'HIGH,CRITICAL'); break;
      case 'today': {
        const range = DATE_PRESETS[0].getRange();
        setActiveDatePreset(0);
        setFilters((f) => ({ ...f, startDate: range.start, endDate: range.end }));
        setPage(1);
        break;
      }
    }
  };

  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
              <p className="mt-1 text-sm text-gray-500">Track and investigate activity across your application.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runVerify}
                disabled={verifyLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {verifyLoading ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                Verify Integrity
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
                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                      <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Export CSV
                      </button>
                      <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Export JSON
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings and Refresh buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/audit/settings')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            disabled={!hasPermission('audit.admin')}
            title="Audit Settings"
          >
            <Settings size={15} /> Settings
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Refresh"
          >
            <RotateCcw size={15} /> Refresh
          </button>
        </div>

        {/* Verify Banner */}
        {verify && (
          <div className={`mb-6 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            verify.valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {verify.valid ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
            {verify.valid
              ? `Chain intact — ${verify.checked.toLocaleString()} event(s) verified.`
              : `Chain invalid at ${verify.error || 'unknown event'} — ${verify.checked.toLocaleString()} event(s) checked.`
            }
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <SummaryCard
            label="Total Events"
            value={summary?.total}
            loading={summaryLoading}
            icon={<Database size={18} className="text-gray-400" />}
            onClick={undefined}
          />
          <SummaryCard
            label="Today"
            value={summary?.today}
            loading={summaryLoading}
            icon={<Calendar size={18} className="text-primary-500" />}
            onClick={() => handleSummaryClick('today')}
            clickable
          />
          <SummaryCard
            label="Failed"
            value={summary?.failed}
            loading={summaryLoading}
            icon={<XCircle size={18} className="text-red-500" />}
            onClick={() => handleSummaryClick('failed')}
            clickable
          />
          <SummaryCard
            label="High-Risk"
            value={summary?.highRisk}
            loading={summaryLoading}
            icon={<AlertTriangle size={18} className="text-orange-500" />}
            onClick={() => handleSummaryClick('highRisk')}
            clickable
          />
          <SummaryCard
            label="Unique Actors"
            value={summary?.uniqueActors}
            loading={summaryLoading}
            icon={<Users size={18} className="text-blue-500" />}
            onClick={undefined}
          />
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div ref={searchWrapperRef} className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchInputValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchInputValue.trim().length > 0 && searchSuggestions.length > 0) setShowSearchSuggestions(true); }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by user, action, entity, ID, transaction, IP, or event type..."
              className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors placeholder:text-gray-400"
            />
            {searchInputValue && (
              <button
                onClick={() => { setSearchInputValue(''); updateFilter('search', ''); setSearchSuggestions([]); setShowSearchSuggestions(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X size={14} className="text-gray-400" />
              </button>
            )}
            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {searchSuggestions.map((suggestion, i) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSearchSelect(suggestion)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${i === searchHighlightIdx ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Search size={12} className="text-gray-400 shrink-0" />
                    <span dangerouslySetInnerHTML={{ __html: suggestion.replace(new RegExp(`(${searchInputValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark class="bg-yellow-200">$1</mark>') }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                showFilters || activeFilters.length > 0
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter size={15} />
              Filters
              {activeFilters.length > 0 && (
                <span className="bg-primary-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {activeFilters.length}
                </span>
              )}
            </button>

            {/* Date Presets */}
            {DATE_PRESETS.map((preset, i) => (
              <button
                key={preset.label}
                onClick={() => applyDatePreset(i)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  activeDatePreset === i
                    ? 'bg-primary-50 text-primary-700 border-primary-200 font-medium'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            ))}

            {/* Sort Toggle */}
            <button
              onClick={toggleSort}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown size={14} />
              {filters.sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
            </button>

            {/* Refresh */}
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
              title="Refresh audit logs"
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            {activeFilters.length > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilters.map((f) => (
                <FilterChip
                  key={`${f.key}-${f.label}`}
                  label={f.label}
                  onRemove={() => removeFilter(f.key)}
                />
              ))}
            </div>
          )}

          {/* Expanded Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <FilterSelect
                  label="Actor Type"
                  value={filters.actorType}
                  onChange={(v) => updateFilter('actorType', v)}
                  options={ACTOR_TYPES.map((t) => ({ value: t, label: formatLabel(t) }))}
                  placeholder="All Actors"
                />
                <FilterAutocomplete
                  label="Action"
                  value={filters.action}
                  onChange={(v) => updateFilter('action', v)}
                  options={Object.keys(ACTION_GROUPS).map((g) => ({ value: g, label: g }))}
                  placeholder="Type to search actions..."
                />
                <FilterSelect
                  label="Category"
                  value={filters.eventCategory}
                  onChange={(v) => updateFilter('eventCategory', v)}
                  options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  placeholder="All Categories"
                />
                <FilterSelect
                  label="Result"
                  value={filters.outcome}
                  onChange={(v) => updateFilter('outcome', v)}
                  options={OUTCOMES.map((o) => ({ value: o, label: formatLabel(o) }))}
                  placeholder="All Results"
                />
                <FilterSelect
                  label="Severity"
                  value={filters.severity}
                  onChange={(v) => updateFilter('severity', v)}
                  options={[...SEVERITIES.map((s) => ({ value: s, label: s })), { value: 'HIGH,CRITICAL', label: 'High & Critical' }]}
                  placeholder="All Severity"
                />
                <FilterInput
                  label="Resource Type"
                  value={filters.resourceType}
                  onChange={(v) => updateFilter('resourceType', v)}
                  placeholder="e.g. Pet"
                />
                <FilterInput
                  label="Resource ID"
                  value={filters.resourceId}
                  onChange={(v) => updateFilter('resourceId', v)}
                  placeholder="e.g. 10482"
                />
                <FilterInput
                  label="From Date"
                  value={filters.startDate ? filters.startDate.slice(0, 10) : ''}
                  onChange={(v) => { updateFilter('startDate', v ? new Date(v).toISOString() : ''); setActiveDatePreset(null); }}
                  type="date"
                  placeholder=""
                />
                <FilterInput
                  label="To Date"
                  value={filters.endDate ? filters.endDate.slice(0, 10) : ''}
                  onChange={(v) => { updateFilter('endDate', v ? new Date(v + 'T23:59:59').toISOString() : ''); setActiveDatePreset(null); }}
                  type="date"
                  placeholder=""
                />
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="flex-1">{error}</span>
            <button onClick={fetchEvents} className="underline hover:no-underline">Try Again</button>
          </div>
        )}

        {/* Events Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Actor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden lg:table-cell">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden xl:table-cell">Before</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden xl:table-cell">After</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Result</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden xl:table-cell">Severity</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <Search size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">No audit events found</p>
                          <p className="text-xs text-gray-400 mt-1">No events match your current search and filters.</p>
                        </div>
                        {activeFilters.length > 0 && (
                          <button onClick={clearFilters} className="text-sm text-primary-600 hover:underline">
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => {
                  const actualChanges = getActualChanges(ev.beforeState, ev.afterState, ev.changedFields);
                  const maxVisibleChanges = 2;
                  const visibleChanges = actualChanges.slice(0, maxVisibleChanges);
                  const extraCount = actualChanges.length - maxVisibleChanges;

                  return (
                    <tr
                      key={ev.auditEventId}
                      onClick={() => setSelectedEvent(ev)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {/* Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-900 font-medium">{formatDateShort(ev.occurredAt)}</div>
                        <div className="text-xs text-gray-400">{formatTime(ev.occurredAt)}</div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                            <User size={13} className="text-primary-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                              {ev.actorUsername && ev.actorUsername !== ev.actorEmail
                                ? ev.actorUsername
                                : ev.actorEmail?.split('@')[0] || 'Unknown'}
                            </div>
                            {ev.actorEmail && (
                              <div className="text-xs text-gray-400 truncate max-w-[160px]" title={ev.actorEmail}>{ev.actorEmail}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`shrink-0 ${getActionColor(ev.action)}`}>
                            {getActionIcon(ev.action)}
                          </span>
                          <span className="text-sm text-gray-900">
                            {ev.businessOperation || getActionDisplayName(ev.action)}
                          </span>
                        </div>
                        {ev.eventType && !ev.businessOperation && (
                          <div className="text-[10px] text-gray-400 mt-0.5 font-mono truncate max-w-[180px]">{ev.eventType}</div>
                        )}
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-sm font-medium text-gray-900">{getEntityDisplayName(ev.resourceType)}</div>
                        {ev.resourceId && (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[140px]" title={ev.resourceId}>#{ev.resourceId}</div>
                        )}
                        {actualChanges.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {visibleChanges.map((c) => (
                              <div key={c.field} className="text-[10px] text-gray-500 truncate max-w-[140px]">{c.label}</div>
                            ))}
                            {extraCount > 0 && (
                              <div className="text-[10px] text-primary-500 font-medium">+{extraCount} more</div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Before */}
                      <td className="px-4 py-3 hidden xl:table-cell min-w-[200px]">
                        {actualChanges.length > 0 ? (
                          <div className="space-y-1.5">
                            {visibleChanges.map((c) => (
                              <div key={c.field}>
                                <div className="text-[10px] text-gray-400 leading-none">{c.label}</div>
                                <div className={`text-xs leading-tight mt-0.5 ${c.type === 'removed' ? 'text-red-600 line-through' : 'text-gray-600'}`}>
                                  {c.before === '—' ? '—' : c.before.length > 50 ? c.before.slice(0, 50) + '…' : c.before}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* After */}
                      <td className="px-4 py-3 hidden xl:table-cell min-w-[200px]">
                        {actualChanges.length > 0 ? (
                          <div className="space-y-1.5">
                            {visibleChanges.map((c) => (
                              <div key={c.field}>
                                <div className="text-[10px] text-gray-400 leading-none">{c.label}</div>
                                <div className={`text-xs leading-tight mt-0.5 ${c.type === 'added' ? 'text-emerald-600 font-medium' : c.type === 'removed' ? 'text-gray-400' : 'text-emerald-700'}`}>
                                  {c.after === '—' ? '—' : c.after.length > 50 ? c.after.slice(0, 50) + '…' : c.after}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Result */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`${getOutcomeBadge(ev.outcome)}`} title={ev.outcome}>
                          {getOutcomeIcon(ev.outcome)}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className={`${getSeverityBadge(ev.severity)}`} title={ev.severity}>
                          {ev.severity === 'CRITICAL' && <OctagonAlert size={14} />}
                          {ev.severity === 'HIGH' && <AlertTriangle size={14} />}
                          {ev.severity === 'MEDIUM' && <AlertTriangle size={14} />}
                          {ev.severity === 'INFO' && <Info size={14} />}
                          {ev.severity === 'LOW' && <Circle size={14} />}
                        </span>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium text-gray-700">{startIdx.toLocaleString()}</span>
              {' '}—{' '}
              <span className="font-medium text-gray-700">{endIdx.toLocaleString()}</span>
              {' '}of{' '}
              <span className="font-medium text-gray-700">{total.toLocaleString()}</span> events
            </div>
            <div className="flex items-center gap-4">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s} per page</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onFilterByActor={(actorId) => {
          setSelectedEvent(null);
          updateFilter('actorType', '');
          setFilters((f) => ({ ...f, search: actorId, actorType: '' }));
        }}
        onFilterByEntity={(type, id) => {
          setSelectedEvent(null);
          setFilters((f) => ({ ...f, resourceType: type, resourceId: id }));
        }}
        onFilterByTransaction={(txId) => {
          setSelectedEvent(null);
          setFilters((f) => ({ ...f, search: txId }));
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label, value, loading, icon, onClick, clickable,
}: {
  label: string;
  value?: number;
  loading: boolean;
  icon: React.ReactNode;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm ${
        clickable ? 'cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {loading ? (
          <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          (value ?? 0).toLocaleString()
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function FilterAutocomplete({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = inputValue.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(inputValue.toLowerCase()) || o.value.toLowerCase().includes(inputValue.toLowerCase()))
    : options;

  const handleSelect = (val: string) => {
    onChange(val);
    setInputValue(val);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightIdx >= 0) { e.preventDefault(); handleSelect(filtered[highlightIdx].value); }
    else if (e.key === 'Escape') { setShowSuggestions(false); }
    else if (e.key === 'Tab' && highlightIdx >= 0) { e.preventDefault(); handleSelect(filtered[highlightIdx].value); }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); setHighlightIdx(-1); if (!e.target.value) onChange(''); }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((o, i) => (
            <button
              key={o.value}
              onClick={() => handleSelect(o.value)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === highlightIdx ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterInput({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );
}
