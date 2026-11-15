import 'dotenv/config';
import assert from 'node:assert';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { UserModel, type User } from '../src/models/User.js';
import { RoleModel, type Role } from '../src/models/Role.js';
import { ParkingLotModel, type ParkingLot } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel, type ParkingSlot } from '../src/models/ParkingSlot.js';
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { BookingModel, type Booking } from '../src/models/Booking.js';
import { BookingTimelineModel } from '../src/models/BookingTimeline.js';
import { VehicleMovementLogModel } from '../src/models/VehicleMovementLog.js';
import { PaymentModel } from '../src/models/Payment.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { VehicleModel } from '../src/models/Vehicle.js';
import { generateAccessToken } from '../src/utils/jwt.js';

console.log('========================================================================');
console.log('  ParkEase — Module 4, Phase 3: Manual Vehicle Lookup Test Suite');
console.log('========================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  // Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  const runId = Date.now().toString().slice(-6);

  // Fetch roles
  const ownerRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const staffRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
  const customerRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: 'CUSTOMER' });

  assert(ownerRole, 'Owner role must exist');
  assert(staffRole, 'Security staff role must exist');
  assert(customerRole, 'Customer role must exist');

  // 1. Setup Test Users: Owner, Staff, Customer
  const testOwner = await (UserModel as mongoose.Model<User>).create({
    fullName: `Owner Manual ${runId}`,
    email: `owner_man_${runId}@parkease.com`,
    mobileNumber: `+9198201${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const securityUser = await (UserModel as mongoose.Model<User>).create({
    fullName: `Guard Raman ${runId}`,
    email: `guard_raman_${runId}@parkease.com`,
    mobileNumber: `+9198301${runId.slice(-5)}`,
    roleId: staffRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const customerUser = await (UserModel as mongoose.Model<User>).create({
    fullName: `Aarav Mehta ${runId}`,
    email: `aarav_${runId}@example.com`,
    mobileNumber: `+9198401${runId.slice(-5)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const staffToken = generateAccessToken({
    userId: securityUser._id.toString(),
    roleCode: 'SECURITY',
    roleId: staffRole._id.toString(),
    email: securityUser.email,
  });

  // 2. Setup Test Facilities: Lot A (Assigned) and Lot B (Unassigned)
  const lotA = await (ParkingLotModel as mongoose.Model<ParkingLot>).create({
    ownerId: testOwner._id,
    parkingName: `Metro Terminal Gate ${runId}`,
    address: 'Gate 4, Station Road',
    contactNumber: '+919811122201',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380001',
    latitude: 23.0225,
    longitude: 72.5714,
    location: { type: 'Point', coordinates: [72.5714, 23.0225] },
    parkingStatus: 'Active',
    isOpen24Hours: true,
    totalSlots: 10,
    availableSlots: 10,
    occupiedSlots: 0,
    pricingPerHour: 50,
  });

  const lotB = await (ParkingLotModel as mongoose.Model<ParkingLot>).create({
    ownerId: testOwner._id,
    parkingName: `Airport Terminal 2 ${runId}`,
    address: 'Departure Way',
    contactNumber: '+919811122202',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380002',
    latitude: 23.0335,
    longitude: 72.5814,
    location: { type: 'Point', coordinates: [72.5814, 23.0335] },
    parkingStatus: 'Active',
    isOpen24Hours: true,
    totalSlots: 10,
    availableSlots: 10,
    occupiedSlots: 0,
    pricingPerHour: 80,
  });

  // Assign staff to Lot A ONLY
  await SecurityStaffAssignmentModel.create({
    securityStaffId: securityUser._id,
    parkingLotId: lotA._id,
    ownerId: testOwner._id,
    assignedBy: testOwner._id,
    employeeId: `SEC-${runId}`,
    assignmentStatus: 'Active',
    assignedAt: new Date(),
  });

  // Setup Floor, Zone, and Slots in Lot A
  const floorA = await ParkingFloorModel.create({
    parkingLotId: lotA._id,
    floorName: 'Ground Floor',
    floorNumber: 1,
    totalSlots: 4,
    status: 'Active',
  });

  const zoneA = await ParkingZoneModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneName: 'Zone Alpha',
    zoneCode: 'ZA',
    totalSlots: 4,
    status: 'Active',
  });

  const slot1 = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `A-${runId}-1`,
    slotLabel: `Bay A1`,
    slotType: 'Standard',
    slotStatus: 'Available',
    qrIdentifier: `QR-SLOT-${runId}-1`,
    supportedVehicleTypes: ['Car'],
  });

  const slot2 = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `A-${runId}-2`,
    slotLabel: `Bay A2`,
    slotType: 'Standard',
    slotStatus: 'Available',
    qrIdentifier: `QR-SLOT-${runId}-2`,
    supportedVehicleTypes: ['Car'],
  });

  const slot3 = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `A-${runId}-3`,
    slotLabel: `Bay A3`,
    slotType: 'Standard',
    slotStatus: 'Available',
    qrIdentifier: `QR-SLOT-${runId}-3`,
    supportedVehicleTypes: ['Car'],
  });

  // Setup Test Vehicles
  const plate1 = `GJ01AB${runId.slice(-4)}`;
  const vehicle1 = await VehicleModel.create({
    customerId: customerUser._id,
    vehicleNumber: plate1,
    vehicleType: 'Car',
    vehicleBrand: 'Hyundai',
    vehicleModel: 'Creta',
    make: 'Hyundai',
    model: 'Creta',
    color: 'White',
  });

  const plate2 = `GJ01CD${runId.slice(-4)}`;
  const vehicle2 = await VehicleModel.create({
    customerId: customerUser._id,
    vehicleNumber: plate2,
    vehicleType: 'Car',
    vehicleBrand: 'Tata',
    vehicleModel: 'Nexon',
    make: 'Tata',
    model: 'Nexon',
    color: 'Grey',
  });

  // Setup Test Bookings
  const now = new Date();
  const scheduledIn1 = new Date(now.getTime() - 10 * 60 * 1000);
  const scheduledOut1 = new Date(now.getTime() + 50 * 60 * 1000);

  // Booking 1: Confirmed (Ready for Entry)
  const bookingConfirmed = await (BookingModel as mongoose.Model<Booking>).create({
    bookingReference: `BK-CONF-${runId}`,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    currentSlotId: slot1._id,
    originalSlotId: slot1._id,
    vehicleId: vehicle1._id,
    bookingType: 'ONLINE',
    bookingStatus: 'Confirmed',
    scheduledEntryTime: scheduledIn1,
    scheduledExitTime: scheduledOut1,
    bookingDurationMinutes: 60,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 50,
    baseAmount: 50,
    totalAmount: 50,
    qrCodePayload: `PARKEASE:BK-CONF-${runId}`,
  });

  // Initial Payment for Booking 1
  await (PaymentModel as any).create({
    bookingId: bookingConfirmed._id,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    paymentReference: `PAY-INIT-${runId}-1`,
    paymentType: 'Parking Booking',
    paymentTypeCode: 'BOOKING',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'SUCCESSFUL',
    amount: 50,
  });

  // Booking 2: Active (Currently inside, ready for exit)
  const scheduledIn2 = new Date(now.getTime() - 40 * 60 * 1000);
  const scheduledOut2 = new Date(now.getTime() + 20 * 60 * 1000);
  const bookingActive = await (BookingModel as mongoose.Model<Booking>).create({
    bookingReference: `BK-ACT-${runId}`,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    currentSlotId: slot2._id,
    originalSlotId: slot2._id,
    vehicleId: vehicle2._id,
    bookingType: 'ONLINE',
    bookingStatus: 'Active',
    scheduledEntryTime: scheduledIn2,
    scheduledExitTime: scheduledOut2,
    actualEntryTime: scheduledIn2,
    bookingDurationMinutes: 60,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 50,
    baseAmount: 50,
    totalAmount: 50,
    qrCodePayload: `PARKEASE:BK-ACT-${runId}`,
  });

  await slot2.updateOne({ slotStatus: 'Occupied', currentBookingId: bookingActive._id });

  await (PaymentModel as any).create({
    bookingId: bookingActive._id,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    paymentReference: `PAY-INIT-${runId}-2`,
    paymentType: 'Parking Booking',
    paymentTypeCode: 'BOOKING',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'SUCCESSFUL',
    amount: 50,
  });

  await VehicleMovementLogModel.create({
    bookingId: bookingActive._id,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    vehicleId: vehicle2._id,
    slotId: slot2._id,
    vehicleNumberSnapshot: plate2,
    entryTime: scheduledIn2,
    entryMethod: 'QR Code',
    movementStatus: 'Vehicle Inside',
    gracePeriodEndsAt: new Date(scheduledOut2.getTime() + 15 * 60 * 1000),
    stayDurationMinutes: 0,
    overstayMinutes: 0,
    gateBarrierId: 'GATE-ENTRY-1',
  });

  // Booking 3: Overstay (Scheduled exit 30 mins ago, 1 hr billable overstay)
  const scheduledIn3 = new Date(now.getTime() - 90 * 60 * 1000);
  const scheduledOut3 = new Date(now.getTime() - 30 * 60 * 1000);
  const bookingOverstay = await (BookingModel as mongoose.Model<Booking>).create({
    bookingReference: `BK-OVR-${runId}`,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    currentSlotId: slot3._id,
    originalSlotId: slot3._id,
    vehicleId: vehicle1._id,
    bookingType: 'ONLINE',
    bookingStatus: 'Overstay',
    scheduledEntryTime: scheduledIn3,
    scheduledExitTime: scheduledOut3,
    actualEntryTime: scheduledIn3,
    bookingDurationMinutes: 60,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 50,
    baseAmount: 50,
    totalAmount: 50,
    overstayCharge: 50,
    qrCodePayload: `PARKEASE:BK-OVR-${runId}`,
  });

  await slot3.updateOne({ slotStatus: 'Occupied', currentBookingId: bookingOverstay._id });

  await (PaymentModel as any).create({
    bookingId: bookingOverstay._id,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    paymentReference: `PAY-INIT-${runId}-3`,
    paymentType: 'Parking Booking',
    paymentTypeCode: 'BOOKING',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'SUCCESSFUL',
    amount: 50,
  });

  await VehicleMovementLogModel.create({
    bookingId: bookingOverstay._id,
    customerId: customerUser._id,
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    vehicleId: vehicle1._id,
    slotId: slot3._id,
    vehicleNumberSnapshot: plate1,
    entryTime: scheduledIn3,
    entryMethod: 'QR Code',
    movementStatus: 'Vehicle Inside',
    gracePeriodEndsAt: new Date(scheduledOut3.getTime() + 15 * 60 * 1000),
    stayDurationMinutes: 0,
    overstayMinutes: 30,
    gateBarrierId: 'GATE-ENTRY-1',
  });

  try {
    // =========================================================================
    // TEST 1: Multi-field Search (Vehicle Plate, Booking Reference, Name, Mobile)
    // =========================================================================
    console.log('TEST 1: Testing Multi-field Search on /api/v1/security/manual-lookup...');

    // 1A. Search by Vehicle Number
    const resSearchPlate = await fetch(
      `${baseUrl}/security/manual-lookup?parkingLotId=${lotA._id.toString()}&query=${plate1}`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    assert.strictEqual(resSearchPlate.status, 200, 'Search by plate must return 200');
    const jsonPlate = await resSearchPlate.json();
    assert.strictEqual(jsonPlate.success, true);
    assert(jsonPlate.data.bookings.length >= 2, 'Should find at least 2 bookings for vehicle 1');
    assert.strictEqual(jsonPlate.data.bookings[0].vehicle.vehicleNumber, plate1);
    console.log(`  ✓ Subtest 1A: Search by vehicle plate (${plate1}) found ${jsonPlate.data.bookings.length} records.`);

    // 1B. Search by Booking Reference
    const resSearchRef = await fetch(
      `${baseUrl}/security/manual-lookup?parkingLotId=${lotA._id.toString()}&query=BK-CONF-${runId}`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    assert.strictEqual(resSearchRef.status, 200);
    const jsonRef = await resSearchRef.json();
    assert.strictEqual(jsonRef.data.bookings.length, 1);
    assert.strictEqual(jsonRef.data.bookings[0].bookingReference, `BK-CONF-${runId}`);
    console.log(`  ✓ Subtest 1B: Search by booking reference (BK-CONF-${runId}) found exact match.`);

    // 1C. Search by Customer Name
    const resSearchName = await fetch(
      `${baseUrl}/security/manual-lookup?parkingLotId=${lotA._id.toString()}&query=Aarav`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    assert.strictEqual(resSearchName.status, 200);
    const jsonName = await resSearchName.json();
    assert(jsonName.data.bookings.length >= 3, 'Search by customer name should find all test bookings');
    console.log(`  ✓ Subtest 1C: Search by customer name found ${jsonName.data.bookings.length} records.`);

    // 1D. Search by Customer Mobile Number
    const resSearchPhone = await fetch(
      `${baseUrl}/security/manual-lookup?parkingLotId=${lotA._id.toString()}&query=${customerUser.mobileNumber.slice(-6)}`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    assert.strictEqual(resSearchPhone.status, 200);
    const jsonPhone = await resSearchPhone.json();
    assert(jsonPhone.data.bookings.length >= 3, 'Search by phone number should match');
    console.log(`  ✓ Subtest 1D: Search by mobile number verified.`);
    console.log('✓ TEST 1 PASSED: Multi-criteria search operates across all 4 canonical fields.\n');

    // =========================================================================
    // TEST 2: Facility Isolation (Unassigned Lot Access Strictly Blocked)
    // =========================================================================
    console.log('TEST 2: Verifying Facility Isolation & Access Boundaries...');
    const resForbidden = await fetch(
      `${baseUrl}/security/manual-lookup?parkingLotId=${lotB._id.toString()}`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    assert.strictEqual(resForbidden.status, 403, `Accessing unassigned lot must return 403, got ${resForbidden.status}`);
    const jsonForbidden = await resForbidden.json();
    assert.strictEqual(jsonForbidden.success, false);
    console.log(`✓ TEST 2 PASSED: Guard blocked from unassigned facility (${jsonForbidden.message}).\n`);

    // =========================================================================
    // TEST 3: Status Filters & Summary Counters
    // =========================================================================
    console.log('TEST 3: Verifying Status Filtering & Aggregation Counters...');
    const resFilterConfirmed = await fetch(
      `${baseUrl}/security/manual-lookup?parkingLotId=${lotA._id.toString()}&status=Confirmed`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    const jsonFilterConfirmed = await resFilterConfirmed.json();
    assert.strictEqual(resFilterConfirmed.status, 200);
    assert(jsonFilterConfirmed.data.bookings.every((b: any) => b.bookingStatus === 'Confirmed'));
    assert(jsonFilterConfirmed.data.summary.total >= 3);
    assert(jsonFilterConfirmed.data.summary.confirmed >= 1);
    assert(jsonFilterConfirmed.data.summary.active >= 1);
    assert(jsonFilterConfirmed.data.summary.overstay >= 1);
    console.log(`  ✓ Filter summary: Total=${jsonFilterConfirmed.data.summary.total}, Confirmed=${jsonFilterConfirmed.data.summary.confirmed}, Active=${jsonFilterConfirmed.data.summary.active}, Overstay=${jsonFilterConfirmed.data.summary.overstay}`);
    console.log('✓ TEST 3 PASSED: Status filter and metrics summary confirmed.\n');

    // =========================================================================
    // TEST 4: Manual Entry Verification for Confirmed Booking
    // =========================================================================
    console.log('TEST 4: Authorizing Manual Gate Entry for Confirmed Booking...');
    const resManualEntry = await fetch(`${baseUrl}/security/manual-lookup/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingConfirmed._id.toString(),
        reason: 'Customer cannot display the QR Code.',
        notes: 'Driver battery depleted, DL verified at North Gate.',
      }),
    });

    assert.strictEqual(resManualEntry.status, 200, `Manual entry must return 200, got ${resManualEntry.status}`);
    const jsonManualEntry = await resManualEntry.json();
    assert.strictEqual(jsonManualEntry.success, true);
    assert.strictEqual(jsonManualEntry.data.bookingStatus, 'Active');
    assert.strictEqual(jsonManualEntry.data.slot.slotStatus, 'Occupied');

    // Verify DB state
    const dbBooking1 = await BookingModel.findById(bookingConfirmed._id);
    assert.strictEqual(dbBooking1?.bookingStatus, 'Active');
    assert(dbBooking1?.actualEntryTime !== null);

    const dbSlot1 = await ParkingSlotModel.findById(slot1._id);
    assert.strictEqual(dbSlot1?.slotStatus, 'Occupied');
    assert.strictEqual(dbSlot1?.currentBookingId?.toString(), bookingConfirmed._id.toString());

    // Verify Movement Log entryMethod
    const dbMovement1 = await VehicleMovementLogModel.findOne({ bookingId: bookingConfirmed._id });
    assert(dbMovement1, 'Movement log must be created');
    assert.strictEqual(dbMovement1.entryMethod, 'Manual Verification');

    // Verify Timeline Event
    const dbTimeline1 = await BookingTimelineModel.findOne({
      bookingId: bookingConfirmed._id,
      eventCode: 'MANUAL_ENTRY_APPROVED',
    });
    assert(dbTimeline1, 'MANUAL_ENTRY_APPROVED timeline event must be written');
    console.log('✓ TEST 4 PASSED: Manual gate entry successfully verified, slot occupied, movement & timeline recorded.\n');

    // =========================================================================
    // TEST 5: Double Entry Prevention
    // =========================================================================
    console.log('TEST 5: Testing Double Entry Prevention on already checked-in booking...');
    const resDoubleEntry = await fetch(`${baseUrl}/security/manual-lookup/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingConfirmed._id.toString(),
        reason: 'Attempt duplicate manual entry',
      }),
    });

    assert.strictEqual(resDoubleEntry.status, 409, `Double entry must return 409, got ${resDoubleEntry.status}`);
    const jsonDoubleEntry = await resDoubleEntry.json();
    assert.strictEqual(jsonDoubleEntry.success, false);
    console.log(`✓ TEST 5 PASSED: Double entry prevented with 409 (${jsonDoubleEntry.message}).\n`);

    // =========================================================================
    // TEST 6: Manual Exit Verification for Active Booking
    // =========================================================================
    console.log('TEST 6: Authorizing Manual Gate Exit for Active Booking...');
    const resManualExit = await fetch(`${baseUrl}/security/manual-lookup/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingActive._id.toString(),
        reason: 'Physical QR receipt is lost or damaged.',
        notes: 'Driver vehicle verified at exit barrier.',
      }),
    });

    assert.strictEqual(resManualExit.status, 200, `Manual exit must return 200, got ${resManualExit.status}`);
    const jsonManualExit = await resManualExit.json();
    assert.strictEqual(jsonManualExit.success, true);
    assert.strictEqual(jsonManualExit.data.bookingStatus, 'Completed');
    assert.strictEqual(jsonManualExit.data.slot.slotStatus, 'Available');
    assert(jsonManualExit.data.stayDurationMinutes >= 0);

    // Verify DB state
    const dbBooking2 = await BookingModel.findById(bookingActive._id);
    assert.strictEqual(dbBooking2?.bookingStatus, 'Completed');
    assert(dbBooking2?.actualExitTime !== null);

    const dbSlot2 = await ParkingSlotModel.findById(slot2._id);
    assert.strictEqual(dbSlot2?.slotStatus, 'Available');
    assert.strictEqual(dbSlot2?.currentBookingId, null);

    // Verify Movement Log exitMethod
    const dbMovement2 = await VehicleMovementLogModel.findOne({ bookingId: bookingActive._id });
    assert(dbMovement2, 'Movement log must exist');
    assert.strictEqual(dbMovement2.exitMethod, 'Manual Verification');
    assert.strictEqual(dbMovement2.movementStatus, 'Vehicle Exited');
    console.log('✓ TEST 6 PASSED: Manual gate exit authorized, slot released to Available, stay duration computed.\n');

    // =========================================================================
    // TEST 7: Double Exit Prevention
    // =========================================================================
    console.log('TEST 7: Testing Double Exit Prevention on already completed booking...');
    const resDoubleExit = await fetch(`${baseUrl}/security/manual-lookup/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingActive._id.toString(),
        reason: 'Attempt duplicate manual exit',
      }),
    });

    assert.strictEqual(resDoubleExit.status, 409, `Double exit must return 409, got ${resDoubleExit.status}`);
    const jsonDoubleExit = await resDoubleExit.json();
    assert.strictEqual(jsonDoubleExit.success, false);
    console.log(`✓ TEST 7 PASSED: Double exit prevented with 409 (${jsonDoubleExit.message}).\n`);

    // =========================================================================
    // TEST 8: Overstay Unpaid Exit Barrier Strictly Enforced
    // =========================================================================
    console.log('TEST 8: Testing Overstay Unpaid Exit Blockade...');
    const resOverstayBlocked = await fetch(`${baseUrl}/security/manual-lookup/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingOverstay._id.toString(),
        reason: 'Attempt manual exit without paying overstay fee',
      }),
    });

    assert.strictEqual(resOverstayBlocked.status, 409, `Unpaid overstay must return 409, got ${resOverstayBlocked.status}`);
    const jsonOverstayBlocked = await resOverstayBlocked.json();
    assert.strictEqual(jsonOverstayBlocked.success, false);
    console.log(`✓ TEST 8 PASSED: Exit strictly blocked due to pending overstay fee (${jsonOverstayBlocked.message}).\n`);

    // =========================================================================
    // TEST 9: Overstay Cash Collection and Subsequent Exit Authorization
    // =========================================================================
    console.log('TEST 9: Collecting Cash for Overstay Fee at Barrier and Unlocking Exit...');
    const resCashCollect = await fetch(`${baseUrl}/security/overstay/collect-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingOverstay._id.toString(),
        amount: 50,
        notes: 'Customer paid ₹50 in cash at exit barrier.',
      }),
    });

    assert.strictEqual(resCashCollect.status, 200, `Cash collection must return 200, got ${resCashCollect.status}`);
    const jsonCash = await resCashCollect.json();
    assert.strictEqual(jsonCash.success, true);
    assert.strictEqual(jsonCash.data.paymentStatus, 'SUCCESSFUL');
    assert.strictEqual(jsonCash.data.additionalChargePaymentStatus, 'PAID');
    console.log(`  ✓ Cash of ₹${jsonCash.data.amount} collected, payment ref: ${jsonCash.data.paymentReference}`);

    // Now complete manual exit after cash payment
    const resExitAfterCash = await fetch(`${baseUrl}/security/manual-lookup/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingOverstay._id.toString(),
        reason: 'Overstay settled via cash at gate barrier.',
      }),
    });

    assert.strictEqual(resExitAfterCash.status, 200, `Exit after cash must return 200, got ${resExitAfterCash.status}`);
    const jsonExitAfterCash = await resExitAfterCash.json();
    assert.strictEqual(jsonExitAfterCash.data.bookingStatus, 'Completed');
    assert.strictEqual(jsonExitAfterCash.data.overstaySettled, true);
    assert.strictEqual(jsonExitAfterCash.data.slot.slotStatus, 'Available');
    console.log('✓ TEST 9 PASSED: Cash collected at barrier, overstay cleared, exit completed and slot released.\n');

    // =========================================================================
    // TEST 10: Operational Rejection & Booking Details/Timeline Inspection
    // =========================================================================
    console.log('TEST 10: Logging Operational Rejection & Fetching Full Booking Inspection...');

    // 10A. Operational Rejection Logging
    const resReject = await fetch(`${baseUrl}/security/manual-lookup/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingConfirmed._id.toString(),
        actionType: 'ENTRY',
        reason: 'Vehicle license plate mismatch against booking record.',
        notes: 'Driver brought vehicle GJ01ZZ9999 instead of registered vehicle.',
      }),
    });

    assert.strictEqual(resReject.status, 200);
    const jsonReject = await resReject.json();
    assert.strictEqual(jsonReject.success, true);

    const dbAuditReject = await AuditLogModel.findOne({
      targetDocumentId: bookingConfirmed._id,
      actionCode: 'MANUAL_ENTRY_REJECTED',
    });
    assert(dbAuditReject, 'MANUAL_ENTRY_REJECTED audit log must exist');
    console.log('  ✓ Subtest 10A: Operational rejection recorded in system audit trail.');

    // 10B. Full Details & Timeline Retrieval
    const resDetails = await fetch(
      `${baseUrl}/security/manual-lookup/${bookingConfirmed._id.toString()}?parkingLotId=${lotA._id.toString()}`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    assert.strictEqual(resDetails.status, 200);
    const jsonDetails = await resDetails.json();
    assert.strictEqual(jsonDetails.success, true);
    assert.strictEqual(jsonDetails.data.bookingReference, `BK-CONF-${runId}`);
    assert(jsonDetails.data.timeline.length >= 1, 'Should have timeline events');
    assert(jsonDetails.data.movementLogs.length >= 1, 'Should have movement logs');
    assert(jsonDetails.data.payments.length >= 1, 'Should have payment history');
    console.log(`  ✓ Subtest 10B: Full details retrieved: ${jsonDetails.data.timeline.length} timeline events, ${jsonDetails.data.movementLogs.length} movement logs, ${jsonDetails.data.payments.length} payments.`);

    console.log('✓ TEST 10 PASSED: Operational rejection and full inspection details verified.\n');

    console.log('========================================================================');
    console.log('  ALL 10 MODULE 4 PHASE 3 TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } finally {
    console.log('Cleaning up test data...');
    await (BookingTimelineModel as any).deleteMany({ bookingId: { $in: [bookingConfirmed._id, bookingActive._id, bookingOverstay._id] } });
    await (VehicleMovementLogModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (PaymentModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (BookingModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (AuditLogModel as any).deleteMany({ userId: { $in: [customerUser._id, securityUser._id, testOwner._id] } });
    await (SecurityStaffAssignmentModel as any).deleteMany({ securityStaffId: securityUser._id });
    await (ParkingSlotModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (ParkingZoneModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (ParkingFloorModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (ParkingLotModel as any).deleteMany({ _id: { $in: [lotA._id, lotB._id] } });
    await (VehicleModel as any).deleteMany({ customerId: customerUser._id });
    await (UserModel as any).deleteMany({ _id: { $in: [testOwner._id, securityUser._id, customerUser._id] } });

    server.close();
    await mongoose.disconnect();
    console.log('✓ Cleanup complete.');
  }
}

run().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
