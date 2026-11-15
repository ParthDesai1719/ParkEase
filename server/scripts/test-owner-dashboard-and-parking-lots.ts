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
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { ownerService } from '../src/services/owner.service.js';
import { parkingLotService } from '../src/services/parkingLot.service.js';

console.log('========================================================================');
console.log('  ParkEase — Owner Module Phase 1: Dashboard and Parking Lots Verification');
console.log('========================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
  const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });

  assert(ownerRole, 'Owner role must exist in DB');
  assert(customerRole, 'Customer role must exist in DB');
  assert(securityRole, 'Security role must exist in DB');

  const runId = Date.now().toString().slice(-6);

  // 1. Create Test Owner A
  const ownerA = await UserModel.create({
    fullName: `Owner Alpha ${runId}`,
    email: `owner_a_${runId}@parkease.com`,
    mobileNumber: `+9197100${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 2. Create Test Owner B (for cross-owner isolation checks)
  const ownerB = await UserModel.create({
    fullName: `Owner Beta ${runId}`,
    email: `owner_b_${runId}@parkease.com`,
    mobileNumber: `+9197200${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 3. Create Test Customer & Security Guard
  const customer = await UserModel.create({
    fullName: `Customer User ${runId}`,
    email: `cust_${runId}@parkease.com`,
    mobileNumber: `+9198100${runId.slice(-5)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
  });

  const securityGuard = await UserModel.create({
    fullName: `Security Guard ${runId}`,
    email: `sec_${runId}@parkease.com`,
    mobileNumber: `+9198200${runId.slice(-5)}`,
    roleId: securityRole._id,
    accountStatus: 'Active',
  });

  console.log(`✓ Created test owner A: ${ownerA.fullName} (${ownerA._id})`);
  console.log(`✓ Created test owner B: ${ownerB.fullName} (${ownerB._id})`);
  console.log(`✓ Created test security guard: ${securityGuard.fullName}`);

  // 4. Create Official Parking Lot 1 for Owner A
  const lot1 = await ParkingLotModel.create({
    ownerId: ownerA._id,
    parkingName: `Metro Hub Alpha ${runId}`,
    description: 'Initial description for Alpha',
    address: '101 Station Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380001',
    latitude: 23.0225,
    longitude: 72.5714,
    location: { type: 'Point', coordinates: [72.5714, 23.0225] },
    contactNumber: '+919999900001',
    supportEmail: 'support.alpha@metrohub.com',
    openingTime: '06:00',
    closingTime: '23:00',
    isOpen24Hours: false,
    hourlyRate: 50,
    gracePeriodMinutes: 15,
    totalFloors: 1,
    totalSlots: 10,
    availableSlots: 8,
    occupiedSlots: 2,
    reservedSlots: 0,
    occupancyPercentage: 20,
    amenities: ['CCTV Surveillance', 'Covered Parking', 'EV Charging'],
    parkingStatus: 'Active',
    layoutReviewStatus: 'Owner Confirmed',
    layoutConfirmedAt: new Date(),
  });

  // Create Floor, Zone, and Slots for Lot 1
  const floor1 = await ParkingFloorModel.create({
    parkingLotId: lot1._id,
    floorName: 'Ground Floor',
    floorNumber: 0,
    totalZones: 1,
    totalSlots: 10,
    availableSlots: 8,
    floorStatus: 'Active',
  });

  const zone1 = await ParkingZoneModel.create({
    parkingLotId: lot1._id,
    floorId: floor1._id,
    zoneName: 'Zone A',
    zoneCode: 'ZA',
    vehicleType: 'Car',
    totalSlots: 10,
    availableSlots: 8,
    zoneStatus: 'Active',
  });

  const slot1 = await ParkingSlotModel.create({
    parkingLotId: lot1._id,
    floorId: floor1._id,
    zoneId: zone1._id,
    slotNumber: 'A-101',
    slotLabel: 'A-101',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Occupied',
    qrIdentifier: `QR-SLOT-${runId}-101`,
  });

  // 5. Create Active Security Staff Assignment for Lot 1
  await SecurityStaffAssignmentModel.create({
    securityStaffId: securityGuard._id,
    ownerId: ownerA._id,
    parkingLotId: lot1._id,
    assignmentStatus: 'Active',
    assignedAt: new Date(),
    assignedBy: ownerA._id,
  });
  console.log('✓ Created floor, zone, slot and assigned active security guard.');

  // 6. Create Customer Vehicle & Paid Booking for Lot 1
  const vehicle = await VehicleModel.create({
    customerId: customer._id,
    vehicleNumber: `GJ01AB${runId.slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Hyundai',
    vehicleModel: 'Creta',
  });

  const scheduledEntry = new Date();
  scheduledEntry.setHours(scheduledEntry.getHours() + 1);
  const scheduledExit = new Date();
  scheduledExit.setHours(scheduledExit.getHours() + 3);

  const booking1 = await BookingModel.create({
    bookingReference: `BK-OWNER-TEST-${runId}`,
    customerId: customer._id,
    vehicleId: vehicle._id,
    parkingLotId: lot1._id,
    floorId: floor1._id,
    zoneId: zone1._id,
    originalSlotId: slot1._id,
    currentSlotId: slot1._id,
    bookingType: 'ONLINE',
    bookingStatus: 'Confirmed',
    scheduledEntryTime: scheduledEntry,
    scheduledExitTime: scheduledExit,
    gracePeriodMinutes: 15,
    bookingDurationMinutes: 120,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 75,
    baseAmount: 100,
    additionalCharges: 0,
    totalAmount: 100,
  });

  await PaymentModel.create({
    paymentReference: `PAY-OWNER-TEST-${runId}`,
    bookingId: booking1._id,
    customerId: customer._id,
    ownerId: ownerA._id,
    parkingLotId: lot1._id,
    paymentType: 'Parking Booking',
    paymentTypeCode: 'BOOKING',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'SUCCESSFUL',
    amount: 100,
    additionalCharges: 0,
    refundAmount: 0,
  });
  console.log('✓ Created confirmed booking and successful payment.');

  // -------------------------------------------------------------------------
  // TEST 1: Owner Dashboard Statistics (Consolidated & Filtered)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Owner Dashboard Statistics ---');
  const consolidatedStats = await ownerService.getOwnerDashboardStats(ownerA._id.toString());
  assert.strictEqual(consolidatedStats.totalSlots, 10, 'Total slots must match lot1 total slots');
  assert.strictEqual(consolidatedStats.availableSlots, 8, 'Available slots must be 8');
  assert.strictEqual(consolidatedStats.occupiedSlots, 2, 'Occupied slots must be 2');
  assert.strictEqual(consolidatedStats.occupancyPercentage, 20, 'Occupancy rate must be 20%');
  assert.strictEqual(consolidatedStats.todayBookingsCount, 1, 'Today bookings count must be 1');
  assert.strictEqual(consolidatedStats.todayRevenue, 100, 'Today revenue must be 100');
  assert.strictEqual(consolidatedStats.activeSecurityStaffCount, 1, 'Active security staff count must be 1');
  assert(consolidatedStats.recentBookings.length > 0, 'Recent bookings must include the newly created booking');
  assert.strictEqual(consolidatedStats.recentBookings[0].bookingReference, booking1.bookingReference);
  assert.strictEqual(consolidatedStats.recentBookings[0].totalAmount, 100);
  assert.strictEqual(consolidatedStats.parkingLotsSummary.length, 1);
  assert.strictEqual(consolidatedStats.parkingLotsSummary[0].parkingName, lot1.parkingName);
  console.log('✓ Consolidated stats aggregated accurately from actual DB collections.');

  // Filtered by specific lot ID
  const lotFilteredStats = await ownerService.getOwnerDashboardStats(
    ownerA._id.toString(),
    lot1._id.toString(),
  );
  assert.strictEqual(lotFilteredStats.totalSlots, 10);
  assert.strictEqual(lotFilteredStats.todayRevenue, 100);
  console.log('✓ Lot-filtered stats successfully scoped.');

  // -------------------------------------------------------------------------
  // TEST 2: Ownership Enforcement & Cross-Owner Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Ownership Enforcement & Cross-Owner Isolation ---');
  let forbiddenCaught = false;
  try {
    // Owner B attempts to view stats for Lot 1 (owned by Owner A)
    await ownerService.getOwnerDashboardStats(ownerB._id.toString(), lot1._id.toString());
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 403) {
      forbiddenCaught = true;
    }
  }
  assert(forbiddenCaught, 'Owner B must be forbidden (403) from accessing Owner A facility stats');
  console.log('✓ Cross-owner access correctly rejected with 403 Forbidden.');

  // -------------------------------------------------------------------------
  // TEST 3: Permitted Business Information Updating
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Permitted Business Information Updating ---');
  const updatedLot = await ownerService.updateOwnerParkingLotBusinessInfo(
    ownerA._id.toString(),
    lot1._id.toString(),
    {
      description: 'Updated Metro Hub description with full 24h support.',
      contactNumber: '+919999911111',
      supportEmail: 'newsupport@metrohub.com',
      isOpen24Hours: true,
      hourlyRate: 65,
      gracePeriodMinutes: 20,
      amenities: ['CCTV Surveillance', 'Covered Parking', 'EV Charging', 'Washroom', 'Car Wash'],
      parkingStatus: 'Active',
    },
  );

  assert.strictEqual(updatedLot.description, 'Updated Metro Hub description with full 24h support.');
  assert.strictEqual(updatedLot.contactNumber, '+919999911111');
  assert.strictEqual(updatedLot.supportEmail, 'newsupport@metrohub.com');
  assert.strictEqual(updatedLot.isOpen24Hours, true);
  assert.strictEqual(updatedLot.openingTime, '00:00');
  assert.strictEqual(updatedLot.closingTime, '23:59');
  assert.strictEqual(updatedLot.hourlyRate, 65);
  assert.strictEqual(updatedLot.gracePeriodMinutes, 20);
  assert(updatedLot.amenities.includes('Washroom'));
  assert(updatedLot.amenities.includes('Car Wash'));
  console.log('✓ Permitted business fields updated successfully.');

  // -------------------------------------------------------------------------
  // TEST 4: Structural Protection & Unauthorized Modification Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Structural Protection & Unauthorized Modification Rejection ---');
  // Attempt to update by Owner B (unauthorized)
  let updateForbiddenCaught = false;
  try {
    await ownerService.updateOwnerParkingLotBusinessInfo(
      ownerB._id.toString(),
      lot1._id.toString(),
      { hourlyRate: 10 },
    );
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 403) {
      updateForbiddenCaught = true;
    }
  }
  assert(updateForbiddenCaught, 'Owner B must be forbidden (403) from modifying Owner A facility');
  console.log('✓ Unauthorized update attempt blocked with 403 Forbidden.');

  // Attempt to update with invalid status
  let invalidStatusCaught = false;
  try {
    await ownerService.updateOwnerParkingLotBusinessInfo(
      ownerA._id.toString(),
      lot1._id.toString(),
      // @ts-expect-error test invalid status
      { parkingStatus: 'NonExistentStatus' },
    );
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 400) {
      invalidStatusCaught = true;
    }
  }
  assert(invalidStatusCaught, 'Invalid status enum must be rejected with 400');
  console.log('✓ Invalid status enum rejected.');

  // -------------------------------------------------------------------------
  // TEST 5: Hierarchy & Structure Retrieval
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Hierarchy & Structure Retrieval ---');
  const hierarchyResult = await parkingLotService.getOfficialParkingLotHierarchy(
    lot1._id.toString(),
    ownerA._id.toString(),
  );
  assert(hierarchyResult.parkingLot, 'Hierarchy must contain official lot');
  assert.strictEqual(hierarchyResult.floors.length, 1);
  assert.strictEqual(hierarchyResult.floors[0].zones.length, 1);
  assert.strictEqual(hierarchyResult.floors[0].zones[0].slots.length, 1);
  assert.strictEqual(hierarchyResult.floors[0].zones[0].slots[0].slotNumber, 'A-101');
  console.log('✓ Read-only structural hierarchy retrieved accurately.');

  // Cleanup
  console.log('\n--- Cleanup ---');
  await PaymentModel.deleteMany({ bookingId: booking1._id });
  await BookingModel.deleteMany({ _id: booking1._id });
  await VehicleModel.deleteMany({ _id: vehicle._id });
  await SecurityStaffAssignmentModel.deleteMany({ parkingLotId: lot1._id });
  await ParkingSlotModel.deleteMany({ parkingLotId: lot1._id });
  await ParkingZoneModel.deleteMany({ parkingLotId: lot1._id });
  await ParkingFloorModel.deleteMany({ parkingLotId: lot1._id });
  await ParkingLotModel.deleteMany({ _id: lot1._id });
  await UserModel.deleteMany({ _id: { $in: [ownerA._id, ownerB._id, customer._id, securityGuard._id] } });
  console.log('✓ Test fixtures cleaned up.');

  await mongoose.disconnect();
  console.log('\n========================================================================');
  console.log('  ALL OWNER MODULE PHASE 1 TESTS PASSED SUCCESSFULLY! (100% Pass Rate)');
  console.log('========================================================================');
}

run().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
