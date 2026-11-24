import { apiClient } from './client';

export interface VehicleTypeAvailability {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
}

export interface FacilityPricingDetails {
  carHourlyRate: number;
  suvHourlyRate: number;
  bikeHourlyRate: number;
  dailyRate: number;
  overnightRate: number;
  evChargingRatePerHour: number;
  gracePeriodMinutes: number;
  minParkingDurationHours: number;
  maxParkingDurationHours: number;
  additionalPricingNotes: string;
}

export interface FacilityRulesDetails {
  rules: string;
  entryExitInstructions: string;
  vehicleRestrictions: string;
  heightWeightRestrictions: string;
  evRules: string;
  accessibleParkingRules: string;
  vipParkingRules: string;
  overnightRules: string;
  otherInstructions: string;
}

export interface FacilityOperatingDetails {
  isOpen24x7: boolean;
  openingTime: string;
  closingTime: string;
  scheduleType: string;
  dailySchedules: Array<{
    day: string;
    isOpen: boolean;
    openingTime: string;
    closingTime: string;
  }>;
}

export interface FacilityFloorSummary {
  _id: string;
  floorName: string;
  floorNumber: number;
  floorStatus: string;
  totalSlots?: number;
}

export interface CustomerReviewItem {
  _id: string;
  customerName: string;
  customerImage?: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  ownerReply: string | null;
  replyDate: string | null;
}

export interface FacilityReviewsResponse {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  reviews: CustomerReviewItem[];
}

export interface CustomerParkingLotResult {
  _id: string;
  parkingName: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  hourlyRate: number;
  gracePeriodMinutes: number;
  openingTime: string;
  closingTime: string;
  isOpen24Hours: boolean;
  isOpenNow: boolean;
  totalFloors: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyPercentage: number;
  averageRating: number;
  totalReviews: number;
  amenities: string[];
  parkingImages: string[];
  isVerified: boolean;
  parkingStatus: string;
  hasPublishedLayout: boolean;
  contactNumber?: string;
  supportEmail?: string | null;
  facilityType?: string;
  pricing?: FacilityPricingDetails;
  rules?: FacilityRulesDetails;
  operatingHours?: FacilityOperatingDetails;
  floors?: FacilityFloorSummary[];
  vehicleAvailability: {
    car: VehicleTypeAvailability;
    bike: VehicleTypeAvailability;
    suv: VehicleTypeAvailability;
    ev: VehicleTypeAvailability;
  };
}

export interface CustomerParkingSearchParams {
  search?: string;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
  vehicleType?: 'All' | 'Car' | 'Bike' | 'SUV' | 'EV';
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  coveredParking?: boolean;
  evCharging?: boolean;
  is24x7?: boolean;
  availability?: 'All' | 'Available';
  openNow?: boolean;
  sortBy?: 'distance' | 'lowestPrice' | 'highestRated' | 'availableSlots' | 'occupancyPercentage';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedCustomerSearchResponse {
  parkingLots: CustomerParkingLotResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  activeFilters: {
    search?: string;
    vehicleType?: string;
    maxDistanceKm?: number;
    priceRange?: { min?: number; max?: number };
    minRating?: number;
    hasUserLocation: boolean;
  };
}

export interface CustomerParkingDetailsResponse {
  success: boolean;
  data: CustomerParkingLotResult;
}

/**
 * Resolves a facility image path or filename into a fully qualified image URL
 */
export function getFacilityImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  const trimmed = imagePath.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Normalize Windows and POSIX separators
  const cleanPath = trimmed.replace(/\\/g, '/');
  const filename = cleanPath.split('/').filter(Boolean).pop();
  if (!filename) return null;

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  return `${baseUrl}/customer/parking/photos/${encodeURIComponent(filename)}`;
}

/**
 * Searches customer-visible active parking facilities with filters, sorting, and geolocation
 */
