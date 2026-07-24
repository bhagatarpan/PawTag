import { useState, useCallback } from 'react';
import { Puck, Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from './config';
import { Eye, Code } from 'lucide-react';

export interface PageSection {
  sectionId: string;
  type: string;
  title: string;
  subtitle: string;
  content: Record<string, unknown>;
  visible: boolean;
  order: number;
  status: 'draft' | 'published';
}

function puckTypeToSectionType(puckType: string): string {
  const map: Record<string, string> = {
    HeroBanner: 'hero', FeaturesGrid: 'features', RichTextBlock: 'rich_text',
    ImageGallery: 'gallery', CardsGrid: 'cards', PricingTable: 'pricing',
    TestimonialsSection: 'testimonials', FaqAccordion: 'faq',
    TimelineSection: 'timeline', StatsCounter: 'statistics',
    VideoEmbed: 'video', CtaBanner: 'cta', PartnersLogos: 'partners',
    MapBlock: 'map', CustomHtml: 'custom', ContactForm: 'contact_form',
  };
  return map[puckType] || puckType;
}

function sectionTypeToPuckType(sectionType: string): string {
  const map: Record<string, string> = {
    hero: 'HeroBanner', features: 'FeaturesGrid', rich_text: 'RichTextBlock',
    gallery: 'ImageGallery', cards: 'CardsGrid', pricing: 'PricingTable',
    testimonials: 'TestimonialsSection', faq: 'FaqAccordion',
    timeline: 'TimelineSection', statistics: 'StatsCounter',
    video: 'VideoEmbed', cta: 'CtaBanner', partners: 'PartnersLogos',
    map: 'MapBlock', custom: 'CustomHtml', contact_form: 'ContactForm',
  };
  return map[sectionType] || sectionType;
}

function sectionsToPuckData(sections: PageSection[]) {
  const content = sections
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const props = { ...section.content };

      // Convert string[] to { url: string }[] for Puck's array fields
      if (section.type === 'gallery' && Array.isArray(props.images)) {
        props.images = props.images.map((img: any) => typeof img === 'string' ? { url: img } : img);
      }
      if (section.type === 'partners' && Array.isArray(props.logos)) {
        props.logos = props.logos.map((logo: any) => typeof logo === 'string' ? { url: logo } : logo);
      }

      return {
        type: sectionTypeToPuckType(section.type),
        props: {
          id: section.sectionId,
          ...props,
        },
      };
    });
  return { content, root: {} };
}

function puckDataToSections(puckData: { content: any[]; root: any }): PageSection[] {
  return (puckData.content || []).map((item: any, idx: number) => {
    const props = { ...(item.props || {}) };
    const id = props.id;
    delete props.id;

    // Convert { url: string }[] back to string[] for images/logos in the API format
    if (item.type === 'ImageGallery' && Array.isArray(props.images)) {
      props.images = props.images.map((img: any) => typeof img === 'string' ? img : img?.url || '');
    }
    if (item.type === 'PartnersLogos' && Array.isArray(props.logos)) {
      props.logos = props.logos.map((logo: any) => typeof logo === 'string' ? logo : logo?.url || '');
    }

    return {
      sectionId: id || `section_${Date.now()}_${idx}`,
      type: puckTypeToSectionType(item.type),
      title: props.heading || props.title || '',
      subtitle: props.subheading || '',
      content: props,
      visible: true,
      order: idx,
      status: 'draft' as const,
    };
  });
}

interface PuckPageBuilderProps {
  sections: PageSection[];
  onChange: (sections: PageSection[]) => void;
}

export default function PuckPageBuilder({ sections, onChange }: PuckPageBuilderProps) {
  const [mode, setMode] = useState<'visual' | 'preview'>('visual');
  const [puckData, setPuckData] = useState(() => sectionsToPuckData(sections));

  const handlePuckChange = useCallback((data: any) => {
    setPuckData(data);
    onChange(puckDataToSections(data));
  }, [onChange]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Visual Page Builder</span>
          <span className="text-xs text-gray-400">— Drag and drop sections to build your page</span>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
          <button
            onClick={() => setMode('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'visual' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Code size={12} /> Edit
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'preview' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Eye size={12} /> Preview
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div style={{ height: 'calc(100vh - 320px)', minHeight: '600px' }}>
          <Puck
            config={pawtagConfig}
            data={puckData}
            onChange={handlePuckChange}
          />
        </div>
      ) : (
        <div className="bg-white p-8 min-h-[600px]">
          <Render config={pawtagConfig} data={puckData} />
        </div>
      )}
    </div>
  );
}
