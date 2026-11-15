import assert from 'node:assert';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { VehicleModel } from '../src/models/Vehicle.js';
import { BookingModel } from '../src/models/Booking.js';
import { PaymentModel } from '../src/models/Payment.js';
import { OtpVerificationModel } from '../src/models/OtpVerification.js';
import { profileService } from '../src/services/profile.service.js';
import { customerBookingService } from '../src/services/customerBooking.service.js';

console.log('========================================================================');
console.log('  ParkEase — Verification: Profile Immediate Reflection & Booking Statuses');
console.log('========================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
  assert(customerRole, 'Customer role must exist in DB');

  const runId = Date.now().toString().slice(-6);

  // 1. Create a Customer User for testing
  const customer = await UserModel.create({
    fullName: `StatusTester ${runId}`,
    email: `tester_${runId}@parkease.com`,
    mobileNumber: `+9198000${runId.slice(-5)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });
  console.log(`✓ Created test customer: ${customer.fullName} (${customer.email})`);

  // -------------------------------------------------------------------------
  // TEST A: Profile Personal Info & Avatar Persistence
  // -------------------------------------------------------------------------
  console.log('\n--- TEST A: Profile Personal Info & Avatar Persistence ---');
  const avatarPath = `/api/v1/profile/avatar/avatar-${customer._id}-${Date.now()}.jpg`;
  const updatedProfile = await profileService.updatePersonalInfo(customer._id.toString(), {
    fullName: `StatusTester Updated ${runId}`,
    profileImage: avatarPath,
    gender: 'Male',
    preferredLanguage: 'English',
    timezone: 'Asia/Kolkata',
  });

  assert.strictEqual(updatedProfile.user.profileImage, avatarPath, 'Avatar path must persist');
  assert.strictEqual(updatedProfile.user.fullName, `StatusTester Updated ${runId}`, 'Full name must persist');

  const dbCustomerAfterProfile = await UserModel.findById(customer._id);
  assert.strictEqual(dbCustomerAfterProfile?.profileImage, avatarPath, 'Avatar must be saved in database');
  console.log('✓ Personal info and avatar saved and verified in database.');

  // -------------------------------------------------------------------------
  // TEST B: Email & Mobile Change with OTP Verification
  // -------------------------------------------------------------------------
  console.log('\n--- TEST B: Email & Mobile Change with OTP Verification ---');
  const newEmail = `updated_${runId}@parkease.com`;
  const reqEmailRes = await profileService.requestEmailChangeOtp(customer._id.toString(), newEmail);
  assert(reqEmailRes.targetEmailMasked, 'OTP should be dispatched for email change');

  const emailOtpRecord = await OtpVerificationModel.findOne({
    userId: customer._id,
    verificationType: 'CHANGE_EMAIL',
    verificationStatus: 'Pending',
  }).sort({ createdAt: -1 });
  assert(emailOtpRecord, 'Pending OTP record must exist for email change');

  const crypto = await import('node:crypto');
  const validEmailOtp = '654321';
  emailOtpRecord.otpCodeHash = crypto.default.createHash('sha256').update(validEmailOtp).digest('hex');
  await emailOtpRecord.save();

  const verifiedEmailRes = await profileService.verifyEmailChangeOtp(
    customer._id.toString(),
    newEmail,
    validEmailOtp,
  );
  assert.strictEqual((verifiedEmailRes.user as any).email, newEmail, 'Email must update to new email');
  const dbCustomerEmail = await UserModel.findById(customer._id);
  assert.strictEqual(dbCustomerEmail?.email, newEmail, 'Updated email must be saved in DB');
  console.log(`✓ Email change OTP flow verified: ${newEmail}`);

  // Mobile Change
  const newMobile = `+9198111${runId.slice(-5)}`;
  const reqMobileRes = await profileService.requestMobileChangeOtp(customer._id.toString(), newMobile);
  assert(reqMobileRes.targetEmailMasked, 'OTP should be dispatched for mobile change');

  const mobileOtpRecord = await OtpVerificationModel.findOne({
    userId: customer._id,
    verificationType: 'CHANGE_MOBILE',
    verificationStatus: 'Pending',
  }).sort({ createdAt: -1 });
  assert(mobileOtpRecord, 'Pending OTP record must exist for mobile change');

  const validMobileOtp = '123456';
  mobileOtpRecord.otpCodeHash = crypto.default.createHash('sha256').update(validMobileOtp).digest('hex');
  await mobileOtpRecord.save();

  const verifiedMobileRes = await profileService.verifyMobileChangeOtp(
    customer._id.toString(),
    newMobile,
    validMobileOtp,
  );
  assert.strictEqual((verifiedMobileRes.user as any).mobileNumber, newMobile, 'Mobile must update to new mobile');
  const dbCustomerMobile = await UserModel.findById(customer._id);
  assert.strictEqual(dbCustomerMobile?.mobileNumber, newMobile, 'Updated mobile must be saved in DB');
  console.log(`✓ Mobile change OTP flow verified: ${newMobile}`);

  // -------------------------------------------------------------------------
  // TEST C: Booking Lifecycle & Status Transitions
  // -------------------------------------------------------------------------
  console.log('\n--- TEST C: Booking Lifecycle & Status Transitions ---');

  // Find or create lot infrastructure
  let lot = await ParkingLotModel.findOne({ status: 'ACTIVE' });
  if (!lot) {
    lot = await ParkingLotModel.create({
      parkingName: `Test Facility ${runId}`,
      ownerId: customer._id,
      address: '100 Test Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      contactNumber: '+919999999999',
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.076],
      },
      latitude: 19.076,
      longitude: 72.8777,
      totalCapacity: 10,
      availableSlots: 10,
      occupiedSlots: 0,
      reservedSlots: 0,
      status: 'ACTIVE',
      baseHourlyRate: 50,
      gracePeriodMinutes: 15,
    });
  }

  let floor = await ParkingFloorModel.findOne({ parkingLotId: lot._id });
  if (!floor) {
    floor = await ParkingFloorModel.create({
      parkingLotId: lot._id,
      floorNumber: 1,
      floorName: 'Ground Floor',
      capacity: 10,
      availableSlots: 10,
    });
  }

  let zone = await ParkingZoneModel.findOne({ parkingLotId: lot._id, floorId: floor._id });
  if (!zone) {
    zone = await ParkingZoneModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneName: 'Zone A',
      zoneCode: 'A',
      capacity: 10,
      availableSlots: 10,
    });
  }

  const slotA = await ParkingSlotModel.create({
    parkingLotId: lot._id,
    floorId: floor._id,
    zoneId: zone._id,
    slotNumber: `TEST-A-${runId}`,
    slotLabel: `Bay A-${runId}`,
    qrIdentifier: `QR-A-${runId}`,
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
  });

  const slotB = await ParkingSlotModel.create({
    parkingLotId: lot._id,
    floorId: floor._id,
    zoneId: zone._id,
    slotNumber: `TEST-B-${runId}`,
    slotLabel: `Bay B-${runId}`,
    qrIdentifier: `QR-B-${runId}`,
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
  });

  const vehicle = await VehicleModel.create({
    customerId: customer._id,
    vehicleNumber: `MH01TS${runId.slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Honda',
    vehicleModel: 'City',
  });

  // 1. Create a Confirmed Booking to test CANCELLATION + AUTOMATED REFUND
  const futureEntry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours in future
  const futureExit = new Date(Date.now() + 4 * 60 * 60 * 1000);

  const bookingToCancel = await BookingModel.create({
    bookingReference: `PB-CAN-${runId}`,
    customerId: customer._id,
    vehicleId: vehicle._id,
    parkingLotId: lot._id,
    floorId: floor._id,
    zoneId: zone._id,
    originalSlotId: slotA._id,
    currentSlotId: slotA._id,
    bookingStatus: 'Confirmed',
    scheduledEntryTime: futureEntry,
    scheduledExitTime: futureExit,
    bookingDurationMinutes: 120,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 50,
    baseAmount: 100,
    totalAmount: 100,
  });

  const paymentToCancel = await PaymentModel.create({
    paymentReference: `PAY-CAN-${runId}`,
    bookingId: bookingToCancel._id,
    customerId: customer._id,
    paymentType: 'Parking Booking',
    paymentTypeCode: 'BOOKING',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'SUCCESSFUL',
    amount: 100,
  });

  // Test Customer Cancellation
  const cancelResult = await customerBookingService.cancelBooking({
    bookingId: bookingToCancel._id.toString(),
    userId: customer._id.toString(),
    cancelledBy: 'Customer',
    reason: 'Customer cancelled reservation due to reschedule.',
  });

  assert.strictEqual(cancelResult.bookingStatus, 'Cancelled', 'Booking status must update to Cancelled');

  const dbBookingAfterCancel = await BookingModel.findById(bookingToCancel._id);
  assert.strictEqual(dbBookingAfterCancel?.bookingStatus, 'Cancelled', 'Database bookingStatus must be Cancelled');
  assert.strictEqual(dbBookingAfterCancel?.refundAmount, 100, 'Automated full refund amount must be set to 100');

  const dbPaymentAfterCancel = await PaymentModel.findById(paymentToCancel._id);
  assert.strictEqual(dbPaymentAfterCancel?.paymentStatus, 'REFUNDED', 'Payment status must be REFUNDED');
  assert.strictEqual(dbPaymentAfterCancel?.refundAmount, 100, 'Payment refund amount must be 100');
  console.log('✓ Booking Cancellation & Automated Refund verified successfully.');

  // 2. Create a Confirmed Booking to test CHECK-IN (Active) and CHECK-OUT (Completed)
  const bookingToComplete = await BookingModel.create({
    bookingReference: `PB-CMP-${runId}`,
    customerId: customer._id,
    vehicleId: vehicle._id,
    parkingLotId: lot._id,
    floorId: floor._id,
    zoneId: zone._id,
    originalSlotId: slotB._id,
    currentSlotId: slotB._id,
    bookingStatus: 'Confirmed',
    scheduledEntryTime: new Date(Date.now() - 30 * 60 * 1000), // scheduled 30m ago
    scheduledExitTime: new Date(Date.now() + 90 * 60 * 1000),
    bookingDurationMinutes: 120,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 50,
    baseAmount: 100,
    totalAmount: 100,
  });

  // Check In (transition to Active)
  const checkInResult = await customerBookingService.recordVehicleEntry({
    bookingId: bookingToComplete._id.toString(),
    performedBy: customer._id.toString(),
  });
  assert.strictEqual(checkInResult.bookingStatus, 'Active', 'Booking status must transition to Active');

  const dbSlotBActive = await ParkingSlotModel.findById(slotB._id);
  assert.strictEqual(dbSlotBActive?.slotStatus, 'Occupied', 'Physical slot must transition to Occupied on check-in');
  console.log('✓ Gate Check-In transition to Active & bay Occupied verified.');

  // Check Out (transition to Completed)
  const checkOutResult = await customerBookingService.completeBookingExit({
    bookingId: bookingToComplete._id.toString(),
    performedBy: customer._id.toString(),
  });
  assert.strictEqual(checkOutResult.bookingStatus, 'Completed', 'Booking status must transition to Completed');

  const dbBookingCompleted = await BookingModel.findById(bookingToComplete._id);
  assert.strictEqual(dbBookingCompleted?.bookingStatus, 'Completed', 'DB bookingStatus must be Completed');
  assert(dbBookingCompleted?.actualExitTime, 'actualExitTime must be recorded');

  const dbSlotBCompleted = await ParkingSlotModel.findById(slotB._id);
  assert.strictEqual(dbSlotBCompleted?.slotStatus, 'Available', 'Physical slot must be released back to Available');
  console.log('✓ Gate Check-Out transition to Completed & bay Available verified.');

  // 3. Create an Expired Confirmed Booking to test AUTO-RECONCILIATION TO NO SHOW
  const expiredSlot = await ParkingSlotModel.create({
    parkingLotId: lot._id,
    floorId: floor._id,
    zoneId: zone._id,
    slotNumber: `TEST-NSH-${runId}`,
    slotLabel: `Bay NSH-${runId}`,
    qrIdentifier: `QR-NSH-${runId}`,
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Reserved',
  });

  const expiredEntry = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
  const expiredExit = new Date(Date.now() - 1 * 60 * 60 * 1000);  // 1 hour ago

  const bookingNoShow = await BookingModel.create({
    bookingReference: `PB-NSH-${runId}`,
    customerId: customer._id,
    vehicleId: vehicle._id,
    parkingLotId: lot._id,
    floorId: floor._id,
    zoneId: zone._id,
    originalSlotId: expiredSlot._id,
    currentSlotId: expiredSlot._id,
    bookingStatus: 'Confirmed', // Still confirmed in DB, but entry/exit expired!
    actualEntryTime: null,
    scheduledEntryTime: expiredEntry,
    scheduledExitTime: expiredExit,
    bookingDurationMinutes: 120,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 50,
    baseAmount: 100,
    totalAmount: 100,
  });

  // Call getCustomerBookings: this should trigger automatic reconciliation sweep!
  const bookingsQueryResult = await customerBookingService.getCustomerBookings({
    userId: customer._id.toString(),
    category: 'All',
  });

  const dbBookingAfterSweep = await BookingModel.findById(bookingNoShow._id);
  assert.strictEqual(dbBookingAfterSweep?.bookingStatus, 'No Show', 'Expired booking must automatically transition to No Show');
  assert.strictEqual(dbBookingAfterSweep?.noShowDetected, true, 'noShowDetected must be true');

  const dbExpiredSlotAfterSweep = await ParkingSlotModel.findById(expiredSlot._id);
  assert.strictEqual(dbExpiredSlotAfterSweep?.slotStatus, 'Available', 'Physical bay hold must be released on No Show');
  console.log('✓ Auto-reconciliation of expired reservation to No Show verified.');

  // Verify category counts in getCustomerBookings
  console.log('\n--- Category Counts from getCustomerBookings ---');
  console.log(bookingsQueryResult.categoryCounts);

  assert.strictEqual(bookingsQueryResult.categoryCounts.Cancelled >= 1, true, 'Category Cancelled must count >= 1');
  assert.strictEqual(bookingsQueryResult.categoryCounts.Completed >= 1, true, 'Category Completed must count >= 1');
  assert.strictEqual(bookingsQueryResult.categoryCounts['No Show'] >= 1, true, 'Category No Show must count >= 1');
  console.log('✓ Category counts accurately reflect Completed, Cancelled, and No Show bookings!');

  console.log('\n========================================================================');
  console.log('  ALL VERIFICATION CHECKS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
