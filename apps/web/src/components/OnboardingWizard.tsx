import { useState, useEffect } from 'react';
import {
  Heart, AlertTriangle, Zap, Phone, MapPin, PhoneCall, CheckCircle,
  Shield, Info, Star, Gift, Bell, ArrowRight, ArrowLeft, Lock,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
    stats?: Array<{ number: string; label: string }>;
    storyText?: string;
    storyHeading?: string;
    flowSteps?: Array<{ icon: string; label: string; description: string }>;
    callout?: { icon: string; title: string; text: string; variant: 'warning' | 'info' | 'tip' };
    privacyNote?: { icon: string; title: string; text: string };
    whyItMatters?: string;
  };
}

const ICON_MAP: Record<string, React.ElementType> = {
  Heart, AlertTriangle, Zap, Phone, MapPin, PhoneCall, CheckCircle,
  Shield, Info, Star, Gift, Bell,
};

const CALLOUT_STYLES = {
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  tip: 'bg-green-50 border-green-200 text-green-800',
};

const RELATIONSHIP_OPTIONS = ['Spouse', 'Partner', 'Parent', 'Sibling', 'Friend', 'Neighbour', 'Other'];

export default function OnboardingWizard() {
  const { user, refreshUser } = useAuth();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [email, setEmail] = useState(user?.email || '');
  const [addressLine1, setAddressLine1] = useState(user?.address?.line1 || '');
  const [addressLine2, setAddressLine2] = useState(user?.address?.line2 || '');
  const [addressCity, setAddressCity] = useState(user?.address?.city || '');
  const [addressState, setAddressState] = useState(user?.address?.state || '');
  const [addressZip, setAddressZip] = useState(user?.address?.zip || '');
  const [ecName, setEcName] = useState(user?.emergencyContact?.name || '');
  const [ecRelationship, setEcRelationship] = useState(user?.emergencyContact?.relationship || '');
  const [ecPhone, setEcPhone] = useState(user?.emergencyContact?.phone || '');
  const [ecEmail, setEcEmail] = useState(user?.emergencyContact?.email || '');

  useEffect(() => {
    api.get('/public/cms/onboarding')
      .then((res) => setSteps(res.data.data?.steps || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const step = steps[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === steps.length - 1;
  const progress = steps.length > 0 ? ((currentIdx + 1) / steps.length) * 100 : 0;

  async function handleNext() {
    if (step?.type === 'form') {
      await saveStepData();
    }
    if (isLast) {
      await completeOnboarding();
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  }

  function handleBack() {
    if (!isFirst) setCurrentIdx(currentIdx - 1);
  }

  async function saveStepData() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (step.formFields?.some((f) => f.startsWith('address') || f === 'phoneNumber' || f === 'email')) {
        payload.phoneNumber = phoneNumber;
        payload.email = email;
        payload.address = {
          line1: addressLine1,
          line2: addressLine2,
          city: addressCity,
          state: addressState,
          zip: addressZip,
          country: user?.address?.country || 'NZ',
        };
      }
      if (step.formFields?.some((f) => f.startsWith('emergencyContact'))) {
        payload.emergencyContact = {
          name: ecName,
          relationship: ecRelationship,
          phone: ecPhone,
          email: ecEmail,
        };
      }
      if (Object.keys(payload).length > 0) {
        await api.put('/auth/profile', payload);
        await refreshUser();
      }
    } catch {
      // Silently handle — user can retry
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    setSaving(true);
    try {
      await api.put('/customer/settings/onboarding-complete');
      await refreshUser();
    } catch {
      // Silently handle
    } finally {
      setSaving(false);
    }
  }

  async function skipOnboarding() {
    setSaving(true);
    try {
      await api.put('/customer/settings/onboarding-skip');
      await refreshUser();
    } catch {
      // Silently handle
    } finally {
      setSaving(false);
    }
  }

  async function dismissOnboarding() {
    setSaving(true);
    try {
      await api.put('/customer/settings/onboarding-dismiss');
      await refreshUser();
    } catch {
      // Silently handle
    } finally {
      setSaving(false);
    }
  }

  function renderFormFields() {
    if (!step.formFields) return null;

    const hasContact = step.formFields.some((f) => f === 'phoneNumber' || f === 'email');
    const hasAddress = step.formFields.some((f) => f.startsWith('address'));
    const hasEC = step.formFields.some((f) => f.startsWith('emergencyContact'));

    return (
      <div className="space-y-4 mt-6">
        {hasContact && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="+64 21 123 4567" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="you@example.com" />
            </div>
          </>
        )}
        {hasAddress && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="123 Main St" />
              <p className="text-xs text-gray-400 mt-1">Private — not shown to finders</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
              <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Ponsonby" />
              <p className="text-xs text-gray-400 mt-1">Shown to finders when pet is found</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Auckland" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input type="text" value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="1011" />
              </div>
            </div>
          </>
        )}
        {hasEC && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" value={ecName} onChange={(e) => setEcName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Sarah Johnson" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
              <select value={ecRelationship} onChange={(e) => setEcRelationship(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">Select...</option>
                {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="+64 21 987 6543" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
              <input type="email" value={ecEmail} onChange={(e) => setEcEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="sarah@example.com" />
            </div>
          </>
        )}
      </div>
    );
  }

  function renderCallout(callout: NonNullable<OnboardingStep['content']>['callout']) {
    if (!callout) return null;
    const CalloutIcon = ICON_MAP[callout.icon] || Info;
    return (
      <div className={`rounded-xl border p-4 mt-6 ${CALLOUT_STYLES[callout.variant]}`}>
        <div className="flex items-start gap-3">
          <CalloutIcon size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{callout.title}</p>
            <p className="text-sm mt-1 opacity-90 whitespace-pre-line">{callout.text}</p>
          </div>
        </div>
      </div>
    );
  }

  function renderPrivacyNote(note: NonNullable<OnboardingStep['content']>['privacyNote']) {
    if (!note) return null;
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mt-4">
        <div className="flex items-start gap-3">
          <Lock size={18} className="text-gray-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-gray-700">{note.title}</p>
            <p className="text-sm text-gray-600 mt-1">{note.text}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
          <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to PawTag!</h1>
          <p className="text-gray-500 mb-6">Your account is ready. Head to your dashboard to get started.</p>
          <button
            onClick={completeOnboarding}
            disabled={saving}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Go to My Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  if (!step) return null;

  const StepIcon = ICON_MAP[step.icon] || Heart;

  // Completion step — show summary
  if (step.stepId === 'completion') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
          <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{step.title}</h1>
          <p className="text-gray-500 mb-8">{step.subtitle}</p>

          {step.content?.storyText && (
            <div className="text-left bg-gray-50 rounded-xl p-5 mb-6">
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{step.content.storyText}</p>
            </div>
          )}

          {renderCallout(step.content?.callout)}

          <button
            onClick={completeOnboarding}
            disabled={saving}
            className="mt-8 w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Go to My Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div className="h-full bg-primary-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Step indicator */}
        <div className="px-8 pt-6 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Step {currentIdx + 1} of {steps.length}</span>
          <span className="text-xs font-medium text-primary-600">{Math.round(progress)}% complete</span>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 bg-primary-100 rounded-2xl flex items-center justify-center shrink-0">
              <StepIcon size={28} className="text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{step.title}</h1>
              {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
            </div>
          </div>

          {/* Stats (for reality step) */}
          {step.content?.stats && step.content.stats.length > 0 && (
            <div className="grid grid-cols-3 gap-3 my-6">
              {step.content.stats.map((stat, i) => (
                <div key={i} className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-xl font-bold text-primary-600">{stat.number}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Story heading */}
          {step.content?.storyHeading && (
            <p className="text-lg font-semibold text-gray-800 mt-6 mb-2">{step.content.storyHeading}</p>
          )}

          {/* Story text */}
          {step.content?.storyText && (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{step.content.storyText}</p>
          )}

          {/* Flow steps (for how-it-works) */}
          {step.content?.flowSteps && step.content.flowSteps.length > 0 && (
            <div className="flex items-center justify-between gap-2 my-6">
              {step.content.flowSteps.map((fs, i) => {
                const FsIcon = ICON_MAP[fs.icon] || Heart;
                return (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col items-center text-center flex-1">
                      <div className="h-12 w-12 bg-primary-100 rounded-xl flex items-center justify-center mb-2">
                        <FsIcon size={20} className="text-primary-600" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800">{fs.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fs.description}</p>
                    </div>
                    {i < (step.content?.flowSteps?.length ?? 0) - 1 && (
                      <ArrowRight size={16} className="text-gray-300 shrink-0 mt-[-16px]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Why it matters */}
          {step.content?.whyItMatters && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-700 mb-1">Why This Matters</p>
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{step.content.whyItMatters}</p>
            </div>
          )}

          {/* Privacy note */}
          {renderPrivacyNote(step.content?.privacyNote)}

          {/* Callout */}
          {renderCallout(step.content?.callout)}

          {/* Form fields */}
          {step.type === 'form' && renderFormFields()}
        </div>

        {/* Navigation */}
        <div className="px-8 pb-6">
          <div className="flex items-center gap-3">
            {!isFirst && (
              <button onClick={handleBack} className="flex items-center gap-2 px-5 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : isLast ? 'Complete Setup' : 'Continue'}
              {!isLast && !saving && <ArrowRight size={16} />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={skipOnboarding}
              disabled={saving}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Maybe later
            </button>
            <button
              onClick={dismissOnboarding}
              disabled={saving}
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            >
              Don't show me again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
