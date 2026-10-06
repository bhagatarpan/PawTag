import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Minimal localStorage polyfill for Node unit tests (no DOM by default)
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
};

// Inject before importing client-factory (it references localStorage at call time)
(globalThis as any).localStorage = localStorageMock;

const { createLocalStorageTokenStorage } = await import('../../packages/shared/src/api/client-factory');

const TOKEN_KEY = 'pawtag_token';
const REFRESH_KEY = 'pawtag_refresh_token';

describe('Phase 01 — Browser token storage contract', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('does not persist refresh tokens in localStorage', async () => {
    const storage = createLocalStorageTokenStorage(TOKEN_KEY, REFRESH_KEY);

    await storage.setTokens('access_abc', 'refresh_secret');

    expect(localStorageMock.getItem(TOKEN_KEY)).toBe('access_abc');
    expect(localStorageMock.getItem(REFRESH_KEY)).toBeNull();
  });

  it('clears any legacy refresh token already in localStorage', async () => {
    localStorageMock.setItem(REFRESH_KEY, 'legacy_refresh');
    const storage = createLocalStorageTokenStorage(TOKEN_KEY, REFRESH_KEY);

    await storage.setTokens('access_abc', 'refresh_secret');

    expect(localStorageMock.getItem(REFRESH_KEY)).toBeNull();
  });

  it('getRefreshToken always returns null for browser storage', async () => {
    localStorageMock.setItem(REFRESH_KEY, 'should_be_ignored');
    const storage = createLocalStorageTokenStorage(TOKEN_KEY, REFRESH_KEY);

    expect(await storage.getRefreshToken()).toBeNull();
  });

  it('clearTokens removes access token and any legacy refresh token', async () => {
    localStorageMock.setItem(TOKEN_KEY, 'access_abc');
    localStorageMock.setItem(REFRESH_KEY, 'legacy');
    const storage = createLocalStorageTokenStorage(TOKEN_KEY, REFRESH_KEY);

    await storage.clearTokens();

    expect(localStorageMock.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorageMock.getItem(REFRESH_KEY)).toBeNull();
  });
});
