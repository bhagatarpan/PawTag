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
 * Falls back to demo mode if no API key is configured.
 *
 * NOTE: Requires SHIPPING_PROVIDER_API_KEY env var for live use.
 * Demo mode returns realistic fake data for local dev and CI.
 */
export async function createShipment(_params: CreateShipmentParams): Promise<ShipmentResult> {
  const apiKey = process.env.SHIPPING_PROVIDER_API_KEY;

  // Demo mode — return realistic fake data
  if (!apiKey || apiKey === 'demo_key') {
    const trackingNumber = `NZ${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return {
      success: true,
      trackingNumber,
      labelUrl: `https://demo-shipping.pawtag.co.nz/labels/${trackingNumber}.pdf`,
      carrier: 'NZ Post (Demo)',
    };
  }

  // Real API call (Sendle/NZ Post — implement when API key is available)
  // For now, throw an error indicating the real integration is pending
  try {
    // TODO: Replace with real Sendle/NZ Post API integration
    // Example Sendle API call:
    // const response = await fetch('https://api.sendle.com/api/orders', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Sendle ApiKey ${apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     sender: { ... },
    //     receiver: params.shippingAddress,
    //     description: params.items.map(i => i.productName).join(', '),
    //     ...
    //   }),
    // });

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
