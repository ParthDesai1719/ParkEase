import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  customerParkingService,
  type CustomerParkingSearchQuery,
} from '../services/customerParking.service.js';
import {
  customerBookingService,
  type CustomerBookingCategory,
  type SupportedVehicleType,
} from '../services/customerBooking.service.js';
import { securityService } from '../services/security.service.js';
import { AppError } from '../utils/AppError.js';

// Resolve uploads root directory dynamically whether running from project root or server dir
const uploadsRoot = fs.existsSync(path.resolve(process.cwd(), 'server', 'uploads'))
  ? path.resolve(process.cwd(), 'server', 'uploads')
  : path.resolve(process.cwd(), 'uploads');
const photosUploadsRoot = path.resolve(uploadsRoot, 'submissions', 'photos');

export async function searchCustomerParking(req: Request, res: Response): Promise<void> {
  const {
    search,
    latitude,
    longitude,
    maxDistanceKm,
    vehicleType,
    minPrice,
    maxPrice,
    minRating,
    coveredParking,
    evCharging,
    is24x7,
    availability,
    openNow,
    sortBy,
    sortOrder,
    page,
    limit,
  } = req.query;

  const parsedQuery: CustomerParkingSearchQuery = {};

  if (typeof search === 'string' && search.trim()) {
    parsedQuery.search = search.trim();
  }

  if (latitude !== undefined && latitude !== '') {
    const lat = Number(latitude);
    if (!isNaN(lat) && lat >= -90 && lat <= 90) {
      parsedQuery.latitude = lat;
    }
  }

  if (longitude !== undefined && longitude !== '') {
    const lng = Number(longitude);
    if (!isNaN(lng) && lng >= -180 && lng <= 180) {
      parsedQuery.longitude = lng;
    }
  }

  if (maxDistanceKm !== undefined && maxDistanceKm !== '') {
    const dist = Number(maxDistanceKm);
    if (!isNaN(dist) && dist > 0) {
      parsedQuery.maxDistanceKm = dist;
    }
  }

  if (
    typeof vehicleType === 'string' &&
    ['All', 'Car', 'Bike', 'SUV', 'EV'].includes(vehicleType)
  ) {
    parsedQuery.vehicleType = vehicleType as 'All' | 'Car' | 'Bike' | 'SUV' | 'EV';
  }

  if (minPrice !== undefined && minPrice !== '') {
    const price = Number(minPrice);
    if (!isNaN(price) && price >= 0) {
      parsedQuery.minPrice = price;
    }
  }

  if (maxPrice !== undefined && maxPrice !== '') {
    const price = Number(maxPrice);
    if (!isNaN(price) && price > 0) {
      parsedQuery.maxPrice = price;
    }
  }

  if (minRating !== undefined && minRating !== '') {
    const rating = Number(minRating);
    if (!isNaN(rating) && rating >= 1 && rating <= 5) {
      parsedQuery.minRating = rating;
    }
  }

  if (coveredParking === 'true') {
    parsedQuery.coveredParking = true;
  }

  if (evCharging === 'true') {
    parsedQuery.evCharging = true;
  }

  if (is24x7 === 'true') {
    parsedQuery.is24x7 = true;
  }

  if (openNow === 'true') {
    parsedQuery.openNow = true;
  }

  if (availability === 'Available' || availability === 'All') {
    parsedQuery.availability = availability;
  }

  if (
    typeof sortBy === 'string' &&
    ['distance', 'lowestPrice', 'highestRated', 'availableSlots', 'occupancyPercentage'].includes(
      sortBy,
    )
  ) {
    parsedQuery.sortBy = sortBy as CustomerParkingSearchQuery['sortBy'];
  }

  if (sortOrder === 'asc' || sortOrder === 'desc') {
    parsedQuery.sortOrder = sortOrder;
  }

  if (page !== undefined && page !== '') {
    const p = parseInt(String(page), 10);
    if (!isNaN(p) && p > 0) parsedQuery.page = p;
  }

  if (limit !== undefined && limit !== '') {
    const l = parseInt(String(limit), 10);
    if (!isNaN(l) && l > 0 && l <= 50) parsedQuery.limit = l;
  }

  const result = await customerParkingService.searchParkingLots(parsedQuery);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function getCustomerParkingDetails(req: Request, res: Response): Promise<void> {
  const paramId = req.params.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const { latitude, longitude } = req.query;

  if (!id) {
    throw new AppError('Parking facility ID is required.', 400, 'ID_REQUIRED');
  }

  let userLat: number | undefined;
  let userLng: number | undefined;

  if (latitude !== undefined && latitude !== '') {
    const lat = Number(latitude);
    if (!isNaN(lat)) userLat = lat;
  }

  if (longitude !== undefined && longitude !== '') {
    const lng = Number(longitude);
    if (!isNaN(lng)) userLng = lng;
  }

  const facility = await customerParkingService.getParkingLotDetails(id, userLat, userLng);

  res.status(200).json({
    success: true,
    data: facility,
  });
}

export async function getFacilityReviews(req: Request, res: Response): Promise<void> {
  const paramId = req.params.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;

  if (!id) {
    throw new AppError('Parking facility ID is required.', 400, 'ID_REQUIRED');
  }

  const reviewsData = await customerParkingService.getFacilityReviews(id);

  res.status(200).json({
    success: true,
    data: reviewsData,
  });
}

export async function getFavouriteStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const paramId = req.params.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const userId = req.userId;

  if (!id) {
    throw new AppError('Parking facility ID is required.', 400, 'ID_REQUIRED');
  }

  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const status = await customerParkingService.getFavouriteStatus(userId, id);

  res.status(200).json({
    success: true,
    data: status,
  });
}

