import { useState } from 'react';
import HeroSliderManager from '../../components/hero/HeroSliderManager';
import HeroSliderSettings from '../../components/hero/HeroSliderSettings';
import { Sliders, Settings } from 'lucide-react';

export default function HeroSliderPage() {
  const [activeTab, setActiveTab] = useState<'slides' | 'settings'>('slides');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('slides')}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'slides'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sliders size={16} />
            Slides
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings size={16} />
            Settings
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'slides' && <HeroSliderManager />}
      {activeTab === 'settings' && <HeroSliderSettings />}
    </div>
  );
}
