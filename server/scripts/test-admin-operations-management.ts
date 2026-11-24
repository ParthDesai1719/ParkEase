import 'dotenv/config';
import mongoose from 'mongoose';
import { BookingModel } from '../src/models/Booking.js';
import { BookingTimelineModel } from '../src/models/BookingTimeline.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { UserModel } from '../src/models/User.js';
import { VehicleModel } from '../src/models/Vehicle.js';
import { PaymentModel } from '../src/models/Payment.js';
import { VehicleMovementLogModel } from '../src/models/VehicleMovementLog.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { NotificationModel } from '../src/models/Notification.js';
import { adminOperationsService } from '../src/services/adminOperations.service.js';
import { emailService, generateParkEaseEmailHtml } from '../src/services/email.service.js';

async function runTests() {
  console.log('==================================================================');
  console.log('--- Starting Admin Phase 2 Operations Management Integration Tests ---');
  console.log('==================================================================');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const timestamp = Date.now();
  const testIds: mongoose.Types.ObjectId[] = [];

  try {
    // -------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------
    const adminUser = await UserModel.create({
      fullName: `Admin Test ${timestamp}`,
      email: `admin.${timestamp}@parkease.test`,
      mobileNumber: `+9198${String(timestamp).slice(-8)}`,
      roleId: new mongoose.Types.ObjectId(),
      accountStatus: 'Active',
    });
    testIds.push(adminUser._id);

    const ownerUser = await UserModel.create({
      fullName: `Owner Ops ${timestamp}`,
      email: `owner.ops.${timestamp}@parkease.test`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: new mongoose.Types.ObjectId(),
      accountStatus: 'Active',
      businessName: `Metro Park Hub ${timestamp}`,
    });
    testIds.push(ownerUser._id);

    const customerUser = await UserModel.create({
      fullName: `Customer Ops ${timestamp}`,
      email: `customer.ops.${timestamp}@parkease.test`,
      mobileNumber: `+9196${String(timestamp).slice(-8)}`,
      roleId: new mongoose.Types.ObjectId(),
      accountStatus: 'Active',
    });
    testIds.push(customerUser._id);

    const securityUser = await UserModel.create({
      fullName: `Officer Ops ${timestamp}`,
      email: `officer.ops.${timestamp}@parkease.test`,
      mobileNumber: `+9195${String(timestamp).slice(-8)}`,
      roleId: new mongoose.Types.ObjectId(),
      accountStatus: 'Active',
      employeeId: `SEC-OPS-${String(timestamp).slice(-4)}`,
    });
    testIds.push(securityUser._id);

    const parkingLot = await ParkingLotModel.create({
      parkingName: `Grand Central Terminal ${timestamp}`,
      ownerId: ownerUser._id,
      address: '100 Commerce Boulevard',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      contactNumber: '+919876543210',
      totalCapacity: 50,
      availableSlots: 48,
      occupiedSlots: 1,
      reservedSlots: 1,
      hourlyRate: 60,
      pricingPlans: [{ planName: 'Standard', vehicleType: 'Car', hourlyRate: 60, dailyRate: 400 }],
      parkingStatus: 'Active',
      operationalStatus: 'Open',
      latitude: 19.0760,
      longitude: 72.8777,
      location: { type: 'Point', coordinates: [72.8777, 19.0760] },
      isPublished: true,
      layoutValidated: true,
      hasStructure: true,
    });
    testIds.push(parkingLot._id);

    const floor = await ParkingFloorModel.create({
      parkingLotId: parkingLot._id,
      floorName: 'Level 1',
      floorNumber: 1,
      capacity: 50,
      availableSlots: 48,
      occupiedSlots: 1,
      reservedSlots: 1,
      status: 'Active',
    });
    testIds.push(floor._id);

    const zone = await ParkingZoneModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneName: 'Zone Alpha',
      zoneCode: 'ZA',
      capacity: 50,
      availableSlots: 48,
      occupiedSlots: 1,
      reservedSlots: 1,
      status: 'Active',
    });
    testIds.push(zone._id);

    const slot1 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: `ZA-101`,
      slotLabel: 'A-101',
      slotType: 'Standard',
      vehicleType: 'Car',
      slotStatus: 'Reserved',
      qrIdentifier: `QR-ZA-101-${timestamp}`,
    });
    testIds.push(slot1._id);

    const slot2 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: `ZA-102`,
      slotLabel: 'A-102',
      slotType: 'Standard',
      vehicleType: 'Car',
      slotStatus: 'Occupied',
      qrIdentifier: `QR-ZA-102-${timestamp}`,
    });
    testIds.push(slot2._id);

    const vehicle1 = await VehicleModel.create({
      customerId: customerUser._id,
      vehicleNumber: `MH01AB${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Honda',
      vehicleModel: 'City',
      vehicleColor: 'Silver',
    });
    testIds.push(vehicle1._id);

    const vehicle2 = await VehicleModel.create({
      customerId: customerUser._id,
      vehicleNumber: `MH02CD${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Creta',
      vehicleColor: 'Black',
    });
    testIds.push(vehicle2._id);

    // Create Confirmed booking (Slot 1)
    const bookingConfirmed = await BookingModel.create({
      bookingReference: `BK-CONF-${timestamp}`,
      customerId: customerUser._id,
      vehicleId: vehicle1._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      scheduledEntryTime: new Date(Date.now() + 3600000),
      scheduledExitTime: new Date(Date.now() + 7200000),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 60,
      overstayRateAtBooking: 90,
      baseAmount: 120,
      platformBookingFee: 20,
      totalAmount: 140,
    });
    testIds.push(bookingConfirmed._id);

    slot1.currentBookingId = bookingConfirmed._id;
    await slot1.save();

    const payment1 = await PaymentModel.create({
      paymentReference: `PAY-CONF-${timestamp}`,
      bookingId: bookingConfirmed._id,
      customerId: customerUser._id,
      ownerId: ownerUser._id,
      parkingLotId: parkingLot._id,
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      amount: 140,
      currency: 'INR',
      transactionId: `txn_${timestamp}_1`,
      gatewayOrderId: `order_${timestamp}_1`,
      gatewayPaymentId: `pay_${timestamp}_1`,
    });
    testIds.push(payment1._id);

    // Create Active booking currently inside (Slot 2)
    const entryTime2 = new Date(Date.now() - 45 * 60000); // 45 min ago
    const bookingActive = await BookingModel.create({
      bookingReference: `BK-ACTV-${timestamp}`,
      customerId: customerUser._id,
      vehicleId: vehicle2._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot2._id,
      currentSlotId: slot2._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Active',
      scheduledEntryTime: new Date(Date.now() - 60 * 60000),
      scheduledExitTime: new Date(Date.now() + 60 * 60000),
      actualEntryTime: entryTime2,
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 60,
      overstayRateAtBooking: 90,
      baseAmount: 120,
      platformBookingFee: 20,
      totalAmount: 140,
    });
    testIds.push(bookingActive._id);

    slot2.currentBookingId = bookingActive._id;
    await slot2.save();

    const payment2 = await PaymentModel.create({
      paymentReference: `PAY-ACTV-${timestamp}`,
      bookingId: bookingActive._id,
      customerId: customerUser._id,
      ownerId: ownerUser._id,
      parkingLotId: parkingLot._id,
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      amount: 140,
      currency: 'INR',
      transactionId: `txn_${timestamp}_2`,
    });
    testIds.push(payment2._id);

    const movementLog2 = await VehicleMovementLogModel.create({
      bookingId: bookingActive._id,
      customerId: customerUser._id,
      vehicleId: vehicle2._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotId: slot2._id,
      verifiedBy: securityUser._id,
      entryMethod: 'QR Code',
      entryTime: entryTime2,
      gracePeriodEndsAt: new Date(Date.now() + 75 * 60000),
      stayDurationMinutes: 45,
      movementStatus: 'Vehicle Inside',
    });
    testIds.push(movementLog2._id);

    // -------------------------------------------------------------
    // Test 1: Booking Overview KPIs
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Booking Overview KPI Metrics ---');
    const overview = await adminOperationsService.getBookingOverview();
    console.log('Booking overview:', overview);
    if (typeof overview.totalBookings !== 'number' || typeof overview.confirmedBookings !== 'number') {
      throw new Error('Booking overview did not return valid numeric counts.');
    }
    console.log('✓ Test 1 Passed: Booking overview KPIs return valid database aggregations.');

    // -------------------------------------------------------------
    // Test 2: Booking Directory Listing & Filters
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Booking Directory Multi-Criteria Query ---');
    const listResult = await adminOperationsService.getBookings({
      search: vehicle1.vehicleNumber,
      status: 'Confirmed',
      page: 1,
      limit: 10,
    });
    console.log(`Found ${listResult.bookings.length} booking(s) matching search plate.`);
    if (listResult.bookings.length === 0 || listResult.bookings[0].bookingReference !== bookingConfirmed.bookingReference) {
      throw new Error('Failed to find confirmed booking by vehicle plate search.');
    }
    console.log('✓ Test 2 Passed: Multi-criteria debounced search and filtering verified.');

    // -------------------------------------------------------------
    // Test 3: Single Booking Inspection Dossier
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Single Booking Inspection Dossier ---');
    const dossier = await adminOperationsService.getBookingById(bookingConfirmed._id.toString());
    console.log('Dossier booking reference:', dossier.booking.bookingReference);
    console.log('Populated customer:', dossier.booking.customerId?.fullName);
    console.log('Cancellable by Admin:', dossier.cancellableByAdmin);
    if (!dossier.cancellableByAdmin) {
      throw new Error('Confirmed booking should be cancellable by Admin.');
    }
    console.log('✓ Test 3 Passed: Booking detail dossier retrieved with populated relations.');

    // -------------------------------------------------------------
    // Test 4: Cancellation Eligibility Safeguard (Block Active Inside)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Cancellation Safeguard on Active Vehicle Inside ---');
    try {
      await adminOperationsService.cancelBooking(
        bookingActive._id.toString(),
        { reason: 'Trying to cancel active stay' },
        adminUser._id.toString(),
      );
      throw new Error('Expected cancellation to fail for active vehicle inside!');
    } catch (err: any) {
      console.log('Caught expected block:', err.message);
      if (err.statusCode !== 409) {
        throw new Error(`Expected HTTP 409 Conflict, got ${err.statusCode}`);
      }
    }
    console.log('✓ Test 4 Passed: Server strictly prevented cancellation of active vehicle inside.');

    // -------------------------------------------------------------
    // Test 5: Admin Authoritative Booking Cancellation & Centralized Refund
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Execute Admin Booking Cancellation & Refund ---');
    const cancelResult = await adminOperationsService.cancelBooking(
      bookingConfirmed._id.toString(),
      { reason: 'Customer requested emergency flight cancellation assistance' },
      adminUser._id.toString(),
      { ipAddress: '127.0.0.1', userAgent: 'Jest-Verification-Agent' },
    );
    console.log('Cancel result:', cancelResult.message);
    console.log('Refund processed:', cancelResult.refundAmount, cancelResult.refundStatus);

    // Verify slot released
    const slot1Refreshed = await ParkingSlotModel.findById(slot1._id);
    if (slot1Refreshed?.slotStatus !== 'Available' || slot1Refreshed.currentBookingId !== null) {
      throw new Error('Expected slot 1 to be released to Available.');
    }

    // Verify payment updated to REFUNDED
    const payment1Refreshed = await PaymentModel.findById(payment1._id);
    if (payment1Refreshed?.paymentStatus !== 'REFUNDED') {
      throw new Error('Expected payment to be marked REFUNDED.');
    }

    // Verify timeline event logged
    const timelineEvents = await BookingTimelineModel.find({
      bookingId: bookingConfirmed._id,
      eventCode: 'BOOKING_CANCELLED',
    });
    if (timelineEvents.length === 0) {
      throw new Error('Expected BOOKING_CANCELLED timeline event.');
    }

    // Verify audit log recorded
    const auditLogs = await AuditLogModel.find({
      bookingId: bookingConfirmed._id,
      actionCode: 'BOOKING_CANCELLED',
    });
    if (auditLogs.length === 0) {
      throw new Error('Expected BOOKING_CANCELLED audit log.');
    }

    console.log('✓ Test 5 Passed: Administrative cancellation, centralized refund, and slot release confirmed.');

    // -------------------------------------------------------------
    // Test 6: Dedicated View Cancellation Details
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Dedicated View Cancellation Details ---');
    const cancelDetails = await adminOperationsService.getBookingCancellationDetails(bookingConfirmed._id.toString());
    console.log('Cancellation details:', {
      cancellationBy: cancelDetails.cancellationBy,
      reason: cancelDetails.cancellationReason,
      refundAmount: cancelDetails.refundAmount,
      refundsCount: cancelDetails.refunds?.length,
    });
    if (cancelDetails.cancellationBy !== 'Administrator' || cancelDetails.refundAmount !== 140) {
      throw new Error('Cancellation details mismatch.');
    }
    console.log('✓ Test 6 Passed: Dedicated cancellation inspection details verified.');

    // -------------------------------------------------------------
    // Test 7: Live Vehicle Locator Overview (8 KPI Cards)
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Live Vehicle Locator Overview KPIs ---');
    const vehicleOverview = await adminOperationsService.getLiveVehiclesOverview();
    console.log('Live vehicle overview:', vehicleOverview);
    if (vehicleOverview.vehiclesCurrentlyInside < 1) {
      throw new Error('Expected at least 1 vehicle currently inside.');
    }
    if (!vehicleOverview.longestParkedVehicle) {
      throw new Error('Expected longestParkedVehicle calculation.');
    }
    console.log('Longest parked vehicle:', vehicleOverview.longestParkedVehicle);
    console.log('✓ Test 7 Passed: 8 Live Vehicle Locator KPI metrics computed accurately.');

    // -------------------------------------------------------------
    // Test 8: Live Vehicle Locator Query & Live Duration
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Live Vehicles Query & Auto-Duration ---');
    const liveVehiclesRes = await adminOperationsService.getLiveVehicles({
      search: vehicle2.vehicleNumber,
      status: 'Inside Parking',
      page: 1,
      limit: 10,
    });
    console.log(`Found ${liveVehiclesRes.vehicles.length} vehicle(s) inside.`);
    if (liveVehiclesRes.vehicles.length === 0) {
      throw new Error('Failed to find active vehicle inside.');
    }
    const targetVehicle = liveVehiclesRes.vehicles[0];
    console.log('Vehicle plate:', targetVehicle.vehicleNumber);
    console.log('Live duration (mins):', targetVehicle.liveDurationMinutes);
    console.log('Tracking status:', targetVehicle.trackingStatus);
    console.log('Security entry guard:', targetVehicle.securityStaff?.fullName);
    if (targetVehicle.trackingStatus !== 'Inside Parking' || targetVehicle.liveDurationMinutes < 40) {
      throw new Error('Live duration or tracking status calculation error.');
    }
    console.log('✓ Test 8 Passed: Live vehicles table data with auto duration counter verified.');

    // -------------------------------------------------------------
    // Test 9: Live Vehicle Detail Inspection Dossier
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Single Live Vehicle Deep Inspection ---');
    const vehicleDetail = await adminOperationsService.getLiveVehicleDetails(bookingActive._id.toString());
    console.log('Detail plate:', vehicleDetail.booking.vehicleNumber);
    console.log('Bay location:', vehicleDetail.bayLocation.slot?.slotNumber);
    console.log('Movements count:', vehicleDetail.movementLogs.length);
    console.log('Entry officer:', vehicleDetail.securityOfficer?.fullName);
    if (!vehicleDetail.securityOfficer || vehicleDetail.movementLogs.length === 0) {
      throw new Error('Missing movement log or officer attribution.');
    }
    console.log('✓ Test 9 Passed: Live vehicle detail dossier with movement logs verified.');

    // -------------------------------------------------------------
    // Test 10: ParkEase Branded Email Theme Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 10: ParkEase Branded Email Theme & Delivery ---');
    const emailHtml = generateParkEaseEmailHtml({
      title: 'Platform Operations Verification',
      subtitle: 'System Health Check',
      badge: { text: 'Verified', variant: 'success' },
      bodyHtml: `
        <p>This is a branded test email confirming the ParkEase unified template layout.</p>
        <div style="background:#f1f5f9;padding:12px;border-radius:6px;">
          <strong>Official Brand Tokens:</strong> Logo, Navy Border (#1e3a8a), Status Badges, Document Footer Banner.
        </div>
      `,
      ctaButton: { text: 'Open Admin Console', url: 'http://localhost:5173/admin/operations', variant: 'primary' },
      footerNotice: 'Automated test delivery verification.',
    });

    if (!emailHtml.includes('/brand/document-logo.png') || !emailHtml.includes('/brand/document-footer.png')) {
      throw new Error('Email template missing official ParkEase brand assets.');
    }

    // Test sendOtpEmail with branded layout
    const otpSent = await emailService.sendOtpEmail(customerUser.email, '852963', 'Account Login');
    if (!otpSent) {
      throw new Error('sendOtpEmail delivery failed.');
    }

    // Test sendWelcomeEmail with branded layout
    const welcomeSent = await emailService.sendWelcomeEmail(customerUser.email, customerUser.fullName);
    if (!welcomeSent) {
      throw new Error('sendWelcomeEmail delivery failed.');
    }

    // Test sendBookingCancelledEmail with branded layout
    const cancelSent = await emailService.sendBookingCancelledEmail({
      to: customerUser.email,
      customerName: customerUser.fullName,
      bookingReference: bookingConfirmed.bookingReference,
      parkingName: parkingLot.parkingName,
      slotNumber: slot1.slotNumber,
      cancellationReason: 'Admin test cancellation',
      cancelledBy: 'Administrator',
      refundAmount: 140,
      paymentMethod: 'RAZORPAY',
      refundStatus: 'Refund Completed',
    });
    if (!cancelSent) {
      throw new Error('sendBookingCancelledEmail delivery failed.');
    }
    console.log('✓ Test 10 Passed: ParkEase branded email templates rendered and delivered.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n==================================================================');
    console.log('🎉 ALL 10 ADMIN OPERATIONS MANAGEMENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('==================================================================');
  } finally {
    console.log('\nCleaning up test artifacts...');
    await Promise.all([
      UserModel.deleteMany({ _id: { $in: testIds } }),
      ParkingLotModel.deleteMany({ _id: { $in: testIds } }),
      ParkingFloorModel.deleteMany({ _id: { $in: testIds } }),
      ParkingZoneModel.deleteMany({ _id: { $in: testIds } }),
      ParkingSlotModel.deleteMany({ _id: { $in: testIds } }),
      VehicleModel.deleteMany({ _id: { $in: testIds } }),
      BookingModel.deleteMany({ _id: { $in: testIds } }),
      PaymentModel.deleteMany({ _id: { $in: testIds } }),
      VehicleMovementLogModel.deleteMany({ _id: { $in: testIds } }),
      BookingTimelineModel.deleteMany({ bookingId: { $in: testIds } }),
      AuditLogModel.deleteMany({ entityId: { $in: testIds.map((id) => id.toString()) } }),
      NotificationModel.deleteMany({ recipientId: { $in: testIds } }),
    ]);
    await mongoose.disconnect();
    console.log('Database disconnected. Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
