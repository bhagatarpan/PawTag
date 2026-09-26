import { createApiClient, API } from '@pawtag/shared/api';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../lib/tokenStorage';
import { Platform } from 'react-native';

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

// Set mobile platform headers for all requests
api.defaults.headers.common['x-client-platform'] = Platform.OS === 'ios' ? 'ios' : 'android';
api.defaults.headers.common['User-Agent'] = `PawTag/1.0.0 (${Platform.OS})`;

export default api;
