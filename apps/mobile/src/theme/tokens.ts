/**
 * PawTag Design Tokens — Mobile
 *
 * Direct translation of DESIGN.md into TypeScript constants.
 * Every mobile screen imports from this file for colors, spacing, typography, etc.
 *
 * DO NOT add values here that aren't in DESIGN.md.
 * DO NOT use Tailwind class names — these are raw values for React Native StyleSheet.
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const colors = {
  primary: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
  },
  white: '#ffffff',
  black: '#000000',
} as const;

// ─── Gradients ───────────────────────────────────────────────────────────────

export const gradients = {
  logoIcon: ['#0d9488', '#0f766e'] as const,
  logoIconDark: ['#2dd4bf', '#14b8a6'] as const,
  heroBanner: ['#0f766e', '#0d9488'] as const,
  imagePlaceholder: ['#f0fdfa', '#ccfbf1'] as const,
  activeSubscription: ['#059669', '#0f766e'] as const,
  gracePeriod: ['#f59e0b', '#ea580c'] as const,
  expiredSubscription: ['#374151', '#111827'] as const,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    regular: 'System',
    mono: 'Courier',
  },
  fontSize: {
    display: 36,
    h1: 30,
    h2: 24,
    h3: 20,
    bodyLg: 18,
    body: 16,
    bodySm: 14,
    caption: 12,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

// ─── Shadows / Elevation ─────────────────────────────────────────────────────

export const shadows = {
  none: {
    shadowOpacity: 0,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  high: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    micro: 150,
    small: 200,
    screen: 300,
    pageLoad: 500,
  },
  easing: {
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeIn: 'cubic-bezier(0.7, 0, 0.84, 0)',
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ─── Component Defaults ──────────────────────────────────────────────────────

export const components = {
  button: {
    height: {
      sm: 36,
      md: 44,
      lg: 52,
    },
    paddingHorizontal: {
      sm: 12,
      md: 16,
      lg: 24,
    },
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
  },
  card: {
    padding: 24,
  },
  avatar: {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  },
} as const;
