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
 * await shippingService.selectMethod(userId, 'free-standard', 'Standard NZ Shipping', 0);
 * ```
 */

import { Cart, Order, ShippingMethod, type ICartDocument } from '@pawtag/db';
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
   * Falls back to NZ shipping provider if no methods configured.
   *
   * @param userId - User ID
   * @param address - Shipping address
   * @returns Available shipping rates
   */
  async getRates(_userId: string, address: ShippingAddress): Promise<ShippingRate[]> {
    // Try to get rates from ShippingMethod model first
    const methods = await ShippingMethod.find({ isActive: true }).sort({ sortOrder: 1 });

    if (methods.length > 0) {
      // Use configured shipping methods from admin
      return methods.map((m) => ({
        id: String(m._id),
        name: m.name,
        description: m.description,
        cost: m.rate,
        estimatedDays: m.estimatedDays,
        carrier: m.carrier,
      }));
    }

    // Fallback to NZ shipping provider (hardcoded free shipping)
    const rates = await nzShippingProvider.getRates({
      address,
      items: [],
      subtotal: 0,
    });

    return rates;
  }

  /**
   * Select a shipping method and update the cart.
   *
   * @param userId - User ID
   * @param methodId - Shipping method ID
   * @param methodName - Display name
   * @param cost - Shipping cost
   */
  async selectMethod(
    userId: string,
    methodId: string,
    methodName: string,
    cost: number,
  ): Promise<void> {
    const cart = await Cart.findOne({ userId, status: 'active' });
    if (!cart) {
      throw new ShippingError('Cart not found');
    }

    cart.shippingMethodId = methodId;
    cart.shippingMethodName = methodName;
    cart.shippingCost = cost;
    await cart.save();

    logger.info({ userId, methodId, methodName, cost }, 'Shipping method selected');
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
