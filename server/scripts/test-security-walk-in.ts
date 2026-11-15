import 'dotenv/config';
import mongoose from 'mongoose';
import { securityService } from '../src/services/security.service.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { BookingModel } from '../src/models/Booking.js';
import { PaymentModel } from '../src/models/Payment.js';
import { BookingTimelineModel } from '../src/models/BookingTimeline.js';
import { VehicleMovementLogModel } from '../src/models/VehicleMovementLog.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('--- Starting Walk-in Booking (Phase 4) Automated Test Suite ---');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  try {
    const timestamp = Date.now();

    // 1. Fetch canonical roles
    const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
    const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });

    if (!securityRole || !customerRole || !ownerRole) {
      throw new Error('Required system roles (SECURITY, CUSTOMER, OWNER) not found in master data.');
    }

    // 2. Create Owner User
    const owner = await UserModel.create({
      fullName: `Test Owner ${timestamp}`,
      email: `owner_${timestamp}@parkeasetest.com`,
      mobileNumber: `+9198${String(timestamp).slice(-8)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 3. Create Security Staff User (Assigned)
    const staff = await UserModel.create({
      fullName: `Security Officer ${timestamp}`,
      email: `security_${timestamp}@parkeasetest.com`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 4. Create Unassigned Security Staff User
    const unassignedStaff = await UserModel.create({
      fullName: `Unassigned Officer ${timestamp}`,
      email: `unassigned_${timestamp}@parkeasetest.com`,
      mobileNumber: `+9196${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 5. Create Parking Facility
    const parkingLot = await ParkingLotModel.create({
      ownerId: owner._id,
      parkingName: `Walk-in Test Plaza ${timestamp}`,
      description: 'Dedicated plaza for walk-in testing',
      address: 'Plot 404, Gate Terminal Area',
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
      hourlyRate: 60,
      totalCapacity: 10,
      totalSlots: 10,
      availableSlots: 10,
      occupiedSlots: 0,
      reservedSlots: 0,
      parkingStatus: 'Active',
      isApproved: true,
      isOpen24Hours: true,
      gracePeriodMinutes: 15,
    });

    // 6. Create Floor, Zone, and Slots
    const floor = await ParkingFloorModel.create({
      parkingLotId: parkingLot._id,
      floorNumber: 0,
      floorName: 'Ground Level',
      floorStatus: 'Active',
      totalSlots: 3,
    });

    const zone = await ParkingZoneModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneCode: 'W1',
      zoneName: 'Walk-in Arrivals',
      zoneStatus: 'Active',
      totalSlots: 3,
    });

    const slot1 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'W1-01',
      slotLabel: 'Walk-in Bay 1',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-SLOT-${timestamp}-01`,
    });

    const slot2 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'W1-02',
      slotLabel: 'Walk-in Bay 2',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-SLOT-${timestamp}-02`,
    });

    const slot3 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'W1-03',
      slotLabel: 'Walk-in Bike Bay',
      slotType: 'Standard',
      supportedVehicleType: 'Bike',
      slotStatus: 'Available',
      qrIdentifier: `QR-SLOT-${timestamp}-03`,
    });

    // 7. Assign Staff to Parking Facility
    await SecurityStaffAssignmentModel.create({
      securityStaffId: staff._id,
      ownerId: owner._id,
      parkingLotId: parkingLot._id,
      assignmentStatus: 'Active',
      assignedBy: owner._id,
    });

    console.log('✓ Master fixtures created successfully.');

    // --- TEST 1: Calculate Tariff ---
    console.log('\n--- Test 1: Calculate Tariff ---');
    const tariffCar2h = await securityService.calculateWalkInTariff({
      staffUserId: staff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      vehicleType: 'Car',
      durationHours: 2,
    });
    if (tariffCar2h.hourlyRate !== 60 || tariffCar2h.totalAmount !== 120) {
      throw new Error(`Expected Car 2h tariff to be 120, got ${tariffCar2h.totalAmount}`);
    }
    console.log(`✓ Car 2 hours tariff: ₹${tariffCar2h.totalAmount} (Rate: ₹${tariffCar2h.hourlyRate}/hr)`);

    const tariffBike4h = await securityService.calculateWalkInTariff({
      staffUserId: staff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      vehicleType: 'Bike',
      durationHours: 4,
    });
    if (tariffBike4h.hourlyRate !== 30 || tariffBike4h.totalAmount !== 120) {
      throw new Error(`Expected Bike 4h tariff to be 120, got ${tariffBike4h.totalAmount}`);
    }
    console.log(`✓ Bike 4 hours tariff: ₹${tariffBike4h.totalAmount} (Rate: ₹${tariffBike4h.hourlyRate}/hr)`);

    // --- TEST 2: Query Available Slots ---
    console.log('\n--- Test 2: Query Available Slots ---');
    const availableCarSlots = await securityService.getWalkInAvailableSlots({
      staffUserId: staff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      vehicleType: 'Car',
      durationHours: 2,
    });
    if (availableCarSlots.totalAvailableCount !== 2) {
      throw new Error(`Expected 2 available Car slots, got ${availableCarSlots.totalAvailableCount}`);
    }
    if (!availableCarSlots.recommendedSlot || availableCarSlots.recommendedSlot.slotNumber !== 'W1-01') {
      throw new Error(`Expected recommended slot to be W1-01, got ${availableCarSlots.recommendedSlot?.slotNumber}`);
    }
    console.log(`✓ Found ${availableCarSlots.totalAvailableCount} available car slots. Recommended: ${availableCarSlots.recommendedSlot.slotNumber}`);

    // --- TEST 3: Reject if Cash Not Confirmed ---
    console.log('\n--- Test 3: Reject if Cash Not Confirmed ---');
    let cashNotConfirmedThrown = false;
    try {
      await securityService.createWalkInBooking({
        staffUserId: staff._id.toString(),
        parkingLotId: parkingLot._id.toString(),
        customerName: 'Anil Kumar',
        customerMobile: '9876543210',
        vehicleNumber: 'MH02AB1234',
        vehicleType: 'Car',
        durationHours: 2,
        slotSelectionMode: 'AUTO',
        cashCollected: false,
        cashAmountCollected: 0,
      });
    } catch (err: any) {
      if (err.errorCode === 'CASH_NOT_CONFIRMED' || err.code === 'CASH_NOT_CONFIRMED') {
        cashNotConfirmedThrown = true;
      }
    }
    if (!cashNotConfirmedThrown) {
      throw new Error('Expected CASH_NOT_CONFIRMED error when cashCollected is false.');
    }
    console.log('✓ Rejected booking creation when cash was not collected.');

    // --- TEST 4: Reject if Cash Amount Mismatched ---
    console.log('\n--- Test 4: Reject if Cash Amount Mismatched ---');
    let amountMismatchThrown = false;
    try {
      await securityService.createWalkInBooking({
        staffUserId: staff._id.toString(),
        parkingLotId: parkingLot._id.toString(),
        customerName: 'Anil Kumar',
        customerMobile: '9876543210',
        vehicleNumber: 'MH02AB1234',
        vehicleType: 'Car',
        durationHours: 2,
        slotSelectionMode: 'AUTO',
        cashCollected: true,
        cashAmountCollected: 50, // Tariff is 120
      });
    } catch (err: any) {
      if (err.errorCode === 'CASH_AMOUNT_MISMATCH' || err.code === 'CASH_AMOUNT_MISMATCH') {
        amountMismatchThrown = true;
      }
    }
    if (!amountMismatchThrown) {
      throw new Error('Expected CASH_AMOUNT_MISMATCH error when cashAmountCollected !== totalAmount.');
    }
    console.log('✓ Rejected booking creation when cash amount did not match tariff.');

    // --- TEST 5: Reject Unassigned Staff ---
    console.log('\n--- Test 5: Facility Isolation (Unassigned Staff) ---');
    let unassignedThrown = false;
    try {
      await securityService.createWalkInBooking({
        staffUserId: unassignedStaff._id.toString(),
        parkingLotId: parkingLot._id.toString(),
        customerName: 'Anil Kumar',
        customerMobile: '9876543210',
        vehicleNumber: 'MH02AB1234',
        vehicleType: 'Car',
        durationHours: 2,
        slotSelectionMode: 'AUTO',
        cashCollected: true,
        cashAmountCollected: 120,
      });
    } catch (err: any) {
      if (err.errorCode === 'UNASSIGNED_FACILITY' || err.code === 'UNASSIGNED_FACILITY' || err.statusCode === 403) {
        unassignedThrown = true;
      }
    }
    if (!unassignedThrown) {
      throw new Error('Expected UNASSIGNED_FACILITY error for unassigned staff member.');
    }
    console.log('✓ Prevented unassigned security staff member from booking facility.');

    // --- TEST 6: Auto Assign Slot Walk-in Booking Creation ---
    console.log('\n--- Test 6: Auto Assign Slot Walk-in Booking Creation ---');
    const walkinPlate1 = `MH01CD${String(timestamp).slice(-4)}`;
    const walkinMobile1 = `9820${String(timestamp).slice(-6)}`;
    const walkin1 = await securityService.createWalkInBooking({
      staffUserId: staff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      customerName: 'Rohan Sharma',
      customerMobile: walkinMobile1,
      customerEmail: `rohan_${timestamp}@example.com`,
      vehicleNumber: walkinPlate1,
      vehicleType: 'Car',
      durationHours: 2,
      slotSelectionMode: 'AUTO',
      cashCollected: true,
      cashAmountCollected: 120,
      staffNotes: 'Front gate cash receipt handed over',
    });

    if (!walkin1.success || !walkin1.booking.bookingReference) {
      throw new Error('Walk-in booking creation failed.');
    }
    if (walkin1.booking.bookingType !== 'WALK_IN') {
      throw new Error(`Expected bookingType WALK_IN, got ${walkin1.booking.bookingType}`);
    }
    if (walkin1.booking.bookingStatus !== 'Active') {
      throw new Error(`Expected bookingStatus Active, got ${walkin1.booking.bookingStatus}`);
    }
    if (walkin1.payment.paymentMethod !== 'CASH' || walkin1.payment.paymentStatus !== 'SUCCESSFUL') {
      throw new Error('Expected PaymentMethod CASH and PaymentStatus SUCCESSFUL');
    }
    if (!walkin1.qrPayload || !walkin1.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Expected valid QR payload and Base64 QR code data URL.');
    }

    // Verify slot status in DB is directly 'Occupied'
    const slotDoc1 = await ParkingSlotModel.findById(walkin1.slot.slotId);
    if (slotDoc1?.slotStatus !== 'Occupied') {
      throw new Error(`Expected slot status Occupied, got ${slotDoc1?.slotStatus}`);
    }

    // Verify timeline entry
    const timeline = await BookingTimelineModel.findOne({
      bookingId: new mongoose.Types.ObjectId(walkin1.booking.bookingId),
      eventCode: 'WALK_IN_BOOKING_CREATED',
    });
    if (!timeline) {
      throw new Error('Expected WALK_IN_BOOKING_CREATED timeline entry in database.');
    }

    // Verify vehicle movement log is active inside immediately
    const movementLog = await VehicleMovementLogModel.findOne({
      bookingId: new mongoose.Types.ObjectId(walkin1.booking.bookingId),
    });
    if (!movementLog || movementLog.movementStatus !== 'Vehicle Inside' || movementLog.entryMethod !== 'Walk-in') {
      throw new Error(`Expected Vehicle Inside movement log created for walk-in direct check-in, got status: ${movementLog?.movementStatus}, method: ${movementLog?.entryMethod}`);
    }

    console.log(`✓ Walk-in Booking Created & Direct Check-in: ${walkin1.booking.bookingReference}`);
    console.log(`  Bay: ${walkin1.slot.slotNumber} (Status: Occupied)`);
    console.log(`  Payment: ${walkin1.payment.paymentReference} (Method: ${walkin1.payment.paymentMethod}, Status: ${walkin1.payment.paymentStatus})`);
    console.log(`  Receipt: ${walkin1.receiptNumber}`);
    console.log(`  QR Data URL Length: ${walkin1.qrCodeDataUrl.length} chars`);

    // --- TEST 7: Manual Slot Selection Walk-in Booking ---
    console.log('\n--- Test 7: Manual Slot Selection Walk-in Booking ---');
    const walkinPlate2 = `MH04EF${String(timestamp).slice(-4)}`;
    const walkinMobile2 = `9821${String(timestamp).slice(-6)}`;
    const walkin2 = await securityService.createWalkInBooking({
      staffUserId: staff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      customerName: 'Priya Patel',
      customerMobile: walkinMobile2,
      vehicleNumber: walkinPlate2,
      vehicleType: 'Car',
      durationHours: 1,
      slotSelectionMode: 'MANUAL',
      slotId: slot2._id.toString(),
      cashCollected: true,
      cashAmountCollected: 60,
    });

    if (walkin2.slot.slotId !== slot2._id.toString() || walkin2.slot.slotNumber !== 'W1-02') {
      throw new Error(`Expected manual slot W1-02, got ${walkin2.slot.slotNumber}`);
    }
    console.log(`✓ Manual Slot Selected Booking Created: ${walkin2.booking.bookingReference} at Bay ${walkin2.slot.slotNumber}`);

    // --- TEST 8: Slot Conflict Detection (Both slots now reserved) ---
    console.log('\n--- Test 8: Slot Conflict Detection ---');
    let noSlotsThrown = false;
    try {
      await securityService.createWalkInBooking({
        staffUserId: staff._id.toString(),
        parkingLotId: parkingLot._id.toString(),
        customerName: 'Sanjay Dutt',
        customerMobile: '9820099887',
        vehicleNumber: 'MH02ZZ9999',
        vehicleType: 'Car',
        durationHours: 2,
        slotSelectionMode: 'AUTO',
        cashCollected: true,
        cashAmountCollected: 120,
      });
    } catch (err: any) {
      if (err.errorCode === 'NO_SLOTS_AVAILABLE' || err.code === 'NO_SLOTS_AVAILABLE') {
        noSlotsThrown = true;
      }
    }
    if (!noSlotsThrown) {
      throw new Error('Expected NO_SLOTS_AVAILABLE error when all car slots are reserved.');
    }
    console.log('✓ Correctly blocked walk-in booking when all car slots are booked/reserved.');

    // --- TEST 9: QR Exit Pass Verification & Exit Completion ---
    console.log('\n--- Test 9: QR Exit Pass Verification & Exit Completion ---');
    const verifiedPass = await securityService.verifyQrPass({
      staffUserId: staff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      qrPayload: walkin1.qrPayload,
    });

    if (!verifiedPass.isAuthentic || !verifiedPass.eligibleForExit) {
      throw new Error(`Walk-in pass should be authentic and eligible for exit. Reason: ${verifiedPass.exitIneligibilityReason}`);
    }
    if (verifiedPass.eligibleForEntry) {
      throw new Error('Double entry should be prevented since vehicle was already checked in directly.');
    }
    console.log(`✓ Scanned QR Pass Verified for Exit: ${verifiedPass.booking.bookingReference} (Eligible for exit: true, Double entry prevented)`);

    const exitResult = await securityService.completeVehicleExit({
      staffUserId: staff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      bookingId: walkin1.booking.bookingId,
      exitMethod: 'QR Code',
    });

    if (!exitResult.success || exitResult.bookingStatus !== 'Completed') {
      throw new Error(`Expected vehicle exit to set booking status Completed, got ${exitResult.bookingStatus}`);
    }

    // Verify slot in DB is now 'Available'
    const updatedSlot1 = await ParkingSlotModel.findById(slot1._id);
    if (updatedSlot1?.slotStatus !== 'Available') {
      throw new Error(`Expected slot status Available after exit, got ${updatedSlot1?.slotStatus}`);
    }
    console.log(`✓ Physical Vehicle Exit Completed: Booking is Completed, Bay ${updatedSlot1.slotNumber} released to Available.`);

    console.log('\n======================================================');
    console.log('🎉 ALL 9 WALK-IN BOOKING TESTS PASSED FLAWLESSLY! 🎉');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
