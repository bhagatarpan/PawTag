import { Helmet } from 'react-helmet-async';
import { useSiteSettings } from '../hooks/useCms';

interface SeoHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  canonicalUrl?: string;
  type?: string;
}

export default function SeoHead({
  title,
  description,
  keywords,
  ogImage,
  ogTitle,
  ogDescription,
  canonicalUrl,
  type = 'website',
}: SeoHeadProps) {
  const { settings } = useSiteSettings();
  
  const siteName = settings?.['site.name'] || 'PawTag';
  const defaultTitle = settings?.['seo.defaultTitle'] || 'PawTag - Never Lose Your Pet Again';
  const defaultDescription = settings?.['seo.defaultDescription'] || 'Smart QR-coded pet recovery tags. Because every pet deserves a safe way home.';
  const defaultKeywords = settings?.['seo.defaultKeywords']?.split(',').map(k => k.trim()) || ['pet recovery', 'QR code', 'pet tag', 'lost pet', 'found pet'];
  
  const pageTitle = title ? `${title} | ${siteName}` : defaultTitle;
  const pageDescription = description || defaultDescription;
  const pageKeywords = keywords?.length ? keywords : defaultKeywords;
  const pageOgImage = ogImage || settings?.['site.logo'] || '/og-image.png';
  const pageOgTitle = ogTitle || title || defaultTitle;
  const pageOgDescription = ogDescription || pageDescription;
  
  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={pageKeywords.join(', ')} />
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageOgTitle} />
      <meta property="og:description" content={pageOgDescription} />
      <meta property="og:image" content={pageOgImage} />
      <meta property="og:site_name" content={siteName} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageOgTitle} />
      <meta name="twitter:description" content={pageOgDescription} />
      <meta name="twitter:image" content={pageOgImage} />
      
      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
    </Helmet>
  );
}
