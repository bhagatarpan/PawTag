const TYPE_MAP: Record<string, string> = {
  hero: 'HeroBanner',
  features: 'FeaturesGrid',
  rich_text: 'RichTextBlock',
  gallery: 'ImageGallery',
  cards: 'CardsGrid',
  pricing: 'PricingTable',
  testimonials: 'TestimonialsSection',
  faq: 'FaqAccordion',
  timeline: 'TimelineSection',
  statistics: 'StatsCounter',
  video: 'VideoEmbed',
  cta: 'CtaBanner',
  partners: 'PartnersLogos',
  map: 'MapBlock',
  custom: 'CustomHtml',
  contact_form: 'ContactForm',
};

export function sectionsToPuckData(sections: any[], options?: { filterPublished?: boolean }) {
  const filterPublished = options?.filterPublished ?? true;

  const content = (sections || [])
    .filter((s: any) => {
      if (s.visible === false) return false;
      if (filterPublished && s.status && s.status !== 'published') return false;
      return true;
    })
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((section: any, idx: number) => {
      const props = { ...section.content };
      return {
        type: TYPE_MAP[section.type] || section.type,
        props: {
          id: section.sectionId || `section_${idx}`,
          ...props,
        },
      };
    });

  return { content, root: {} };
}
