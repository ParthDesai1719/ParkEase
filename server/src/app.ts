import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import authRoutes from './routes/auth.routes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
  }),
);
app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'ParkEase API is running',
  });
});

app.use('/api/v1/auth', authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
