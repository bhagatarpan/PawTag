export interface ShipmentResult {
  success: boolean;
  trackingNumber?: string;
  labelUrl?: string;
  carrier?: string;
  error?: string;
}

export interface CreateShipmentParams {
  orderNumber: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  items: Array<{
    productName: string;
    quantity: number;
  }>;
}

/**
 * Create a shipment via the configured courier API.
 *
 * Production fail-closed rule:
 * - Missing/placeholder API key must NOT fabricate a tracking number.
 * - Development/test may use deterministic demo data for local CI only.
 *
 * NOTE: Requires SHIPPING_PROVIDER_API_KEY env var for live use.
 * Real courier API (Sendle/NZ Post) is still pending; production with a real
 * key returns an explicit failure until that integration is implemented.
 */
export async function createShipment(_params: CreateShipmentParams): Promise<ShipmentResult> {
  const apiKey = process.env.SHIPPING_PROVIDER_API_KEY;
  const isProduction = process.env.NODE_ENV === 'production';
  const isMissingKey = !apiKey || apiKey === 'demo_key';

  // Production: never invent tracking numbers.
  if (isProduction && isMissingKey) {
    return {
      success: false,
      error: 'Shipping provider is not configured in production. Set SHIPPING_PROVIDER_API_KEY before creating shipments.',
    };
  }

  // Development/test only — demo data for local CI. Not a production success path.
  if (isMissingKey) {
    const trackingNumber = `NZ${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return {
      success: true,
      trackingNumber,
      labelUrl: `https://demo-shipping.pawtag.co.nz/labels/${trackingNumber}.pdf`,
      carrier: 'NZ Post (Demo)',
    };
  }

  // Real API call (Sendle/NZ Post — implement when API key is available)
  try {
    // TODO: Replace with real Sendle/NZ Post API integration
    return {
      success: false,
      error: 'Real courier API integration requires a shipping provider API key. Set SHIPPING_PROVIDER_API_KEY in your environment.',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Shipment creation failed',
    };
  }
}
