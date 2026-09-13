import { Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from '../components/puck/config';
import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import { CmsPageSkeleton } from '@pawtag/ui';
import { CmsPageLayout } from '../components/CmsPageLayout';
import { sectionsToPuckData } from '../utils/puckData';

export default function Terms() {
  const { page, loading } = useCmsPage('terms-of-service');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  if (loading) return <CmsPageSkeleton />;
  if (!page) return <div>Page not found</div>;

  const puckData = sectionsToPuckData(page.sections);

  return (
    <CmsPageLayout page={page} companyName={companyName}>
      <Render config={pawtagConfig} data={puckData} />
    </CmsPageLayout>
  );
}
