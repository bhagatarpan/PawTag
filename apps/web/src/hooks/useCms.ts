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
  'seo.defaultKeywords'?: string;
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

// Pet Reference types
export interface PetReference {
  type: string;
  petSpecies?: string;
  label: string;
  value: string;
  order: number;
}

// Hook for pet references
export function usePetReferences(type?: string, petSpecies?: string) {
  const [references, setReferences] = useState<PetReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (petSpecies) params.set('petSpecies', petSpecies);
    const queryString = params.toString();
    const url = `/public/cms/pet-references${queryString ? `?${queryString}` : ''}`;
    
    api.get(url)
      .then((res) => {
        if (!cancelled) {
          setReferences(res.data.data || []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setReferences([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [type, petSpecies]);

  return { references, loading, error };
}

// Hook for grouped pet references
export function useGroupedPetReferences() {
  const [grouped, setGrouped] = useState<Record<string, Record<string, { label: string; value: string }[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/public/cms/pet-references/grouped')
      .then((res) => {
        if (!cancelled) {
          setGrouped(res.data.data || {});
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setGrouped({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { grouped, loading, error };
}

// Homepage Section types
export interface HomepageSection {
  _id: string;
  sectionType: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  order: number;
  isActive: boolean;
}

// Hook for homepage sections
export function useHomepageSections(sectionType?: string) {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = sectionType ? `?sectionType=${sectionType}` : '';
    api.get(`/public/cms/homepage/sections${params}`)
      .then((res) => {
        if (!cancelled) {
          setSections(res.data.data || []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setSections([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectionType]);

  return { sections, loading, error };
}

// Shop Page types
export interface ShopPage {
  _id: string;
  slug: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  metaTitle?: string;
  metaDescription?: string;
}

// Hook for shop pages
export function useShopPage(slug: string) {
  const [page, setPage] = useState<ShopPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/public/cms/shop/${slug}`)
      .then((res) => {
        if (!cancelled) {
          setPage(res.data.data || null);
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

// Auth Page types
export interface AuthPage {
  _id: string;
  pageType: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
}

// Hook for auth pages
export function useAuthPage(pageType: string) {
  const [page, setPage] = useState<AuthPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pageType) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/public/cms/auth/${pageType}`)
      .then((res) => {
        if (!cancelled) {
          setPage(res.data.data || null);
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
  }, [pageType]);

  return { page, loading, error };
}
