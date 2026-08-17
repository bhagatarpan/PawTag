import axios from 'axios';
import type { FinderData, FoundTimerData, NotifyPayload } from '../types';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export async function fetchSiteStatus(): Promise<string> {
  try {
    const res = await axios.get(`${apiBase}/public/system/status`);
    return res.data.data.status;
  } catch {
    return 'ONLINE';
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