export async function searchCustomerParkingLots(
  params: CustomerParkingSearchParams,
): Promise<PaginatedCustomerSearchResponse> {
  const queryParams: Record<string, string | number | boolean> = {};

  if (params.search?.trim()) queryParams.search = params.search.trim();
  if (params.latitude !== undefined && !isNaN(params.latitude)) queryParams.latitude = params.latitude;
  if (params.longitude !== undefined && !isNaN(params.longitude)) queryParams.longitude = params.longitude;
  if (params.maxDistanceKm !== undefined && params.maxDistanceKm > 0) queryParams.maxDistanceKm = params.maxDistanceKm;
  if (params.vehicleType && params.vehicleType !== 'All') queryParams.vehicleType = params.vehicleType;
  if (params.minPrice !== undefined && params.minPrice >= 0) queryParams.minPrice = params.minPrice;
  if (params.maxPrice !== undefined && params.maxPrice > 0) queryParams.maxPrice = params.maxPrice;
  if (params.minRating !== undefined && params.minRating > 0) queryParams.minRating = params.minRating;
  if (params.coveredParking) queryParams.coveredParking = true;
  if (params.evCharging) queryParams.evCharging = true;
  if (params.is24x7) queryParams.is24x7 = true;
  if (params.openNow) queryParams.openNow = true;
  if (params.availability && params.availability !== 'All') queryParams.availability = params.availability;
  if (params.sortBy) queryParams.sortBy = params.sortBy;
  if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
  if (params.page !== undefined && params.page > 0) queryParams.page = params.page;
  if (params.limit !== undefined && params.limit > 0) queryParams.limit = params.limit;

  const response = await apiClient.get<{ success: boolean; data: PaginatedCustomerSearchResponse }>(
    '/customer/parking/search',
    { params: queryParams },
  );

  return response.data.data;
}

/**
 * Retrieves public details of a single parking facility
 */
export async function getCustomerParkingFacilityDetails(
  parkingLotId: string,
  userLat?: number,
  userLng?: number,
): Promise<CustomerParkingLotResult> {
  const queryParams: Record<string, number> = {};
  if (userLat !== undefined && !isNaN(userLat)) queryParams.latitude = userLat;
  if (userLng !== undefined && !isNaN(userLng)) queryParams.longitude = userLng;

  const response = await apiClient.get<CustomerParkingDetailsResponse>(
    `/customer/parking/${parkingLotId}`,
    { params: queryParams },
  );

  return response.data.data;
}

/**
 * Retrieves verified reviews and rating distribution for a facility
 */
export async function getFacilityReviews(
  parkingLotId: string,
): Promise<FacilityReviewsResponse> {
  const response = await apiClient.get<{ success: boolean; data: FacilityReviewsResponse }>(
    `/customer/parking/${parkingLotId}/reviews`,
  );
  return response.data.data;
}

/**
 * Retrieves the current user's favourite status for a facility
 */
export async function getFacilityFavouriteStatus(
  parkingLotId: string,
): Promise<boolean> {
  const response = await apiClient.get<{ success: boolean; data: { isFavourite: boolean } }>(
    `/customer/parking/${parkingLotId}/favourite`,
  );
  return Boolean(response.data.data.isFavourite);
}

/**
 * Toggles the current user's favourite status for a facility
 */
export async function toggleFacilityFavourite(
  parkingLotId: string,
): Promise<boolean> {
  const response = await apiClient.post<{ success: boolean; data: { isFavourite: boolean } }>(
    `/customer/parking/${parkingLotId}/favourite`,
  );
  return Boolean(response.data.data.isFavourite);
}

// ============================================================================
// PHASE 3.3 — CUSTOMER SLOT SELECTION & BOOKING API
// ============================================================================

export type BookingVehicleType = 'Bike' | 'Car' | 'SUV' | 'EV';

export type EffectiveSlotStatus =
  | 'Available'
  | 'Reserved'
  | 'Occupied'
  | 'Under Maintenance';

export interface CustomerBookingSlotInfo {
  _id: string;
  slotNumber: string;
  slotLabel: string;
  slotType: string;
  supportedVehicleType: BookingVehicleType;
  floorId: string;
  floorName: string;
  floorNumber: number;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  physicalStatus: string;
  effectiveStatus: EffectiveSlotStatus;
  isVehicleCompatible: boolean;
  isEligible: boolean;
  ineligibilityReason: string | null;
  expectedAvailableAt?: string | null;
  expectedAvailableMinutes?: number | null;
  isOverflow?: boolean;
}

