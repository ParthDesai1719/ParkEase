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
import { VehicleModel } from '../src/models/Vehicle.js';
import { VehicleMovementLogModel } from '../src/models/VehicleMovementLog.js';
import { BookingTimelineModel } from '../src/models/BookingTimeline.js';
import { PaymentModel } from '../src/models/Payment.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('--- Starting Vehicle Movement Logs (Phase 5) & Vehicle Uniqueness Automated Test Suite ---');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  try {
    const timestamp = Date.now();

    // 1. Fetch system roles
    const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
    const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });

    if (!securityRole || !customerRole || !ownerRole) {
      throw new Error('Required roles not found in database.');
    }

    // 2. Create test Owner
    const owner = await UserModel.create({
      fullName: `Test Owner ${timestamp}`,
      email: `owner_${timestamp}@movementlogs.test`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });

    // 3. Create test Facility
    const lot = await ParkingLotModel.create({
      parkingName: `Grand Terminal Park ${timestamp}`,
      ownerId: owner._id,
      address: '100 Terminal Boulevard',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400099',
      latitude: 19.076,
      longitude: 72.8777,
      location: { type: 'Point', coordinates: [72.8777, 19.076] },
      contactNumber: '+919800000001',
      totalFloors: 1,
      totalCapacity: 50,
      availableSlots: 48,
      occupiedSlots: 2,
      pricingPlans: {
        fourWheelerRatePerHour: 60,
        twoWheelerRatePerHour: 30,
      },
      status: 'Active',
      is24x7: true,
      gracePeriodMinutes: 15,
    });

    const floor = await ParkingFloorModel.create({
      parkingLotId: lot._id,
      floorName: 'Ground Floor',
      floorNumber: 0,
      totalSlotsOnFloor: 20,
      availableSlotsOnFloor: 18,
      floorStatus: 'Active',
    });

    const zone = await ParkingZoneModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneName: 'Zone Alpha',
      zoneCode: 'ZA',
      totalSlotsInZone: 20,
      availableSlotsInZone: 18,
      zoneStatus: 'Active',
    });

    const slot1 = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'ZA-01',
      slotLabel: 'Bay 1',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Occupied',
      qrIdentifier: `SLOT-${timestamp}-1`,
    });

    const slot2 = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'ZA-02',
      slotLabel: 'Bay 2',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `SLOT-${timestamp}-2`,
    });

    // 4. Create Staff Users
    const staff = await UserModel.create({
      fullName: `Officer Vikrant ${timestamp}`,
      email: `vikrant_${timestamp}@gate.test`,
      mobileNumber: `+9196${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      employeeId: `SEC-${String(timestamp).slice(-4)}`,
    });

    const exitStaff = await UserModel.create({
      fullName: `Officer Rohit ${timestamp}`,
      email: `rohit_${timestamp}@gate.test`,
      mobileNumber: `+9195${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      employeeId: `SEC-${String(timestamp + 1).slice(-4)}`,
    });

    const unassignedStaff = await UserModel.create({
      fullName: `Unassigned Guard ${timestamp}`,
      email: `unassigned_${timestamp}@gate.test`,
      mobileNumber: `+9194${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
    });

    // Assign staff to facility
    await SecurityStaffAssignmentModel.create([
      {
        parkingLotId: lot._id,
        securityStaffId: staff._id,
        ownerId: owner._id,
        assignedBy: owner._id,
        shift: 'Morning',
        assignmentStatus: 'Active',
      },
      {
        parkingLotId: lot._id,
        securityStaffId: exitStaff._id,
        ownerId: owner._id,
        assignedBy: owner._id,
        shift: 'Evening',
        assignmentStatus: 'Active',
      },
    ]);

    // 5. Create Customers & Vehicles
    const customer1 = await UserModel.create({
      fullName: 'Aarav Mehta',
      email: `aarav_${timestamp}@cust.test`,
      mobileNumber: `+9191${String(timestamp).slice(-8)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
    });

    const customer2 = await UserModel.create({
      fullName: 'Sunita Rao',
      email: `sunita_${timestamp}@cust.test`,
      mobileNumber: `+9192${String(timestamp).slice(-8)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
    });

    const plate1 = `MH02AX${String(timestamp).slice(-4)}`;
    const plate2 = `MH02BX${String(timestamp).slice(-4)}`;

    const vehicle1 = await VehicleModel.create({
      customerId: customer1._id,
      vehicleNumber: plate1,
      vehicleType: 'Car',
      vehicleBrand: 'Honda',
      vehicleModel: 'City',
      vehicleStatus: 'Active',
    });

    const vehicle2 = await VehicleModel.create({
      customerId: customer2._id,
      vehicleNumber: plate2,
      vehicleType: 'Car',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Creta',
      vehicleStatus: 'Active',
    });

    // 6. Seed Realistic Vehicle Movement Logs
    // Movement 1: Vehicle Currently Inside (Entry)
    const now = new Date();
    const entryTime1 = new Date(now.getTime() - 90 * 60 * 1000); // 1.5 hours ago
    const exitScheduled1 = new Date(now.getTime() + 60 * 60 * 1000);

    const booking1 = await BookingModel.create({
      bookingReference: `BK-TEST-${timestamp}-1`,
      customerId: customer1._id,
      vehicleId: vehicle1._id,
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Active',
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 60,
      overstayRateAtBooking: 60,
      scheduledEntryTime: entryTime1,
      scheduledExitTime: exitScheduled1,
      actualEntryTime: entryTime1,
      baseAmount: 120,
      totalAmount: 120,
      currency: 'INR',
    });

    const log1 = await VehicleMovementLogModel.create({
      bookingId: booking1._id,
      customerId: customer1._id,
      vehicleId: vehicle1._id,
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotId: slot1._id,
      verifiedBy: staff._id,
      entryMethod: 'QR Code',
      entryTime: entryTime1,
      gracePeriodEndsAt: new Date(exitScheduled1.getTime() + 15 * 60 * 1000),
      stayDurationMinutes: 90,
      movementStatus: 'Vehicle Inside',
      remarks: 'Entry verified by gate scanner.',
    });

    // Movement 2: Vehicle Exited
    const entryTime2 = new Date(now.getTime() - 240 * 60 * 1000); // 4 hours ago
    const exitTime2 = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    const booking2 = await BookingModel.create({
      bookingReference: `BK-TEST-${timestamp}-2`,
      customerId: customer2._id,
      vehicleId: vehicle2._id,
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot2._id,
      currentSlotId: slot2._id,
      bookingType: 'WALK_IN',
      bookingStatus: 'Completed',
      bookingDurationMinutes: 180,
      parkingRateAtBooking: 60,
      overstayRateAtBooking: 60,
      scheduledEntryTime: entryTime2,
      scheduledExitTime: exitTime2,
      actualEntryTime: entryTime2,
      actualExitTime: exitTime2,
      baseAmount: 180,
      totalAmount: 180,
      currency: 'INR',
    });

    const log2 = await VehicleMovementLogModel.create({
      bookingId: booking2._id,
      customerId: customer2._id,
      vehicleId: vehicle2._id,
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotId: slot2._id,
      verifiedBy: staff._id,
      exitVerifiedBy: exitStaff._id,
      entryMethod: 'Walk-in',
      exitMethod: 'QR Code',
      entryTime: entryTime2,
      exitTime: exitTime2,
      gracePeriodEndsAt: new Date(exitTime2.getTime() + 15 * 60 * 1000),
      stayDurationMinutes: 180,
      movementStatus: 'Vehicle Exited',
      remarks: 'Walk-in departure verified.',
    });

    // Movement 3: Entry Denied
    const deniedTime = new Date(now.getTime() - 30 * 60 * 1000);
    const log3 = await VehicleMovementLogModel.create({
      bookingId: booking1._id,
      customerId: customer1._id,
      vehicleId: vehicle1._id,
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotId: slot1._id,
      verifiedBy: staff._id,
      entryMethod: 'Manual Verification',
      entryTime: deniedTime,
      gracePeriodEndsAt: deniedTime,
      stayDurationMinutes: 0,
      movementStatus: 'Cancelled',
      remarks: 'Entry Denied: Vehicle registration mismatch.',
    });

    console.log('✓ Master fixtures and vehicle movement logs successfully seeded.');

    // ------------------------------------------------------------------------
    // TEST 1: Retrieve Movement Logs with Pagination & KPI Aggregation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 1: Retrieve Movement Logs with KPIs ---');
    const logsResult = await securityService.getMovementLogs({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      page: 1,
      limit: 10,
    });

    if (logsResult.logs.length !== 3) {
      throw new Error(`Expected 3 movement logs, got ${logsResult.logs.length}`);
    }
    if (logsResult.summary.total < 3) {
      throw new Error(`Expected summary total >= 3, got ${logsResult.summary.total}`);
    }
    if (logsResult.summary.entries !== 1) {
      throw new Error(`Expected 1 vehicle inside, got ${logsResult.summary.entries}`);
    }
    if (logsResult.summary.exits !== 1) {
      throw new Error(`Expected 1 completed exit, got ${logsResult.summary.exits}`);
    }
    if (logsResult.summary.denied !== 1) {
      throw new Error(`Expected 1 denied attempt, got ${logsResult.summary.denied}`);
    }
    if (logsResult.facilityStaffList.length < 2) {
      throw new Error(`Expected at least 2 staff in facilityStaffList, got ${logsResult.facilityStaffList.length}`);
    }
    console.log(`✓ Test 1 Passed: Retrieved ${logsResult.logs.length} movement logs with accurate KPI aggregation.`);

    // ------------------------------------------------------------------------
    // TEST 2: Filter by Movement Type
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Filter by Movement Type ---');
    const entryFilter = await securityService.getMovementLogs({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      movementType: 'Entry',
    });
    if (entryFilter.logs.length !== 1 || entryFilter.logs[0].movementType !== 'Entry') {
      throw new Error(`Expected 1 Entry movement, got ${entryFilter.logs.length}`);
    }

    const exitFilter = await securityService.getMovementLogs({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      movementType: 'Exit',
    });
    if (exitFilter.logs.length !== 1 || exitFilter.logs[0].movementType !== 'Exit') {
      throw new Error(`Expected 1 Exit movement, got ${exitFilter.logs.length}`);
    }

    const deniedFilter = await securityService.getMovementLogs({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      movementType: 'Entry Denied',
    });
    if (deniedFilter.logs.length !== 1 || deniedFilter.logs[0].movementType !== 'Entry Denied') {
      throw new Error(`Expected 1 Entry Denied movement, got ${deniedFilter.logs.length}`);
    }
    console.log('✓ Test 2 Passed: Accurate movement type filtering across Entry, Exit, and Entry Denied.');

    // ------------------------------------------------------------------------
    // TEST 3: Multi-Field Search (Plate, Booking Reference, Customer)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Multi-Field Search ---');
    const plateSearch = await securityService.getMovementLogs({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      search: plate2,
    });
    if (plateSearch.logs.length !== 1 || plateSearch.logs[0].vehicleNumber !== plate2) {
      throw new Error(`Expected 1 log for plate search ${plate2}, got ${plateSearch.logs.length}`);
    }

    const bookingSearch = await securityService.getMovementLogs({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      search: booking1.bookingReference,
    });
    if (bookingSearch.logs.length !== 2) {
      throw new Error(`Expected 2 logs for booking1 search, got ${bookingSearch.logs.length}`);
    }

    const custSearch = await securityService.getMovementLogs({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      search: 'Sunita Rao',
    });
    if (custSearch.logs.length !== 1 || custSearch.logs[0].customerName !== 'Sunita Rao') {
      throw new Error(`Expected 1 log for customer search Sunita Rao, got ${custSearch.logs.length}`);
    }
    console.log('✓ Test 3 Passed: Multi-field search matches plate number, booking reference, and customer name.');

    // ------------------------------------------------------------------------
    // TEST 4: View Details Inspection
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: View Details Inspection ---');
    const detail = await securityService.getMovementLogDetail({
      staffUserId: staff._id.toString(),
      movementLogId: log2._id.toString(),
    });

    if (detail._id !== log2._id.toString()) {
      throw new Error('Detailed inspection ID mismatch.');
    }
    if (detail.vehicleNumber !== plate2 || detail.customerName !== 'Sunita Rao') {
      throw new Error('Customer/Vehicle detail mismatch.');
    }
    if (detail.verifiedByName !== staff.fullName || detail.exitVerifiedByName !== exitStaff.fullName) {
      throw new Error('Entry/Exit guard attribution mismatch.');
    }
    if (!detail.booking || detail.booking.bookingReference !== booking2.bookingReference) {
      throw new Error('Linked booking details missing in inspection.');
    }
    console.log(`✓ Test 4 Passed: View details inspection returns complete linked booking, guard attribution, and stay timestamps.`);

    // ------------------------------------------------------------------------
    // TEST 5: CSV Export Manifest Generation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: CSV Export Manifest ---');
    const csvContent = await securityService.exportMovementLogsCsv({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
    });

    if (!csvContent.startsWith('Movement ID,Booking Reference,Vehicle Number')) {
      throw new Error('CSV manifest headers missing or malformed.');
    }
    if (!csvContent.includes(plate1) || !csvContent.includes(plate2)) {
      throw new Error('CSV manifest rows missing vehicle registration records.');
    }
    console.log(`✓ Test 5 Passed: Clean CSV export generated (${csvContent.split('\r\n').length} lines).`);

    // ------------------------------------------------------------------------
    // TEST 6: Facility Isolation Boundary Check
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Facility Authorization Isolation ---');
    try {
      await securityService.getMovementLogs({
        staffUserId: unassignedStaff._id.toString(),
        parkingLotId: lot._id.toString(),
      });
      throw new Error('Unassigned security staff should have been rejected from viewing movement logs.');
    } catch (err: any) {
      if (err.message.includes('should have been rejected')) throw err;
      console.log(`✓ Caught expected facility rejection: ${err.message}`);
    }

    try {
      await securityService.getMovementLogDetail({
        staffUserId: unassignedStaff._id.toString(),
        movementLogId: log1._id.toString(),
      });
      throw new Error('Unassigned security staff should have been rejected from viewing movement log detail.');
    } catch (err: any) {
      if (err.message.includes('should have been rejected')) throw err;
      console.log(`✓ Caught expected detail facility rejection: ${err.message}`);
    }
    console.log('✓ Test 6 Passed: Facility authorization boundaries strictly enforced.');

    // ------------------------------------------------------------------------
    // TEST 7: Vehicle Uniqueness Enforcement Across Customer & Walk-in Bookings
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Vehicle Registration Uniqueness Enforcement ---');

    const walkInTariff = await securityService.calculateWalkInTariff({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      durationHours: 2,
    });

    // Scenario A: Customer Aarav Mehta owns plate1. Another customer tries to register/walk-in with plate1.
    let duplicatePlateBlocked = false;
    try {
      await securityService.createWalkInBooking({
        staffUserId: staff._id.toString(),
        parkingLotId: lot._id.toString(),
        customerName: 'Imposter Driver',
        customerMobile: '9988776655', // Different customer mobile
        vehicleNumber: plate1, // Aarav's vehicle plate
        vehicleType: 'Car',
        durationHours: 2,
        slotSelectionMode: 'AUTO',
        cashCollected: true,
        cashAmountCollected: walkInTariff.totalAmount,
      });
    } catch (err: any) {
      if (err.statusCode === 409 || err.errorCode === 'VEHICLE_ALREADY_EXISTS') {
        duplicatePlateBlocked = true;
        console.log(`✓ Caught expected duplicate vehicle rejection: ${err.message}`);
      } else {
        throw err;
      }
    }
    if (!duplicatePlateBlocked) {
      throw new Error('Expected duplicate vehicle registration to be rejected when belonging to another customer.');
    }

    // Scenario B: Vehicle plate1 is currently parked inside facility. Aarav tries to create another walk-in booking while inside.
    let doubleEntryBlocked = false;
    try {
      await securityService.createWalkInBooking({
        staffUserId: staff._id.toString(),
        parkingLotId: lot._id.toString(),
        customerName: 'Aarav Mehta',
        customerMobile: customer1.mobileNumber, // Same customer
        vehicleNumber: plate1, // Already inside (booking1 is Active)
        vehicleType: 'Car',
        durationHours: 2,
        slotSelectionMode: 'AUTO',
        cashCollected: true,
        cashAmountCollected: walkInTariff.totalAmount,
      });
    } catch (err: any) {
      if (err.statusCode === 409 || err.errorCode === 'VEHICLE_ALREADY_INSIDE') {
        doubleEntryBlocked = true;
        console.log(`✓ Caught expected double entry rejection: ${err.message}`);
      } else {
        throw err;
      }
    }
    if (!doubleEntryBlocked) {
      throw new Error('Expected double entry/booking to be rejected when vehicle is already inside a parking facility.');
    }

    console.log('✓ Test 7 Passed: Vehicle plate uniqueness and double-parking restrictions strictly enforced.');

    console.log('\n================================================================');
    console.log('🎉 ALL 7 VEHICLE MOVEMENT LOGS & UNIQUENESS TESTS PASSED! 🎉');
    console.log('================================================================\n');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
