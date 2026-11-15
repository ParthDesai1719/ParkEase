import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';
import { env } from './config/env.js';

let ioInstance: SocketIOServer | null = null;

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (origin === env.CLIENT_URL) return true;
  if (env.NODE_ENV !== 'production') {
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
};

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS error: Origin ${origin} not allowed`));
        }
      },
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    socket.on('join_submission', (submissionId: string) => {
      if (submissionId) {
        socket.join(`submission_${submissionId}`);
      }
    });

    socket.on('join_owner', (ownerId: string) => {
      if (ownerId) {
        socket.join(`user_${ownerId}`);
        socket.join(`owner_${ownerId}`);
      }
    });

    socket.on('join_user', (userId: string) => {
      if (userId) {
        socket.join(`user_${userId}`);
        socket.join(`owner_${userId}`);
      }
    });

    socket.on('join_lot', (lotId: string) => {
      if (lotId) {
        socket.join(`lot_${lotId}`);
      }
    });

    socket.on('join_admin', () => {
      socket.join('admin_channel');
    });
  });

  return ioInstance;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitNewNotification(userId: string, notification: unknown): void {
  if (!ioInstance) return;

  // Broadcast exclusively to the single canonical user room (prevents duplicate delivery)
  ioInstance.to(`user_${userId}`).emit('new_notification', notification);
}

export function emitAdminNotification(notification: unknown): void {
  if (!ioInstance) return;
  // Broadcast admin-specific updates without duplicating user-targeted notifications
  ioInstance.to('admin_channel').emit('admin_notification', notification);
}

export function emitSlotStatusUpdate(data: {
  parkingLotId: string;
  floorId: string;
  zoneId: string;
  slotId: string;
  slotNumber: string;
  slotStatus: string;
  remarks?: string | null | undefined;
  timestamp: string;
}): void {
  if (!ioInstance) return;

  // Broadcast to lot-specific room and global
  ioInstance.to(`lot_${data.parkingLotId}`).emit('slot_status_changed', data);
  ioInstance.emit('slot_status_changed', data);
}

export function emitBookingStatusUpdate(data: {
  bookingId: string;
  bookingReference: string;
  parkingLotId: string;
  customerId: string;
  bookingStatus: string;
  paymentStatus?: string | undefined;
  timestamp: string;
}): void {
  if (!ioInstance) return;

  // Broadcast to lot room, customer room, and global
  ioInstance.to(`lot_${data.parkingLotId}`).emit('booking_status_changed', data);
  ioInstance.to(`user_${data.customerId}`).emit('booking_status_changed', data);
  ioInstance.emit('booking_status_changed', data);
}

export function emitFacilityStatusUpdate(data: {
  submissionId: string;
  ownerId?: string | undefined;
  status: string;
  reviewedAt?: Date | string | null | undefined;
  reviewedBy?: unknown;
  adminRemarks?: string | null | undefined;
  rejectionReason?: string | null | undefined;
  approvedAt?: Date | string | null | undefined;
}): void {
  if (!ioInstance) return;

  // Broadcast to submission-specific room
  ioInstance.to(`submission_${data.submissionId}`).emit('facility_status_changed', data);

  // Broadcast to owner-specific room
  if (data.ownerId) {
    ioInstance.to(`owner_${data.ownerId}`).emit('facility_status_changed', data);
  }

  // Broadcast to all connected clients
  ioInstance.emit('facility_status_changed', data);
}

export function emitStaffStatusUpdate(data: {
  staffId: string;
  ownerId: string;
  parkingLotId?: string | undefined;
  status: string;
  event: string;
  timestamp: string;
}): void {
  if (!ioInstance) return;

  if (data.ownerId) {
    ioInstance.to(`owner_${data.ownerId}`).emit('staff_status_changed', data);
  }
  if (data.staffId) {
    ioInstance.to(`user_${data.staffId}`).emit('staff_status_changed', data);
  }
  if (data.parkingLotId) {
    ioInstance.to(`lot_${data.parkingLotId}`).emit('staff_status_changed', data);
  }
  ioInstance.emit('staff_status_changed', data);
}

export function emitIncidentUpdate(data: {
  incidentId: string;
  incidentReference: string;
  parkingLotId: string;
  action: 'CREATED' | 'UPDATED' | 'RESOLVED' | 'CLOSED';
  incidentType: string;
  severity: string;
  incidentStatus: string;
  title: string;
  timestamp: string;
}): void {
  if (!ioInstance) return;

  if (data.parkingLotId) {
    ioInstance.to(`lot_${data.parkingLotId}`).emit('incident_updated', data);
  }
  ioInstance.to('admin_channel').emit('incident_updated', data);
  ioInstance.emit('incident_updated', data);
}

