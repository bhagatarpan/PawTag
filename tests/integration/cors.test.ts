import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../packages/api/src/index';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('CORS Configuration', () => {
  it('should allow requests from allowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('should allow requests with no origin (e.g., server-to-server)', async () => {
    const res = await request(app)
      .get('/health');

    expect(res.status).toBe(200);
  });

  it('should reject requests from disallowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.com');

    expect(res.status).toBe(500);
  });

  it('should allow all localhost dev origins', async () => {
    const origins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ];

    for (const origin of origins) {
      const res = await request(app)
        .get('/health')
        .set('Origin', origin);

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  });
});
