import { Plus, Trash2 } from 'lucide-react';
import ImagePicker from './ImagePicker';

interface SectionContentEditorProps {
  sectionType: string;
  value: Record<string, unknown>;
  onChange: (val: Record<string, unknown>) => void;
}

const HOW_IT_WORKS_ICONS = [
  { value: 'UserPlus', label: '👤 User Plus' },
  { value: 'Tag', label: '🏷️ Tag' },
  { value: 'Scan', label: '📱 Scan' },
  { value: 'Home', label: '🏠 Home' },
  { value: 'PawPrint', label: '🐾 Paw' },
  { value: 'Heart', label: '❤️ Heart' },
  { value: 'Shield', label: '🛡️ Shield' },
  { value: 'MapPin', label: '📍 Map Pin' },
  { value: 'Phone', label: '📞 Phone' },
  { value: 'Bell', label: '🔔 Bell' },
  { value: 'Check', label: '✅ Check' },
  { value: 'Search', label: '🔍 Search' },
];

const HOW_IT_WORKS_COLORS = [
  { value: 'bg-primary-600', label: 'Primary Blue' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-sky-500', label: 'Sky Blue' },
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-emerald-500', label: 'Emerald' },
  { value: 'bg-violet-500', label: 'Violet' },
  { value: 'bg-orange-500', label: 'Orange' },
  { value: 'bg-pink-500', label: 'Pink' },
];

const TRUST_ICONS = [
  { value: 'ShieldCheck', label: '🛡️ Shield Check' },
  { value: 'Lock', label: '🔒 Lock' },
  { value: 'Eye', label: '👁️ Eye' },
  { value: 'RotateCcw', label: '🔄 Rotate' },
  { value: 'Shield', label: '🛡️ Shield' },
  { value: 'Check', label: '✅ Check' },
  { value: 'Heart', label: '❤️ Heart' },
  { value: 'Award', label: '🏅 Award' },
];

const TRUST_COLORS = [
  { value: 'bg-primary-50 text-primary-600', label: 'Primary Blue' },
  { value: 'bg-violet-50 text-violet-600', label: 'Violet' },
  { value: 'bg-amber-50 text-amber-600', label: 'Amber' },
  { value: 'bg-emerald-50 text-emerald-600', label: 'Emerald' },
  { value: 'bg-sky-50 text-sky-600', label: 'Sky Blue' },
  { value: 'bg-rose-50 text-rose-600', label: 'Rose' },
  { value: 'bg-orange-50 text-orange-600', label: 'Orange' },
];

const TESTIMONIAL_COLORS = [
  { value: 'bg-primary-500', label: 'Primary Blue' },
  { value: 'bg-sky-500', label: 'Sky Blue' },
  { value: 'bg-violet-500', label: 'Violet' },
  { value: 'bg-emerald-500', label: 'Emerald' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-orange-500', label: 'Orange' },
  { value: 'bg-pink-500', label: 'Pink' },
];

const HERO_BACKGROUNDS = [
  { value: 'from-primary-700 via-primary-600 to-primary-800', label: 'Primary Gradient' },
  { value: 'from-primary-800 via-primary-700 to-primary-600', label: 'Primary Dark to Light' },
  { value: 'from-primary-600 via-primary-700 to-primary-800', label: 'Primary Light to Dark' },
  { value: 'from-emerald-700 via-emerald-600 to-emerald-800', label: 'Emerald' },
  { value: 'from-sky-700 via-sky-600 to-sky-800', label: 'Sky Blue' },
  { value: 'from-violet-700 via-violet-600 to-violet-800', label: 'Violet' },
];

const ACTIVITY_ICONS = [
  { value: 'ClipboardCheck', label: '📋 Clipboard' },
  { value: 'Camera', label: '📷 Camera' },
  { value: 'Syringe', label: '💉 Syringe' },
  { value: 'Star', label: '⭐ Star' },
  { value: 'Award', label: '🏅 Award' },
  { value: 'Sparkles', label: '✨ Sparkles' },
  { value: 'Heart', label: '❤️ Heart' },
  { value: 'Check', label: '✅ Check' },
];

const ACTIVITY_COLORS = [
  { value: 'text-primary-600 bg-primary-50', label: 'Primary Blue' },
  { value: 'text-sky-600 bg-sky-50', label: 'Sky Blue' },
  { value: 'text-emerald-600 bg-emerald-50', label: 'Emerald' },
  { value: 'text-amber-600 bg-amber-50', label: 'Amber' },
  { value: 'text-violet-600 bg-violet-50', label: 'Violet' },
  { value: 'text-rose-600 bg-rose-50', label: 'Rose' },
  { value: 'text-orange-600 bg-orange-50', label: 'Orange' },
];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border rounded-lg px-3 py-2 text-sm" />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
  );
}

function HowItWorksEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const update = (key: string, val: string) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        This is one step in the "How It Works" section. Each step shows an icon, title, and description.
      </div>
      <FieldRow label="Icon">
        <Select value={(content.icon as string) || 'UserPlus'} onChange={v => update('icon', v)} options={HOW_IT_WORKS_ICONS} />
      </FieldRow>
      <FieldRow label="Step Title">
        <TextInput value={(content.title as string) || ''} onChange={v => update('title', v)} placeholder="e.g. Register Your Pet" />
      </FieldRow>
      <FieldRow label="Description">
        <Textarea value={(content.desc as string) || ''} onChange={v => update('desc', v)} placeholder="What happens in this step..." />
      </FieldRow>
      <FieldRow label="Icon Background Color">
        <Select value={(content.iconBg as string) || 'bg-primary-600'} onChange={v => update('iconBg', v)} options={HOW_IT_WORKS_COLORS} />
      </FieldRow>
    </div>
  );
}

function TrustEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const update = (key: string, val: string) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        This is one trust badge. It shows an icon, title, and description on the homepage.
      </div>
      <FieldRow label="Icon">
        <Select value={(content.icon as string) || 'ShieldCheck'} onChange={v => update('icon', v)} options={TRUST_ICONS} />
      </FieldRow>
      <FieldRow label="Badge Title">
        <TextInput value={(content.title as string) || ''} onChange={v => update('title', v)} placeholder="e.g. Secure Accounts" />
      </FieldRow>
      <FieldRow label="Description">
        <Textarea value={(content.desc as string) || ''} onChange={v => update('desc', v)} placeholder="What this badge represents..." />
      </FieldRow>
      <FieldRow label="Color Theme">
        <Select value={(content.color as string) || 'bg-primary-50 text-primary-600'} onChange={v => update('color', v)} options={TRUST_COLORS} />
      </FieldRow>
    </div>
  );
}

function TestimonialEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const update = (key: string, val: string) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        This is one customer testimonial with a quote, name, and pet info.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Person Name">
          <TextInput value={(content.name as string) || ''} onChange={v => update('name', v)} placeholder="e.g. Sarah M." />
        </FieldRow>
        <FieldRow label="Initials (for avatar)">
          <TextInput value={(content.initials as string) || ''} onChange={v => update('initials', v)} placeholder="e.g. SM" />
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Pet Type">
          <TextInput value={(content.pet as string) || ''} onChange={v => update('pet', v)} placeholder="e.g. Golden Retriever" />
        </FieldRow>
        <FieldRow label="Avatar Color">
          <Select value={(content.color as string) || 'bg-primary-500'} onChange={v => update('color', v)} options={TESTIMONIAL_COLORS} />
        </FieldRow>
      </div>
      <FieldRow label="Quote">
        <Textarea value={(content.quote as string) || ''} onChange={v => update('quote', v)} placeholder="What the customer said..." rows={4} />
      </FieldRow>
      <FieldRow label="Focus Tag (optional)">
        <TextInput value={(content.focus as string) || ''} onChange={v => update('focus', v)} placeholder="e.g. Fast Reunion" />
      </FieldRow>
    </div>
  );
}

