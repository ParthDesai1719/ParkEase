import fs from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ownerService } from '../services/owner.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { normalizeIp } from '../utils/ip.js';

export async function getOwnerRegistrationConfig(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const config = await ownerService.getRegistrationConfig();
    sendSuccess(res, 'Registration configuration retrieved successfully.', config);
  } catch (error) {
    next(error);
  }
}

export async function uploadOwnerDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('No document file was uploaded.', 400, 'NO_FILE_UPLOADED');
    }

    const relativePath = `uploads/owner/${req.file.filename}`;

    sendSuccess(res, 'Document uploaded successfully.', {
      filePath: relativePath,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
}

export async function createDraftRegistration(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await ownerService.createDraftApplication({
      ...req.body,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, result.message, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function requestOwnerEmailOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationReference } = req.body;
    if (!applicationReference) {
      throw new AppError('Application reference is required.', 400, 'BAD_REQUEST');
    }

    const result = await ownerService.requestEmailOtp(applicationReference);
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function verifyOwnerEmailOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationReference, otp } = req.body;
    if (!applicationReference || !otp) {
      throw new AppError('Application reference and 6-digit OTP are required.', 400, 'BAD_REQUEST');
    }

    const result = await ownerService.verifyEmailOtp(applicationReference, otp);
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function requestOwnerMobileOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationReference } = req.body;
    if (!applicationReference) {
      throw new AppError('Application reference is required.', 400, 'BAD_REQUEST');
    }

    const result = await ownerService.requestMobileOtp(applicationReference);
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function verifyOwnerMobileOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationReference, otp } = req.body;
    if (!applicationReference || !otp) {
      throw new AppError('Application reference and 6-digit OTP are required.', 400, 'BAD_REQUEST');
    }

    const result = await ownerService.verifyMobileOtp(applicationReference, otp);
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function createOwnerPaymentOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationReference } = req.body;
    if (!applicationReference) {
      throw new AppError('Application reference is required.', 400, 'BAD_REQUEST');
    }

    const order = await ownerService.createPaymentOrder(applicationReference);
    sendSuccess(res, 'Payment order generated successfully.', order);
  } catch (error) {
    next(error);
  }
}

export async function verifyOwnerPayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationReference, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!applicationReference || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError(
        'Incomplete payment verification payload. Order ID, payment ID, and signature are required.',
        400,
        'BAD_REQUEST',
      );
    }

    const result = await ownerService.verifyPayment({
      applicationReference,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.get('user-agent'),
    });

    // Clear session cookies so user is immediately logged out
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    sendSuccess(res, 'Registration fee verified successfully. Application submitted for review.', result);
  } catch (error) {
    next(error);
  }
}

export async function getOwnerRegistrationDocuments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId!;
    const result = await ownerService.getOwnerRegistrationDocuments(userId);
    sendSuccess(res, 'Owner registration documents retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function getOwnerRegistrationDocumentFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId!;
    const docType = req.params.docType as string;
    const index = req.query.index !== undefined ? Number(req.query.index) : undefined;
    const isDownload = req.query.download === 'true';

    const docResult = await ownerService.getOwnerRegistrationDocumentFile(userId, docType, index);

    if (docResult.isRemote && docResult.url) {
      res.redirect(docResult.url);
      return;
    }

    if (!docResult.filePath) {
      res.status(404).json({ success: false, message: 'Document file not found.' });
      return;
    }

    const disposition = isDownload ? 'attachment' : 'inline';
    res.setHeader('Content-Type', docResult.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${docResult.fileName || 'document'}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const stream = fs.createReadStream(docResult.filePath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/dashboard/stats
 * Retrieves live aggregated owner dashboard KPIs, slot distribution, today's metrics, and recent bookings.
 */
export async function getOwnerDashboardStatsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { parkingLotId } = req.query;
    const stats = await ownerService.getOwnerDashboardStats(
      req.userId!,
      typeof parkingLotId === 'string' ? parkingLotId : undefined,
    );
    sendSuccess(res, 'Owner dashboard statistics retrieved successfully.', stats);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/owner/parking-lots/:id
 * Updates permitted business and operational information for an owner's parking lot.
 */
export async function updateOwnerParkingLotHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Parking Lot ID is required.', 400, 'MISSING_ID');
    }
    const updatedLot = await ownerService.updateOwnerParkingLotBusinessInfo(
      req.userId!,
      id,
      req.body,
    );
    sendSuccess(res, 'Parking lot business information updated successfully.', updatedLot);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/slots
 * Retrieves slots across owner facilities with filtering and search.
 */
export async function getOwnerSlotsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { parkingLotId, floorId, zoneId, status, slotType, vehicleType, search, page, limit } = req.query;
    const result = await ownerService.getOwnerSlots(req.userId!, {
      parkingLotId: typeof parkingLotId === 'string' ? parkingLotId : undefined,
      floorId: typeof floorId === 'string' ? floorId : undefined,
      zoneId: typeof zoneId === 'string' ? zoneId : undefined,
      status: typeof status === 'string' ? status : undefined,
      slotType: typeof slotType === 'string' ? slotType : undefined,
      vehicleType: typeof vehicleType === 'string' ? vehicleType : undefined,
      search: typeof search === 'string' ? search : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    sendSuccess(res, 'Owner slots retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/slots/:id
 * Retrieves full details of a single slot owned by authenticated owner.
 */
export async function getOwnerSlotByIdHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Slot ID is required.', 400, 'MISSING_SLOT_ID');
    }
    const slot = await ownerService.getOwnerSlotById(req.userId!, id);
    sendSuccess(res, 'Slot details retrieved successfully.', slot);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/owner/slots/:id/status
 * Updates operational status of an Owner's slot (Available <-> Under Maintenance / Blocked)
 */
export async function updateOwnerSlotStatusHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Slot ID is required.', 400, 'MISSING_SLOT_ID');
    }
    const updatedSlot = await ownerService.updateOwnerSlotOperationalStatus(
      req.userId!,
      id,
      req.body,
      {
        ipAddress: normalizeIp(req.ip) || undefined,
        userAgent: req.get('user-agent'),
      },
    );
    sendSuccess(res, 'Slot operational status updated successfully.', updatedSlot);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/bookings
 * Retrieves paginated bookings scoped to the owner's parking facilities.
 */
export async function getOwnerBookingsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      parkingLotId,
      status,
      bookingType,
      paymentStatus,
      search,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await ownerService.getOwnerBookings(req.userId!, {
      parkingLotId: typeof parkingLotId === 'string' ? parkingLotId : undefined,
      status: typeof status === 'string' ? status : undefined,
      bookingType:
        bookingType === 'ONLINE' || bookingType === 'WALK_IN' || bookingType === 'ALL'
          ? (bookingType as any)
          : undefined,
      paymentStatus: typeof paymentStatus === 'string' ? paymentStatus : undefined,
      search: typeof search === 'string' ? search : undefined,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy: typeof sortBy === 'string' ? sortBy : undefined,
      sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
    });

    sendSuccess(res, 'Owner bookings retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/bookings/:id
 * Retrieves full details for a single booking scoped to the owner's facilities.
 */
export async function getOwnerBookingByIdHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Booking ID is required.', 400, 'MISSING_BOOKING_ID');
    }
    const booking = await ownerService.getOwnerBookingById(req.userId!, id);
    sendSuccess(res, 'Booking details retrieved successfully.', booking);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/owner/bookings/:id/cancel
 * Operational cancellation of a booking by the Parking Owner.
 */
export async function cancelOwnerBookingHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Booking ID is required.', 400, 'MISSING_BOOKING_ID');
    }
    const cancelledBooking = await ownerService.cancelOwnerBooking(
      req.userId!,
      id,
      req.body,
      {
        ipAddress: normalizeIp(req.ip) || undefined,
        userAgent: req.get('user-agent'),
      },
    );
    sendSuccess(res, 'Booking cancelled successfully.', cancelledBooking);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/owner/bookings/:id/extend
 * Operational extension of an active or confirmed booking by the Parking Owner.
 */
export async function extendOwnerBookingHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Booking ID is required.', 400, 'MISSING_BOOKING_ID');
    }
    const extendedBooking = await ownerService.extendOwnerBooking(
      req.userId!,
      id,
      req.body,
      {
        ipAddress: normalizeIp(req.ip) || undefined,
        userAgent: req.get('user-agent'),
      },
    );
    sendSuccess(res, 'Booking extended successfully.', extendedBooking);
  } catch (error) {
    next(error);
  }
}