export async function toggleFavourite(req: AuthenticatedRequest, res: Response): Promise<void> {
  const paramId = req.params.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const userId = req.userId;

  if (!id) {
    throw new AppError('Parking facility ID is required.', 400, 'ID_REQUIRED');
  }

  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const status = await customerParkingService.toggleFavourite(userId, id);

  res.status(200).json({
    success: true,
    data: status,
  });
}

/**
 * Stream public facility photo for customer views and map previews
 */
export async function streamFacilityPhoto(req: Request, res: Response): Promise<void> {
  const paramFilename = req.params.filename;
  const rawFilename = Array.isArray(paramFilename) ? paramFilename[0] : paramFilename;

  if (!rawFilename) {
    throw new AppError('Filename parameter is required.', 400, 'FILENAME_REQUIRED');
  }

  // Prevent path traversal
  const safeFilename = path.basename(rawFilename);
  const ext = path.extname(safeFilename).toLowerCase();
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

  if (!allowedExtensions.includes(ext)) {
    throw new AppError('Requested file type is not supported.', 400, 'INVALID_FILE_TYPE');
  }

  // Strictly confine targetPath to photosUploadsRoot ONLY
  const targetPath = path.resolve(photosUploadsRoot, safeFilename);

  // Path confinement and directory traversal verification
  const relative = path.relative(photosUploadsRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new AppError('Access to requested file is forbidden.', 403, 'FORBIDDEN');
  }

  if (!fs.existsSync(targetPath)) {
    throw new AppError('Facility photo not found on server.', 404, 'FILE_NOT_FOUND');
  }

  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.svg') mimeType = 'image/svg+xml';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day client cache
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);

  res.sendFile(targetPath);
}

/**
 * Retrieve complete 2D layout, slot eligibility, and price breakdown for customer booking
 */
export async function getBookingContext(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const paramId = req.params.id;
  const parkingLotId = Array.isArray(paramId) ? paramId[0] : paramId;

  if (!parkingLotId) {
    throw new AppError('Parking facility ID is required.', 400, 'ID_REQUIRED');
  }

  const { floorId, vehicleType, scheduledEntryTime, scheduledExitTime } = req.query;

  const validVehicleTypes: SupportedVehicleType[] = ['Bike', 'Car', 'SUV', 'EV'];
  const parsedVehicleType =
    typeof vehicleType === 'string' && validVehicleTypes.includes(vehicleType as SupportedVehicleType)
      ? (vehicleType as SupportedVehicleType)
      : undefined;

  const context = await customerBookingService.getBookingContext({
    parkingLotId,
    floorId: typeof floorId === 'string' && floorId.trim() ? floorId.trim() : undefined,
    vehicleType: parsedVehicleType,
    scheduledEntryTime:
      typeof scheduledEntryTime === 'string' && scheduledEntryTime.trim()
        ? scheduledEntryTime.trim()
        : undefined,
    scheduledExitTime:
      typeof scheduledExitTime === 'string' && scheduledExitTime.trim()
        ? scheduledExitTime.trim()
        : undefined,
  });

  res.status(200).json({
    success: true,
    data: context,
  });
}

