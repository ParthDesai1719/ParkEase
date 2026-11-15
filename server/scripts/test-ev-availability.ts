import 'dotenv/config';
import mongoose from 'mongoose';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { securityService } from '../src/services/security.service.js';

async function runEvAvailabilityTest() {
  console.log('--- Testing Electric Bay Availability & Frozen State Enforcement ---');
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB.');

  const testSuffix = Date.now().toString().slice(-6);

  // 1. Setup Role & Staff User
  let secRole = await RoleModel.findOne({ roleCode: 'SECURITY_STAFF' });
  if (!secRole) {
    secRole = await RoleModel.findOne({ roleCode: 'SECURITY' });
  }

  const staffUser = await UserModel.create({
    fullName: `Staff EV Test ${testSuffix}`,
    email: `staff.ev.${testSuffix}@parkeasetest.com`,
    mobileNumber: `+919800${testSuffix}`,
    roleId: secRole?._id || new mongoose.Types.ObjectId(),
    accountStatus: 'Active',
    isEmailVerified: true,
    isMobileVerified: true,
  });

  // 2. Setup Parking Lot WITHOUT EV bays
  const ownerUser = await UserModel.findOne({ accountStatus: 'Active' });
  const lotNoEv = await ParkingLotModel.create({
    ownerId: ownerUser?._id || staffUser._id,
    parkingName: `Lot No EV ${testSuffix}`,
    address: '100 Green Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    postalCode: '380001',
    latitude: 23.0225,
    longitude: 72.5714,
    location: { type: 'Point', coordinates: [72.5714, 23.0225] },
    contactNumber: '+919876543210',
    hourlyRate: 50,
    totalSlots: 10,
    availableSlots: 10,
    parkingStatus: 'Active',
    amenities: ['CCTV Surveillance'], // No EV Charging
  });

  const floor = await ParkingFloorModel.create({
    parkingLotId: lotNoEv._id,
    floorNumber: 1,
    floorName: 'Ground Floor',
    floorStatus: 'Active',
    totalCapacity: 10,
  });

  const zone = await ParkingZoneModel.create({
    parkingLotId: lotNoEv._id,
    floorId: floor._id,
    zoneCode: 'A',
    zoneName: 'Zone A',
    zoneStatus: 'Active',
    totalSlots: 10,
  });

  // Only create standard Car slots
  await ParkingSlotModel.create({
    parkingLotId: lotNoEv._id,
    floorId: floor._id,
    zoneId: zone._id,
    slotNumber: 'A-01',
    slotLabel: 'A-01',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
    qrIdentifier: `QR-NOEV-${testSuffix}`,
  });

  // Assign staff to lot
  await SecurityStaffAssignmentModel.create({
    ownerId: lotNoEv.ownerId,
    securityStaffId: staffUser._id,
    parkingLotId: lotNoEv._id,
    assignedBy: staffUser._id,
    assignmentStatus: 'Active',
  });

  try {
    // Test 1: getSecurityStaffFacilities returns totalEvSlots = 0
    console.log('\n--- Test 1: Staff facilities reports totalEvSlots: 0 ---');
    const facilities = await securityService.getSecurityStaffFacilities(staffUser._id.toString());
    const assignedLot = facilities.find((f) => f.parkingLotId === lotNoEv._id.toString());
    if (!assignedLot || assignedLot.totalEvSlots !== 0) {
      throw new Error(`Expected totalEvSlots to be 0, got ${assignedLot?.totalEvSlots}`);
    }
    console.log(`✓ Facility ${assignedLot.parkingName} correctly has totalEvSlots: 0`);

    // Test 2: Calculate tariff for EV when no EV slots exist throws error and blocks amount calculation
    console.log('\n--- Test 2: EV tariff computation blocked when no EV bays exist ---');
    let tariffBlocked = false;
    try {
      await securityService.calculateWalkInTariff({
        staffUserId: staffUser._id.toString(),
        parkingLotId: lotNoEv._id.toString(),
        vehicleType: 'EV',
        durationHours: 2,
      });
    } catch (err: any) {
      if (err.errorCode === 'EV_BAYS_NOT_AVAILABLE' || err.message?.includes('Electric vehicle bays are not available')) {
        tariffBlocked = true;
        console.log(`✓ EV tariff computation strictly blocked: "${err.message}" (Code: ${err.errorCode})`);
      } else {
        throw err;
      }
    }
    if (!tariffBlocked) {
      throw new Error('Expected calculateWalkInTariff to throw EV_BAYS_NOT_AVAILABLE');
    }

    // Test 3: Create EV walk-in booking blocked when no EV slots exist
    console.log('\n--- Test 3: EV walk-in booking creation blocked when no EV bays exist ---');
    let bookingBlocked = false;
    try {
      await securityService.createWalkInBooking({
        staffUserId: staffUser._id.toString(),
        parkingLotId: lotNoEv._id.toString(),
        customerName: 'EV Test User',
        customerMobile: '+919876543210',
        vehicleNumber: 'GJ01EV1234',
        vehicleType: 'EV',
        durationHours: 2,
        slotSelectionMode: 'AUTO',
        cashCollected: true,
        cashAmountCollected: 100,
      });
    } catch (err: any) {
      if (err.errorCode === 'EV_BAYS_NOT_AVAILABLE' || err.message?.includes('Electric vehicle bays are not available')) {
        bookingBlocked = true;
        console.log(`✓ EV walk-in booking strictly blocked: "${err.message}" (Code: ${err.errorCode})`);
      } else {
        throw err;
      }
    }
    if (!bookingBlocked) {
      throw new Error('Expected createWalkInBooking to throw EV_BAYS_NOT_AVAILABLE');
    }

    console.log('\n======================================================');
    console.log('🎉 ALL EV AVAILABILITY & FROZEN STATE TESTS PASSED! 🎉');
    console.log('======================================================\n');
  } finally {
    // Cleanup
    await SecurityStaffAssignmentModel.deleteMany({ securityStaffId: staffUser._id });
    await ParkingSlotModel.deleteMany({ parkingLotId: lotNoEv._id });
    await ParkingZoneModel.deleteMany({ parkingLotId: lotNoEv._id });
    await ParkingFloorModel.deleteMany({ parkingLotId: lotNoEv._id });
    await ParkingLotModel.deleteOne({ _id: lotNoEv._id });
    await UserModel.deleteOne({ _id: staffUser._id });
    await mongoose.disconnect();
    console.log('Cleanup complete and disconnected from MongoDB.');
  }
}

runEvAvailabilityTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
