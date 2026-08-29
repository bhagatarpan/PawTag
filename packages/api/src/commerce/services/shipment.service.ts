/**
 * @module Shipment Service
 * @description Service for managing shipments, labels, and carrier tracking.
 *
 * This service extends the basic ShippingService by providing:
 * - Shipment record management (create, update, list)
 * - Real-time carrier tracking via provider APIs
 * - Shipping label generation
 * - Tracking event history
 *
 * Usage:
 * ```typescript
 * import { shipmentService } from '../commerce/services/shipment.service';
 * const shipment = await shipmentService.createShipment({ orderId, items });
 * const events = await shipmentService.getTrackingEvents(shipment._id);
 * ```
 */

import { Shipment, Order, type IShipmentDocument, type ShipmentStatus } from '@pawtag/db';
import { nzShippingProvider } from '../providers/nz-shipping';
import type { ShippingAddress, TrackingEvent } from '../interfaces/shipping-provider';
import { ShippingError } from '../errors';
import logger from '../../lib/logger';

/** Parameters for creating a shipment */
export interface CreateShipmentParams {
  orderId: string;
  fulfilmentId?: string;
  carrier?: string;
  notes?: string;
}

/** Shipment with tracking events */
export interface ShipmentWithTracking extends IShipmentDocument {
  trackingEvents: TrackingEvent[];
}

/**
 * Service for managing shipments and carrier tracking.
 */
