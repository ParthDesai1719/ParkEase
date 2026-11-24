import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import {
  UserModel,
  RoleModel,
  ParkingLotModel,
  ParkingFloorModel,
  ParkingZoneModel,
  ParkingSlotModel,
  ParkingLayoutModel,
  BookingModel,
  VehicleModel,
  SecurityStaffAssignmentModel,
  EmailLogModel,
} from '../src/models/index.js';
import { ownerEmailCenterService } from '../src/services/ownerEmailCenter.service.js';
import { securityEmailerService } from '../src/services/securityEmailer.service.js';
import { securityLiveViewerService } from '../src/services/securityLiveViewer.service.js';
import { ParkingLayoutService } from '../src/services/parkingLayout.service.js';
import { customerBookingService } from '../src/services/customerBooking.service.js';
import { securityService } from '../src/services/security.service.js';
import { barrierService } from '../src/services/barrier.service.js';

async function runTests() {
  console.log('=== PARKEASE E2E VERIFICATION TEST SUITE ===\n');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB:', mongoose.connection.name);

  try {
    // 1. Setup mock/test roles
    let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' }) || await RoleModel.findOne({ roleName: /owner/i });
    if (!ownerRole) ownerRole = await RoleModel.create({ roleName: 'Owner', roleCode: 'OWNER', description: 'Parking Owner', dashboardRoute: '/owner/dashboard' });

    let securityRole = await RoleModel.findOne({ roleCode: 'SECURITY' }) || await RoleModel.findOne({ roleName: /security/i });
    if (!securityRole) securityRole = await RoleModel.create({ roleName: 'Security', roleCode: 'SECURITY', description: 'Security Staff', dashboardRoute: '/security/dashboard' });

    let customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' }) || await RoleModel.findOne({ roleName: /customer/i });
    if (!customerRole) customerRole = await RoleModel.create({ roleName: 'Customer', roleCode: 'CUSTOMER', description: 'Customer', dashboardRoute: '/customer/dashboard' });

    let adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' }) || await RoleModel.findOne({ roleName: /admin/i });
    if (!adminRole) adminRole = await RoleModel.create({ roleName: 'Admin', roleCode: 'ADMIN', description: 'Administrator', dashboardRoute: '/admin/dashboard' });

    const testSuffix = Date.now().toString().slice(-6);

    // Create test Owner
    const owner = await UserModel.create({
      fullName: `Test Owner ${testSuffix}`,
      email: `owner_${testSuffix}@example.com`,
      mobileNumber: `+919876${testSuffix.padStart(6, '0')}`,
      passwordHash: 'dummyhash',
      roleId: ownerRole._id,
      userStatus: 'Active',
      isEmailVerified: true,
      isMobileVerified: true,
    });

    // Create test Security Staff
    const securityStaff = await UserModel.create({
      fullName: `Security Officer ${testSuffix}`,
      email: `sec_${testSuffix}@example.com`,
      mobileNumber: `+919811${testSuffix.padStart(6, '0')}`,
      passwordHash: 'dummyhash',
      roleId: securityRole._id,
      userStatus: 'Active',
      isEmailVerified: true,
      isMobileVerified: true,
    });

    // Create test Customer
    const customer = await UserModel.create({
      fullName: `Test Customer ${testSuffix}`,
      email: `cust_${testSuffix}@example.com`,
      mobileNumber: `+919822${testSuffix.padStart(6, '0')}`,
      passwordHash: 'dummyhash',
      roleId: customerRole._id,
      userStatus: 'Active',
      isEmailVerified: true,
      isMobileVerified: true,
    });

    // Create test Admin
    const admin = await UserModel.create({
      fullName: `Test Admin ${testSuffix}`,
      email: `admin_${testSuffix}@example.com`,
      mobileNumber: `+919833${testSuffix.padStart(6, '0')}`,
      passwordHash: 'dummyhash',
      roleId: adminRole._id,
      userStatus: 'Active',
      isEmailVerified: true,
      isMobileVerified: true,
    });

    // Create test Parking Lot
    const parkingLot = await ParkingLotModel.create({
      ownerId: owner._id,
      parkingName: `Grand Test Facility ${testSuffix}`,
      address: '100 Cyber City Hub',
      city: 'Gurugram',
      state: 'Haryana',
      postalCode: '122002',
      contactNumber: '+919876543210',
      latitude: 28.48,
      longitude: 77.08,
      location: {
        type: 'Point',
        coordinates: [77.08, 28.48],
      },
      totalFloors: 1,
      totalCapacity: 10,
      overflowCapacity: 2,
      overflowSlotCount: 1,
      parkingStatus: 'Active',
      pricingModel: 'Fixed',
      hourlyRate: 50,
      isVerified: true,
      layoutReviewStatus: 'Owner Confirmed',
      createdBy: admin._id,
      lastModifiedBy: admin._id,
    });

    // Create Floor
    const floor = await ParkingFloorModel.create({
      parkingLotId: parkingLot._id,
      floorNumber: 0,
      floorName: 'Ground Level',
      floorStatus: 'Active',
      totalSlots: 2,
      createdBy: admin._id,
      lastModifiedBy: admin._id,
    });

    // Create Zone
    const zone = await ParkingZoneModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneName: 'Zone A',
      zoneCode: 'A',
      zoneStatus: 'Active',
      vehicleType: 'Car',
      totalSlots: 2,
      createdBy: admin._id,
      lastModifiedBy: admin._id,
    });

    // Create Regular Slot (Slot A-01, Car)
    const regularSlot = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'A-01',
      slotLabel: 'Bay A-01',
      slotType: 'Standard',
      qrIdentifier: `QR-${testSuffix}-A01`,
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      isOverflow: false,
      createdBy: admin._id,
      lastModifiedBy: admin._id,
    });

    // Create Overflow Slot (Slot OF-01, Overflow)
    const overflowSlot = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'OF-01',
      slotLabel: 'Overflow Bay 01',
      slotType: 'Standard',
      qrIdentifier: `QR-${testSuffix}-OF01`,
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      isOverflow: true,
      createdBy: admin._id,
      lastModifiedBy: admin._id,
    });

    // Create 2D Layout for Floor
    const layout = await ParkingLayoutModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      version: 1,
      status: 'Published',
      isPublished: true,
      elements: [
        {
          elementId: 'slot-reg-1',
          elementType: 'ParkingSlot',
          slotId: regularSlot._id,
          slotNumber: 'A-01',
          zoneId: zone._id,
          zoneCode: 'A',
          isOverflow: false,
          x: 100,
          y: 100,
          width: 80,
          height: 140,
        },
        {
          elementId: 'slot-over-1',
          elementType: 'ParkingSlot',
          slotId: overflowSlot._id,
          slotNumber: 'OF-01',
          zoneId: zone._id,
          zoneCode: 'A',
          isOverflow: true,
          x: 250,
          y: 100,
          width: 80,
          height: 140,
        },
      ],
      canvasConfig: { width: 1200, height: 800, gridSize: 20, snapToGrid: true, backgroundColor: '#0f172a' },
      createdBy: admin._id,
      lastModifiedBy: admin._id,
    });

    // Assign Security Staff to this lot
    await SecurityStaffAssignmentModel.create({
      securityStaffId: securityStaff._id,
      ownerId: owner._id,
      parkingLotId: parkingLot._id,
      assignedBy: admin._id,
      assignmentStatus: 'Active',
      shiftStartTime: '08:00',
      shiftEndTime: '20:00',
    });

    // Create a customer vehicle
    const vehicle = await VehicleModel.create({
      customerId: customer._id,
      vehicleNumber: `HR26AB${(1000 + Math.floor(Math.random() * 8999))}`,
      vehicleType: 'Car',
      vehicleBrand: 'Honda',
      vehicleModel: 'City',
      isActive: true,
    });

    // Create past booking connecting customer to this lot
    const customerBooking = await BookingModel.create({
      bookingReference: `BK-${testSuffix}`,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: regularSlot._id,
      currentSlotId: regularSlot._id,
      vehicleId: vehicle._id,
      bookingStatus: 'Confirmed',
      bookingType: 'ONLINE',
      scheduledEntryTime: new Date(Date.now() + 86400000),
      scheduledExitTime: new Date(Date.now() + 90000000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
    });

    console.log('✓ Initialized mock environment with Owner, Security, Customer, Facility, and Layout.\n');

    // ==========================================
    // TEST 1: FEATURE 1 — OWNER EMAIL CENTER
    // ==========================================
    console.log('--- TEST 1: OWNER EMAIL CENTER ---');
    const customerRecipients = await ownerEmailCenterService.getRecipients({
      ownerUserId: owner._id.toString(),
      category: 'CUSTOMERS',
    });
    const staffRecipients = await ownerEmailCenterService.getRecipients({
      ownerUserId: owner._id.toString(),
      category: 'SECURITY_STAFF',
    });
    console.log(`Owner recipients: ${customerRecipients.recipients.length} customers, ${staffRecipients.recipients.length} staff`);
    if (customerRecipients.recipients.length !== 1 || customerRecipients.recipients[0].email !== customer.email) {
      throw new Error(`Owner recipients failed: Expected customer ${customer.email}, got: ${JSON.stringify(customerRecipients.recipients)}`);
    }
    if (staffRecipients.recipients.length !== 1 || staffRecipients.recipients[0].email !== securityStaff.email) {
      throw new Error(`Owner recipients failed: Expected staff ${securityStaff.email}, got: ${JSON.stringify(staffRecipients.recipients)}`);
    }
    console.log('✓ Owner recipient scoping strictly verified.');

    // Attempt sending email to unauthorized recipient
    let unauthorizedBlocked = false;
    try {
      await ownerEmailCenterService.sendEmail({
        ownerUserId: owner._id.toString(),
        payload: {
          recipientCategory: 'CUSTOMERS',
          recipientIds: [new mongoose.Types.ObjectId().toString()],
          subject: 'Spam Attempt',
          content: 'This should be blocked',
        },
      });
    } catch (err: any) {
      if (err.statusCode === 403 || err.errorCode === 'UNAUTHORIZED_RECIPIENTS') {
        unauthorizedBlocked = true;
      }
    }
    if (!unauthorizedBlocked) {
      throw new Error('Owner Email Center failed to block unauthorized recipient!');
    }
    console.log('✓ Unauthorized recipient access strictly blocked by backend.');

    // Send valid email to assigned staff
    const sendResult = await ownerEmailCenterService.sendEmail({
      ownerUserId: owner._id.toString(),
      payload: {
        recipientCategory: 'SECURITY_STAFF',
        recipientIds: [securityStaff._id.toString()],
        subject: 'Security Briefing',
        content: 'Please ensure gate barrier is functioning smoothly.',
      },
    });
    console.log(`✓ Owner email sent successfully (Dispatched: ${sendResult.sentCount}, Ref: ${sendResult.emailReference})`);

    const ownerLog = await EmailLogModel.findOne({ emailReference: sendResult.emailReference });
    if (!ownerLog || ownerLog.source !== 'Owner') {
      throw new Error('EmailLog not recorded properly with source: Owner');
    }
    console.log('✓ Owner email logged with source: Owner');

    // ==========================================
    // TEST 2: FEATURE 2 — SECURITY EMAILER
    // ==========================================
    console.log('\n--- TEST 2: SECURITY EMAILER ---');
    const assignedOwners = await securityEmailerService.getAssignedOwners(securityStaff._id.toString());
    if (assignedOwners.length === 0) {
      throw new Error('Security Emailer did not find any assigned owners!');
    }
    const assignedOwnerInfo = assignedOwners[0];
    console.log(`Security assigned owner: ${assignedOwnerInfo.ownerName} (${assignedOwnerInfo.ownerEmail}) for facility: ${assignedOwnerInfo.parkingLotName}`);
    if (assignedOwnerInfo.ownerEmail !== owner.email) {
      throw new Error(`Security Emailer did not resolve assigned owner! Expected ${owner.email}, got: ${assignedOwnerInfo.ownerEmail}`);
    }
    console.log('✓ Security assigned owner automatically resolved and verified.');

    // Send security email to assigned owner
    const secSendResult = await securityEmailerService.sendEmailToOwner({
      staffUserId: securityStaff._id.toString(),
      payload: {
        parkingLotId: parkingLot._id.toString(),
        subject: 'Daily Facility Check-in',
        content: 'All perimeter sensors and cameras are online.',
      },
    });
    console.log(`✓ Security email sent to owner (Ref: ${secSendResult.emailReference})`);

    const secLog = await EmailLogModel.findOne({ emailReference: secSendResult.emailReference });
    if (!secLog || secLog.source !== 'Security') {
      throw new Error('EmailLog not recorded properly with source: Security');
    }
    console.log('✓ Security email logged with source: Security');

    // ==========================================
    // TEST 3: FEATURE 3 — SECURITY 2D LIVE VIEWER
    // ==========================================
    console.log('\n--- TEST 3: SECURITY 2D LIVE PARKING VIEWER ---');
    const facilities = await securityLiveViewerService.getAssignedFacilities(securityStaff._id.toString());
    if (facilities.length === 0 || facilities[0].parkingLotId !== parkingLot._id.toString()) {
      throw new Error('Security Live Viewer failed to retrieve assigned facility!');
    }
    console.log(`✓ Security assigned facilities: ${facilities.length} facility found (${facilities[0].parkingName})`);

    // Mark regular slot as occupied with active booking
    const liveBooking = await BookingModel.create({
      bookingReference: `LIVE-${testSuffix}`,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: regularSlot._id,
      currentSlotId: regularSlot._id,
      vehicleId: vehicle._id,
      bookingStatus: 'Active',
      bookingType: 'WALK_IN',
      scheduledEntryTime: new Date(Date.now() - 3600000),
      scheduledExitTime: new Date(Date.now() + 3600000),
      actualEntryTime: new Date(Date.now() - 3600000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
    });
    regularSlot.slotStatus = 'Occupied';
    regularSlot.currentBookingId = liveBooking._id;
    await regularSlot.save();

    const liveLayout = await securityLiveViewerService.getLiveFloorLayout({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      floorId: floor._id.toString(),
    });
    console.log(`✓ Live layout retrieved: ${liveLayout.elements.length} elements, occupied count: ${liveLayout.stats.occupiedSlots}`);

    const occupiedEl: any = liveLayout.elements.find((el: any) => el.slotId === regularSlot._id.toString());
    if (!occupiedEl || occupiedEl.effectiveStatus !== 'Occupied' || occupiedEl.vehicleNumber !== vehicle.vehicleNumber) {
      throw new Error(`Live layout bay did not show vehicle registration plate! Found: ${JSON.stringify(occupiedEl)}`);
    }
    console.log(`✓ Occupied bay A-01 correctly rendered vehicle number: "${occupiedEl.vehicleNumber}" on canvas.`);

    const overflowEl: any = liveLayout.elements.find((el: any) => el.slotId === overflowSlot._id.toString());
    if (!overflowEl || !overflowEl.isOverflow) {
      throw new Error('Overflow bay failed to render isOverflow indicator badge on canvas!');
    }
    console.log('✓ Overflow bay OF-01 correctly rendered isOverflow: true indicator on canvas.');

    // Test slot detail modal query
    const slotDetails = await securityLiveViewerService.getSlotDetails({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      slotId: regularSlot._id.toString(),
    });
    if (!slotDetails.activeBooking || slotDetails.activeBooking.vehicle.vehicleNumber !== vehicle.vehicleNumber) {
      throw new Error('Security slot details modal info failed to return active booking vehicle!');
    }
    console.log(`✓ Slot details modal retrieved: Customer ${slotDetails.activeBooking.customerName}, Vehicle: ${slotDetails.activeBooking.vehicle.vehicleNumber}`);

    // 3C. Security slot status update test
    const secUpdateRes = await securityLiveViewerService.updateSlotStatus({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      slotId: overflowSlot._id.toString(),
      payload: { slotStatus: 'Under Maintenance', remarks: 'Surface inspection' },
    });
    if (secUpdateRes.slot.slotStatus !== 'Under Maintenance') {
      throw new Error('Security slot status update failed to set Under Maintenance!');
    }
    console.log('✓ Security staff placed bay OF-01 under maintenance.');

    const secRestoreRes = await securityLiveViewerService.updateSlotStatus({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      slotId: overflowSlot._id.toString(),
      payload: { slotStatus: 'Available' },
    });
    if (secRestoreRes.slot.slotStatus !== 'Available') {
      throw new Error('Security slot status update failed to restore Available!');
    }
    console.log('✓ Security staff restored bay OF-01 to Available.');

    // Security cannot update occupied slot
    let occupiedChangeBlocked = false;
    try {
      await securityLiveViewerService.updateSlotStatus({
        staffUserId: securityStaff._id.toString(),
        parkingLotId: parkingLot._id.toString(),
        slotId: regularSlot._id.toString(),
        payload: { slotStatus: 'Under Maintenance' },
      });
    } catch (err: any) {
      if (err.statusCode === 409 && err.errorCode === 'SLOT_OCCUPIED_CONFLICT') {
        occupiedChangeBlocked = true;
      }
    }
    if (!occupiedChangeBlocked) {
      throw new Error('Security failed to block modifying occupied slot status!');
    }
    console.log('✓ Security staff blocked from modifying occupied slot status.');

    // ==========================================
    // TEST 4: FEATURE 4 — OVERFLOW SLOTS CONFIG & ALLOCATION
    // ==========================================
    console.log('\n--- TEST 4: OVERFLOW SLOTS CONFIGURATION & ATOMIC ALLOCATION ---');

    // 4A. Update overflow capacity via ParkingLayoutService
    const updatedOverflow = await ParkingLayoutService.updateOverflowConfig(
      parkingLot._id.toString(),
      3,
      admin._id.toString(),
    );
    if (updatedOverflow.overflowCapacity !== 3) {
      throw new Error(`Failed to update overflow capacity! Got: ${updatedOverflow.overflowCapacity}`);
    }
    console.log(`✓ Admin updated overflow capacity threshold to: ${updatedOverflow.overflowCapacity}`);

    // 4B. Universal vehicle compatibility test
    // Overflow slots accept Car, Bike, SUV, EV
    const bikeCompatible = (customerBookingService as any).isSlotCompatibleWithVehicle('Car', 'Bike', true);
    const evCompatible = (customerBookingService as any).isSlotCompatibleWithVehicle('Car', 'EV', true);
    const suvCompatible = (customerBookingService as any).isSlotCompatibleWithVehicle('Car', 'SUV', true);
    if (!bikeCompatible || !evCompatible || !suvCompatible) {
      throw new Error('Universal vehicle compatibility failed for overflow slots!');
    }
    console.log('✓ Universal vehicle compatibility verified (Bike, EV, SUV all accepted by overflow slot).');

    // 4C. Allocation Priority Rule 1: Regular compatible slots first
    // Reset regular slot to Available
    regularSlot.slotStatus = 'Available';
    regularSlot.currentBookingId = null;
    await regularSlot.save();
    await BookingModel.deleteMany({ _id: liveBooking._id });

    let customerOverflowBlocked = false;
    try {
      await customerBookingService.validateSlotEligibility({
        parkingLotId: parkingLot._id.toString(),
        slotId: overflowSlot._id.toString(),
        vehicleType: 'Car',
        scheduledEntryTime: new Date(Date.now() + 10000000).toISOString(),
        scheduledExitTime: new Date(Date.now() + 14000000).toISOString(),
      });
    } catch (err: any) {
      if (err.statusCode === 400 && err.errorCode === 'OVERFLOW_SLOT_NOT_BOOKABLE_BY_CUSTOMER') {
        customerOverflowBlocked = true;
      }
    }
    if (!customerOverflowBlocked) {
      throw new Error('Rule 1 violation: Overflow slot was not blocked for customer online booking!');
    }
    console.log('✓ Rule 1 verified: Customer online booking for overflow slot strictly blocked with OVERFLOW_SLOT_NOT_BOOKABLE_BY_CUSTOMER.');

    // 4D. Customer Floor Booking Context: Overflow slots must be frozen (isEligible: false)
    const floorContext = await customerBookingService.getBookingContext({
      parkingLotId: parkingLot._id.toString(),
      floorId: floor._id.toString(),
      vehicleType: 'Car',
      scheduledEntryTime: new Date(Date.now() + 10000000).toISOString(),
      scheduledExitTime: new Date(Date.now() + 14000000).toISOString(),
    });
    const overflowContextSlot = floorContext.activeFloor.slots.find((s) => s._id.toString() === overflowSlot._id.toString());
    if (!overflowContextSlot || overflowContextSlot.isEligible !== false) {
      throw new Error('Rule 2 violation: Overflow slot was not marked isEligible: false in customer booking context!');
    }
    console.log(`✓ Rule 2 verified: Customer booking map freezes overflow bays (isEligible: false, reason: "${overflowContextSlot.ineligibilityReason}").`);

    // Reserve/Occupy regular slot A-01 for walk-in test
    const targetEntry = new Date(Date.now() + 10000000);
    const targetExit = new Date(Date.now() + 14000000);

    await BookingModel.create({
      bookingReference: `FULL-${testSuffix}`,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: regularSlot._id,
      currentSlotId: regularSlot._id,
      vehicleId: vehicle._id,
      bookingStatus: 'Confirmed',
      bookingType: 'ONLINE',
      scheduledEntryTime: targetEntry,
      scheduledExitTime: targetExit,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
    });

    // 4E. Test Security Walk-in Recommendation Priority
    // Security walk-in should recommend overflow slot when regular slot is unavailable
    const walkInSlots = await securityService.getWalkInAvailableSlots({
      staffUserId: securityStaff._id.toString(),
      parkingLotId: parkingLot._id.toString(),
      vehicleType: 'Car',
      durationHours: 2,
      entryTime: targetEntry.toISOString(),
      exitTime: targetExit.toISOString(),
    });

    if (!walkInSlots.recommendedSlot || walkInSlots.recommendedSlot.slotId !== overflowSlot._id.toString()) {
      throw new Error('Security Walk-in recommendation failed to fallback to overflow bay!');
    }
    console.log(`✓ Security Walk-in recommendation correctly allocated overflow bay: ${walkInSlots.recommendedSlot.slotNumber} when regular bay was occupied.`);

    // 4F. Test Safety Protection: Cannot reduce overflow capacity below active overflow bookings
    // Create booking on overflow slot
    await BookingModel.create({
      bookingReference: `OVER-BK-${testSuffix}`,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: overflowSlot._id,
      currentSlotId: overflowSlot._id,
      vehicleId: vehicle._id,
      bookingStatus: 'Active',
      bookingType: 'ONLINE',
      scheduledEntryTime: targetEntry,
      scheduledExitTime: targetExit,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
    });

    let capacityReductionBlocked = false;
    try {
      await ParkingLayoutService.updateOverflowConfig(
        parkingLot._id.toString(),
        0, // Attempt to set to 0 while 1 active booking exists
        admin._id.toString(),
      );
    } catch (err: any) {
      if (err.statusCode === 400 && err.errorCode === 'OVERFLOW_CAPACITY_CONFLICT') {
        capacityReductionBlocked = true;
      }
    }
    if (!capacityReductionBlocked) {
      throw new Error('Failed to prevent reducing overflow capacity below active bookings count!');
    }
    console.log('✓ Safety Rule verified: Cannot reduce overflow capacity below active/confirmed bookings on overflow bays.');

    // 4G. Overstay Conflict Reassignment: Regular Slot -> Overflow Slot -> 100% Full Refund
    console.log('\n--- TEST 4G: OVERSTAY CONFLICT REASSIGNMENT PRIORITY & FULL REFUND ---');

    // Create an incoming booking on regularSlot A-01
    const incomingBooking = await BookingModel.create({
      bookingReference: `INCOME-${testSuffix}`,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: regularSlot._id,
      currentSlotId: regularSlot._id,
      vehicleId: vehicle._id,
      bookingStatus: 'Confirmed',
      bookingType: 'ONLINE',
      scheduledEntryTime: new Date(Date.now() + 100000),
      scheduledExitTime: new Date(Date.now() + 500000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
    });

    // Subtest 1: When overflowSlot is free, resolveOverstaySlotConflict reassigns to overflowSlot (since regularSlot A-01 is occupied)
    overflowSlot.slotStatus = 'Available';
    await overflowSlot.save();

    const overstayReassignRes = await barrierService.resolveOverstaySlotConflict(
      incomingBooking,
      parkingLot._id as mongoose.Types.ObjectId,
      'SIMULATOR',
    );
    if (!overstayReassignRes.success || overstayReassignRes.booking?.currentSlotId?._id?.toString() !== overflowSlot._id.toString()) {
      throw new Error(`Overstay reassignment failed to assign overflow slot! Got: ${JSON.stringify(overstayReassignRes)}`);
    }
    console.log(`✓ Overstay conflict reassignment Stage 2: Successfully assigned fallback overflow bay (${overflowSlot.slotNumber}) when regular bay was occupied.`);

    // Subtest 2: When both regularSlot and overflowSlot are blocked, resolveOverstaySlotConflict executes 100% FULL REFUND
    const incomingBooking2 = await BookingModel.create({
      bookingReference: `REFUND-${testSuffix}`,
      customerId: customer._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: regularSlot._id,
      currentSlotId: regularSlot._id,
      vehicleId: vehicle._id,
      bookingStatus: 'Confirmed',
      bookingType: 'ONLINE',
      scheduledEntryTime: new Date(Date.now() + 100000),
      scheduledExitTime: new Date(Date.now() + 500000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
    });

    // Mark overflow slot as Under Maintenance so no alternate exists in the facility
    overflowSlot.slotStatus = 'Under Maintenance';
    await overflowSlot.save();

    const fullRefundRes = await barrierService.resolveOverstaySlotConflict(
      incomingBooking2,
      parkingLot._id as mongoose.Types.ObjectId,
      'SIMULATOR',
    );
    if (fullRefundRes.success) {
      throw new Error('Overstay conflict should have failed and initiated full refund when no bay was available!');
    }

    const refundedBooking = await BookingModel.findById(incomingBooking2._id);
    if (
      refundedBooking?.bookingStatus !== 'Cancelled' ||
      refundedBooking?.slotReassignmentStatus !== 'CANCELLED_REFUNDED' ||
      refundedBooking?.refundAmount !== 100
    ) {
      throw new Error(`Full refund not initiated properly on overstay conflict! Booking: ${JSON.stringify(refundedBooking)}`);
    }
    console.log(`✓ Overstay conflict reassignment Stage 3: 100% full refund (₹${refundedBooking.refundAmount}) initiated when no regular or overflow bays were available.`);

    // Cleanup created test documents
    console.log('\n--- CLEANING UP TEST DATA ---');
    await BookingModel.deleteMany({ parkingLotId: parkingLot._id });
    await EmailLogModel.deleteMany({ parkingLotId: parkingLot._id });
    await SecurityStaffAssignmentModel.deleteMany({ parkingLotId: parkingLot._id });
    await ParkingLayoutModel.deleteMany({ parkingLotId: parkingLot._id });
    await ParkingSlotModel.deleteMany({ parkingLotId: parkingLot._id });
    await ParkingZoneModel.deleteMany({ parkingLotId: parkingLot._id });
    await ParkingFloorModel.deleteMany({ parkingLotId: parkingLot._id });
    await ParkingLotModel.deleteMany({ _id: parkingLot._id });
    await VehicleModel.deleteMany({ customerId: customer._id });
    await UserModel.deleteMany({ _id: { $in: [owner._id, securityStaff._id, customer._id, admin._id] } });
    console.log('✓ Test cleanup complete.');

    console.log('\n======================================================');
    console.log('🎉 ALL 4 CORE FEATURES FULLY VERIFIED AND PASSING! 🎉');
    console.log('======================================================');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test suite failed with error:', err);
    process.exit(1);
  });
