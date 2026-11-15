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
import { NotificationModel } from '../src/models/Notification.js';
import { generateAccessToken } from '../src/utils/jwt.js';

console.log('========================================================================');
console.log('  ParkEase — Module 4, Phase 2: QR Scanner & Verification Test Suite');
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

  // Fetch canonical roles
  const ownerRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const staffRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
  const customerRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: 'CUSTOMER' });

  assert(ownerRole, 'Owner role must exist');
  assert(staffRole, 'Security staff role must exist');
  assert(customerRole, 'Customer role must exist');

  // 1. Setup Test Entities: Owner, 2 Facilities, Floor, Zone, Slots
  const testOwner = await (UserModel as mongoose.Model<User>).create({
    fullName: `Owner Scanner ${runId}`,
    email: `owner_scan_${runId}@parkease.com`,
    mobileNumber: `+9198101${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const lotA = await (ParkingLotModel as mongoose.Model<ParkingLot>).create({
    ownerId: testOwner._id,
    parkingName: `Airport Gate North ${runId}`,
    address: 'Terminal 2 Departure Road',
    contactNumber: '+919811122201',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380015',
    latitude: 23.0225,
    longitude: 72.5714,
    location: { type: 'Point', coordinates: [72.5714, 23.0225] },
    totalSlots: 20,
    availableSlots: 20,
    occupiedSlots: 0,
    parkingStatus: 'Active',
    isOpen24Hours: true,
  });

  const lotB = await (ParkingLotModel as mongoose.Model<ParkingLot>).create({
    ownerId: testOwner._id,
    parkingName: `Metro Hub Parking ${runId}`,
    address: 'Metro Station Boulevard',
    contactNumber: '+919811122202',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380015',
    latitude: 23.0335,
    longitude: 72.5814,
    location: { type: 'Point', coordinates: [72.5814, 23.0335] },
    totalSlots: 10,
    availableSlots: 10,
    occupiedSlots: 0,
    parkingStatus: 'Active',
    isOpen24Hours: true,
  });

  const floorA = await (ParkingFloorModel as any).create({
    parkingLotId: lotA._id,
    floorNumber: 1,
    floorName: 'Ground Level',
    totalSlots: 10,
    availableSlots: 10,
    occupiedSlots: 0,
  });

  const zoneA = await (ParkingZoneModel as any).create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneCode: 'ZA',
    zoneName: 'Zone Alpha',
    vehicleType: 'Car',
    totalSlots: 10,
    availableSlots: 10,
    occupiedSlots: 0,
  });

  const slot1 = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `A-101-${runId}`,
    slotLabel: 'Bay A-101',
    slotType: 'Standard',
    slotStatus: 'Available',
    qrIdentifier: `QR-SLOT-${runId}-1`,
  });

  const slot2 = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: `A-102-${runId}`,
    slotLabel: 'Bay A-102',
    slotType: 'Standard',
    slotStatus: 'Available',
    qrIdentifier: `QR-SLOT-${runId}-2`,
  });

  // 2. Setup Security Staff assigned to lotA
  const securityUser = await (UserModel as mongoose.Model<User>).create({
    fullName: `Officer Vikram ${runId}`,
    email: `officer_${runId}@parkeasesecurity.com`,
    mobileNumber: `+9198301${runId.slice(-5)}`,
    roleId: staffRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  await (SecurityStaffAssignmentModel as any).create({
    securityStaffId: securityUser._id,
    ownerId: testOwner._id,
    parkingLotId: lotA._id,
    assignedBy: testOwner._id,
    assignmentStatus: 'Active',
    assignedAt: new Date(),
    employeeId: `EMP-${runId}`,
  });

  const securityToken = generateAccessToken({
    userId: securityUser._id.toString(),
    roleId: staffRole._id.toString(),
  } as any);

  // 3. Setup Customer & Vehicle
  const customerUser = await (UserModel as mongoose.Model<User>).create({
    fullName: `Driver Rohan ${runId}`,
    email: `rohan_${runId}@gmail.com`,
    mobileNumber: `+9198401${runId.slice(-5)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const customerToken = generateAccessToken({
    userId: customerUser._id.toString(),
    roleId: customerRole._id.toString(),
  } as any);

  const testVehicle = await (VehicleModel as any).create({
    customerId: customerUser._id,
    vehicleNumber: `GJ01AB${runId.slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Honda',
    vehicleModel: 'City',
  });

  console.log('✓ Test Setup Complete: Security Officer assigned to Lot A, Customer & Vehicles initialized.\n');

  try {
    // =========================================================================
    // TEST 1: QR Verification Engine & Scoping Validation
    // =========================================================================
    console.log('--- TEST 1: QR Verification Engine & Facility Scoping ---');

    const bookingReference1 = `BK-${Date.now()}-01`;
    const qrPayload1 = `PE-PASS|${bookingReference1}|SLOT-${slot1.slotNumber}|TOKEN-${runId}`;

    const booking1 = await (BookingModel as mongoose.Model<Booking>).create({
      bookingReference: bookingReference1,
      customerId: customerUser._id,
      vehicleId: testVehicle._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      allocatedSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      paymentStatus: 'PAID',
      qrCode: qrPayload1,
      scheduledEntryTime: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
      scheduledExitTime: new Date(Date.now() + 110 * 60 * 1000), // in 2 hours
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 60,
      durationHours: 2,
      baseAmount: 120,
      totalAmount: 120,
      overstayRateAtBooking: 60,
    });

    // 1A. Scanned at correct facility (Lot A)
    const resVerifyA = await fetch(`${baseUrl}/security/qr/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        qrPayload: qrPayload1,
      }),
    });

    assert.strictEqual(resVerifyA.status, 200, `Expected 200 for valid QR verify, got ${resVerifyA.status}`);
    const jsonVerifyA = await resVerifyA.json();
    assert.strictEqual(jsonVerifyA.success, true);
    assert.strictEqual(jsonVerifyA.data.isAuthentic, true);
    assert.strictEqual(jsonVerifyA.data.eligibleForEntry, true);
    assert.strictEqual(jsonVerifyA.data.booking.bookingReference, bookingReference1);
    assert.strictEqual(jsonVerifyA.data.booking.vehicle.vehicleNumber, testVehicle.vehicleNumber);
    assert.strictEqual(jsonVerifyA.data.booking.hierarchy.slotNumber, slot1.slotNumber);
    console.log('✓ 1A PASSED: Scanned QR pass decoded and validated with full hierarchy details.');

    // 1B. Scanned at wrong facility (Lot B scoping rejection)
    const resVerifyB = await fetch(`${baseUrl}/security/qr/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotB._id.toString(),
        qrPayload: qrPayload1,
      }),
    });

    // Staff not assigned to Lot B -> 403 Forbidden
    assert.strictEqual(resVerifyB.status, 403, 'Expected 403 for cross-facility / unassigned lot operation');
    console.log('✓ 1B PASSED: Cross-facility scanning strictly blocked with 403 Forbidden.');

    // 1C. Ineligible Pass - Cancelled Booking
    const bookingCancelled = await (BookingModel as mongoose.Model<Booking>).create({
      bookingReference: `BK-${Date.now()}-CANC`,
      customerId: customerUser._id,
      vehicleId: testVehicle._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot2._id,
      currentSlotId: slot2._id,
      allocatedSlotId: slot2._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Cancelled',
      paymentStatus: 'REFUNDED',
      qrCode: `PE-PASS|BK-CANC|SLOT2|TOKEN`,
      scheduledEntryTime: new Date(Date.now() - 10 * 60 * 1000),
      scheduledExitTime: new Date(Date.now() + 60 * 60 * 1000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 60,
      durationHours: 1,
      baseAmount: 60,
      totalAmount: 60,
      overstayRateAtBooking: 60,
      cancellationReason: 'Customer changed travel plans',
    });

    const resVerifyCanc = await fetch(`${baseUrl}/security/qr/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        qrPayload: bookingCancelled.bookingReference,
      }),
    });

    const jsonVerifyCanc = await resVerifyCanc.json();
    assert.strictEqual(jsonVerifyCanc.data.eligibleForEntry, false);
    assert.strictEqual(jsonVerifyCanc.data.booking.bookingStatus, 'Cancelled');
    assert.match(jsonVerifyCanc.data.entryIneligibilityReason, /cancelled/i);
    console.log('✓ 1C PASSED: Cancelled booking QR verified and marked strictly ineligible for entry.');

    // =========================================================================
    // TEST 2: Physical Vehicle Entry Verification
    // =========================================================================
    console.log('\n--- TEST 2: Physical Vehicle Entry Verification ---');

    const resEntry = await fetch(`${baseUrl}/security/entry/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: booking1._id.toString(),
        entryMethod: 'QR Code',
        notes: 'Gate 1 camera verified pass',
      }),
    });

    assert.strictEqual(resEntry.status, 200, `Expected 200 for entry verify, got ${resEntry.status}`);
    const jsonEntry = await resEntry.json();
    assert.strictEqual(jsonEntry.success, true);
    assert.strictEqual(jsonEntry.data.bookingStatus, 'Active');
    assert.strictEqual(jsonEntry.data.slot.slotStatus, 'Occupied');
    assert.ok(jsonEntry.data.actualEntryTime);

    // Verify DB State
    const freshBooking1 = await (BookingModel as mongoose.Model<Booking>).findById(booking1._id);
    assert.strictEqual(freshBooking1?.bookingStatus, 'Active');
    assert.ok(freshBooking1?.actualEntryTime);

    const freshSlot1 = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(slot1._id);
    assert.strictEqual(freshSlot1?.slotStatus, 'Occupied');
    assert.strictEqual(freshSlot1?.currentBookingId?.toString(), booking1._id.toString());

    // Verify VehicleMovementLog
    const mLogEntry = await (VehicleMovementLogModel as any).findOne({ bookingId: booking1._id });
    assert.ok(mLogEntry, 'VehicleMovementLog must be created on entry');
    assert.strictEqual(mLogEntry.movementStatus, 'Vehicle Inside');
    assert.strictEqual(mLogEntry.entryMethod, 'QR Code');
    assert.strictEqual(mLogEntry.verifiedBy.toString(), securityUser._id.toString());

    // Verify BookingTimeline
    const timelineEntry = await (BookingTimelineModel as any).findOne({
      bookingId: booking1._id,
      eventCode: 'VEHICLE_ENTERED',
    });
    assert.ok(timelineEntry, 'BookingTimeline VEHICLE_ENTERED event must be recorded');

    // Verify AuditLog
    const auditEntry = await (AuditLogModel as any).findOne({
      targetDocumentId: booking1._id,
      actionCode: 'VEHICLE_ENTRY_VERIFIED',
    });
    assert.ok(auditEntry, 'AuditLog VEHICLE_ENTRY_VERIFIED record must be created');

    console.log('✓ TEST 2 PASSED: Vehicle entry atomic transition completed (Active, Occupied, MovementLog, Timeline, AuditLog).');

    // =========================================================================
    // TEST 3: Double Entry Prevention
    // =========================================================================
    console.log('\n--- TEST 3: Double Entry Prevention ---');

    const resDoubleEntry = await fetch(`${baseUrl}/security/entry/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: booking1._id.toString(),
      }),
    });

    assert.strictEqual(resDoubleEntry.status, 409, 'Expected 409 Conflict for double entry');
    const jsonDouble = await resDoubleEntry.json();
    assert.match(jsonDouble.message, /already entered/i);
    console.log('✓ TEST 3 PASSED: Double entry strictly rejected with 409 Conflict.');

    // =========================================================================
    // TEST 4: Physical Vehicle Exit Verification (Normal Duration)
    // =========================================================================
    console.log('\n--- TEST 4: Physical Vehicle Exit Verification ---');

    const resExit = await fetch(`${baseUrl}/security/exit/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: booking1._id.toString(),
        exitMethod: 'QR Code',
      }),
    });

    assert.strictEqual(resExit.status, 200, `Expected 200 for exit verify, got ${resExit.status}`);
    const jsonExit = await resExit.json();
    assert.strictEqual(jsonExit.success, true);
    assert.strictEqual(jsonExit.data.bookingStatus, 'Completed');
    assert.strictEqual(jsonExit.data.slot.slotStatus, 'Available');
    assert.ok(jsonExit.data.actualExitTime);

    // Verify DB State
    const freshBookingAfterExit = await (BookingModel as mongoose.Model<Booking>).findById(booking1._id);
    assert.strictEqual(freshBookingAfterExit?.bookingStatus, 'Completed');
    assert.ok(freshBookingAfterExit?.actualExitTime);

    const freshSlotAfterExit = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(slot1._id);
    assert.strictEqual(freshSlotAfterExit?.slotStatus, 'Available');
    assert.strictEqual(freshSlotAfterExit?.currentBookingId, null);

    // Verify Movement Log updated to 'Vehicle Exited'
    const mLogExit = await (VehicleMovementLogModel as any).findOne({ bookingId: booking1._id });
    assert.strictEqual(mLogExit.movementStatus, 'Vehicle Exited');
    assert.ok(mLogExit.exitTime);
    assert.strictEqual(mLogExit.exitVerifiedBy.toString(), securityUser._id.toString());

    // Verify Timeline
    const timelineExit = await (BookingTimelineModel as any).findOne({
      bookingId: booking1._id,
      eventCode: 'VEHICLE_EXITED',
    });
    assert.ok(timelineExit, 'BookingTimeline VEHICLE_EXITED event must be recorded');

    console.log('✓ TEST 4 PASSED: Normal vehicle exit verified (Completed, Bay Available, MovementLog updated).');

    // =========================================================================
    // TEST 5: Double Exit Prevention
    // =========================================================================
    console.log('\n--- TEST 5: Double Exit Prevention ---');

    const resDoubleExit = await fetch(`${baseUrl}/security/exit/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: booking1._id.toString(),
      }),
    });

    assert.strictEqual(resDoubleExit.status, 409, 'Expected 409 for double exit');
    const jsonDoubleExit = await resDoubleExit.json();
    assert.match(jsonDoubleExit.message, /already exited/i);
    console.log('✓ TEST 5 PASSED: Double exit strictly rejected with 409 Conflict.');

    // =========================================================================
    // TEST 6: Overstay Exit Verification & Strict Exit Block When Unpaid
    // =========================================================================
    console.log('\n--- TEST 6: Overstay Exit Verification & Strict Exit Block ---');

    const bookingReferenceOverstay = `BK-${Date.now()}-OVR`;
    const bookingOverstay = await (BookingModel as mongoose.Model<Booking>).create({
      bookingReference: bookingReferenceOverstay,
      customerId: customerUser._id,
      vehicleId: testVehicle._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot2._id,
      currentSlotId: slot2._id,
      allocatedSlotId: slot2._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Overstay',
      paymentStatus: 'PAID',
      qrCode: `PE-PASS|${bookingReferenceOverstay}|SLOT2|TOKEN`,
      scheduledEntryTime: new Date(Date.now() - 150 * 60 * 1000), // 2.5 hrs ago
      scheduledExitTime: new Date(Date.now() - 30 * 60 * 1000), // expired 30 mins ago
      actualEntryTime: new Date(Date.now() - 150 * 60 * 1000),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 60,
      durationHours: 2,
      baseAmount: 120,
      totalAmount: 120,
      overstayRateAtBooking: 60,
      overstayCharge: 60,
      overstayDurationMinutes: 30,
    });

    // Mark slot2 Occupied
    slot2.slotStatus = 'Occupied';
    slot2.currentBookingId = bookingOverstay._id as mongoose.Types.ObjectId;
    await slot2.save();

    // 6A. Verify QR detects Overstay and pending charge
    const resVerifyOverstay = await fetch(`${baseUrl}/security/qr/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        qrPayload: bookingReferenceOverstay,
      }),
    });

    const jsonVerifyOverstay = await resVerifyOverstay.json();
    assert.strictEqual(jsonVerifyOverstay.data.booking.bookingStatus, 'Overstay');
    assert.strictEqual(jsonVerifyOverstay.data.overstay.additionalChargePaymentStatus, 'UNPAID');
    const overstayDue = jsonVerifyOverstay.data.overstay.overstayCharge;
    assert.strictEqual(overstayDue, 60);
    assert.ok(jsonVerifyOverstay.data.availableActions.includes('COLLECT_OVERSTAY_CASH'));
    console.log('✓ 6A PASSED: Overstay status and pending fee correctly identified in QR summary.');

    // 6B. Exit attempt without paying overstay fee MUST be blocked
    const resBlockedExit = await fetch(`${baseUrl}/security/exit/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingOverstay._id.toString(),
      }),
    });

    assert.strictEqual(resBlockedExit.status, 409, 'Expected 409 Conflict for unpaid overstay exit');
    const jsonBlocked = await resBlockedExit.json();
    assert.match(jsonBlocked.message, /overstay charge.*must be settled/i);
    console.log('✓ 6B PASSED: Vehicle exit strictly blocked due to outstanding overstay charges.');

    // =========================================================================
    // TEST 7: Walk-in / Cash Fallback Settlement at Exit Barrier
    // =========================================================================
    console.log('\n--- TEST 7: Overstay Cash Settlement at Barrier ---');

    const resCash = await fetch(`${baseUrl}/security/overstay/collect-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingOverstay._id.toString(),
        amount: overstayDue,
        notes: 'Online payment failed at gate; cash collected by officer Vikram',
      }),
    });

    assert.strictEqual(resCash.status, 200, `Expected 200 for cash collection, got ${resCash.status}`);
    const jsonCash = await resCash.json();
    assert.strictEqual(jsonCash.success, true);
    assert.strictEqual(jsonCash.data.paymentStatus, 'SUCCESSFUL');
    assert.strictEqual(jsonCash.data.paymentMethod, 'CASH');

    // Verify Payment Record
    const paymentRecord = await (PaymentModel as any).findOne({
      bookingId: bookingOverstay._id,
      paymentTypeCode: 'OVERSTAY',
    });
    assert.ok(paymentRecord, 'Overstay Payment record must be created in DB');
    assert.strictEqual(paymentRecord.paymentStatus, 'SUCCESSFUL');
    assert.strictEqual(paymentRecord.paymentMethod, 'CASH');
    assert.strictEqual(paymentRecord.amount, overstayDue);

    // Verify Notification to Customer
    const notifRecord = await (NotificationModel as any).findOne({
      userId: customerUser._id,
      eventType: 'Overstay Cash Collected',
    });
    assert.ok(notifRecord, 'Customer in-app notification must be delivered');

    // 7B. Now exit verification MUST proceed smoothly
    const resExitOverstay = await fetch(`${baseUrl}/security/exit/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingOverstay._id.toString(),
      }),
    });

    assert.strictEqual(resExitOverstay.status, 200, `Expected 200 for overstay exit after payment, got ${resExitOverstay.status}`);
    const jsonExitOverstay = await resExitOverstay.json();
    assert.strictEqual(jsonExitOverstay.data.bookingStatus, 'Completed');
    assert.strictEqual(jsonExitOverstay.data.overstaySettled, true);
    assert.strictEqual(jsonExitOverstay.data.slot.slotStatus, 'Available');
    console.log('✓ TEST 7 PASSED: Cash collected, notification sent, and exit barrier successfully unlocked.');

    // =========================================================================
    // TEST 8: Customer Online Overstay Razorpay Payment Flow
    // =========================================================================
    console.log('\n--- TEST 8: Customer Online Overstay Razorpay Payment ---');

    const bookingReferenceOnlineOvr = `BK-${Date.now()}-ONLOVR`;
    const bookingOnlineOvr = await (BookingModel as mongoose.Model<Booking>).create({
      bookingReference: bookingReferenceOnlineOvr,
      customerId: customerUser._id,
      vehicleId: testVehicle._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      allocatedSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Overstay',
      paymentStatus: 'PAID',
      qrCode: `PE-PASS|${bookingReferenceOnlineOvr}|SLOT1|TOKEN`,
      scheduledEntryTime: new Date(Date.now() - 150 * 60 * 1000),
      scheduledExitTime: new Date(Date.now() - 30 * 60 * 1000),
      actualEntryTime: new Date(Date.now() - 150 * 60 * 1000),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 60,
      durationHours: 2,
      baseAmount: 120,
      totalAmount: 120,
      overstayRateAtBooking: 60,
      overstayCharge: 60,
      overstayDurationMinutes: 30,
    });

    // 8A. Customer initiates Razorpay order
    const resInitPay = await fetch(`${baseUrl}/customer/parking/bookings/${bookingOnlineOvr._id}/overstay/initiate-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
    });

    assert.strictEqual(resInitPay.status, 200, `Expected 200 for initiate overstay payment, got ${resInitPay.status}`);
    const jsonInitPay = await resInitPay.json();
    assert.strictEqual(jsonInitPay.success, true);
    assert.ok(jsonInitPay.data.orderId);
    assert.strictEqual(jsonInitPay.data.amount, 60);

    // 8B. Customer verifies signature (mocking valid Razorpay signature)
    const mockOrderId = jsonInitPay.data.orderId;
    const mockPaymentId = `pay_mock_${runId}`;
    const mockSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${mockOrderId}|${mockPaymentId}`)
      .digest('hex');

    const resVerifyPay = await fetch(`${baseUrl}/customer/parking/bookings/${bookingOnlineOvr._id}/overstay/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: mockOrderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: mockSignature,
      }),
    });

    assert.strictEqual(resVerifyPay.status, 200, `Expected 200 for verify payment, got ${resVerifyPay.status}`);
    const jsonVerifyPay = await resVerifyPay.json();
    assert.strictEqual(jsonVerifyPay.success, true);
    assert.strictEqual(jsonVerifyPay.data.paymentStatus, 'SUCCESSFUL');

    // 8C. Security officer completes exit now that online fee is settled
    const resOnlineExit = await fetch(`${baseUrl}/security/exit/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${securityToken}`,
      },
      body: JSON.stringify({
        parkingLotId: lotA._id.toString(),
        bookingId: bookingOnlineOvr._id.toString(),
      }),
    });

    assert.strictEqual(resOnlineExit.status, 200, `Expected 200 for exit after online payment, got ${resOnlineExit.status}`);
    const jsonOnlineExit = await resOnlineExit.json();
    assert.strictEqual(jsonOnlineExit.data.bookingStatus, 'Completed');
    assert.strictEqual(jsonOnlineExit.data.overstaySettled, true);
    console.log('✓ TEST 8 PASSED: Customer online Razorpay overstay flow verified and exit completed.');

    console.log('\n========================================================================');
    console.log('  ALL 8 MODULE 4 PHASE 2 TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } finally {
    // Cleanup test database documents
    console.log('Cleaning up test data...');
    await (BookingTimelineModel as any).deleteMany({ bookingId: { $in: [slot1._id, slot2._id] } });
    await (VehicleMovementLogModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (PaymentModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (BookingModel as any).deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await (NotificationModel as any).deleteMany({ userId: { $in: [customerUser._id, securityUser._id] } });
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
