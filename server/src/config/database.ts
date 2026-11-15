import mongoose from 'mongoose';
import { BookingModel } from '../models/Booking.js';
import { env } from './env.js';

/**
 * Cleans up legacy non-sparse indexes and ensures canonical model indexes (including sparse unique UQ_QRCode) exist.
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  try {
    const indexes = await BookingModel.collection.indexes();
    const hasLegacyQrIndex = indexes.some((idx) => idx.name === 'qrCode_1');
    if (hasLegacyQrIndex) {
      await BookingModel.collection.dropIndex('qrCode_1');
    }
  } catch {
    // Collection may not exist yet on fresh database; createIndex below will initialize it
  }

  await BookingModel.collection.createIndex(
    { qrCode: 1 },
    { name: 'UQ_QRCode', unique: true, sparse: true },
  );
}

export async function connectDatabase(): Promise<void> {
  const mongoUri = env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in the environment variables');
  }

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection disconnected');
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  await ensureDatabaseIndexes();
}