export interface PriceBreakdownResult {
  vehicleType: BookingVehicleType;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  bookingDurationMinutes: number;
  billableHours: number;
  hourlyRate: number;
  overstayRateAtBooking: number;
  gracePeriodMinutes: number;
  baseAmount: number;
  additionalCharges: number;
  platformBookingFee?: number;
  totalAmount: number;
  appliedPricingTier: string;
}

export interface BookingFloorContext {
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
    floorStatus: string;
    totalSlots: number;
  };
  zones: Array<{
    _id: string;
    zoneCode: string;
    zoneName: string;
    vehicleType: string | null;
    zoneStatus: string;
    totalSlots: number;
  }>;
  layout: {
    _id: string;
    version: number;
    canvasConfig: {
      width: number;
      height: number;
      gridSize: number;
      snapToGrid: boolean;
      backgroundColor: string;
    };
    elements: import('./parkingLot.api').LayoutElementData[];
  };
  slots: CustomerBookingSlotInfo[];
  slotSummary: {
    totalSlots: number;
    availableCount: number;
    reservedCount: number;
    occupiedCount: number;
    maintenanceCount: number;
    compatibleAvailableCount: number;
  };
}

export interface BookingContextResponse {
  facility: {
    _id: string;
    parkingName: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    hourlyRate: number;
    gracePeriodMinutes: number;
    openingTime: string;
    closingTime: string;
    isOpen24Hours: boolean;
    pricing: {
      carHourlyRate: number;
      suvHourlyRate: number;
      bikeHourlyRate: number;
      dailyRate: number;
      overnightRate: number;
      evChargingRatePerHour: number;
      gracePeriodMinutes: number;
      minParkingDurationHours: number;
      maxParkingDurationHours: number;
    };
    vehicleCapacityByType?: Record<
      BookingVehicleType,
      { totalSlots: number; operationalSlots: number; isOffered: boolean }
    >;
  };
  floors: Array<{
    _id: string;
    floorName: string;
    floorNumber: number;
    floorStatus: string;
    totalSlots: number;
  }>;
  activeFloor: BookingFloorContext;
  priceBreakdown: PriceBreakdownResult;
}

export interface CustomerVehicleRecord {
  _id: string;
  customerId: string;
  vehicleNumber: string;
  vehicleType: BookingVehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor?: string | null;
  fuelType?: string;
  isDefault: boolean;
  vehicleStatus: string;
  hasActiveBooking?: boolean;
  activeBookingId?: string | null;
  activeBookingReference?: string | null;
  activeBookingStatus?: string | null;
}

export interface InitiateBookingPaymentResponse {
  bookingId: string;
  bookingReference: string;
  paymentReference: string;
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  customer: {
    name: string;
    email: string;
    contact: string;
  };
  summary: {
    facilityName: string;
    floorName: string;
    zoneCode: string;
    slotNumber: string;
    vehicleNumber: string;
    vehicleType: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    bookingDurationMinutes: number;
    totalAmount: number;
  };
}

export interface VerifyBookingPaymentResponse {
  bookingStatus: 'Confirmed' | 'Cancelled';
  bookingReference: string;
  bookingId: string;
  qrCode: string | null;
  paymentReference: string;
  paymentStatus: 'SUCCESSFUL' | 'REFUNDED' | 'FAILED';
  transactionId: string | null;
  conflictRefundInitiated?: boolean;
  message: string;
  customerDetails: {
    fullName: string;
    email: string;
    mobileNumber: string;
  };
  paymentDetails: {
    paymentReference: string;
    paymentMethod: string;
    paymentStatus: 'SUCCESSFUL' | 'REFUNDED' | 'FAILED';
    paymentDate: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    paymentVerificationReference: string;
  };
  bookingDetails: {
    facilityName: string;
    address: string;
    floorName: string;
    zoneName: string;
    zoneCode: string;
    slotNumber: string;
    slotLabel: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleBrand?: string | null;
    vehicleModel?: string | null;
    bookingType: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    gracePeriodMinutes: number;
    bookingDurationMinutes: number;
    parkingRateAtBooking?: number;
    baseAmount: number;
    taxes: number;
    discountAmount: number;
    additionalCharges: number;
    totalAmount: number;
  };
}

/**
 * Retrieves the complete published 2D floor layout, real-time slot eligibility, and price breakdown
 */
