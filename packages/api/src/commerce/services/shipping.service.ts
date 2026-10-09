/**
 * @module Shipping Service
 * @description PawTag-native shipping service.
 *
 * Reads shipping methods from the ShippingMethod MongoDB model.
 * Falls back to the NZ shipping provider if no methods are configured.
 *
 * Usage:
 * ```typescript
 * import { shippingService } from '../commerce/services/shipping.service';
 * const rates = await shippingService.getRates(userId, address);
 * await shippingService.selectMethod(userId, 'free-standard', 'Standard NZ Shipping');
 * ```
 */

import mongoose from 'mongoose';
import { Cart, Order, ShippingMethod } from '@pawtag/db';
import { nzShippingProvider } from '../providers/nz-shipping';
import type { ShippingAddress, ShippingRate } from '../interfaces/shipping-provider';
import { ShippingError } from '../errors';
import logger from '../../lib/logger';

/**
 * Shipping service for PawTag Commerce.
 */
export class ShippingService {
  /**
   * Get available shipping rates for a user's cart.
   *
   * Reads from ShippingMethod MongoDB model first.
   * If none are configured, upserts standard fallback methods so returned IDs
   * are always resolvable by selectMethod (never synthetic unresolvable IDs).
   *
   * @param userId - User ID
   * @param address - Shipping address
   * @returns Available shipping rates
   */
  async getRates(_userId: string, _address: ShippingAddress): Promise<ShippingRate[]> {
    // Try to get rates from ShippingMethod model first
    let methods = await ShippingMethod.find({ isActive: true }).sort({ sortOrder: 1 });

    if (methods.length === 0) {
      // Ensure fallback methods exist as real documents with stable IDs
      methods = await this.ensureDefaultShippingMethods();
    }

    // Use configured shipping methods from admin (or ensured defaults)
    return methods.map((m) => ({
      id: String(m._id),
      name: m.name,
      description: m.description,
      cost: m.rate,
      estimatedDays: m.estimatedDays,
      carrier: m.carrier,
    }));
  }

  /**
   * Upsert standard NZ shipping methods when none are configured.
   * Returns active methods so rate IDs are always DB-resolvable.
   */
  private async ensureDefaultShippingMethods(): Promise<Array<any>> {
    const defaults = [
      {
        name: 'Standard NZ Shipping',
        description: 'Standard delivery within New Zealand',
        rate: 0,
        rateType: 'free' as const,
        estimatedDays: '3-5 business days',
        carrier: 'NZ Post',
        isActive: true,
        sortOrder: 1,
      },
      {
        name: 'Express NZ Shipping',
        description: 'Express delivery within New Zealand',
        rate: 9.99,
        rateType: 'flat_rate' as const,
        estimatedDays: '1-2 business days',
        carrier: 'NZ Post',
        isActive: true,
        sortOrder: 2,
      },
    ];

    for (const d of defaults) {
      await ShippingMethod.updateOne(
        { name: d.name },
        { $setOnInsert: d },
        { upsert: true },
      );
    }

    return ShippingMethod.find({ isActive: true }).sort({ sortOrder: 1 });
  }

  /**
   * Select a shipping method and update the cart.
   *
   * Server-authoritative: looks up the cost from the ShippingMethod collection.
   * Never trusts client-submitted cost.
   *
   * @param userId - User ID
   * @param methodId - Shipping method ID (must exist in ShippingMethod collection)
   * @param methodName - Display name
   */
  async selectMethod(
    userId: string,
    methodId: string,
    methodName: string,
  ): Promise<void> {
    const cart = await Cart.findOne({ userId, status: 'active' });
    if (!cart) {
      throw new ShippingError('Cart not found');
    }

    if (!methodId || typeof methodId !== 'string') {
      throw new ShippingError('Shipping method id is required');
    }

    // Server-authoritative: look up the cost from ShippingMethod collection
    let method: any = null;
    if (mongoose.isValidObjectId(methodId)) {
      method = await ShippingMethod.findById(methodId).lean();
    }
    if (!method || !method.isActive) {
      // Resolve legacy/synthetic names by ensuring defaults then matching by name
      await this.ensureDefaultShippingMethods();
      const or: Record<string, unknown>[] = [{ name: methodName || methodId }];
      if (mongoose.isValidObjectId(methodId)) {
        or.push({ _id: methodId });
      }
      method = await ShippingMethod.findOne({
        $or: or,
        isActive: true,
      }).lean();
    }

    if (!method) {
      throw new ShippingError(`Shipping method not found: ${methodId}`);
    }

    cart.shippingMethodId = String(method._id);
    cart.shippingMethodName = method.name || methodName;
    cart.shippingCost = method.rate;
    await cart.save();

    logger.info({ userId, methodId: String(method._id), methodName: method.name, cost: method.rate }, 'Shipping method selected');
  }

  /**
   * Create a shipment for a confirmed order.
   *
   * @param orderId - Order ID
   * @returns Tracking number and carrier info
   */
  async createShipment(orderId: string): Promise<{ trackingNumber: string; carrier: string; trackingUrl?: string }> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ShippingError('Order not found');
    }

    if (order.status !== 'packing' && order.status !== 'paid') {
      throw new ShippingError(`Order cannot be shipped in status: ${order.status}`);
    }

    const result = await nzShippingProvider.createShipment({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      address: {
        line1: order.shippingAddress?.line1 || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        zip: order.shippingAddress?.zip || '',
        country: order.shippingAddress?.country || 'NZ',
      },
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
      })),
    });

    if (!result.success) {
      throw new ShippingError(result.error || 'Failed to create shipment');
    }

    // Update order with tracking info
    order.trackingNumber = result.trackingNumber;
    order.carrier = result.carrier;
    order.isDemoTracking = result.isDemo || false;
    if (result.trackingUrl) {
      order.shippingLabelUrl = result.trackingUrl;
    }
    order.status = 'shipped';
    await order.save();

    // Record activity
    await Order.updateOne(
      { _id: orderId },
      {
        $push: {
          activity: {
            type: 'shipped',
            message: `Shipped via ${result.carrier} — Tracking: ${result.trackingNumber}`,
            timestamp: new Date(),
            actor: 'admin',
            metadata: { trackingNumber: result.trackingNumber, carrier: result.carrier },
          },
        },
      },
    );

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      trackingNumber: result.trackingNumber,
      carrier: result.carrier,
    }, 'Shipment created');

    return {
      trackingNumber: result.trackingNumber || '',
      carrier: result.carrier || 'NZ Post',
      trackingUrl: result.trackingUrl || '',
    };
  }

  /**
   * Get tracking events for an order.
   *
   * @param orderId - Order ID
   * @returns Tracking events
   */
  async getTrackingEvents(orderId: string): Promise<Array<{
    timestamp: Date;
    status: string;
    description: string;
    location?: string;
  }>> {
    const order = await Order.findById(orderId);
    if (!order || !order.trackingNumber) {
      return [];
    }

    return nzShippingProvider.getTrackingEvents(order.trackingNumber);
  }
}

/** Singleton instance */
export const shippingService = new ShippingService();
