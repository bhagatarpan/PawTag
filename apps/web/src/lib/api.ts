import { createApiClient, createLocalStorageTokenStorage } from '@pawtag/shared/api';

const api = createApiClient({
  baseURL: '/api',
  storage: createLocalStorageTokenStorage('pawtag_token', 'pawtag_refresh_token'),
  refreshEndpoint: '/api/auth/refresh',
  // Web app: don't redirect on auth failure — let CartContext/AuthContext handle it
  // to avoid race conditions with concurrent requests.
});

export default api;
