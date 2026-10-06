/**
 * Capacitor platform bridge (Phase 09).
 * Active only inside the Capacitor native shell.
 * All native modules load dynamically so the web TypeScript build does not
 * require Capacitor packages to be installed for browser development.
 * Physical-device proof is Phase 10 — CODED_NOT_RUNTIME_VALIDATED until then.
 */
import { setPlatform, isFinderPublicPath, type PlatformCapabilities } from './capabilities';

async function importNative(path: string): Promise<any> {
  try {
    // Variable path avoids static TS resolution of optional native deps
    const importer = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    return await importer(path);
  } catch {
    return null;
  }
}

function isNativeShell(): boolean {
  try {
    const w = window as any;
    return !!(w?. Capacitor?.isNativePlatform?.() || w?.webkit?.messageHandlers?.capacitor);
  } catch {
    return false;
  }
}

export async function initCapacitorPlatform(): Promise<void> {
  if (typeof window === 'undefined' || !isNativeShell()) {
    return;
  }

  const platform: PlatformCapabilities = {
    kind: 'capacitor',
    async scanTag() {
      const mod = await importNative('@capacitor-community/barcode-scanner');
      if (!mod?.BarcodeScanner) {
        throw new Error('QR scan unavailable. Use manual tag entry.');
      }
      try {
        const result = await mod.BarcodeScanner.scan();
        const text = result?.ScanResult || result?.scanResult || '';
        if (!text) throw new Error('Scan cancelled');
        let tagId = text;
        try {
          const url = new URL(text);
          const parts = url.pathname.split('/').filter(Boolean);
          tagId = parts[parts.length - 1] || text;
        } catch { /* raw tag id */ }
        return { tagId, raw: text, source: 'qr' as const };
      } catch (err: any) {
        throw new Error(err?.message || 'QR scan failed. Use manual tag entry.');
      }
    },
    async scanNfcTag() {
      const mod = await importNative('@capacitor/nfc');
      if (!mod?.NFC) {
        throw new Error('NFC unavailable. Use QR or manual tag entry.');
      }
      try {
        const tag = await mod.NFC.readTag();
        const payload = tag?.ndefMessage?.[0]?.payload as number[] | undefined;
        const uri = Array.isArray(payload) && payload.length
          ? String.fromCharCode(...payload.slice(1).map((n) => Number(n)))
          : '';
        if (!uri) throw new Error('NFC read empty');
        let tagId = uri;
        try {
          const url = new URL(uri);
          const parts = url.pathname.split('/').filter(Boolean);
          tagId = parts[parts.length - 1] || uri;
        } catch { /* raw */ }
        return { tagId, raw: uri, source: 'nfc' as const };
      } catch {
        throw new Error('NFC unavailable. Use QR or manual tag entry.');
      }
    },
    async openExternal(url: string) {
      const mod = await importNative('@capacitor/browser');
      if (mod?.Browser?.open) {
        await mod.Browser.open({ url });
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    secureStorage: {
      async get(key: string) {
        const mod = await importNative('@capacitor/secure-storage');
        if (!mod?.SecureStoragePlugin) return null;
        try {
          const { value } = await mod.SecureStoragePlugin.get({ key });
          return value ?? null;
        } catch {
          return null;
        }
      },
      async set(key: string, value: string) {
        const mod = await importNative('@capacitor/secure-storage');
        if (!mod?.SecureStoragePlugin) return;
        try {
          await mod.SecureStoragePlugin.set({ key, value });
        } catch { /* ignore */ }
      },
      async remove(key: string) {
        const mod = await importNative('@capacitor/secure-storage');
        if (!mod?.SecureStoragePlugin) return;
        try {
          await mod.SecureStoragePlugin.remove({ key });
        } catch { /* ignore */ }
      },
    },
    push: {
      isSupported() { return true; },
      async register() {
        const mod = await importNative('@capacitor/push-notifications');
        if (!mod?.PushNotifications) return null;
        try {
          await mod.PushNotifications.requestPermissions();
          await mod.PushNotifications.register();
          return await new Promise((resolve) => {
            mod.PushNotifications.addListener('registration', (token: any) => {
              resolve({ token: token?.value || '', provider: 'fcm' as const });
            });
            mod.PushNotifications.addListener('registrationFailed', () => resolve(null));
            setTimeout(() => resolve(null), 8000);
          });
        } catch {
          return null;
        }
      },
      async unregister() {
        const mod = await importNative('@capacitor/push-notifications');
        try {
          await mod?.PushNotifications?.removeAllListeners?.();
        } catch { /* ignore */ }
      },
    },
    handleDeepLink(path: string) {
      // Explicit exclusion: Finder public URLs stay in the system browser
      if (isFinderPublicPath(path)) {
        window.location.href = path;
        return;
      }
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
  };

  setPlatform(platform);
}
