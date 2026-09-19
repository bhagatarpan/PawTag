/**
 * @module @pawtag/design-tokens
 * @description Platform-neutral design tokens for PawTag.
 *
 * This package exports plain TypeScript/JSON-compatible semantic values.
 * It does NOT contain DOM classes or React Native StyleSheet objects.
 *
 * Consumers:
 * - packages/ui / Tailwind preset translates tokens to web
 * - apps/mobile translates tokens to React Native styles
 */

export {
  brandColors,
  semanticColors,
  gradients,
  typography,
  spacing,
  borderRadius,
  elevation,
  motion,
  breakpoints,
  zIndex,
} from './tokens';

// Re-export types
export type {
  BrandColors,
  SemanticColors,
  Gradients,
  Typography,
  Spacing,
  BorderRadius,
  Elevation,
  Motion,
  Breakpoints,
  ZIndex,
} from './tokens';
