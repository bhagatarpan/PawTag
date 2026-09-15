import { useState, useEffect } from 'react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import { Loader2, Save } from 'lucide-react';

interface SliderSettings {
  enabled: string;
  autoplay: string;
  duration: string;
  pauseOnHover: string;
  transition: string;
  speed: string;
  loop: string;
  showArrows: string;
  showPagination: string;
  paginationType: string;
  keyboard: string;
  touchSwipe: string;
  respectReducedMotion: string;
}

const DEFAULT_SETTINGS: SliderSettings = {
  enabled: 'true',
  autoplay: 'true',
  duration: '5000',
  pauseOnHover: 'true',
  transition: 'fade',
  speed: '300',
  loop: 'false',
  showArrows: 'true',
  showPagination: 'true',
  paginationType: 'bullets',
  keyboard: 'true',
  touchSwipe: 'true',
  respectReducedMotion: 'true',
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SliderSettings)[];

export default function HeroSliderSettings() {
  const [settings, setSettings] = useState<SliderSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/admin/settings', {
          params: { category: 'heroSlider' },
        });
        const data = res.data.data || [];
        const mapped: Partial<SliderSettings> = {};
        data.forEach((s: { key: string; value: string }) => {
          const key = s.key.replace('heroSlider.', '') as keyof SliderSettings;
          if (SETTING_KEYS.includes(key)) {
            mapped[key] = s.value;
          }
        });
        setSettings({ ...DEFAULT_SETTINGS, ...mapped });
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = SETTING_KEYS.map((key) => ({
        key: `heroSlider.${key}`,
        value: settings[key],
        displayValue: key,
        category: 'heroSlider',
      }));
      await api.put('/admin/settings', { settings: updates });
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof SliderSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Slider Settings</h2>
          <p className="text-sm text-gray-500">Configure global hero slider behavior</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
        {/* General */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">General</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSetting
              label="Enable Hero Slider"
              description="Show the hero slider on the homepage"
              value={settings.enabled}
              onChange={(v) => updateSetting('enabled', v)}
            />
            <ToggleSetting
              label="Loop Mode"
              description="Enable infinite looping through slides"
              value={settings.loop}
              onChange={(v) => updateSetting('loop', v)}
            />
          </div>
        </div>

        {/* Autoplay */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Autoplay</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSetting
              label="Enable Autoplay"
              description="Auto-advance between slides"
              value={settings.autoplay}
              onChange={(v) => updateSetting('autoplay', v)}
            />
            <ToggleSetting
              label="Pause on Hover"
              description="Pause autoplay when mouse enters slider"
              value={settings.pauseOnHover}
              onChange={(v) => updateSetting('pauseOnHover', v)}
            />
            <NumberSetting
              label="Slide Duration (ms)"
              description="Milliseconds between slide advances"
              value={settings.duration}
              onChange={(v) => updateSetting('duration', v)}
              min={1000}
              max={30000}
              step={500}
            />
          </div>
        </div>

        {/* Transition */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Transition</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectSetting
              label="Transition Effect"
              description="Slide transition animation style"
              value={settings.transition}
              onChange={(v) => updateSetting('transition', v)}
              options={[
                { label: 'Fade', value: 'fade' },
                { label: 'Slide', value: 'slide' },
                { label: 'Cube', value: 'cube' },
                { label: 'Flip', value: 'flip' },
                { label: 'Creative', value: 'creative' },
              ]}
            />
            <NumberSetting
              label="Transition Speed (ms)"
              description="Duration of transition animation"
              value={settings.speed}
              onChange={(v) => updateSetting('speed', v)}
              min={100}
              max={2000}
              step={50}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Navigation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSetting
              label="Show Navigation Arrows"
              description="Display prev/next navigation arrows"
              value={settings.showArrows}
              onChange={(v) => updateSetting('showArrows', v)}
            />
            <ToggleSetting
              label="Show Pagination Dots"
              description="Display dot indicators at bottom"
              value={settings.showPagination}
              onChange={(v) => updateSetting('showPagination', v)}
            />
            <SelectSetting
              label="Pagination Type"
              description="Style of pagination indicators"
              value={settings.paginationType}
              onChange={(v) => updateSetting('paginationType', v)}
              options={[
                { label: 'Bullets', value: 'bullets' },
                { label: 'Fraction', value: 'fraction' },
                { label: 'Progress Bar', value: 'progressbar' },
              ]}
            />
          </div>
        </div>

        {/* Interaction */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Interaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSetting
              label="Keyboard Navigation"
              description="Enable arrow key navigation"
              value={settings.keyboard}
              onChange={(v) => updateSetting('keyboard', v)}
            />
            <ToggleSetting
              label="Touch Swipe"
              description="Enable touch/swipe on mobile devices"
              value={settings.touchSwipe}
              onChange={(v) => updateSetting('touchSwipe', v)}
            />
            <ToggleSetting
              label="Respect Reduced Motion"
              description="Disable animations for users who prefer reduced motion"
              value={settings.respectReducedMotion}
              onChange={(v) => updateSetting('respectReducedMotion', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Setting Components ────────────────────────────────────────────

function ToggleSetting({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isOn = value === 'true';
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={() => onChange(isOn ? 'false' : 'true')}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          isOn ? 'bg-primary-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
            isOn ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function NumberSetting({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900">{label}</label>
      <p className="text-xs text-gray-500 mb-1">{description}</p>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}

function SelectSetting({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900">{label}</label>
      <p className="text-xs text-gray-500 mb-1">{description}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
