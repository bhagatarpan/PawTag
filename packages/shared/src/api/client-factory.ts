/**
 * @module API Client Factory
 * @description Shared axios client factory that eliminates duplicated token refresh logic.
 *
 * Creates configured axios instances with:
 * - Automatic token injection on requests
 * - 401 response interception with queue-based token refresh
 * - Configurable auth failure behavior per app
 *
 * @example
 * ```typescript
 * import { createApiClient } from '@pawtag/shared/api';
 *
 * export default createApiClient({
 *   baseURL: '/api',
 *   tokenKey: 'pawtag_token',
 *   refreshTokenKey: 'pawtag_refresh_token',
 * });
 * ```
 */

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenStorage {
  /** Synchronously read the access token (localStorage) */
  getAccessToken(): string | null;
  /** Synchronously read the refresh token (localStorage) */
  getRefreshToken(): string | null;
  /** Synchronously write tokens */
  setTokens(accessToken: string, refreshToken: string): void;
  /** Synchronously clear tokens */
  clearTokens(): void;
}

export interface AsyncTokenStorage {
  /** Asynchronously read the access token (SecureStore, AsyncStorage) */
  getAccessToken(): Promise<string | null>;
  /** Asynchronously read the refresh token */
  getRefreshToken(): Promise<string | null>;
  /** Asynchronously write tokens */
  setTokens(accessToken: string, refreshToken: string): Promise<void>;
  /** Asynchronously clear tokens */
  clearTokens(): Promise<void>;
}

/** Type guard to check if storage is async */
function isAsyncStorage(storage: TokenStorage | AsyncTokenStorage): storage is AsyncTokenStorage {
  return typeof (storage as AsyncTokenStorage).getAccessToken === 'function' &&
    (storage as AsyncTokenStorage).getAccessToken.constructor.name === 'AsyncFunction';
}

export interface ApiClientConfig {
  /** Base URL for all requests (e.g., '/api' or 'http://localhost:5000/api') */
  baseURL: string;
  /** Token storage implementation (sync for web, async for mobile) */
  storage: TokenStorage | AsyncTokenStorage;
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
 * Supports both sync (localStorage) and async (SecureStore) token storage.
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

  // Determine if storage is async
  const useAsyncStorage = isAsyncStorage(storage);

  // --- Request interceptor ---
  client.interceptors.request.use(async (cfg: InternalAxiosRequestConfig) => {
    const token = useAsyncStorage
      ? await (storage as AsyncTokenStorage).getAccessToken()
      : (storage as TokenStorage).getAccessToken();
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
        const refreshToken = useAsyncStorage
          ? await (storage as AsyncTokenStorage).getRefreshToken()
          : (storage as TokenStorage).getRefreshToken();

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
          const res = await axios.post(url, { refreshToken });
          const { token: newAccessToken, refreshToken: newRefreshToken } = res.data.data;

          // Store new tokens
          if (useAsyncStorage) {
            await (storage as AsyncTokenStorage).setTokens(newAccessToken, newRefreshToken);
          } else {
            (storage as TokenStorage).setTokens(newAccessToken, newRefreshToken);
          }

          client.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          if (useAsyncStorage) {
            await (storage as AsyncTokenStorage).clearTokens();
          } else {
            (storage as TokenStorage).clearTokens();
          }
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
// Convenience: sync localStorage storage (used by web & admin)
// ---------------------------------------------------------------------------

/**
 * Create a localStorage-based token storage for browser apps.
 */
export function createLocalStorageTokenStorage(
  tokenKey: string,
  refreshTokenKey: string
): TokenStorage {
  return {
    getAccessToken: () => localStorage.getItem(tokenKey),
    getRefreshToken: () => localStorage.getItem(refreshTokenKey),
    setTokens: (accessToken: string, refreshToken: string) => {
      localStorage.setItem(tokenKey, accessToken);
      localStorage.setItem(refreshTokenKey, refreshToken);
    },
    clearTokens: () => {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(refreshTokenKey);
    },
  };
}
