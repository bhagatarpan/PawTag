import mongoose from 'mongoose';

let isConnected = false;

export async function connectDatabase(uri?: string): Promise<void> {
  if (isConnected) return;

  const mongoUri = uri || process.env.DB_URL;
  if (!mongoUri) {
    throw new Error('DB_URL environment variable is not set');
  }

  try {
    await mongoose.connect(mongoUri);
    isConnected = true;
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('MongoDB disconnected');
}

export { mongoose };
