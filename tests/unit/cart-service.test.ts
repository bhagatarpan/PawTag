import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  cartFindOne: vi.fn(),
  cartCreate: vi.fn(),
  cartSave: vi.fn(),
  cartDeleteOne: vi.fn(),
  productFindById: vi.fn(),
  productFind: vi.fn(),
  productFindLean: vi.fn(),
  inventoryCanFulfill: vi.fn(),
  getNumberSetting: vi.fn(),
  getBooleanSetting: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../packages/api/src/commerce/config', () => ({
  getNumberSetting: mocks.getNumberSetting,
  getBooleanSetting: mocks.getBooleanSetting,
  getSetting: vi.fn().mockResolvedValue(''),
}));

vi.mock('@pawtag/db', () => {
  const findChain = {
    lean: vi.fn().mockResolvedValue([]),
  };
  mocks.productFind.mockReturnValue(findChain);

  return {
    Cart: {
      findOne: mocks.cartFindOne,
      create: mocks.cartCreate,
      deleteOne: mocks.cartDeleteOne,
    },
    Product: {
      findById: mocks.productFindById,
      find: mocks.productFind,
    },
  };
});

vi.mock('../../packages/api/src/commerce/services/inventory.service', () => ({
  inventoryService: {
    canFulfill: mocks.inventoryCanFulfill,
  },
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: mocks.logger,
}));

vi.mock('../../packages/api/src/commerce/providers/simple-gst', () => ({
  nzGstProvider: {
    getRate: vi.fn().mockResolvedValue(0.15),
    isInclusive: vi.fn().mockResolvedValue(true),
  },
}));

import { CartService } from '../../packages/api/src/commerce/services/cart.service';