const FLOW_STEP_ICONS = [
  { value: 'PawPrint', label: '🐾 Paw' },
  { value: 'Scan', label: '📱 Scan' },
  { value: 'UserCheck', label: '✅ User Check' },
  { value: 'Phone', label: '📞 Phone' },
  { value: 'MapPin', label: '📍 Map Pin' },
  { value: 'UserPlus', label: '👤 User Plus' },
  { value: 'Tag', label: '🏷️ Tag' },
  { value: 'Home', label: '🏠 Home' },
  { value: 'Heart', label: '❤️ Heart' },
  { value: 'Shield', label: '🛡️ Shield' },
  { value: 'Bell', label: '🔔 Bell' },
  { value: 'Search', label: '🔍 Search' },
  { value: 'Award', label: '🏅 Award' },
  { value: 'Star', label: '⭐ Star' },
  { value: 'Camera', label: '📷 Camera' },
  { value: 'ClipboardCheck', label: '📋 Clipboard' },
];

const VISUAL_TYPES = [
  { value: 'paw', label: '🐾  Paw Icon' },
  { value: 'flow', label: '➡️  Step Flow Diagram' },
  { value: 'stats', label: '📊  Stats / Numbers' },
  { value: 'image', label: '🖼️  Custom Image' },
  { value: 'pet_profiles', label: '🐕  Pet Profiles' },
  { value: 'qr_code', label: '🏷️  QR Code Showcase' },
  { value: 'phone_scan', label: '📱  Phone Scan Action' },
  { value: 'trust_badges', label: '🛡️  Trust & Safety Badges' },
  { value: 'testimonials', label: '⭐  Customer Testimonials' },
  { value: 'location', label: '📍  Location Sharing' },
  { value: 'awards', label: '🏆  Awards & Achievements' },
  { value: 'heart', label: '❤️  Heart & Emotional' },
];

const HERO_FOCAL_OPTIONS = [
  { value: 'center', label: 'Center (default)' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'left-top', label: 'Top left' },
  { value: 'right-top', label: 'Top right' },
  { value: 'left-bottom', label: 'Bottom left' },
  { value: 'right-bottom', label: 'Bottom right' },
];

/** CSS object-position per focal point — mirrors the live hero's crop behaviour. */
const HERO_FOCAL_CSS: Record<string, string> = {
  center: 'center', top: 'center top', bottom: 'center bottom',
  left: 'left center', right: 'right center',
  'left-top': 'left top', 'right-top': 'right top',
  'left-bottom': 'left bottom', 'right-bottom': 'right bottom',
};

/** Mirrors the server-side rule: site paths or http(s) only. */
function isValidCtaUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return true;
  if (value.startsWith('/')) return !value.startsWith('//');
  return /^https?:\/\//i.test(value);
}

/**
 * Preview of the live full-width cinematic hero: photography covers the
 * whole pane, a dark readability scrim sits on top, and the eyebrow /
 * headline / CTA pills render as white overlay text — mirroring
 * apps/web/src/components/hero/* so admin previews never drift from
 * the published homepage.
 */
