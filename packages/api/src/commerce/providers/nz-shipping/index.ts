/**
 * @module NZ Shipping Provider
 * @description NZ Post shipping provider using the real ParcelLabel + ParcelTrack APIs.
 *
 * Supports three modes:
 * 1. Demo (default) — synthetic tracking numbers, clearly marked isDemo.
 * 2. Test (UAT) — real ParcelLabel/ParcelTrack on api.uat.nzpost.co.nz.
 * 3. Live — real ParcelLabel/ParcelTrack on api.nzpost.co.nz.
 *
 * Credentials come from environment variables (NZPOST_CLIENT_ID, NZPOST_CLIENT_SECRET,
 * NZPOST_ACCOUNT_NUMBER, NZPOST_LIVE) — never from the database.
 *
 * NZ Post APIs:
 * - ParcelLabel: POST /parcellabel/v3/labels → consignment_id → tracking_reference
 * - ParcelTrack: GET /parceltrack/v3/parcels?tracking_reference=...
 * - OAuth: https://oauth.nzpost.co.nz/as/token.oauth2 (client-credentials)
 *
 * Production fail-closed: when NODE_ENV=production and credentials are absent,
 * createShipment returns an error instead of fabricating a tracking number.
 */

import type { IShippingProvider, ShippingAddress, ShippingRate, ShipmentResult, TrackingEvent } from '../../interfaces/shipping-provider';
import { getBooleanSetting, getNumberSetting, getSetting } from '../../config';
import logger from '../../../lib/logger';

/** NZ Post API configuration from environment variables */
interface NzPostConfig {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  isLive: boolean;
}

/** ParcelLabel POST /labels response (202 Accepted) */
interface ParcelLabelCreateResponse {
  success: boolean;
  message_id: string;
  consignment_id: string;
  errors?: Array<{ code: number; message: string; details?: string }>;
}

/** ParcelLabel GET /labels/{id} response */
interface ParcelLabelDetailResponse {
  success: boolean;
  consignment_id: string;
  consignment_status: string;
  labels: Array<{
    label_id: string;
    tracking_reference: string;
    label_generation_status: string;
    errors?: Array<{ code: number; message: string }>;
  }>;
  errors?: Array<{ code: number; message: string; details?: string }>;
}

/** ParcelTrack GET /parcels response */
interface ParcelTrackResponse {
  success: boolean;
  results: Array<{
    tracking_reference: string;
    tracking_events?: Array<{
      date_time: string;
      status: string;
      description: string;
      location?: { latitude: number; longitude: number } | string;
    }>;
    errors?: Array<{ code: number; message: string; details?: string }>;
  }>;
}

/** NZ Post OAuth token cache (module-scoped, safe for singleton provider) */
let nzpostToken: string | null = null;
let nzpostTokenExpiry = 0;

/** Poll interval and max attempts for async label generation */
const LABEL_POLL_INTERVAL_MS = 1500;
const LABEL_POLL_MAX_ATTEMPTS = 10;

/**
 * Parse a New Zealand street address into street_number and street.
 * e.g. "42C Tawa Drive" → { streetNumber: "42C", street: "Tawa Drive" }
 *      "151 Victoria Street West" → { streetNumber: "151", street: "Victoria Street West" }
 */
function parseNzStreetAddress(line1: string): { streetNumber: string; street: string } {
  const match = line1.trim().match(/^(\d+[A-Za-z]?)\s+(.+)$/);
  if (match) {
    return { streetNumber: match[1], street: match[2] };
  }
  return { streetNumber: '', street: line1.trim() };
}

/** Format a Date as DD/MM/YY for the NZ Post lodgement_date field */
function formatLodgementDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Map a free-text NZ Post tracking status to a PawTag shipment status */
function mapNzPostStatus(nzPostStatus: string): string {
  const s = nzPostStatus.toLowerCase();
  if (s.includes('deliver') && !s.includes('out for')) return 'delivered';
  if (s.includes('out for delivery')) return 'out_for_delivery';
  if (s.includes('transit') || s.includes('dispatch') || s.includes('inbound') || s.includes('processing')) return 'in_transit';
  if (s.includes('pickup') || s.includes('collected') || s.includes('ready for')) return 'picked_up';
  if (s.includes('label') || s.includes('created') || s.includes('accepted') || s.includes('booked')) return 'label_created';
  if (s.includes('exception') || s.includes('held') || s.includes('undeliverable') || s.includes('failed attempt')) return 'exception';
  if (s.includes('return')) return 'returned';
  if (s.includes('delay') || s.includes('late')) return 'delayed';
  return 'in_transit';
}

/**
 * NZ domestic shipping provider backed by the real NZ Post ParcelLabel/ParcelTrack APIs.
 */
export class NzShippingProvider implements IShippingProvider {
  readonly id = 'nz-shipping';
  readonly name = 'NZ Domestic Shipping';

