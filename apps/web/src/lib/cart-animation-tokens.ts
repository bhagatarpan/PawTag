// Cart Animation Tokens
// Centralized constants for the add-to-cart micro-interaction system.
// All values should be adjusted here — not scattered across components.

export const CART_ANIM = {
  // Duration (ms)
  duration: {
    fast: 200,      // Button state transitions
    normal: 350,    // Flying image travel
    slow: 500,      // Cart icon confirmation
    badge: 150,     // Badge pop
  },

  // Easing curves (CSS cubic-bezier or string)
  easing: {
    standard: 'cubic-bezier(0.33, 1, 0.68, 1)',    // Smooth deceleration
    overshoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Subtle bounce
    anticipate: 'cubic-bezier(0.5, 0, 0.75, 0)',    // Ease in before out
  },

  // Flying image
  fly: {
    scaleStart: 1,
    scaleMid: 0.4,      // Scale down during travel
    scaleEnd: 0,         // Fade to nothing at destination
    opacityStart: 1,
    opacityEnd: 0,
    rotateEnd: -8,       // Subtle rotation during travel
    arcOffset: -60,      // Vertical arc offset (negative = upward curve)
  },

  // Cart icon confirmation
  cartIcon: {
    scaleNormal: 1,
    scaleBounce: 1.15,
    duration: 300,
  },

  // Badge
  badge: {
    scaleNormal: 1,
    scalePop: 1.3,
    duration: 200,
  },

  // Button states
  button: {
    pressScale: 0.97,
    successHoldMs: 800,
  },

  // Item removal
  remove: {
    collapseDuration: 300,
    fadeDuration: 200,
  },
} as const;

// Reduced motion overrides
export const CART_ANIM_REDUCED = {
  ...CART_ANIM,
  duration: { fast: 0, normal: 0, slow: 0, badge: 0 },
  fly: { ...CART_ANIM.fly, scaleMid: 1, scaleEnd: 1, opacityEnd: 1, rotateEnd: 0, arcOffset: 0 },
  cartIcon: { ...CART_ANIM.cartIcon, duration: 0 },
  badge: { ...CART_ANIM.badge, duration: 0 },
  button: { ...CART_ANIM.button, successHoldMs: 400 },
  remove: { ...CART_ANIM.remove, collapseDuration: 0, fadeDuration: 0 },
} as const;