describe('CartService', () => {
  let cartService: CartService;

  beforeEach(() => {
    vi.clearAllMocks();
    cartService = new CartService();
    mocks.getNumberSetting.mockImplementation((key: string) => {
      const defaults: Record<string, string> = {
        'commerce.cart.ttlDays': '30',
        'commerce.cart.maxItems': '50',
        'commerce.cart.priceRevalidation': 'true',
      };
      return Promise.resolve(defaults[key] || '0');
    });
  });

  describe('addItem - customisation comparison', () => {
    it('should treat undefined and false customisation as the same', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [
          {
            _id: 'item1',
            productId: { toString: () => 'prod1' },
            productName: 'Test Product',
            sku: 'TEST-001',
            unitPrice: 19.99,
            customizationTotal: 0,
            quantity: 1,
            customisation: false,
            addedAt: new Date(),
          },
        ],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prod1',
        name: 'Test Product',
        isActive: true,
        price: 19.99,
        salePrice: null,
        sku: 'TEST-001',
        stock: 100,
        reserved: 0,
        customizationPrice: 0,
        images: ['test.jpg'],
      });
      mocks.inventoryCanFulfill.mockResolvedValue(true);

      // Add item WITHOUT customisation (undefined)
      await cartService.addItem('user1', { productId: 'prod1', quantity: 1 });

      // Should increment quantity, not create duplicate
      expect(mockCart.items.length).toBe(1);
      expect(mockCart.items[0].quantity).toBe(2);
    });

    it('treats customisation requested with no saved name as no customisation (merges)', async () => {
      // Product rule: an engraving charge exists only with at least one
      // saved name — customisation:true + blank texts must not create a
      // charged line.
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [
          {
            _id: 'item1',
            productId: { toString: () => 'prod1' },
            productName: 'Test Product',
            sku: 'TEST-001',
            unitPrice: 19.99,
            customizationTotal: 0,
            quantity: 1,
            customisation: false,
            addedAt: new Date(),
          },
        ],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prod1',
        name: 'Test Product',
        isActive: true,
        price: 19.99,
        salePrice: null,
        sku: 'TEST-001',
        stock: 100,
        reserved: 0,
        customizationPrice: 5.0,
        images: ['test.jpg'],
      });
      mocks.inventoryCanFulfill.mockResolvedValue(true);

      // Add with customisation requested but NO name saved
      await cartService.addItem('user1', {
        productId: 'prod1',
        quantity: 1,
        customisation: true,
        customisationTexts: ['   ', ''],
      });

      // Merges with the non-customised line — no charged engraving line
      expect(mockCart.items.length).toBe(1);
      expect(mockCart.items[0].quantity).toBe(2);
      expect(mockCart.items[0].customizationTotal).toBe(0);
    });

    it('creates a separate charged line when customisation includes a saved name', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [
          {
            _id: 'item1',
            productId: { toString: () => 'prod1' },
            productName: 'Test Product',
            sku: 'TEST-001',
            unitPrice: 19.99,
            customizationTotal: 0,
            quantity: 1,
            customisation: false,
            addedAt: new Date(),
          },
        ],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prod1',
        name: 'Test Product',
        isActive: true,
        price: 19.99,
        salePrice: null,
        sku: 'TEST-001',
        stock: 100,
        reserved: 0,
        customizationPrice: 5.0,
        images: ['test.jpg'],
      });
      mocks.inventoryCanFulfill.mockResolvedValue(true);

      // Add WITH customisation and a saved name
      await cartService.addItem('user1', {
        productId: 'prod1',
        quantity: 1,
        customisation: true,
        customisationTexts: ['coco'],
      });

      // Should create a new item (customised vs non-customised) with the charge
      expect(mockCart.items.length).toBe(2);
      const customised = mockCart.items.find((i: any) => i.customisation === true);
      expect(customised.customizationTotal).toBe(5.0);
      expect(customised.customisationTexts).toEqual(['coco']);
    });

    it('should increment quantity when adding same customisation=true item', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [
          {
            _id: 'item1',
            productId: { toString: () => 'prod1' },
            productName: 'Test Product',
            sku: 'TEST-001',
            unitPrice: 19.99,
            customizationTotal: 5.0,
            quantity: 1,
            customisation: true,
            addedAt: new Date(),
          },
        ],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prod1',
        name: 'Test Product',
        isActive: true,
        price: 19.99,
        salePrice: null,
        sku: 'TEST-001',
        stock: 100,
        reserved: 0,
        customizationPrice: 5.0,
        images: ['test.jpg'],
      });
      mocks.inventoryCanFulfill.mockResolvedValue(true);

      // Add item WITH customisation and a saved name — same as existing
      await cartService.addItem('user1', { productId: 'prod1', quantity: 1, customisation: true, customisationTexts: ['bella'] });

      // Should increment, not duplicate
      expect(mockCart.items.length).toBe(1);
      expect(mockCart.items[0].quantity).toBe(2);
    });
  });

  describe('updateItem - engraving charge requires a saved name', () => {
    function cartWithItem(item: Record<string, any>) {
      const items: any[] = [item as any];
      (items as any).id = (id: string) => items.find((i) => String(i._id) === String(id)) || null;
      (items as any).pull = (i: any) => {
        const idx = items.indexOf(i);
        if (idx >= 0) items.splice(idx, 1);
      };
      return {
        _id: 'cart1',
        userId: 'user1',
        items,
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };
    }

    const product = {
      _id: 'prod1',
      name: 'Test Product',
      isActive: true,
      price: 39.99,
      salePrice: null,
      sku: 'PLUS-001',
      stock: 100,
      reserved: 0,
      customizationPrice: 19.0,
      images: [],
    };

    it('coerces enable without any saved name to off — no invisible charge', async () => {
      const cart = cartWithItem({
        _id: 'item1',
        productId: 'prod1',
        productName: 'PawTag Plus',
        unitPrice: 39.99,
        customizationTotal: 0,
        quantity: 1,
        customisation: false,
        customisationTexts: [],
      });
      mocks.cartFindOne.mockResolvedValue(cart);
      mocks.productFindById.mockResolvedValue(product);

      await cartService.updateItem('user1', { itemId: 'item1', customisation: true });

      expect(cart.items[0].customisation).toBe(false);
      expect(cart.items[0].customizationTotal).toBe(0);
    });

    it('applies names + charge together on a combined save (the cart Save button)', async () => {
      const cart = cartWithItem({
        _id: 'item1',
        productId: 'prod1',
        productName: 'PawTag Plus',
        unitPrice: 39.99,
        customizationTotal: 0,
        quantity: 1,
        customisation: false,
        customisationTexts: [],
      });
      mocks.cartFindOne.mockResolvedValue(cart);
      mocks.productFindById.mockResolvedValue(product);

      await cartService.updateItem('user1', {
        itemId: 'item1',
        customisation: true,
        customisationTexts: ['  coco ', '', 'jumbo'],
      });

      expect(cart.items[0].customisation).toBe(true);
      expect(cart.items[0].customizationTotal).toBe(19.0);
      // Trimmed + blanks dropped
      expect(cart.items[0].customisationTexts).toEqual(['coco', 'jumbo']);
    });

    it('removes the charge when all saved names are blanked', async () => {
      const cart = cartWithItem({
        _id: 'item1',
        productId: 'prod1',
        productName: 'PawTag Plus',
        unitPrice: 39.99,
        customizationTotal: 19.0,
        quantity: 1,
        customisation: true,
        customisationTexts: ['coco'],
      });
      mocks.cartFindOne.mockResolvedValue(cart);
      mocks.productFindById.mockResolvedValue(product);

      await cartService.updateItem('user1', { itemId: 'item1', customisationTexts: ['   '] });

      expect(cart.items[0].customisation).toBe(false);
      expect(cart.items[0].customizationTotal).toBe(0);
      expect(cart.items[0].customisationTexts).toEqual([]);
    });

    it('disable clears names and charge (existing behaviour)', async () => {
      const cart = cartWithItem({
        _id: 'item1',
        productId: 'prod1',
        productName: 'PawTag Plus',
        unitPrice: 39.99,
        customizationTotal: 19.0,
        quantity: 1,
        customisation: true,
        customisationTexts: ['coco'],
      });
      mocks.cartFindOne.mockResolvedValue(cart);
      mocks.productFindById.mockResolvedValue(product);

      await cartService.updateItem('user1', { itemId: 'item1', customisation: false });

      expect(cart.items[0].customisation).toBe(false);
      expect(cart.items[0].customizationTotal).toBe(0);
      expect(cart.items[0].customisationTexts).toEqual([]);
    });
  });

  describe('addItem - max items limit', () => {
    it('should reject when cart is full', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        _id: `item${i}`,
        productId: { toString: () => `prod${i}` },
        productName: `Product ${i}`,
        sku: `SKU-${i}`,
        unitPrice: 10,
        customizationTotal: 0,
        quantity: 1,
        customisation: false,
        addedAt: new Date(),
      }));

      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items,
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prodNew',
        name: 'New Product',
        isActive: true,
        price: 10,
        sku: 'NEW-001',
        stock: 100,
        reserved: 0,
        images: [],
      });

      await expect(
        cartService.addItem('user1', { productId: 'prodNew', quantity: 1 })
      ).rejects.toThrow('Cart is full');
    });

    it('should allow adding when cart is full but item already exists', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        _id: `item${i}`,
        productId: { toString: () => `prod${i}` },
        productName: `Product ${i}`,
        sku: `SKU-${i}`,
        unitPrice: 10,
        customizationTotal: 0,
        quantity: 1,
        customisation: false,
        addedAt: new Date(),
      }));

      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items,
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prod0',
        name: 'Product 0',
        isActive: true,
        price: 10,
        sku: 'SKU-0',
        stock: 100,
        reserved: 0,
        images: [],
      });
      mocks.inventoryCanFulfill.mockResolvedValue(true);

      // Adding an item that already exists should work (increment quantity)
      await cartService.addItem('user1', { productId: 'prod0', quantity: 1 });
      expect(mockCart.items[0].quantity).toBe(2);
    });
  });

  describe('addItem - product validation', () => {
    it('should throw NotFoundError for non-existent product', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue(null);

      await expect(
        cartService.addItem('user1', { productId: 'nonexistent', quantity: 1 })
      ).rejects.toThrow('Product');
    });

    it('should throw ProductUnavailableError for inactive product', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prod1',
        name: 'Inactive Product',
        isActive: false,
        price: 19.99,
        stock: 10,
        reserved: 0,
      });

      await expect(
        cartService.addItem('user1', { productId: 'prod1', quantity: 1 })
      ).rejects.toThrow('no longer available');
    });
  });

  describe('addItem - stock validation', () => {
    it('should throw InsufficientStockError when stock policy is deny', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);
      mocks.productFindById.mockResolvedValue({
        _id: 'prod1',
        name: 'Low Stock Product',
        isActive: true,
        price: 19.99,
        salePrice: null,
        sku: 'LOW-001',
        stock: 2,
        reserved: 0,
        stockPolicy: 'deny',
        customizationPrice: 0,
        images: [],
      });
      mocks.inventoryCanFulfill.mockResolvedValue(false);

      await expect(
        cartService.addItem('user1', { productId: 'prod1', quantity: 5 })
      ).rejects.toThrow('units');
    });
  });

  describe('calculateTotals - price re-validation', () => {
    it('should update cart item prices from current DB data', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [
          {
            _id: 'item1',
            productId: { toString: () => 'prod1' },
            productName: 'Test Product',
            sku: 'TEST-001',
            unitPrice: 19.99, // old price
            customizationTotal: 0,
            quantity: 2,
            customisation: false,
          },
        ],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);

      // Setup find().lean() chain
      const leanResult = [
        {
          _id: 'prod1',
          name: 'Test Product',
          price: 24.99, // new price
          salePrice: null,
          customizationPrice: 0,
        },
      ];
      const findChain = { lean: vi.fn().mockResolvedValue(leanResult) };
      mocks.productFind.mockReturnValue(findChain);

      const totals = await cartService.calculateTotals('user1');

      // Price should be updated from 19.99 to 24.99
      expect(mockCart.items[0].unitPrice).toBe(24.99);
      expect(totals.subtotal).toBe(49.98); // 24.99 * 2
    });

    it('should prefer salePrice over base price', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [
          {
            _id: 'item1',
            productId: { toString: () => 'prod1' },
            productName: 'Test Product',
            unitPrice: 19.99,
            customizationTotal: 0,
            quantity: 1,
            customisation: false,
          },
        ],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);

      const leanResult = [
        {
          _id: 'prod1',
          name: 'Test Product',
          price: 29.99,
          salePrice: 14.99, // sale price takes precedence
          customizationPrice: 0,
        },
      ];
      const findChain = { lean: vi.fn().mockResolvedValue(leanResult) };
      mocks.productFind.mockReturnValue(findChain);

      const totals = await cartService.calculateTotals('user1');

      expect(mockCart.items[0].unitPrice).toBe(14.99);
      expect(totals.subtotal).toBe(14.99);
    });

    it('should return zero totals for empty cart', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne.mockResolvedValue(mockCart);

      const totals = await cartService.calculateTotals('user1');

      expect(totals.subtotal).toBe(0);
      expect(totals.total).toBe(0);
      expect(totals.items).toEqual([]);
    });
  });

  describe('getOrCreate - race condition', () => {
    it('should return existing active cart', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };
      mocks.cartFindOne.mockResolvedValue(mockCart);

      const result = await cartService.getOrCreate('user1');

      expect(result).toBe(mockCart);
      expect(mockCart.save).toHaveBeenCalled();
      expect(mocks.cartCreate).not.toHaveBeenCalled();
    });

    it('should create a new cart when no cart exists at all', async () => {
      const mockCart = {
        _id: 'cart1',
        userId: 'user1',
        items: [],
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };
      mocks.cartFindOne.mockResolvedValue(null);
      mocks.cartCreate.mockResolvedValue(mockCart);

      const result = await cartService.getOrCreate('user1');

      expect(result).toBe(mockCart);
      expect(mocks.cartCreate).toHaveBeenCalled();
    });

    it('should reset converted cart to active with empty items', async () => {
      const convertedCart = {
        _id: 'cart_existing',
        userId: 'user1',
        items: [{ productId: 'p1' }],
        status: 'converted',
        promoCode: 'OLD',
        promoDiscount: 5,
        shippingMethodId: 'old-method',
        shippingMethodName: 'Old Method',
        shippingCost: 10,
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      // First findOne({ status: 'active' }) returns null, second findOne({ userId }) returns converted cart
      mocks.cartFindOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(convertedCart);

      const result = await cartService.getOrCreate('user1');

      expect(result).toBe(convertedCart);
      expect(convertedCart.status).toBe('active');
      expect(convertedCart.items).toEqual([]);
      expect(convertedCart.promoCode).toBeUndefined();
      expect(convertedCart.promoDiscount).toBeUndefined();
      expect(convertedCart.shippingMethodId).toBeUndefined();
      expect(convertedCart.shippingMethodName).toBeUndefined();
      expect(convertedCart.shippingCost).toBe(0);
      expect(convertedCart.save).toHaveBeenCalled();
      expect(mocks.cartCreate).not.toHaveBeenCalled();
    });

    it('should reset abandoned cart to active with empty items', async () => {
      const abandonedCart = {
        _id: 'cart_abandoned',
        userId: 'user1',
        items: [],
        status: 'abandoned',
        lastAccessedAt: new Date(),
        save: mocks.cartSave,
      };

      mocks.cartFindOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(abandonedCart);

      const result = await cartService.getOrCreate('user1');

      expect(result).toBe(abandonedCart);
      expect(abandonedCart.status).toBe('active');
      expect(abandonedCart.save).toHaveBeenCalled();
      expect(mocks.cartCreate).not.toHaveBeenCalled();
    });
  });
});
