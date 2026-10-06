import { describe, it, expect } from 'vitest';
import { createBrowserPlatform, isFinderPublicPath } from '../../apps/web/src/platform/capabilities';

describe('Phase 08 — platform browser fallbacks', () => {
  it('browser scanTag fails closed with manual-entry guidance', async () => {
    const platform = createBrowserPlatform();
    await expect(platform.scanTag()).rejects.toThrow(/manual tag entry/i);
  });

  it('browser push is unsupported (never fake register)', () => {
    const platform = createBrowserPlatform();
    expect(platform.push.isSupported()).toBe(false);
  });

  it('secure storage does not persist refresh tokens in browser JS storage', async () => {
    const platform = createBrowserPlatform();
    await platform.secureStorage.set('pawtag_refresh_token', 'secret');
    expect(await platform.secureStorage.get('pawtag_refresh_token')).toBeNull();
  });

  it('identifies finder public paths for deep-link exclusion', () => {
    expect(isFinderPublicPath('/finder/TAG-1')).toBe(true);
    expect(isFinderPublicPath('/account/orders')).toBe(false);
  });
});
