import { useState, useEffect } from 'react';
import {
  Plus, Trash2, GripVertical, Save, Eye, EyeOff, ChevronDown, ChevronUp,
  Heart, AlertTriangle, Zap, Phone, MapPin, PhoneCall, CheckCircle,
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
  content?: Record<string, unknown>;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Heart, AlertTriangle, Zap, Phone, MapPin, PhoneCall, CheckCircle,
};

const AVAILABLE_ICONS = ['Heart', 'AlertTriangle', 'Zap', 'Phone', 'MapPin', 'PhoneCall', 'CheckCircle', 'Shield', 'Info', 'Star', 'Gift', 'Bell'];

const FORM_FIELD_OPTIONS = [
  { value: 'phoneNumber', label: 'Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'address.line1', label: 'Street Address' },
  { value: 'address.line2', label: 'Suburb' },
  { value: 'address.city', label: 'City' },
  { value: 'address.state', label: 'State / Region' },
  { value: 'address.zip', label: 'Postal Code' },
  { value: 'emergencyContact.name', label: 'Contact Name' },
  { value: 'emergencyContact.relationship', label: 'Relationship' },
  { value: 'emergencyContact.phone', label: 'Contact Phone' },
  { value: 'emergencyContact.email', label: 'Contact Email' },
];

export default function CmsOnboardingSteps() {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await api.get('/admin/cms/onboarding');
      setSteps(res.data.data?.steps || []);
    } catch {
      toast.error('Failed to load onboarding config');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/admin/cms/onboarding', { steps });
      toast.success('Onboarding steps saved');
    } catch {
      toast.error('Failed to save onboarding config');
    } finally {
      setSaving(false);
    }
  }

  function addStep() {
    const newStep: OnboardingStep = {
      stepId: `step-${Date.now()}`,
      title: 'New Step',
      subtitle: '',
      icon: 'Heart',
      order: steps.length,
      isActive: true,
      type: 'info',
    };
    setSteps([...steps, newStep]);
    setExpandedStep(newStep.stepId);
  }

  function removeStep(stepId: string) {
    if (!confirm('Remove this step?')) return;
    setSteps(steps.filter((s) => s.stepId !== stepId));
  }

  function updateStep(stepId: string, updates: Partial<OnboardingStep>) {
    setSteps(steps.map((s) => (s.stepId === stepId ? { ...s, ...updates } : s)));
  }

  function moveStep(stepId: string, direction: 'up' | 'down') {
    const idx = steps.findIndex((s) => s.stepId === stepId);
    if (idx === -1) return;
    const newSteps = [...steps];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newSteps.length) return;
    [newSteps[idx].order, newSteps[swapIdx].order] = [newSteps[swapIdx].order, newSteps[idx].order];
    [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
    setSteps(newSteps);
  }

  function toggleFormField(stepId: string, field: string) {
    const step = steps.find((s) => s.stepId === stepId);
    if (!step) return;
    const fields = step.formFields || [];
    const updated = fields.includes(field) ? fields.filter((f) => f !== field) : [...fields, field];
    updateStep(stepId, { formFields: updated });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure the onboarding wizard shown to new customers after registration.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addStep} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Plus size={16} /> Add Step
          </button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const IconComp = ICON_MAP[step.icon] || Heart;
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
                  <IconComp size={16} />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Step ID</label>
                      <input value={step.stepId} onChange={(e) => updateStep(step.stepId, { stepId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
                      <select value={step.icon} onChange={(e) => updateStep(step.stepId, { icon: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        {AVAILABLE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
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

                  {step.type === 'form' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Form Fields</label>
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
