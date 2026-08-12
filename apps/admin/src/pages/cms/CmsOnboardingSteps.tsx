import { useState, useEffect } from 'react';
import {
  Plus, Trash2, GripVertical, Save, Eye, EyeOff, ChevronDown, ChevronUp,
  Heart, AlertTriangle, Zap, Phone, MapPin, PhoneCall, CheckCircle,
  Shield, Info, Star, Gift, Bell,
} from 'lucide-react';
import api from '../../lib/api';
import { toast } from '../../lib/toast';

interface OnboardingStep {
  stepId: string;
  title: string;
  subtitle: string;
  icon: string;
  order: number;
  isActive: boolean;
  type: 'info' | 'form';
  formFields?: string[];
  content?: {
    storyHeading?: string;
    storyText?: string;
    callout?: { icon: string; title: string; text: string; variant: 'warning' | 'info' | 'tip' };
    privacyNote?: { icon: string; title: string; text: string };
    whyItMatters?: string;
    stats?: Array<{ number: string; label: string }>;
    flowSteps?: Array<{ icon: string; label: string; description: string }>;
  };
}

const ICON_OPTIONS = ['Heart', 'AlertTriangle', 'Zap', 'Phone', 'MapPin', 'PhoneCall', 'CheckCircle', 'Shield', 'Info', 'Star', 'Gift', 'Bell'];
const FORM_FIELD_OPTIONS = [
  { value: 'phoneNumber', label: 'Phone Number' },
  { value: 'email', label: 'Email' },
  { value: 'address.line1', label: 'Street Address' },
  { value: 'address.line2', label: 'Suburb' },
  { value: 'address.city', label: 'City' },
  { value: 'address.state', label: 'State/Region' },
  { value: 'address.zip', label: 'Postal Code' },
  { value: 'emergencyContact.name', label: 'EC Name' },
  { value: 'emergencyContact.relationship', label: 'EC Relationship' },
  { value: 'emergencyContact.phone', label: 'EC Phone' },
  { value: 'emergencyContact.email', label: 'EC Email' },
];

const CALLOUT_VARIANTS = ['warning', 'info', 'tip'];

function defaultStep(order: number): OnboardingStep {
  return {
    stepId: `step-${Date.now()}`,
    title: 'New Step',
    subtitle: '',
    icon: 'Heart',
    order,
    isActive: true,
    type: 'info',
    content: {},
  };
}

