/**
 * Platform capability contract for customer web + future Capacitor shell.
 * Components call semantic operations; they do not import Capacitor plugins.
 */

export type PlatformKind = 'browser' | 'capacitor';

export interface ScannedTagResult {
  /** Normalized tag code or URL path fragment */
  tagId: string;
  raw?: string;
  source: 'qr' | 'nfc' | 'manual';
}

export interface PlatformCapabilities {
  kind: PlatformKind;
  /** Scan a QR/NFC tag. Browser: not available → reject with manual-entry guidance. */
  scanTag(): Promise<ScannedTagResult>;
  /** Scan NFC tag if supported. */
  scanNfcTag(): Promise<ScannedTagResult>;
  /** Open URL outside the app shell when possible. */
  openExternal(url: string): Promise<void>;
  /** Secure native storage (Capacitor). Browser: null / in-memory session only. */
  secureStorage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
  /** Push registration. Browser: unsupported until Web Push configured. */
  push: {
    isSupported(): boolean;
    register(): Promise<{ token: string; provider: 'fcm' | 'web-push' | 'none' } | null>;
    unregister(): Promise<void>;
  };
  /** Deep-link navigation target for notification taps. */
  handleDeepLink(path: string): void;
}

export function createBrowserPlatform(): PlatformCapabilities {
  return {
    kind: 'browser',
    async scanTag() {
      throw new Error('QR scanning requires the installed PawTag app. Use manual tag entry on the web.');
    },
    async scanNfcTag() {
      throw new Error('NFC scanning requires the installed PawTag app. Use QR or manual tag entry.');
    },
    async openExternal(url: string) {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    secureStorage: {
      async get() { return null; },
      async set() { /* browser uses HttpOnly cookies, not JS storage for refresh tokens */ },
      async remove() {},
    },
    push: {
      isSupported() { return false; },
      async register() { return null; },
      async unregister() {},
    },
    handleDeepLink(path: string) {
      if (path.startsWith('/finder')) {
        // Finder URLs must stay in the browser — never hijack into customer app
        window.location.href = path;
        return;
      }
      window.location.href = path;
    },
  };
}

let activePlatform: PlatformCapabilities = createBrowserPlatform();

export function setPlatform(platform: PlatformCapabilities): void {
  activePlatform = platform;
}

export function getPlatform(): PlatformCapabilities {
  return activePlatform;
}

/** Finder public routes must never be claimed by the customer app shell. */
export function isFinderPublicPath(path: string): boolean {
  return path.startsWith('/finder') || path.startsWith('/tag/');
}
