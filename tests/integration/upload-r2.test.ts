import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createSuperAdmin } from './helpers';

// Mock the R2 service
const mockIsR2Configured = vi.fn().mockReturnValue(true);
vi.mock('../../packages/api/src/services/r2.service', () => ({
  uploadToR2: vi.fn().mockImplementation((key: string) => Promise.resolve(`https://test-bucket.r2.dev/${key}`)),
  deleteFromR2: vi.fn().mockResolvedValue(undefined),
  generateUniqueFilename: vi.fn().mockReturnValue('test-file.jpg'),
  isR2Configured: () => mockIsR2Configured(),
}));

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
  vi.clearAllMocks();
  mockIsR2Configured.mockReturnValue(true);
});

describe('Phase 14 — File Upload to Object Storage', () => {
  describe('POST /api/upload/pet-photo', () => {
    it('should upload a pet photo to R2', async () => {
      const { token } = await createSuperAdmin();

      const imageBuffer = Buffer.from('fake-image-data');
      const filename = 'test-pet-photo.jpg';

      const res = await request(app)
        .post('/api/upload/pet-photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', imageBuffer, { filename, contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toContain('r2.dev');
      expect(res.body.data.url).toContain('pets/');
      expect(res.body.data.filename).toBeDefined();
    });

    it('should return 500 when R2 is not configured', async () => {
      const { token } = await createSuperAdmin();
      mockIsR2Configured.mockReturnValue(false);

      const imageBuffer = Buffer.from('fake-image-data');
      const filename = 'test-pet-photo.jpg';

      const res = await request(app)
        .post('/api/upload/pet-photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', imageBuffer, { filename, contentType: 'image/jpeg' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('File storage is not configured');
    });

    it('should reject non-image files', async () => {
      const { token } = await createSuperAdmin();

      const textBuffer = Buffer.from('not-an-image');
      const filename = 'test-file.txt';

      const res = await request(app)
        .post('/api/upload/pet-photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', textBuffer, { filename, contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Only image files');
    });

    it('should require authentication', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      const filename = 'test-pet-photo.jpg';

      const res = await request(app)
        .post('/api/upload/pet-photo')
        .attach('photo', imageBuffer, { filename, contentType: 'image/jpeg' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/upload/product-images', () => {
    it('should upload product images to R2', async () => {
      const { token } = await createSuperAdmin();

      const imageBuffer = Buffer.from('fake-image-data');
      const filename = 'test-product.jpg';

      const res = await request(app)
        .post('/api/upload/product-images')
        .set('Authorization', `Bearer ${token}`)
        .attach('images', imageBuffer, { filename, contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.images).toBeDefined();
      expect(res.body.data.images.length).toBe(1);
      expect(res.body.data.images[0].url).toContain('r2.dev');
      expect(res.body.data.images[0].url).toContain('products/');
    });

    it('should return 500 when R2 is not configured', async () => {
      const { token } = await createSuperAdmin();
      mockIsR2Configured.mockReturnValue(false);

      const imageBuffer = Buffer.from('fake-image-data');
      const filename = 'test-product.jpg';

      const res = await request(app)
        .post('/api/upload/product-images')
        .set('Authorization', `Bearer ${token}`)
        .attach('images', imageBuffer, { filename, contentType: 'image/jpeg' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('File storage is not configured');
    });

    it('should require product.update permission', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      const filename = 'test-product.jpg';

      const res = await request(app)
        .post('/api/upload/product-images')
        .attach('images', imageBuffer, { filename, contentType: 'image/jpeg' });

      expect(res.status).toBe(401);
    });
  });
});
