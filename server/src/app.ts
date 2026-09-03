import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

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

export default app;