function HeroPreviewPane({
  label,
  className,
  eyebrow,
  headline,
  imageUrl,
  focalPoint = 'center',
  shape = 'desktop',
}: {
  label: string;
  className: string;
  eyebrow: string;
  headline: string;
  imageUrl: string;
  focalPoint?: string;
  /** Which live composition to mirror — the mobile pane always uses the vertical scrim. */
  shape?: 'desktop' | 'mobile';
}) {
  const objectPosition = HERO_FOCAL_CSS[focalPoint] || 'center';
  const scrim =
    shape === 'mobile'
      ? 'bg-gradient-to-b from-[#071f22]/40 via-[#071f22]/55 to-[#071f22]/90'
      : 'bg-gradient-to-b from-[#071f22]/40 via-[#071f22]/55 to-[#071f22]/90 md:bg-gradient-to-r md:from-[#071f22]/85 md:via-[#071f22]/50 md:to-[#071f22]/5';
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className={`${className} relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-primary-900 via-gray-900 to-primary-800`}>
        {imageUrl && (
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition }} />
        )}
        <div aria-hidden="true" className={`absolute inset-0 ${scrim}`} />
        <div className="relative flex h-full flex-col justify-end p-3">
          {eyebrow && <p className="text-[8px] font-semibold uppercase tracking-widest text-primary-300">{eyebrow}</p>}
          <p className="mt-0.5 line-clamp-3 text-[11px] font-bold leading-tight text-white">{headline || 'Headline preview'}</p>
          <div className="mt-2 flex gap-1.5">
            <span className="rounded bg-primary-600 px-2 py-0.5 text-[7px] font-semibold text-white">Primary CTA</span>
            <span className="rounded border border-white/70 px-2 py-0.5 text-[7px] font-semibold text-white">Secondary</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSlideEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const update = (key: string, val: unknown) => onChange({ ...content, [key]: val });

  const eyebrow = (content.eyebrow as string) || '';
  const headline = (content.headline as string) || '';
  const desktopImage = (content.desktopImageUrl as string) || (content.imageUrl as string) || '';
  const mobileImage = (content.mobileImageUrl as string) || '';

  const primaryUrl = (content.ctaUrl as string) || '';
  const secondaryUrl = (content.secondaryCtaUrl as string) || '';
  const primaryUrlInvalid = !isValidCtaUrl(primaryUrl);
  const secondaryUrlInvalid = !isValidCtaUrl(secondaryUrl);
  const missingPrimaryPair =
    (primaryUrl.trim() && !(content.ctaText as string)?.trim()) ||
    ((content.ctaText as string)?.trim() && !primaryUrl.trim());

  // Legacy visual fields (pre-photography slides) — kept editable so old
  // slides can be restored and maintained, but deprecated for new slides.
  const visualType = (content.visualType as string) || 'paw';
  const stats = (content.stats as Array<{ number: string; label: string }>) || [];
  const flowSteps = (content.flowSteps as Array<{ icon: string; label: string; desc: string }>) || [];
  const updateStat = (index: number, key: string, val: string) => {
    const updated = [...stats];
    updated[index] = { ...updated[index], [key]: val };
    update('stats', updated);
  };
  const updateFlowStep = (index: number, key: string, val: string) => {
    const updated = [...flowSteps];
    updated[index] = { ...updated[index], [key]: val };
    update('flowSteps', updated);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        This is one hero slide. The homepage shows your published slides in order. Upload desktop and mobile
        photography below — the photo fills the entire homepage hero with the text overlaid on a dark
        gradient. Until an image is set, visitors see a branded teal gradient. Never put
        statistics, testimonials, or prices in a hero slide.
      </div>

      {/* Text content */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">Text Content</h4>
        <FieldRow label="Eyebrow (small label above the headline)">
          <TextInput value={eyebrow} onChange={v => update('eyebrow', v)} placeholder="e.g. PET SAFETY, SIMPLIFIED" />
        </FieldRow>
        <FieldRow label="Headline *">
          <TextInput value={headline} onChange={v => update('headline', v)} placeholder="e.g. They can't tell someone where they live." />
        </FieldRow>
        <FieldRow label="Supporting Text">
          <Textarea value={(content.sub as string) || ''} onChange={v => update('sub', v)} rows={2}
            placeholder="One or two friendly sentences" />
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Primary Button Text">
            <TextInput value={(content.ctaText as string) || ''} onChange={v => update('ctaText', v)} placeholder="e.g. Shop PawTag" />
          </FieldRow>
          <FieldRow label="Primary Button Link">
            <TextInput value={primaryUrl} onChange={v => update('ctaUrl', v)} placeholder="e.g. /shop" />
          </FieldRow>
        </div>
        {primaryUrlInvalid && (
          <p className="text-xs text-red-600">Use a site path like /shop or a full https:// link.</p>
        )}
        {missingPrimaryPair && (
          <p className="text-xs text-red-600">Primary button text and link must be provided together.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Secondary Button Text (optional)">
            <TextInput value={(content.secondaryCtaText as string) || ''} onChange={v => update('secondaryCtaText', v)} placeholder="e.g. How PawTag Works" />
          </FieldRow>
          <FieldRow label="Secondary Button Link (optional)">
            <TextInput value={secondaryUrl} onChange={v => update('secondaryCtaUrl', v)} placeholder="e.g. /about" />
          </FieldRow>
        </div>
        {secondaryUrlInvalid && (
          <p className="text-xs text-red-600">Use a site path like /about or a full https:// link.</p>
        )}
      </div>

      {/* Images */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">Photography</h4>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Recommended: wide cinematic desktop photo around 2400×1100px (≈2.2:1), under 500&nbsp;KB, WebP or JPG.
          Add a separate portrait mobile crop (~1080×1620px) for the best phone experience.
          Keep the pet on the right side of the desktop frame (top of the mobile frame) so the
          headline area stays clear — the text sits over a dark gradient on the left.
        </div>
        <FieldRow label="Desktop Image">
          <ImagePicker value={desktopImage} onChange={v => update('desktopImageUrl', v)} placeholder="Choose or upload the desktop photo" />
        </FieldRow>
        <FieldRow label="Mobile Image (optional — desktop image is used otherwise)">
          <ImagePicker value={mobileImage} onChange={v => update('mobileImageUrl', v)} placeholder="Choose or upload the mobile crop" />
        </FieldRow>
        <FieldRow label="Image Alt Text (describe the photo for screen readers)">
          <TextInput value={(content.imageAlt as string) || ''} onChange={v => update('imageAlt', v)} placeholder="e.g. Golden Retriever wearing a PawTag tag in afternoon sunlight" />
        </FieldRow>
        <FieldRow label="Image Focal Point (which part stays visible when cropped — desktop)">
          <Select value={(content.imageFocalPoint as string) || 'center'} onChange={v => update('imageFocalPoint', v)} options={HERO_FOCAL_OPTIONS} />
        </FieldRow>
        <FieldRow label="Mobile Focal Point (for the mobile crop; defaults to the setting above)">
          <Select value={(content.imageMobileFocalPoint as string) || (content.imageFocalPoint as string) || 'center'} onChange={v => update('imageMobileFocalPoint', v)} options={HERO_FOCAL_OPTIONS} />
        </FieldRow>
      </div>

      {/* Previews */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">Preview</h4>
        <div className="grid grid-cols-[1fr_90px] gap-3 items-start">
          <HeroPreviewPane label="Desktop" className="h-28" eyebrow={eyebrow} headline={headline} imageUrl={desktopImage} focalPoint={(content.imageFocalPoint as string) || 'center'} />
          <HeroPreviewPane label="Mobile" className="h-36" shape="mobile" eyebrow={eyebrow} headline={headline} imageUrl={mobileImage || desktopImage} focalPoint={(content.imageMobileFocalPoint as string) || (content.imageFocalPoint as string) || 'center'} />
        </div>
      </div>

      {/* Timing */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">Timing</h4>
        <FieldRow label="Auto-Rotation Speed (seconds, 3–30)">
          <input type="number" min={3} max={30} value={(content.duration as number) || 7}
            onChange={e => update('duration', Math.min(30, Math.max(3, Number(e.target.value) || 7)))}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </FieldRow>
      </div>

      {/* Legacy visual (deprecated) */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">Legacy Visual (deprecated)</h4>
        <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-500">
          The old illustration-style visuals are kept only so previous slides can still be edited and restored.
          New slides should use photography above.
        </div>
        <FieldRow label="Legacy Visual Type">
          <Select value={visualType} onChange={v => update('visualType', v)} options={VISUAL_TYPES} />
        </FieldRow>
        <FieldRow label="Legacy Background Gradient">
          <Select value={(content.bg as string) || 'from-primary-700 via-primary-600 to-primary-800'} onChange={v => update('bg', v)} options={HERO_BACKGROUNDS} />
        </FieldRow>

        {visualType === 'stats' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Stats (legacy — do not publish unverified numbers)</label>
              <button onClick={() => update('stats', [...stats, { number: '', label: '' }])} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                <Plus size={14} /> Add Stat
              </button>
            </div>
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
                <input type="text" value={stat.number} onChange={e => updateStat(i, 'number', e.target.value)}
                  className="flex-1 border rounded px-2 py-1.5 text-xs" placeholder="Value" />
                <input type="text" value={stat.label} onChange={e => updateStat(i, 'label', e.target.value)}
                  className="flex-1 border rounded px-2 py-1.5 text-xs" placeholder="Label" />
                <button onClick={() => update('stats', stats.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {visualType === 'flow' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Flow Steps (legacy)</label>
              <button onClick={() => update('flowSteps', [...flowSteps, { icon: 'PawPrint', label: '', desc: '' }])} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                <Plus size={14} /> Add Step
              </button>
            </div>
            {flowSteps.map((step, i) => (
              <div key={i} className="border rounded-lg p-2 bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Step {i + 1}</span>
                  <button onClick={() => update('flowSteps', flowSteps.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={step.icon} onChange={e => updateFlowStep(i, 'icon', e.target.value)} className="w-full border rounded px-2 py-1 text-xs">
                    {FLOW_STEP_ICONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input type="text" value={step.label} onChange={e => updateFlowStep(i, 'label', e.target.value)}
                    className="w-full border rounded px-2 py-1 text-xs" placeholder="Label" />
                  <input type="text" value={step.desc} onChange={e => updateFlowStep(i, 'desc', e.target.value)}
                    className="w-full border rounded px-2 py-1 text-xs" placeholder="Description" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResponsibilityScoreEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const update = (key: string, val: string) => onChange({ ...content, [key]: val });
  const activities = (content.activities as Array<Record<string, string>>) || [];

  const updateActivity = (index: number, key: string, val: string) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [key]: val };
    onChange({ ...content, activities: updated });
  };

  const addActivity = () => {
    onChange({
      ...content,
      activities: [...activities, { icon: 'Star', points: '+10', label: 'New Activity', color: 'text-primary-600 bg-primary-50' }],
    });
  };

  const removeActivity = (index: number) => {
    onChange({ ...content, activities: activities.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        This section shows the Responsibility Score feature on the homepage.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Score Number">
          <TextInput value={(content.score as string) || ''} onChange={v => update('score', v)} placeholder="e.g. 820" />
        </FieldRow>
        <FieldRow label="Score Label">
          <TextInput value={(content.scoreLabel as string) || ''} onChange={v => update('scoreLabel', v)} placeholder="e.g. Excellent" />
        </FieldRow>
      </div>
      <FieldRow label="Section Title">
        <TextInput value={(content.title as string) || ''} onChange={v => update('title', v)} placeholder="e.g. Earn points for being a great pet parent" />
      </FieldRow>
      <FieldRow label="Section Description">
        <Textarea value={(content.desc as string) || ''} onChange={v => update('desc', v)} placeholder="How the Responsibility Score works..." />
      </FieldRow>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Activities (how to earn points)</label>
          <button onClick={addActivity} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
            <Plus size={14} /> Add Activity
          </button>
        </div>
        <div className="space-y-3">
          {activities.map((act, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Activity {i + 1}</span>
                <button onClick={() => removeActivity(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Icon</label>
                  <select value={act.icon || 'Star'} onChange={e => updateActivity(i, 'icon', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    {ACTIVITY_ICONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Points</label>
                  <input type="text" value={act.points || ''} onChange={e => updateActivity(i, 'points', e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-xs" placeholder="+10" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Color</label>
                  <select value={act.color || 'text-primary-600 bg-primary-50'} onChange={e => updateActivity(i, 'color', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    {ACTIVITY_COLORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Label</label>
                <input type="text" value={act.label || ''} onChange={e => updateActivity(i, 'label', e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-xs" placeholder="e.g. Complete Profile" />
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No activities yet. Click "Add Activity" to create one.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FallbackEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-3">
        This section type doesn't have a visual editor yet. You can edit the raw JSON below.
      </div>
      <textarea
        value={JSON.stringify(content, null, 2)}
        onChange={e => {
          try { onChange(JSON.parse(e.target.value)); } catch { /* ignore parse errors while typing */ }
        }}
        className="w-full border rounded-lg px-3 py-2 text-sm font-mono resize-y"
        rows={10}
      />
    </div>
  );
}

export default function SectionContentEditor({ sectionType, value, onChange }: SectionContentEditorProps) {
  const content = value || {};

  const editorMap: Record<string, React.ReactNode> = {
    how_it_works: <HowItWorksEditor content={content} onChange={onChange} />,
    trust: <TrustEditor content={content} onChange={onChange} />,
    testimonial: <TestimonialEditor content={content} onChange={onChange} />,
    hero_slide: <HeroSlideEditor content={content} onChange={onChange} />,
    responsibility_score: <ResponsibilityScoreEditor content={content} onChange={onChange} />,
  };

  return (
    <div className="border rounded-xl p-4 bg-white">
      {editorMap[sectionType] || <FallbackEditor content={content} onChange={onChange} />}
    </div>
  );
}
