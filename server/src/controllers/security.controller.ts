import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Response } from 'express';
import type { SecurityAuthenticatedRequest } from '../middleware/securityAuth.js';
import { incidentUploadsDir } from '../middleware/upload.js';
import { securityService } from '../services/security.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';

/**
 * Controller to fetch all active parking facility assignments for the logged-in security staff member.
 */
export async function getAssignedFacilities(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    const facilities = await securityService.getSecurityStaffFacilities(userId);
    sendSuccess(res, 'Assigned facilities retrieved successfully.', facilities);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to fetch live dashboard statistics for the staff member's selected active facility post.
 */
export async function getDashboardStats(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required for facility dashboard statistics.', 400, 'PARKING_LOT_REQUIRED');
    }

    const stats = await securityService.getSecurityDashboardStats(userId, parkingLotId);
    sendSuccess(res, 'Security dashboard statistics retrieved successfully.', stats);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to decode and verify a scanned QR booking pass.
 */
export async function verifyQrPass(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { qrPayload } = req.body as { qrPayload?: string };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!qrPayload || typeof qrPayload !== 'string') {
      throw new AppError('QR code payload string is required.', 400, 'QR_PAYLOAD_REQUIRED');
    }

    const verification = await securityService.verifyQrPass({
      staffUserId: userId,
      parkingLotId,
      qrPayload,
    });

    sendSuccess(res, 'QR Pass verified successfully.', verification);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to record physical vehicle entry at the gate.
 */
export async function recordVehicleEntry(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { bookingId, entryMethod, notes } = req.body as {
      bookingId?: string;
      entryMethod?: 'QR Code' | 'Manual Verification';
      notes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!bookingId) {
      throw new AppError('bookingId is required.', 400, 'BOOKING_ID_REQUIRED');
    }

    const result = await securityService.recordVehicleEntry({
      staffUserId: userId,
      parkingLotId,
      bookingId,
      ...(entryMethod ? { entryMethod } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });

    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}


/**
 * Controller to fetch available non-conflicting slots for walk-in registration.
 */
export async function completeVehicleExit(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { bookingId, exitMethod, notes } = req.body as {
      bookingId?: string;
      exitMethod?: 'QR Code' | 'Manual Verification';
      notes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!bookingId) {
      throw new AppError('bookingId is required.', 400, 'BOOKING_ID_REQUIRED');
    }

    const result = await securityService.completeVehicleExit({
      staffUserId: userId,
      parkingLotId,
      bookingId,
      ...(exitMethod ? { exitMethod } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });

    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}


/**
 * Controller to fetch available non-conflicting slots for walk-in registration.
 */
export async function collectOverstayCash(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { bookingId, amount, notes } = req.body as {
      bookingId?: string;
      amount?: number;
      notes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!bookingId) {
      throw new AppError('bookingId is required.', 400, 'BOOKING_ID_REQUIRED');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new AppError('A valid positive overstay amount is required.', 400, 'AMOUNT_REQUIRED');
    }

    const result = await securityService.collectOverstayCash({
      staffUserId: userId,
      parkingLotId,
      bookingId,
      amount,
      ...(notes !== undefined ? { notes } : {}),
    });

    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}


/**
 * Controller to fetch available non-conflicting slots for walk-in registration.
 */
export async function searchManualBookings(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    const { query, status, page, limit } = req.query as {
      query?: string;
      status?: string;
      page?: string;
      limit?: string;
    };

    const result = await securityService.searchManualBookings({
      staffUserId: userId,
      parkingLotId,
      ...(query !== undefined ? { query } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(page !== undefined ? { page: Number(page) } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
    });

    sendSuccess(res, 'Manual lookup bookings retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to retrieve full booking detail, timeline, and movement logs for manual review.
 */
export async function getManualBookingDetails(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const rawBookingId = req.params.bookingId;
    const bookingId = Array.isArray(rawBookingId) ? rawBookingId[0] : rawBookingId;

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!bookingId || typeof bookingId !== 'string') {
      throw new AppError('Booking ID is required.', 400, 'BOOKING_ID_REQUIRED');
    }

    const details = await securityService.getManualBookingDetails({
      staffUserId: userId,
      parkingLotId,
      bookingId,
    });

    sendSuccess(res, 'Manual booking details retrieved successfully.', details);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to manually approve gate entry for a Confirmed booking.
 */
export async function recordManualEntry(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { bookingId, reason, notes } = req.body as {
      bookingId?: string;
      reason?: string;
      notes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!bookingId) {
      throw new AppError('Booking ID is required.', 400, 'BOOKING_ID_REQUIRED');
    }

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Reason for manual entry is required.', 400, 'REASON_REQUIRED');
    }

    const result = await securityService.recordManualEntry({
      staffUserId: userId,
      parkingLotId,
      bookingId,
      reason,
      ...(notes !== undefined ? { notes } : {}),
    });

    sendSuccess(res, 'Vehicle entry verified and recorded manually.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to manually approve gate exit for an Active or Overstay booking.
 */
export async function completeManualExit(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { bookingId, reason, notes } = req.body as {
      bookingId?: string;
      reason?: string;
      notes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!bookingId) {
      throw new AppError('Booking ID is required.', 400, 'BOOKING_ID_REQUIRED');
    }

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Reason for manual exit is required.', 400, 'REASON_REQUIRED');
    }

    const result = await securityService.completeManualExit({
      staffUserId: userId,
      parkingLotId,
      bookingId,
      reason,
      ...(notes !== undefined ? { notes } : {}),
    });

    sendSuccess(res, 'Vehicle exit completed and bay released.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to record operational rejection of manual verification.
 */
export async function recordManualRejection(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { bookingId, actionType, reason, notes } = req.body as {
      bookingId?: string;
      actionType?: 'ENTRY' | 'EXIT';
      reason?: string;
      notes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!bookingId) {
      throw new AppError('Booking ID is required.', 400, 'BOOKING_ID_REQUIRED');
    }

    if (!actionType || (actionType !== 'ENTRY' && actionType !== 'EXIT')) {
      throw new AppError('Action type must be ENTRY or EXIT.', 400, 'INVALID_ACTION_TYPE');
    }

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Rejection reason is required.', 400, 'REASON_REQUIRED');
    }

    const result = await securityService.recordManualRejection({
      staffUserId: userId,
      parkingLotId,
      bookingId,
      actionType,
      reason,
      ...(notes !== undefined ? { notes } : {}),
    });

    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to fetch available non-conflicting slots for walk-in registration.
 */
export async function getWalkInAvailableSlots(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const vehicleType = (req.query.vehicleType as string) || 'Car';
    const durationHours = req.query.durationHours ? Number(req.query.durationHours) : undefined;
    const entryTime = req.query.entryTime as string | undefined;
    const exitTime = req.query.exitTime as string | undefined;

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    const result = await securityService.getWalkInAvailableSlots({
      staffUserId: userId,
      parkingLotId,
      vehicleType,
      ...(durationHours !== undefined ? { durationHours } : {}),
      ...(entryTime !== undefined ? { entryTime } : {}),
      ...(exitTime !== undefined ? { exitTime } : {}),
    });

    sendSuccess(res, 'Available walk-in slots retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to compute parking tariff for walk-in booking based on duration and vehicle type.
 */
export async function calculateWalkInTariff(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const { vehicleType, durationHours, entryTime, exitTime } = req.body as {
      vehicleType?: string;
      durationHours?: number;
      entryTime?: string;
      exitTime?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!vehicleType) {
      throw new AppError('Vehicle type is required.', 400, 'VEHICLE_TYPE_REQUIRED');
    }

    const result = await securityService.calculateWalkInTariff({
      staffUserId: userId,
      parkingLotId,
      vehicleType,
      ...(durationHours !== undefined ? { durationHours: Number(durationHours) } : {}),
      ...(entryTime !== undefined ? { entryTime } : {}),
      ...(exitTime !== undefined ? { exitTime } : {}),
    });

    sendSuccess(res, 'Walk-in booking tariff calculated successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to register a walk-in booking and confirm cash payment.
 */
export async function createWalkInBooking(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;
    const {
      customerName,
      customerMobile,
      customerEmail,
      vehicleNumber,
      vehicleType,
      durationHours,
      entryTime,
      exitTime,
      slotSelectionMode,
      slotId,
      cashCollected,
      cashAmountCollected,
      staffNotes,
    } = req.body as {
      customerName?: string;
      customerMobile?: string;
      customerEmail?: string;
      vehicleNumber?: string;
      vehicleType?: string;
      durationHours?: number;
      entryTime?: string;
      exitTime?: string;
      slotSelectionMode?: 'AUTO' | 'MANUAL';
      slotId?: string;
      cashCollected?: boolean;
      cashAmountCollected?: number;
      staffNotes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!customerName || !customerMobile || !vehicleNumber || !vehicleType) {
      throw new AppError('Customer and vehicle details are mandatory.', 400, 'FIELDS_REQUIRED');
    }

    if (cashCollected !== true) {
      throw new AppError(
        'Physical cash collection must be explicitly confirmed before creating a walk-in booking.',
        400,
        'CASH_NOT_CONFIRMED',
      );
    }

    const result = await securityService.createWalkInBooking({
      staffUserId: userId,
      parkingLotId,
      customerName,
      customerMobile,
      ...(customerEmail !== undefined ? { customerEmail } : {}),
      vehicleNumber,
      vehicleType,
      ...(durationHours !== undefined ? { durationHours: Number(durationHours) } : {}),
      ...(entryTime !== undefined ? { entryTime } : {}),
      ...(exitTime !== undefined ? { exitTime } : {}),
      slotSelectionMode: slotSelectionMode || 'AUTO',
      ...(slotId !== undefined ? { slotId } : {}),
      cashCollected: true,
      cashAmountCollected: Number(cashAmountCollected) || 0,
      ...(staffNotes !== undefined ? { staffNotes } : {}),
    });

    sendSuccess(res, 'Walk-in cash booking created successfully.', result, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to fetch incidents list for assigned facility with filters, search, and pagination.
 */
export async function getIncidents(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    const { status, severity, incidentType, search, page, limit } = req.query as {
      status?: string;
      severity?: string;
      incidentType?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const result = await securityService.getIncidents({
      staffUserId: userId,
      parkingLotId,
      ...(status !== undefined ? { status } : {}),
      ...(severity !== undefined ? { severity } : {}),
      ...(incidentType !== undefined ? { incidentType } : {}),
      ...(search !== undefined ? { search } : {}),
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });

    sendSuccess(res, 'Incidents retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to fetch single incident details.
 */
export async function getIncidentDetail(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const rawId = req.params.id;
    const incidentId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!incidentId) {
      throw new AppError('Incident ID is required.', 400, 'INCIDENT_ID_REQUIRED');
    }

    const result = await securityService.getIncidentDetail({
      staffUserId: userId,
      incidentId,
    });

    sendSuccess(res, 'Incident details retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to report a new security incident.
 */
export async function createIncident(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const parkingLotId = req.parkingLotId;

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!parkingLotId) {
      throw new AppError('Parking lot ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    const {
      title,
      description,
      incidentType,
      severity,
      vehicleNumber,
      bookingReference,
      attachments,
      location,
    } = req.body as {
      title?: string;
      description?: string;
      incidentType?: string;
      severity?: 'Low' | 'Medium' | 'High' | 'Critical';
      vehicleNumber?: string;
      bookingReference?: string;
      attachments?: string[];
      location?: string;
    };

    if (!title || !description || !incidentType) {
      throw new AppError('Title, description, and incident type are mandatory.', 400, 'FIELDS_REQUIRED');
    }

    const result = await securityService.createIncident({
      staffUserId: userId,
      parkingLotId,
      title,
      description,
      incidentType,
      severity: severity || 'Medium',
      ...(vehicleNumber !== undefined ? { vehicleNumber } : {}),
      ...(bookingReference !== undefined ? { bookingReference } : {}),
      attachments: Array.isArray(attachments) ? attachments : [],
      ...(location !== undefined ? { location } : {}),
    });

    sendSuccess(res, 'Incident reported successfully.', result, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to update incident status (e.g. Open -> Resolved -> Closed).
 */
export async function updateIncidentStatus(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const rawId = req.params.id;
    const incidentId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { status, resolutionNotes } = req.body as {
      status?: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
      resolutionNotes?: string;
    };

    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!incidentId) {
      throw new AppError('Incident ID is required.', 400, 'INCIDENT_ID_REQUIRED');
    }

    if (!status) {
      throw new AppError('Incident status is required.', 400, 'STATUS_REQUIRED');
    }

    const result = await securityService.updateIncidentStatus({
      staffUserId: userId,
      incidentId,
      status,
      ...(resolutionNotes !== undefined ? { resolutionNotes } : {}),
    });

    sendSuccess(res, `Incident marked as ${status}.`, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to upload incident photo attachments.
 */
export async function uploadIncidentImages(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new AppError('At least one image file is required.', 400, 'NO_FILES_UPLOADED');
    }

    const uploadedUrls = files.map((file) => `/api/v1/security/incidents/images/${file.filename}`);

    sendSuccess(res, 'Images uploaded successfully.', {
      urls: uploadedUrls,
      filenames: files.map((f) => f.filename),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to safely stream incident image file.
 */
export async function getIncidentImageFile(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new AppError('Invalid filename.', 400, 'INVALID_FILENAME');
    }

    const filePath = path.join(incidentUploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError('Incident image not found.', 404, 'IMAGE_NOT_FOUND');
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to retrieve vehicle movement history with filters and search (Phase 5).
 */
export async function getMovementLogs(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    const {
      parkingLotId: qLotId,
      startDate,
      endDate,
      movementType,
      vehicleNumber,
      customerName,
      staffId,
      search,
      page,
      limit,
    } = req.query as Record<string, string | undefined>;

    const parkingLotId = qLotId || req.parkingLotId;
    if (!parkingLotId) {
      throw new AppError('Parking facility ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    const result = await securityService.getMovementLogs({
      staffUserId: userId,
      parkingLotId,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(movementType ? { movementType } : {}),
      ...(vehicleNumber ? { vehicleNumber } : {}),
      ...(customerName ? { customerName } : {}),
      ...(staffId ? { staffId } : {}),
      ...(search ? { search } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });

    sendSuccess(res, 'Vehicle movement logs retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to retrieve detailed inspection of a vehicle movement log.
 */
export async function getMovementLogDetail(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    const rawId = req.params.id;
    const movementLogId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!movementLogId) {
      throw new AppError('Movement log ID is required.', 400, 'LOG_ID_REQUIRED');
    }

    const result = await securityService.getMovementLogDetail({
      staffUserId: userId,
      movementLogId,
    });

    sendSuccess(res, 'Movement log details retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to export filtered vehicle movement ledger as CSV.
 */
export async function exportMovementLogsCsv(
  req: SecurityAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    const {
      parkingLotId: qLotId,
      startDate,
      endDate,
      movementType,
      vehicleNumber,
      customerName,
      staffId,
      search,
    } = req.query as Record<string, string | undefined>;

    const parkingLotId = qLotId || req.parkingLotId;
    if (!parkingLotId) {
      throw new AppError('Parking facility ID is required.', 400, 'PARKING_LOT_REQUIRED');
    }

    const csvContent = await securityService.exportMovementLogsCsv({
      staffUserId: userId,
      parkingLotId,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(movementType ? { movementType } : {}),
      ...(vehicleNumber ? { vehicleNumber } : {}),
      ...(customerName ? { customerName } : {}),
      ...(staffId ? { staffId } : {}),
      ...(search ? { search } : {}),
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="movement-logs-${parkingLotId}-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}


