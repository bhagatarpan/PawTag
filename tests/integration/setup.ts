import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export async function setupTestDb() {
  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      mongod = await MongoMemoryServer.create({
        instance: {
          dbName: `pawtag-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      });
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      return uri;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[TestDB] Setup attempt ${attempt}/${maxRetries} failed:`, error);
      if (mongod) {
        try { await mongod.stop(); } catch {}
      }
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError || new Error('Failed to setup test database after retries');
}

export async function teardownTestDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}