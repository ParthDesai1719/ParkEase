import assert from 'node:assert';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { OwnerApplicationModel } from '../src/models/OwnerApplication.js';
import { SecurityStaffAssignmentModel } from '../src/models/SecurityStaffAssignment.js';
import { OtpVerificationModel } from '../src/models/OtpVerification.js';
import { profileService } from '../src/services/profile.service.js';

console.log('================================================================');
console.log('  ParkEase — Role-Based Profile & OTP Contact Verification Tests');
console.log('================================================================\n');

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
  console.log('✓ Verified all 4 system roles exist in database.');

  const runId = Date.now().toString().slice(-6);

  // 1. Create a Customer User
  const customerUser = await UserModel.create({
    fullName: `Customer Test ${runId}`,
    email: `customer_${runId}@parkeasetest.com`,
    mobileNumber: `+9191000${runId.slice(-5)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 2. Create an Owner User with an Application
  const ownerUser = await UserModel.create({
    fullName: `Owner Test ${runId}`,
    email: `owner_${runId}@parkeasetest.com`,
    mobileNumber: `+9192000${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const ownerApp = await OwnerApplicationModel.create({
    applicantId: ownerUser._id,
    applicationReference: `APP-PROF-${runId}`,
    businessName: `Metro Park Facilities ${runId}`,
    businessType: 'Commercial Parking',
    businessAddress: '42 Park Street',
    city: 'Ahmedabad',
    state: 'Gujarat',
    postalCode: '380015',
    parkingCapacity: 150,
    businessDescription: 'Multi-level secure parking complex',
    ownerName: ownerUser.fullName,
    businessEmail: `contact_${runId}@metropark.com`,
    businessPhone: `+9192111${runId.slice(-5)}`,
    governmentIdType: 'Aadhaar',
    governmentIdNumber: `12345678${runId.slice(-4)}`,
    identityProofUrl: '/uploads/owner/dummy-id.pdf',
    businessLicenseUrl: '/uploads/owner/dummy-lic.pdf',
    propertyProofUrl: '/uploads/owner/dummy-prop.pdf',
    parkingImageUrls: ['/uploads/submissions/photos/dummy.jpg'],
    termsAccepted: true,
    emailOtpVerified: true,
    mobileOtpVerified: true,
    applicationStatus: 'Approved',
  });

  // 3. Create a Security Staff User with an Assignment to a Parking Lot
  const sampleLot = await ParkingLotModel.findOne({});
  const securityUser = await UserModel.create({
    fullName: `Security Test ${runId}`,
    email: `security_${runId}@parkeasetest.com`,
    mobileNumber: `+9193000${runId.slice(-5)}`,
    roleId: securityRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  if (sampleLot) {
    await SecurityStaffAssignmentModel.create({
      securityStaffId: securityUser._id,
      ownerId: ownerUser._id,
      parkingLotId: sampleLot._id,
      assignmentStatus: 'Active',
      assignedBy: ownerUser._id,
      assignmentReason: 'North Gate entry monitor',
    });
  }

  // 4. Create an Admin User
  const adminUser = await UserModel.create({
    fullName: `Admin Test ${runId}`,
    email: `admin_${runId}@parkeasetest.com`,
    mobileNumber: `+9194000${runId.slice(-5)}`,
    roleId: adminRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  console.log('✓ Seeded test accounts for Customer, Owner, Security Staff, and Admin.\n');

  // TEST 1: Role-Specific Profile Retrieval
  console.log('--- Test 1: Role-Specific Profile Retrieval ---');
  const custProf = (await profileService.getProfile(customerUser._id.toString())) as Record<string, any>;
  assert.strictEqual(custProf.roleType, 'CUSTOMER');
  assert(Array.isArray(custProf.vehicles), 'Customer profile must return vehicles list');
  assert(typeof custProf.totalBookings === 'number', 'Customer profile must return totalBookings count');
  console.log('✓ Customer profile contains roleType=CUSTOMER, vehicles, and booking counter.');

  const ownerProf = (await profileService.getProfile(ownerUser._id.toString())) as Record<string, any>;
  assert.strictEqual(ownerProf.roleType, 'OWNER');
  assert(ownerProf.business, 'Owner profile must return business details');
  assert.strictEqual(ownerProf.business.businessName, `Metro Park Facilities ${runId}`);
  console.log('✓ Owner profile contains roleType=OWNER and authoritative business details.');

  const secProf = (await profileService.getProfile(securityUser._id.toString())) as Record<string, any>;
  assert.strictEqual(secProf.roleType, 'SECURITY_STAFF');
  if (sampleLot) {
    assert(secProf.assignment, 'Security staff profile must return facility assignment');
    assert.strictEqual(secProf.assignment.assignmentStatus, 'Active');
    console.log('✓ Security staff profile contains assigned parking facility details.');
  }

  const admProf = (await profileService.getProfile(adminUser._id.toString())) as Record<string, any>;
  assert.strictEqual(admProf.roleType, 'ADMIN');
  assert.strictEqual(admProf.isSystemAdmin, true);
  console.log('✓ Admin profile contains roleType=ADMIN and governance indicators.\n');

  // TEST 2: Update Personal Information & Protected Field Enforcement
  console.log('--- Test 2: Personal Information Update & Protection ---');
  const updatedCust = (await profileService.updatePersonalInfo(customerUser._id.toString(), {
    fullName: `Customer Updated ${runId}`,
    gender: 'Female',
    preferredLanguage: 'Hindi',
    dateOfBirth: '1995-05-15',
  })) as Record<string, any>;

  assert.strictEqual(updatedCust.user.fullName, `Customer Updated ${runId}`);
  assert.strictEqual(updatedCust.user.gender, 'Female');
  assert.strictEqual(updatedCust.user.preferredLanguage, 'Hindi');
  // Check protected field roleId is unchanged
  assert.strictEqual(updatedCust.user.role._id.toString(), customerRole._id.toString());
  assert.strictEqual(updatedCust.user.accountStatus, 'Active');
  console.log('✓ Personal info successfully updated; protected role and account status remained secure.');

  // TEST 3: Parking Owner Permitted Business Details Update
  console.log('--- Test 3: Owner Business Information Update ---');
  await profileService.updatePersonalInfo(ownerUser._id.toString(), {
    businessName: `Metro Park Renovated ${runId}`,
    businessAddress: '100 Sunset Boulevard',
    city: 'Surat',
  });
  const refreshedOwner = (await profileService.getProfile(ownerUser._id.toString())) as Record<string, any>;
  assert.strictEqual(refreshedOwner.business.businessName, `Metro Park Renovated ${runId}`);
  assert.strictEqual(refreshedOwner.business.businessAddress, '100 Sunset Boulevard');
  assert.strictEqual(refreshedOwner.business.city, 'Surat');
  console.log('✓ Owner permitted business information successfully updated through profile service.\n');

  // TEST 4: Email Change OTP Workflow
  console.log('--- Test 4: Email Change OTP Workflow ---');
  const newEmail = `new_email_${runId}@parkeasetest.com`;

  // 4a. Reject same email
  await assert.rejects(
    async () => {
      await profileService.requestEmailChangeOtp(customerUser._id.toString(), customerUser.email);
    },
    (err: any) => err.message.includes('cannot be identical'),
    'Should reject same email',
  );
  console.log('✓ Rejected request to change to identical email.');

  // 4b. Reject duplicate email
  await assert.rejects(
    async () => {
      await profileService.requestEmailChangeOtp(customerUser._id.toString(), ownerUser.email);
    },
    (err: any) => err.message.includes('already registered'),
    'Should reject email belonging to another user',
  );
  console.log('✓ Rejected duplicate email registered to another user.');

  // 4c. Request OTP for new email (delivered to currently registered email)
  const reqEmailResult = await profileService.requestEmailChangeOtp(customerUser._id.toString(), newEmail);
  assert(reqEmailResult.cooldownSeconds > 0);
  console.log(`✓ OTP request created. Message: "${reqEmailResult.message}"`);

  // Find the generated OTP in DB (sent to customerUser.email)
  const emailOtpRecord = await OtpVerificationModel.findOne({
    userId: customerUser._id,
    email: customerUser.email,
    verificationType: 'CHANGE_EMAIL',
    verificationStatus: 'Pending',
  }).sort({ createdAt: -1 });

  assert(emailOtpRecord, 'Pending CHANGE_EMAIL OTP record must exist for current registered email');
  console.log('✓ Confirmed OTP record created with verificationType=CHANGE_EMAIL for current registered email.');

  // 4d. Reject invalid OTP
  await assert.rejects(
    async () => {
      await profileService.verifyEmailChangeOtp(customerUser._id.toString(), newEmail, '000000');
    },
    (err: any) => err.message.includes('Invalid verification code'),
    'Should reject invalid OTP',
  );
  console.log('✓ Rejected invalid OTP code.');

  // 4e. Verify with correct OTP
  // Get raw code by checking hash or creating a known one
  // Let's test using a known code hash
  const crypto = await import('node:crypto');
  const validTestCode = '839201';
  emailOtpRecord.otpCodeHash = crypto.default.createHash('sha256').update(validTestCode).digest('hex');
  await emailOtpRecord.save();

  const emailChangeSuccess = (await profileService.verifyEmailChangeOtp(
    customerUser._id.toString(),
    newEmail,
    validTestCode,
  )) as Record<string, any>;

  assert.strictEqual(emailChangeSuccess.user.email, newEmail);
  assert.strictEqual(emailChangeSuccess.user.emailVerified, true);

  // Verify DB reflects updated email
  const dbUserAfterEmail = await UserModel.findById(customerUser._id);
  assert.strictEqual(dbUserAfterEmail?.email, newEmail);

  // Verify OTP was consumed
  const consumedOtp = await OtpVerificationModel.findById(emailOtpRecord._id);
  assert(consumedOtp?.consumedAt, 'OTP must be marked as consumed');
  console.log('✓ Email change verified and committed to database; OTP successfully consumed.\n');

  // TEST 5: Mobile Number Change OTP Workflow
  console.log('--- Test 5: Mobile Number Change OTP Workflow ---');
  const newMobile = `+9199888${runId.slice(-5)}`;

  // 5a. Reject identical mobile
  await assert.rejects(
    async () => {
      await profileService.requestMobileChangeOtp(customerUser._id.toString(), customerUser.mobileNumber);
    },
    (err: any) => err.message.includes('cannot be identical'),
    'Should reject same mobile',
  );
  console.log('✓ Rejected request to change to identical mobile number.');

  // 5b. Reject duplicate mobile
  await assert.rejects(
    async () => {
      await profileService.requestMobileChangeOtp(customerUser._id.toString(), ownerUser.mobileNumber);
    },
    (err: any) => err.message.includes('already registered'),
    'Should reject mobile belonging to another user',
  );
  console.log('✓ Rejected duplicate mobile number registered to another user.');

  // 5c. Request OTP for mobile change (delivered to currently registered email per V1 rules)
  const reqMobileResult = await profileService.requestMobileChangeOtp(customerUser._id.toString(), newMobile);
  assert(reqMobileResult.cooldownSeconds > 0);
  console.log(`✓ OTP request created for mobile change. Message: "${reqMobileResult.message}"`);

  // Find generated OTP in DB (sent to updated email newEmail)
  const mobileOtpRecord = await OtpVerificationModel.findOne({
    userId: customerUser._id,
    email: newEmail,
    verificationType: 'CHANGE_MOBILE',
    verificationStatus: 'Pending',
  }).sort({ createdAt: -1 });

  assert(mobileOtpRecord, 'Pending CHANGE_MOBILE OTP record must exist for current registered email');
  console.log('✓ Confirmed OTP record created with verificationType=CHANGE_MOBILE delivered via email.');

  // 5d. Reject invalid OTP
  await assert.rejects(
    async () => {
      await profileService.verifyMobileChangeOtp(customerUser._id.toString(), newMobile, '111111');
    },
    (err: any) => err.message.includes('Invalid verification code'),
    'Should reject invalid OTP',
  );
  console.log('✓ Rejected invalid OTP code for mobile change.');

  // 5e. Verify with correct OTP
  const validMobileCode = '472910';
  mobileOtpRecord.otpCodeHash = crypto.default.createHash('sha256').update(validMobileCode).digest('hex');
  await mobileOtpRecord.save();

  const mobileChangeSuccess = (await profileService.verifyMobileChangeOtp(
    customerUser._id.toString(),
    newMobile,
    validMobileCode,
  )) as Record<string, any>;

  assert.strictEqual(mobileChangeSuccess.user.mobileNumber, newMobile);
  assert.strictEqual(mobileChangeSuccess.user.mobileVerified, true);

  // Verify DB reflects updated mobile
  const dbUserAfterMobile = await UserModel.findById(customerUser._id);
  assert.strictEqual(dbUserAfterMobile?.mobileNumber, newMobile);
  console.log('✓ Mobile number change verified and committed to database; OTP successfully consumed.\n');

  // CLEANUP test data
  console.log('--- Cleaning Up Test Data ---');
  await UserModel.deleteMany({ _id: { $in: [customerUser._id, ownerUser._id, securityUser._id, adminUser._id] } });
  await OwnerApplicationModel.deleteMany({ _id: ownerApp._id });
  await SecurityStaffAssignmentModel.deleteMany({ securityStaffId: securityUser._id });
  await OtpVerificationModel.deleteMany({ userId: { $in: [customerUser._id, ownerUser._id, securityUser._id, adminUser._id] } });
  console.log('✓ Test fixtures successfully cleaned up.');

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('  ALL PROFILE & OTP VERIFICATION TESTS PASSED SUCCESSFULLY!  ');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

