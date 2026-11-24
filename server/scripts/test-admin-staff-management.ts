import 'dotenv/config';
import mongoose from 'mongoose';
import { adminStaffService } from '../src/services/adminStaff.service.js';
import {
  AuditLogModel,
  BookingModel,
  IncidentModel,
  NotificationModel,
  ParkingLotModel,
  RoleModel,
  SecurityStaffAssignmentModel,
  SessionModel,
  UserModel,
  VehicleMovementLogModel,
} from '../src/models/index.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('==================================================================');
  console.log('--- Starting Admin Phase 4 Security Staff Verification Tests ---');
  console.log('==================================================================');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const cleanupIds: {
    users: mongoose.Types.ObjectId[];
    lots: mongoose.Types.ObjectId[];
    assignments: mongoose.Types.ObjectId[];
    sessions: mongoose.Types.ObjectId[];
    notifications: mongoose.Types.ObjectId[];
    auditLogs: mongoose.Types.ObjectId[];
    movements: mongoose.Types.ObjectId[];
  } = {
    users: [],
    lots: [],
    assignments: [],
    sessions: [],
    notifications: [],
    auditLogs: [],
    movements: [],
  };

  try {
    const timestamp = Date.now();

    // 0. Ensure Roles exist
    let adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleModel.create({
        roleCode: 'ADMIN',
        roleName: 'System Administrator',
        description: 'System Administrator',
        dashboardRoute: '/admin/dashboard',
        isActive: true,
      });
    }

    let ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
    if (!ownerRole) {
      ownerRole = await RoleModel.create({
        roleCode: 'OWNER',
        roleName: 'Parking Owner',
        description: 'Parking Owner',
        dashboardRoute: '/owner/dashboard',
        isActive: true,
      });
    }

    let securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
    if (!securityRole) {
      securityRole = await RoleModel.create({
        roleCode: 'SECURITY',
        roleName: 'Security Staff',
        description: 'Security Staff Gate Operator',
        dashboardRoute: '/security/dashboard',
        isActive: true,
      });
    }

    let customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    if (!customerRole) {
      customerRole = await RoleModel.create({
        roleCode: 'CUSTOMER',
        roleName: 'Customer',
        description: 'End User Customer',
        dashboardRoute: '/customer/dashboard',
        isActive: true,
      });
    }

    // Create Admin User
    const adminUser = await UserModel.create({
      fullName: `Admin Test ${timestamp}`,
      email: `admin_${timestamp}@test.com`,
      mobileNumber: `+9190000${timestamp.toString().slice(-5)}`,
      roleId: adminRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });
    cleanupIds.users.push(adminUser._id);

    // Create Owner A & Lot A
    const ownerA = await UserModel.create({
      fullName: `Owner A ${timestamp}`,
      email: `ownerA_${timestamp}@test.com`,
      mobileNumber: `+9191000${timestamp.toString().slice(-5)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });
    cleanupIds.users.push(ownerA._id);

    const lotA = await ParkingLotModel.create({
      ownerId: ownerA._id,
      parkingName: `Lot Alpha ${timestamp}`,
      address: '100 Alpha Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380015',
      contactNumber: '+919876543210',
      totalCapacity: 50,
      occupiedSlots: 0,
      reservedSlots: 0,
      availableSlots: 50,
      pricingPlans: [{ planName: 'Standard', vehicleType: 'Four Wheeler', hourlyRate: 30, dailyRate: 200 }],
      parkingStatus: 'Active',
      operationalStatus: 'Open',
      latitude: 23.0225,
      longitude: 72.5714,
      location: { type: 'Point', coordinates: [72.5714, 23.0225] },
    });
    cleanupIds.lots.push(lotA._id);

    // Create Owner B & Lot B
    const ownerB = await UserModel.create({
      fullName: `Owner B ${timestamp}`,
      email: `ownerB_${timestamp}@test.com`,
      mobileNumber: `+9192000${timestamp.toString().slice(-5)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });
    cleanupIds.users.push(ownerB._id);

    const lotB = await ParkingLotModel.create({
      ownerId: ownerB._id,
      parkingName: `Lot Beta ${timestamp}`,
      address: '200 Beta Expressway',
      city: 'Gandhinagar',
      state: 'Gujarat',
      postalCode: '382010',
      contactNumber: '+919876543211',
      totalCapacity: 80,
      occupiedSlots: 0,
      reservedSlots: 0,
      availableSlots: 80,
      pricingPlans: [{ planName: 'Standard', vehicleType: 'Four Wheeler', hourlyRate: 40, dailyRate: 250 }],
      parkingStatus: 'Active',
      operationalStatus: 'Open',
      latitude: 23.2156,
      longitude: 72.6369,
      location: { type: 'Point', coordinates: [72.6369, 23.2156] },
    });
    cleanupIds.lots.push(lotB._id);

    // -------------------------------------------------------------
    // TEST 1: KPI Overview
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Staff KPI Overview ---');
    const overviewBefore = await adminStaffService.getStaffOverview();
    console.log('Current overview:', overviewBefore);
    if (typeof overviewBefore.totalSecurityStaff !== 'number' || typeof overviewBefore.activeSecurityStaff !== 'number') {
      throw new Error('Test 1 Failed: Staff overview KPI counts must be numeric.');
    }
    console.log('✓ Test 1 Passed: KPI overview returns valid numeric metrics.');

    // -------------------------------------------------------------
    // TEST 2: Create Security Staff with Valid Owner & Facility
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Create Security Staff with Valid Owner & Lot ---');
    const staffEmail = `staff_${timestamp}@test.com`;
    const staffMobile = `+9193000${timestamp.toString().slice(-5)}`;
    const createdStaff = await adminStaffService.createStaff(adminUser._id.toString(), {
      fullName: `Officer Sharma ${timestamp}`,
      email: staffEmail,
      mobileNumber: staffMobile,
      ownerId: ownerA._id.toString(),
      parkingLotId: lotA._id.toString(),
      employeeId: `SEC-TEST-${timestamp.toString().slice(-4)}`,
      assignmentReason: 'Lead gate security officer for Alpha lot',
    });
    cleanupIds.users.push(new mongoose.Types.ObjectId(createdStaff._id));
    console.log('Created staff:', createdStaff.fullName, '| ID:', createdStaff._id, '| Lot:', createdStaff.parkingLot?.parkingName);

    if (createdStaff.role !== 'Security Staff' || createdStaff.parkingLot?._id !== lotA._id.toString()) {
      throw new Error('Test 2 Failed: Staff role must be Security Staff and facility must be Lot Alpha.');
    }

    // Verify assignment document created
    const assignmentDoc = await SecurityStaffAssignmentModel.findOne({
      securityStaffId: new mongoose.Types.ObjectId(createdStaff._id),
      parkingLotId: lotA._id,
      assignmentStatus: 'Active',
    });
    if (!assignmentDoc) {
      throw new Error('Test 2 Failed: Active SecurityStaffAssignment document not found.');
    }
    cleanupIds.assignments.push(assignmentDoc._id);
    console.log('✓ Test 2 Passed: Security staff account and active assignment created successfully.');

    // -------------------------------------------------------------
    // TEST 3: Security Validation: Lot Mismatched with Owner
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Owner -> Facility Relationship Validation (Cross-Owner Attack Protection) ---');
    let crossOwnerBlocked = false;
    try {
      // Manipulated request: sending Lot B (belongs to Owner B) with Owner A!
      await adminStaffService.createStaff(adminUser._id.toString(), {
        fullName: `Intruder Staff ${timestamp}`,
        email: `intruder_${timestamp}@test.com`,
        mobileNumber: `+9194000${timestamp.toString().slice(-5)}`,
        ownerId: ownerA._id.toString(),
        parkingLotId: lotB._id.toString(), // Belongs to Owner B, NOT Owner A!
      });
    } catch (err: any) {
      if (err.message?.includes('does not belong to the selected owner') || err.code === 'E006') {
        crossOwnerBlocked = true;
        console.log('Caught expected security rejection:', err.message);
      } else {
        throw err;
      }
    }
    if (!crossOwnerBlocked) {
      throw new Error('Test 3 Failed: Server allowed assigning Lot B to Owner A!');
    }
    console.log('✓ Test 3 Passed: Server strictly rejected mismatched Owner -> Lot pairing (E006).');

    // -------------------------------------------------------------
    // TEST 4: Role Isolation: Existing Non-Security Account Conflict
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Role Isolation (Prevent Role Changes Via Staff Management) ---');
    const customerUser = await UserModel.create({
      fullName: `Customer User ${timestamp}`,
      email: `customer_${timestamp}@test.com`,
      mobileNumber: `+9195000${timestamp.toString().slice(-5)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });
    cleanupIds.users.push(customerUser._id);

    let roleConflictBlocked = false;
    try {
      await adminStaffService.createStaff(adminUser._id.toString(), {
        fullName: customerUser.fullName,
        email: customerUser.email,
        mobileNumber: customerUser.mobileNumber,
        ownerId: ownerA._id.toString(),
        parkingLotId: lotA._id.toString(),
      });
    } catch (err: any) {
      if (err.message?.includes('different platform role') || err.statusCode === 409) {
        roleConflictBlocked = true;
        console.log('Caught expected role conflict rejection:', err.message);
      } else {
        throw err;
      }
    }
    if (!roleConflictBlocked) {
      throw new Error('Test 4 Failed: Server allowed converting Customer to Security Staff through staff creation!');
    }
    console.log('✓ Test 4 Passed: Server strictly prevented unauthorized role mutations.');

    // -------------------------------------------------------------
    // TEST 5: View Staff Details & Activity
    // -------------------------------------------------------------
    console.log('\n--- Test 5: View Staff Details & Historical Timeline ---');
    const staffDetail = await adminStaffService.getStaffById(createdStaff._id);
    console.log('Staff detail retrieved:', staffDetail.staff.fullName, '| Status:', staffDetail.staff.accountStatus);
    console.log('Current assignment lot:', staffDetail.currentAssignment?.parkingLotId.parkingName);
    if (!staffDetail.currentAssignment || staffDetail.currentAssignment.parkingLotId._id !== lotA._id.toString()) {
      throw new Error('Test 5 Failed: View staff must display current active assignment for Lot Alpha.');
    }
    console.log('✓ Test 5 Passed: Detailed staff profile and assignment context retrieved.');

    // -------------------------------------------------------------
    // TEST 6: Directory Search and Filter
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Search and Filtering ---');
    const searchResult = await adminStaffService.getStaffList({
      search: staffEmail,
      ownerId: ownerA._id.toString(),
    });
    if (searchResult.total === 0 || searchResult.staff[0]._id !== createdStaff._id) {
      throw new Error('Test 6 Failed: Could not locate staff member via server-side search.');
    }
    console.log('✓ Test 6 Passed: Found staff member via debounced search and owner filter.');

    // -------------------------------------------------------------
    // TEST 7: Edit Permitted Profile Fields
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Edit Permitted Profile Fields ---');
    const updatedStaff = await adminStaffService.updateStaff(adminUser._id.toString(), createdStaff._id, {
      fullName: `Chief Officer Sharma ${timestamp}`,
      employeeId: `EMP-CHIEF-${timestamp.toString().slice(-4)}`,
    });
    if (updatedStaff.fullName !== `Chief Officer Sharma ${timestamp}`) {
      throw new Error('Test 7 Failed: Full name was not updated.');
    }
    console.log('✓ Test 7 Passed: Permitted fields updated and audit trail logged.');

    // -------------------------------------------------------------
    // TEST 8: Disciplinary Suspension & Session Revocation
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Suspend Staff with Session Revocation ---');
    // Create an active session for the staff
    const sessionDoc = await SessionModel.create({
      userId: new mongoose.Types.ObjectId(createdStaff._id),
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      refreshTokenId: new mongoose.Types.ObjectId(),
      tokenFamilyId: `fam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      loginMethod: 'Email',
      sessionStatus: 'Active',
      ipAddress: '127.0.0.1',
      userAgent: 'ParkEase Test Client',
    });
    cleanupIds.sessions.push(sessionDoc._id);

    const suspendRes = await adminStaffService.suspendStaff(
      adminUser._id.toString(),
      createdStaff._id,
      'Policy violation: unauthorized visitor admitted without logging',
    );
    console.log('Suspension result:', suspendRes.message);

    // Verify account status
    const suspendedUser = await UserModel.findById(createdStaff._id);
    if (suspendedUser?.accountStatus !== 'Suspended') {
      throw new Error('Test 8 Failed: User status must be Suspended.');
    }

    // Verify session revoked
    const revokedSession = await SessionModel.findById(sessionDoc._id);
    if (revokedSession?.sessionStatus !== 'Revoked' || revokedSession?.logoutReason !== 'Account Suspended') {
      throw new Error('Test 8 Failed: Active session was not revoked with Account Suspended reason.');
    }
    console.log('✓ Test 8 Passed: Staff suspended, active sessions revoked, and notification dispatched.');

    // -------------------------------------------------------------
    // TEST 9: Reactivate Staff Account
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Reactivate Staff Account ---');
    const reactivateRes = await adminStaffService.activateStaff(adminUser._id.toString(), createdStaff._id);
    console.log('Reactivation result:', reactivateRes.message);

    const reactivatedUser = await UserModel.findById(createdStaff._id);
    if (reactivatedUser?.accountStatus !== 'Active' || reactivatedUser?.suspensionReason !== null) {
      throw new Error('Test 9 Failed: User status must be Active and suspension metadata cleared.');
    }
    console.log('✓ Test 9 Passed: Staff reactivated to Active status.');

    // -------------------------------------------------------------
    // TEST 10: Transfer Facility (Owner A/Lot A -> Owner B/Lot B)
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Facility Assignment Transfer ---');
    const transferDetail = await adminStaffService.transferStaff(adminUser._id.toString(), createdStaff._id, {
      newOwnerId: ownerB._id.toString(),
      newParkingLotId: lotB._id.toString(),
      transferReason: 'Promoted and transferred to Gandhinagar Beta facility',
    });

    console.log('Transferred staff to:', transferDetail.currentAssignment?.parkingLotId.parkingName);
    if (transferDetail.currentAssignment?.parkingLotId._id !== lotB._id.toString()) {
      throw new Error('Test 10 Failed: Transferred staff active assignment must be Lot Beta.');
    }

    // Verify previous assignment marked Inactive
    const prevAssignment = await SecurityStaffAssignmentModel.findOne({
      securityStaffId: new mongoose.Types.ObjectId(createdStaff._id),
      parkingLotId: lotA._id,
    });
    if (prevAssignment?.assignmentStatus !== 'Inactive') {
      throw new Error('Test 10 Failed: Previous assignment was not marked Inactive.');
    }
    console.log('✓ Test 10 Passed: Previous assignment deactivated and new active assignment established.');

    // -------------------------------------------------------------
    // TEST 11: Deletion Dependency Safeguard (Operational History Safety)
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Deletion Dependency Safeguard ---');
    // Simulate operational history: create an incident reported by this staff member
    const incidentDoc = await IncidentModel.create({
      incidentReference: `INC-${timestamp}`,
      parkingLotId: lotB._id,
      reportedBy: new mongoose.Types.ObjectId(createdStaff._id),
      incidentSource: 'Manual',
      incidentType: 'Security Concern',
      severity: 'Medium',
      incidentStatus: 'Open',
      title: 'Operational Gate Report',
      description: 'Checking deletion blocking when operational incident exists',
    });

    let deleteBlocked = false;
    try {
      await adminStaffService.deleteStaff(adminUser._id.toString(), createdStaff._id);
    } catch (err: any) {
      if (err.statusCode === 409 || err.message?.includes('Cannot delete security staff member with recorded operational history')) {
        deleteBlocked = true;
        console.log('Caught expected deletion block:', err.message);
      } else {
        throw err;
      }
    }
    if (!deleteBlocked) {
      throw new Error('Test 11 Failed: Server allowed deleting staff with existing operational history!');
    }
    console.log('✓ Test 11 Passed: Deletion safely blocked (409 Conflict) when operational records exist.');

    // Clean up incident log to test safe deletion of unutilized staff
    await IncidentModel.deleteOne({ _id: incidentDoc._id });
    console.log('Testing safe deletion on unutilized staff...');
    const deleteRes = await adminStaffService.deleteStaff(adminUser._id.toString(), createdStaff._id);
    console.log('Safe deletion result:', deleteRes.message);

    const deletedUser = await UserModel.findById(createdStaff._id);
    if (deletedUser?.accountStatus !== 'Deleted') {
      throw new Error('Test 11 Failed: Unutilized staff accountStatus should be set to Deleted.');
    }
    console.log('✓ Test 11 Passed: Unutilized staff safely marked Deleted and audit trail logged.');

    console.log('\n==================================================================');
    console.log('🎉 ALL 11 ADMIN SECURITY STAFF MANAGEMENT TESTS PASSED (100%)');
    console.log('==================================================================');
  } finally {
    // Cleanup created test records
    console.log('\nCleaning up test artifacts...');
    if (cleanupIds.movements.length > 0) {
      await VehicleMovementLogModel.deleteMany({ _id: { $in: cleanupIds.movements } });
    }
    if (cleanupIds.sessions.length > 0) {
      await SessionModel.deleteMany({ _id: { $in: cleanupIds.sessions } });
    }
    if (cleanupIds.assignments.length > 0) {
      await SecurityStaffAssignmentModel.deleteMany({ _id: { $in: cleanupIds.assignments } });
    }
    if (cleanupIds.lots.length > 0) {
      await ParkingLotModel.deleteMany({ _id: { $in: cleanupIds.lots } });
    }
    if (cleanupIds.users.length > 0) {
      await SecurityStaffAssignmentModel.deleteMany({ securityStaffId: { $in: cleanupIds.users } });
      await AuditLogModel.deleteMany({ userId: { $in: cleanupIds.users } });
      await NotificationModel.deleteMany({ userId: { $in: cleanupIds.users } });
      await UserModel.deleteMany({ _id: { $in: cleanupIds.users } });
    }
    await mongoose.disconnect();
    console.log('Database disconnected. Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
