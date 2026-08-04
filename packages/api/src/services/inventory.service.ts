import { Product } from '@pawtag/db';

/**
 * Restore stock for all items on an order.
 * Call this when an order is cancelled or payment fails.
 */
export async function restoreOrderStock(orderItems: Array<{
  productId: any;
  quantity: number;
  variantName?: string;
}>): Promise<void> {
  for (const item of orderItems) {
    const product = await Product.findById(item.productId);
    if (product) {
      if (item.variantName && product.variants?.length) {
        const variant = product.variants.find((v: any) => v.name === item.variantName);
        if (variant) variant.stock += item.quantity;
      } else {
        product.stock += item.quantity;
      }
      await product.save();
    }
  }
}
