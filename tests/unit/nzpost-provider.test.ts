import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };

// Mock @pawtag/db so importing the provider chain doesn't trigger Mongoose model registration
vi.mock('@pawtag/db', () => ({
  Setting: { findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) },
  getSettingsRepository: vi.fn(),
  resolveSettingsReadMode: vi.fn().mockReturnValue('mongo'),
}));

// Mock the commerce config to avoid DB reads
vi.mock('../../packages/api/src/commerce/config', () => ({
  getSetting: vi.fn().mockResolvedValue(''),
  getNumberSetting: vi.fn().mockResolvedValue(0),
  getBooleanSetting: vi.fn().mockResolvedValue(false),
}));

describe('NZ Post shipping provider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NZPOST_CLIENT_ID;
    delete process.env.NZPOST_CLIENT_SECRET;
    delete process.env.NZPOST_ACCOUNT_NUMBER;
    delete process.env.NZPOST_LIVE;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('demo mode (no credentials)', () => {
    it('returns demo tracking with isDemo=true outside production', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      const result = await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(true);
      expect(result.isDemo).toBe(true);
      expect(result.trackingNumber).toMatch(/^[A-Z]{2}\d{9}NZ$/);
      expect(result.carrier).toBe('NZ Post (Demo)');
    });

    it('fails closed in production without credentials (no fabricated tracking)', async () => {
      process.env.NODE_ENV = 'production';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      const result = await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.trackingNumber).toBeUndefined();
      expect(result.isDemo).toBeUndefined();
      expect(result.error).toMatch(/not configured in production/i);
    });

    it('throws on getTrackingEvents in production without credentials', async () => {
      process.env.NODE_ENV = 'production';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      await expect(nzShippingProvider.getTrackingEvents('AB123456789NZ'))
        .rejects.toThrow(/not configured in production/i);
    });

    it('returns demo tracking events outside production', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      const events = await nzShippingProvider.getTrackingEvents('AB123456789NZ');
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].description).toContain('demo');
    });
  });

  describe('real mode (credentials present)', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      process.env.NZPOST_CLIENT_ID = 'test-client-id';
      process.env.NZPOST_CLIENT_SECRET = 'test-client-secret';
      process.env.NZPOST_ACCOUNT_NUMBER = '99999999';
      process.env.NZPOST_LIVE = 'false';
      vi.stubGlobal('fetch', mockFetch);
    });

    function mockOAuthSuccess() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'mock-token', expires_in: 86399 }),
      });
    }

    function mockLabelCreateSuccess() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message_id: 'msg1', consignment_id: 'X63CC2' }),
      });
    }

    function mockLabelDetailComplete() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          consignment_id: 'X63CC2',
          consignment_status: 'Complete',
          labels: [{
            label_id: 'X63CC2-1',
            tracking_reference: 'LX022120977NZ',
            label_generation_status: 'Complete',
            errors: [],
          }],
        }),
      });
    }

    it('creates a real shipment via ParcelLabel API and returns carrier-issued tracking', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockOAuthSuccess();
      mockLabelCreateSuccess();
      mockLabelDetailComplete();

      const result = await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '42C Tawa Drive', city: 'Albany', state: '', zip: '0632', country: 'NZ' },
        items: [{ name: 'PawTag Classic', quantity: 2 }],
        recipientName: 'Jane Doe',
      });

      expect(result.success).toBe(true);
      expect(result.isDemo).toBe(false);
      expect(result.trackingNumber).toBe('LX022120977NZ');
      expect(result.carrier).toBe('NZ Post (UAT)');
      expect(result.labelUrl).toContain('/parcellabel/v3/labels/X63CC2');
    });

    it('uses the UAT base URL when NZPOST_LIVE=false', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockOAuthSuccess();
      mockLabelCreateSuccess();
      mockLabelDetailComplete();

      await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      // OAuth call + label create + label detail
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Label create should hit UAT
      const labelCreateCall = mockFetch.mock.calls[1];
      expect(labelCreateCall[0]).toContain('api.uat.nzpost.co.nz');
    });

    it('uses the live base URL when NZPOST_LIVE=true', async () => {
      process.env.NODE_ENV = 'development';
      process.env.NZPOST_LIVE = 'true';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockOAuthSuccess();
      mockLabelCreateSuccess();
      mockLabelDetailComplete();

      await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      const labelCreateCall = mockFetch.mock.calls[1];
      expect(labelCreateCall[0]).toContain('api.nzpost.co.nz');
      expect(labelCreateCall[0]).not.toContain('uat');
    });

    it('does NOT fall back to demo when the ParcelLabel API fails', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      // OAuth succeeds
      mockOAuthSuccess();
      // Label create fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.trackingNumber).toBeUndefined();
      expect(result.isDemo).toBeUndefined();
      expect(result.error).toContain('NZ Post API failed');
    });

    it('does NOT fall back to demo when OAuth fails', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('invalid_client'),
      });

      const result = await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.trackingNumber).toBeUndefined();
    });

    it('returns actionable error for unauthorized_client (grant type not enabled)', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"unauthorized_client"}'),
      });

      const result = await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Client Credentials grant type');
      expect(result.error).toContain('api@nzpost.co.nz');
    });

    it('returns actionable error for invalid_client', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{"error":"invalid_client"}'),
      });

      const result = await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '1 St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
        items: [{ name: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid client credentials');
      expect(result.error).toContain('NZPOST_CLIENT_ID');
    });

    it('builds the ParcelLabel request with correct address parsing', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockOAuthSuccess();
      mockLabelCreateSuccess();
      mockLabelDetailComplete();

      await nzShippingProvider.createShipment({
        orderId: 'ord1',
        orderNumber: 'PT-000001',
        address: { line1: '42C Tawa Drive', line2: 'Albany', city: 'Auckland', state: '', zip: '0632', country: 'NZ' },
        items: [{ name: 'PawTag', quantity: 1 }],
        recipientName: 'Jane Doe',
      });

      // The label create call body should parse "42C Tawa Drive" into street_number + street
      const labelCreateCall = mockFetch.mock.calls[1];
      const requestBody = JSON.parse(labelCreateCall[1].body);
      expect(requestBody.delivery_address.street_number).toBe('42C');
      expect(requestBody.delivery_address.street).toBe('Tawa Drive');
      expect(requestBody.delivery_address.suburb).toBe('Albany');
      expect(requestBody.delivery_address.city).toBe('Auckland');
      expect(requestBody.receiver_details.name).toBe('Jane Doe');
      expect(requestBody.carrier).toBe('COURIERPOST');
      expect(requestBody.account_number).toBe('99999999');
      expect(requestBody.parcel_details[0].service_code).toBe('CPOLP');
    });

    it('fetches real tracking events from ParcelTrack API', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockOAuthSuccess();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          results: [{
            tracking_reference: 'LX022120977NZ',
            tracking_events: [
              { date_time: '2026-10-09T10:00:00Z', status: 'Delivered', description: 'Your item has been delivered.' },
              { date_time: '2026-10-08T08:00:00Z', status: 'In transit', description: 'Item in transit.' },
            ],
          }],
        }),
      });

      const events = await nzShippingProvider.getTrackingEvents('LX022120977NZ');

      expect(events).toHaveLength(2);
      expect(events[0].status).toBe('delivered');
      expect(events[0].description).toBe('Your item has been delivered.');
      expect(events[1].status).toBe('in_transit');
    });

    it('returns empty array (not demo) when ParcelTrack has no events', async () => {
      process.env.NODE_ENV = 'development';
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');

      mockOAuthSuccess();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          results: [{ tracking_reference: 'LX022120977NZ' }],
        }),
      });

      const events = await nzShippingProvider.getTrackingEvents('LX022120977NZ');
      expect(events).toEqual([]);
    });

    it('isRealApiConfigured returns true when credentials are set', async () => {
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');
      expect(nzShippingProvider.isRealApiConfigured()).toBe(true);
    });
  });

  describe('isRealApiConfigured', () => {
    it('returns false without credentials', async () => {
      const { nzShippingProvider } = await import('../../packages/api/src/commerce/providers/nz-shipping');
      expect(nzShippingProvider.isRealApiConfigured()).toBe(false);
    });
  });
});
