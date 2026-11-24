import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
dotenv.config();

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
import { BarrierReaderModel } from '../src/models/BarrierReader.js';
import { BarrierEventModel } from '../src/models/BarrierEvent.js';
import { barrierService } from '../src/services/barrier.service.js';
import { securityService } from '../src/services/security.service.js';

async function runBarrierAndSimulatorTestSuite() {
  console.log('================================================================');
  console.log('  PARKEASE BARRIER SYSTEM & HARDWARE SIMULATOR INTEGRATION TEST ');
  console.log('================================================================\n');

  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  try {
    try {
      await BarrierReaderModel.collection.dropIndex('readerId_1');
      console.log('✓ Dropped legacy global readerId_1 index.');
    } catch {
      // index didn't exist or already dropped
    }
    const timestamp = Date.now();

    // 1. Setup Roles
    const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
    const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });

    if (!customerRole || !securityRole || !ownerRole) {
      throw new Error('Required roles not found in DB.');
    }

    // 2. Setup Users
    const customer = await UserModel.create({
      fullName: `Simulator Customer ${timestamp}`,
      email: `sim_cust_${timestamp}@test.com`,
      mobileNumber: `+9198${String(timestamp).slice(-8)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    const securityStaff = await UserModel.create({
      fullName: `Guard Simulator ${timestamp}`,
      email: `sim_guard_${timestamp}@test.com`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    const owner = await UserModel.create({
      fullName: `Owner Simulator ${timestamp}`,
      email: `sim_owner_${timestamp}@test.com`,
      mobileNumber: `+9196${String(timestamp).slice(-8)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 3. Setup Parking Facility with 2 Slots
    const parkingLot = await ParkingLotModel.create({
      ownerId: owner._id,
      parkingName: `Simulator Tech Park ${timestamp}`,
      description: 'Simulator test parking lot',
      address: '100 Automation Boulevard',
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
      parkingType: 'Commercial',
      totalFloors: 1,
      totalCapacity: 2,
      totalSlots: 2,
      availableCapacity: 2,
      availableSlots: 2,
      occupiedSlots: 0,
      reservedSlots: 0,
      baseHourlyRate: 50,
      overstayPenaltyPerHour: 100,
      facilityStatus: 'Approved',
      isPublished: true,
    });

    // Assign security staff to this facility
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
      totalSlots: 2,
      availableSlots: 2,
    });

    const zone = await ParkingZoneModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneName: 'Zone A',
      zoneCode: 'A',
      vehicleType: 'Car',
      totalSlots: 2,
      availableSlots: 2,
    });

    const slotA1 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: `S1-${timestamp}`,
      slotLabel: `Bay S1-${timestamp}`,
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `SLOT-QR-S1-${timestamp}`,
    });

    const slotA2 = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: `S2-${timestamp}`,
      slotLabel: `Bay S2-${timestamp}`,
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `SLOT-QR-S2-${timestamp}`,
    });

    console.log(`✓ Facility created: ${parkingLot.parkingName} with Slots ${slotA1.slotNumber} and ${slotA2.slotNumber}.`);

    // 4. Test Provisioning of Hardware Barrier Readers
    console.log('\n--- TEST 1: Barrier Readers Provisioning ---');
    const readers = await barrierService.ensureFacilityReaders(parkingLot._id.toString());
    console.log(`✓ Ensured ${readers.length} hardware readers in facility.`);
    const entryReader = readers.find((r) => r.readerType === 'ENTRY');
    const exitReader = readers.find((r) => r.readerType === 'EXIT');
    const bayReader1 = readers.find((r) => r.readerId === `SLOT-${slotA1.slotNumber}-READER`);
    const bayReader2 = readers.find((r) => r.readerId === `SLOT-${slotA2.slotNumber}-READER`);

    if (!entryReader || !exitReader || !bayReader1 || !bayReader2) {
      throw new Error('Barrier reader provisioning failed to produce entry, exit, or bay readers.');
    }
    console.log('✓ Entry, Exit, and Slot Bay readers verified in database.');

    // 5. Create an Advance Booking for Slot A1
    const vehicle = await VehicleModel.create({
      customerId: customer._id,
      vehicleNumber: `MH01AB${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Ioniq',
    });

    const bookingRef = `BK-SIM-${timestamp}`;
    const qrPassData = {
      bookingReference: bookingRef,
      parkingLotId: parkingLot._id.toString(),
      slotNumber: slotA1.slotNumber,
      licensePlate: vehicle.vehicleNumber,
    };
    const qrPassHash = crypto.createHash('sha256').update(JSON.stringify(qrPassData)).digest('hex');

    const now = new Date();
    const entry1 = new Date(now.getTime() - 10 * 60 * 1000);
    const exit1 = new Date(now.getTime() + 50 * 60 * 1000);

    const booking = await BookingModel.create({
      bookingReference: bookingRef,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slotA1._id,
      currentSlotId: slotA1._id,
      vehicleId: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: 'Car',
      bookingType: 'ONLINE',
      scheduledEntryTime: entry1,
      scheduledExitTime: exit1,
      originalScheduledExitTime: exit1,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 100,
      baseAmount: 100,
      totalAmount: 100,
      bookingStatus: 'Confirmed',
      paymentStatus: 'Completed',
      qrCode: bookingRef,
      qrPassData,
      qrPassHash,
      slotReassignmentStatus: 'NOT_REQUIRED',
    });

    await ParkingSlotModel.findByIdAndUpdate(slotA1._id, { slotStatus: 'Reserved' });

    console.log(`\n--- TEST 2: Entry Gate Scan & Vehicle Passage ---`);
    // Scan at ENTRY-GATE-01
    const entryScanResult = await barrierService.scanQrAndAuthorize({
      parkingLotId: parkingLot._id.toString(),
      readerId: 'ENTRY-GATE-01',
      qrPayload: bookingRef,
      source: 'SIMULATOR',
    });

    if (!entryScanResult.authorized || entryScanResult.barrierState !== 'OPEN') {
      throw new Error(`Entry gate scan rejected: ${entryScanResult.message}`);
    }
    console.log(`✓ Entry Gate QR Scan authorized: ${entryScanResult.message}`);

    // Confirm Passage at Entry Gate
    const entryPassage = await barrierService.confirmVehiclePassage({
      parkingLotId: parkingLot._id.toString(),
      readerId: 'ENTRY-GATE-01',
      bookingId: booking._id.toString(),
      direction: 'IN',
      source: 'SIMULATOR',
    });
    console.log(`✓ Entry vehicle passage confirmed: ${entryPassage.message}`);

    const bookingAfterEntry = await BookingModel.findById(booking._id);
    if (bookingAfterEntry?.bookingStatus !== 'Active' || !bookingAfterEntry.actualEntryTime) {
      throw new Error(`Booking expected Active with actualEntryTime, got ${bookingAfterEntry?.bookingStatus}`);
    }
    console.log('✓ Booking transitioned to Active upon Entry Gate passage.');

    // 6. Test Bay Barrier Controls: Wrong Bay vs Correct Bay
    console.log('\n--- TEST 3: Individual Bay Barrier Access ---');
    // Scan at wrong slot (Bay A2)
    const wrongBayScan = await barrierService.scanQrAndAuthorize({
      parkingLotId: parkingLot._id.toString(),
      readerId: `SLOT-${slotA2.slotNumber}-READER`,
      qrPayload: bookingRef,
      source: 'SIMULATOR',
    });

    if (wrongBayScan.authorized || wrongBayScan.errorCode !== 'WRONG_SLOT') {
      throw new Error(`Expected wrong slot rejection with WRONG_SLOT, got: ${JSON.stringify(wrongBayScan)}`);
    }
    console.log(`✓ Wrong bay correctly rejected with WRONG_SLOT: ${wrongBayScan.message}`);

    // Scan at designated bay (Bay A1)
    const rightBayScan = await barrierService.scanQrAndAuthorize({
      parkingLotId: parkingLot._id.toString(),
      readerId: `SLOT-${slotA1.slotNumber}-READER`,
      qrPayload: bookingRef,
      source: 'SIMULATOR',
    });

    if (!rightBayScan.authorized || rightBayScan.barrierState !== 'OPEN') {
      throw new Error(`Designated bay scan failed: ${rightBayScan.message}`);
    }
    console.log(`✓ Designated Bay lower barrier authorized: ${rightBayScan.message}`);

    // Check bay reader timer active
    const bay1ReaderDoc = await BarrierReaderModel.findOne({ readerId: `SLOT-${slotA1.slotNumber}-READER` });
    if (!bay1ReaderDoc?.autoCloseTimerActive || !bay1ReaderDoc.autoCloseDeadline) {
      throw new Error('Expected 5-minute auto-close deadline scheduled on bay barrier.');
    }
    console.log('✓ 5-minute auto-close timer scheduled on Bay barrier.');

    // Confirm vehicle passage into bay
    const bayPassage = await barrierService.confirmVehiclePassage({
      parkingLotId: parkingLot._id.toString(),
      readerId: `SLOT-${slotA1.slotNumber}-READER`,
      bookingId: booking._id.toString(),
      direction: 'IN',
      source: 'SIMULATOR',
    });
    console.log(`✓ Vehicle entered bay: ${bayPassage.message}`);

    const slotA1Doc = await ParkingSlotModel.findById(slotA1._id);
    if (slotA1Doc?.slotStatus !== 'Occupied') {
      throw new Error(`Expected Slot A1 status Occupied, got ${slotA1Doc?.slotStatus}`);
    }
    console.log('✓ Slot A1 moved from Reserved -> Occupied upon bay passage confirmation.');

    // 7. Bay Departure Scan (Second QR Scan at the same bay)
    console.log('\n--- TEST 4: Bay Departure (Second QR Scan) ---');
    const departureBayScan = await barrierService.scanQrAndAuthorize({
      parkingLotId: parkingLot._id.toString(),
      readerId: `SLOT-${slotA1.slotNumber}-READER`,
      qrPayload: bookingRef,
      source: 'SIMULATOR',
    });

    if (!departureBayScan.authorized || departureBayScan.barrierState !== 'OPEN') {
      throw new Error(`Bay departure scan failed: ${departureBayScan.message}`);
    }
    console.log(`✓ Bay departure second QR scan authorized: ${departureBayScan.message}`);

    // Confirm passage out of bay
    const departurePassage = await barrierService.confirmVehiclePassage({
      parkingLotId: parkingLot._id.toString(),
      readerId: `SLOT-${slotA1.slotNumber}-READER`,
      bookingId: booking._id.toString(),
      direction: 'OUT',
      source: 'SIMULATOR',
    });
    console.log(`✓ Bay departure passage confirmed: ${departurePassage.message}`);

    // Verify slot REMAINS OCCUPIED and booking REMAINS ACTIVE until main exit gate!
    const slotA1MidDeparture = await ParkingSlotModel.findById(slotA1._id);
    const bookingMidDeparture = await BookingModel.findById(booking._id);
    if (slotA1MidDeparture?.slotStatus !== 'Occupied' || bookingMidDeparture?.bookingStatus !== 'Active') {
      throw new Error(
        `Strict Bay Departure invariant failed! Slot must stay Occupied (is: ${slotA1MidDeparture?.slotStatus}), Booking must stay Active (is: ${bookingMidDeparture?.bookingStatus}) until main exit.`
      );
    }
    console.log('✓ Bay Departure Rule verified: Slot remains Occupied and booking remains Active while driving to main exit.');

    // 8. Main Exit Gate Scan & Release
    console.log('\n--- TEST 5: Main Exit Gate & Final Release ---');
    const exitScanResult = await barrierService.scanQrAndAuthorize({
      parkingLotId: parkingLot._id.toString(),
      readerId: 'EXIT-GATE-01',
      qrPayload: bookingRef,
      source: 'SIMULATOR',
    });

    if (!exitScanResult.authorized || exitScanResult.barrierState !== 'OPEN') {
      throw new Error(`Main exit scan failed: ${exitScanResult.message}`);
    }
    console.log(`✓ Exit gate scan authorized: ${exitScanResult.message}`);

    const exitPassage = await barrierService.confirmVehiclePassage({
      parkingLotId: parkingLot._id.toString(),
      readerId: 'EXIT-GATE-01',
      bookingId: booking._id.toString(),
      direction: 'OUT',
      source: 'SIMULATOR',
    });
    console.log(`✓ Exit passage confirmed: ${exitPassage.message}`);

    const finalBooking = await BookingModel.findById(booking._id);
    const finalSlotA1 = await ParkingSlotModel.findById(slotA1._id);

    if (finalBooking?.bookingStatus !== 'Completed' || !finalBooking.actualExitTime) {
      throw new Error(`Booking expected Completed at main exit, got ${finalBooking?.bookingStatus}`);
    }
    if (finalSlotA1?.slotStatus !== 'Available') {
      throw new Error(`Slot A1 expected Available after main exit, got ${finalSlotA1?.slotStatus}`);
    }
    console.log('✓ Booking Completed and Slot released to Available upon Main Exit passage.');

    // 9. Overstay Slot Conflict & Reassignment Test
    console.log('\n--- TEST 6: Overstay Slot Conflict & Atomic Reassignment ---');
    // Occupy Slot A1 with a simulated overstay vehicle
    await ParkingSlotModel.findByIdAndUpdate(slotA1._id, { slotStatus: 'Occupied' });
    // Slot A2 is Available

    const booking2Ref = `BK-REASSIGN-${timestamp}`;
    const entry2 = new Date(Date.now() - 5 * 60 * 1000);
    const exit2 = new Date(Date.now() + 55 * 60 * 1000);

    const booking2 = await BookingModel.create({
      bookingReference: booking2Ref,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slotA1._id,
      currentSlotId: slotA1._id,
      vehicleId: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: 'Car',
      bookingType: 'ONLINE',
      scheduledEntryTime: entry2,
      scheduledExitTime: exit2,
      originalScheduledExitTime: exit2,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 100,
      baseAmount: 100,
      totalAmount: 100,
      bookingStatus: 'Confirmed',
      paymentStatus: 'Completed',
      qrCode: booking2Ref,
      slotReassignmentStatus: 'NOT_REQUIRED',
    });

    // Customer 2 arrives at ENTRY-GATE-01
    const overstayConflictScan = await barrierService.scanQrAndAuthorize({
      parkingLotId: parkingLot._id.toString(),
      readerId: 'ENTRY-GATE-01',
      qrPayload: booking2Ref,
      source: 'SIMULATOR',
    });

    if (!overstayConflictScan.authorized) {
      throw new Error(`Expected reassignment scan to succeed, got: ${overstayConflictScan.message}`);
    }
    console.log(`✓ Entry scan handled overstay conflict: ${overstayConflictScan.message}`);

    const reassignedBooking = await BookingModel.findById(booking2._id);
    if (
      reassignedBooking?.slotReassignmentStatus !== 'REASSIGNED' ||
      reassignedBooking.currentSlotId.toString() !== slotA2._id.toString() ||
      reassignedBooking.originalSlotId?.toString() !== slotA1._id.toString()
    ) {
      throw new Error(
        `Reassignment failed: currentSlotId is ${reassignedBooking?.currentSlotId}, status is ${reassignedBooking?.slotReassignmentStatus}`
      );
    }
    console.log(`✓ Booking atomically reassigned from Bay ${slotA1.slotNumber} to Bay ${slotA2.slotNumber}.`);

    // 10. Walk-in Booking Integration Test
    console.log('\n--- TEST 7: Security Staff Walk-In Booking QR in Simulator ---');
    // Free up Slot A1 for walk-in
    await ParkingSlotModel.findByIdAndUpdate(slotA1._id, { slotStatus: 'Available' });

    const walkInResult = await securityService.createWalkInBooking({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      vehicleNumber: `MH02WK${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      durationHours: 2,
      customerName: 'Walk-in Driver',
      customerMobile: '+919876543210',
      cashCollected: true,
      cashAmountCollected: 115,
    });

    console.log(`✓ Walk-in booking generated: ${walkInResult.booking.bookingReference}`);

    // Walk-in receipt QR is scanned at ENTRY-GATE-01
    const walkInEntryScan = await barrierService.scanQrAndAuthorize({
      parkingLotId: parkingLot._id.toString(),
      readerId: 'ENTRY-GATE-01',
      qrPayload: walkInResult.booking.bookingReference,
      source: 'SIMULATOR',
    });

    if (!walkInEntryScan.authorized) {
      throw new Error(`Walk-in QR rejected at entry gate: ${walkInEntryScan.message}`);
    }
    console.log(`✓ Walk-in receipt QR authorized at Entry Gate: ${walkInEntryScan.message}`);

    // 11. Obstruction Sensor & Auto-Closure Deferral Test
    console.log('\n--- TEST 8: Safety Obstruction Sensor & Auto-Closure Deferral ---');
    await barrierService.sendBarrierCommand(
      `SLOT-${slotA1.slotNumber}-READER`,
      'OPEN',
      'SIMULATOR',
      parkingLot._id.toString(),
    );

    // Set obstruction
    await barrierService.setReaderObstruction(
      `SLOT-${slotA1.slotNumber}-READER`,
      true,
      parkingLot._id.toString(),
    );
    console.log('✓ Obstruction sensor activated on Bay A1.');

    // Attempt auto-close while obstructed
    const autoCloseResultWhileObstructed = await barrierService.forceAutoCloseBay(
      `SLOT-${slotA1.slotNumber}-READER`,
      parkingLot._id.toString(),
    );
    if (autoCloseResultWhileObstructed.closed) {
      throw new Error('Auto-close closed barrier while obstructed! Safety sensor failed.');
    }
    console.log(`✓ Auto-closure deferred safely: ${autoCloseResultWhileObstructed.message}`);

    // Clear obstruction
    await barrierService.setReaderObstruction(
      `SLOT-${slotA1.slotNumber}-READER`,
      false,
      parkingLot._id.toString(),
    );
    const autoCloseResultCleared = await barrierService.forceAutoCloseBay(
      `SLOT-${slotA1.slotNumber}-READER`,
      parkingLot._id.toString(),
    );
    if (!autoCloseResultCleared.closed) {
      throw new Error('Auto-close failed to close barrier after obstruction was cleared.');
    }
    console.log(`✓ Auto-closure successfully executed once obstruction cleared.`);

    console.log('\n================================================================');
    console.log('    ALL BARRIER & SIMULATOR INTEGRATION TESTS PASSED (8/8)      ');
    console.log('================================================================\n');
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB.');
  }
}

runBarrierAndSimulatorTestSuite().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
