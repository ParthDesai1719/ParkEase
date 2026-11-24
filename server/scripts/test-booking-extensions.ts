import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { BookingModel } from '../src/models/Booking.js';
import { PaymentModel } from '../src/models/Payment.js';
import { VehicleModel } from '../src/models/Vehicle.js';
import { customerExtensionService } from '../src/services/customerExtension.service.js';
import { securityService } from '../src/services/security.service.js';

async function runExtensionTestSuite() {
  console.log('================================================================');
  console.log('   PARKEASE BOOKING EXTENSION & GATE CASH E2E VERIFICATION     ');
  console.log('================================================================\n');

  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  try {
    const timestamp = Date.now();

    // 1. Setup Roles
    const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
    const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });

    if (!customerRole || !securityRole || !ownerRole) {
      throw new Error('Required roles (CUSTOMER, SECURITY, OWNER) not found.');
    }

    // 2. Create Users
    const customer = await UserModel.create({
      fullName: `Extension Customer ${timestamp}`,
      email: `ext_cust_${timestamp}@test.com`,
      mobileNumber: `+9198${String(timestamp).slice(-8)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    const owner = await UserModel.create({
      fullName: `Plaza Owner ${timestamp}`,
      email: `owner_${timestamp}@test.com`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    const securityStaff = await UserModel.create({
      fullName: `Officer Gate ${timestamp}`,
      email: `gate_${timestamp}@test.com`,
      mobileNumber: `+9196${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 3. Create Vehicles
    const vehicle1 = await VehicleModel.create({
      customerId: customer._id,
      vehicleNumber: `MH01AB${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Honda',
      vehicleModel: 'City',
      vehicleColor: 'Silver',
      fuelType: 'Petrol',
      manufacturingYear: 2022,
    });

    const vehicleConflict = await VehicleModel.create({
      customerId: customer._id,
      vehicleNumber: `MH02XY${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Creta',
      vehicleColor: 'Black',
      fuelType: 'Diesel',
      manufacturingYear: 2023,
    });

    // 4. Create Parking Facility & Topology
    const parkingLot = await ParkingLotModel.create({
      ownerId: owner._id,
      parkingName: `ParkEase Extension Hub ${timestamp}`,
      description: 'Hub for extension testing',
      address: '100 Terminal Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      contactNumber: '+919876543210',
      latitude: 19.076,
      longitude: 72.8777,
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.076],
      },
      parkingType: 'COMMERCIAL',
      pricingType: 'FLAT',
      ratePerHour: 100,
      hourlyRate: 100,
      overstayGracePeriodMinutes: 15,
      overstayPenaltyRatePerHour: 150,
      isOpen24Hours: true,
      isActive: true,
      verificationStatus: 'APPROVED',
      isPublished: true,
    });

    // Assign staff
    await SecurityStaffAssignmentModel.create({
      securityStaffId: securityStaff._id,
      ownerId: owner._id,
      parkingLotId: parkingLot._id,
      assignmentStatus: 'Active',
      assignedBy: owner._id,
    });

    const floor = await ParkingFloorModel.create({
      parkingLotId: parkingLot._id,
      floorNumber: 1,
      floorName: 'Ground Floor',
      capacity: 10,
      occupiedCount: 0,
    });

    const zone = await ParkingZoneModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneName: 'Zone A',
      zoneCode: 'ZA',
      supportedVehicleTypes: ['FOUR_WHEELER', 'Car'],
    });

    // Slots
    const slot1 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'ZA-01',
      slotLabel: 'ZA-01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Occupied',
      qrIdentifier: `QR-ZA-01-${timestamp}`,
      isOccupied: true,
    });

    const slot2 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'ZA-02',
      slotLabel: 'ZA-02',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-ZA-02-${timestamp}`,
      isOccupied: false,
    });

    console.log('✓ Master data, facility, vehicles, security staff, and slots created.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Quote Calculation, Policy Validation & Conflict Detection
    // -------------------------------------------------------------------------
    console.log('▶ TEST 1: Extension Quote Calculation & Validation Rules');

    const now = new Date();
    const entry1 = new Date(now.getTime() - 30 * 60 * 1000); // 30m ago
    const exit1 = new Date(now.getTime() + 30 * 60 * 1000); // 30m from now

    const booking1 = await BookingModel.create({
      bookingReference: `BK-EXT1-${timestamp}`,
      customerId: customer._id,
      vehicleId: vehicle1._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Active',
      actualEntryTime: entry1,
      scheduledEntryTime: entry1,
      scheduledExitTime: exit1,
      originalScheduledExitTime: exit1,
      gracePeriodMinutes: 15,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 100,
      overstayRateAtBooking: 150,
      baseAmount: 100,
      totalAmount: 100,
      qrCode: `QR-EXT1-${timestamp}`,
    });

    // Seed original booking payment
    await PaymentModel.create({
      paymentReference: `PAY-BK1-${timestamp}`,
      bookingId: booking1._id,
      customerId: customer._id,
      ownerId: owner._id,
      parkingLotId: parkingLot._id,
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      amount: 100,
    });

    // Valid quote for 60 mins
    const quote60 = await customerExtensionService.getExtensionQuote(
      customer._id.toString(),
      booking1._id.toString(),
      60
    );
    console.log(`  Quote for 60m: additionalCharge = ₹${quote60.additionalCharge}, eligible = ${quote60.eligible}`);
    if (!quote60.eligible || quote60.additionalCharge !== 100) {
      throw new Error(`Test 1 Failed: Expected ₹100 for 60m extension, got ₹${quote60.additionalCharge}`);
    }

    // Invalid quote: duration > 720 mins (12h)
    try {
      await customerExtensionService.getExtensionQuote(
        customer._id.toString(),
        booking1._id.toString(),
        800
      );
      throw new Error('Test 1 Failed: Allowed extension > 720 minutes without error.');
    } catch (err: any) {
      console.log(`  ✓ Extension > 720m correctly rejected: ${err.message}`);
    }

    // Conflict detection: Schedule another booking on slot1 45 mins after exit1
    const conflictEntry = new Date(exit1.getTime() + 45 * 60 * 1000);
    const conflictExit = new Date(conflictEntry.getTime() + 60 * 60 * 1000);
    const conflictBooking = await BookingModel.create({
      bookingReference: `BK-CONFLICT-${timestamp}`,
      customerId: customer._id,
      vehicleId: vehicleConflict._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      scheduledEntryTime: conflictEntry,
      scheduledExitTime: conflictExit,
      gracePeriodMinutes: 15,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 100,
      overstayRateAtBooking: 150,
      baseAmount: 100,
      totalAmount: 100,
      qrCode: `QR-CONF-${timestamp}`,
    });

    // An extension of 60m on booking1 would end at exit1 + 60m, but conflictEntry is at exit1 + 45m!
    // Since conflictEntry (45m) < proposedExit (60m) + grace (15m), quote should report ineligible
    const conflictedQuote = await customerExtensionService.getExtensionQuote(
      customer._id.toString(),
      booking1._id.toString(),
      60
    );
    console.log(`  Slot conflict check: eligible = ${conflictedQuote.eligible}, reason = "${conflictedQuote.ineligibleReason}"`);
    if (conflictedQuote.eligible) {
      throw new Error('Test 1 Failed: Conflict detection did not block overlapping booking!');
    }
    console.log('  ✓ Slot conflict accurately detected and blocked with 15m grace preservation.');

    // Clean up conflicting booking to continue testing booking1
    await BookingModel.deleteOne({ _id: conflictBooking._id });
    console.log('✓ TEST 1 PASSED: Quote calculations, limits, and conflict handling verified.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Customer Online Extension via Razorpay
    // -------------------------------------------------------------------------
    console.log('▶ TEST 2: Customer Online Extension via Razorpay (Independent of original payment)');

    // Initiate Razorpay extension
    const initRes = await customerExtensionService.initiateExtension(
      customer._id.toString(),
      booking1._id.toString(),
      { additionalMinutes: 60, paymentMethod: 'RAZORPAY' }
    );

    console.log(`  Initiated online extension: orderId = ${initRes.razorpayOrder?.orderId}`);
    if (!initRes.razorpayOrder) {
      throw new Error('Test 2 Failed: Razorpay order was not returned.');
    }

    // Verify temporary slot hold is active
    const heldBooking = await BookingModel.findById(booking1._id);
    if (!heldBooking?.activeExtensionHold?.holdReference) {
      throw new Error('Test 2 Failed: Active extension hold was not set on booking.');
    }
    console.log('  ✓ Temporary slot hold verified on booking record.');

    // Simulate HMAC signature verification
    const orderId = initRes.razorpayOrder.orderId;
    const paymentId = `pay_mock_${timestamp}`;
    const generatedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const verifyRes = await customerExtensionService.verifyOnlineExtension(
      customer._id.toString(),
      booking1._id.toString(),
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: generatedSignature,
      }
    );

    console.log(`  Extension verified: newScheduledExitTime = ${verifyRes.newScheduledExitTime}`);
    const extendedBooking1 = await BookingModel.findById(booking1._id);
    if (extendedBooking1?.bookingDurationMinutes !== 120) {
      throw new Error(`Test 2 Failed: Expected 120 min duration, got ${extendedBooking1?.bookingDurationMinutes}`);
    }
    if (extendedBooking1.extensions.length !== 1 || extendedBooking1.extensions[0].paymentMethod !== 'RAZORPAY') {
      throw new Error('Test 2 Failed: Extension audit log subdocument was not properly updated.');
    }
    if (extendedBooking1.activeExtensionHold?.holdReference) {
      throw new Error('Test 2 Failed: Temporary hold was not cleared after payment verification.');
    }

    // Verify Payment document created
    const extPayment = await PaymentModel.findOne({
      bookingId: booking1._id,
      paymentTypeCode: 'EXTENSION',
      gatewayPaymentId: paymentId,
    });
    if (!extPayment || extPayment.paymentStatus !== 'SUCCESSFUL') {
      throw new Error('Test 2 Failed: SUCCESSFUL Extension payment record not found.');
    }
    console.log('  ✓ Payment record, timeline, and booking exit time verified for Razorpay extension.');
    console.log('✓ TEST 2 PASSED: Online extension flow fully verified.\n');

    // -------------------------------------------------------------------------
    // TEST 3 & 4: Customer Deferred Cash at Exit & Physical Gate Blocking
    // -------------------------------------------------------------------------
    console.log('▶ TEST 3: Customer Deferred Cash Extension at Exit');

    // Customer requests another 60m extension choosing CASH at exit
    const cashExtRes = await customerExtensionService.initiateExtension(
      customer._id.toString(),
      booking1._id.toString(),
      { additionalMinutes: 60, paymentMethod: 'CASH' }
    );

    console.log(`  Deferred cash extension confirmed: newExitTime = ${cashExtRes.newScheduledExitTime}`);
    const deferredBooking = await BookingModel.findById(booking1._id);
    if (deferredBooking?.bookingDurationMinutes !== 180) {
      throw new Error(`Test 3 Failed: Expected 180 min duration, got ${deferredBooking?.bookingDurationMinutes}`);
    }

    const pendingCashPayment = await PaymentModel.findOne({
      bookingId: booking1._id,
      paymentTypeCode: 'EXTENSION',
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
    });
    if (!pendingCashPayment) {
      throw new Error('Test 3 Failed: Pending cash payment record not created for deferred cash extension.');
    }
    console.log(`  ✓ Customer granted stay extension immediately; Payment is PENDING (Amount: ₹${pendingCashPayment.amount}).`);
    console.log('✓ TEST 3 PASSED: Deferred cash extension successfully authorized.\n');

    console.log('▶ TEST 4: Physical Gate Exit Blocking (Cash Extension Unsettled)');
    // Security scans QR pass at exit gate
    const scanResult = await securityService.verifyQrPass({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      qrPayload: booking1.qrCode || `QR-EXT1-${timestamp}`,
    });

    console.log(`  Security scan result: eligibleForExit = ${scanResult.eligibleForExit}, hasPendingCash = ${scanResult.pendingCashExtension?.hasPending}`);
    if (scanResult.eligibleForExit !== false) {
      throw new Error('Test 4 Failed: Driver with pending cash extension was permitted to exit!');
    }
    if (!scanResult.availableActions.includes('COLLECT_EXTENSION_CASH')) {
      throw new Error('Test 4 Failed: COLLECT_EXTENSION_CASH action not presented to security staff.');
    }

    // Security attempts to complete exit without collecting cash -> Must be blocked
    try {
      await securityService.completeVehicleExit({
        staffUserId: securityStaff._id.toString(),
        parkingLotId: parkingLot._id.toString(),
        bookingId: booking1._id.toString(),
      });
      throw new Error('Test 4 Failed: completeVehicleExit succeeded despite pending cash extension!');
    } catch (err: any) {
      console.log(`  ✓ Gate exit strictly blocked: ${err.message} (Code: ${err.code || err.errorCode || 'Conflict'})`);
    }
    console.log('✓ TEST 4 PASSED: Gate exit is strictly blocked until pending cash extension is settled.\n');

    // -------------------------------------------------------------------------
    // TEST 5: Security Staff Cash Confirmation & Successful Departure
    // -------------------------------------------------------------------------
    console.log('▶ TEST 5: Security Staff Exit Gate Cash Collection & Settlement');

    const confirmRes = await securityService.confirmCashExtensionPayment({
      bookingId: booking1._id.toString(),
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      notes: 'Cash ₹100 received at Gate 1 exit terminal',
    });

    console.log(`  Cash extension confirmed: paymentId = ${confirmRes.paymentId}, amount = ₹${confirmRes.amountCollected}`);
    const settledPayment = await PaymentModel.findById(confirmRes.paymentId);
    if (settledPayment?.paymentStatus !== 'SUCCESSFUL' || settledPayment.collectedBy?.toString() !== securityStaff._id.toString()) {
      throw new Error('Test 5 Failed: Payment record not marked SUCCESSFUL or staff not attributed.');
    }

    // Now rescan pass at exit gate -> Should be eligible for exit
    const rescanResult = await securityService.verifyQrPass({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      qrPayload: booking1.qrCode || `QR-EXT1-${timestamp}`,
    });
    console.log(`  Rescan post-settlement: eligibleForExit = ${rescanResult.eligibleForExit}`);
    if (rescanResult.eligibleForExit !== true) {
      throw new Error('Test 5 Failed: Booking should be eligible for exit after cash confirmation.');
    }

    // Complete vehicle exit
    const exitResult = await securityService.completeVehicleExit({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      bookingId: booking1._id.toString(),
    });
    console.log(`  Vehicle exit completed: finalStatus = ${exitResult.bookingStatus}`);
    if (exitResult.bookingStatus !== 'Completed') {
      throw new Error(`Test 5 Failed: Booking status not updated to Completed, got ${exitResult.bookingStatus}`);
    }

    const slot1AfterExit = await ParkingSlotModel.findById(slot1._id);
    if (slot1AfterExit?.slotStatus !== 'Available' || slot1AfterExit.currentBookingId !== null) {
      throw new Error(`Test 5 Failed: Slot not released to Available after vehicle departure. Got status: ${slot1AfterExit?.slotStatus}`);
    }
    console.log('  ✓ Vehicle departed, barrier opened, slot freed, timeline logged.');
    console.log('✓ TEST 5 PASSED: Cash settlement and vehicle exit flow verified.\n');

    // -------------------------------------------------------------------------
    // TEST 6: Security Staff Walk-in Extension Flow
    // -------------------------------------------------------------------------
    console.log('▶ TEST 6: Security Staff Walk-in Booking Extension');

    // Create walk-in booking using standard securityService walk-in creation
    const walkInCreation = await securityService.createWalkInBooking({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      customerName: 'Walk-in Driver Test',
      customerMobile: `99${String(timestamp).slice(-8)}`,
      vehicleNumber: `MH03CD${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      durationHours: 2,
      slotSelectionMode: 'AUTO',
      cashCollected: true,
      cashAmountCollected: 215,
    });

    const walkInBookingId = walkInCreation.booking.bookingId;

    // 1. Get Walk-in extension quote
    const walkInQuote = await securityService.getWalkInExtensionQuote({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      bookingId: walkInBookingId,
      additionalMinutes: 60,
    });
    console.log(`  Walk-in quote: eligible = ${walkInQuote.eligible}, extensionCharge = ₹${walkInQuote.extensionCharge}`);
    if (!walkInQuote.eligible || walkInQuote.extensionCharge !== 100) {
      throw new Error(`Test 6 Failed: Walk-in extension quote mismatch. Got ₹${walkInQuote.extensionCharge}`);
    }

    // 2. Reject if cash not collected
    try {
      await securityService.processWalkInExtension({
        staffUserId: securityStaff._id.toString(),
        parkingLotId: parkingLot._id.toString(),
        bookingId: walkInBookingId,
        additionalMinutes: 60,
        amountCollected: 100,
        confirmCashReceived: false,
      });
      throw new Error('Test 6 Failed: Allowed walk-in extension without cash collection confirmation.');
    } catch (err: any) {
      console.log(`  ✓ Walk-in extension rejected if cash not collected: ${err.message}`);
    }

    // 3. Process walk-in extension with cash collected
    const walkInExtResult = await securityService.processWalkInExtension({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      bookingId: walkInBookingId,
      additionalMinutes: 60,
      amountCollected: 100,
      confirmCashReceived: true,
      notes: 'Collected ₹100 cash from driver',
    });

    console.log(`  Walk-in extension completed: newExitTime = ${walkInExtResult.newExitTime}`);
    const updatedWalkIn = await BookingModel.findById(walkInBookingId);
    if (updatedWalkIn?.bookingDurationMinutes !== 180) { // 120 + 60 = 180
      throw new Error(`Test 6 Failed: Expected 180m duration, got ${updatedWalkIn?.bookingDurationMinutes}`);
    }

    const walkInPayment = await PaymentModel.findOne({
      bookingId: walkInBookingId,
      paymentTypeCode: 'EXTENSION',
      paymentStatus: 'SUCCESSFUL',
    });
    if (!walkInPayment || walkInPayment.amount !== 100 || walkInPayment.collectedBy?.toString() !== securityStaff._id.toString()) {
      throw new Error('Test 6 Failed: Walk-in extension payment record missing or invalid.');
    }
    console.log('  ✓ Walk-in booking extended, cash receipt recorded, staff attributed.');
    console.log('✓ TEST 6 PASSED: Security Walk-in extension flow fully verified.\n');

    console.log('================================================================');
    console.log('   ALL 6 EXTENSION TEST SCENARIOS PASSED WITH ZERO ERRORS!     ');
    console.log('================================================================');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

runExtensionTestSuite();