export async function getCustomerBookingContext(params: {
  parkingLotId: string;
  floorId?: string;
  vehicleType?: BookingVehicleType;
  scheduledEntryTime?: string;
  scheduledExitTime?: string;
}): Promise<BookingContextResponse> {
  const queryParams: Record<string, string> = {};
  if (params.floorId) queryParams.floorId = params.floorId;
  if (params.vehicleType) queryParams.vehicleType = params.vehicleType;
  if (params.scheduledEntryTime) queryParams.scheduledEntryTime = params.scheduledEntryTime;
  if (params.scheduledExitTime) queryParams.scheduledExitTime = params.scheduledExitTime;

  const response = await apiClient.get<{ success: boolean; data: BookingContextResponse }>(
    `/customer/parking/${params.parkingLotId}/booking-context`,
    { params: queryParams },
  );
  return response.data.data;
}

/**
 * Validates a specific slot before initiating payment
 */
export async function validateCustomerBookingSlot(params: {
  parkingLotId: string;
  slotId: string;
  vehicleType: BookingVehicleType;
  scheduledEntryTime: string;
  scheduledExitTime: string;
}): Promise<{
  isEligible: boolean;
  slotNumber: string;
  floorName: string;
  zoneCode: string;
  priceBreakdown: PriceBreakdownResult;
}> {
  const response = await apiClient.post<{
    success: boolean;
    data: {
      isEligible: boolean;
      slotNumber: string;
      floorName: string;
      zoneCode: string;
      priceBreakdown: PriceBreakdownResult;
    };
  }>(`/customer/parking/${params.parkingLotId}/validate-slot`, {
    slotId: params.slotId,
    vehicleType: params.vehicleType,
    scheduledEntryTime: params.scheduledEntryTime,
    scheduledExitTime: params.scheduledExitTime,
  });
  return response.data.data;
}

/**
 * Retrieves active vehicles belonging to the authenticated customer
 */
export async function getCustomerRegisteredVehicles(): Promise<CustomerVehicleRecord[]> {
  const response = await apiClient.get<{ success: boolean; data: CustomerVehicleRecord[] }>(
    '/customer/parking/vehicles',
  );
  return response.data.data;
}

/**
 * Adds a new vehicle for the authenticated customer
 */
export async function addCustomerRegisteredVehicle(input: {
  vehicleNumber: string;
  vehicleType: BookingVehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor?: string;
  fuelType?: 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid';
}): Promise<CustomerVehicleRecord> {
  const response = await apiClient.post<{ success: boolean; data: CustomerVehicleRecord }>(
    '/customer/parking/vehicles',
    input,
  );
  return response.data.data;
}

/**
 * Initiates a booking and Razorpay payment order
 */
export async function initiateCustomerBookingPayment(params: {
  parkingLotId: string;
  slotId: string;
  vehicleId: string;
  scheduledEntryTime: string;
  scheduledExitTime: string;
}): Promise<InitiateBookingPaymentResponse> {
  const response = await apiClient.post<{
    success: boolean;
    data: InitiateBookingPaymentResponse;
  }>(`/customer/parking/${params.parkingLotId}/bookings/initiate-payment`, {
    slotId: params.slotId,
    vehicleId: params.vehicleId,
    scheduledEntryTime: params.scheduledEntryTime,
    scheduledExitTime: params.scheduledExitTime,
  });
  return response.data.data;
}

/**
 * Verifies Razorpay signature and confirms the booking atomically
 */
export async function verifyCustomerBookingPayment(params: {
  parkingLotId: string;
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<VerifyBookingPaymentResponse> {
  const response = await apiClient.post<{
    success: boolean;
    data: VerifyBookingPaymentResponse;
  }>(`/customer/parking/${params.parkingLotId}/bookings/verify-payment`, {
    bookingId: params.bookingId,
    razorpay_order_id: params.razorpay_order_id,
    razorpay_payment_id: params.razorpay_payment_id,
    razorpay_signature: params.razorpay_signature,
  });
  return response.data.data;
}

/**
 * Records payment cancellation or failure so pending booking is cleaned up
 */
export async function recordCustomerBookingPaymentFailure(params: {
  parkingLotId: string;
  bookingId: string;
  reason?: string;
}): Promise<{ bookingId: string; bookingStatus: string }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { bookingId: string; bookingStatus: string };
  }>(`/customer/parking/${params.parkingLotId}/bookings/payment-failed`, {
    bookingId: params.bookingId,
    reason: params.reason,
  });
  return response.data.data;
}

