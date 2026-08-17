import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

type SiteStatus = 'ONLINE' | 'MAINTENANCE' | 'OFFLINE';

interface SiteAvailabilityContextType {
  status: SiteStatus;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SiteAvailabilityContext = createContext<SiteAvailabilityContextType>({
  status: 'ONLINE',
  loading: true,
  refresh: async () => {},
});

export function useSiteAvailability() {
  return useContext(SiteAvailabilityContext);
}

export function SiteAvailabilityProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SiteStatus>('ONLINE');
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/public/system/status');
      setStatus(res.data.data.status);
    } catch {
      // On error, default to ONLINE (fail-open)
      setStatus('ONLINE');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds for status changes
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SiteAvailabilityContext.Provider value={{ status, loading, refresh: fetchStatus }}>
      {children}
    </SiteAvailabilityContext.Provider>
  );
}