/**
 * Validate a selected slot for a specific time window and vehicle type
 */
export async function validateBookingSlot(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const paramId = req.params.id;
  const parkingLotId = Array.isArray(paramId) ? paramId[0] : paramId;

  if (!parkingLotId) {
    throw new AppError('Parking facility ID is required.', 400, 'ID_REQUIRED');
  }

  const { slotId, vehicleType, scheduledEntryTime, scheduledExitTime } = req.body as {
    slotId?: string;
    vehicleType?: string;
    scheduledEntryTime?: string;
    scheduledExitTime?: string;
  };

  if (!slotId || !vehicleType || !scheduledEntryTime || !scheduledExitTime) {
    throw new AppError(
      'slotId, vehicleType, scheduledEntryTime, and scheduledExitTime are required.',
      400,
      'MISSING_FIELDS',
    );
  }

  const validVehicleTypes: SupportedVehicleType[] = ['Bike', 'Car', 'SUV', 'EV'];
  if (!validVehicleTypes.includes(vehicleType as SupportedVehicleType)) {
    throw new AppError('Invalid vehicle type.', 400, 'INVALID_VEHICLE_TYPE');
  }

  const result = await customerBookingService.validateSlotEligibility({
    parkingLotId,
    slotId,
    vehicleType: vehicleType as SupportedVehicleType,
    scheduledEntryTime,
    scheduledExitTime,
  });

  res.status(200).json({
    success: true,
    data: {
      isEligible: result.isEligible,
      slotNumber: result.slot.slotNumber,
      floorName: result.floor.floorName,
      zoneCode: result.zone.zoneCode,
      priceBreakdown: result.breakdown,
    },
  });
}

/**
 * Retrieve authenticated customer's active registered vehicles
 */
export async function getCustomerVehicles(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const vehicles = await customerBookingService.getCustomerVehicles(userId);
  res.status(200).json({
    success: true,
    data: vehicles,
  });
}

/**
 * Add a new vehicle for the authenticated customer
 */
export async function addCustomerVehicle(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { vehicleNumber, vehicleType, vehicleBrand, vehicleModel, vehicleColor, fuelType } =
    req.body as {
      vehicleNumber?: string;
      vehicleType?: string;
      vehicleBrand?: string;
      vehicleModel?: string;
      vehicleColor?: string;
      fuelType?: 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid';
    };

  if (!vehicleNumber || !vehicleType || !vehicleBrand || !vehicleModel) {
    throw new AppError(
      'Vehicle registration number, type, brand, and model are required.',
      400,
      'MISSING_VEHICLE_FIELDS',
    );
  }

  const validVehicleTypes: SupportedVehicleType[] = ['Bike', 'Car', 'SUV', 'EV'];
  if (!validVehicleTypes.includes(vehicleType as SupportedVehicleType)) {
    throw new AppError('Invalid vehicle type.', 400, 'INVALID_VEHICLE_TYPE');
  }

  const created = await customerBookingService.addCustomerVehicle(userId, {
    vehicleNumber,
    vehicleType: vehicleType as SupportedVehicleType,
    vehicleBrand,
    vehicleModel,
    vehicleColor,
    fuelType,
  });

  res.status(201).json({
    success: true,
    data: created,
  });
}

/**
 * Initiate booking payment order via Razorpay
 */
