/**
 * @module ProductService
 * @description Product catalog service for PawTag Commerce.
 *
 * Provides CRUD operations, pricing logic, and product queries.
 * All pricing calculations are server-side — never trust client-submitted prices.
 *
 * Pricing priority: salePrice > price. compareAtPrice is display-only.
 *
 * Usage:
 * ```typescript
 * import { ProductService } from '../commerce/services/product.service';
 * const svc = new ProductService();
 * const product = await svc.getBySku('PT-SCAN');
 * const effectivePrice = svc.getEffectivePrice(product);
 * ```
 */

import { Product, type IProductDocument, type IProductVariant } from '@pawtag/db';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/app-errors';
import logger from '../../lib/logger';

/**
 * Product filter options for listing.
 */
export interface ProductFilter {
  /** Search by name, SKU, or description */
  search?: string;

  /** Filter by category */
  category?: string;

  /** Filter by active status */
  isActive?: boolean;

  /** Filter by published status */
  isPublished?: boolean;

  /** Filter by tag product status */
  isTagProduct?: boolean;

  /** Filter by subscription status */
  isSubscription?: boolean;

  /** Filter by stock status: 'in', 'low', 'out' */
  stockStatus?: 'in' | 'low' | 'out';
}

/**
 * Pagination options.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * Paginated result.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Product service for PawTag Commerce.
 *
 * All methods are stateless — they query the database directly.
 * No external API calls are made by this service.
 */
