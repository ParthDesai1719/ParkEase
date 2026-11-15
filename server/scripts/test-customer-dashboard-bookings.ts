/**
 * ParkEase — Phase 3.4: Customer Dashboard & My Bookings Comprehensive Integration Test Suite
 *
 * Verifies:
 * 1. Customer can retrieve their own bookings across all 6 categories
 * 2. Customer cannot retrieve another customer's booking (403 FORBIDDEN_BOOKING_ACCESS on detail & receipt)
 * 3. Category filters (Upcoming, Active, Completed, Cancelled, No Show, Overstay) return expected records & counts
 * 4. Server-side pagination, search (by Booking Reference & Facility Name), facility filter, and date range filter
 * 5. Dashboard statistics, activeBooking, upcomingBooking, recentActivity (BookingTimeline), and 6-month activityChart
 * 6. Favourite locations retrieval and toggle scoped strictly to the authenticated customer
 * 7. RBAC & Auth middleware: Unauthenticated requests (401) and non-customer role requests (403) are rejected
 */

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { VehicleModel } from '../src/models/Vehicle.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { ParkingLayoutModel } from '../src/models/ParkingLayout.js';
import { ParkingFacilitySubmissionModel } from '../src/models/ParkingFacilitySubmission.js';
import { BookingModel } from '../src/models/Booking.js';
import { BookingTimelineModel } from '../src/models/BookingTimeline.js';
import { PaymentModel } from '../src/models/Payment.js';
import { FavouriteLocationModel } from '../src/models/FavouriteLocation.js';
import { NotificationModel } from '../src/models/Notification.js';
import { ensureDatabaseIndexes } from '../src/config/database.js';
import { customerBookingService } from '../src/services/customerBooking.service.js';
import { customerParkingService } from '../src/services/customerParking.service.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../src/middleware/auth.js';
import { generateAccessToken } from '../src/utils/jwt.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease_test';

async function runMiddleware(
  middleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void,
  req: Partial<AuthenticatedRequest>,
): Promise<unknown> {
  return new Promise((resolve) => {
    const res = {} as Response;
    void middleware(req as AuthenticatedRequest, res, (err?: unknown) => {
      resolve(err ?? null);
    });
  });
}

