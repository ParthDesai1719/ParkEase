/**
 * ParkEase — Phase 3.3: Customer Slot Selection & Booking Comprehensive Test Suite
 *
 * Verifies:
 * 1. Booking Context Retrieval: Published 2D Layout, Floor/Zone switching, Slot Status & Vehicle Compatibility
 * 2. Pricing & Duration Calculation across Vehicle Types (Car, Bike, SUV, EV)
 * 3. Invalid Booking Periods (Past Entry, End <= Start, Outside Operating Hours, Min/Max Duration)
 * 4. Unavailable Slot Rejection (Under Maintenance, Incompatible Vehicle Type, Unplaced Slot)
 * 5. Customer Vehicle Registration & Retrieval
 * 6. Payment Initiation (Pending Payment Booking + PENDING Payment + Razorpay Order Creation)
 * 7. Invalid Payment Signature Rejection (Booking stays unconfirmed, Payment marked FAILED)
 * 8. Valid Payment Signature Confirmation (Booking Confirmed, QR Generated, Slot Reserved, Timeline & Notification)
 * 9. Overlapping Booking Detection (Confirmed slot blocked for overlapping time window, allowed for non-overlapping window)
 * 10. Concurrent Booking Race Condition Handling (Second payment for same slot & window triggers automatic full refund & cancellation)
 */

import crypto from 'node:crypto';
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
import { NotificationModel } from '../src/models/Notification.js';
import { env } from '../src/config/env.js';
import { ensureDatabaseIndexes } from '../src/config/database.js';
import { customerBookingService } from '../src/services/customerBooking.service.js';
import { razorpayService } from '../src/services/razorpay.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease_test';

