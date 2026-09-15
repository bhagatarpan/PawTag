import { useState, useEffect } from 'react';
import { Puck, Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { heroSliderConfig } from '@web/components/hero/heroSliderConfig';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import { Loader2, Save, ArrowLeft, Monitor, Tablet, Smartphone } from 'lucide-react';

interface HeroSlide {
  _id: string;
  title: string;
  content: Record<string, unknown>;
  status?: 'draft' | 'published';
  duration?: number;
  transition?: string;
}

type ViewMode = 'edit' | 'preview';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export default function HeroSlideEditor({ slideId, onBack }: { slideId: string; onBack: () => void }) {
  const [slide, setSlide] = useState<HeroSlide | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [puckData, setPuckData] = useState<any>({ content: [], root: {} });

  useEffect(() => {
    const fetchSlide = async () => {
      try {
        const res = await api.get(`${API.admin.cms.homepage.list}/${slideId}`);
        const data = res.data.data;
        setSlide(data);
        
        // Convert content to Puck format
        // Content is stored as an array of components in the 'components' field
        const components = (data.content as Record<string, unknown>)?.components as any[] || [];
        setPuckData({
          content: components.map((c: any, i: number) => ({
            ...c,
            props: c.props || {},
            type: c.type || 'HeroHeading',
          })),
          root: {},
        });
      } catch (err) {
        console.error('Failed to fetch slide:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSlide();
  }, [slideId]);

  const handleSave = async () => {
    if (!slide) return;
    setSaving(true);
    try {
      // Convert Puck data back to content format
      const content = {
        ...slide.content,
        components: puckData.content.map((item: any) => ({
          type: item.type,
          props: item.props,
        })),
      };
      
      await api.put(API.admin.cms.homepage.update(slideId), {
        content,
        status: slide.status,
        duration: slide.duration,
        transition: slide.transition,
      });
      
      // Show success feedback
      alert('Slide saved successfully!');
    } catch (err) {
      console.error('Failed to save slide:', err);
      alert('Failed to save slide');
    } finally {
      setSaving(false);
    }
  };

  const deviceWidths: Record<DeviceMode, string> = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!slide) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Slide not found</p>
        <button onClick={onBack} className="mt-4 text-primary-600 hover:text-primary-700">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{slide.title}</h2>
            <p className="text-sm text-gray-500">Edit hero slide content</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Device Preview Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded ${deviceMode === 'desktop' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Desktop"
            >
              <Monitor size={16} />
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`p-1.5 rounded ${deviceMode === 'tablet' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Tablet"
            >
              <Tablet size={16} />
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded ${deviceMode === 'mobile' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Mobile"
            >
              <Smartphone size={16} />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${viewMode === 'edit' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Edit
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${viewMode === 'preview' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Preview
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {viewMode === 'edit' ? (
          <div className="h-[600px]">
            <Puck
              config={heroSliderConfig}
              data={puckData}
              onContentChange={(data) => setPuckData(data)}
            />
          </div>
        ) : (
          <div
            className="mx-auto bg-gray-100 p-4"
            style={{ maxWidth: deviceWidths[deviceMode] }}
          >
            <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-primary-800 rounded-xl p-8 min-h-[400px]">
              <Render config={heroSliderConfig} data={puckData} />
            </div>
          </div>
        )}
      </div>

      {/* Slide Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Slide Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={slide.status || 'draft'}
              onChange={(e) => setSlide({ ...slide, status: e.target.value as 'draft' | 'published' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (ms)</label>
            <input
              type="number"
              value={slide.duration || 5000}
              onChange={(e) => setSlide({ ...slide, duration: parseInt(e.target.value) })}
              min={1000}
              max={30000}
              step={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transition</label>
            <select
              value={slide.transition || 'fade'}
              onChange={(e) => setSlide({ ...slide, transition: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="cube">Cube</option>
              <option value="flip">Flip</option>
              <option value="creative">Creative</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
