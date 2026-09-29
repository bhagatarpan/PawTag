import { createApiClient, createLocalStorageTokenStorage } from '@pawtag/shared/api';

const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  storage: createLocalStorageTokenStorage('pawtag_token', 'pawtag_refresh_token'),
  refreshEndpoint: '/api/auth/refresh',
  onAuthFailure: () => {
    // Store a flag so the login page can show a friendly message
    localStorage.setItem('pawtag_session_expired', '1');
  },
});

export default api;
