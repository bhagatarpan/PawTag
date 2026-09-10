import { createApiClient, createLocalStorageTokenStorage, API } from '@pawtag/shared/api';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import type { FinderData, FoundTimerData, NotifyPayload } from '../types';

const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  storage: createLocalStorageTokenStorage('__finder_unused__', '__finder_unused__'),
  refreshEndpoint: '/api/auth/refresh',
});

export async function fetchSystemStatus(): Promise<SiteAvailabilityStatus> {
  try {
    const res = await api.get(API.public.system.status);
    return res.data.data.status || SiteAvailabilityStatus.ONLINE;
  } catch {
    return SiteAvailabilityStatus.ONLINE;
  }
}

export async function fetchTagData(tagId: string): Promise<FinderData> {
  const res = await api.get(API.finder.tag(tagId));
  return res.data.data;
}

export async function fetchFoundTimer(tagId: string): Promise<FoundTimerData> {
  const res = await api.get(API.finder.foundTimer(tagId));
  return res.data.data;
}

export async function notifyOwner(tagId: string, payload: NotifyPayload): Promise<void> {
  await api.post(API.finder.notify(tagId), payload);
}
