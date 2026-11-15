import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import contactRoutes from './routes/contact.routes.js';
import facilitySubmissionRoutes from './routes/facilitySubmission.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import parkingLotRoutes from './routes/parkingLot.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import profileRoutes from './routes/profile.routes.js';
import customerParkingRoutes from './routes/customerParking.routes.js';
import securityRoutes from './routes/security.routes.js';

const app = express();

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (origin === env.CLIENT_URL) return true;
  if (env.NODE_ENV !== 'production') {
    // In development, allow any localhost or 127.0.0.1 port used by Vite (5173, 5174, 5175, etc.)
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
};

// Configure Helmet with cross-origin resource policy enabled so client browsers can load uploaded media
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS error: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'ParkEase API is running',
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin/parking-lots', parkingLotRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/owner/parking/submissions', facilitySubmissionRoutes);
app.use('/api/v1/owner', ownerRoutes);
app.use('/api/v1/customer/parking', customerParkingRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
