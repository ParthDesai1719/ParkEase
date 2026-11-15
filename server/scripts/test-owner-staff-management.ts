import 'dotenv/config';
import assert from 'node:assert';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { NotificationModel } from '../src/models/Notification.js';
import { OtpVerificationModel } from '../src/models/OtpVerification.js';
import { ownerService } from '../src/services/owner.service.js';
import { authService } from '../src/services/auth.service.js';
import { otpService } from '../src/services/otp.service.js';

console.log('========================================================================');
console.log('  ParkEase — Owner Module Phase 4: Staff Management Verification');
console.log('========================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
  const staffRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });
  const adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' });

  assert(ownerRole, 'Owner role must exist in DB');
  assert(customerRole, 'Customer role must exist in DB');
  assert(staffRole, 'Security staff role must exist in DB');

  const runId = Date.now().toString().slice(-6);

  // 1. Setup Test Owners
  const ownerA = await UserModel.create({
    fullName: `Owner Alpha Staff ${runId}`,
    email: `owner_staff_a_${runId}@parkease.com`,
    mobileNumber: `+9197100${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const ownerB = await UserModel.create({
    fullName: `Owner Beta Staff ${runId}`,
    email: `owner_staff_b_${runId}@parkease.com`,
    mobileNumber: `+9197200${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 2. Setup Test Parking Facilities
  const lotA1 = await ParkingLotModel.create({
    ownerId: ownerA._id,
    parkingName: `Alpha Central Lot ${runId}`,
    address: '101 Ring Road',
    contactNumber: '+919820011221',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380015',
    latitude: 23.0225,
    longitude: 72.5714,
    parkingCapacity: 100,
    parkingStatus: 'Active',
    hourlyRate: 50,
    location: { type: 'Point', coordinates: [72.5714, 23.0225] },
    isActive: true,
  });

  const lotA2 = await ParkingLotModel.create({
    ownerId: ownerA._id,
    parkingName: `Alpha North Lot ${runId}`,
    address: '202 SG Highway',
    contactNumber: '+919820011222',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380054',
    latitude: 23.0335,
    longitude: 72.5814,
    parkingCapacity: 100,
    parkingStatus: 'Active',
    hourlyRate: 50,
    location: { type: 'Point', coordinates: [72.5814, 23.0335] },
    isActive: true,
  });

  const lotB1 = await ParkingLotModel.create({
    ownerId: ownerB._id,
    parkingName: `Beta Hub Lot ${runId}`,
    address: '303 CG Road',
    contactNumber: '+919820011223',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postalCode: '380009',
    latitude: 23.0445,
    longitude: 72.5914,
    parkingCapacity: 100,
    parkingStatus: 'Active',
    hourlyRate: 50,
    location: { type: 'Point', coordinates: [72.5914, 23.0445] },
    isActive: true,
  });

  console.log(`✓ Test Setup complete: Owner A (${ownerA._id}), Owner B (${ownerB._id}), Lots A1, A2, B1 created.\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Invite New Security Staff
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Invite New Security Staff ---');
    const staffInput1 = {
      fullName: `Rajesh Sharma ${runId}`,
      email: `rajesh_sec_${runId}@parkease.com`,
      mobileNumber: `+9197300${runId.slice(-5)}`,
      parkingLotId: lotA1._id.toString(),
      employeeId: `SEC-A1-${runId}`,
      assignmentReason: 'Gate Console Day Shift Supervisor',
    };

    const invitedStaff1 = await ownerService.inviteOwnerStaff(ownerA._id.toString(), staffInput1);
    assert.strictEqual(invitedStaff1.fullName, staffInput1.fullName);
    assert.strictEqual(invitedStaff1.email, staffInput1.email);
    assert.strictEqual(invitedStaff1.accountStatus, 'Pending Verification');
    assert.strictEqual(invitedStaff1.invitationStatus, 'Sent');
    assert.strictEqual(invitedStaff1.employeeId, staffInput1.employeeId);
    assert(invitedStaff1.assignedParkingLot, 'Assigned parking lot should be present');
    assert.strictEqual(invitedStaff1.assignedParkingLot?.lotName, lotA1.parkingName);

    // Verify database record
    const userDb = await UserModel.findById(invitedStaff1._id);
    assert.strictEqual(userDb?.accountStatus, 'Pending Verification');
    assert.strictEqual(userDb?.roleId.toString(), staffRole._id.toString());

    // Verify active assignment
    const assignmentDb = await SecurityStaffAssignmentModel.findOne({
      securityStaffId: invitedStaff1._id,
      parkingLotId: lotA1._id,
      assignmentStatus: 'Active',
    });
    assert(assignmentDb, 'Active assignment must exist in database');
    assert.strictEqual(assignmentDb?.ownerId.toString(), ownerA._id.toString());
    assert.strictEqual(assignmentDb?.employeeId, staffInput1.employeeId);

    // Verify Audit Log
    const auditLog1 = await AuditLogModel.findOne({
      actionCode: 'STAFF_INVITED',
      module: 'Staff Management',
      userId: ownerA._id,
    });
    assert(auditLog1, 'STAFF_INVITED audit log must be recorded');
    console.log('✓ TEST 1 PASSED: New security staff created with Pending Verification and active lot assignment.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Assign Staff to Additional Facility (Multi-Facility Assignment)
    // -------------------------------------------------------------------------
    console.log('--- TEST 2: Multi-Facility Assignment Under Same Owner ---');
    const assignResult = await ownerService.assignOwnerStaff(
      ownerA._id.toString(),
      invitedStaff1._id,
      {
        parkingLotId: lotA2._id.toString(),
        employeeId: `SEC-A2-${runId}`,
        assignmentReason: 'Weekend rover coverage',
      },
    );

    assert.strictEqual(assignResult.staff.activeAssignments.length, 2, 'Staff must now have 2 active assignments');
    const assignedLotIds = assignResult.staff.activeAssignments.map((a) => a.parkingLotId);
    assert(assignedLotIds.includes(lotA1._id.toString()), 'Must be assigned to lot A1');
    assert(assignedLotIds.includes(lotA2._id.toString()), 'Must be assigned to lot A2');
    console.log('✓ TEST 2 PASSED: Security staff actively assigned to multiple facilities under same owner.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate Active Assignment Prevention
    // -------------------------------------------------------------------------
    console.log('--- TEST 3: Duplicate Active Assignment Prevention ---');
    let duplicateErrorThrown = false;
    try {
      await ownerService.assignOwnerStaff(
        ownerA._id.toString(),
        invitedStaff1._id,
        {
          parkingLotId: lotA1._id.toString(),
        },
      );
    } catch (err: any) {
      duplicateErrorThrown = true;
      assert.strictEqual(err.statusCode, 409);
      assert(err.message.includes('already actively assigned'), 'Must reject duplicate active assignment');
    }
    assert(duplicateErrorThrown, 'Assigning staff to the same facility twice must throw 409');
    console.log('✓ TEST 3 PASSED: Duplicate active facility assignment strictly prevented with 409 Conflict.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Cross-Owner Isolation & Unauthorized Facility Assignment
    // -------------------------------------------------------------------------
    console.log('--- TEST 4: Cross-Owner Access Control & Isolation ---');
    // Owner B cannot view Owner A's staff
    let ownerBCannotView = false;
    try {
      await ownerService.getOwnerStaffById(ownerB._id.toString(), invitedStaff1._id);
    } catch (err: any) {
      ownerBCannotView = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert(ownerBCannotView, 'Owner B must be forbidden from viewing Owner A staff');

    // Owner A cannot assign staff to Owner B's facility
    let ownerACannotAssignLotB = false;
    try {
      await ownerService.assignOwnerStaff(
        ownerA._id.toString(),
        invitedStaff1._id,
        {
          parkingLotId: lotB1._id.toString(),
        },
      );
    } catch (err: any) {
      ownerACannotAssignLotB = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert(ownerACannotAssignLotB, 'Owner A cannot assign staff to facility belonging to Owner B');

    // Owner B cannot suspend Owner A's staff
    let ownerBCannotSuspend = false;
    try {
      await ownerService.updateOwnerStaffStatus(
        ownerB._id.toString(),
        invitedStaff1._id,
        {
          accountStatus: 'Suspended',
        },
      );
    } catch (err: any) {
      ownerBCannotSuspend = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert(ownerBCannotSuspend, 'Owner B cannot suspend Owner A staff');
    console.log('✓ TEST 4 PASSED: Cross-owner boundaries strictly enforced across view, assign, and status.\n');

    // -------------------------------------------------------------------------
    // TEST 5: Platform Role Protection
    // -------------------------------------------------------------------------
    console.log('--- TEST 5: Platform Role Protection ---');
    const existingCustomer = await UserModel.create({
      fullName: `Existing Customer ${runId}`,
      email: `cust_platform_${runId}@parkease.com`,
      mobileNumber: `+9197400${runId.slice(-5)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });

    let customerConversionBlocked = false;
    try {
      await ownerService.inviteOwnerStaff(ownerA._id.toString(), {
        fullName: existingCustomer.fullName,
        email: existingCustomer.email,
        mobileNumber: existingCustomer.mobileNumber,
        parkingLotId: lotA1._id.toString(),
      });
    } catch (err: any) {
      customerConversionBlocked = true;
      assert.strictEqual(err.statusCode, 409);
      assert(err.message.includes('different platform role'), 'Must block converting customer to security');
    }
    assert(customerConversionBlocked, 'Cannot convert non-security platform role users');
    console.log('✓ TEST 5 PASSED: Platform role immutability strictly enforced.\n');

    // -------------------------------------------------------------------------
    // TEST 6: Directory Listing, Search, Filter & KPIs
    // -------------------------------------------------------------------------
    console.log('--- TEST 6: Staff Directory, Search, Filters & KPIs ---');
    // Add a second staff member for Owner A
    const staffInput2 = {
      fullName: `Vikram Patel ${runId}`,
      email: `vikram_sec_${runId}@parkease.com`,
      mobileNumber: `+9197500${runId.slice(-5)}`,
      parkingLotId: lotA2._id.toString(),
      employeeId: `SEC-VP-${runId}`,
    };
    const invitedStaff2 = await ownerService.inviteOwnerStaff(ownerA._id.toString(), staffInput2);

    // List all staff for Owner A
    const listResult = await ownerService.getOwnerStaff(ownerA._id.toString(), {});
    assert.strictEqual(listResult.total, 2, 'Owner A should have 2 staff members');
    assert.strictEqual(listResult.summary.totalStaff, 2);
    assert.strictEqual(listResult.summary.pendingInvitations, 2);

    // Filter by facility Lot A1
    const lotA1Staff = await ownerService.getOwnerStaff(ownerA._id.toString(), {
      parkingLotId: lotA1._id.toString(),
    });
    // Rajesh is assigned to A1 and A2; Vikram is assigned to A2
    assert.strictEqual(lotA1Staff.total, 1);
    assert.strictEqual(lotA1Staff.staff[0]._id, invitedStaff1._id);

    // Search by name
    const searchByName = await ownerService.getOwnerStaff(ownerA._id.toString(), {
      search: 'Vikram',
    });
    assert.strictEqual(searchByName.total, 1);
    assert.strictEqual(searchByName.staff[0].fullName, staffInput2.fullName);

    // Search by employee ID
    const searchByEmpId = await ownerService.getOwnerStaff(ownerA._id.toString(), {
      search: `SEC-VP-${runId}`,
    });
    assert.strictEqual(searchByEmpId.total, 1);
    assert.strictEqual(searchByEmpId.staff[0]._id, invitedStaff2._id);
    console.log('✓ TEST 6 PASSED: Directory listing, KPIs, facility filtering, and multi-field search verified.\n');

    // -------------------------------------------------------------------------
    // TEST 7: Permitted Staff Info Updates
    // -------------------------------------------------------------------------
    console.log('--- TEST 7: Permitted Staff Information Updates ---');
    const updatedStaff = await ownerService.updateOwnerStaff(
      ownerA._id.toString(),
      invitedStaff2._id,
      {
        fullName: `Vikram Patel Updated ${runId}`,
        employeeId: `SEC-VP-MOD-${runId}`,
      },
    );
    assert.strictEqual(updatedStaff.fullName, `Vikram Patel Updated ${runId}`);
    assert.strictEqual(updatedStaff.employeeId, `SEC-VP-MOD-${runId}`);

    // Verify Audit Log
    const auditLogUpdate = await AuditLogModel.findOne({
      actionCode: 'STAFF_UPDATED',
      userId: ownerA._id,
      targetDocumentId: new mongoose.Types.ObjectId(invitedStaff2._id),
    });
    assert(auditLogUpdate, 'STAFF_UPDATED audit log must be recorded');
    console.log('✓ TEST 7 PASSED: Permitted staff info updated with audit log verification.\n');

    // -------------------------------------------------------------------------
    // TEST 8: Resend Invitation Flow
    // -------------------------------------------------------------------------
    console.log('--- TEST 8: Resend Invitation ---');
    const resendResult = await ownerService.resendStaffInvitation(
      ownerA._id.toString(),
      invitedStaff1._id,
    );
    assert(resendResult.success, 'Resend invitation must report success');

    const auditLogResend = await AuditLogModel.findOne({
      actionCode: 'STAFF_INVITATION_RESENT',
      userId: ownerA._id,
    });
    assert(auditLogResend, 'STAFF_INVITATION_RESENT audit log must be recorded');
    console.log('✓ TEST 8 PASSED: Invitation email dispatch re-triggered and logged.\n');

    // -------------------------------------------------------------------------
    // TEST 9: Account Suspension & Authentication Barrier
    // -------------------------------------------------------------------------
    console.log('--- TEST 9: Account Suspension & Authentication Enforcement ---');
    // Suspend Vikram
    const suspendResult = await ownerService.updateOwnerStaffStatus(
      ownerA._id.toString(),
      invitedStaff2._id,
      {
        accountStatus: 'Suspended',
        reason: 'Temporary investigation',
      },
    );
    assert.strictEqual(suspendResult.staff.accountStatus, 'Suspended');

    // Verify suspended staff CANNOT request login OTP
    let suspendedLoginBlocked = false;
    try {
      await authService.requestLoginOtp({
        method: 'email',
        email: staffInput2.email,
      });
    } catch (err: any) {
      suspendedLoginBlocked = true;
      assert.strictEqual(err.statusCode, 403);
      assert(err.message.includes('suspended'), 'Must block login OTP request for suspended staff');
    }
    assert(suspendedLoginBlocked, 'Suspended security staff must be blocked from requesting OTP');

    // Reactivate Vikram
    const reactivateResult = await ownerService.updateOwnerStaffStatus(
      ownerA._id.toString(),
      invitedStaff2._id,
      {
        accountStatus: 'Active',
        reason: 'Investigation concluded, cleared for duty',
      },
    );
    assert.strictEqual(reactivateResult.staff.accountStatus, 'Active');

    // Now request OTP should succeed
    const otpResult = await authService.requestLoginOtp({
      method: 'email',
      email: staffInput2.email,
    });
    assert(otpResult.message.includes('Verification code sent'), 'OTP request must succeed after reactivation');
    console.log('✓ TEST 9 PASSED: Account suspension revokes authentication gate access; reactivation restores it.\n');

    // -------------------------------------------------------------------------
    // TEST 10: Facility Assignment Deactivation
    // -------------------------------------------------------------------------
    console.log('--- TEST 10: Specific Facility Assignment Deactivation ---');
    // Deactivate Rajesh from Lot A2 while keeping assignment on Lot A1 active
    const unassignResult = await ownerService.updateOwnerStaffStatus(
      ownerA._id.toString(),
      invitedStaff1._id,
      {
        assignmentStatus: 'Inactive',
        parkingLotId: lotA2._id.toString(),
        reason: 'Shift reassigned to Lot A1 exclusively',
      },
    );

    assert.strictEqual(unassignResult.staff.activeAssignments.length, 1, 'Only Lot A1 should remain active');
    assert.strictEqual(unassignResult.staff.activeAssignments[0].parkingLotId, lotA1._id.toString());

    // Verify assignment history has unassigned record
    const inactiveHistory = unassignResult.assignmentHistory.find(
      (h) => h.parkingLotId === lotA2._id.toString() && h.assignmentStatus === 'Inactive',
    );
    assert(inactiveHistory, 'Inactive assignment record must exist in history');
    assert(inactiveHistory?.unassignedAt, 'Unassigned timestamp must be preserved');
    console.log('✓ TEST 10 PASSED: Specific facility assignment deactivated while preserving history.\n');

    // -------------------------------------------------------------------------
    // TEST 11: Security Staff Passwordless Login & Activation
    // -------------------------------------------------------------------------
    console.log('--- TEST 11: Security Staff Passwordless Login & Auto-Activation ---');
    // Rajesh was created with 'Pending Verification'
    const rajeshBefore = await UserModel.findById(invitedStaff1._id);
    assert.strictEqual(rajeshBefore?.accountStatus, 'Pending Verification');

    // Request Login OTP for Rajesh
    await authService.requestLoginOtp({
      method: 'email',
      email: staffInput1.email,
    });

    // Find generated OTP in DB and verify
    const testOtpCode = '654321';
    const testHash = crypto.createHash('sha256').update(testOtpCode).digest('hex');

    const updateRes = await OtpVerificationModel.updateOne(
      {
        email: staffInput1.email,
        verificationType: 'LOGIN',
        verificationStatus: 'Pending',
      },
      {
        $set: { otpCodeHash: testHash },
      },
    );
    assert.strictEqual(updateRes.matchedCount, 1, 'Pending OTP verification record must exist');

    // Verify OTP and complete login
    const loginResult = await authService.verifyLoginOtp({
      method: 'email',
      email: staffInput1.email,
      otp: testOtpCode,
    });

    assert(loginResult.accessToken, 'Access token must be returned');
    assert.strictEqual(loginResult.user.email, staffInput1.email);

    // Verify Rajesh accountStatus automatically transitioned to 'Active' upon first OTP login
    const rajeshAfter = await UserModel.findById(invitedStaff1._id);
    assert.strictEqual(rajeshAfter?.accountStatus, 'Active', 'Must automatically activate on first login');
    assert.strictEqual(rajeshAfter?.emailVerified, true, 'Email must be marked verified');
    console.log('✓ TEST 11 PASSED: Security staff passwordless OTP login and activation workflow verified.\n');

    console.log('========================================================================');
    console.log('  ALL 11 OWNER STAFF MANAGEMENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } finally {
    // Cleanup test data
    console.log('Cleaning up test data...');
    await SecurityStaffAssignmentModel.deleteMany({
      ownerId: { $in: [ownerA._id, ownerB._id] },
    });
    await ParkingLotModel.deleteMany({
      _id: { $in: [lotA1._id, lotA2._id, lotB1._id] },
    });
    await UserModel.deleteMany({
      email: new RegExp(runId),
    });
    await AuditLogModel.deleteMany({
      userId: { $in: [ownerA._id, ownerB._id] },
    });
    console.log('✓ Cleanup complete.');
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
