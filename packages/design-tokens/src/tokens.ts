/**
 * @module PawTag Design Tokens
 * @description Platform-neutral design tokens for PawTag.
 *
 * These tokens are the single source of truth for design values.
 * Web consumes via Tailwind preset, mobile consumes directly.
 *
 * DO NOT add DOM classes or React Native StyleSheet objects here.
 * DO NOT add platform-specific values here.
 */

// ─── Brand Colors ──────────────────────────────────────────────────────────

export const brandColors = {
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
} as const;

// ─── Semantic Colors ───────────────────────────────────────────────────────

export const semanticColors = {
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

// ─── Gradients ─────────────────────────────────────────────────────────────

export const gradients = {
  logoIcon: ['#0d9488', '#0f766e'] as const,
  logoIconDark: ['#2dd4bf', '#14b8a6'] as const,
  heroBanner: ['#0f766e', '#0d9488'] as const,
  imagePlaceholder: ['#f0fdfa', '#ccfbf1'] as const,
  activeSubscription: ['#059669', '#0f766e'] as const,
  gracePeriod: ['#f59e0b', '#ea580c'] as const,
  expiredSubscription: ['#374151', '#111827'] as const,
} as const;

// ─── Typography ────────────────────────────────────────────────────────────

export const typography = {
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
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;

// ─── Spacing ───────────────────────────────────────────────────────────────

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

// ─── Border Radius ─────────────────────────────────────────────────────────

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

// ─── Elevation / Shadows ───────────────────────────────────────────────────

export const elevation = {
  none: 0,
  subtle: 1,
  medium: 3,
  elevated: 5,
  high: 8,
} as const;

// ─── Motion ────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    micro: 150,
    small: 200,
    screen: 300,
    pageLoad: 500,
  },
  easing: {
    easeOut: [0.16, 1, 0.3, 1],
    easeIn: [0.7, 0, 0.84, 0],
    easeInOut: [0.65, 0, 0.35, 1],
    spring: [0.34, 1.56, 0.64, 1],
  },
} as const;

// ─── Breakpoints (documentation/web tokens) ────────────────────────────────

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ─── Z-Index ───────────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1600,
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────

export type BrandColors = typeof brandColors;
export type SemanticColors = typeof semanticColors;
export type Gradients = typeof gradients;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Elevation = typeof elevation;
export type Motion = typeof motion;
export type Breakpoints = typeof breakpoints;
export type ZIndex = typeof zIndex;
