import axios from 'axios';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import type { FinderData, FoundTimerData, NotifyPayload } from '../types';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export async function fetchSystemStatus(): Promise<SiteAvailabilityStatus> {
  try {
    const res = await axios.get(`${apiBase}/public/system/status`);
    return res.data.data.status || SiteAvailabilityStatus.ONLINE;
  } catch {
    return SiteAvailabilityStatus.ONLINE;
  }
}

export async function fetchTagData(tagId: string): Promise<FinderData> {
  const res = await axios.get(`${apiBase}/finder/${tagId}`);
  return res.data.data;
}

export async function fetchFoundTimer(tagId: string): Promise<FoundTimerData> {
  const res = await axios.get(`${apiBase}/finder/${tagId}/found-timer`);
  return res.data.data;
}

export async function notifyOwner(tagId: string, payload: NotifyPayload): Promise<void> {
  await axios.post(`${apiBase}/finder/${tagId}/notify`, payload);
}