/**
 * Emails the official booking confirmation & payment receipt to the customer
 */
export async function emailCustomerBookingReceipt(params: {
  parkingLotId: string;
  bookingId: string;
}): Promise<{
  sent: boolean;
  email: string;
  bookingReference: string;
  message: string;
}> {
  const response = await apiClient.post<{
    success: boolean;
    data: {
      sent: boolean;
      email: string;
      bookingReference: string;
      message: string;
    };
  }>(`/customer/parking/${params.parkingLotId}/bookings/${params.bookingId}/email-receipt`);
  return response.data.data;
}

// ============================================================================
// PHASE 3.4 — CUSTOMER DASHBOARD & MY BOOKINGS API
// ============================================================================

export type CustomerBookingCategory =
  | 'Upcoming'
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'
  | 'Overstay'
  | 'All';

export type CanonicalBookingStatus =
  | 'Pending Payment'
  | 'Confirmed'
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'
  | 'Overstay';

export interface CustomerBookingItem {
  bookingId: string;
  bookingReference: string;
  parkingLotId: string;
  parkingName: string;
  parkingAddress: string;
  parkingCity: string;
  parkingImages: string[];
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
  };
  zone: {
    _id: string;
    zoneName: string;
    zoneCode: string;
  };
  currentSlot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
    slotType: string;
    supportedVehicleType: string;
  };
  originalSlot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
  } | null;
  vehicle: {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
    fuelType: string | null;
  };
  bookingType: 'ONLINE' | 'WALK_IN';
  bookingStatus: CanonicalBookingStatus;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  actualEntryTime: string | null;
  actualExitTime: string | null;
  gracePeriodMinutes: number;
  gracePeriodEndsAt: string;
  bookingDurationMinutes: number;
  remainingMinutes: number | null;
  parkingRateAtBooking: number;
  overstayRateAtBooking: number;
  baseAmount: number;
  additionalCharges: number;
  platformBookingFee?: number;
  totalAmount: number;
  canViewQr: boolean;
  qrCode: string | null;
  canDownloadReceipt: boolean;
  payment: {
    paymentReference: string;
    paymentMethod: string;
    paymentStatus: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'CASH_REVERSAL_PENDING';
    paymentDate: string | null;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    transactionId: string | null;
    amount: number;
    refundAmount: number;
    refundStatus: string | null;
    refundReason: string | null;
    refundPercentage: number | null;
    refundCompletedAt: string | null;
  } | null;
  overstay: {
    overstayDetected: boolean;
    overstayStartedAt: string | null;
    overstayDurationMinutes: number;
    overstayCharge: number;
    additionalChargePaymentStatus: 'PAID' | 'UNPAID' | 'NOT_APPLICABLE';
  };
  reassignment: {
    slotReassignmentStatus:
      | 'NOT_REQUIRED'
      | 'PENDING'
      | 'REASSIGNED'
      | 'FAILED'
      | 'CANCELLED_REFUNDED';
    slotReassignmentReason: string | null;
    slotReassignedAt: string | null;
    originalSlotNumber: string | null;
    currentSlotNumber: string;
  };
  cancellation: {
    cancellationReason: string | null;
    cancellationBy: string | null;
    cancelledAt: string | null;
    refundAmount: number;
    refundPercentage: number | null;
    refundStatus: string | null;
  } | null;
  noShowDetected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerBookingTimelineItem {
  _id: string;
  bookingId: string;
  bookingReference: string;
  parkingName: string;
  eventCode: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string | null;
  eventSource: string;
  eventTime: string;
}

export interface CustomerActivityChartPoint {
  monthKey: string;
  label: string;
  totalBookings: number;
  completedBookings: number;
  activeOrUpcomingBookings: number;
  cancelledOrNoShowBookings: number;
  amountSpent: number;
}

