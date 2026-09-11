import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Clock, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, ExternalLink, Copy, Eye,
} from 'lucide-react';
import api from '../../lib/api';
import { API } from '@pawtag/shared/api';

interface AuditDetail {
  _id: string;
  templateId?: string;
  templateSlug: string;
  templateVersion?: number;
  businessFlow: string;
  recipientEmail: string;
  recipientName?: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
  plainTextContent?: string;
  variables: Array<{ key: string; value: string; source?: string }>;
  status: string;
  provider: string;
  providerMessageId?: string;
  providerResponse?: Record<string, any>;
  deliveryTimeline: Array<{ event: string; timestamp: string; details?: string }>;
  failureReason?: string;
  failureStage?: string;
  retryCount: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityDisplay?: string;
  isTest: boolean;
  ipAddress?: string;
  userAgent?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  failedAt?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  queued: { icon: <Clock size={16} />, color: 'bg-gray-100 text-gray-600', label: 'Queued' },
  processing: { icon: <Clock size={16} />, color: 'bg-blue-100 text-blue-600', label: 'Processing' },
  sent: { icon: <Mail size={16} />, color: 'bg-blue-100 text-blue-600', label: 'Sent' },
  delivered: { icon: <CheckCircle size={16} />, color: 'bg-green-100 text-green-600', label: 'Delivered' },
  opened: { icon: <CheckCircle size={16} />, color: 'bg-green-100 text-green-700', label: 'Opened' },
  clicked: { icon: <CheckCircle size={16} />, color: 'bg-green-100 text-green-700', label: 'Clicked' },
  bounced: { icon: <XCircle size={16} />, color: 'bg-red-100 text-red-600', label: 'Bounced' },
  failed: { icon: <AlertTriangle size={16} />, color: 'bg-red-100 text-red-600', label: 'Failed' },
  complained: { icon: <AlertTriangle size={16} />, color: 'bg-orange-100 text-orange-600', label: 'Complained' },
};

export default function CommunicationsAuditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTechnical, setShowTechnical] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [showVariables, setShowVariables] = useState(true);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!id) return;
      try {
        const res = await api.get(API.admin.cms.communications.audit.get(id));
        setRecord(res.data.data);
      } catch (err) {
        console.error('Failed to fetch audit record', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  const formatDate = (iso: string) => new Date(iso).toLocaleString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="text-center py-12">
        <Mail size={48} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Audit record not found</p>
        <button onClick={() => navigate('/communications/audit')} className="mt-4 text-primary-600 hover:underline">
          Back to Audit
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.queued;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/communications/audit')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Audit Detail</h1>
            <p className="text-sm text-gray-500">{formatDate(record.createdAt)}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.icon} {statusConfig.label}
          </span>
          {record.isTest && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-600">
              TEST EMAIL
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Mail size={16} /> Email Summary
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-500 w-24 shrink-0">Template</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{record.templateSlug}</p>
                  {record.templateVersion && (
                    <p className="text-xs text-gray-400">Version {record.templateVersion}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-500 w-24 shrink-0">Subject</span>
                <p className="text-sm text-gray-900">{record.subject}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-500 w-24 shrink-0">Recipient</span>
                <div>
                  <p className="text-sm text-gray-900">{record.recipientEmail}</p>
                  {record.recipientName && (
                    <p className="text-xs text-gray-400">{record.recipientName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-500 w-24 shrink-0">Sender</span>
                <div>
                  <p className="text-sm text-gray-900">{record.senderName}</p>
                  <p className="text-xs text-gray-400 font-mono">{record.senderEmail}</p>
                </div>
              </div>
              {record.previewText && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-gray-500 w-24 shrink-0">Preview</span>
                  <p className="text-sm text-gray-500 italic">{record.previewText}</p>
                </div>
              )}
              {record.relatedEntityType && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-gray-500 w-24 shrink-0">Related</span>
                  <p className="text-sm text-gray-900">
                    {record.relatedEntityType}: {record.relatedEntityDisplay || record.relatedEntityId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Email Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Eye size={16} /> Rendered Email
              </h2>
              <button
                onClick={() => setShowHtml(!showHtml)}
                className="text-xs text-primary-600 hover:underline"
              >
                {showHtml ? 'Hide HTML' : 'Show HTML'}
              </button>
            </div>
            {showHtml ? (
              <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{record.htmlContent}</pre>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={record.htmlContent}
                  className="w-full h-96"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>

          {/* Failure Info */}
          {record.failureReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle size={16} /> Failure Information
              </h2>
              <p className="text-sm text-red-600">{record.failureReason}</p>
              {record.failureStage && (
                <p className="text-xs text-red-500 mt-1">Stage: {record.failureStage}</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Delivery Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock size={16} /> Delivery Timeline
            </h2>
            <div className="space-y-3">
              {record.deliveryTimeline.length === 0 ? (
                <p className="text-sm text-gray-500">No timeline events</p>
              ) : (
                record.deliveryTimeline.map((event, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                      {idx < record.deliveryTimeline.length - 1 && (
                        <div className="w-0.5 h-6 bg-gray-200" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{event.event}</p>
                      <p className="text-xs text-gray-500">{formatDate(event.timestamp)}</p>
                      {event.details && (
                        <p className="text-xs text-gray-400 mt-0.5">{event.details}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Variables */}
          {record.variables && record.variables.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <button
                onClick={() => setShowVariables(!showVariables)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
              >
                <span className="flex items-center gap-2"><Copy size={16} /> Variables Snapshot</span>
                {showVariables ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {showVariables && (
                <div className="mt-4 space-y-2">
                  {record.variables.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">{v.key}</span>
                      <span className="text-gray-600 truncate max-w-[180px]">{v.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Technical Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
            >
              <span>Technical Details</span>
              {showTechnical ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {showTechnical && (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Provider</dt>
                  <dd className="text-gray-700">{record.provider}</dd>
                </div>
                {record.providerMessageId && (
                  <div className="flex justify-between items-center">
                    <dt className="text-gray-500">Message ID</dt>
                    <dd className="text-gray-700 font-mono text-xs flex items-center gap-1">
                      <span className="truncate max-w-[140px]">{record.providerMessageId}</span>
                      <button onClick={() => copyToClipboard(record.providerMessageId!)} className="text-gray-400 hover:text-gray-600">
                        <Copy size={10} />
                      </button>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Template</dt>
                  <dd className="text-gray-700 font-mono text-xs">{record.templateSlug}</dd>
                </div>
                {record.templateVersion && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Template Version</dt>
                    <dd className="text-gray-700">v{record.templateVersion}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Retry Count</dt>
                  <dd className="text-gray-700">{record.retryCount}</dd>
                </div>
                {record.sentAt && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Sent At</dt>
                    <dd className="text-gray-700">{formatDate(record.sentAt)}</dd>
                  </div>
                )}
                {record.deliveredAt && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Delivered At</dt>
                    <dd className="text-gray-700">{formatDate(record.deliveredAt)}</dd>
                  </div>
                )}
                {record.ipAddress && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">IP Address</dt>
                    <dd className="text-gray-700 font-mono text-xs">{record.ipAddress}</dd>
                  </div>
                )}
                {record.userAgent && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">User Agent</dt>
                    <dd className="text-gray-700 font-mono text-xs truncate max-w-[160px]">{record.userAgent}</dd>
                  </div>
                )}
                {record.providerResponse && (
                  <div className="mt-2">
                    <dt className="text-gray-500 mb-1">Provider Response</dt>
                    <dd className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-600 overflow-auto max-h-32">
                      {JSON.stringify(record.providerResponse, null, 2)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
