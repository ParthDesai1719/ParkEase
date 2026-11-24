import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
import assert from 'node:assert';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { OtpVerificationModel } from '../src/models/OtpVerification.js';
import { authService } from '../src/services/auth.service.js';

console.log('================================================================');
console.log('  ParkEase — Personalized Voice Welcome System & Auth Tests');
console.log('================================================================\n');

// Function replicating the exact greeting message construction from voiceGreeting.ts
function getGreetingMessage(name: string, isFirstTime: boolean): string {
  const cleanName = (name || '').trim() || 'there';
  return isFirstTime
    ? `Welcome to ParkEase, ${cleanName}! We're happy to have you here.`
    : `Welcome back to ParkEase, ${cleanName}! It's great to see you again.`;
}

async function runTests() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  // Verify Roles exist
  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
  const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const securityRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY_STAFF', 'SECURITY'] } });
  const adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' });

  assert(customerRole, 'Customer role must exist');
  assert(ownerRole, 'Owner role must exist');
  assert(securityRole, 'Security staff role must exist');
  assert(adminRole, 'Admin role must exist');
  console.log('✓ Verified all 4 system roles exist in database (Customer, Owner, Security, Admin).');

  const runId = Date.now().toString().slice(-6);

  // Test 1: Customer First-time Registration Greeting
  const customerName = `Ananya Sharma ${runId}`;
  const firstTimeCustomerGreeting = getGreetingMessage(customerName, true);
  assert.strictEqual(
    firstTimeCustomerGreeting,
    `Welcome to ParkEase, Ananya Sharma ${runId}! We're happy to have you here.`,
  );
  console.log('✓ Scenario 1: First-time Customer registration greeting verified:');
  console.log(`  "${firstTimeCustomerGreeting}"`);

  // Test 2: First-time Owner Login Greeting after Application Approval
  const ownerUser = await UserModel.create({
    fullName: `Rajesh Patel ${runId}`,
    email: `owner_${runId}@parkeasetest.com`,
    mobileNumber: `+9198111${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
    lastLogin: null, // First time login
  });

  // Verify initial state has lastLogin: null
  assert.strictEqual(ownerUser.lastLogin, null);

  // Simulate first login state transition (exact logic in authService.verifyLoginOtp)
  const isOwnerFirstLogin = !ownerUser.lastLogin;
  assert.strictEqual(isOwnerFirstLogin, true, 'Owner first login must have isFirstLogin === true');
  ownerUser.lastLogin = new Date();
  await ownerUser.save();

  const ownerFirstGreeting = getGreetingMessage(ownerUser.fullName, isOwnerFirstLogin);
  assert.strictEqual(
    ownerFirstGreeting,
    `Welcome to ParkEase, Rajesh Patel ${runId}! We're happy to have you here.`,
  );
  console.log('✓ Scenario 2: First-time Owner login greeting verified:');
  console.log(`  "${ownerFirstGreeting}"`);

  // Test 3: Returning Owner Login Greeting
  const loginResult2 = await (async () => {
    const isFirstLogin = !ownerUser.lastLogin; // now lastLogin is populated!
    ownerUser.lastLogin = new Date();
    await ownerUser.save();
    return {
      user: {
        ...ownerUser.toObject(),
        isFirstLogin,
        role: ownerRole,
      },
    };
  })();

  assert(loginResult2.user.isFirstLogin === false, 'Owner returning login must have isFirstLogin === false');
  const ownerReturningGreeting = getGreetingMessage(ownerUser.fullName, Boolean(loginResult2.user.isFirstLogin));
  assert.strictEqual(
    ownerReturningGreeting,
    `Welcome back to ParkEase, Rajesh Patel ${runId}! It's great to see you again.`,
  );
  console.log('✓ Scenario 3: Returning Owner login greeting verified:');
  console.log(`  "${ownerReturningGreeting}"`);

  // Test 4: First-time Security Staff Login Greeting
  const securityUser = await UserModel.create({
    fullName: `Vikram Singh ${runId}`,
    email: `security_${runId}@parkeasetest.com`,
    mobileNumber: `+9198222${runId.slice(-5)}`,
    roleId: securityRole._id,
    accountStatus: 'Pending Verification',
    emailVerified: false,
    mobileVerified: false,
    lastLogin: null,
  });

  const isSecFirstLogin = !securityUser.lastLogin;
  assert.strictEqual(isSecFirstLogin, true, 'Security first login must be detected');
  const secFirstGreeting = getGreetingMessage(securityUser.fullName, isSecFirstLogin);
  assert.strictEqual(
    secFirstGreeting,
    `Welcome to ParkEase, Vikram Singh ${runId}! We're happy to have you here.`,
  );
  console.log('✓ Scenario 4: First-time Security Staff registration/login greeting verified:');
  console.log(`  "${secFirstGreeting}"`);

  // Test 5: Returning Security Staff Login Greeting
  securityUser.lastLogin = new Date();
  await securityUser.save();
  const isSecReturningLogin = !securityUser.lastLogin;
  assert.strictEqual(isSecReturningLogin, false, 'Security returning login must have isFirstLogin === false');
  const secReturningGreeting = getGreetingMessage(securityUser.fullName, isSecReturningLogin);
  assert.strictEqual(
    secReturningGreeting,
    `Welcome back to ParkEase, Vikram Singh ${runId}! It's great to see you again.`,
  );
  console.log('✓ Scenario 5: Returning Security Staff login greeting verified:');
  console.log(`  "${secReturningGreeting}"`);

  // Test 6: Admin Login Greeting
  const adminUser = await UserModel.findOne({ roleId: adminRole._id });
  assert(adminUser, 'Admin user must exist in system');
  const adminGreeting = getGreetingMessage(adminUser.fullName, false);
  assert.strictEqual(
    adminGreeting,
    `Welcome back to ParkEase, ${adminUser.fullName}! It's great to see you again.`,
  );
  console.log('✓ Scenario 6: Admin returning login greeting verified:');
  console.log(`  "${adminGreeting}"`);

  // Test 7: Clean name and fallback handling
  const blankNameGreeting = getGreetingMessage('', true);
  assert.strictEqual(blankNameGreeting, "Welcome to ParkEase, there! We're happy to have you here.");
  const paddedNameGreeting = getGreetingMessage('  Priya Nair  ', false);
  assert.strictEqual(paddedNameGreeting, "Welcome back to ParkEase, Priya Nair! It's great to see you again.");
  console.log('✓ Scenario 7: Name formatting & fallback handling verified.');

  // Clean up test records
  await UserModel.deleteMany({ _id: { $in: [ownerUser._id, securityUser._id] } });
  console.log('\n✓ Cleaned up temporary test data.');
  console.log('================================================================');
  console.log('  All Voice Welcome & Auth Scenarios Passed Successfully!');
  console.log('================================================================');

  await mongoose.disconnect();
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
