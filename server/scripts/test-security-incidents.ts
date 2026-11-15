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
import { IncidentModel } from '../src/models/Incident.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { BookingModel } from '../src/models/Booking.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('--- Starting Incident Reports & Custom Time Range Automated Test Suite ---');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  try {
    const timestamp = Date.now();

    // 1. Master Roles
    const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
    const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });

    if (!securityRole || !ownerRole) {
      throw new Error('Required roles not found in database.');
    }

    // 2. Create Owner User
    const owner = await UserModel.create({
      fullName: `Incident Test Owner ${timestamp}`,
      email: `owner_${timestamp}@incidenttest.com`,
      mobileNumber: `+9198${String(timestamp).slice(-8)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 3. Create Security Staff (Assigned)
    const staff = await UserModel.create({
      fullName: `Officer Incident ${timestamp}`,
      email: `security_${timestamp}@incidenttest.com`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 4. Create Unassigned Security Staff
    const unassignedStaff = await UserModel.create({
      fullName: `Unassigned Officer ${timestamp}`,
      email: `unassigned_${timestamp}@incidenttest.com`,
      mobileNumber: `+9196${String(timestamp).slice(-8)}`,
      roleId: securityRole._id,
      accountStatus: 'Active',
      mobileVerified: true,
      emailVerified: true,
    });

    // 5. Create Parking Facility Hierarchy
    const lot = await ParkingLotModel.create({
      ownerId: owner._id,
      parkingName: `Incident Facility ${timestamp}`,
      address: '100 Incident Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      latitude: 18.922,
      longitude: 72.834,
      location: {
        type: 'Point',
        coordinates: [72.834, 18.922],
      },
      contactNumber: '+919999999999',
      totalSlots: 10,
      hourlyRate: 50,
      gracePeriodMinutes: 15,
      parkingStatus: 'Active',
      operationalStatus: 'Open',
    });

    const floor = await ParkingFloorModel.create({
      parkingLotId: lot._id,
      floorNumber: 1,
      floorName: 'Ground Floor',
      floorStatus: 'Active',
    });

    const zone = await ParkingZoneModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneCode: 'A',
      zoneName: 'Zone A',
      zoneStatus: 'Active',
    });

    const slot = await ParkingSlotModel.create({
      parkingLotId: lot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'A-101',
      slotLabel: 'Bay A-101',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-SLOT-${timestamp}-101`,
    });

    // 6. Assign Staff Member to this Parking Facility
    await SecurityStaffAssignmentModel.create({
      securityStaffId: staff._id,
      parkingLotId: lot._id,
      ownerId: owner._id,
      assignedBy: owner._id,
      assignmentStatus: 'Active',
      assignedAt: new Date(),
      employeeId: `SEC-${String(timestamp).slice(-4)}`,
    });

    console.log('✓ Test fixtures successfully created.');

    // ------------------------------------------------------------------------
    // TEST 1: Walk-in Booking Custom Time Range (2.5 hours)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 1: Walk-in Tariff & Booking with Custom Time Range (2.5 hours) ---');
    const now = new Date();
    const entryDate = now;
    const exitDate = new Date(now.getTime() + 2.5 * 60 * 60 * 1000); // 2 hours 30 mins

    const tariff = await securityService.calculateWalkInTariff({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      vehicleType: 'Car',
      entryTime: entryDate.toISOString(),
      exitTime: exitDate.toISOString(),
    });

    console.log(`Calculated Duration: ${tariff.durationHours} hrs, Rate: ₹${tariff.hourlyRate}/hr, Total: ₹${tariff.totalAmount}`);
    if (tariff.durationHours !== 2.5) {
      throw new Error(`Expected durationHours to be 2.5, got ${tariff.durationHours}`);
    }
    const expectedAmount = Math.ceil(50 * 2.5); // 125
    if (tariff.totalAmount !== expectedAmount) {
      throw new Error(`Expected totalAmount to be ₹${expectedAmount}, got ₹${tariff.totalAmount}`);
    }

    const testVehicleNumber = `MH02CT${String(timestamp).slice(-4)}`;
    const testCustomerMobile = `9822${String(timestamp).slice(-6)}`;

    // Create walk-in booking using custom time range
    const walkinBooking = await securityService.createWalkInBooking({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      customerName: 'Custom Time Customer',
      customerMobile: testCustomerMobile,
      vehicleNumber: testVehicleNumber,
      vehicleType: 'Car',
      entryTime: entryDate.toISOString(),
      exitTime: exitDate.toISOString(),
      slotSelectionMode: 'AUTO',
      cashCollected: true,
      cashAmountCollected: tariff.totalAmount,
      staffNotes: 'Customer reserved 2.5 hours custom window',
    });

    if (walkinBooking.booking.durationHours !== 2.5) {
      throw new Error(`Expected booking duration to be 2.5 hours, got ${walkinBooking.booking.durationHours}`);
    }
    if (walkinBooking.booking.durationMinutes !== 150) {
      throw new Error(`Expected booking duration to be 150 minutes, got ${walkinBooking.booking.durationMinutes}`);
    }
    console.log('✓ Test 1 Passed: Custom From-To walk-in tariff and booking calculated with exact fractional hours.');

    // ------------------------------------------------------------------------
    // TEST 2: Create Incident Report with All Specified Fields
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Create Security Incident Report ---');
    const createdIncident = await securityService.createIncident({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      title: 'Exit Barrier Arm Hit by Vehicle',
      description: `Vehicle ${testVehicleNumber} attempted early exit without pass presentation, causing light scratch to barrier gate arm.`,
      incidentType: 'Vehicle Damage',
      severity: 'High',
      vehicleNumber: testVehicleNumber,
      bookingReference: walkinBooking.booking.bookingReference,
      location: 'Exit Lane 1',
      attachments: ['/api/v1/security/incidents/images/scratch1.jpg'],
    });

    console.log(`Created Incident: ${createdIncident.incidentReference}, Type: ${createdIncident.incidentType}, Severity: ${createdIncident.severity}`);
    if (!createdIncident.incidentReference.startsWith('INC-')) {
      throw new Error('Incident reference format invalid');
    }
    if (createdIncident.incidentStatus !== 'Open') {
      throw new Error(`Expected incidentStatus to be Open, got ${createdIncident.incidentStatus}`);
    }
    if (createdIncident.attachments.length !== 1) {
      throw new Error(`Expected 1 attachment, got ${createdIncident.attachments.length}`);
    }

    // Verify audit log
    const audit = await AuditLogModel.findOne({
      actionCode: 'INCIDENT_REPORTED',
      targetDocumentId: new mongoose.Types.ObjectId(createdIncident._id),
    });
    if (!audit) {
      throw new Error('Audit log record for INCIDENT_REPORTED was not found');
    }
    console.log('✓ Test 2 Passed: Incident created with persistent database document and audit log.');

    // ------------------------------------------------------------------------
    // TEST 3: Strict Facility-Level Access Control Check
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Unassigned Security Staff Facility Access Rejection ---');
    try {
      await securityService.getIncidents({
        staffUserId: unassignedStaff._id.toString(),
        parkingLotId: lot._id.toString(),
      });
      throw new Error('Unassigned staff should NOT have been allowed to view incidents');
    } catch (err: any) {
      if (err.message.includes('NOT have been allowed')) throw err;
      console.log(`✓ Caught expected facility boundary rejection: ${err.message}`);
    }

    try {
      await securityService.createIncident({
        staffUserId: unassignedStaff._id.toString(),
        parkingLotId: lot._id.toString(),
        title: 'Unauthorized Incident Report',
        description: 'Should fail immediately due to unassigned post',
        incidentType: 'Other',
      });
      throw new Error('Unassigned staff should NOT have been allowed to create incident');
    } catch (err: any) {
      if (err.message.includes('NOT have been allowed')) throw err;
      console.log(`✓ Caught expected facility creation boundary rejection: ${err.message}`);
    }
    console.log('✓ Test 3 Passed: Facility authorization strictly enforced.');

    // ------------------------------------------------------------------------
    // TEST 4: Get Incidents List with Filtering, Search, and KPI Metrics
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: List Incidents with Filters and KPI Metrics ---');
    const listResult = await securityService.getIncidents({
      staffUserId: staff._id.toString(),
      parkingLotId: lot._id.toString(),
      status: 'Open',
      severity: 'High',
      search: 'Barrier',
    });

    console.log(`Incidents Count: ${listResult.incidents.length}, Summary Total: ${listResult.summary.total}, Open: ${listResult.summary.open}`);
    if (listResult.incidents.length === 0) {
      throw new Error('Expected at least 1 matching incident');
    }
    if (listResult.summary.open < 1) {
      throw new Error('KPI summary open count should be >= 1');
    }
    console.log('✓ Test 4 Passed: Incident query with filters, search, and KPI aggregation succeeded.');

    // ------------------------------------------------------------------------
    // TEST 5: Retrieve Full Incident Details with Populated References
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Retrieve Incident Details by ID ---');
    const detail = await securityService.getIncidentDetail({
      staffUserId: staff._id.toString(),
      incidentId: createdIncident._id,
    });

    if (detail.incidentReference !== createdIncident.incidentReference) {
      throw new Error('Incident detail reference mismatch');
    }
    if (!detail.reportedBy || !detail.reportedBy.fullName) {
      throw new Error('Reporter was not populated properly');
    }
    console.log(`✓ Test 5 Passed: Populated detail retrieved for incident ${detail.incidentReference}.`);

    // ------------------------------------------------------------------------
    // TEST 6: Status Transitions (Open -> Resolved -> Closed) with Notes
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Status Transitions & Resolution Notes ---');
    const resolvedIncident = await securityService.updateIncidentStatus({
      staffUserId: staff._id.toString(),
      incidentId: createdIncident._id,
      status: 'Resolved',
      resolutionNotes: 'Driver admitted fault and settled ₹1,500 minor repair fee. Barrier inspected and operational.',
    });

    if (resolvedIncident.incidentStatus !== 'Resolved') {
      throw new Error(`Expected status to be Resolved, got ${resolvedIncident.incidentStatus}`);
    }
    if (!resolvedIncident.resolvedAt) {
      throw new Error('resolvedAt timestamp was not set');
    }
    if (!resolvedIncident.resolutionNotes?.includes('₹1,500')) {
      throw new Error('resolutionNotes were not saved');
    }

    // Transition to Closed
    const closedIncident = await securityService.updateIncidentStatus({
      staffUserId: staff._id.toString(),
      incidentId: createdIncident._id,
      status: 'Closed',
      resolutionNotes: 'Incident closed by security supervisor after shift inspection.',
    });

    if (closedIncident.incidentStatus !== 'Closed') {
      throw new Error(`Expected status to be Closed, got ${closedIncident.incidentStatus}`);
    }
    if (!closedIncident.closedAt) {
      throw new Error('closedAt timestamp was not set');
    }

    console.log('✓ Test 6 Passed: Status lifecycle transitions and resolution records verified.');

    console.log('\n======================================================');
    console.log('  ALL 6 TESTS PASSED SUCCESSFULLY (100% PASS RATE)     ');
    console.log('======================================================');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
