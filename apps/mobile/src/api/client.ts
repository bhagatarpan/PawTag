import { createApiClient, API } from '@pawtag/shared/api';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../lib/tokenStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = createApiClient({
  baseURL: API_BASE_URL,
  storage: {
    getAccessToken,
    getRefreshToken,
    setTokens,
    clearTokens,
  },
  refreshEndpoint: `${API_BASE_URL}/auth/refresh`,
});

export default api;