export async function initiateBookingPayment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const paramId = req.params.id;
  const parkingLotId = Array.isArray(paramId) ? paramId[0] : paramId;

  if (!parkingLotId) {
    throw new AppError('Parking facility ID is required.', 400, 'ID_REQUIRED');
  }

  const { slotId, vehicleId, scheduledEntryTime, scheduledExitTime } = req.body as {
    slotId?: string;
    vehicleId?: string;
    scheduledEntryTime?: string;
    scheduledExitTime?: string;
  };

  if (!slotId || !vehicleId || !scheduledEntryTime || !scheduledExitTime) {
    throw new AppError(
      'slotId, vehicleId, scheduledEntryTime, and scheduledExitTime are required.',
      400,
      'MISSING_BOOKING_FIELDS',
    );
  }

  const result = await customerBookingService.initiateBookingPayment({
    userId,
    parkingLotId,
    slotId,
    vehicleId,
    scheduledEntryTime,
    scheduledExitTime,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
}

/**
 * Verify Razorpay signature and confirm booking atomically
 */
export async function verifyBookingPayment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    bookingId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError(
      'bookingId, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
      400,
      'MISSING_PAYMENT_VERIFICATION_FIELDS',
    );
  }

  const result = await customerBookingService.verifyPaymentAndConfirmBooking(
    {
      userId,
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    },
    req.ip,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * Record payment cancellation or failure so pending booking does not linger
 */
export async function failBookingPayment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { bookingId, reason } = req.body as {
    bookingId?: string;
    reason?: string;
  };

  if (!bookingId) {
    throw new AppError('bookingId is required.', 400, 'BOOKING_ID_REQUIRED');
  }

  const result = await customerBookingService.recordPaymentFailure({
    userId,
    bookingId,
    reason,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * Send or resend official booking confirmation & payment receipt email
 */
export async function emailBookingReceipt(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const paramBookingId = req.params.bookingId;
  const bookingId = Array.isArray(paramBookingId) ? paramBookingId[0] : paramBookingId;

  if (!bookingId) {
    throw new AppError('Booking ID is required.', 400, 'BOOKING_ID_REQUIRED');
  }

  const result = await customerBookingService.emailBookingReceipt({
    userId,
    bookingId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * Retrieve complete Customer Dashboard overview (active booking, upcoming booking,
 * recent activity, 6-month booking chart, favourite locations, unread notifications)
 */
export async function getCustomerDashboard(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { latitude, longitude } = req.query;
  let userLat: number | undefined;
  let userLng: number | undefined;

  if (latitude !== undefined && latitude !== '') {
    const lat = Number(latitude);
    if (!isNaN(lat)) userLat = lat;
  }
  if (longitude !== undefined && longitude !== '') {
    const lng = Number(longitude);
    if (!isNaN(lng)) userLng = lng;
  }

  const overview = await customerBookingService.getCustomerDashboardOverview({
    userId,
    userLat,
    userLng,
  });

  res.status(200).json({
    success: true,
    data: overview,
  });
}

/**
 * Retrieve authenticated customer's paginated bookings with category and search filters
 */
export async function getCustomerBookings(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { category, search, parkingLotId, dateFrom, dateTo, page, limit } = req.query;

  const validCategories: CustomerBookingCategory[] = [
    'Upcoming',
    'Active',
    'Completed',
    'Cancelled',
    'No Show',
    'Overstay',
    'All',
  ];

  const parsedCategory: CustomerBookingCategory =
    typeof category === 'string' && validCategories.includes(category as CustomerBookingCategory)
      ? (category as CustomerBookingCategory)
      : 'Upcoming';

  const parsedPage =
    page !== undefined && page !== '' ? Math.max(1, parseInt(String(page), 10) || 1) : 1;
  const parsedLimit =
    limit !== undefined && limit !== ''
      ? Math.min(50, Math.max(1, parseInt(String(limit), 10) || 8))
      : 8;

  const result = await customerBookingService.getCustomerBookings({
    userId,
    category: parsedCategory,
    search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
    parkingLotId:
      typeof parkingLotId === 'string' && parkingLotId.trim() && parkingLotId !== 'All'
        ? parkingLotId.trim()
        : undefined,
    dateFrom: typeof dateFrom === 'string' && dateFrom.trim() ? dateFrom.trim() : undefined,
    dateTo: typeof dateTo === 'string' && dateTo.trim() ? dateTo.trim() : undefined,
    page: parsedPage,
    limit: parsedLimit,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * Retrieve a single booking's details, timeline, QR pass, and receipt for the authenticated customer
 */
export async function getCustomerBookingDetails(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const paramBookingId = req.params.bookingId;
  const bookingId = Array.isArray(paramBookingId) ? paramBookingId[0] : paramBookingId;

  if (!bookingId) {
    throw new AppError('Booking ID is required.', 400, 'BOOKING_ID_REQUIRED');
  }

  const result = await customerBookingService.getCustomerBookingDetails({
    userId,
    bookingId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * Retrieve authenticated customer's saved favourite parking locations
 */
export async function getCustomerFavourites(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { latitude, longitude } = req.query;
  let userLat: number | undefined;
  let userLng: number | undefined;

  if (latitude !== undefined && latitude !== '') {
    const lat = Number(latitude);
    if (!isNaN(lat)) userLat = lat;
  }
  if (longitude !== undefined && longitude !== '') {
    const lng = Number(longitude);
    if (!isNaN(lng)) userLng = lng;
  }

  const favourites = await customerParkingService.getCustomerFavourites(userId, userLat, userLng);

  res.status(200).json({
    success: true,
    data: favourites,
  });
}

/**
 * Cancel an upcoming confirmed booking for the authenticated customer
 */
export async function cancelCustomerBooking(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { bookingId } = req.params;
  const { reason } = req.body as { reason?: string };

  const rawBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  if (!rawBookingId) {
    throw new AppError('Booking ID is required.', 400, 'INVALID_BOOKING_ID');
  }

  const result = await customerBookingService.cancelBooking({
    bookingId: rawBookingId,
    userId,
    cancelledBy: 'Customer',
    reason,
  });

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully.',
    data: result,
  });
}

/**
 * Gate check-in action for a confirmed booking
 */
export async function checkInCustomerBooking(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { bookingId } = req.params;
  const rawBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  if (!rawBookingId) {
    throw new AppError('Booking ID is required.', 400, 'INVALID_BOOKING_ID');
  }

  const result = await customerBookingService.recordVehicleEntry({
    bookingId: rawBookingId,
    performedBy: userId,
  });

  res.status(200).json({
    success: true,
    message: 'Vehicle checked in successfully. Session is now Active.',
    data: result,
  });
}

/**
 * Gate check-out action for an active booking
 */
export async function checkOutCustomerBooking(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { bookingId } = req.params;
  const rawBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  if (!rawBookingId) {
    throw new AppError('Booking ID is required.', 400, 'INVALID_BOOKING_ID');
  }

  const result = await customerBookingService.completeBookingExit({
    bookingId: rawBookingId,
    performedBy: userId,
  });

  res.status(200).json({
    success: true,
    message: 'Vehicle checked out successfully. Session is now Completed.',
    data: result,
  });
}

/**
 * Customer online overstay payment initialization (Razorpay order)
 */
export async function initiateOverstayPayment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const customerId = req.userId;
  if (!customerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { bookingId } = req.params;
  const rawBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  if (!rawBookingId) {
    throw new AppError('Booking ID is required.', 400, 'INVALID_BOOKING_ID');
  }

  const orderData = await securityService.initiateCustomerOverstayPayment({
    customerId,
    bookingId: rawBookingId,
  });

  res.status(200).json({
    success: true,
    message: 'Overstay payment order initiated successfully.',
    data: orderData,
  });
}

/**
 * Customer online overstay payment verification (Razorpay signature)
 */
export async function verifyOverstayPayment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const customerId = req.userId;
  if (!customerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { bookingId } = req.params;
  const rawBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  if (!rawBookingId) {
    throw new AppError('Booking ID is required.', 400, 'INVALID_BOOKING_ID');
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError(
      'Razorpay payment verification payload is incomplete.',
      400,
      'INVALID_PAYMENT_PAYLOAD',
    );
  }

  const result = await securityService.verifyCustomerOverstayPayment({
    customerId,
    bookingId: rawBookingId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  res.status(200).json({
    success: true,
    message: 'Overstay payment verified successfully.',
    data: result,
  });
}