export interface CustomerDashboardOverviewResponse {
  stats: {
    activeBookingsCount: number;
    upcomingBookingsCount: number;
    completedBookingsCount: number;
    cancelledBookingsCount: number;
    noShowBookingsCount: number;
    overstayBookingsCount: number;
    totalBookingsCount: number;
    registeredVehiclesCount: number;
    digitalReceiptsCount: number;
    totalSpentAmount: number;
  };
  activeBooking: CustomerBookingItem | null;
  upcomingBooking: CustomerBookingItem | null;
  recentActivity: CustomerBookingTimelineItem[];
  activityChart: {
    hasActivityData: boolean;
    points: CustomerActivityChartPoint[];
  };
  favouriteLocations: Array<CustomerParkingLotResult & { favouritedAt: string }>;
  unreadNotifications: Array<{
    _id: string;
    notificationReference: string;
    bookingId: string | null;
    notificationType: string;
    eventType: string;
    title: string;
    message: string;
    priority: string;
    isRead: boolean;
    actionUrl: string | null;
    createdAt: string;
  }>;
  unreadNotificationCount: number;
}

export interface CustomerBookingsQueryParams {
  category?: CustomerBookingCategory;
  search?: string;
  parkingLotId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedCustomerBookingsResponse {
  bookings: CustomerBookingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categoryCounts: {
    Upcoming: number;
    Active: number;
    Completed: number;
    Cancelled: number;
    'No Show': number;
    Overstay: number;
    All: number;
  };
  facilities: Array<{
    _id: string;
    parkingName: string;
  }>;
}

export interface CustomerBookingDetailsResponse {
  booking: CustomerBookingItem;
  customerDetails: {
    fullName: string;
    email: string;
    mobileNumber: string;
  };
  timeline: CustomerBookingTimelineItem[];
  receiptData: VerifyBookingPaymentResponse | null;
}

/**
 * Retrieves the complete Customer Dashboard overview for `/customer/dashboard`
 */
export async function getCustomerDashboardOverview(params?: {
  latitude?: number;
  longitude?: number;
}): Promise<CustomerDashboardOverviewResponse> {
  const queryParams: Record<string, number> = {};
  if (params?.latitude !== undefined && !isNaN(params.latitude)) {
    queryParams.latitude = params.latitude;
  }
  if (params?.longitude !== undefined && !isNaN(params.longitude)) {
    queryParams.longitude = params.longitude;
  }

  const response = await apiClient.get<{
    success: boolean;
    data: CustomerDashboardOverviewResponse;
  }>('/customer/parking/dashboard', { params: queryParams });

  return response.data.data;
}

/**
 * Retrieves paginated customer bookings with category, search, facility, and date filters
 */
export async function getCustomerBookings(
  params: CustomerBookingsQueryParams = {},
): Promise<PaginatedCustomerBookingsResponse> {
  const queryParams: Record<string, string | number> = {};
  if (params.category) queryParams.category = params.category;
  if (params.search?.trim()) queryParams.search = params.search.trim();
  if (params.parkingLotId && params.parkingLotId !== 'All') {
    queryParams.parkingLotId = params.parkingLotId;
  }
  if (params.dateFrom?.trim()) queryParams.dateFrom = params.dateFrom.trim();
  if (params.dateTo?.trim()) queryParams.dateTo = params.dateTo.trim();
  if (params.page && params.page > 0) queryParams.page = params.page;
  if (params.limit && params.limit > 0) queryParams.limit = params.limit;

  const response = await apiClient.get<{
    success: boolean;
    data: PaginatedCustomerBookingsResponse;
  }>('/customer/parking/bookings', { params: queryParams });

  return response.data.data;
}

/**
 * Retrieves full details, timeline, QR pass, and receipt data for a single customer booking
 */
export async function getCustomerBookingDetails(
  bookingId: string,
): Promise<CustomerBookingDetailsResponse> {
  const response = await apiClient.get<{
    success: boolean;
    data: CustomerBookingDetailsResponse;
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}`);

  return response.data.data;
}

/**
 * Retrieves the authenticated customer's saved favourite parking locations
 */
export async function getCustomerFavourites(params?: {
  latitude?: number;
  longitude?: number;
}): Promise<Array<CustomerParkingLotResult & { favouritedAt: string }>> {
  const queryParams: Record<string, number> = {};
  if (params?.latitude !== undefined && !isNaN(params.latitude)) {
    queryParams.latitude = params.latitude;
  }
  if (params?.longitude !== undefined && !isNaN(params.longitude)) {
    queryParams.longitude = params.longitude;
  }

  const response = await apiClient.get<{
    success: boolean;
    data: Array<CustomerParkingLotResult & { favouritedAt: string }>;
  }>('/customer/parking/favourites', { params: queryParams });

  return response.data.data;
}

/**
 * Cancels an upcoming confirmed booking for the authenticated customer
 */
export async function cancelCustomerBooking(
  bookingId: string,
  reason?: string,
): Promise<{ bookingId: string; bookingReference: string; bookingStatus: string }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { bookingId: string; bookingReference: string; bookingStatus: string };
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}/cancel`, { reason });

