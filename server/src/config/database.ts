import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(): Promise<void> {
  const mongoUri = env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in the environment variables');
  }

  await mongoose.connect(mongoUri);

  console.log('MongoDB connected successfully');
}
