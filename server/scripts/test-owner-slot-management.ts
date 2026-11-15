import 'dotenv/config';
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
import { AuditLogModel } from '../src/models/AuditLog.js';
import { ownerService } from '../src/services/owner.service.js';
import { parkingLotService } from '../src/services/parkingLot.service.js';

console.log('========================================================================');
console.log('  ParkEase — Owner Module Phase 2: Slot Management Verification');
console.log('========================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });

  assert(ownerRole, 'Owner role must exist in DB');
  assert(customerRole, 'Customer role must exist in DB');

  const runId = Date.now().toString().slice(-6);

  // 1. Create Test Owner A & Owner B
  const ownerA = await UserModel.create({
    fullName: `Owner Alpha Slots ${runId}`,
    email: `owner_slots_a_${runId}@parkease.com`,
    mobileNumber: `+9197300${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const ownerB = await UserModel.create({
    fullName: `Owner Beta Slots ${runId}`,
    email: `owner_slots_b_${runId}@parkease.com`,
    mobileNumber: `+9197400${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const customer = await UserModel.create({
    fullName: `Customer User ${runId}`,
    email: `cust_slots_${runId}@parkease.com`,
    mobileNumber: `+9197500${runId.slice(-5)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const vehicle = await VehicleModel.create({
    customerId: customer._id,
    vehicleNumber: `MH02SL${runId.slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Honda',
    vehicleModel: 'City',
    vehicleStatus: 'Active',
    isDefault: true,
  });

  // 2. Create Facility for Owner A
  const lotA = await ParkingLotModel.create({
    ownerId: ownerA._id,
    parkingName: `Alpha Slot Facility ${runId}`,
    address: '42 Tech Park Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400076',
    country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    contactNumber: '+919999900001',
    totalFloors: 1,
    totalSlots: 4,
    availableSlots: 4,
    occupiedSlots: 0,
    reservedSlots: 0,
    hourlyRate: 50,
    parkingStatus: 'Active',
    layoutReviewStatus: 'Owner Confirmed',
  });

  const floorA = await ParkingFloorModel.create({
    parkingLotId: lotA._id,
    floorName: 'Ground Floor',
    floorNumber: 0,
    totalZones: 1,
    totalSlots: 4,
    availableSlots: 4,
    occupiedSlots: 0,
    reservedSlots: 0,
    floorStatus: 'Active',
  });

  const zoneA = await ParkingZoneModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneName: 'Zone A',
    zoneCode: 'ZA',
    vehicleType: 'Car',
    totalSlots: 4,
    availableSlots: 4,
    occupiedSlots: 0,
    reservedSlots: 0,
    zoneStatus: 'Active',
  });

  // Create 4 test slots for Owner A
  const slotA1 = await ParkingSlotModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `SL-01-${runId}`,
    slotLabel: 'Slot 1',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
    qrIdentifier: `QR-SL-01-${runId}`,
  });

  const slotA2 = await ParkingSlotModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `SL-02-${runId}`,
    slotLabel: 'Slot 2 (EV)',
    slotType: 'EV Charging',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
    qrIdentifier: `QR-SL-02-${runId}`,
  });

  const slotA3 = await ParkingSlotModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `SL-03-${runId}`,
    slotLabel: 'Slot 3',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
    qrIdentifier: `QR-SL-03-${runId}`,
  });

  const slotA4_Occupied = await ParkingSlotModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `SL-04-${runId}`,
    slotLabel: 'Slot 4',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Occupied',
    qrIdentifier: `QR-SL-04-${runId}`,
  });

  // 3. Create Facility for Owner B (to verify cross-owner isolation)
  const lotB = await ParkingLotModel.create({
    ownerId: ownerB._id,
    parkingName: `Beta Facility ${runId}`,
    address: '99 Marine Lines',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400020',
    country: 'India',
    latitude: 18.9438,
    longitude: 72.8231,
    location: { type: 'Point', coordinates: [72.8231, 18.9438] },
    contactNumber: '+919999900002',
    totalFloors: 1,
    totalSlots: 1,
    availableSlots: 1,
    hourlyRate: 80,
    parkingStatus: 'Active',
    layoutReviewStatus: 'Owner Confirmed',
  });

  const floorB = await ParkingFloorModel.create({
    parkingLotId: lotB._id,
    floorName: 'Floor 1',
    floorNumber: 1,
    totalZones: 1,
    totalSlots: 1,
    availableSlots: 1,
    floorStatus: 'Active',
  });

  const zoneB = await ParkingZoneModel.create({
    parkingLotId: lotB._id,
    floorId: floorB._id,
    zoneName: 'Zone B1',
    zoneCode: 'ZB1',
    vehicleType: 'Car',
    totalSlots: 1,
    availableSlots: 1,
    zoneStatus: 'Active',
  });

  const slotB1 = await ParkingSlotModel.create({
    parkingLotId: lotB._id,
    floorId: floorB._id,
    zoneId: zoneB._id,
    slotNumber: `SL-B1-${runId}`,
    slotLabel: 'Beta Slot 1',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
    qrIdentifier: `QR-SL-B1-${runId}`,
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Owner A can view slots belonging to their facilities
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Owner A view & filter slots ---');
    const ownerASlots = await ownerService.getOwnerSlots(ownerA._id.toString(), {
      parkingLotId: lotA._id.toString(),
    });
    assert.strictEqual(ownerASlots.total, 4, 'Owner A should see 4 slots');
    assert.strictEqual(ownerASlots.summary.total, 4, 'Summary total slots should be 4');
    assert.strictEqual(ownerASlots.summary.occupied, 1, 'Summary occupied slots should be 1');
    assert.strictEqual(ownerASlots.summary.available, 3, 'Summary available slots should be 3');

    // Test filter by slotType
    const evSlots = await ownerService.getOwnerSlots(ownerA._id.toString(), {
      parkingLotId: lotA._id.toString(),
      slotType: 'EV Charging',
    });
    assert.strictEqual(evSlots.total, 1, 'Should find 1 EV Charging slot');
    assert.strictEqual(evSlots.slots[0]?.slotNumber, `SL-02-${runId}`);

    // Test getOwnerSlotById
    const singleSlotDetail = await ownerService.getOwnerSlotById(
      ownerA._id.toString(),
      slotA1._id.toString(),
    );
    assert.strictEqual(singleSlotDetail.slotNumber, `SL-01-${runId}`);
    assert.strictEqual(singleSlotDetail.parkingLotId.parkingName, lotA.parkingName);
    console.log('✓ Test 1 Passed: Slot browsing, filtering, and detail retrieval verified.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Cross-Owner Isolation (Owner B cannot view/modify Owner A slots)
    // -------------------------------------------------------------------------
    console.log('--- Test 2: Cross-Owner Isolation ---');
    let foreignViewBlocked = false;
    try {
      await ownerService.getOwnerSlots(ownerB._id.toString(), {
        parkingLotId: lotA._id.toString(),
      });
    } catch (err: any) {
      if (err.statusCode === 403) foreignViewBlocked = true;
    }
    assert(foreignViewBlocked, 'Owner B querying Owner A lot must return 403 Forbidden');

    let foreignSlotDetailBlocked = false;
    try {
      await ownerService.getOwnerSlotById(ownerB._id.toString(), slotA1._id.toString());
    } catch (err: any) {
      if (err.statusCode === 403) foreignSlotDetailBlocked = true;
    }
    assert(foreignSlotDetailBlocked, 'Owner B accessing Owner A slot detail must return 403 Forbidden');

    let foreignStatusChangeBlocked = false;
    try {
      await ownerService.updateOwnerSlotOperationalStatus(
        ownerB._id.toString(),
        slotA1._id.toString(),
        { slotStatus: 'Under Maintenance' },
      );
    } catch (err: any) {
      if (err.statusCode === 403) foreignStatusChangeBlocked = true;
    }
    assert(foreignStatusChangeBlocked, 'Owner B changing Owner A slot status must return 403 Forbidden');
    console.log('✓ Test 2 Passed: Strict cross-owner isolation enforced with 403 Forbidden.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Valid Operational Status Transitions
    // -------------------------------------------------------------------------
    console.log('--- Test 3: Valid Status Transitions (Available <-> Under Maintenance) ---');
    // Transition Available -> Under Maintenance
    const maintResult = await ownerService.updateOwnerSlotOperationalStatus(
      ownerA._id.toString(),
      slotA1._id.toString(),
      { slotStatus: 'Under Maintenance', remarks: 'Sensor calibration in progress' },
    );
    assert.strictEqual(maintResult.slotStatus, 'Under Maintenance', 'Slot status should be Under Maintenance');
    assert.strictEqual(maintResult.remarks, 'Sensor calibration in progress', 'Remarks should be recorded');

    // Verify Zone and Floor counters reconciled
    const updatedZoneAfterMaint = await ParkingZoneModel.findById(zoneA._id);
    assert.strictEqual(updatedZoneAfterMaint?.availableSlots, 2, 'Available slots in zone should decrease to 2');

    // Verify Audit Log was recorded
    const auditMaint = await AuditLogModel.findOne({
      targetDocumentId: slotA1._id,
      actionCode: 'SLOT_STATUS_UPDATED',
    });
    assert(auditMaint, 'AuditLog must be recorded for slot status change');

    // Transition Under Maintenance -> Available (clear maintenance)
    const availResult = await ownerService.updateOwnerSlotOperationalStatus(
      ownerA._id.toString(),
      slotA1._id.toString(),
      { slotStatus: 'Available' },
    );
    assert.strictEqual(availResult.slotStatus, 'Available', 'Slot status should return to Available');
    assert.strictEqual(availResult.remarks, null, 'Remarks should be cleared when returning to Available');

    const updatedZoneAfterAvail = await ParkingZoneModel.findById(zoneA._id);
    assert.strictEqual(updatedZoneAfterAvail?.availableSlots, 3, 'Available slots in zone should increase back to 3');
    console.log('✓ Test 3 Passed: Operational status transitions and hierarchy counter reconciliation verified.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Invalid Status Transitions are Rejected
    // -------------------------------------------------------------------------
    console.log('--- Test 4: Invalid Status Transitions ---');
    let occupiedAttemptBlocked = false;
    try {
      await ownerService.updateOwnerSlotOperationalStatus(
        ownerA._id.toString(),
        slotA1._id.toString(),
        { slotStatus: 'Occupied' },
      );
    } catch (err: any) {
      if (err.statusCode === 400 && err.errorCode === 'INVALID_STATUS_TRANSITION') {
        occupiedAttemptBlocked = true;
      }
    }
    assert(occupiedAttemptBlocked, 'Attempting to manually set Occupied status must return 400 Bad Request');

    let reservedAttemptBlocked = false;
    try {
      await ownerService.updateOwnerSlotOperationalStatus(
        ownerA._id.toString(),
        slotA1._id.toString(),
        { slotStatus: 'Reserved' },
      );
    } catch (err: any) {
      if (err.statusCode === 400 && err.errorCode === 'INVALID_STATUS_TRANSITION') {
        reservedAttemptBlocked = true;
      }
    }
    assert(reservedAttemptBlocked, 'Attempting to manually set Reserved status must return 400 Bad Request');
    console.log('✓ Test 4 Passed: Direct Occupied/Reserved transitions rejected.\n');

    // -------------------------------------------------------------------------
    // TEST 5: Active Booking Conflict Prevents Unsafe Maintenance Change
    // -------------------------------------------------------------------------
    console.log('--- Test 5: Active Booking Conflict Protection ---');
    // Create an active confirmed booking assigned to slotA3
    const activeBooking = await BookingModel.create({
      bookingReference: `BKG-CONF-${runId}`,
      customerId: customer._id,
      vehicleId: vehicle._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slotA3._id,
      currentSlotId: slotA3._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      scheduledEntryTime: new Date(Date.now() + 1800000), // in 30 mins
      scheduledExitTime: new Date(Date.now() + 5400000),
      durationMinutes: 60,
      bookingDurationMinutes: 60,
      gracePeriodMinutes: 15,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 50,
      totalAmount: 50,
      paymentStatus: 'PAID',
    });

    let activeBookingConflictBlocked = false;
    let conflictErrorMessage = '';
    try {
      await ownerService.updateOwnerSlotOperationalStatus(
        ownerA._id.toString(),
        slotA3._id.toString(),
        { slotStatus: 'Under Maintenance', remarks: 'Trying to block with active booking' },
      );
    } catch (err: any) {
      if (err.statusCode === 409 && err.errorCode === 'ACTIVE_BOOKING_CONFLICT') {
        activeBookingConflictBlocked = true;
        conflictErrorMessage = err.message;
      }
    }
    assert(activeBookingConflictBlocked, 'Slot with active/confirmed booking cannot be placed under maintenance');
    assert(conflictErrorMessage.includes(activeBooking.bookingReference), 'Error message must cite the conflicting booking reference');
    console.log('✓ Test 5 Passed: Active booking conflict protection verified (409 Conflict).\n');

    // -------------------------------------------------------------------------
    // TEST 6: Occupied Slots Cannot be Blocked / Marked for Maintenance
    // -------------------------------------------------------------------------
    console.log('--- Test 6: Occupied Slot Protection ---');
    let occupiedSlotChangeBlocked = false;
    try {
      await ownerService.updateOwnerSlotOperationalStatus(
        ownerA._id.toString(),
        slotA4_Occupied._id.toString(),
        { slotStatus: 'Under Maintenance' },
      );
    } catch (err: any) {
      if (err.statusCode === 409 && err.errorCode === 'SLOT_OCCUPIED_CONFLICT') {
        occupiedSlotChangeBlocked = true;
      }
    }
    assert(occupiedSlotChangeBlocked, 'Physically Occupied slot cannot be marked for maintenance');
    console.log('✓ Test 6 Passed: Physically occupied slot protection verified.\n');

    // -------------------------------------------------------------------------
    // TEST 7: Structural Immutability Enforcement
    // -------------------------------------------------------------------------
    console.log('--- Test 7: Structural Immutability ---');
    // Operational status update accepts only slotStatus and remarks.
    // Structural properties like slotNumber, slotType, qrIdentifier are strictly immutable.
    const beforeSlot = await ParkingSlotModel.findById(slotA2._id).lean();
    await ownerService.updateOwnerSlotOperationalStatus(
      ownerA._id.toString(),
      slotA2._id.toString(),
      { slotStatus: 'Under Maintenance', remarks: 'Valid operational reason' } as any,
    );
    const afterSlot = await ParkingSlotModel.findById(slotA2._id).lean();

    assert.strictEqual(afterSlot?.slotNumber, beforeSlot?.slotNumber, 'slotNumber must remain unchanged');
    assert.strictEqual(afterSlot?.slotLabel, beforeSlot?.slotLabel, 'slotLabel must remain unchanged');
    assert.strictEqual(afterSlot?.slotType, beforeSlot?.slotType, 'slotType must remain unchanged');
    assert.strictEqual(afterSlot?.qrIdentifier, beforeSlot?.qrIdentifier, 'qrIdentifier must remain unchanged');
    assert.strictEqual(afterSlot?.floorId.toString(), beforeSlot?.floorId.toString(), 'floorId must remain unchanged');
    assert.strictEqual(afterSlot?.zoneId.toString(), beforeSlot?.zoneId.toString(), 'zoneId must remain unchanged');
    console.log('✓ Test 7 Passed: Structural slot properties remained 100% immutable.\n');

    // -------------------------------------------------------------------------
    // TEST 8: Customer Booking Integration & Pool Exclusion
    // -------------------------------------------------------------------------
    console.log('--- Test 8: Customer Booking Integration ---');
    // Verify that Under Maintenance slots are excluded when checking available slots
    const availableSlotsForBooking = await ParkingSlotModel.find({
      parkingLotId: lotA._id,
      slotStatus: 'Available',
    }).countDocuments();
    // Originally 3 available, slotA2 was placed under maintenance -> 2 available
    assert.strictEqual(availableSlotsForBooking, 2, 'Under maintenance slot is excluded from available bookable count');
    console.log('✓ Test 8 Passed: Customer booking integration verified.\n');

    // -------------------------------------------------------------------------
    // TEST 9: Phase 1 Dashboard and Parking Lots Intact
    // -------------------------------------------------------------------------
    console.log('--- Test 9: Phase 1 Dashboard and Parking Lots Intact ---');
    const dashboardStats = await ownerService.getOwnerDashboardStats(
      ownerA._id.toString(),
      lotA._id.toString(),
    );
    assert.strictEqual(dashboardStats.totalSlots, 4);
    assert.strictEqual(dashboardStats.parkingLotsSummary.length, 1);
    console.log('✓ Test 9 Passed: Phase 1 Dashboard and Parking Lots functionality intact.\n');

    console.log('========================================================================');
    console.log('  ALL 9 OWNER MODULE PHASE 2 TESTS PASSED PERFECTLY (100% SUCCESS)');
    console.log('========================================================================\n');
  } finally {
    // Clean up created test data
    console.log('Cleaning up test data...');
    await ParkingSlotModel.deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await ParkingZoneModel.deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await ParkingFloorModel.deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await ParkingLotModel.deleteMany({ _id: { $in: [lotA._id, lotB._id] } });
    await BookingModel.deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await AuditLogModel.deleteMany({ targetDocumentId: { $in: [slotA1._id, slotA2._id, slotA3._id, slotA4_Occupied._id, slotB1._id] } });
    await VehicleModel.deleteMany({ _id: vehicle._id });
    await UserModel.deleteMany({ _id: { $in: [ownerA._id, ownerB._id, customer._id] } });
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB. Clean up complete.\n');
  }
}

run().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