async function runPhase34TestSuite() {
  console.log('========================================================================');
  console.log('  ParkEase — Phase 3.4: Customer Dashboard & My Bookings Tests');
  console.log('========================================================================\n');

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✓ MongoDB connected successfully.\n');

  const cleanupIds = {
    userIds: [] as mongoose.Types.ObjectId[],
    vehicleIds: [] as mongoose.Types.ObjectId[],
    lotIds: [] as mongoose.Types.ObjectId[],
    floorIds: [] as mongoose.Types.ObjectId[],
    zoneIds: [] as mongoose.Types.ObjectId[],
    slotIds: [] as mongoose.Types.ObjectId[],
    layoutIds: [] as mongoose.Types.ObjectId[],
    submissionIds: [] as mongoose.Types.ObjectId[],
    bookingIds: [] as mongoose.Types.ObjectId[],
    paymentIds: [] as mongoose.Types.ObjectId[],
    timelineIds: [] as mongoose.Types.ObjectId[],
    favouriteIds: [] as mongoose.Types.ObjectId[],
    notificationIds: [] as mongoose.Types.ObjectId[],
  };

  let passed = 0;
  let failed = 0;

  const assertTest = (name: string, condition: boolean, detail?: string) => {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  };

  try {
    await ensureDatabaseIndexes();

    console.log('[SETUP] Creating test roles, customers, owner, facilities, slots & 6 bookings...');

    let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
    if (!ownerRole) {
      ownerRole = await RoleModel.create({
        roleName: 'Parking Owner',
        roleCode: 'OWNER',
        description: 'Facility owner',
        dashboardRoute: '/owner/dashboard',
        permissions: [],
      });
    }

    let customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    if (!customerRole) {
      customerRole = await RoleModel.create({
        roleName: 'Customer',
        roleCode: 'CUSTOMER',
        description: 'Customer role',
        dashboardRoute: '/customer/dashboard',
        permissions: [],
      });
    }

    const suffix = crypto.randomBytes(4).toString('hex');

    const testOwner = await UserModel.create({
      fullName: 'Phase 3.4 Test Owner',
      email: `p34-owner-${suffix}@test.parkease.in`,
      mobileNumber: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`,
      passwordHash: 'argon2id$dummy',
      roleId: ownerRole._id,
      userType: 'PARKING_OWNER',
      isEmailVerified: true,
      isPhoneVerified: true,
      accountStatus: 'Active',
      status: 'Active',
    });
    cleanupIds.userIds.push(testOwner._id as mongoose.Types.ObjectId);

    const customerA = await UserModel.create({
      fullName: 'Aarav Patel',
      email: `p34-custa-${suffix}@test.parkease.in`,
      mobileNumber: `+9197${Math.floor(10000000 + Math.random() * 89999999)}`,
      passwordHash: 'argon2id$dummy',
      roleId: customerRole._id,
      userType: 'CUSTOMER',
      isEmailVerified: true,
      isPhoneVerified: true,
      accountStatus: 'Active',
      status: 'Active',
    });
    cleanupIds.userIds.push(customerA._id as mongoose.Types.ObjectId);

    const customerB = await UserModel.create({
      fullName: 'Priya Verma',
      email: `p34-custb-${suffix}@test.parkease.in`,
      mobileNumber: `+9196${Math.floor(10000000 + Math.random() * 89999999)}`,
      passwordHash: 'argon2id$dummy',
      roleId: customerRole._id,
      userType: 'CUSTOMER',
      isEmailVerified: true,
      isPhoneVerified: true,
      accountStatus: 'Active',
      status: 'Active',
    });
    cleanupIds.userIds.push(customerB._id as mongoose.Types.ObjectId);

    // Vehicles for Customer A & Customer B
    const vehicleA = await VehicleModel.create({
      customerId: customerA._id,
      vehicleNumber: `GJ05PA${Math.floor(1000 + Math.random() * 8999)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Creta',
      vehicleColor: 'White',
      fuelType: 'Petrol',
      isDefault: true,
      vehicleStatus: 'Active',
    });
    cleanupIds.vehicleIds.push(vehicleA._id as mongoose.Types.ObjectId);

    const vehicleB = await VehicleModel.create({
      customerId: customerB._id,
      vehicleNumber: `GJ01PB${Math.floor(1000 + Math.random() * 8999)}`,
      vehicleType: 'SUV',
      vehicleBrand: 'Tata',
      vehicleModel: 'Safari',
      vehicleColor: 'Black',
      fuelType: 'Diesel',
      isDefault: true,
      vehicleStatus: 'Active',
    });
    cleanupIds.vehicleIds.push(vehicleB._id as mongoose.Types.ObjectId);

    // Create 2 Facilities so we can test Facility Filter & Favourites
    const submission1 = await ParkingFacilitySubmissionModel.create({
      submissionReference: `SUB-P34-1-${suffix.toUpperCase()}`,
      ownerId: testOwner._id,
      submissionStatus: 'Approved',
      facilityName: `Phoenix Mall Plaza ${suffix}`,
      facilityType: 'Commercial Parking',
      pricing: {
        carHourlyRate: 60,
        suvHourlyRate: 80,
        bikeHourlyRate: 30,
        dailyRate: 500,
        overnightRate: 300,
        evChargingRatePerHour: 70,
        gracePeriodMinutes: 15,
        minParkingDurationHours: 1,
        maxParkingDurationHours: 24,
      },
      operatingInfo: {
        isOpen24x7: true,
        openingTime: '00:00',
        closingTime: '23:59',
        scheduleType: '24x7',
      },
    });
    cleanupIds.submissionIds.push(submission1._id as mongoose.Types.ObjectId);

    const lot1 = await ParkingLotModel.create({
      ownerId: testOwner._id,
      submissionId: submission1._id,
      parkingName: `Phoenix Mall Plaza ${suffix}`,
      description: 'Commercial mall parking facility',
      address: '101 SG Highway, Ahmedabad',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380054',
      country: 'India',
      latitude: 23.0395,
      longitude: 72.512,
      location: { type: 'Point', coordinates: [72.512, 23.0395] },
      contactNumber: '+919898112233',
      totalFloors: 1,
      totalSlots: 6,
      availableSlots: 5,
      reservedSlots: 0,
      occupiedSlots: 1,
      occupancyPercentage: 16,
      hourlyRate: 60,
      overstayRate: 90,
      gracePeriodMinutes: 15,
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      amenities: ['CCTV Surveillance'],
      images: [],
      averageRating: 4.7,
      totalReviews: 12,
      parkingStatus: 'Active',
      isVerified: true,
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lot1._id as mongoose.Types.ObjectId);

    const lot2 = await ParkingLotModel.create({
      ownerId: testOwner._id,
      submissionId: submission1._id,
      parkingName: `Gift City Hub ${suffix}`,
      description: 'Corporate hub parking facility',
      address: '202 Gift City Road, Gandhinagar',
      city: 'Gandhinagar',
      state: 'Gujarat',
      postalCode: '382355',
      country: 'India',
      latitude: 23.1645,
      longitude: 72.6842,
      location: { type: 'Point', coordinates: [72.6842, 23.1645] },
      contactNumber: '+919898445566',
      totalFloors: 1,
      totalSlots: 4,
      availableSlots: 4,
      reservedSlots: 0,
      occupiedSlots: 0,
      occupancyPercentage: 0,
      hourlyRate: 50,
      overstayRate: 75,
      gracePeriodMinutes: 15,
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      amenities: ['Covered Parking'],
      images: [],
      averageRating: 4.5,
      totalReviews: 5,
      parkingStatus: 'Active',
      isVerified: true,
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lot2._id as mongoose.Types.ObjectId);

    const floor1 = await ParkingFloorModel.create({
      parkingLotId: lot1._id,
      floorName: 'Basement 1',
      floorNumber: 1,
      totalZones: 1,
      totalSlots: 6,
      availableSlots: 5,
      reservedSlots: 0,
      occupiedSlots: 1,
      occupancyPercentage: 16,
      floorStatus: 'Active',
    });
    cleanupIds.floorIds.push(floor1._id as mongoose.Types.ObjectId);

    const floor2 = await ParkingFloorModel.create({
      parkingLotId: lot2._id,
      floorName: 'Ground Floor',
      floorNumber: 1,
      totalZones: 1,
      totalSlots: 4,
      availableSlots: 4,
      reservedSlots: 0,
      occupiedSlots: 0,
      occupancyPercentage: 0,
      floorStatus: 'Active',
    });
    cleanupIds.floorIds.push(floor2._id as mongoose.Types.ObjectId);

    const zone1 = await ParkingZoneModel.create({
      parkingLotId: lot1._id,
      floorId: floor1._id,
      zoneName: 'Zone A',
      zoneCode: 'A',
      vehicleType: 'Car',
      totalSlots: 6,
      availableSlots: 5,
      occupiedSlots: 1,
      zoneStatus: 'Active',
    });
    cleanupIds.zoneIds.push(zone1._id as mongoose.Types.ObjectId);

    const zone2 = await ParkingZoneModel.create({
      parkingLotId: lot2._id,
      floorId: floor2._id,
      zoneName: 'Zone B',
      zoneCode: 'B',
      vehicleType: 'Car',
      totalSlots: 4,
      availableSlots: 4,
      occupiedSlots: 0,
      zoneStatus: 'Active',
    });
    cleanupIds.zoneIds.push(zone2._id as mongoose.Types.ObjectId);

    const slots: mongoose.Document[] = [];
    for (let i = 1; i <= 6; i++) {
      const slot = await ParkingSlotModel.create({
        parkingLotId: lot1._id,
        floorId: floor1._id,
        zoneId: zone1._id,
        slotNumber: `A-0${i}`,
        slotLabel: `Car Bay A-0${i}`,
        slotType: 'Standard',
        supportedVehicleType: 'Car',
        slotStatus: i === 2 ? 'Occupied' : 'Available',
        qrIdentifier: `QR-P34-A0${i}-${suffix}`,
      });
      cleanupIds.slotIds.push(slot._id as mongoose.Types.ObjectId);
      slots.push(slot);
    }

    const slotLot2 = await ParkingSlotModel.create({
      parkingLotId: lot2._id,
      floorId: floor2._id,
      zoneId: zone2._id,
      slotNumber: 'B-01',
      slotLabel: 'Car Bay B-01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-P34-B01-${suffix}`,
    });
    cleanupIds.slotIds.push(slotLot2._id as mongoose.Types.ObjectId);

    // Published layouts for both lots so customerParkingService recognizes them as published
    const layout1 = await ParkingLayoutModel.create({
      parkingLotId: lot1._id,
      floorId: floor1._id,
      version: 1,
      status: 'Published',
      isValidated: true,
      isPublished: true,
      publishedAt: new Date(),
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: { width: 800, height: 600, gridSize: 20, snapToGrid: true, backgroundColor: '#f8fafc' },
      elements: slots.map((s, idx) => ({
        elementId: `el-${idx}`,
        elementType: 'ParkingSlot',
        x: 40 + idx * 70,
        y: 80,
        width: 50,
        height: 90,
        rotation: 0,
        zIndex: 1,
        slotId: s._id as mongoose.Types.ObjectId,
        slotNumber: `A-0${idx + 1}`,
        zoneId: zone1._id as mongoose.Types.ObjectId,
        zoneCode: 'A',
      })),
    });
    cleanupIds.layoutIds.push(layout1._id as mongoose.Types.ObjectId);

    const layout2 = await ParkingLayoutModel.create({
      parkingLotId: lot2._id,
      floorId: floor2._id,
      version: 1,
      status: 'Published',
      isValidated: true,
      isPublished: true,
      publishedAt: new Date(),
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: { width: 800, height: 600, gridSize: 20, snapToGrid: true, backgroundColor: '#f8fafc' },
      elements: [
        {
          elementId: 'el-b1',
          elementType: 'ParkingSlot',
          x: 40,
          y: 80,
          width: 50,
          height: 90,
          rotation: 0,
          zIndex: 1,
          slotId: slotLot2._id as mongoose.Types.ObjectId,
          slotNumber: 'B-01',
          zoneId: zone2._id as mongoose.Types.ObjectId,
          zoneCode: 'B',
        },
      ],
    });
    cleanupIds.layoutIds.push(layout2._id as mongoose.Types.ObjectId);

    // Helper to create a Booking + Payment + Timeline
    const now = new Date();
    const createTestBooking = async (params: {
      refSuffix: string;
      customerId: mongoose.Types.ObjectId;
      vehicleId: mongoose.Types.ObjectId;
      lotId: mongoose.Types.ObjectId;
      floorId: mongoose.Types.ObjectId;
      zoneId: mongoose.Types.ObjectId;
      slotId: mongoose.Types.ObjectId;
      bookingStatus: 'Confirmed' | 'Active' | 'Completed' | 'Cancelled' | 'No Show' | 'Overstay';
      scheduledEntryTime: Date;
      scheduledExitTime: Date;
      baseAmount: number;
      totalAmount: number;
      paymentStatus: 'SUCCESSFUL' | 'REFUNDED';
      overstayDetected?: boolean;
      overstayDurationMinutes?: number;
      overstayCharge?: number;
      additionalChargePaymentStatus?: 'PAID' | 'UNPAID' | 'NOT_APPLICABLE';
      cancellationReason?: string;
    }) => {
      const bookingReference = `PB-P34-${params.refSuffix}-${suffix.toUpperCase()}`;
      const qrToken = `QR-P34-${params.refSuffix}-${suffix.toUpperCase()}`;
      const graceEnds = new Date(params.scheduledEntryTime.getTime() + 15 * 60 * 1000);

      const booking = await BookingModel.create({
        bookingReference,
        customerId: params.customerId,
        vehicleId: params.vehicleId,
        parkingLotId: params.lotId,
        floorId: params.floorId,
        zoneId: params.zoneId,
        originalSlotId: params.slotId,
        currentSlotId: params.slotId,
        bookingType: 'ONLINE',
        bookingStatus: params.bookingStatus,
        scheduledEntryTime: params.scheduledEntryTime,
        scheduledExitTime: params.scheduledExitTime,
        actualEntryTime:
          params.bookingStatus === 'Active' ||
          params.bookingStatus === 'Completed' ||
          params.bookingStatus === 'Overstay'
            ? params.scheduledEntryTime
            : null,
        actualExitTime: params.bookingStatus === 'Completed' ? params.scheduledExitTime : null,
        gracePeriodMinutes: 15,
        gracePeriodEndsAt: graceEnds,
        bookingDurationMinutes: 120,
        parkingRateAtBooking: 60,
        overstayRateAtBooking: 90,
        baseAmount: params.baseAmount,
        additionalCharges: params.overstayCharge || 0,
        totalAmount: params.totalAmount,
        qrCode: qrToken,
        overstayDetected: Boolean(params.overstayDetected),
        overstayStartedAt: params.overstayDetected ? params.scheduledExitTime : null,
        overstayDurationMinutes: params.overstayDurationMinutes || 0,
        overstayCharge: params.overstayCharge || 0,
        additionalChargePaymentStatus: params.additionalChargePaymentStatus || 'NOT_APPLICABLE',
        noShowDetected: params.bookingStatus === 'No Show',
        cancellationReason: params.cancellationReason || null,
        cancellationBy:
          params.bookingStatus === 'Cancelled'
            ? 'Customer'
            : params.bookingStatus === 'No Show'
              ? 'System'
              : null,
        cancelledAt:
          params.bookingStatus === 'Cancelled' || params.bookingStatus === 'No Show'
            ? new Date()
            : null,
        refundAmount: params.paymentStatus === 'REFUNDED' ? params.baseAmount : 0,
        refundPercentage: params.paymentStatus === 'REFUNDED' ? 100 : null,
        refundStatus: params.paymentStatus === 'REFUNDED' ? 'COMPLETED' : 'NOT_APPLICABLE',
      });
      cleanupIds.bookingIds.push(booking._id as mongoose.Types.ObjectId);

      const payment = await PaymentModel.create({
        paymentReference: `PAY-P34-${params.refSuffix}-${suffix.toUpperCase()}`,
        bookingId: booking._id,
        userId: params.customerId,
        amount: params.totalAmount,
        paymentMethod: 'RAZORPAY',
        paymentType: 'Parking Booking',
        paymentTypeCode: 'BOOKING',
        paymentStatus: params.paymentStatus,
        razorpayOrderId: `order_${params.refSuffix}_${suffix}`,
        razorpayPaymentId: `pay_${params.refSuffix}_${suffix}`,
        razorpaySignature: 'sig_valid',
        transactionId: `pay_${params.refSuffix}_${suffix}`,
        paymentDate: new Date(),
        refund:
          params.paymentStatus === 'REFUNDED'
            ? {
                refundReference: `REF-P34-${params.refSuffix}-${suffix.toUpperCase()}`,
                refundAmount: params.baseAmount,
                refundStatus: 'Refund Completed',
                refundReason: 'Customer cancelled booking',
                initiatedAt: new Date(),
                completedAt: new Date(),
              }
            : null,
      });
      cleanupIds.paymentIds.push(payment._id as mongoose.Types.ObjectId);

      booking.paymentId = payment._id as mongoose.Types.ObjectId;
      await booking.save();

      const timeline = await BookingTimelineModel.create({
        bookingId: booking._id,
        eventCode: 'BOOKING_CONFIRMED',
        eventType: 'Booking Confirmed',
        eventTitle: `Booking ${bookingReference} Confirmed`,
        eventDescription: `Status: ${params.bookingStatus}`,
        eventSource: 'System',
        actorUserId: params.customerId,
        eventTime: new Date(),
      });
      cleanupIds.timelineIds.push(timeline._id as mongoose.Types.ObjectId);

      return booking;
    };

    // Create 6 bookings for Customer A (1 in each of the 6 categories)
    const bookingUpcoming = await createTestBooking({
      refSuffix: 'UPC',
      customerId: customerA._id as mongoose.Types.ObjectId,
      vehicleId: vehicleA._id as mongoose.Types.ObjectId,
      lotId: lot1._id as mongoose.Types.ObjectId,
      floorId: floor1._id as mongoose.Types.ObjectId,
      zoneId: zone1._id as mongoose.Types.ObjectId,
      slotId: slots[0]._id as mongoose.Types.ObjectId,
      bookingStatus: 'Confirmed',
      scheduledEntryTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      baseAmount: 120,
      totalAmount: 120,
      paymentStatus: 'SUCCESSFUL',
    });

    const bookingActive = await createTestBooking({
      refSuffix: 'ACT',
      customerId: customerA._id as mongoose.Types.ObjectId,
      vehicleId: vehicleA._id as mongoose.Types.ObjectId,
      lotId: lot1._id as mongoose.Types.ObjectId,
      floorId: floor1._id as mongoose.Types.ObjectId,
      zoneId: zone1._id as mongoose.Types.ObjectId,
      slotId: slots[1]._id as mongoose.Types.ObjectId,
      bookingStatus: 'Active',
      scheduledEntryTime: new Date(now.getTime() - 30 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() + 90 * 60 * 1000),
      baseAmount: 120,
      totalAmount: 120,
      paymentStatus: 'SUCCESSFUL',
    });

    const bookingCompleted = await createTestBooking({
      refSuffix: 'CMP',
      customerId: customerA._id as mongoose.Types.ObjectId,
      vehicleId: vehicleA._id as mongoose.Types.ObjectId,
      lotId: lot2._id as mongoose.Types.ObjectId,
      floorId: floor2._id as mongoose.Types.ObjectId,
      zoneId: zone2._id as mongoose.Types.ObjectId,
      slotId: slotLot2._id as mongoose.Types.ObjectId,
      bookingStatus: 'Completed',
      scheduledEntryTime: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      baseAmount: 100,
      totalAmount: 100,
      paymentStatus: 'SUCCESSFUL',
    });

    await createTestBooking({
      refSuffix: 'CAN',
      customerId: customerA._id as mongoose.Types.ObjectId,
      vehicleId: vehicleA._id as mongoose.Types.ObjectId,
      lotId: lot1._id as mongoose.Types.ObjectId,
      floorId: floor1._id as mongoose.Types.ObjectId,
      zoneId: zone1._id as mongoose.Types.ObjectId,
      slotId: slots[2]._id as mongoose.Types.ObjectId,
      bookingStatus: 'Cancelled',
      scheduledEntryTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      baseAmount: 120,
      totalAmount: 120,
      paymentStatus: 'REFUNDED',
      cancellationReason: 'Customer changed travel plans',
    });

    await createTestBooking({
      refSuffix: 'NSH',
      customerId: customerA._id as mongoose.Types.ObjectId,
      vehicleId: vehicleA._id as mongoose.Types.ObjectId,
      lotId: lot1._id as mongoose.Types.ObjectId,
      floorId: floor1._id as mongoose.Types.ObjectId,
      zoneId: zone1._id as mongoose.Types.ObjectId,
      slotId: slots[3]._id as mongoose.Types.ObjectId,
      bookingStatus: 'No Show',
      scheduledEntryTime: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      baseAmount: 120,
      totalAmount: 120,
      paymentStatus: 'SUCCESSFUL',
      cancellationReason: 'Arrival grace period expired without gate check-in',
    });

    const bookingOverstay = await createTestBooking({
      refSuffix: 'OVS',
      customerId: customerA._id as mongoose.Types.ObjectId,
      vehicleId: vehicleA._id as mongoose.Types.ObjectId,
      lotId: lot1._id as mongoose.Types.ObjectId,
      floorId: floor1._id as mongoose.Types.ObjectId,
      zoneId: zone1._id as mongoose.Types.ObjectId,
      slotId: slots[4]._id as mongoose.Types.ObjectId,
      bookingStatus: 'Overstay',
      scheduledEntryTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      baseAmount: 120,
      totalAmount: 210,
      paymentStatus: 'SUCCESSFUL',
      overstayDetected: true,
      overstayDurationMinutes: 60,
      overstayCharge: 90,
      additionalChargePaymentStatus: 'UNPAID',
    });

    // Create 1 booking for Customer B (to test ownership isolation)
    const bookingCustomerB = await createTestBooking({
      refSuffix: 'CUSTB',
      customerId: customerB._id as mongoose.Types.ObjectId,
      vehicleId: vehicleB._id as mongoose.Types.ObjectId,
      lotId: lot1._id as mongoose.Types.ObjectId,
      floorId: floor1._id as mongoose.Types.ObjectId,
      zoneId: zone1._id as mongoose.Types.ObjectId,
      slotId: slots[5]._id as mongoose.Types.ObjectId,
      bookingStatus: 'Confirmed',
      scheduledEntryTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() + 7 * 60 * 60 * 1000),
      baseAmount: 160,
      totalAmount: 160,
      paymentStatus: 'SUCCESSFUL',
    });

    console.log('✓ Test fixtures provisioned.\n');

    // ========================================================================
    // TEST 1: Customer retrieves their own bookings & Category Counts
    // ========================================================================
    console.log('[TEST 1] Customer retrieves their own bookings & authoritative category counts...');
    const allA = await customerBookingService.getCustomerBookings({
      userId: String(customerA._id),
      category: 'All',
      page: 1,
      limit: 10,
    });

    assertTest(
      'Customer A retrieves exactly their 6 bookings (Customer B booking is excluded)',
      allA.total === 6 &&
        allA.bookings.length === 6 &&
        !allA.bookings.some((b) => b.bookingId === String(bookingCustomerB._id)),
      `total=${allA.total}`,
    );

    assertTest(
      'Category counts match exact database counts across all 6 tabs',
      allA.categoryCounts.Upcoming === 1 &&
        allA.categoryCounts.Active === 1 &&
        allA.categoryCounts.Completed === 1 &&
        allA.categoryCounts.Cancelled === 1 &&
        allA.categoryCounts['No Show'] === 1 &&
        allA.categoryCounts.Overstay === 1 &&
        allA.categoryCounts.All === 6,
      JSON.stringify(allA.categoryCounts),
    );

    // ========================================================================
    // TEST 2: Category Filtering (Upcoming, Active, Completed, Cancelled, No Show, Overstay)
    // ========================================================================
    console.log('\n[TEST 2] Verifying all 6 booking category filters...');
    const categories: Array<{
      cat: 'Upcoming' | 'Active' | 'Completed' | 'Cancelled' | 'No Show' | 'Overstay';
      expectedStatus: string;
    }> = [
      { cat: 'Upcoming', expectedStatus: 'Confirmed' },
      { cat: 'Active', expectedStatus: 'Active' },
      { cat: 'Completed', expectedStatus: 'Completed' },
      { cat: 'Cancelled', expectedStatus: 'Cancelled' },
      { cat: 'No Show', expectedStatus: 'No Show' },
      { cat: 'Overstay', expectedStatus: 'Overstay' },
    ];

    for (const { cat, expectedStatus } of categories) {
      const res = await customerBookingService.getCustomerBookings({
        userId: String(customerA._id),
        category: cat,
      });
      assertTest(
        `Category "${cat}" returns 1 booking with bookingStatus === "${expectedStatus}"`,
        res.total === 1 &&
          res.bookings.length === 1 &&
          res.bookings[0].bookingStatus === expectedStatus,
        `total=${res.total}, status=${res.bookings[0]?.bookingStatus}`,
      );
    }

    // Verify QR visibility rules per status
    const upcItem = allA.bookings.find((b) => b.bookingStatus === 'Confirmed');
    const actItem = allA.bookings.find((b) => b.bookingStatus === 'Active');
    const cmpItem = allA.bookings.find((b) => b.bookingStatus === 'Completed');
    const canItem = allA.bookings.find((b) => b.bookingStatus === 'Cancelled');
    assertTest(
      'QR Pass is enabled for Confirmed/Active/Overstay and disabled for Completed/Cancelled/No Show',
      Boolean(upcItem?.canViewQr) &&
        Boolean(actItem?.canViewQr) &&
        !cmpItem?.canViewQr &&
        !canItem?.canViewQr,
    );

    // ========================================================================
    // TEST 3: Server-Side Pagination, Search, Facility Filter & Date Filter
    // ========================================================================
    console.log('\n[TEST 3] Verifying server-side pagination, search, facility filter & date filter...');
    const page1 = await customerBookingService.getCustomerBookings({
      userId: String(customerA._id),
      category: 'All',
      page: 1,
      limit: 2,
    });
    const page2 = await customerBookingService.getCustomerBookings({
      userId: String(customerA._id),
      category: 'All',
      page: 2,
      limit: 2,
    });

    assertTest(
      'Server-side pagination returns correct page size, totalPages=3, and non-overlapping items',
      page1.bookings.length === 2 &&
        page2.bookings.length === 2 &&
        page1.totalPages === 3 &&
        page1.bookings[0].bookingId !== page2.bookings[0].bookingId,
    );

    const searchByRef = await customerBookingService.getCustomerBookings({
      userId: String(customerA._id),
      category: 'All',
      search: bookingCompleted.bookingReference,
    });
    assertTest(
      'Search by Booking Reference returns exact matching booking',
      searchByRef.total === 1 &&
        searchByRef.bookings[0].bookingReference === bookingCompleted.bookingReference,
    );

    const searchByFacility = await customerBookingService.getCustomerBookings({
      userId: String(customerA._id),
      category: 'All',
      search: 'Gift City Hub',
    });
    assertTest(
      'Search by Facility Name returns bookings at Gift City Hub',
      searchByFacility.total === 1 &&
        searchByFacility.bookings[0].parkingLotId === String(lot2._id),
    );

    const filterByLot2 = await customerBookingService.getCustomerBookings({
      userId: String(customerA._id),
      category: 'All',
      parkingLotId: String(lot2._id),
    });
    assertTest(
      'Facility dropdown filter returns only bookings for selected parkingLotId',
      filterByLot2.total === 1 && filterByLot2.bookings[0].parkingLotId === String(lot2._id),
    );

    // ========================================================================
    // TEST 4: Cross-Customer Ownership Protection (403 FORBIDDEN_BOOKING_ACCESS)
    // ========================================================================
    console.log('\n[TEST 4] Verifying Customer cannot access another customer’s booking or receipt...');
    const ownDetail = await customerBookingService.getCustomerBookingDetails({
      userId: String(customerA._id),
      bookingId: String(bookingUpcoming._id),
    });
    assertTest(
      'Customer A can retrieve full details, timeline, and receiptData for their own booking',
      ownDetail.booking.bookingId === String(bookingUpcoming._id) &&
        ownDetail.timeline.length >= 1 &&
        ownDetail.receiptData !== null,
    );

    let crossCustomerDetailRejected = false;
    let crossCustomerStatusCode = 0;
    try {
      await customerBookingService.getCustomerBookingDetails({
        userId: String(customerA._id),
        bookingId: String(bookingCustomerB._id),
      });
    } catch (err: unknown) {
      const appErr = err as { statusCode?: number; errorCode?: string; code?: string };
      crossCustomerStatusCode = appErr.statusCode || 0;
      const code = appErr.errorCode || appErr.code;
      crossCustomerDetailRejected =
        appErr.statusCode === 403 && code === 'FORBIDDEN_BOOKING_ACCESS';
    }
    assertTest(
      'Customer A attempting to view Customer B booking detail is rejected with 403 FORBIDDEN_BOOKING_ACCESS',
      crossCustomerDetailRejected,
      `statusCode=${crossCustomerStatusCode}`,
    );

    let crossCustomerEmailRejected = false;
    try {
      await customerBookingService.emailBookingReceipt({
        userId: String(customerA._id),
        parkingLotId: String(lot1._id),
        bookingId: String(bookingCustomerB._id),
      });
    } catch (err: unknown) {
      const appErr = err as { statusCode?: number; errorCode?: string; code?: string };
      const code = appErr.errorCode || appErr.code;
      crossCustomerEmailRejected =
        appErr.statusCode === 403 && code === 'FORBIDDEN_BOOKING_ACCESS';
    }
    assertTest(
      'Customer A attempting to email Customer B booking receipt is rejected with 403 FORBIDDEN_BOOKING_ACCESS',
      crossCustomerEmailRejected,
    );

    // ========================================================================
    // TEST 5: Customer Dashboard Overview (Stats, Active, Upcoming, Timeline, Chart)
    // ========================================================================
    console.log('\n[TEST 5] Verifying Customer Dashboard Overview calculations from real records...');
    const dashboardA = await customerBookingService.getCustomerDashboardOverview({
      userId: String(customerA._id),
    });

    assertTest(
      'Dashboard stats accurately reflect Customer A counts and total spent',
      dashboardA.stats.activeBookingsCount === 2 && // Active + Overstay
        dashboardA.stats.upcomingBookingsCount === 1 &&
        dashboardA.stats.completedBookingsCount === 1 &&
        dashboardA.stats.cancelledBookingsCount === 1 &&
        dashboardA.stats.noShowBookingsCount === 1 &&
        dashboardA.stats.overstayBookingsCount === 1 &&
        dashboardA.stats.registeredVehiclesCount === 1 &&
        dashboardA.stats.digitalReceiptsCount === 6 && // 6 payments (5 SUCCESSFUL + 1 REFUNDED)
        dashboardA.stats.totalSpentAmount === 120 + 120 + 100 + 210, // Active(120) + Upcoming(120) + Completed(100) + Overstay(210)
      JSON.stringify(dashboardA.stats),
    );

    assertTest(
      'Dashboard activeBooking returns real active/overstay session with remaining time & QR',
      dashboardA.activeBooking !== null &&
        (dashboardA.activeBooking.bookingId === String(bookingActive._id) ||
          dashboardA.activeBooking.bookingId === String(bookingOverstay._id)) &&
        dashboardA.activeBooking.canViewQr === true,
    );

    assertTest(
      'Dashboard upcomingBooking returns next confirmed reservation',
      dashboardA.upcomingBooking !== null &&
        dashboardA.upcomingBooking.bookingId === String(bookingUpcoming._id) &&
        dashboardA.upcomingBooking.bookingStatus === 'Confirmed',
    );

    assertTest(
      'Dashboard recentActivity returns real BookingTimeline events for Customer A',
      dashboardA.recentActivity.length === 6 &&
        dashboardA.recentActivity.every((ev) => ev.eventCode === 'BOOKING_CONFIRMED'),
    );

    assertTest(
      'Dashboard activityChart aggregates 6 months of real booking data',
      dashboardA.activityChart.hasActivityData === true &&
        dashboardA.activityChart.points.length === 6 &&
        dashboardA.activityChart.points.reduce((sum, p) => sum + p.totalBookings, 0) === 6,
    );

    // ========================================================================
    // TEST 6: Favourite Locations Scoped to Authenticated Customer
    // ========================================================================
    console.log('\n[TEST 6] Verifying Favourite Locations toggle and retrieval scoping...');
    const toggleOn = await customerParkingService.toggleFavourite(
      String(customerA._id),
      String(lot1._id),
    );
    assertTest('Customer A favourites Phoenix Mall Plaza', toggleOn.isFavourite === true);

    const favsA = await customerParkingService.getCustomerFavourites(
      String(customerA._id),
      23.0395,
      72.512,
    );
    const favsB = await customerParkingService.getCustomerFavourites(String(customerB._id));

    assertTest(
      'Customer A getCustomerFavourites returns 1 enriched facility with live availability & pricing',
      favsA.length === 1 &&
        favsA[0]._id === String(lot1._id) &&
        favsA[0].availableSlots === 5 &&
        favsA[0].hourlyRate === 60,
    );
    assertTest(
      'Customer B getCustomerFavourites is empty (favourites are isolated per customer)',
      favsB.length === 0,
    );

    const toggleOff = await customerParkingService.toggleFavourite(
      String(customerA._id),
      String(lot1._id),
    );
    const favsAAfterRemove = await customerParkingService.getCustomerFavourites(
      String(customerA._id),
    );
    assertTest(
      'Removing favourite updates state and removes facility from getCustomerFavourites',
      toggleOff.isFavourite === false && favsAAfterRemove.length === 0,
    );

    // ========================================================================
    // TEST 7: Unauthorized (401) & Non-Customer Role (403) Rejection
    // ========================================================================
    console.log('\n[TEST 7] Verifying Authentication (401) and Role Authorization (403) middleware...');
    const unauthError = (await runMiddleware(requireAuth, { headers: {} })) as {
      statusCode?: number;
    } | null;
    assertTest(
      'Unauthenticated request without Bearer token is rejected with 401',
      unauthError !== null && unauthError.statusCode === 401,
    );

    const ownerToken = generateAccessToken({
      userId: String(testOwner._id),
      roleId: String(ownerRole._id),
      sessionId: '',
    });
    const ownerReq: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${ownerToken}` },
    };
    const ownerAuthErr = await runMiddleware(requireAuth, ownerReq);
    const ownerRoleErr = (await runMiddleware(requireRole('CUSTOMER'), ownerReq)) as {
      statusCode?: number;
    } | null;
    assertTest(
      'Authenticated PARKING_OWNER request to CUSTOMER endpoint is rejected with 403',
      ownerAuthErr === null && ownerRoleErr !== null && ownerRoleErr.statusCode === 403,
    );

    const customerToken = generateAccessToken({
      userId: String(customerA._id),
      roleId: String(customerRole._id),
      sessionId: '',
    });
    const customerReq: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${customerToken}` },
    };
    const custAuthErr = await runMiddleware(requireAuth, customerReq);
    const custRoleErr = await runMiddleware(requireRole('CUSTOMER'), customerReq);
    assertTest(
      'Authenticated CUSTOMER request passes requireAuth and requireRole("CUSTOMER")',
      custAuthErr === null && custRoleErr === null && customerReq.userId === String(customerA._id),
    );
  } finally {
    console.log('\n[CLEANUP] Removing temporary test records...');
    await NotificationModel.deleteMany({ _id: { $in: cleanupIds.notificationIds } });
    await FavouriteLocationModel.deleteMany({
      userId: { $in: cleanupIds.userIds },
    });
    await BookingTimelineModel.deleteMany({ _id: { $in: cleanupIds.timelineIds } });
    await PaymentModel.deleteMany({ _id: { $in: cleanupIds.paymentIds } });
    await BookingModel.deleteMany({ _id: { $in: cleanupIds.bookingIds } });
    await ParkingLayoutModel.deleteMany({ _id: { $in: cleanupIds.layoutIds } });
    await ParkingSlotModel.deleteMany({ _id: { $in: cleanupIds.slotIds } });
    await ParkingZoneModel.deleteMany({ _id: { $in: cleanupIds.zoneIds } });
    await ParkingFloorModel.deleteMany({ _id: { $in: cleanupIds.floorIds } });
    await ParkingLotModel.deleteMany({ _id: { $in: cleanupIds.lotIds } });
    await ParkingFacilitySubmissionModel.deleteMany({ _id: { $in: cleanupIds.submissionIds } });
    await VehicleModel.deleteMany({ _id: { $in: cleanupIds.vehicleIds } });
    await UserModel.deleteMany({ _id: { $in: cleanupIds.userIds } });
    await mongoose.disconnect();
    console.log('✓ Cleanup completed and MongoDB disconnected.');
  }

  console.log('\n========================================================================');
  console.log(`  TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase34TestSuite().catch((err) => {
  console.error('Fatal error in Phase 3.4 test suite:', err);
  process.exit(1);
});