export default function CmsOnboardingStepsPage() {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/cms/onboarding')
      .then((res) => setSteps(res.data.data?.steps || []))
      .catch(() => toast.error('Failed to load onboarding config'))
      .finally(() => setLoading(false));
  }, []);

  function updateStep(stepId: string, patch: Partial<OnboardingStep>) {
    setSteps((prev) => prev.map((s) => s.stepId === stepId ? { ...s, ...patch } : s));
  }

  function updateContent(stepId: string, patch: Record<string, unknown>) {
    setSteps((prev) => prev.map((s) => s.stepId === stepId ? { ...s, content: { ...s.content, ...patch } } : s));
  }

  function updateStat(stepId: string, idx: number, patch: Record<string, string>) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const stats = [...(s.content?.stats || [])];
      stats[idx] = { ...stats[idx], ...patch };
      return { ...s, content: { ...s.content, stats } };
    }));
  }

  function addStat(stepId: string) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const stats = [...(s.content?.stats || []), { number: '', label: '' }];
      return { ...s, content: { ...s.content, stats } };
    }));
  }

  function removeStat(stepId: string, idx: number) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const stats = (s.content?.stats || []).filter((_, i) => i !== idx);
      return { ...s, content: { ...s.content, stats } };
    }));
  }

  function updateFlowStep(stepId: string, idx: number, patch: Record<string, string>) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const flowSteps = [...(s.content?.flowSteps || [])];
      flowSteps[idx] = { ...flowSteps[idx], ...patch };
      return { ...s, content: { ...s.content, flowSteps } };
    }));
  }

  function addFlowStep(stepId: string) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const flowSteps = [...(s.content?.flowSteps || []), { icon: 'Heart', label: '', description: '' }];
      return { ...s, content: { ...s.content, flowSteps } };
    }));
  }

  function removeFlowStep(stepId: string, idx: number) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const flowSteps = (s.content?.flowSteps || []).filter((_, i) => i !== idx);
      return { ...s, content: { ...s.content, flowSteps } };
    }));
  }

  function updateCallout(stepId: string, patch: Record<string, unknown>) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const callout = s.content?.callout || { icon: 'Info', title: '', text: '', variant: 'info' as const };
      return { ...s, content: { ...s.content, callout: { ...callout, ...patch } } };
    }));
  }

  function updatePrivacyNote(stepId: string, patch: Record<string, unknown>) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const note = s.content?.privacyNote || { icon: 'Lock', title: '', text: '' };
      return { ...s, content: { ...s.content, privacyNote: { ...note, ...patch } } };
    }));
  }

  function toggleFormField(stepId: string, field: string) {
    setSteps((prev) => prev.map((s) => {
      if (s.stepId !== stepId) return s;
      const fields = s.formFields || [];
      return { ...s, formFields: fields.includes(field) ? fields.filter((f) => f !== field) : [...fields, field] };
    }));
  }

  function addStep() {
    setSteps((prev) => [...prev, defaultStep(prev.length)]);
  }

  function removeStep(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.stepId !== stepId));
  }

  function moveStep(stepId: string, dir: 'up' | 'down') {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.stepId === stepId);
      if (idx === -1) return prev;
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/admin/cms/onboarding', { steps });
      toast.success('Onboarding steps saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Configure the onboarding wizard shown to new customers after registration.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addStep} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Plus size={16} /> Add Step
          </button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isExpanded = expandedStep === step.stepId;
          return (
            <div key={step.stepId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
                onClick={() => setExpandedStep(isExpanded ? null : step.stepId)}
              >
                <GripVertical size={16} className="text-gray-300 shrink-0" />
                <span className="text-xs text-gray-400 font-mono w-6 text-center">{idx + 1}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${step.isActive ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                  <span className="text-sm">{step.icon === 'Heart' ? '❤️' : step.icon === 'AlertTriangle' ? '⚠️' : step.icon === 'Zap' ? '⚡' : step.icon === 'Phone' ? '📞' : step.icon === 'MapPin' ? '📍' : step.icon === 'PhoneCall' ? '📲' : step.icon === 'CheckCircle' ? '✅' : step.icon === 'Shield' ? '🛡️' : step.icon === 'Star' ? '⭐' : step.icon === 'Gift' ? '🎁' : step.icon === 'Bell' ? '🔔' : 'ℹ️'}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{step.title}</p>
                  <p className="text-xs text-gray-500 truncate">{step.subtitle || step.stepId} · {step.type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {step.isActive ? (
                    <Eye size={14} className="text-green-500" />
                  ) : (
                    <EyeOff size={14} className="text-gray-300" />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); moveStep(step.stepId, 'up'); }} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveStep(step.stepId, 'down'); }} disabled={idx === steps.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeStep(step.stepId); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-gray-100 space-y-4">
                  {/* Basic Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Step ID</label>
                      <input value={step.stepId} onChange={(e) => updateStep(step.stepId, { stepId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
                      <select value={step.icon} onChange={(e) => updateStep(step.stepId, { icon: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                    <input value={step.title} onChange={(e) => updateStep(step.stepId, { title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subtitle</label>
                    <input value={step.subtitle} onChange={(e) => updateStep(step.stepId, { subtitle: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <select value={step.type} onChange={(e) => updateStep(step.stepId, { type: e.target.value as 'info' | 'form' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="info">Info (display only)</option>
                        <option value="form">Form (collects data)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Active</label>
                      <button
                        onClick={() => updateStep(step.stepId, { isActive: !step.isActive })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors mt-1 ${step.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${step.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Content Fields */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Content</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Story Heading</label>
                        <input value={step.content?.storyHeading || ''} onChange={(e) => updateContent(step.stepId, { storyHeading: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Your journey to pet safety starts here" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Story Text</label>
                        <textarea value={step.content?.storyText || ''} onChange={(e) => updateContent(step.stepId, { storyText: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Main body text for this step..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Why It Matters</label>
                        <textarea value={step.content?.whyItMatters || ''} onChange={(e) => updateContent(step.stepId, { whyItMatters: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Explanation of why this step is important..." />
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Stats Cards</h4>
                      <button onClick={() => addStat(step.stepId)} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                        <Plus size={12} /> Add Stat
                      </button>
                    </div>
                    {(step.content?.stats || []).length === 0 ? (
                      <p className="text-xs text-gray-400">No stats configured. Click "Add Stat" to create stat cards.</p>
                    ) : (
                      <div className="space-y-2">
                        {(step.content?.stats || []).map((stat, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input value={stat.number} onChange={(e) => updateStat(step.stepId, idx, { number: e.target.value })} className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. 1 in 3" />
                            <input value={stat.label} onChange={(e) => updateStat(step.stepId, idx, { label: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. pets get lost in their lifetime" />
                            <button onClick={() => removeStat(step.stepId, idx)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Flow Steps */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Flow Steps (How It Works)</h4>
                      <button onClick={() => addFlowStep(step.stepId)} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                        <Plus size={12} /> Add Step
                      </button>
                    </div>
                    {(step.content?.flowSteps || []).length === 0 ? (
                      <p className="text-xs text-gray-400">No flow steps configured. Click "Add Step" to create a how-it-works flow.</p>
                    ) : (
                      <div className="space-y-3">
                        {(step.content?.flowSteps || []).map((fs, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500">Step {idx + 1}</span>
                              <button onClick={() => removeFlowStep(step.stepId, idx)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Icon</label>
                                <select value={fs.icon} onChange={(e) => updateFlowStep(step.stepId, idx, { icon: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                                  {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs text-gray-500 mb-1">Label</label>
                                <input value={fs.label} onChange={(e) => updateFlowStep(step.stepId, idx, { label: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" placeholder="e.g. Someone Finds Your Pet" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Description</label>
                              <input value={fs.description} onChange={(e) => updateFlowStep(step.stepId, idx, { description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" placeholder="e.g. A kind stranger finds your lost pet" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Callout */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Callout Box</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
                        <select value={step.content?.callout?.icon || 'Info'} onChange={(e) => updateCallout(step.stepId, { icon: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                          {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Variant</label>
                        <select value={step.content?.callout?.variant || 'info'} onChange={(e) => updateCallout(step.stepId, { variant: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                          {CALLOUT_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                        <input value={step.content?.callout?.title || ''} onChange={(e) => updateCallout(step.stepId, { title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Callout title" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Callout Text</label>
                      <textarea value={step.content?.callout?.text || ''} onChange={(e) => updateCallout(step.stepId, { text: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Callout body text..." />
                    </div>
                  </div>

                  {/* Privacy Note */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Privacy Note</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                        <input value={step.content?.privacyNote?.title || ''} onChange={(e) => updatePrivacyNote(step.stepId, { title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Your Privacy Is Protected" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
                        <select value={step.content?.privacyNote?.icon || 'Shield'} onChange={(e) => updatePrivacyNote(step.stepId, { icon: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                          {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Text</label>
                      <textarea value={step.content?.privacyNote?.text || ''} onChange={(e) => updatePrivacyNote(step.stepId, { text: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Privacy assurance text..." />
                    </div>
                  </div>

                  {/* Form Fields (only for form type) */}
                  {step.type === 'form' && (
                    <div className="border-t border-gray-100 pt-4">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Form Fields</h4>
                      <div className="flex flex-wrap gap-2">
                        {FORM_FIELD_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => toggleFormField(step.stepId, opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${(step.formFields || []).includes(opt.value) ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {steps.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No onboarding steps configured.</p>
          <button onClick={addStep} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
            <Plus size={16} /> Add First Step
          </button>
        </div>
      )}
    </div>
  );
}