  return response.data.data;
}

/**
 * Check in gate entry for a confirmed booking
 */
export async function checkInCustomerBooking(
  bookingId: string,
): Promise<{ bookingId: string; bookingStatus: string }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { bookingId: string; bookingStatus: string };
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}/check-in`);

  return response.data.data;
}

/**
 * Check out gate exit for an active booking
 */
export async function checkOutCustomerBooking(
  bookingId: string,
): Promise<{ bookingId: string; bookingStatus: string }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { bookingId: string; bookingStatus: string };
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}/check-out`);

  return response.data.data;
}

/**
 * Remove facility from favourites explicitly
 */
export async function removeFacilityFavourite(
  parkingLotId: string,
): Promise<boolean> {
  const response = await apiClient.delete<{ success: boolean; data: { isFavourite: boolean } }>(
    `/customer/parking/${parkingLotId}/favourite`,
  );
  return Boolean(response.data.data.isFavourite);
}

export interface CustomerSubmittedReviewItem {
  _id: string;
  bookingId: string;
  bookingReference: string;
  parkingLotId: string;
  parkingName: string;
  parkingAddress: string;
  parkingCity: string;
  parkingImage?: string | null;
  overallRating: number;
  comment: string | null;
  ownerReply: string | null;
  replyDate: string | null;
  replyEdited: boolean;
  isEdited: boolean;
  moderationStatus: 'Published' | 'Under Review' | 'Hidden';
  createdAt: string;
  updatedAt: string;
}

export interface EligibleReviewBookingItem {
  bookingId: string;
  bookingReference: string;
  parkingLotId: string;
  parkingName: string;
  parkingAddress: string;
  parkingCity: string;
  parkingImage?: string | null;
  startTime: string;
  endTime: string;
  actualExitTime?: string | null;
  totalAmount: number;
  slotNumber: string;
  vehiclePlate: string;
}

/**
 * Retrieves past reviews submitted by the authenticated customer
 */
export async function getCustomerReviews(): Promise<CustomerSubmittedReviewItem[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: CustomerSubmittedReviewItem[];
  }>('/customer/parking/reviews');
  return response.data.data;
}

/**
 * Retrieves completed bookings eligible for review submission
 */
export async function getEligibleBookingsForReview(): Promise<EligibleReviewBookingItem[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: EligibleReviewBookingItem[];
  }>('/customer/parking/reviews/eligible-bookings');
  return response.data.data;
}

/**
 * Submits a new review for an eligible completed booking
 */
export async function submitCustomerReview(payload: {
  bookingId: string;
  overallRating: number;
  comment?: string;
}): Promise<CustomerSubmittedReviewItem> {
  const response = await apiClient.post<{
    success: boolean;
    message: string;
    data: CustomerSubmittedReviewItem;
  }>('/customer/parking/reviews', payload);
  return response.data.data;
}

/**
 * Updates an existing review submitted by the customer
 */
export async function updateCustomerReview(
  reviewId: string,
  payload: {
    overallRating?: number;
    comment?: string;
  },
): Promise<CustomerSubmittedReviewItem> {
  const response = await apiClient.put<{
    success: boolean;
    message: string;
    data: CustomerSubmittedReviewItem;
  }>(`/customer/parking/reviews/${encodeURIComponent(reviewId)}`, payload);
  return response.data.data;
}

/**
 * Deletes a review submitted by the customer
 */
export async function deleteCustomerReview(
  reviewId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{
    success: boolean;
    message: string;
  }>(`/customer/parking/reviews/${encodeURIComponent(reviewId)}`);
  return response.data;
}

