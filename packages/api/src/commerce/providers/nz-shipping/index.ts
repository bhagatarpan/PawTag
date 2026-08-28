/**
 * @module NZ Shipping Provider
 * @description Flat-rate/free shipping provider for New Zealand domestic shipping.
 *
 * PawTag ships physical QR/NFC tags within New Zealand.
 * Shipping is typically free (configured via CMS settings).
 * This provider supports free shipping, flat-rate, and threshold-based shipping.
 *
 * Design principle: PawTag owns the shipping business rules.
 * This provider only calculates rates — it doesn't interface with any courier API.
 * Real courier integration (NZ Post, CourierPost) can be added later via the
 * IShippingProvider interface.
 *
 * @example
 * ```typescript
 * import { nzShippingProvider } from '../providers/nz-shipping';
 * const rates = await nzShippingProvider.getRates({ address, items, subtotal });
 * ```
 */

import type { IShippingProvider, ShippingAddress, ShippingRate, ShipmentResult, TrackingEvent } from '../../interfaces/shipping-provider';
import { getBooleanSetting, getNumberSetting, getSetting } from '../../config';
import logger from '../../../lib/logger';

/**
 * NZ domestic shipping provider for PawTag Commerce.
 *
 * Supports:
 * - Free shipping (default for PawTag)
 * - Flat-rate shipping
 * - Free shipping above a threshold
 */
export class NzShippingProvider implements IShippingProvider {
  readonly id = 'nz-shipping';
  readonly name = 'NZ Domestic Shipping';

  /**
   * Calculate available shipping rates.
   *
   * For PawTag's current needs, there is typically one shipping option:
   * free NZ-wide standard shipping.
   *
   * @param params - Calculation parameters
   * @returns Available shipping rates
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
      // Free shipping — always available or only above threshold
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

    // If no rates configured, add a default free option
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
   * Create a shipment (demo mode — generates mock tracking).
   *
   * In production, this would interface with NZ Post or CourierPost API.
   * For now, it generates a realistic tracking number for testing.
   *
   * @param params - Shipment parameters
   * @returns Shipment result with tracking info
   */
  async createShipment(params: {
    orderId: string;
    orderNumber: string;
    address: ShippingAddress;
    items: Array<{ name: string; quantity: number; weight?: number }>;
    rateId?: string;
  }): Promise<ShipmentResult> {
    // Demo mode: generate a realistic NZ Post tracking number
    const trackingNumber = this.generateTrackingNumber();

    logger.info({
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      trackingNumber,
      city: params.address.city,
    }, 'Shipment created (demo mode)');

    return {
      success: true,
      trackingNumber,
      carrier: 'NZ Post',
      trackingUrl: `https://www.nzpost.co.nz/tools/tracking/${trackingNumber}`,
    };
  }

  /**
   * Retrieve tracking events for a shipment.
   *
   * In production, this would call the carrier's tracking API.
   * For now, returns demo events for testing.
   *
   * @param trackingNumber - Carrier tracking number
   * @returns Tracking events (most recent first)
   */
  async getTrackingEvents(_trackingNumber: string): Promise<TrackingEvent[]> {
    // Demo mode: return mock tracking events
    const now = new Date();
    return [
      {
        timestamp: now,
        status: 'label_created',
        description: 'Shipping label created',
        location: 'Auckland, NZ',
      },
      {
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        status: 'picked_up',
        description: 'Package picked up by carrier',
        location: 'Auckland Distribution Centre',
      },
    ];
  }

  /**
   * Check if the provider is configured.
   * Always returns true — NZ domestic shipping is always available.
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Generate a realistic NZ Post tracking number.
   * Format: 2 letters + 9 digits + 2 letters (e.g., NZ123456789AB)
   */
  private generateTrackingNumber(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < 2; i++) result += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 9; i++) result += digits[Math.floor(Math.random() * digits.length)];
    for (let i = 0; i < 2; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
  }
}

/** Singleton instance */
export const nzShippingProvider = new NzShippingProvider();
