import { useState, useEffect } from 'react';
import api from '../lib/api';

export interface SiteSettings {
  'company.name'?: string;
  'company.email'?: string;
  'company.phone'?: string;
  'company.address'?: string;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/public/cms/settings')
      .then((res) => {
        if (!cancelled) {
          setSettings(res.data.data || {});
        }
      })
      .catch(() => {
        if (!cancelled) setSettings({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { settings, loading };
}