export interface CustomerExtensionQuoteResponse {
  eligible: boolean;
  bookingId: string;
  bookingReference: string;
  currentScheduledExitTime: string;
  proposedScheduledExitTime: string;
  additionalMinutes: number;
  additionalCharge: number;
  ratePerHour: number;
  exitGracePeriodMinutes: number;
  paymentOptions: Array<'RAZORPAY' | 'CASH'>;
  conflictWithNextBooking?: boolean;
  reason?: string;
}

export interface InitiateCustomerExtensionPayload {
  additionalMinutes: number;
  paymentMethod: 'RAZORPAY' | 'CASH';
}

export interface InitiateCustomerExtensionResponse {
  bookingId: string;
  bookingReference: string;
  extensionReference: string;
  paymentMethod: 'RAZORPAY' | 'CASH';
  paymentStatus: 'PENDING' | 'SUCCESSFUL';
  status: 'PENDING_PAYMENT' | 'CONFIRMED';
  previousScheduledExitTime: string;
  newScheduledExitTime: string;
  additionalMinutes: number;
  additionalCharge: number;
  message: string;
  razorpayOrder?: {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };
  paymentReference?: string;
}

export interface VerifyOnlineExtensionPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Calculates extension quote and validates eligibility for active customer booking
 */
export async function getCustomerExtensionQuote(
  bookingId: string,
  additionalMinutes: number,
): Promise<CustomerExtensionQuoteResponse> {
  const response = await apiClient.get<{
    success: boolean;
    message: string;
    data: CustomerExtensionQuoteResponse;
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}/extension-quote`, {
    params: { additionalMinutes },
  });
  return response.data.data;
}

/**
 * Initiates extension with either online Razorpay hold or deferred Cash at Exit
 */
export async function initiateCustomerExtension(
  bookingId: string,
  payload: InitiateCustomerExtensionPayload,
): Promise<InitiateCustomerExtensionResponse> {
  const response = await apiClient.post<{
    success: boolean;
    message: string;
    data: InitiateCustomerExtensionResponse;
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}/extension/initiate`, payload);
  return response.data.data;
}

/**
 * Verifies Razorpay HMAC signature and confirms online extension
 */
export async function verifyOnlineCustomerExtension(
  bookingId: string,
  payload: VerifyOnlineExtensionPayload,
): Promise<any> {
  const response = await apiClient.post<{
    success: boolean;
    message: string;
    data: any;
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}/extension/verify-online`, payload);
  return response.data.data;
}

/**
 * Cancels pending online extension hold
 */
export async function cancelOnlineCustomerExtension(
  bookingId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{
    success: boolean;
    message: string;
    data: any;
  }>(`/customer/parking/bookings/${encodeURIComponent(bookingId)}/extension/cancel-online`);
  return response.data;
}

// ============================================================================
// PHASE 3.5 — CUSTOMER 24/7 HELPLINE INQUIRIES API
// ============================================================================

export interface SubmitCustomerHelpInquiryPayload {
  parkingLotId: string;
  bookingReference?: string;
  category: string;
  priority: string;
  message: string;
}

export interface CustomerHelpInquiryItem {
  _id: string;
  incidentReference: string;
  parkingLotId: {
    _id: string;
    parkingName: string;
    address: string;
    city: string;
    contactNumber?: string;
    supportEmail?: string;
  } | string;
  bookingId?: string | null;
  customerId?: string;
  incidentType: string;
  incidentStatus: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed' | 'Pending' | 'Resolving' | string;
  severity: string;
  title: string;
  description: string;
  location?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function submitCustomerHelpInquiry(
  payload: SubmitCustomerHelpInquiryPayload,
): Promise<CustomerHelpInquiryItem> {
  const response = await apiClient.post<{ success: boolean; data: CustomerHelpInquiryItem }>(
    '/customer/parking/helpline/inquiries',
    payload,
  );
  return response.data.data;
}

export async function getCustomerHelpInquiries(): Promise<CustomerHelpInquiryItem[]> {
  const response = await apiClient.get<{ success: boolean; data: CustomerHelpInquiryItem[] }>(
    '/customer/parking/helpline/inquiries',
  );
  return response.data.data;
}
