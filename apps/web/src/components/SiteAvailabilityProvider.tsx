import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
  const [loading, setLoading] = useState(true);
  const statusRef = useRef(status);
  const messagesRef = useRef(messages);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${apiBase}/public/system/status`);
      const data = res.data.data;
      const newStatus = data.status || SiteAvailabilityStatus.ONLINE;

      // Only update state if status actually changed — prevents full tree re-render every 30s
      if (newStatus !== statusRef.current) {
        statusRef.current = newStatus;
        setStatus(newStatus);
      }

      if (newStatus === SiteAvailabilityStatus.MAINTENANCE || newStatus === SiteAvailabilityStatus.OFFLINE) {
        try {
          const detailRes = await axios.get(`${apiBase}/admin/site-availability/status`);
          const detail = detailRes.data.data;
          const newMessages = detail.messages;
          // Only update if messages changed
          if (JSON.stringify(newMessages) !== JSON.stringify(messagesRef.current)) {
            messagesRef.current = newMessages;
            setMessages(newMessages);
          }
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
    const interval = setInterval(fetchStatus, 30_000); // Fixed 30s polling
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <SiteAvailabilityContext.Provider value={{ status, messages, loading }}>
      {children}
    </SiteAvailabilityContext.Provider>
  );
}
