import 'dotenv/config';
import mongoose from 'mongoose';
import { adminSettingsService } from '../src/services/adminSettings.service.js';
import { securityService } from '../src/services/security.service.js';
import { customerBookingService } from '../src/services/customerBooking.service.js';
import { SystemSettingsModel } from '../src/models/SystemSettings.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { BookingModel } from '../src/models/Booking.js';
import { PaymentModel } from '../src/models/Payment.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('================================================================');
  console.log('--- Starting Admin Phase 1 Settings & Platform Fee Tests ---');
  console.log('================================================================');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const createdIds: { [key: string]: mongoose.Types.ObjectId[] } = {
    users: [],
    lots: [],
    floors: [],
    zones: [],
    slots: [],
    assignments: [],
    bookings: [],
    payments: [],
  };

  try {
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // Test 1: Fetch Singleton Settings & Default Values
    // -------------------------------------------------------------
    console.log('\n[Test 1] Fetching system settings via service layer...');
    const settings = await adminSettingsService.getSettings();
    if (!settings || settings.singletonKey !== 'GLOBAL') {
      throw new Error('Failed to retrieve singleton GLOBAL settings.');
    }
    console.log('  -> Singleton Key:', settings.singletonKey);
    console.log('  -> Application Name:', settings.applicationName);
    console.log('  -> Default Currency:', settings.defaultCurrency);
    console.log('  -> Owner Reg Fee:', settings.ownerRegistrationFee);
    console.log('  -> Tax Rate %:', settings.taxRatePercentage);
    console.log('  -> Platform Booking Fee (Current):', settings.platformBookingFee);
    console.log('  [PASS] Test 1: Singleton settings fetched successfully.');

    // -------------------------------------------------------------
    // Test 2: Input Validation (Negative Fee & Invalid Duration Range)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing input validations...');

    // 2a. Reject negative platformBookingFee
    let negativeFeeCaught = false;
    try {
      await adminSettingsService.updateSettings({ platformBookingFee: -10 });
    } catch (err: any) {
      negativeFeeCaught = true;
      console.log('  -> Correctly rejected negative fee:', err.message);
    }
    if (!negativeFeeCaught) {
      throw new Error('Validation failed: Allowed negative platformBookingFee!');
    }

    // 2b. Reject maximumDuration < minimumDuration
    let durationRangeCaught = false;
    try {
      await adminSettingsService.updateSettings({
        minimumBookingDurationHours: 10,
        maximumBookingDurationHours: 2,
      });
    } catch (err: any) {
      durationRangeCaught = true;
      console.log('  -> Correctly rejected invalid duration range:', err.message);
    }
    if (!durationRangeCaught) {
      throw new Error('Validation failed: Allowed maximumDuration < minimumDuration!');
    }

    // 2c. Reject taxRatePercentage > 100
    let taxRateCaught = false;
    try {
      await adminSettingsService.updateSettings({ taxRatePercentage: 150 });
    } catch (err: any) {
      taxRateCaught = true;
      console.log('  -> Correctly rejected tax rate > 100%:', err.message);
    }
    if (!taxRateCaught) {
      throw new Error('Validation failed: Allowed taxRatePercentage > 100!');
    }
    console.log('  [PASS] Test 2: Input validation constraints strictly enforced.');

    // -------------------------------------------------------------
    // Test 3: Updating Settings & Audit Log Persistence
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing valid settings update & audit logging...');

    const adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' });
    const dummyAdmin = await UserModel.create({
      fullName: `Test Admin ${timestamp}`,
      email: `test_admin_${timestamp}@parkease.com`,
      mobileNumber: `+9199${String(timestamp).slice(-8)}`,
      roleId: adminRole?._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });
    createdIds.users.push(dummyAdmin._id);

    const updated = await adminSettingsService.updateSettings(
      {
        platformBookingFee: 25, // Set fixed fee to ₹25
        bookingGracePeriodMinutes: 20,
        taxRatePercentage: 18,
        ownerRegistrationFee: 999,
        allowOnlineBookings: true,
        allowWalkInBookings: true,
      },
      dummyAdmin._id.toString(),
      adminRole?._id.toString()
    );

    if (updated.platformBookingFee !== 25) {
      throw new Error(`Expected platformBookingFee 25, got ${updated.platformBookingFee}`);
    }
    if (updated.bookingGracePeriodMinutes !== 20) {
      throw new Error(`Expected gracePeriod 20, got ${updated.bookingGracePeriodMinutes}`);
    }

    // Verify AuditLog
    const auditLog = await AuditLogModel.findOne({
      actionCode: 'SETTINGS_UPDATED',
      userId: dummyAdmin._id,
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!auditLog) {
      throw new Error('Expected AuditLog record for SETTINGS_UPDATED not found.');
    }
    console.log('  -> Audit Log confirmed:', auditLog.actionTitle, '-', auditLog.description);
    console.log('  [PASS] Test 3: Settings updated and AuditLog recorded.');

    // -------------------------------------------------------------
    // Test 4: Walk-in Booking Fee Calculation & Snapshot
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing Walk-in booking calculation & snapshot with ₹25 Platform Fee...');

    // Setup Test Facility & Staff
    const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
    const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
    const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });

    const owner = await UserModel.create({
      fullName: `Owner ${timestamp}`,
      email: `owner_${timestamp}@parkease.com`,
      mobileNumber: `+9198${String(timestamp).slice(-8)}`,
      roleId: ownerRole?._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });
    createdIds.users.push(owner._id);

    const staff = await UserModel.create({
      fullName: `Staff Officer ${timestamp}`,
      email: `staff_${timestamp}@parkease.com`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: securityRole?._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });
    createdIds.users.push(staff._id);

    const lot = await ParkingLotModel.create({
      ownerId: owner._id,
      parkingName: `Fee Test Facility ${timestamp}`,
      parkingStatus: 'Active',
      isVerified: true,
      layoutReviewStatus: 'Owner Confirmed',
      address: 'Plot 101 Fee Hub',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      latitude: 19.076,
      longitude: 72.8777,
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.076],
      },
      contactNumber: '+919999999999',
      totalFloors: 1,
      totalSlots: 5,
      carHourlyRate: 50,
      bikeHourlyRate: 20,
      suvHourlyRate: 70,
      evChargingRatePerHour: 80,
      gracePeriodMinutes: 15,
      minParkingDurationHours: 1,
      maxParkingDurationHours: 24,
      operatingHours: {
        isOpen24x7: true,
        openingTime: '00:00',
        closingTime: '23:59',
      },
    });
    createdIds.lots.push(lot._id);

    const assignment = await SecurityStaffAssignmentModel.create({
      securityStaffId: staff._id,
      ownerId: owner._id,
      parkingLotId: lot._id,
      assignmentStatus: 'Active',
      assignedBy: owner._id,
      assignedAt: new Date(),
    });
    createdIds.assignments.push(assignment._id);

    const floor = await ParkingFloorModel.create({
      parkingLotId: lot._id,
      floorNumber: 1,
      floorName: 'Ground Floor',
      floorStatus: 'Active',
      totalSlots: 5,
    });
    createdIds.floors.push(floor._id);

    const zone = await ParkingZoneModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneName: 'Zone A',
      zoneCode: 'A',
      vehicleType: 'Car',
      totalSlots: 5,
    });
    createdIds.zones.push(zone._id);

    const slot = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: `BAY-${String(timestamp).slice(-4)}`,
      slotLabel: 'Test Bay',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-SLOT-${timestamp}-01`,
      isBlocked: false,
    });
    createdIds.slots.push(slot._id);

    // Compute walk-in tariff: 2 hours of Car @ ₹50/hr = ₹100 base. With platformBookingFee = ₹25 -> Total ₹125
    const tariff = await securityService.calculateWalkInTariff({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      durationHours: 2,
    });

    console.log('  -> Walk-in baseAmount:', tariff.baseAmount);
    console.log('  -> Walk-in platformBookingFee:', tariff.platformBookingFee);
    console.log('  -> Walk-in totalAmount:', tariff.totalAmount);

    if (tariff.baseAmount !== 100) {
      throw new Error(`Expected baseAmount 100, got ${tariff.baseAmount}`);
    }
    if (tariff.platformBookingFee !== 25) {
      throw new Error(`Expected platformBookingFee 25, got ${tariff.platformBookingFee}`);
    }
    if (tariff.totalAmount !== 125) {
      throw new Error(`Expected totalAmount 125 (100 + 25), got ${tariff.totalAmount}`);
    }

    // Create the walk-in booking
    const walkInConfirmation = await securityService.createWalkInBooking({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      customerName: 'Rohit Sharma',
      customerMobile: `+9196${String(timestamp).slice(-8)}`,
      vehicleNumber: `MH01FE${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      durationHours: 2,
      slotSelectionMode: 'MANUAL',
      slotId: slot._id.toString(),
      cashCollected: true,
      cashAmountCollected: 125,
      staffNotes: 'Platform fee verification test',
    });

    const savedBookingId = walkInConfirmation.booking.bookingId;
    const savedBooking = await BookingModel.findById(savedBookingId).lean().exec();
    const savedPayment = await PaymentModel.findOne({ bookingId: savedBookingId }).lean().exec();

    if (!savedBooking || !savedPayment) {
      throw new Error('Walk-in booking or payment record not found in database.');
    }

    createdIds.bookings.push(savedBooking._id);
    createdIds.payments.push(savedPayment._id);

    if (savedBooking.platformBookingFee !== 25) {
      throw new Error(`Expected Booking.platformBookingFee snapshot = 25, got ${savedBooking.platformBookingFee}`);
    }
    if (savedPayment.platformBookingFee !== 25) {
      throw new Error(`Expected Payment.platformBookingFee snapshot = 25, got ${savedPayment.platformBookingFee}`);
    }
    if (savedBooking.totalAmount !== 125) {
      throw new Error(`Expected Booking.totalAmount = 125, got ${savedBooking.totalAmount}`);
    }
    console.log('  -> Booking snapshot verified: platformBookingFee =', savedBooking.platformBookingFee);
    console.log('  -> Payment snapshot verified: platformBookingFee =', savedPayment.platformBookingFee);
    console.log('  [PASS] Test 4: Walk-in booking tariff calculated and snapshot saved.');

    // -------------------------------------------------------------
    // Test 5: Online Booking Price Calculation & Snapshot
    // -------------------------------------------------------------
    console.log('\n[Test 5] Testing Online booking calculation with ₹25 Platform Fee...');

    const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    const futureEnd = new Date(futureStart.getTime() + 3 * 60 * 60 * 1000); // 3 hours duration

    const pricingBreakdown = customerBookingService.calculatePriceAndValidatePeriod({
      vehicleType: 'Car',
      scheduledEntryTime: futureStart,
      scheduledExitTime: futureEnd,
      pricing: {
        carHourlyRate: 50,
        bikeHourlyRate: 20,
        suvHourlyRate: 70,
        dailyRate: 500,
        overnightRate: 300,
        evChargingRatePerHour: 80,
        gracePeriodMinutes: 15,
        minParkingDurationHours: 1,
        maxParkingDurationHours: 24,
      },
      operating: {
        isOpen24x7: true,
        openingTime: '00:00',
        closingTime: '23:59',
      },
      platformBookingFee: 25,
    });

    console.log('  -> Online baseAmount (3 hrs @ 50):', pricingBreakdown.breakdown.baseAmount);
    console.log('  -> Online platformBookingFee:', pricingBreakdown.breakdown.platformBookingFee);
    console.log('  -> Online totalAmount:', pricingBreakdown.breakdown.totalAmount);

    if (pricingBreakdown.breakdown.baseAmount !== 150) {
      throw new Error(`Expected online baseAmount 150, got ${pricingBreakdown.breakdown.baseAmount}`);
    }
    if (pricingBreakdown.breakdown.platformBookingFee !== 25) {
      throw new Error(`Expected online platformBookingFee 25, got ${pricingBreakdown.breakdown.platformBookingFee}`);
    }
    if (pricingBreakdown.breakdown.totalAmount !== 175) {
      throw new Error(`Expected online totalAmount 175 (150 + 25), got ${pricingBreakdown.breakdown.totalAmount}`);
    }
    console.log('  [PASS] Test 5: Online booking breakdown calculated with platformBookingFee.');

    // -------------------------------------------------------------
    // Test 6: Snapshot Preservation on Later Fee Modification
    // -------------------------------------------------------------
    console.log('\n[Test 6] Modifying platform fee to ₹50 and verifying existing snapshot preservation...');

    await adminSettingsService.updateSettings(
      { platformBookingFee: 50 },
      dummyAdmin._id.toString()
    );

    // Verify existing booking still has its original ₹25 snapshot
    const reloadedBooking = await BookingModel.findById(savedBookingId).lean().exec();
    const reloadedPayment = await PaymentModel.findOne({ bookingId: savedBookingId }).lean().exec();

    if (reloadedBooking?.platformBookingFee !== 25) {
      throw new Error(`Snapshot violation! Expected existing booking fee to remain 25, but was modified to ${reloadedBooking?.platformBookingFee}`);
    }
    if (reloadedPayment?.platformBookingFee !== 25) {
      throw new Error(`Snapshot violation! Expected existing payment fee to remain 25, but was modified to ${reloadedPayment?.platformBookingFee}`);
    }
    console.log('  -> Immutable snapshot preserved on existing booking: ₹', reloadedBooking.platformBookingFee);

    // Verify new calculation now reflects ₹50
    const newTariff = await securityService.calculateWalkInTariff({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      durationHours: 2,
    });
    if (newTariff.platformBookingFee !== 50 || newTariff.totalAmount !== 150) {
      throw new Error(`Expected new tariff fee 50 and total 150, got fee=${newTariff.platformBookingFee}, total=${newTariff.totalAmount}`);
    }
    console.log('  -> New tariff correctly reflects updated fee: ₹', newTariff.platformBookingFee, '(Total: ₹', newTariff.totalAmount, ')');
    console.log('  [PASS] Test 6: Historical snapshot immutability strictly preserved.');

    // -------------------------------------------------------------
    // Cleanup: Reset platformBookingFee back to ₹0
    // -------------------------------------------------------------
    console.log('\n[Cleanup] Resetting platform fee back to ₹0 default...');
    await adminSettingsService.updateSettings(
      { platformBookingFee: 0, bookingGracePeriodMinutes: 15 },
      dummyAdmin._id.toString()
    );
    console.log('  -> Platform fee reset to ₹0.');

    console.log('\n================================================================');
    console.log('--- ALL 6 ADMIN PHASE 1 TESTS PASSED SUCCESSFULLY! ---');
    console.log('================================================================\n');
  } finally {
    // Clean up created records
    try {
      if (createdIds.bookings.length) await BookingModel.deleteMany({ _id: { $in: createdIds.bookings } });
      if (createdIds.payments.length) await PaymentModel.deleteMany({ _id: { $in: createdIds.payments } });
      if (createdIds.slots.length) await ParkingSlotModel.deleteMany({ _id: { $in: createdIds.slots } });
      if (createdIds.zones.length) await ParkingZoneModel.deleteMany({ _id: { $in: createdIds.zones } });
      if (createdIds.floors.length) await ParkingFloorModel.deleteMany({ _id: { $in: createdIds.floors } });
      if (createdIds.assignments.length) await SecurityStaffAssignmentModel.deleteMany({ _id: { $in: createdIds.assignments } });
      if (createdIds.lots.length) await ParkingLotModel.deleteMany({ _id: { $in: createdIds.lots } });
      if (createdIds.users.length) await UserModel.deleteMany({ _id: { $in: createdIds.users } });
    } catch (cleanErr) {
      console.warn('Error during test cleanup:', cleanErr);
    }
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