export class ShipmentService {
  /**
   * Create a shipment record and generate a tracking number.
   *
   * Creates a Shipment document and calls the carrier API (or demo mode)
   * to generate a tracking number and optional shipping label.
   *
   * @param params - Shipment parameters
   * @returns Created shipment document
   */
  async createShipment(params: CreateShipmentParams): Promise<IShipmentDocument> {
    const order = await Order.findById(params.orderId);
    if (!order) {
      throw new ShippingError('Order not found');
    }

    if (order.status !== 'packing' && order.status !== 'paid') {
      throw new ShippingError(`Order cannot be shipped in status: ${order.status}. Order must be paid and ready for packing.`);
    }

    const address: ShippingAddress = {
      line1: order.shippingAddress?.line1 || '',
      line2: order.shippingAddress?.line2,
      city: order.shippingAddress?.city || '',
      state: order.shippingAddress?.state || '',
      zip: order.shippingAddress?.zip || '',
      country: order.shippingAddress?.country || 'NZ',
    };

    // Call carrier API to create shipment and get tracking number
    const carrierResult = await nzShippingProvider.createShipment({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      address,
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
      })),
    });

    if (!carrierResult.success) {
      throw new ShippingError(carrierResult.error || 'Failed to create shipment with carrier');
    }

    // Create shipment record in MongoDB
    const shipment = await Shipment.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      fulfilmentId: params.fulfilmentId || undefined,
      carrier: carrierResult.carrier || params.carrier || 'NZ Post',
      trackingNumber: carrierResult.trackingNumber || '',
      trackingUrl: carrierResult.trackingUrl,
      labelUrl: carrierResult.labelUrl,
      status: 'label_created',
      shippingAddress: address,
      items: order.items.map((item) => ({
        orderItemId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      })),
      shippedAt: new Date(),
      notes: params.notes,
    });

    // Update order with tracking info
    order.trackingNumber = carrierResult.trackingNumber;
    order.carrier = carrierResult.carrier || 'NZ Post';
    if (carrierResult.trackingUrl) {
      order.shippingLabelUrl = carrierResult.trackingUrl;
    }
    order.status = 'shipped';
    await order.save();

    // Add activity entry
    await Order.updateOne(
      { _id: params.orderId },
      {
        $push: {
          activity: {
            type: 'shipped',
            message: `Shipped via ${carrierResult.carrier || 'NZ Post'} — Tracking: ${carrierResult.trackingNumber}`,
            timestamp: new Date(),
            actor: 'admin',
            metadata: {
              trackingNumber: carrierResult.trackingNumber,
              carrier: carrierResult.carrier,
              shipmentId: String(shipment._id),
            },
          },
        },
      },
    );

    logger.info({
      orderId: params.orderId,
      orderNumber: order.orderNumber,
      shipmentId: String(shipment._id),
      trackingNumber: carrierResult.trackingNumber,
      carrier: carrierResult.carrier,
    }, 'Shipment created');

    return shipment;
  }

  /**
   * Get a shipment by ID with populated order info.
   */
  async getShipment(shipmentId: string): Promise<IShipmentDocument | null> {
    return Shipment.findById(shipmentId)
      .populate('orderId', 'orderNumber status shippingAddress')
      .populate('fulfilmentId', 'status');
  }

  /**
   * Get shipment by order ID.
   */
  async getShipmentByOrder(orderId: string): Promise<IShipmentDocument | null> {
    return Shipment.findOne({ orderId }).sort({ createdAt: -1 });
  }

  /**
   * Get all shipments with pagination and filtering.
   */
  async listShipments(params: {
    page?: number;
    limit?: number;
    status?: ShipmentStatus;
    carrier?: string;
    search?: string;
  }): Promise<{
    items: IShipmentDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, status, carrier, search } = params;

    const query: Record<string, any> = {};
    if (status) query.status = status;
    if (carrier) query.carrier = carrier;
    if (search) {
      query.$or = [
        { trackingNumber: { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Shipment.countDocuments(query);
    const items = await Shipment.find(query)
      .populate('orderId', 'orderNumber status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get tracking events for a shipment, fetching from the carrier API.
   *
   * @param shipmentId - Shipment ID
   * @returns Tracking events (most recent first)
   */
  async getTrackingEvents(shipmentId: string): Promise<TrackingEvent[]> {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      throw new ShippingError('Shipment not found');
    }

    const events = await nzShippingProvider.getTrackingEvents(shipment.trackingNumber);

    // Update shipment's tracking events cache
    if (events.length > 0) {
      shipment.trackingEvents = events.map((e) => ({
        timestamp: e.timestamp,
        status: e.status,
        description: e.description,
        location: e.location,
      }));

      // Update shipment status based on latest tracking event
      const latestStatus = this.mapTrackingToShipmentStatus(events[0].status);
      if (latestStatus !== shipment.status) {
        shipment.status = latestStatus;

        if (latestStatus === 'delivered') {
          shipment.deliveredAt = events[0].timestamp;
          // Also update order status
          await Order.updateOne(
            { _id: shipment.orderId },
            {
              $set: { status: 'delivered', deliveredAt: events[0].timestamp },
              $push: {
                activity: {
                  type: 'delivered',
                  message: `Delivered — ${events[0].description}`,
                  timestamp: events[0].timestamp,
                  actor: 'system',
                  metadata: { shipmentId: String(shipment._id) },
                },
              },
            },
          );
        }
      }

      await shipment.save();
    }

    return events;
  }

  /**
   * Update shipment status manually (admin action).
   */
  async updateStatus(
    shipmentId: string,
    status: ShipmentStatus,
    notes?: string,
  ): Promise<IShipmentDocument> {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      throw new ShippingError('Shipment not found');
    }

    const update: Record<string, any> = { status };
    if (notes) update.notes = notes;
    if (status === 'delivered') {
      update.deliveredAt = new Date();
      // Update order
      await Order.updateOne(
        { _id: shipment.orderId },
        {
          $set: { status: 'delivered', deliveredAt: new Date() },
          $push: {
            activity: {
              type: 'delivered',
              message: `Marked as delivered${notes ? ` — ${notes}` : ''}`,
              timestamp: new Date(),
              actor: 'admin',
              metadata: { shipmentId: String(shipment._id) },
            },
          },
        },
      );
    }

    const updated = await Shipment.findByIdAndUpdate(shipmentId, update, { new: true });
    if (!updated) {
      throw new ShippingError('Shipment not found');
    }

    logger.info({ shipmentId, status, notes }, 'Shipment status updated');
    return updated;
  }

  /**
   * Poll all active shipments for tracking updates.
   * Called by the background tracking job.
   */
  async pollTrackingUpdates(): Promise<{ updated: number; errors: number }> {
    // Only poll shipments that are in transit (not delivered, not failed)
    const activeStatuses: ShipmentStatus[] = [
      'label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delayed',
    ];

    const shipments = await Shipment.find({
      status: { $in: activeStatuses },
    });

    let updated = 0;
    let errors = 0;

    for (const shipment of shipments) {
      try {
        const events = await nzShippingProvider.getTrackingEvents(shipment.trackingNumber);

        if (events.length > 0) {
          const latestStatus = this.mapTrackingToShipmentStatus(events[0].status);

          if (latestStatus !== shipment.status) {
            shipment.status = latestStatus;
            shipment.trackingEvents = events.map((e) => ({
              timestamp: e.timestamp,
              status: e.status,
              description: e.description,
              location: e.location,
            }));

            if (latestStatus === 'delivered') {
              shipment.deliveredAt = events[0].timestamp;
              await Order.updateOne(
                { _id: shipment.orderId },
                {
                  $set: { status: 'delivered', deliveredAt: events[0].timestamp },
                  $push: {
                    activity: {
                      type: 'delivered',
                      message: `Delivered — ${events[0].description}`,
                      timestamp: events[0].timestamp,
                      actor: 'system',
                      metadata: { shipmentId: String(shipment._id) },
                    },
                  },
                },
              );
            }

            await shipment.save();
            updated++;
          }
        }
      } catch (err) {
        logger.warn({
          err,
          shipmentId: String(shipment._id),
          trackingNumber: shipment.trackingNumber,
        }, 'Failed to poll tracking for shipment');
        errors++;
      }
    }

    if (updated > 0 || errors > 0) {
      logger.info({ updated, errors, total: shipments.length }, 'Tracking poll completed');
    }

    return { updated, errors };
  }

  /**
   * Map carrier tracking status to our shipment status.
   */
  private mapTrackingToShipmentStatus(carrierStatus: string): ShipmentStatus {
    const status = carrierStatus.toLowerCase();
    if (status === 'delivered') return 'delivered';
    if (status === 'out_for_delivery') return 'out_for_delivery';
    if (status === 'in_transit') return 'in_transit';
    if (status === 'picked_up') return 'picked_up';
    if (status === 'label_created') return 'label_created';
    if (status === 'returned') return 'returned';
    if (status === 'exception') return 'exception';
    if (status === 'failed') return 'failed';
    if (status === 'delayed') return 'delayed';
    return 'in_transit';
  }
}

/** Singleton instance */
export const shipmentService = new ShipmentService();
