/**
 * @module API Client Factory
 * @description Shared axios client factory that eliminates duplicated token refresh logic.
 *
 * Creates configured axios instances with:
 * - Automatic token injection on requests
 * - 401 response interception with queue-based token refresh
 * - Configurable auth failure behavior per app
 *
 * All token storage is unambiguously async. Browser adapters use
 * `Promise.resolve()` wrappers around localStorage for consistency.
 *
 * @example
 * ```typescript
 * import { createApiClient } from '@pawtag/shared/api';
 *
 * export default createApiClient({
 *   baseURL: '/api',
 *   storage: createLocalStorageTokenStorage('token', 'refresh'),
 *   refreshEndpoint: '/api/auth/refresh',
 * });
 * ```
 */

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Unambiguously async token storage interface.
 * All methods return Promises — no inference needed.
 * Browser adapters wrap localStorage with Promise.resolve().
 */
export interface TokenStorage {
  /** Read the access token */
  getAccessToken(): Promise<string | null>;
  /** Read the refresh token */
  getRefreshToken(): Promise<string | null>;
  /** Write tokens */
  setTokens(accessToken: string, refreshToken: string): Promise<void>;
  /** Clear tokens */
  clearTokens(): Promise<void>;
}

export interface ApiClientConfig {
  /** Base URL for all requests (e.g., '/api' or 'http://localhost:5000/api') */
  baseURL: string;
  /** Async token storage implementation */
  storage: TokenStorage;
  /** Full URL for the refresh endpoint (e.g., '/api/auth/refresh' or 'auth/refresh') */
  refreshEndpoint: string;
  /** Absolute refresh URL (when baseURL is relative but refresh needs absolute) */
  absoluteRefreshUrl?: string;
  /** Called when auth fails and cannot be recovered (e.g., redirect to /login) */
  onAuthFailure?: () => void;
  /** Response interceptors applied after the core 401 handler */
  responseInterceptors?: Array<{
    onFulfilled?: (response: any) => any;
    onRejected?: (error: any) => any;
  }>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a configured axios instance with token management.
 *
 * Handles:
 * - Request interceptor: attaches Bearer token
 * - Response interceptor: catches 401, refreshes token, retries request
 * - Queue-based refresh: concurrent 401s share a single refresh call
 *
 * All token storage operations are async for consistency across platforms.
 */
export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const {
    baseURL,
    storage,
    refreshEndpoint,
    absoluteRefreshUrl,
    onAuthFailure,
    responseInterceptors,
  } = config;

  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // Send cookies (including HttpOnly refresh token) with requests
  });

  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];

  const processQueue = (error: any, token: string | null) => {
    failedQueue.forEach((promise) => {
      if (error) {
        promise.reject(error);
      } else {
        promise.resolve(token!);
      }
    });
    failedQueue = [];
  };

  // --- Request interceptor ---
  client.interceptors.request.use(async (cfg: InternalAxiosRequestConfig) => {
    const token = await storage.getAccessToken();
    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
  });

  // --- Response interceptor ---
  client.interceptors.response.use(
    (response: any) => response,
    async (err: any) => {
      const originalRequest = err.config;

      if (err.response?.status === 401 && !originalRequest._retry) {
        // Get refresh token
        const refreshToken = await storage.getRefreshToken();

        if (!refreshToken) {
          onAuthFailure?.();
          return Promise.reject(err);
        }

        // Queue if already refreshing
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return client(originalRequest);
            })
            .catch((error) => Promise.reject(error));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const url = absoluteRefreshUrl || refreshEndpoint;
          // Send refresh token via cookie (withCredentials) for browser clients
          // For mobile/native: send in body if no cookie
          const res = await axios.post(url, refreshToken ? { refreshToken } : {}, { withCredentials: true });
          const { token: newAccessToken, refreshToken: newRefreshToken } = res.data.data;

          // Store new tokens (for mobile/native; browser uses cookie)
          if (newRefreshToken) {
            await storage.setTokens(newAccessToken, newRefreshToken);
          } else {
            // Browser path: only access token in storage, refresh in cookie
            const currentRefresh = await storage.getRefreshToken();
            await storage.setTokens(newAccessToken, currentRefresh || '');
          }

          client.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          await storage.clearTokens();
          onAuthFailure?.();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(err);
    }
  );

  // --- App-specific interceptors ---
  if (responseInterceptors) {
    for (const interceptor of responseInterceptors) {
      if (interceptor.onFulfilled || interceptor.onRejected) {
        client.interceptors.response.use(
          interceptor.onFulfilled ? (response: any) => interceptor.onFulfilled!(response) : undefined,
          interceptor.onRejected ? (error: any) => interceptor.onRejected!(error) : undefined,
        );
      }
    }
  }

  return client;
}

// ---------------------------------------------------------------------------
// Convenience: localStorage-based storage (used by web & admin)
// ---------------------------------------------------------------------------

/**
 * Create a localStorage-based token storage for browser apps.
 * Wraps synchronous localStorage with Promise.resolve() for async consistency.
 */
export function createLocalStorageTokenStorage(
  tokenKey: string,
  refreshTokenKey: string
): TokenStorage {
  return {
    getAccessToken: () => Promise.resolve(localStorage.getItem(tokenKey)),
    getRefreshToken: () => Promise.resolve(localStorage.getItem(refreshTokenKey)),
    setTokens: (accessToken: string, refreshToken: string) => {
      localStorage.setItem(tokenKey, accessToken);
      localStorage.setItem(refreshTokenKey, refreshToken);
      return Promise.resolve();
    },
    clearTokens: () => {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(refreshTokenKey);
      return Promise.resolve();
    },
  };
}
