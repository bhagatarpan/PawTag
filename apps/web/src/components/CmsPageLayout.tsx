import PageHero from './PageHero';
import SeoHead from './SeoHead';
import type { Page } from '../hooks/useCms';

interface CmsPageLayoutProps {
  page: Page;
  companyName?: string;
  children: React.ReactNode;
}

export function CmsPageLayout({ page, companyName, children }: CmsPageLayoutProps) {
  const seoTitle = page.metaTitle || `${companyName || 'PawTag'} - ${page.title}`;
  const seoDescription = page.metaDescription || '';
  const seoKeywords = page.metaKeywords || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        ogImage={page.ogImage}
        canonicalUrl={page.canonicalUrl}
      />
      <PageHero title={page.title} />
      <div className="py-12">{children}</div>
    </div>
  );
}
