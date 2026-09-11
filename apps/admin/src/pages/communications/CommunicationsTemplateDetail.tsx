import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Send, Eye, Edit, Clock, CheckCircle, AlertTriangle,
  Mail, Copy, ChevronDown, ChevronRight, History, Info,
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
  createdBy?: { fullName: string; email: string };
  updatedBy?: { fullName: string; email: string };
}

interface Version {
  _id: string;
  version: number;
  subject: string;
  title: string;
  body: string;
  changedBy?: { fullName: string };
  changedAt: string;
  changeDescription?: string;
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

export default function CommunicationsTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState<Partial<Template>>({});

  const fetchTemplate = async () => {
    if (!id) return;
    try {
      const res = await api.get(`${API.admin.cms.communications.templates.get(id)}`);
      setTemplate(res.data.data);
      setForm(res.data.data);
    } catch (err) {
      console.error('Failed to fetch template', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    if (!id) return;
    try {
      const res = await api.get(API.admin.cms.communications.templates.versions(id));
      setVersions(res.data.data);
    } catch (err) {
      console.error('Failed to fetch versions', err);
    }
  };

  useEffect(() => { fetchTemplate(); }, [id]);
  useEffect(() => { if (showVersions) fetchVersions(); }, [showVersions, id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(API.admin.cms.communications.templates.update(id), {
        ...form,
        changeDescription: 'Updated via Communications Centre',
      });
      setEditing(false);
      fetchTemplate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!id || !testEmail) return;
    try {
      await api.post(API.admin.cms.communications.templates.sendTest(id), { recipientEmail: testEmail });
      alert(`Test email sent to ${testEmail}`);
      setTestEmail('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send test email');
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    try {
      await api.put(API.admin.cms.communications.templates.update(id), {
        status,
        changeDescription: `Status changed to ${status}`,
      });
      fetchTemplate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <Mail size={48} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Template not found</p>
        <button onClick={() => navigate('/communications/templates')} className="mt-4 text-primary-600 hover:underline">
          Back to Templates
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/communications/templates')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
            <p className="text-sm text-gray-500">{BUSINESS_FLOWS[template.businessFlow] || template.businessFlow}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[template.status]}`}>
            {template.status === 'active' && <CheckCircle size={12} />}
            {template.status === 'draft' && <Clock size={12} />}
            {template.status === 'inactive' && <AlertTriangle size={12} />}
            {template.status}
          </span>
          {template.isCritical && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">
              CRITICAL — Cannot be disabled
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">v{template.version}</span>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-2"
            >
              <Edit size={14} /> Edit
            </button>
          ) : (
            <>
              <button
                onClick={() => { setEditing(false); setForm(template); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Purpose */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Info size={16} /> Business Purpose
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Purpose</label>
                {editing ? (
                  <textarea
                    value={form.purpose || ''}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-gray-700">{template.purpose || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Trigger</label>
                {editing ? (
                  <input
                    value={form.triggerDescription || ''}
                    onChange={(e) => setForm({ ...form, triggerDescription: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-700">{template.triggerDescription || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Recipient</label>
                {editing ? (
                  <input
                    value={form.recipientDescription || ''}
                    onChange={(e) => setForm({ ...form, recipientDescription: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-700">{template.recipientDescription || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email Type</label>
                {editing ? (
                  <select
                    value={form.emailType || 'transactional'}
                    onChange={(e) => setForm({ ...form, emailType: e.target.value as any })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="transactional">Transactional</option>
                    <option value="system">System</option>
                    <option value="marketing">Marketing</option>
                  </select>
                ) : (
                  <p className="text-sm text-gray-700 capitalize">{template.emailType}</p>
                )}
              </div>
            </div>
          </div>

          {/* Email Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Mail size={16} /> Email Content
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subject Line</label>
                {editing ? (
                  <input
                    value={form.subject || ''}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-700 font-mono">{template.subject}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Preview Text</label>
                {editing ? (
                  <input
                    value={form.preheader || ''}
                    onChange={(e) => setForm({ ...form, preheader: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    maxLength={200}
                  />
                ) : (
                  <p className="text-sm text-gray-500 italic">{template.preheader || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title</label>
                {editing ? (
                  <input
                    value={form.title || ''}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-700">{template.title}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subtitle</label>
                {editing ? (
                  <input
                    value={form.subtitle || ''}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-500">{template.subtitle || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Body Content</label>
                {editing ? (
                  <textarea
                    value={form.body || ''}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                    rows={8}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {template.body}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CTA Button Text</label>
                  {editing ? (
                    <input
                      value={form.ctaText || ''}
                      onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-gray-700">{template.ctaText || '—'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CTA Button URL</label>
                  {editing ? (
                    <input
                      value={form.ctaUrl || ''}
                      onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-gray-500 font-mono truncate">{template.ctaUrl || '—'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Variables */}
          {template.variableDefinitions && template.variableDefinitions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Copy size={16} /> Available Variables
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Variable</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Description</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Example</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {template.variableDefinitions.map((v) => (
                      <tr key={v.key}>
                        <td className="px-3 py-2 font-mono text-xs text-primary-700 bg-primary-50 rounded">{'{'}{'}'}{v.key}{'{'}{'}'}</td>
                        <td className="px-3 py-2 text-gray-600">{v.description || v.label}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">{v.example || '—'}</td>
                        <td className="px-3 py-2">
                          {v.required ? (
                            <span className="text-xs font-medium text-red-600">Required</span>
                          ) : (
                            <span className="text-xs text-gray-400">Optional</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Status & Actions</h2>
            <div className="space-y-3">
              {!template.isCritical && (
                <div className="flex gap-2">
                  {template.status !== 'active' && (
                    <button
                      onClick={() => handleStatusChange('active')}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      Activate
                    </button>
                  )}
                  {template.status !== 'inactive' && (
                    <button
                      onClick={() => handleStatusChange('inactive')}
                      className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
                    >
                      Disable
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                <span className="flex items-center gap-2"><History size={14} /> Version History</span>
                {showVersions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>

          {/* Version History */}
          {showVersions && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Version History</h2>
              <div className="space-y-3">
                {versions.length === 0 ? (
                  <p className="text-sm text-gray-500">No version history yet</p>
                ) : (
                  versions.map((v) => (
                    <div key={v._id} className="border-b border-gray-100 pb-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">v{v.version}</span>
                        <span className="text-xs text-gray-500">{formatDate(v.changedAt)}</span>
                      </div>
                      {v.changedBy && (
                        <p className="text-xs text-gray-500">by {v.changedBy.fullName}</p>
                      )}
                      {v.changeDescription && (
                        <p className="text-xs text-gray-400 mt-0.5">{v.changeDescription}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Send Test */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Send size={16} /> Send Test Email
            </h2>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={handleSendTest}
                disabled={!testEmail}
                className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send size={14} /> Send Test
              </button>
              <p className="text-xs text-gray-400">Test emails are marked and don't trigger business actions.</p>
            </div>
          </div>

          {/* Template Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Template Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Slug</dt>
                <dd className="text-gray-700 font-mono">{template.slug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Version</dt>
                <dd className="text-gray-700">v{template.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Sender</dt>
                <dd className="text-gray-700">{template.senderName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Sender Email</dt>
                <dd className="text-gray-700 font-mono text-xs">{template.senderEmail}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-700">{formatDate(template.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Last Updated</dt>
                <dd className="text-gray-700">{formatDate(template.updatedAt)}</dd>
              </div>
              {template.lastTestedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Last Tested</dt>
                  <dd className="text-gray-700">{formatDate(template.lastTestedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