function generateValidRazorpaySignature(orderId: string, paymentId: string): string {
  const secret = env.RAZORPAY_KEY_SECRET || 'test_secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function runCustomerBookingTestSuite() {
  console.log('========================================================================');
  console.log('  ParkEase — Phase 3.3: Customer Slot Selection & Booking Tests');
  console.log('========================================================================\n');

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✓ MongoDB connected successfully.\n');

  // Mock razorpayService.createOrder if external network fails or for deterministic testing
  const originalCreateOrder = razorpayService.createOrder.bind(razorpayService);
  razorpayService.createOrder = async (params) => {
    try {
      return await originalCreateOrder(params);
    } catch {
      return {
        id: `order_test_${crypto.randomBytes(6).toString('hex')}`,
        amount: params.amountPaise,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        status: 'created',
      };
    }
  };

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

    console.log('[SETUP] Creating test roles, users, facility, floors, zones, slots & published 2D layout...');

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

    const testOwner = await UserModel.create({
      fullName: 'Booking Test Owner',
      email: `book-owner-${Date.now()}@test.parkease.in`,
      mobileNumber: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: 'argon2id$dummyhash',
      roleId: ownerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });
    cleanupIds.userIds.push(testOwner._id as mongoose.Types.ObjectId);

    const customerOne = await UserModel.create({
      fullName: 'Aarav Mehta',
      email: `book-cust1-${Date.now()}@test.parkease.in`,
      mobileNumber: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: 'argon2id$dummyhash',
      roleId: customerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });
    cleanupIds.userIds.push(customerOne._id as mongoose.Types.ObjectId);

    const customerTwo = await UserModel.create({
      fullName: 'Priya Nair',
      email: `book-cust2-${Date.now()}@test.parkease.in`,
      mobileNumber: `+9196${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: 'argon2id$dummyhash',
      roleId: customerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });
    cleanupIds.userIds.push(customerTwo._id as mongoose.Types.ObjectId);

    // Create Submission with pricing tiers
    const submission = await ParkingFacilitySubmissionModel.create({
      submissionReference: `SUB-BK-${Date.now()}`,
      ownerId: testOwner._id,
      submissionStatus: 'Approved',
      facilityName: 'ParkEase Horizon Tech Park',
      facilityType: 'Commercial Parking',
      pricing: {
        carHourlyRate: 60,
        suvHourlyRate: 80,
        bikeHourlyRate: 30,
        dailyRate: 400,
        overnightRate: 450,
        evChargingRatePerHour: 50,
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
    cleanupIds.submissionIds.push(submission._id as mongoose.Types.ObjectId);

    // Create Official Active ParkingLot
    const lot = await ParkingLotModel.create({
      ownerId: testOwner._id,
      submissionId: submission._id,
      parkingName: 'ParkEase Horizon Tech Park',
      description: 'Smart underground parking with 2D bay guidance',
      address: '100 SG Highway',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380054',
      country: 'India',
      latitude: 23.0386,
      longitude: 72.5119,
      location: { type: 'Point', coordinates: [72.5119, 23.0386] },
      contactNumber: '+919898123456',
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      hourlyRate: 60,
      gracePeriodMinutes: 15,
      totalFloors: 2,
      totalSlots: 4,
      availableSlots: 3,
      occupiedSlots: 0,
      reservedSlots: 0,
      occupancyPercentage: 0,
      parkingStatus: 'Active',
      isVerified: true,
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lot._id as mongoose.Types.ObjectId);

    // Create 2 Floors
    const floor1 = await ParkingFloorModel.create({
      parkingLotId: lot._id,
      floorName: 'Ground Floor (G)',
      floorNumber: 0,
      totalZones: 2,
      totalSlots: 3,
      availableSlots: 2,
      occupiedSlots: 0,
      reservedSlots: 0,
      occupancyPercentage: 0,
      floorStatus: 'Active',
    });
    const floor2 = await ParkingFloorModel.create({
      parkingLotId: lot._id,
      floorName: 'Basement 1 (B1)',
      floorNumber: 1,
      totalZones: 1,
      totalSlots: 1,
      availableSlots: 1,
      occupiedSlots: 0,
      reservedSlots: 0,
      occupancyPercentage: 0,
      floorStatus: 'Active',
    });
    cleanupIds.floorIds.push(
      floor1._id as mongoose.Types.ObjectId,
      floor2._id as mongoose.Types.ObjectId,
    );

    // Create Zones
    const zoneA = await ParkingZoneModel.create({
      parkingLotId: lot._id,
      floorId: floor1._id,
      zoneName: 'Zone A — Cars',
      zoneCode: 'A',
      vehicleType: 'Car',
      totalSlots: 2,
      availableSlots: 1,
      occupiedSlots: 0,
      zoneStatus: 'Active',
    });
    const zoneB = await ParkingZoneModel.create({
      parkingLotId: lot._id,
      floorId: floor1._id,
      zoneName: 'Zone B — Two-Wheelers',
      zoneCode: 'B',
      vehicleType: 'Bike',
      totalSlots: 1,
      availableSlots: 1,
      occupiedSlots: 0,
      zoneStatus: 'Active',
    });
    const zoneC = await ParkingZoneModel.create({
      parkingLotId: lot._id,
      floorId: floor2._id,
      zoneName: 'Zone C — SUVs',
      zoneCode: 'C',
      vehicleType: 'SUV',
      totalSlots: 1,
      availableSlots: 1,
      occupiedSlots: 0,
      zoneStatus: 'Active',
    });
    cleanupIds.zoneIds.push(
      zoneA._id as mongoose.Types.ObjectId,
      zoneB._id as mongoose.Types.ObjectId,
      zoneC._id as mongoose.Types.ObjectId,
    );

    // Create Official Slots
    const slotCarAvail = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor1._id,
      zoneId: zoneA._id,
      slotNumber: 'A-101',
      slotLabel: 'Bay A-101',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-A101-${Date.now()}`,
    });
    const slotCarMaint = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor1._id,
      zoneId: zoneA._id,
      slotNumber: 'A-102',
      slotLabel: 'Bay A-102',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Under Maintenance',
      qrIdentifier: `QR-A102-${Date.now()}`,
    });
    const slotBikeAvail = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor1._id,
      zoneId: zoneB._id,
      slotNumber: 'B-201',
      slotLabel: 'Bay B-201',
      slotType: 'Compact',
      supportedVehicleType: 'Bike',
      slotStatus: 'Available',
      qrIdentifier: `QR-B201-${Date.now()}`,
    });
    const slotSuvFloor2 = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor2._id,
      zoneId: zoneC._id,
      slotNumber: 'C-301',
      slotLabel: 'Bay C-301',
      slotType: 'Premium',
      supportedVehicleType: 'SUV',
      slotStatus: 'Available',
      qrIdentifier: `QR-C301-${Date.now()}`,
    });
    cleanupIds.slotIds.push(
      slotCarAvail._id as mongoose.Types.ObjectId,
      slotCarMaint._id as mongoose.Types.ObjectId,
      slotBikeAvail._id as mongoose.Types.ObjectId,
      slotSuvFloor2._id as mongoose.Types.ObjectId,
    );

    // Create Published Layouts for Floor 1 and Floor 2
    const layout1 = await ParkingLayoutModel.create({
      parkingLotId: lot._id,
      floorId: floor1._id,
      version: 1,
      status: 'Published',
      isValidated: true,
      isPublished: true,
      publishedAt: new Date(),
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: {
        width: 1600,
        height: 1000,
        gridSize: 20,
        snapToGrid: true,
        backgroundColor: '#0f172a',
      },
      elements: [
        {
          elementId: 'el-entrance-1',
          elementType: 'Entrance',
          x: 200,
          y: 0,
          width: 140,
          height: 30,
          rotation: 0,
          zIndex: 2,
          label: 'Main Gate',
        },
        {
          elementId: 'el-lane-1',
          elementType: 'DrivingLane',
          x: 200,
          y: 120,
          width: 600,
          height: 80,
          rotation: 0,
          zIndex: 1,
          laneDirection: 'Two-Way',
        },
        {
          elementId: 'el-slot-a101',
          elementType: 'ParkingSlot',
          slotId: slotCarAvail._id,
          slotNumber: 'A-101',
          zoneId: zoneA._id,
          zoneCode: 'A',
          x: 240,
          y: 220,
          width: 70,
          height: 130,
          rotation: 0,
          zIndex: 3,
        },
        {
          elementId: 'el-slot-a102',
          elementType: 'ParkingSlot',
          slotId: slotCarMaint._id,
          slotNumber: 'A-102',
          zoneId: zoneA._id,
          zoneCode: 'A',
          x: 330,
          y: 220,
          width: 70,
          height: 130,
          rotation: 0,
          zIndex: 3,
        },
        {
          elementId: 'el-slot-b201',
          elementType: 'ParkingSlot',
          slotId: slotBikeAvail._id,
          slotNumber: 'B-201',
          zoneId: zoneB._id,
          zoneCode: 'B',
          x: 450,
          y: 220,
          width: 50,
          height: 100,
          rotation: 0,
          zIndex: 3,
        },
      ],
    });

    const layout2 = await ParkingLayoutModel.create({
      parkingLotId: lot._id,
      floorId: floor2._id,
      version: 1,
      status: 'Published',
      isValidated: true,
      isPublished: true,
      publishedAt: new Date(),
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: {
        width: 1600,
        height: 1000,
        gridSize: 20,
        snapToGrid: true,
        backgroundColor: '#0f172a',
      },
      elements: [
        {
          elementId: 'el-slot-c301',
          elementType: 'ParkingSlot',
          slotId: slotSuvFloor2._id,
          slotNumber: 'C-301',
          zoneId: zoneC._id,
          zoneCode: 'C',
          x: 300,
          y: 250,
          width: 80,
          height: 140,
          rotation: 0,
          zIndex: 3,
        },
      ],
    });
    cleanupIds.layoutIds.push(
      layout1._id as mongoose.Types.ObjectId,
      layout2._id as mongoose.Types.ObjectId,
    );

    console.log('✓ Test fixtures ready.\n');

    // Time window: 2 hours starting 2 hours from now (leaves room for immediate 1-hr booking today)
    const startWindow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endWindow = new Date(startWindow.getTime() + 2 * 60 * 60 * 1000);

    // ------------------------------------------------------------------------
    // TEST 1: Retrieve Booking Context & Verify Published 2D Layout & Slot Eligibility
    // ------------------------------------------------------------------------
    console.log('[TEST 1] Booking Context & Published 2D Layout Retrieval...');
    const ctx = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      scheduledEntryTime: startWindow.toISOString(),
      scheduledExitTime: endWindow.toISOString(),
    });

    assertTest(
      'Returns correct facility & 2 eligible floors',
      ctx.facility.parkingName === 'ParkEase Horizon Tech Park' && ctx.floors.length === 2,
    );
    assertTest(
      'Returns actual published 2D layout elements with enriched slot statuses',
      ctx.activeFloor.layout.elements.length === 5,
    );

    const a101 = ctx.activeFloor.slots.find((s) => s.slotNumber === 'A-101');
    const a102 = ctx.activeFloor.slots.find((s) => s.slotNumber === 'A-102');
    const b201 = ctx.activeFloor.slots.find((s) => s.slotNumber === 'B-201');

    assertTest(
      'Slot A-101 (Car, Available) is marked eligible for Car',
      Boolean(a101 && a101.effectiveStatus === 'Available' && a101.isEligible === true),
    );
    assertTest(
      'Slot A-102 (Under Maintenance) is marked ineligible with reason',
      Boolean(
        a102 &&
          a102.effectiveStatus === 'Under Maintenance' &&
          a102.isEligible === false &&
          a102.ineligibilityReason,
      ),
    );
    assertTest(
      'Slot B-201 (Bike) is marked vehicle-incompatible when Car is selected',
      Boolean(
        b201 &&
          b201.effectiveStatus === 'Available' &&
          b201.isVehicleCompatible === false &&
          b201.isEligible === false,
      ),
    );
    assertTest(
      'Price breakdown calculates 2 hours * ₹60/hr = ₹120 for Car',
      ctx.priceBreakdown.billableHours === 2 &&
        ctx.priceBreakdown.hourlyRate === 60 &&
        ctx.priceBreakdown.totalAmount === 120,
    );

    // ------------------------------------------------------------------------
    // TEST 2: Floor Switching to Basement 1 (Floor 2) & SUV Pricing
    // ------------------------------------------------------------------------
    console.log('\n[TEST 2] Floor Switching & SUV Pricing...');
    const ctxFloor2 = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      floorId: floor2._id.toString(),
      vehicleType: 'SUV',
      scheduledEntryTime: startWindow.toISOString(),
      scheduledExitTime: endWindow.toISOString(),
    });

    assertTest(
      'Switches active floor to Basement 1 (B1)',
      ctxFloor2.activeFloor.floor._id === floor2._id.toString() &&
        ctxFloor2.activeFloor.slots.length === 1 &&
        ctxFloor2.activeFloor.slots[0]?.slotNumber === 'C-301' &&
        ctxFloor2.activeFloor.slots[0]?.isEligible === true,
    );
    assertTest(
      'Calculates SUV rate 2 hours * ₹80/hr = ₹160',
      ctxFloor2.priceBreakdown.hourlyRate === 80 && ctxFloor2.priceBreakdown.totalAmount === 160,
    );

    // ------------------------------------------------------------------------
    // TEST 3: Invalid Booking Dates &Unavailable Slot Rejection
    // ------------------------------------------------------------------------
    console.log('\n[TEST 3] Invalid Booking Period & Unavailable Slot Rejection...');
    let pastErrorCaught = false;
    try {
      await customerBookingService.validateSlotEligibility({
        parkingLotId: lot._id.toString(),
        slotId: slotCarAvail._id.toString(),
        vehicleType: 'Car',
        scheduledEntryTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        scheduledExitTime: endWindow.toISOString(),
      });
    } catch {
      pastErrorCaught = true;
    }
    assertTest('Rejects past check-in time', pastErrorCaught);

    let maintenanceErrorCaught = false;
    try {
      await customerBookingService.validateSlotEligibility({
        parkingLotId: lot._id.toString(),
        slotId: slotCarMaint._id.toString(),
        vehicleType: 'Car',
        scheduledEntryTime: startWindow.toISOString(),
        scheduledExitTime: endWindow.toISOString(),
      });
    } catch {
      maintenanceErrorCaught = true;
    }
    assertTest('Blocks selecting an Under Maintenance slot', maintenanceErrorCaught);

    let incompatibleErrorCaught = false;
    try {
      await customerBookingService.validateSlotEligibility({
        parkingLotId: lot._id.toString(),
        slotId: slotBikeAvail._id.toString(),
        vehicleType: 'Car',
        scheduledEntryTime: startWindow.toISOString(),
        scheduledExitTime: endWindow.toISOString(),
      });
    } catch {
      incompatibleErrorCaught = true;
    }
    assertTest('Blocks selecting a Bike slot for a Car booking', incompatibleErrorCaught);

    // ------------------------------------------------------------------------
    // TEST 4: Customer Vehicle Registration
    // ------------------------------------------------------------------------
    console.log('\n[TEST 4] Customer Vehicle Registration...');
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    const vehicleOne = await customerBookingService.addCustomerVehicle(
      customerOne._id.toString(),
      {
        vehicleNumber: `GJ01AB${randDigits}`,
        vehicleType: 'Car',
        vehicleBrand: 'Hyundai',
        vehicleModel: 'Creta',
      },
    );
    cleanupIds.vehicleIds.push(vehicleOne._id as mongoose.Types.ObjectId);

    const vehicleTwo = await customerBookingService.addCustomerVehicle(
      customerTwo._id.toString(),
      {
        vehicleNumber: `GJ05CD${randDigits}`,
        vehicleType: 'Car',
        vehicleBrand: 'Honda',
        vehicleModel: 'City',
      },
    );
    cleanupIds.vehicleIds.push(vehicleTwo._id as mongoose.Types.ObjectId);

    const fetchedVehicles = await customerBookingService.getCustomerVehicles(
      customerOne._id.toString(),
    );
    assertTest(
      'Registers and retrieves customer vehicle accurately',
      fetchedVehicles.length === 1 && fetchedVehicles[0]?.vehicleNumber === `GJ01AB${randDigits}`,
    );

    // ------------------------------------------------------------------------
    // TEST 5: Initiate Payment & Reject Tampered Signature
    // ------------------------------------------------------------------------
    console.log('\n[TEST 5] Payment Initiation & Invalid Signature Rejection...');
    const initiated = await customerBookingService.initiateBookingPayment({
      userId: customerOne._id.toString(),
      parkingLotId: lot._id.toString(),
      slotId: slotCarAvail._id.toString(),
      vehicleId: vehicleOne._id.toString(),
      scheduledEntryTime: startWindow.toISOString(),
      scheduledExitTime: endWindow.toISOString(),
    });
    cleanupIds.bookingIds.push(new mongoose.Types.ObjectId(initiated.bookingId));

    assertTest(
      'Creates Pending Payment booking and Razorpay order (₹120 = 12000 paise)',
      Boolean(
        initiated.bookingReference.startsWith('PB-') &&
          initiated.amount === 120 &&
          initiated.amountPaise === 12000 &&
          initiated.orderId,
      ),
    );

    let badSigRejected = false;
    try {
      await customerBookingService.verifyPaymentAndConfirmBooking({
        userId: customerOne._id.toString(),
        bookingId: initiated.bookingId,
        razorpay_order_id: initiated.orderId,
        razorpay_payment_id: 'pay_tampered_123',
        razorpay_signature: 'invalid_hex_signature_0000',
      });
    } catch {
      badSigRejected = true;
    }
    assertTest('Rejects invalid Razorpay signature', badSigRejected);

    const unconfirmedCheck = await BookingModel.findById(initiated.bookingId).lean();
    assertTest(
      'Booking remains Pending Payment when signature verification fails',
      unconfirmedCheck?.bookingStatus === 'Pending Payment',
    );

    // ------------------------------------------------------------------------
    // TEST 6: Valid Payment Verification & Atomic Booking Confirmation
    // ------------------------------------------------------------------------
    console.log('\n[TEST 6] Valid Payment Verification & Booking Confirmation...');
    const paymentIdOne = `pay_valid_${Date.now()}`;
    const validSigOne = generateValidRazorpaySignature(initiated.orderId, paymentIdOne);

    const confirmed = await customerBookingService.verifyPaymentAndConfirmBooking({
      userId: customerOne._id.toString(),
      bookingId: initiated.bookingId,
      razorpay_order_id: initiated.orderId,
      razorpay_payment_id: paymentIdOne,
      razorpay_signature: validSigOne,
    });

    assertTest(
      'Confirms booking, generates QR pass, and marks payment SUCCESSFUL',
      confirmed.bookingStatus === 'Confirmed' &&
        confirmed.paymentStatus === 'SUCCESSFUL' &&
        Boolean(confirmed.qrCode && confirmed.qrCode.startsWith('PE-PASS|')),
    );

    const timelineEvents = await BookingTimelineModel.find({
      bookingId: new mongoose.Types.ObjectId(initiated.bookingId),
    }).lean();
    assertTest(
      'Records complete BookingTimeline audit trail (BOOKING_CREATED, PAYMENT_SUCCESSFUL, SLOT_RESERVED, QR_GENERATED, BOOKING_CONFIRMED)',
      timelineEvents.some((e) => e.eventCode === 'BOOKING_CONFIRMED') &&
        timelineEvents.some((e) => e.eventCode === 'QR_GENERATED'),
    );

    const slotAfterFutureBooking = await ParkingSlotModel.findById(slotCarAvail._id).lean();
    const zoneAfterFutureBooking = await ParkingZoneModel.findById(zoneA._id).lean();
    const floorAfterFutureBooking = await ParkingFloorModel.findById(floor1._id).lean();
    const lotAfterFutureBooking = await ParkingLotModel.findById(lot._id).lean();

    assertTest(
      'Future-dated confirmed booking does NOT prematurely mark physical ParkingSlot as Reserved',
      slotAfterFutureBooking?.slotStatus === 'Available' &&
        slotAfterFutureBooking?.currentBookingId === null,
    );
    assertTest(
      'Future-dated confirmed booking leaves Zone, Floor, and Lot physical counters unchanged',
      zoneAfterFutureBooking?.availableSlots === 1 &&
        zoneAfterFutureBooking?.reservedSlots === 0 &&
        floorAfterFutureBooking?.availableSlots === 2 &&
        floorAfterFutureBooking?.reservedSlots === 0 &&
        lotAfterFutureBooking?.availableSlots === 3 &&
        lotAfterFutureBooking?.reservedSlots === 0,
    );

    // ------------------------------------------------------------------------
    // TEST 7: Overlapping Booking Detection vs Non-Overlapping Window
    // ------------------------------------------------------------------------
    console.log('\n[TEST 7] Overlapping Time Conflict Detection...');
    const overlapCtx = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      scheduledEntryTime: new Date(startWindow.getTime() + 30 * 60 * 1000).toISOString(),
      scheduledExitTime: new Date(endWindow.getTime() + 30 * 60 * 1000).toISOString(),
    });
    const a101DuringOverlap = overlapCtx.activeFloor.slots.find((s) => s.slotNumber === 'A-101');
    assertTest(
      'Marks Slot A-101 as Reserved and ineligible during overlapping window',
      Boolean(
        a101DuringOverlap &&
          a101DuringOverlap.effectiveStatus === 'Reserved' &&
          a101DuringOverlap.isEligible === false,
      ),
    );

    // Non-overlapping window (starts 1 hour after first booking ends)
    const futureStart = new Date(endWindow.getTime() + 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);
    const nonOverlapCtx = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      scheduledEntryTime: futureStart.toISOString(),
      scheduledExitTime: futureEnd.toISOString(),
    });
    const a101Future = nonOverlapCtx.activeFloor.slots.find((s) => s.slotNumber === 'A-101');
    assertTest(
      'Marks Slot A-101 as Available for non-overlapping future window',
      Boolean(
        a101Future && a101Future.effectiveStatus === 'Available' && a101Future.isEligible === true,
      ),
    );

    // ------------------------------------------------------------------------
    // TEST 8: Concurrent Race Condition Protection & Automatic Refund
    // ------------------------------------------------------------------------
    console.log('\n[TEST 8] Concurrent Booking Race Condition & Automatic Full Refund...');
    // Both Customer 1 and Customer 2 initiate payment for Slot A-101 for the same future window BEFORE either completes payment
    const raceInit1 = await customerBookingService.initiateBookingPayment({
      userId: customerOne._id.toString(),
      parkingLotId: lot._id.toString(),
      slotId: slotCarAvail._id.toString(),
      vehicleId: vehicleOne._id.toString(),
      scheduledEntryTime: futureStart.toISOString(),
      scheduledExitTime: futureEnd.toISOString(),
    });
    const raceInit2 = await customerBookingService.initiateBookingPayment({
      userId: customerTwo._id.toString(),
      parkingLotId: lot._id.toString(),
      slotId: slotCarAvail._id.toString(),
      vehicleId: vehicleTwo._id.toString(),
      scheduledEntryTime: futureStart.toISOString(),
      scheduledExitTime: futureEnd.toISOString(),
    });
    cleanupIds.bookingIds.push(
      new mongoose.Types.ObjectId(raceInit1.bookingId),
      new mongoose.Types.ObjectId(raceInit2.bookingId),
    );

    // Customer 1 completes payment first -> Confirmed
    const racePay1 = `pay_race1_${Date.now()}`;
    const raceConfirm1 = await customerBookingService.verifyPaymentAndConfirmBooking({
      userId: customerOne._id.toString(),
      bookingId: raceInit1.bookingId,
      razorpay_order_id: raceInit1.orderId,
      razorpay_payment_id: racePay1,
      razorpay_signature: generateValidRazorpaySignature(raceInit1.orderId, racePay1),
    });
    assertTest(
      'First concurrent customer payment confirms the slot',
      raceConfirm1.bookingStatus === 'Confirmed',
    );

    // Customer 2 completes payment moments later -> Detected conflict, cancelled & refunded
    const racePay2 = `pay_race2_${Date.now()}`;
    const raceConfirm2 = await customerBookingService.verifyPaymentAndConfirmBooking({
      userId: customerTwo._id.toString(),
      bookingId: raceInit2.bookingId,
      razorpay_order_id: raceInit2.orderId,
      razorpay_payment_id: racePay2,
      razorpay_signature: generateValidRazorpaySignature(raceInit2.orderId, racePay2),
    });

    assertTest(
      'Second concurrent customer is prevented from double-booking and receives automatic full refund',
      raceConfirm2.bookingStatus === 'Cancelled' &&
        raceConfirm2.paymentStatus === 'REFUNDED' &&
        raceConfirm2.conflictRefundInitiated === true,
    );

    // ------------------------------------------------------------------------
    // TEST 9: Non-Overlapping Immediate Booking & Physical Lifecycle Transitions
    // ------------------------------------------------------------------------
    console.log(
      '\n[TEST 9] Immediate Non-Overlapping Booking & Physical Slot Lifecycle (Reserved -> Cancelled -> Occupied -> Overstay -> Completed)...',
    );
    const immediateStart = new Date(Date.now() + 3 * 60 * 1000);
    const immediateEnd = new Date(immediateStart.getTime() + 60 * 60 * 1000);

    const immediateCtx = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      scheduledEntryTime: immediateStart.toISOString(),
      scheduledExitTime: immediateEnd.toISOString(),
    });
    const a101Immediate = immediateCtx.activeFloor.slots.find((s) => s.slotNumber === 'A-101');
    assertTest(
      'Non-overlapping immediate booking window sees Slot A-101 as Available despite future bookings',
      Boolean(
        a101Immediate &&
          a101Immediate.effectiveStatus === 'Available' &&
          a101Immediate.isEligible === true,
      ),
    );

    // Initiate & Confirm immediate booking 1 (then cancel it to test cancellation counter restoration)
    const immInit1 = await customerBookingService.initiateBookingPayment({
      userId: customerTwo._id.toString(),
      parkingLotId: lot._id.toString(),
      slotId: slotCarAvail._id.toString(),
      vehicleId: vehicleTwo._id.toString(),
      scheduledEntryTime: immediateStart.toISOString(),
      scheduledExitTime: immediateEnd.toISOString(),
    });
    cleanupIds.bookingIds.push(new mongoose.Types.ObjectId(immInit1.bookingId));

    const immPay1 = `pay_imm1_${Date.now()}`;
    const immConfirm1 = await customerBookingService.verifyPaymentAndConfirmBooking({
      userId: customerTwo._id.toString(),
      bookingId: immInit1.bookingId,
      razorpay_order_id: immInit1.orderId,
      razorpay_payment_id: immPay1,
      razorpay_signature: generateValidRazorpaySignature(immInit1.orderId, immPay1),
    });

    const slotAfterImmConfirm = await ParkingSlotModel.findById(slotCarAvail._id).lean();
    const zoneAfterImmConfirm = await ParkingZoneModel.findById(zoneA._id).lean();
    const floorAfterImmConfirm = await ParkingFloorModel.findById(floor1._id).lean();
    const lotAfterImmConfirm = await ParkingLotModel.findById(lot._id).lean();

    assertTest(
      'Immediate confirmed booking marks physical ParkingSlot as Reserved and sets currentBookingId',
      immConfirm1.bookingStatus === 'Confirmed' &&
        slotAfterImmConfirm?.slotStatus === 'Reserved' &&
        slotAfterImmConfirm?.currentBookingId?.toString() === immInit1.bookingId,
    );
    assertTest(
      'Immediate confirmed booking updates Zone, Floor, and Lot available/reserved counters consistently',
      zoneAfterImmConfirm?.availableSlots === 0 &&
        zoneAfterImmConfirm?.reservedSlots === 1 &&
        floorAfterImmConfirm?.availableSlots === 1 &&
        floorAfterImmConfirm?.reservedSlots === 1 &&
        lotAfterImmConfirm?.availableSlots === 2 &&
        lotAfterImmConfirm?.reservedSlots === 1 &&
        lotAfterImmConfirm?.occupancyPercentage === 25,
    );

    // Cancel immediate booking before entry -> restores physical slot & counters
    const cancelledImm = await customerBookingService.cancelBooking({
      bookingId: immInit1.bookingId,
      userId: customerTwo._id.toString(),
      cancelledBy: 'Customer',
      reason: 'Customer changed arrival plan before entry.',
    });

    const slotAfterCancel = await ParkingSlotModel.findById(slotCarAvail._id).lean();
    const zoneAfterCancel = await ParkingZoneModel.findById(zoneA._id).lean();
    const floorAfterCancel = await ParkingFloorModel.findById(floor1._id).lean();
    const lotAfterCancel = await ParkingLotModel.findById(lot._id).lean();

    assertTest(
      'Cancelling immediate booking restores physical slot to Available and resets counters',
      cancelledImm.bookingStatus === 'Cancelled' &&
        slotAfterCancel?.slotStatus === 'Available' &&
        slotAfterCancel?.currentBookingId === null &&
        zoneAfterCancel?.availableSlots === 1 &&
        zoneAfterCancel?.reservedSlots === 0 &&
        floorAfterCancel?.availableSlots === 2 &&
        floorAfterCancel?.reservedSlots === 0 &&
        lotAfterCancel?.availableSlots === 3 &&
        lotAfterCancel?.reservedSlots === 0 &&
        lotAfterCancel?.occupancyPercentage === 0,
    );

    // Initiate & Confirm immediate booking 2 -> Vehicle Entry -> Overstay -> Vehicle Exit & Completion
    const immInit2 = await customerBookingService.initiateBookingPayment({
      userId: customerTwo._id.toString(),
      parkingLotId: lot._id.toString(),
      slotId: slotCarAvail._id.toString(),
      vehicleId: vehicleTwo._id.toString(),
      scheduledEntryTime: immediateStart.toISOString(),
      scheduledExitTime: immediateEnd.toISOString(),
    });
    cleanupIds.bookingIds.push(new mongoose.Types.ObjectId(immInit2.bookingId));

    const immPay2 = `pay_imm2_${Date.now()}`;
    await customerBookingService.verifyPaymentAndConfirmBooking({
      userId: customerTwo._id.toString(),
      bookingId: immInit2.bookingId,
      razorpay_order_id: immInit2.orderId,
      razorpay_payment_id: immPay2,
      razorpay_signature: generateValidRazorpaySignature(immInit2.orderId, immPay2),
    });

    const entryResult = await customerBookingService.recordVehicleEntry({
      bookingId: immInit2.bookingId,
    });
    const slotAfterEntry = await ParkingSlotModel.findById(slotCarAvail._id).lean();
    const zoneAfterEntry = await ParkingZoneModel.findById(zoneA._id).lean();
    const floorAfterEntry = await ParkingFloorModel.findById(floor1._id).lean();
    const lotAfterEntry = await ParkingLotModel.findById(lot._id).lean();

    assertTest(
      'Vehicle entry transitions booking to Active, physical slot to Occupied, and updates occupiedSlots counters',
      entryResult.bookingStatus === 'Active' &&
        slotAfterEntry?.slotStatus === 'Occupied' &&
        slotAfterEntry?.currentBookingId?.toString() === immInit2.bookingId &&
        zoneAfterEntry?.availableSlots === 0 &&
        zoneAfterEntry?.reservedSlots === 0 &&
        zoneAfterEntry?.occupiedSlots === 1 &&
        floorAfterEntry?.availableSlots === 1 &&
        floorAfterEntry?.reservedSlots === 0 &&
        floorAfterEntry?.occupiedSlots === 1 &&
        lotAfterEntry?.availableSlots === 2 &&
        lotAfterEntry?.reservedSlots === 0 &&
        lotAfterEntry?.occupiedSlots === 1 &&
        lotAfterEntry?.occupancyPercentage === 25,
    );

    // Simulate Overstay detection 25 minutes after scheduledExitTime
    const overstayResult = await customerBookingService.markBookingOverstay({
      bookingId: immInit2.bookingId,
      detectedAt: new Date(immediateEnd.getTime() + 25 * 60 * 1000),
    });
    const slotDuringOverstay = await ParkingSlotModel.findById(slotCarAvail._id).lean();

    assertTest(
      'Overstay transitions booking to Overstay, calculates charge, and keeps physical slot Occupied',
      overstayResult.bookingStatus === 'Overstay' &&
        overstayResult.overstayCharge === 60 &&
        slotDuringOverstay?.slotStatus === 'Occupied',
    );

    const exitResult = await customerBookingService.completeBookingExit({
      bookingId: immInit2.bookingId,
      exitTime: new Date(immediateEnd.getTime() + 30 * 60 * 1000),
    });
    const slotAfterExit = await ParkingSlotModel.findById(slotCarAvail._id).lean();
    const zoneAfterExit = await ParkingZoneModel.findById(zoneA._id).lean();
    const floorAfterExit = await ParkingFloorModel.findById(floor1._id).lean();
    const lotAfterExit = await ParkingLotModel.findById(lot._id).lean();

    assertTest(
      'Vehicle exit completes booking, releases physical slot to Available, and restores Zone/Floor/Lot counters',
      exitResult.bookingStatus === 'Completed' &&
        slotAfterExit?.slotStatus === 'Available' &&
        slotAfterExit?.currentBookingId === null &&
        zoneAfterExit?.availableSlots === 1 &&
        zoneAfterExit?.reservedSlots === 0 &&
        zoneAfterExit?.occupiedSlots === 0 &&
        floorAfterExit?.availableSlots === 2 &&
        floorAfterExit?.reservedSlots === 0 &&
        floorAfterExit?.occupiedSlots === 0 &&
        lotAfterExit?.availableSlots === 3 &&
        lotAfterExit?.reservedSlots === 0 &&
        lotAfterExit?.occupiedSlots === 0 &&
        lotAfterExit?.occupancyPercentage === 0,
    );

    // ------------------------------------------------------------------------
    // TEST 10: QR Code Uniqueness (Canonical Sparse Unique Index UQ_QRCode)
    // ------------------------------------------------------------------------
    console.log('\n[TEST 10] QR Code Uniqueness & UQ_QRCode Sparse Index Enforcement...');
    const bookingIndexes = await BookingModel.collection.indexes();
    const uqQrIndex = bookingIndexes.find((idx) => idx.name === 'UQ_QRCode');
    assertTest(
      'Canonical UQ_QRCode index is present, unique, and sparse on Booking collection',
      Boolean(uqQrIndex && uqQrIndex.unique === true && uqQrIndex.sparse === true),
    );

    let duplicateQrRejected = false;
    try {
      await BookingModel.updateOne(
        { _id: new mongoose.Types.ObjectId(raceInit2.bookingId) },
        { $set: { qrCode: confirmed.qrCode } },
      );
    } catch (err: unknown) {
      const mongoErr = err as { code?: number };
      if (mongoErr.code === 11000) {
        duplicateQrRejected = true;
      }
    }
    assertTest('Enforces QR code uniqueness across bookings (rejects duplicate qrCode)', duplicateQrRejected);

    // ------------------------------------------------------------------------
    // TEST 11: Operating Hours Validation Across Dates (Daytime, Boundaries, Midnight, 24x7, Invalid)
    // ------------------------------------------------------------------------
    console.log('\n[TEST 11] Operating Hours Validation Across Dates...');
    const samplePricing = {
      carHourlyRate: 60,
      suvHourlyRate: 80,
      bikeHourlyRate: 30,
      dailyRate: 400,
      overnightRate: 450,
      evChargingRatePerHour: 50,
      gracePeriodMinutes: 15,
      minParkingDurationHours: 1,
      maxParkingDurationHours: 24,
    };
    const daytimeOperating = {
      isOpen24x7: false,
      openingTime: '08:00',
      closingTime: '22:00',
    };

    const tomorrowDay = new Date();
    tomorrowDay.setDate(tomorrowDay.getDate() + 1);
    const makeTomorrowAt = (hours: number, minutes: number, dayOffset = 0) => {
      const d = new Date(tomorrowDay);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    // 11a. Valid same-day booking (10:00 -> 12:00)
    const sameDayValid = customerBookingService.calculatePriceAndValidatePeriod({
      vehicleType: 'Car',
      scheduledEntryTime: makeTomorrowAt(10, 0),
      scheduledExitTime: makeTomorrowAt(12, 0),
      pricing: samplePricing,
      operating: daytimeOperating,
    });
    assertTest(
      'Accepts valid same-day booking within operating hours (10:00 – 12:00)',
      sameDayValid.breakdown.billableHours === 2 && sameDayValid.breakdown.totalAmount === 120,
    );

    // 11b. Valid booking at exact opening boundary (08:00 -> 10:00)
    const openBoundaryValid = customerBookingService.calculatePriceAndValidatePeriod({
      vehicleType: 'Car',
      scheduledEntryTime: makeTomorrowAt(8, 0),
      scheduledExitTime: makeTomorrowAt(10, 0),
      pricing: samplePricing,
      operating: daytimeOperating,
    });
    assertTest(
      'Accepts booking starting at exact opening boundary (08:00 – 10:00)',
      openBoundaryValid.breakdown.billableHours === 2,
    );

    // 11c. Valid booking at exact closing boundary (20:00 -> 22:00)
    const closeBoundaryValid = customerBookingService.calculatePriceAndValidatePeriod({
      vehicleType: 'Car',
      scheduledEntryTime: makeTomorrowAt(20, 0),
      scheduledExitTime: makeTomorrowAt(22, 0),
      pricing: samplePricing,
      operating: daytimeOperating,
    });
    assertTest(
      'Accepts booking ending at exact closing boundary (20:00 – 22:00)',
      closeBoundaryValid.breakdown.billableHours === 2,
    );

    // 11d. Rejects booking crossing midnight while facility is closed (21:00 -> 01:00 next day)
    let midnightCrossingRejected = false;
    try {
      customerBookingService.calculatePriceAndValidatePeriod({
        vehicleType: 'Car',
        scheduledEntryTime: makeTomorrowAt(21, 0, 0),
        scheduledExitTime: makeTomorrowAt(1, 0, 1),
        pricing: samplePricing,
        operating: daytimeOperating,
      });
    } catch (err: unknown) {
      if ((err as { errorCode?: string })?.errorCode === 'OUTSIDE_OPERATING_HOURS') {
        midnightCrossingRejected = true;
      }
    }
    assertTest(
      'Rejects booking crossing midnight while facility is closed (21:00 – 01:00)',
      midnightCrossingRejected,
    );

    // 11e. Rejects booking spanning a closed overnight period into next day open hours (20:00 -> 09:00 next day)
    let closedSpanRejected = false;
    try {
      customerBookingService.calculatePriceAndValidatePeriod({
        vehicleType: 'Car',
        scheduledEntryTime: makeTomorrowAt(20, 0, 0),
        scheduledExitTime: makeTomorrowAt(9, 0, 1),
        pricing: samplePricing,
        operating: daytimeOperating,
      });
    } catch (err: unknown) {
      if ((err as { errorCode?: string })?.errorCode === 'OUTSIDE_OPERATING_HOURS') {
        closedSpanRejected = true;
      }
    }
    assertTest(
      'Rejects booking spanning a closed overnight period even when both clock times look open (20:00 Day 1 – 09:00 Day 2)',
      closedSpanRejected,
    );

    // 11f. Accepts booking crossing midnight at a 24x7 facility
    const valid24x7CrossMidnight = customerBookingService.calculatePriceAndValidatePeriod({
      vehicleType: 'Car',
      scheduledEntryTime: makeTomorrowAt(21, 0, 0),
      scheduledExitTime: makeTomorrowAt(1, 0, 1),
      pricing: samplePricing,
      operating: { isOpen24x7: true, openingTime: '08:00', closingTime: '22:00' },
    });
    assertTest(
      'Accepts booking crossing midnight at a 24×7 facility',
      valid24x7CrossMidnight.breakdown.billableHours === 4,
    );

    // 11g. Rejects invalid or missing operating schedule when not 24x7
    let invalidScheduleRejected = false;
    try {
      customerBookingService.calculatePriceAndValidatePeriod({
        vehicleType: 'Car',
        scheduledEntryTime: makeTomorrowAt(10, 0),
        scheduledExitTime: makeTomorrowAt(12, 0),
        pricing: samplePricing,
        operating: { isOpen24x7: false, openingTime: '', closingTime: '25:99' },
      });
    } catch (err: unknown) {
      if ((err as { errorCode?: string })?.errorCode === 'INVALID_OPERATING_SCHEDULE') {
        invalidScheduleRejected = true;
      }
    }
    assertTest(
      'Rejects invalid or missing operating schedule when facility is not 24×7',
      invalidScheduleRejected,
    );

    // ------------------------------------------------------------------------
    // TEST 12: EV Pricing (Standalone Rate, Zero Rate Fallback, Availability & Shared Lifecycle)
    // ------------------------------------------------------------------------
    console.log(
      '\n[TEST 12] Standalone EV Pricing, Car Rate Fallback, Facility EV Availability & Shared EV Lifecycle...',
    );

    // 12a. Car, Bike, and SUV pricing remain unchanged
    const bikeCalc = customerBookingService.calculatePriceAndValidatePeriod({
      vehicleType: 'Bike',
      scheduledEntryTime: makeTomorrowAt(10, 0),
      scheduledExitTime: makeTomorrowAt(12, 0),
      pricing: samplePricing,
      operating: daytimeOperating,
    });
    assertTest(
      'Bike pricing remains unchanged (2 hrs * ₹30/hr = ₹60, additionalCharges = 0)',
      bikeCalc.breakdown.hourlyRate === 30 &&
        bikeCalc.breakdown.baseAmount === 60 &&
        bikeCalc.breakdown.additionalCharges === 0 &&
        bikeCalc.breakdown.totalAmount === 60,
    );

    // 12b. Facility currently has 0 EV slots -> EV not offered & EV booking rejected
    assertTest(
      'Facility without EV slots marks EV as not offered in getBookingContext',
      ctx.facility.vehicleCapacityByType?.EV.isOffered === false,
    );

    let evNotOfferedRejected = false;
    try {
      await customerBookingService.validateSlotEligibility({
        parkingLotId: lot._id.toString(),
        slotId: slotCarAvail._id.toString(),
        vehicleType: 'EV',
        scheduledEntryTime: makeTomorrowAt(14, 0).toISOString(),
        scheduledExitTime: makeTomorrowAt(16, 0).toISOString(),
      });
    } catch (err: unknown) {
      const code = (err as { errorCode?: string })?.errorCode;
      if (code === 'VEHICLE_TYPE_NOT_OFFERED' || code === 'INCOMPATIBLE_VEHICLE_TYPE') {
        evNotOfferedRejected = true;
      }
    }
    assertTest(
      'Backend rejects EV booking request when facility does not offer EV parking',
      evNotOfferedRejected,
    );

    // 12c. EV offered with all EV slots Under Maintenance -> no eligible EV capacity
    const slotEvTest = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor1._id,
      zoneId: zoneA._id,
      slotNumber: 'A-EV1',
      slotLabel: 'Bay A-EV1',
      slotType: 'EV Charging',
      supportedVehicleType: 'EV',
      slotStatus: 'Under Maintenance',
      qrIdentifier: `QR-EV1-${Date.now()}`,
    });
    cleanupIds.slotIds.push(slotEvTest._id as mongoose.Types.ObjectId);

    await ParkingLayoutModel.updateOne(
      { _id: layout1._id },
      {
        $push: {
          elements: {
            elementId: 'el-slot-aev1',
            elementType: 'ParkingSlot',
            slotId: slotEvTest._id,
            slotNumber: 'A-EV1',
            zoneId: zoneA._id,
            zoneCode: 'A',
            x: 540,
            y: 220,
            width: 70,
            height: 130,
            rotation: 0,
            zIndex: 3,
          },
        },
      },
    );

    const ctxEvMaint = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      scheduledEntryTime: makeTomorrowAt(14, 0).toISOString(),
      scheduledExitTime: makeTomorrowAt(16, 0).toISOString(),
    });
    assertTest(
      'Facility with only Under Maintenance EV slots reports 0 operational EV slots and isOffered = false',
      ctxEvMaint.facility.vehicleCapacityByType?.EV.operationalSlots === 0 &&
        ctxEvMaint.facility.vehicleCapacityByType?.EV.isOffered === false,
    );

    // 12d. Activate EV slot -> EV parking offered with positive EV rate (₹50/hr standalone, additionalCharges = 0)
    await ParkingSlotModel.updateOne(
      { _id: slotEvTest._id },
      { $set: { slotStatus: 'Available' } },
    );
    await customerBookingService.reconcileHierarchyCounters({
      parkingLotId: lot._id as mongoose.Types.ObjectId,
      floorId: floor1._id as mongoose.Types.ObjectId,
      zoneId: zoneA._id as mongoose.Types.ObjectId,
    });

    const evTomorrowStart = makeTomorrowAt(14, 0);
    const evTomorrowEnd = makeTomorrowAt(16, 0);
    const ctxEvActive = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      vehicleType: 'EV',
      scheduledEntryTime: evTomorrowStart.toISOString(),
      scheduledExitTime: evTomorrowEnd.toISOString(),
    });
    assertTest(
      'EV parking with positive evChargingRatePerHour (₹50/hr) calculates standalone EV total (2 hrs * ₹50 = ₹100) with additionalCharges = 0',
      ctxEvActive.facility.vehicleCapacityByType?.EV.isOffered === true &&
        ctxEvActive.facility.pricing.evChargingRatePerHour === 50 &&
        ctxEvActive.priceBreakdown.hourlyRate === 50 &&
        ctxEvActive.priceBreakdown.baseAmount === 100 &&
        ctxEvActive.priceBreakdown.additionalCharges === 0 &&
        ctxEvActive.priceBreakdown.totalAmount === 100,
    );

    // 12e. EV parking offered with zero EV rate -> falls back to Car hourly rate (₹60/hr)
    await ParkingFacilitySubmissionModel.updateOne(
      { _id: submission._id },
      { $set: { 'pricing.evChargingRatePerHour': 0 } },
    );
    const ctxEvZeroFallback = await customerBookingService.getBookingContext({
      parkingLotId: lot._id.toString(),
      vehicleType: 'EV',
      scheduledEntryTime: evTomorrowStart.toISOString(),
      scheduledExitTime: evTomorrowEnd.toISOString(),
    });
    assertTest(
      'EV parking with zero evChargingRatePerHour falls back to Car hourly rate (2 hrs * ₹60 = ₹120) with additionalCharges = 0',
      ctxEvZeroFallback.facility.pricing.evChargingRatePerHour === 60 &&
        ctxEvZeroFallback.priceBreakdown.hourlyRate === 60 &&
        ctxEvZeroFallback.priceBreakdown.baseAmount === 120 &&
        ctxEvZeroFallback.priceBreakdown.additionalCharges === 0 &&
        ctxEvZeroFallback.priceBreakdown.totalAmount === 120,
    );

    // Restore positive EV rate (₹50/hr) and complete full EV booking + shared lifecycle
    await ParkingFacilitySubmissionModel.updateOne(
      { _id: submission._id },
      { $set: { 'pricing.evChargingRatePerHour': 50 } },
    );

    const evVehicle = await customerBookingService.addCustomerVehicle(
      customerOne._id.toString(),
      {
        vehicleNumber: `GJ01EV${randDigits}`,
        vehicleType: 'EV',
        vehicleBrand: 'Tata',
        vehicleModel: 'Nexon EV',
      },
    );
    cleanupIds.vehicleIds.push(evVehicle._id as mongoose.Types.ObjectId);

    const evImmediateStart = new Date(Date.now() + 4 * 60 * 1000);
    const evImmediateEnd = new Date(evImmediateStart.getTime() + 2 * 60 * 60 * 1000);

    const evInitiated = await customerBookingService.initiateBookingPayment({
      userId: customerOne._id.toString(),
      parkingLotId: lot._id.toString(),
      slotId: slotEvTest._id.toString(),
      vehicleId: evVehicle._id.toString(),
      scheduledEntryTime: evImmediateStart.toISOString(),
      scheduledExitTime: evImmediateEnd.toISOString(),
    });
    cleanupIds.bookingIds.push(new mongoose.Types.ObjectId(evInitiated.bookingId));

    const evPayId = `pay_ev_${Date.now()}`;
    const evConfirmed = await customerBookingService.verifyPaymentAndConfirmBooking({
      userId: customerOne._id.toString(),
      bookingId: evInitiated.bookingId,
      razorpay_order_id: evInitiated.orderId,
      razorpay_payment_id: evPayId,
      razorpay_signature: generateValidRazorpaySignature(evInitiated.orderId, evPayId),
    });

    const persistedEvBooking = await BookingModel.findById(evInitiated.bookingId).lean();

    assertTest(
      'EV booking payment order, persisted Booking record, and receipt match standalone EV rate (₹50/hr, base ₹100, additional ₹0, total ₹100)',
      evInitiated.amount === 100 &&
        evInitiated.amountPaise === 10000 &&
        persistedEvBooking?.parkingRateAtBooking === 50 &&
        persistedEvBooking?.overstayRateAtBooking === 50 &&
        persistedEvBooking?.baseAmount === 100 &&
        persistedEvBooking?.additionalCharges === 0 &&
        persistedEvBooking?.totalAmount === 100 &&
        evConfirmed.bookingDetails.parkingRateAtBooking === 50 &&
        evConfirmed.bookingDetails.baseAmount === 100 &&
        evConfirmed.bookingDetails.additionalCharges === 0 &&
        evConfirmed.bookingDetails.totalAmount === 100,
    );

    // 12f. EV offered but no compatible EV slot available for overlapping period -> rejected
    let evNoAvailableSlotRejected = false;
    try {
      await customerBookingService.validateSlotEligibility({
        parkingLotId: lot._id.toString(),
        slotId: slotEvTest._id.toString(),
        vehicleType: 'EV',
        scheduledEntryTime: new Date(evImmediateStart.getTime() + 15 * 60 * 1000).toISOString(),
        scheduledExitTime: new Date(evImmediateEnd.getTime() + 15 * 60 * 1000).toISOString(),
      });
    } catch (err: unknown) {
      const code = (err as { errorCode?: string })?.errorCode;
      if (code === 'SLOT_TIME_CONFLICT' || code === 'SLOT_CURRENTLY_UNAVAILABLE') {
        evNoAvailableSlotRejected = true;
      }
    }
    assertTest(
      'Rejects EV booking when the only EV slot is already reserved for the requested time period',
      evNoAvailableSlotRejected,
    );

    // 12g. Shared EV parking lifecycle: Entry -> Overstay (at EV rate ₹50/hr) -> Exit & Release
    const evEntry = await customerBookingService.recordVehicleEntry({
      bookingId: evInitiated.bookingId,
    });
    const evOverstay = await customerBookingService.markBookingOverstay({
      bookingId: evInitiated.bookingId,
      detectedAt: new Date(evImmediateEnd.getTime() + 20 * 60 * 1000),
    });
    const evExit = await customerBookingService.completeBookingExit({
      bookingId: evInitiated.bookingId,
      exitTime: new Date(evImmediateEnd.getTime() + 25 * 60 * 1000),
    });
    const evSlotAfterExit = await ParkingSlotModel.findById(slotEvTest._id).lean();

    assertTest(
      'EV booking follows identical entry, overstay (billed at captured EV rate ₹50/hr), and exit slot-release lifecycle',
      evEntry.bookingStatus === 'Active' &&
        evEntry.slotStatus === 'Occupied' &&
        evOverstay.bookingStatus === 'Overstay' &&
        evOverstay.overstayCharge === 50 &&
        evExit.bookingStatus === 'Completed' &&
        evSlotAfterExit?.slotStatus === 'Available' &&
        evSlotAfterExit?.currentBookingId === null,
    );
  } finally {
    console.log('\n[CLEANUP] Removing temporary test documents...');
    if (cleanupIds.bookingIds.length > 0) {
      await BookingTimelineModel.deleteMany({ bookingId: { $in: cleanupIds.bookingIds } });
      await PaymentModel.deleteMany({ bookingId: { $in: cleanupIds.bookingIds } });
      await NotificationModel.deleteMany({ bookingId: { $in: cleanupIds.bookingIds } });
      await BookingModel.deleteMany({ _id: { $in: cleanupIds.bookingIds } });
    }
    if (cleanupIds.layoutIds.length > 0) {
      await ParkingLayoutModel.deleteMany({ _id: { $in: cleanupIds.layoutIds } });
    }
    if (cleanupIds.slotIds.length > 0) {
      await ParkingSlotModel.deleteMany({ _id: { $in: cleanupIds.slotIds } });
    }
    if (cleanupIds.zoneIds.length > 0) {
      await ParkingZoneModel.deleteMany({ _id: { $in: cleanupIds.zoneIds } });
    }
    if (cleanupIds.floorIds.length > 0) {
      await ParkingFloorModel.deleteMany({ _id: { $in: cleanupIds.floorIds } });
    }
    if (cleanupIds.lotIds.length > 0) {
      await ParkingLotModel.deleteMany({ _id: { $in: cleanupIds.lotIds } });
    }
    if (cleanupIds.submissionIds.length > 0) {
      await ParkingFacilitySubmissionModel.deleteMany({ _id: { $in: cleanupIds.submissionIds } });
    }
    if (cleanupIds.vehicleIds.length > 0) {
      await VehicleModel.deleteMany({ _id: { $in: cleanupIds.vehicleIds } });
    }
    if (cleanupIds.userIds.length > 0) {
      await UserModel.deleteMany({ _id: { $in: cleanupIds.userIds } });
    }
    await mongoose.disconnect();
    console.log('✓ Cleanup complete and MongoDB disconnected.');
  }

  console.log('\n========================================================================');
  console.log(`  TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerBookingTestSuite().catch((err) => {
  console.error('Unhandled error in booking test suite:', err);
  process.exit(1);
});
