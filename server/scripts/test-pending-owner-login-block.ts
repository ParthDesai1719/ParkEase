import assert from 'node:assert';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { OwnerApplicationModel } from '../src/models/OwnerApplication.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { adminService } from '../src/services/admin.service.js';
import { authService } from '../src/services/auth.service.js';

console.log('================================================================');
console.log('  ParkEase — Pending Parking Owner Login Prevention Test Suite');
console.log('================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB Atlas.\n');

  // Find customer and owner roles
  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
  assert(customerRole, 'Customer role must exist in system');
  const ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
  assert(ownerRole, 'Owner role must exist in system');

  const uniqueId = Date.now().toString().slice(-6);
  const testEmail = `pending_owner_${uniqueId}@testparkease.com`;
  const testMobile = `+9198755${uniqueId.slice(-5)}`;

  // 1. Create an Applicant User with customer role and Pending Approval (before admin approves)
  const applicantUser = await UserModel.create({
    fullName: `Pending Owner Test ${uniqueId}`,
    email: testEmail,
    mobileNumber: testMobile,
    roleId: customerRole._id,
    accountStatus: 'Pending Approval',
    emailVerified: true,
    mobileVerified: true,
  });

  // 2. Create the OwnerApplication in 'Pending Review' status
  const ownerApp = await OwnerApplicationModel.create({
    applicantId: applicantUser._id,
    applicationReference: `APP-PENDING-${uniqueId}`,
    businessName: `Metro Plaza Parking ${uniqueId}`,
    businessType: 'Commercial Parking',
    businessAddress: '100 Marine Drive',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400020',
    parkingCapacity: 120,
    businessDescription: 'Prime commercial parking',
    ownerName: applicantUser.fullName,
    businessEmail: testEmail,
    businessPhone: testMobile,
    governmentIdType: 'Aadhaar',
    governmentIdNumber: '9988-7766-5544',
    identityProofUrl: 'uploads/owner/dummy.pdf',
    businessLicenseUrl: 'uploads/owner/dummy.pdf',
    propertyProofUrl: 'uploads/owner/dummy.pdf',
    parkingImageUrls: ['uploads/owner/dummy.jpg'],
    termsAccepted: true,
    emailOtpVerified: true,
    mobileOtpVerified: true,
    applicationStatus: 'Pending Review',
    submittedAt: new Date(),
  });

  console.log(`[SETUP] Created test applicant: ${applicantUser.email} (Role: Customer, Status: Pending Approval)`);
  console.log(`[SETUP] Created OwnerApplication: ${ownerApp.applicationReference} (Status: Pending Review)\n`);

  try {
    // -------------------------------------------------------------
    // TEST 1: Request Login OTP by Email before approval
    // -------------------------------------------------------------
    console.log('[TEST 1] Attempting to request login OTP via Email for unapproved owner...');
    const emailRes = await fetch('http://localhost:5000/api/v1/auth/login/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'email',
        email: testEmail,
      }),
    });

    const emailJson = (await emailRes.json()) as { success: boolean; message: string; errorCode?: string };
    console.log(`  Response Status: ${emailRes.status}`);
    console.log(`  Error Code: ${emailJson.errorCode}`);
    console.log(`  Message: "${emailJson.message}"`);

    assert.strictEqual(emailRes.status, 403, 'Must return HTTP 403 Forbidden');
    assert.strictEqual(emailJson.success, false, 'Success flag must be false');
    assert.strictEqual(emailJson.errorCode, 'E043', 'Error code must be E043');
    assert(emailJson.message.includes('pending administrator review and approval'), 'Message must inform user of pending approval');
    console.log('✓ TEST 1 PASSED: Email login OTP request blocked with clear approval error.\n');

    // -------------------------------------------------------------
    // TEST 2: Request Login OTP by Mobile before approval
    // -------------------------------------------------------------
    console.log('[TEST 2] Attempting to request login OTP via Mobile for unapproved owner...');
    const mobileRes = await fetch('http://localhost:5000/api/v1/auth/login/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'mobile',
        mobileNumber: testMobile,
      }),
    });

    const mobileJson = (await mobileRes.json()) as { success: boolean; message: string; errorCode?: string };
    console.log(`  Response Status: ${mobileRes.status}`);
    console.log(`  Error Code: ${mobileJson.errorCode}`);
    console.log(`  Message: "${mobileJson.message}"`);

    assert.strictEqual(mobileRes.status, 403, 'Must return HTTP 403 Forbidden');
    assert.strictEqual(mobileJson.success, false, 'Success flag must be false');
    assert.strictEqual(mobileJson.errorCode, 'E043', 'Error code must be E043');
    console.log('✓ TEST 2 PASSED: Mobile login OTP request blocked with clear approval error.\n');

    // -------------------------------------------------------------
    // TEST 3: Attempt direct verify OTP without approval
    // -------------------------------------------------------------
    console.log('[TEST 3] Attempting to verify login OTP for unapproved owner...');
    const verifyRes = await fetch('http://localhost:5000/api/v1/auth/login/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'email',
        email: testEmail,
        otp: '123456',
      }),
    });

    const verifyJson = (await verifyRes.json()) as { success: boolean; errorCode?: string };
    assert.strictEqual(verifyRes.status, 403, 'Verify OTP must return HTTP 403');
    assert.strictEqual(verifyJson.errorCode, 'E043', 'Error code must be E043');
    console.log('✓ TEST 3 PASSED: verifyLoginOtp strictly blocks unapproved owner.\n');

    // -------------------------------------------------------------
    // TEST 4: Customer Registration Collision Guard
    // -------------------------------------------------------------
    console.log('[TEST 4] Attempting to register as a customer using pending owner details...');
    const regRes = await fetch('http://localhost:5000/api/v1/auth/register/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: applicantUser.fullName,
        email: testEmail,
        mobileNumber: testMobile,
        vehicleNumber: `MH01AB${uniqueId.slice(-4)}`,
        vehicleType: 'Car',
        termsAccepted: true,
      }),
    });

    const regJson = (await regRes.json()) as { success: boolean; errorCode?: string };
    assert.strictEqual(regRes.status, 409, 'Must return 409 Conflict');
    assert.strictEqual(regJson.success, false);
    console.log('✓ TEST 4 PASSED: Customer registration with pending owner details rejected (409 Conflict).\n');

    // -------------------------------------------------------------
    // TEST 5: Verify login works AFTER Admin Approval
    // -------------------------------------------------------------
    console.log('[TEST 5] Simulating Administrator Approval...');
    const adminUser = await UserModel.findOne({ roleId: (await RoleModel.findOne({ roleCode: 'ADMIN' }))?._id });
    assert(adminUser, 'Admin user must exist');

    await adminService.approveOwnerApplication({
      id: ownerApp.applicationReference,
      adminUserId: adminUser._id.toString(),
      adminRoleId: adminUser.roleId.toString(),
      remarks: 'Application approved by test suite.',
    });

    // Check user state in DB
    const updatedUser = await UserModel.findById(applicantUser._id).populate('roleId');
    assert.strictEqual(updatedUser?.accountStatus, 'Active', 'Account status must be Active after approval');
    assert.strictEqual((updatedUser?.roleId as unknown as { roleCode: string })?.roleCode, 'OWNER', 'Role must now be OWNER');
    console.log(`  User promoted to: ${(updatedUser?.roleId as unknown as { roleCode: string })?.roleCode}, Status: ${updatedUser?.accountStatus}`);

    // Now request login OTP via authService
    const approvedLoginResult = await authService.requestLoginOtp({
      method: 'email',
      email: testEmail,
    });

    console.log(`  Message: "${approvedLoginResult.message}"`);
    assert(approvedLoginResult.message.includes('Verification code sent'), 'Must succeed after approval');
    console.log('✓ TEST 5 PASSED: Approved Parking Owner can successfully request login OTP.\n');

    console.log('================================================================');
    console.log('  ALL PENDING OWNER LOGIN PREVENTION TESTS PASSED (5/5)!');
    console.log('================================================================');
  } finally {
    // Teardown test records
    await OwnerApplicationModel.deleteOne({ _id: ownerApp._id });
    await UserModel.deleteOne({ _id: applicantUser._id });
    await mongoose.disconnect();
    console.log('\n[TEARDOWN] Test data cleaned up & database disconnected.');
  }
}

run().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