  /**
   * Read NZ Post configuration from environment variables.
   * Returns null when credentials are absent (demo mode).
   */
  private getConfig(): NzPostConfig | null {
    const clientId = process.env.NZPOST_CLIENT_ID;
    const clientSecret = process.env.NZPOST_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      clientId,
      clientSecret,
      accountNumber: process.env.NZPOST_ACCOUNT_NUMBER || '',
      isLive: process.env.NZPOST_LIVE === 'true',
    };
  }

  /** Resolve the API base URL for the configured mode. */
  private getApiBase(isLive: boolean): string {
    return isLive ? 'https://api.nzpost.co.nz' : 'https://api.uat.nzpost.co.nz';
  }

  /**
   * Get an OAuth 2.0 client-credentials token from NZ Post.
   * Cached until 5 minutes before expiry. Same auth host for UAT and live.
   */
  private async getToken(config: NzPostConfig): Promise<string> {
    const now = Date.now();
    if (nzpostToken && now < nzpostTokenExpiry - 300_000) {
      return nzpostToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch('https://oauth.nzpost.co.nz/as/token.oauth2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`NZ Post OAuth failed (${response.status}): ${text}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    nzpostToken = data.access_token;
    nzpostTokenExpiry = now + (data.expires_in || 86399) * 1000;

    return nzpostToken;
  }

  /** Make an authenticated JSON request to the NZ Post API. */
  private async apiRequest<T>(
    config: NzPostConfig,
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = await this.getToken(config);
    const base = this.getApiBase(config.isLive);

    const response = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`NZ Post API error (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Calculate available shipping rates from CMS-configured rules.
   * (Unchanged — free/flat-rate logic is PawTag-owned, not NZ Post.)
   */
  async getRates(params: {
    address: ShippingAddress;
    items: Array<{ weight?: number; quantity: number }>;
    subtotal: number;
  }): Promise<ShippingRate[]> {
    const rates: ShippingRate[] = [];

    const freeEnabled = await getBooleanSetting('commerce.shipping.freeEnabled');
    const freeThreshold = await getNumberSetting('commerce.shipping.freeThreshold');
    const flatRate = await getNumberSetting('commerce.shipping.flatRate');

    if (freeEnabled) {
      if (freeThreshold === 0 || params.subtotal >= freeThreshold) {
        rates.push({
          id: 'free-standard',
          name: 'Standard NZ Shipping',
          description: 'Free standard shipping within New Zealand',
          cost: 0,
          estimatedDays: '3-5 business days',
          carrier: 'NZ Post',
        });
      }
    }

    if (flatRate > 0 && (!freeEnabled || params.subtotal < freeThreshold)) {
      rates.push({
        id: 'flat-rate',
        name: 'Flat Rate Shipping',
        description: `Flat rate shipping to ${params.address.city || 'NZ'}`,
        cost: flatRate,
        estimatedDays: '3-5 business days',
        carrier: 'NZ Post',
      });
    }

    if (rates.length === 0) {
      rates.push({
        id: 'free-standard',
        name: 'Standard NZ Shipping',
        description: 'Free standard shipping within New Zealand',
        cost: 0,
        estimatedDays: '3-5 business days',
        carrier: 'NZ Post',
      });
    }

    return rates;
  }

  /**
   * Create a shipment and generate a tracking number.
   *
   * - No credentials + production → fail closed (no fabricated tracking).
   * - No credentials + non-production → demo tracking, isDemo=true.
   * - Credentials present → real ParcelLabel API (UAT or live).
   * - Real API error → fail loudly, never fall back to demo.
   */
  async createShipment(params: {
    orderId: string;
    orderNumber: string;
    address: ShippingAddress;
    items: Array<{ name: string; quantity: number; weight?: number }>;
    rateId?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
  }): Promise<ShipmentResult> {
    const config = this.getConfig();
    const isProduction = process.env.NODE_ENV === 'production';

    if (!config) {
      if (isProduction) {
        logger.error({
          orderId: params.orderId,
          orderNumber: params.orderNumber,
        }, 'NZ Post shipment refused: credentials not configured in production');
        return {
          success: false,
          error: 'Shipping provider is not configured in production. Set NZPOST_CLIENT_ID and NZPOST_CLIENT_SECRET.',
        };
      }
      return this.createDemoShipment(params);
    }

    return this.createRealShipment(config, params);
  }

  /** Create a demo shipment with a clearly-labelled synthetic tracking number. */
  private createDemoShipment(params: {
    orderId: string;
    orderNumber: string;
  }): ShipmentResult {
    const trackingNumber = this.generateDemoTrackingNumber();

    logger.info({
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      trackingNumber,
    }, 'Shipment created (demo mode — tracking is synthetic)');

    return {
      success: true,
      trackingNumber,
      carrier: 'NZ Post (Demo)',
      trackingUrl: `https://www.nzpost.co.nz/tools/tracking/${trackingNumber}`,
      isDemo: true,
    };
  }

  /**
   * Create a real shipment via the NZ Post ParcelLabel API.
   *
   * Flow: POST /labels → consignment_id → poll GET /labels/{id} → tracking_reference.
   * No silent fallback: any API error is returned as a failure.
   */
  private async createRealShipment(
    config: NzPostConfig,
    params: {
      orderId: string;
      orderNumber: string;
      address: ShippingAddress;
      items: Array<{ name: string; quantity: number; weight?: number }>;
      recipientName?: string;
      recipientPhone?: string;
      recipientEmail?: string;
    },
  ): Promise<ShipmentResult> {
    try {
      const labelRequest = await this.buildLabelRequest(config, params);

      // Step 1: POST /labels → consignment_id
      const createResp = await this.apiRequest<ParcelLabelCreateResponse>(
        config,
        '/parcellabel/v3/labels',
        { method: 'POST', body: labelRequest },
      );

      if (!createResp.success || !createResp.consignment_id) {
        const errMsg = createResp.errors?.map(e => e.message).join('; ') || 'Label request rejected';
        throw new Error(errMsg);
      }

      const consignmentId = createResp.consignment_id;

      // Step 2: poll GET /labels/{id} until label generation completes
      const detail = await this.pollForLabel(config, consignmentId);

      const label = detail.labels?.[0];
      if (!label?.tracking_reference) {
        throw new Error(`Label generated but no tracking reference returned (consignment ${consignmentId})`);
      }

      const trackingNumber = label.tracking_reference;
      const labelUrl = `${this.getApiBase(config.isLive)}/parcellabel/v3/labels/${consignmentId}?format=PDF`;
      const trackingUrl = `https://www.nzpost.co.nz/tools/tracking/${trackingNumber}`;

      logger.info({
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        consignmentId,
        trackingNumber,
        mode: config.isLive ? 'live' : 'uat',
      }, 'Shipment created via NZ Post ParcelLabel API');

      return {
        success: true,
        trackingNumber,
        carrier: config.isLive ? 'NZ Post' : 'NZ Post (UAT)',
        trackingUrl,
        labelUrl,
        isDemo: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({
        err: message,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
      }, 'NZ Post ParcelLabel API failed — not falling back to demo tracking');

      return {
        success: false,
        error: `NZ Post API failed: ${message}`,
      };
    }
  }

  /** Poll the ParcelLabel detail endpoint until the label is generated (or timeout). */
  private async pollForLabel(config: NzPostConfig, consignmentId: string): Promise<ParcelLabelDetailResponse> {
    for (let attempt = 1; attempt <= LABEL_POLL_MAX_ATTEMPTS; attempt++) {
      const detail = await this.apiRequest<ParcelLabelDetailResponse>(
        config,
        `/parcellabel/v3/labels/${consignmentId}`,
      );

      if (detail.consignment_status === 'Complete' && detail.labels?.[0]?.label_generation_status === 'Complete') {
        return detail;
      }

      // Check for terminal errors on the consignment or label
      const consignmentError = detail.errors?.find(e => e.code >= 400000);
      const labelError = detail.labels?.[0]?.errors?.find(e => e.code >= 400000);
      if (consignmentError || labelError) {
        throw new Error(consignmentError?.details || consignmentError?.message || labelError?.message || 'Label generation failed');
      }

      if (attempt < LABEL_POLL_MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, LABEL_POLL_INTERVAL_MS));
      }
    }

    throw new Error(`Label generation timed out for consignment ${consignmentId} after ${LABEL_POLL_MAX_ATTEMPTS} attempts`);
  }

  /** Build the ParcelLabel POST /labels request body from PawTag order data. */
  private async buildLabelRequest(
    config: NzPostConfig,
    params: {
      orderId: string;
      orderNumber: string;
      address: ShippingAddress;
      items: Array<{ name: string; quantity: number; weight?: number }>;
      recipientName?: string;
      recipientPhone?: string;
      recipientEmail?: string;
    },
  ): Promise<Record<string, unknown>> {
    // From-address (sender/pickup) from commerce settings
    const fromCompany = await getSetting('commerce.shipping.fromCompanyName');
    const fromStreet = await getSetting('commerce.shipping.fromStreet');
    const fromSuburb = await getSetting('commerce.shipping.fromSuburb');
    const fromCity = await getSetting('commerce.shipping.fromCity');
    const fromPostcode = await getSetting('commerce.shipping.fromPostcode');
    const fromPhone = await getSetting('commerce.shipping.fromPhone');
    const fromEmail = await getSetting('commerce.shipping.fromEmail');
    const serviceCode = await getSetting('commerce.shipping.nzpostServiceCode');

    const parsedFrom = parseNzStreetAddress(fromStreet || '1 PawTag Way');
    const parsedTo = parseNzStreetAddress(params.address.line1 || '');

    // Default parcel weight 0.5 kg, dimensions 20x15x5 cm (small tag envelope)
    const totalWeightKg = params.items.reduce(
      (sum, item) => sum + (item.weight ? item.weight / 1000 : 0.5) * item.quantity,
      0,
    );

    const itemDescription = params.items.map(i => `${i.name} x${i.quantity}`).join(', ');

    return {
      carrier: 'COURIERPOST',
      account_number: config.accountNumber,
      lodgement_date: formatLodgementDate(new Date()),
      format: 'PDF',
      sender_reference_1: params.orderNumber,
      job_number: undefined,
      sender_details: {
        name: fromCompany || 'PawTag',
        phone: fromPhone || undefined,
        email: fromEmail || undefined,
        company_name: fromCompany || 'PawTag',
      },
      pickup_address: {
        company_name: fromCompany || 'PawTag',
        street_number: parsedFrom.streetNumber,
        street: parsedFrom.street,
        suburb: fromSuburb || undefined,
        city: fromCity || 'Auckland',
        country_code: 'NZ',
        postcode: fromPostcode || '1010',
      },
      receiver_details: {
        name: params.recipientName || 'Customer',
        phone: params.recipientPhone || params.address.phone || undefined,
        email: params.recipientEmail || undefined,
      },
      delivery_address: {
        is_collection: false,
        street_number: parsedTo.streetNumber,
        street: parsedTo.street,
        suburb: params.address.line2 || undefined,
        city: params.address.city || '',
        country_code: params.address.country?.toUpperCase() || 'NZ',
        postcode: params.address.zip || '',
      },
      parcel_details: [{
        service_code: serviceCode || 'CPOLP',
        return_indicator: 'OUTBOUND',
        description: itemDescription.substring(0, 100) || 'PawTag Order',
        dimensions: {
          length_cm: 20,
          width_cm: 15,
          height_cm: 5,
          weight_kg: Math.max(totalWeightKg, 0.1),
        },
      }],
    };
  }

  /**
   * Retrieve tracking events for a shipment.
   *
   * - No credentials + production → throw (fail closed).
   * - No credentials + non-production → demo events.
   * - Credentials present → real ParcelTrack API. Empty result → empty array (not demo).
   */
  async getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]> {
    const config = this.getConfig();
    const isProduction = process.env.NODE_ENV === 'production';

    if (!config) {
      if (isProduction) {
        throw new Error('Tracking unavailable: NZ Post credentials not configured in production.');
      }
      return this.getDemoTrackingEvents();
    }

    return this.getRealTrackingEvents(config, trackingNumber);
  }

  /** Demo tracking events (label_created + picked_up). */
  private getDemoTrackingEvents(): TrackingEvent[] {
    const now = new Date();
    return [
      {
        timestamp: now,
        status: 'label_created',
        description: 'Shipping label created (demo)',
        location: 'Auckland, NZ',
      },
      {
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        status: 'picked_up',
        description: 'Package picked up by carrier (demo)',
        location: 'Auckland Distribution Centre',
      },
    ];
  }

  /** Fetch real tracking events from the NZ Post ParcelTrack API. */
  private async getRealTrackingEvents(
    config: NzPostConfig,
    trackingNumber: string,
  ): Promise<TrackingEvent[]> {
    const resp = await this.apiRequest<ParcelTrackResponse>(
      config,
      `/parceltrack/v3/parcels?tracking_reference=${encodeURIComponent(trackingNumber)}`,
    );

    const result = resp.results?.[0];
    if (!result?.tracking_events?.length) {
      return [];
    }

    return result.tracking_events.map((event) => {
      let location: string | undefined;
      if (typeof event.location === 'string') {
        location = event.location;
      } else if (event.location && typeof event.location === 'object') {
        location = `${event.location.latitude},${event.location.longitude}`;
      }

      return {
        timestamp: new Date(event.date_time),
        status: mapNzPostStatus(event.status),
        description: event.description,
        location,
      };
    });
  }

  /** Always available — at minimum provides demo mode outside production. */
  isConfigured(): boolean {
    return true;
  }

  /** True when real NZ Post credentials are present in the environment. */
  isRealApiConfigured(): boolean {
    return this.getConfig() !== null;
  }

  /** Generate a synthetic NZ-format tracking number for demo mode. */
  private generateDemoTrackingNumber(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < 2; i++) result += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 9; i++) result += digits[Math.floor(Math.random() * digits.length)];
    result += 'NZ';
    return result;
  }
}

/** Singleton instance */
export const nzShippingProvider = new NzShippingProvider();
