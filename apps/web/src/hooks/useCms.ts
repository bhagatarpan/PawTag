import { useState, useEffect } from 'react';
import api from '../lib/api';

// Navigation types
export interface NavItem {
  label: string;
  url: string;
  type: 'page' | 'custom';
  pageSlug?: string;
  openInNewTab?: boolean;
  children?: NavItem[];
}

export interface Navigation {
  _id: string;
  name: string;
  location: 'header' | 'footer' | 'sidebar' | 'mobile';
  items: NavItem[];
}

// Footer types
export interface FooterLink {
  label: string;
  url: string;
  type: 'page' | 'custom';
  pageSlug?: string;
  openInNewTab?: boolean;
}

export interface FooterGroup {
  title: string;
  links: FooterLink[];
}

export interface Footer {
  _id: string;
  brandDescription?: string;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  copyright?: string;
  groups: FooterGroup[];
}

// Page types
export interface PageSection {
  _id: string;
  type: string;
  title?: string;
  content?: any;
  visible: boolean;
  status: 'draft' | 'published';
}

export interface Page {
  _id: string;
  title: string;
  slug: string;
  sections: PageSection[];
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}

// Settings types
export interface SiteSettings {
  'site.name'?: string;
  'site.tagline'?: string;
  'site.description'?: string;
  'site.logo'?: string;
  'site.favicon'?: string;
  'company.name'?: string;
  'company.email'?: string;
  'company.phone'?: string;
  'company.address'?: string;
  'social.facebook'?: string;
  'social.twitter'?: string;
  'social.instagram'?: string;
  'social.linkedin'?: string;
  'social.youtube'?: string;
  'social.tiktok'?: string;
  'seo.defaultTitle'?: string;
  'seo.defaultDescription'?: string;
  'contact.email'?: string;
  'contact.phone'?: string;
  'contact.address'?: string;
}

// Hook for navigation
export function useNavigation(location: 'header' | 'footer' | 'sidebar' | 'mobile') {
  const [menus, setMenus] = useState<Navigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/public/cms/navigation/${location}`)
      .then((res) => {
        if (!cancelled) {
          setMenus(res.data.data || []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setMenus([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [location]);

  return { menus, loading, error };
}

// Hook for footer
export function useFooter() {
  const [footer, setFooter] = useState<Footer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/public/cms/footer')
      .then((res) => {
        if (!cancelled) {
          setFooter(res.data.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setFooter(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { footer, loading, error };
}

// Hook for pages
export function useCmsPage(slug: string) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/public/cms/pages/${slug}`)
      .then((res) => {
        if (!cancelled) {
          setPage(res.data.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setPage(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  return { page, loading, error };
}

// Hook for public settings
export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/public/cms/settings')
      .then((res) => {
        if (!cancelled) {
          setSettings(res.data.data || {});
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setSettings({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { settings, loading, error };
}