// =========================================================================
// Owner Module Phase 4: Staff Management Handlers
// =========================================================================

/**
 * GET /api/v1/owner/staff
 * Retrieve all security staff assigned to owner's facilities.
 */
export async function getOwnerStaffHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { parkingLotId, accountStatus, assignmentStatus, search, page, limit } = req.query;

    const result = await ownerService.getOwnerStaff(req.userId!, {
      parkingLotId: typeof parkingLotId === 'string' ? parkingLotId : undefined,
      accountStatus: typeof accountStatus === 'string' ? accountStatus : undefined,
      assignmentStatus: typeof assignmentStatus === 'string' ? assignmentStatus : undefined,
      search: typeof search === 'string' ? search : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    sendSuccess(res, 'Security staff list retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/staff/:id
 * Retrieve single staff member details, assignment history, and operational stats.
 */
export async function getOwnerStaffByIdHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Staff ID is required.', 400, 'MISSING_STAFF_ID');
    }

    const result = await ownerService.getOwnerStaffById(req.userId!, id);
    sendSuccess(res, 'Staff details retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/owner/staff/invite
 * Invite / add a new or existing Security Staff to an owned parking facility.
 */
export async function inviteOwnerStaffHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await ownerService.inviteOwnerStaff(req.userId!, req.body);
    sendSuccess(res, 'Security staff invited successfully.', result, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/owner/staff/:id/assign
 * Assign an existing security staff member to an additional owned facility.
 */
export async function assignOwnerStaffHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Staff ID is required.', 400, 'MISSING_STAFF_ID');
    }

    const result = await ownerService.assignOwnerStaff(req.userId!, id, req.body);
    sendSuccess(res, 'Security staff assigned to facility successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/owner/staff/:id/status
 * Suspend/activate staff account, or deactivate facility assignment.
 */
export async function updateOwnerStaffStatusHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Staff ID is required.', 400, 'MISSING_STAFF_ID');
    }

    const result = await ownerService.updateOwnerStaffStatus(req.userId!, id, req.body);
    sendSuccess(res, 'Security staff status updated successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/owner/staff/:id
 * Update permitted staff information (Name, Mobile, Employee ID).
 */
export async function updateOwnerStaffHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Staff ID is required.', 400, 'MISSING_STAFF_ID');
    }

    const result = await ownerService.updateOwnerStaff(req.userId!, id, req.body);
    sendSuccess(res, 'Security staff details updated successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/owner/staff/:id/resend-invitation
 * Resend invitation email to security staff member.
 */
export async function resendOwnerStaffInvitationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Staff ID is required.', 400, 'MISSING_STAFF_ID');
    }

    const result = await ownerService.resendStaffInvitation(req.userId!, id);
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

