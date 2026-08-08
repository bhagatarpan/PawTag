import axios from 'axios';
import { toast } from './toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Derive a human-friendly label from the request URL, e.g. /admin/users/abc → "User".
function labelFromUrl(url: string): string {
  const cleaned = url.split('?')[0].replace(/\/+$/, '');
  const segments = cleaned.split('/').filter(Boolean);
  const words = segments.map((s) => s.replace(/[-_]/g, ' '));
  const meaningful = words.filter((w) => !/^[a-f0-9]{8,}$/i.test(w) && !/^\d+$/.test(w));
  const raw = meaningful.pop() || 'item';
  // For dotted setting keys like "site.businessHours", use the leaf ("Business hours").
  const leaf = raw.split('.').pop() || raw;
  const label = leaf.replace(/([A-Z])/g, ' $1').trim();
  return label
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

let lastToastKey = '';
let lastToastAt = 0;

// Fire a success toast after any create/update/delete so every save gives feedback.
// Pages can override via the request config: toastSuccess (custom message) or
// toastSilent: true (suppress for non-mutation calls like uploads).
api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || '').toLowerCase();
    const cfg = response.config as any;
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(method);
    const url = response.config.url || '';
    // Auth/session endpoints aren't CRUD — don't toast them (login, token refresh, etc).
    const isAuth = /\/auth\//.test(url);

    if (isMutation && !cfg.toastSilent && !cfg.toastSuccess && !isAuth) {
      const now = Date.now();
      const label = labelFromUrl(response.config.url || '');
      const message =
        method === 'delete'
          ? `${label} deleted`
          : method === 'post'
            ? `${label} created`
            : `${label} updated`;

      const key = `${method}:${url}`;
      if (key !== lastToastKey || now - lastToastAt > 1200) {
        toast.success(message);
        lastToastKey = key;
        lastToastAt = now;
      }
    } else if (isMutation && typeof cfg.toastSuccess === 'string') {
      toast.success(cfg.toastSuccess);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    } else {
      const method = (error.config?.method || '').toLowerCase();
      const cfg = error.config as any;
      const isMutation = ['post', 'put', 'patch', 'delete'].includes(method);
      const isAuth = /\/auth\//.test(error.config?.url || '');
      // Surface mutation failures too, unless the page opted out.
      if (isMutation && !cfg.toastSilent && !isAuth) {
        const fallback = `${labelFromUrl(error.config?.url || '')} could not be saved`;
        const detail = error.response?.data?.error || error.message || fallback;
        toast.error(detail);
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
