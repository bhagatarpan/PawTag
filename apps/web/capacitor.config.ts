import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the PawTag customer app (Phase 09).
 * UI source: apps/web Vite build. This is a thin native shell config —
 * no duplicate product UI.
 */
const config: CapacitorConfig = {
  appId: 'nz.co.pawtag.customer',
  appName: 'PawTag',
  webDir: 'dist',
  bundledWebRuntime: false,
  // Bundle assets locally — do not load only from remote URL
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