export class ProductService {
  /**
   * Get a product by ID.
   *
   * @param id - MongoDB ObjectId
   * @returns Product document
   * @throws NotFoundError if product doesn't exist
   */
  async getById(id: string): Promise<IProductDocument> {
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  /**
   * Get a product by SKU.
   *
   * @param sku - Stock Keeping Unit (e.g., 'PT-SCAN')
   * @returns Product document
   * @throws NotFoundError if product doesn't exist
   */
  async getBySku(sku: string): Promise<IProductDocument> {
    const product = await Product.findOne({ sku });
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  /**
   * Get a product by slug.
   *
   * @param slug - URL-friendly product identifier
   * @returns Product document
   * @throws NotFoundError NotFoundError if product doesn't exist
   */
  async getBySlug(slug: string): Promise<IProductDocument> {
    const product = await Product.findOne({ slug });
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  /**
   * List products with filtering, sorting, and pagination.
   *
   * @param filter - Filter options
   * @param pagination - Pagination options
   * @returns Paginated product list
   */
  async list(
    filter: ProductFilter = {},
    pagination: PaginationOptions = { page: 1, limit: 20 },
  ): Promise<PaginatedResult<IProductDocument>> {
    const query: Record<string, unknown> = {};

    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { sku: { $regex: filter.search, $options: 'i' } },
        { description: { $regex: filter.search, $options: 'i' } },
      ];
    }
    if (filter.category) query.category = filter.category;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.isPublished !== undefined) query.isPublished = filter.isPublished;
    if (filter.isTagProduct !== undefined) query.isTagProduct = filter.isTagProduct;
    if (filter.isSubscription !== undefined) query.isSubscription = filter.isSubscription;

    if (filter.stockStatus === 'out') {
      query.stock = 0;
    } else if (filter.stockStatus === 'low') {
      query.stock = { $gt: 0, $lte: 10 };
    } else if (filter.stockStatus === 'in') {
      query.stock = { $gt: 10 };
    }

    const sort: Record<string, 1 | -1> = {};
    const dir = pagination.sortDir === 'asc' ? 1 : -1;
    const sortBy = pagination.sortBy || 'createdAt';
    sort[sortBy] = dir;

    const total = await Product.countDocuments(query);
    const items = await Product.find(query)
      .sort(sort)
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  /**
   * List all active, published products for the shop.
   *
   * @returns Active products sorted by sortOrder then name
   */
  async listShopProducts(): Promise<IProductDocument[]> {
    return Product.find({ isActive: true, isPublished: true })
      .sort({ sortOrder: 1, name: 1 });
  }

  /**
   * Create a new product.
   *
   * @param data - Product data (price validated server-side)
   * @returns Created product
   * @throws ValidationError if data is invalid
   * @throws ConflictError if SKU already exists
   */
  async create(data: Partial<IProductDocument>): Promise<IProductDocument> {
    if (!data.name || !data.sku || data.price === undefined) {
      throw new ValidationError('Name, SKU, and price are required');
    }

    const existing = await Product.findOne({ sku: data.sku });
    if (existing) {
      throw new ConflictError(`Product with SKU '${data.sku}' already exists`);
    }

    const product = await Product.create({
      name: data.name,
      description: data.description || '',
      shortDescription: data.shortDescription,
      price: data.price,
      salePrice: data.salePrice,
      compareAtPrice: data.compareAtPrice,
      currency: data.currency || 'NZD',
      images: data.images || [],
      category: data.category || 'general',
      tags: data.tags || [],
      isActive: data.isActive ?? true,
      isPublished: data.isPublished ?? true,
      stock: data.stock || 0,
      reserved: 0,
      lowStockThreshold: data.lowStockThreshold ?? 10,
      stockPolicy: data.stockPolicy || 'deny',
      sku: data.sku,
      weight: data.weight,
      dimensions: data.dimensions,
      variants: data.variants || [],
      customizable: data.customizable ?? false,
      customizationPrice: data.customizationPrice || 0,
      shippingCost: data.shippingCost || 0,
      warrantyMonths: data.warrantyMonths ?? 12,
      isSubscription: data.isSubscription ?? false,
      isTagProduct: data.isTagProduct ?? false,
      subscriptionConfig: data.subscriptionConfig,
      sortOrder: data.sortOrder ?? 0,
      badge: data.badge,
    });

    logger.info({ productId: product._id, sku: product.sku, name: product.name }, 'Product created');
    return product;
  }

  /**
   * Update a product.
   *
   * @param id - Product ID
   * @param data - Fields to update
   * @returns Updated product
   * @throws NotFoundError if product doesn't exist
   */
  async update(id: string, data: Partial<IProductDocument>): Promise<IProductDocument> {
    const product = await this.getById(id);

    // Prevent SKU change to an existing SKU
    if (data.sku && data.sku !== product.sku) {
      const existing = await Product.findOne({ sku: data.sku, _id: { $ne: id } });
      if (existing) {
        throw new ConflictError(`Product with SKU '${data.sku}' already exists`);
      }
    }

    Object.assign(product, data);
    await product.save();

    logger.info({ productId: product._id, sku: product.sku }, 'Product updated');
    return product;
  }

  /**
   * Delete a product (hard delete).
   *
   * @param id - Product ID
   * @throws NotFoundError if product doesn't exist
   */
  async delete(id: string): Promise<void> {
    const product = await this.getById(id);
    await Product.deleteOne({ _id: id });
    logger.info({ productId: id, sku: product.sku }, 'Product deleted');
  }

  /**
   * Get the effective price for a product.
   * Pricing priority: salePrice > price.
   *
   * @param product - Product document
   * @returns Effective price in NZD
   */
  getEffectivePrice(product: IProductDocument): number {
    return product.salePrice ?? product.price;
  }

  /**
   * Get the effective price for a variant.
   * Pricing priority: variant.salePrice > variant.price > product.salePrice > product.price.
   *
   * @param product - Product document
   * @param variant - Variant document
   * @returns Effective price in NZD
   */
  getVariantPrice(product: IProductDocument, variant: IProductVariant): number {
    return variant.salePrice ?? variant.price ?? this.getEffectivePrice(product);
  }

  /**
   * Calculate line total for a product.
   *
   * @param product - Product document
   * @param quantity - Quantity ordered
   * @param customisation - Whether customisation is applied
   * @returns Line total in NZD
   */
  calculateLineTotal(
    product: IProductDocument,
    quantity: number,
    customisation = false,
  ): number {
    const unitPrice = this.getEffectivePrice(product);
    const customisationTotal = customisation ? product.customizationPrice : 0;
    return (unitPrice + customisationTotal) * quantity;
  }

  /**
   * Check if a product is in stock (considering reservations).
   *
   * @param product - Product document
   * @param quantity - Requested quantity
   * @returns Whether the product is available
   */
  isInStock(product: IProductDocument, quantity = 1): boolean {
    if (product.stockPolicy === 'allow') return true;
    const available = product.stock - product.reserved;
    return available >= quantity;
  }

  /**
   * Get available stock (on hand minus reserved).
   *
   * @param product - Product document
   * @returns Available quantity
   */
  getAvailableStock(product: IProductDocument): number {
    return Math.max(0, product.stock - product.reserved);
  }

  /**
   * Get products by IDs (bulk fetch).
   *
   * @param ids - Array of product IDs
   * @returns Map of ID to product
   */
  async getByIds(ids: string[]): Promise<Map<string, IProductDocument>> {
    const products = await Product.find({ _id: { $in: ids } });
    const map = new Map<string, IProductDocument>();
    for (const p of products) {
      map.set(String(p._id), p);
    }
    return map;
  }
}

/** Singleton instance */
export const productService = new ProductService();
