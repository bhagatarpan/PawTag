import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';
import { SiteAvailabilityStatus } from '@pawtag/shared';

interface AvailabilityMessages {
  maintenanceTitle: string;
  maintenanceMessage: string;
  offlineTitle: string;
  offlineMessage: string;
}

interface SiteAvailabilityContextType {
  status: SiteAvailabilityStatus;
  messages: AvailabilityMessages;
  loading: boolean;
}

const DEFAULT_MESSAGES: AvailabilityMessages = {
  maintenanceTitle: 'PawTag is currently under maintenance',
  maintenanceMessage: 'Some website functionality is temporarily unavailable. Please check back shortly.',
  offlineTitle: 'PawTag is currently offline',
  offlineMessage: 'Please come back later.',
};

const SiteAvailabilityContext = createContext<SiteAvailabilityContextType>({
  status: SiteAvailabilityStatus.ONLINE,
  messages: DEFAULT_MESSAGES,
  loading: true,
});

export function useSiteAvailability() {
  return useContext(SiteAvailabilityContext);
}

const apiBase = '/api';

export function SiteAvailabilityProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SiteAvailabilityStatus>(SiteAvailabilityStatus.ONLINE);
  const [messages, setMessages] = useState<AvailabilityMessages>(DEFAULT_MESSAGES);
  const [pollingInterval, setPollingInterval] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${apiBase}/public/system/status`);
      const data = res.data.data;
      setStatus(data.status || SiteAvailabilityStatus.ONLINE);

      // If we're in maintenance or offline, fetch the full availability details for messages
      if (data.status === SiteAvailabilityStatus.MAINTENANCE || data.status === SiteAvailabilityStatus.OFFLINE) {
        try {
          const detailRes = await axios.get(`${apiBase}/admin/site-availability/status`);
          const detail = detailRes.data.data;
          setMessages(detail.messages);
          setPollingInterval(detail.pollingInterval);
        } catch {
          // Not authenticated as admin — use defaults
        }
      }
    } catch {
      // Network error — don't change status (could be temporary)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollingInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus, pollingInterval]);

  return (
    <SiteAvailabilityContext.Provider value={{ status, messages, loading }}>
      {children}
    </SiteAvailabilityContext.Provider>
  );
}
