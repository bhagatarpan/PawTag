/**
 * Simple analytics event tracking for conversion funnel.
 * In production, this would integrate with Google Analytics, Mixpanel, or similar.
 * For now, it logs events to console and could be extended to send to a backend.
 */

interface AnalyticsEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

class Analytics {
  private enabled: boolean;
  private events: AnalyticsEvent[] = [];

  constructor() {
    this.enabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';
  }

  track(event: AnalyticsEvent) {
    if (!this.enabled) return;

    this.events.push({
      ...event,
      metadata: {
        ...event.metadata,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      },
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', event);
    }

    // In production, send to analytics service
    // this.sendToService(event);
  }

  // Track product view
  trackProductView(productId: string, productName: string, price: number) {
    this.track({
      event: 'product_view',
      category: 'shop',
      action: 'view',
      label: productName,
      value: price,
      metadata: { productId },
    });
  }

  // Track add to cart
  trackAddToCart(productId: string, productName: string, price: number, quantity: number) {
    this.track({
      event: 'add_to_cart',
      category: 'shop',
      action: 'add',
      label: productName,
      value: price * quantity,
      metadata: { productId, quantity },
    });
  }

  // Track checkout initiation
  trackCheckoutStart(cartTotal: number, itemCount: number) {
    this.track({
      event: 'checkout_start',
      category: 'checkout',
      action: 'start',
      value: cartTotal,
      metadata: { itemCount },
    });
  }

  // Track checkout completion
  trackCheckoutComplete(orderTotal: number, orderNumber: string) {
    this.track({
      event: 'checkout_complete',
      category: 'checkout',
      action: 'complete',
      value: orderTotal,
      metadata: { orderNumber },
    });
  }

  // Track Guardian enrollment
  trackGuardianEnroll(tier: string) {
    this.track({
      event: 'guardian_enroll',
      category: 'loyalty',
      action: 'enroll',
      label: tier,
    });
  }

  // Track points earned
  trackPointsEarned(points: number, source: string) {
    this.track({
      event: 'points_earned',
      category: 'loyalty',
      action: 'earn',
      label: source,
      value: points,
    });
  }

  // Track referral
  trackReferral(referrerId: string) {
    this.track({
      event: 'referral',
      category: 'marketing',
      action: 'share',
      metadata: { referrerId },
    });
  }

  // Get all events (for debugging or batch sending)
  getEvents() {
    return this.events;
  }

  // Clear events
  clearEvents() {
    this.events = [];
  }
}

export const analytics = new Analytics();
export default analytics;
