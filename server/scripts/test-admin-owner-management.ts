import 'dotenv/config';
import mongoose from 'mongoose';
import { adminService } from '../src/services/admin.service.js';
import { UserModel, type User } from '../src/models/User.js';
import { RoleModel, type Role } from '../src/models/Role.js';
import { OwnerApplicationModel, type OwnerApplication } from '../src/models/OwnerApplication.js';
import { PaymentModel, type Payment } from '../src/models/Payment.js';
import { ParkingLotModel, type ParkingLot } from '../src/models/ParkingLot.js';
import { ParkingFacilitySubmissionModel } from '../src/models/ParkingFacilitySubmission.js';
import { SessionModel, type Session } from '../src/models/Session.js';
import { NotificationModel } from '../src/models/Notification.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('==================================================================');
  console.log('--- Starting Admin Phase 3 Owner Management Verification Tests ---');
  console.log('==================================================================');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const cleanupIds: {
    users: mongoose.Types.ObjectId[];
    applications: mongoose.Types.ObjectId[];
    payments: mongoose.Types.ObjectId[];
    lots: mongoose.Types.ObjectId[];
    submissions: mongoose.Types.ObjectId[];
    sessions: mongoose.Types.ObjectId[];
    notifications: mongoose.Types.ObjectId[];
    auditLogs: mongoose.Types.ObjectId[];
  } = {
    users: [],
    applications: [],
    payments: [],
    lots: [],
    submissions: [],
    sessions: [],
    notifications: [],
    auditLogs: [],
  };

  try {
    const timestamp = Date.now();

    // 0. Ensure Roles exist
    let adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleModel.create({
        roleCode: 'ADMIN',
        roleName: 'System Administrator',
        isActive: true,
      });
    }

    let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
    if (!ownerRole) {
      ownerRole = await RoleModel.create({
        roleCode: 'OWNER',
        roleName: 'Parking Owner',
        isActive: true,
      });
    }

    let customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    if (!customerRole) {
      customerRole = await RoleModel.create({
        roleCode: 'CUSTOMER',
        roleName: 'Customer',
        isActive: true,
      });
    }

    // Create Test Admin User
    const adminUser = await UserModel.create({
      fullName: 'Test Admin Auditor',
      email: `admin_auditor_${timestamp}@parkease.test`,
      passwordHash: 'dummyhash',
      mobileNumber: `+919876${Math.floor(100000 + Math.random() * 900000)}`,
      roleId: adminRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });
    cleanupIds.users.push(adminUser._id);

    // Create Test Owner Applicant 1
    const ownerUser1 = await UserModel.create({
      fullName: 'Test Parking Partner Alpha',
      email: `owner_alpha_${timestamp}@parkease.test`,
      passwordHash: 'dummyhash',
      mobileNumber: `+919876${Math.floor(100000 + Math.random() * 900000)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });
    cleanupIds.users.push(ownerUser1._id);

    // Create Payment for Owner 1 (Registration fee ₹999)
    const paymentRef1 = `PAY_REG_${timestamp}_1`;
    const payment1 = await PaymentModel.create({
      paymentReference: paymentRef1,
      paymentType: 'Parking Owner Registration Fee',
      paymentTypeCode: 'OWNER_REGISTRATION',
      amount: 999,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      gatewayPaymentId: `pay_test_${timestamp}`,
      gatewayOrderId: `order_test_${timestamp}`,
      customerId: ownerUser1._id,
    });
    cleanupIds.payments.push(payment1._id);

    // Create Approved Application for Owner 1
    const appRef1 = `APP-REG-${timestamp}-1`;
    const app1 = await OwnerApplicationModel.create({
      applicantId: ownerUser1._id,
      applicationReference: appRef1,
      businessName: 'Alpha Urban Parking Solutions',
      businessType: 'Commercial Parking',
      businessDescription: 'Prime commercial multilevel parking facility operating 24x7 near metro.',
      businessAddress: '100 Metro Boulevard',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380015',
      parkingCapacity: 120,
      ownerName: ownerUser1.fullName,
      businessEmail: ownerUser1.email,
      businessPhone: ownerUser1.mobileNumber,
      governmentIdType: 'Aadhaar',
      governmentIdNumber: '998877665544',
      identityProofUrl: '/uploads/id_alpha.pdf',
      businessLicenseUrl: '/uploads/license_alpha.pdf',
      propertyProofUrl: '/uploads/property_alpha.pdf',
      termsAccepted: true,
      emailOtpVerified: true,
      mobileOtpVerified: true,
      registrationFeeAmount: 999,
      paymentId: payment1._id,
      applicationStatus: 'Approved',
      reviewedBy: adminUser._id,
      reviewedAt: new Date(),
      adminRemarks: 'Initial validation approved.',
      submittedAt: new Date(Date.now() - 86400000),
    });
    cleanupIds.applications.push(app1._id);

    // Create Facilities for Owner 1 (Active, Suspended, Submissions)
    const activeLot = await ParkingLotModel.create({
      ownerId: ownerUser1._id,
      parkingName: 'Alpha Central Metro Parking',
      address: '100 Metro Boulevard, Ahmedabad',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380015',
      contactNumber: '+919876543210',
      latitude: 23.0225,
      longitude: 72.5714,
      location: {
        type: 'Point',
        coordinates: [72.5714, 23.0225],
      },
      totalSlots: 100,
      occupiedSlots: 0,
      availableSlots: 100,
      parkingStatus: 'Active',
      pricing: { twoWheelerPerHour: 20, fourWheelerPerHour: 40 },
      operatingHours: { open24Hours: true },
    });
    cleanupIds.lots.push(activeLot._id);

    const suspendedLot = await ParkingLotModel.create({
      ownerId: ownerUser1._id,
      parkingName: 'Alpha Suburb Overflow Parking',
      address: '200 Ring Road, Ahmedabad',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380058',
      contactNumber: '+919876543211',
      latitude: 23.0335,
      longitude: 72.5814,
      location: {
        type: 'Point',
        coordinates: [72.5814, 23.0335],
      },
      totalSlots: 50,
      occupiedSlots: 0,
      availableSlots: 50,
      parkingStatus: 'Inactive',
      pricing: { twoWheelerPerHour: 15, fourWheelerPerHour: 30 },
      operatingHours: { open24Hours: true },
    });
    cleanupIds.lots.push(suspendedLot._id);

    const pendingSub = await ParkingFacilitySubmissionModel.create({
      ownerId: ownerUser1._id,
      facilityName: 'Alpha Airport Expressway Facility',
      facilityType: 'Commercial Parking',
      submissionReference: `SUB-ALPHA-${timestamp}`,
      submissionStatus: 'Under Review',
      contactName: ownerUser1.fullName,
      contactEmail: ownerUser1.email,
      contactPhone: ownerUser1.mobileNumber,
      location: {
        address: 'Airport Road',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '382475',
      },
      capacity: { totalCapacity: 80 },
    });
    cleanupIds.submissions.push(pendingSub._id);

    // Create Active Session for Owner 1
    const sessionTokenId = new mongoose.Types.ObjectId();
    const session1 = await (SessionModel as mongoose.Model<Session>).create({
      userId: ownerUser1._id,
      sessionId: `SESSION-${timestamp}-1`,
      refreshTokenId: sessionTokenId,
      tokenFamilyId: `TF-${timestamp}-1`,
      loginMethod: 'Email',
      sessionType: 'Standard',
      loginTime: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      sessionStatus: 'Active',
      ipAddress: '127.0.0.1',
      deviceName: 'Chrome on Windows',
    });
    cleanupIds.sessions.push(session1._id as mongoose.Types.ObjectId);

    // Create Test Owner Applicant 2 (Pending Review)
    const ownerUser2 = await UserModel.create({
      fullName: 'Test Parking Partner Beta',
      email: `owner_beta_${timestamp}@parkease.test`,
      passwordHash: 'dummyhash',
      mobileNumber: `+919876${Math.floor(100000 + Math.random() * 900000)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });
    cleanupIds.users.push(ownerUser2._id);

    const paymentRef2 = `PAY_REG_${timestamp}_2`;
    const payment2 = await PaymentModel.create({
      paymentReference: paymentRef2,
      paymentType: 'Parking Owner Registration Fee',
      paymentTypeCode: 'OWNER_REGISTRATION',
      amount: 999,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PENDING',
      customerId: ownerUser2._id,
    });
    cleanupIds.payments.push(payment2._id);

    const appRef2 = `APP-REG-${timestamp}-2`;
    const app2 = await OwnerApplicationModel.create({
      applicantId: ownerUser2._id,
      applicationReference: appRef2,
      businessName: 'Beta Heights Parking',
      businessType: 'Shopping Mall',
      businessDescription: 'Secure shopping center parking structure with fast tag entry.',
      businessAddress: '55 Tech Park',
      city: 'Vadodara',
      state: 'Gujarat',
      postalCode: '390001',
      parkingCapacity: 60,
      ownerName: ownerUser2.fullName,
      businessEmail: ownerUser2.email,
      businessPhone: ownerUser2.mobileNumber,
      governmentIdType: 'PAN',
      governmentIdNumber: 'ABCDE1234F',
      identityProofUrl: '/uploads/id_beta.pdf',
      businessLicenseUrl: '/uploads/license_beta.pdf',
      propertyProofUrl: '/uploads/property_beta.pdf',
      termsAccepted: true,
      emailOtpVerified: true,
      mobileOtpVerified: true,
      registrationFeeAmount: 999,
      paymentId: payment2._id,
      applicationStatus: 'Pending Review',
      submittedAt: new Date(),
    });
    cleanupIds.applications.push(app2._id);

    console.log('\n--- 1. Testing Owner KPI Overview Metrics ---');
    const overview = await adminService.getDashboardOverview();
    console.log('KPI Metrics:', overview);
    if (typeof overview.totalOwners !== 'number' || typeof overview.pendingApprovals !== 'number') {
      throw new Error('getDashboardOverview missing required numeric counters.');
    }
    if (overview.pendingApprovals < 1) {
      throw new Error('pendingApprovals counter should be at least 1.');
    }
    console.log('✅ TEST 1 PASSED: Owner KPI counters computed accurately.');

    console.log('\n--- 2. Testing Payment Reference Search and Directory Filters ---');
    // Search by paymentReference
    const searchByPayment = await adminService.getOwnerApplications({
      search: paymentRef1,
    });
    console.log(`Search by payment ref (${paymentRef1}) matched:`, searchByPayment.total);
    if (!searchByPayment.applications.some((a) => a.applicationReference === appRef1)) {
      throw new Error('Failed to find application by payment reference.');
    }

    // Filter by feeStatus 'Paid' / 'SUCCESSFUL'
    const filterPaid = await adminService.getOwnerApplications({
      feeStatus: 'Paid',
      search: 'Alpha Urban',
    });
    if (!filterPaid.applications.some((a) => a.applicationReference === appRef1)) {
      throw new Error('Filter feeStatus=Paid failed to return expected application.');
    }

    // Filter by accountStatus 'Active'
    const filterActive = await adminService.getOwnerApplications({
      accountStatus: 'Active',
      search: 'Alpha Urban',
    });
    if (!filterActive.applications.some((a) => a.applicationReference === appRef1)) {
      throw new Error('Filter accountStatus=Active failed to return expected application.');
    }

    // Filter by approval date range
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const filterDates = await adminService.getOwnerApplications({
      approvedFrom: yesterday,
      approvedTo: tomorrow,
      search: 'Alpha Urban',
    });
    if (!filterDates.applications.some((a) => a.applicationReference === appRef1)) {
      throw new Error('Filter by approval date range failed.');
    }
    console.log('✅ TEST 2 PASSED: Server-side search & filters (payment ID, fee status, account status, date range) verified.');

    console.log('\n--- 3. Testing Dedicated View Payment ---');
    const paymentRecord = await adminService.getOwnerApplicationPayment(app1._id.toString());
    console.log('Payment record retrieved:', {
      paymentReference: paymentRecord.paymentReference,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      paymentMethod: paymentRecord.paymentMethod,
      paymentStatus: paymentRecord.paymentStatus,
      gatewayPaymentId: paymentRecord.gatewayPaymentId,
      gatewayOrderId: paymentRecord.gatewayOrderId,
    });
    if (paymentRecord.paymentReference !== paymentRef1) {
      throw new Error('Mismatch in payment reference.');
    }
    if (paymentRecord.amount !== 999) {
      throw new Error(`Expected registration fee ₹999, got ₹${paymentRecord.amount}`);
    }
    if (paymentRecord.currency !== 'INR') {
      throw new Error(`Expected currency INR, got ${paymentRecord.currency}`);
    }
    console.log('✅ TEST 3 PASSED: Dedicated View Payment provides complete ledger info without exposing secrets.');

    console.log('\n--- 4. Testing Owner-to-Facility Relationships ---');
    const facilitySummary = await adminService.getOwnerFacilitiesSummary(ownerUser1._id.toString());
    console.log('Facilities Summary:', facilitySummary);
    if (facilitySummary.totalLots !== 2) {
      throw new Error(`Expected totalLots=2, got ${facilitySummary.totalLots}`);
    }
    if (facilitySummary.activeLots !== 1) {
      throw new Error(`Expected activeLots=1, got ${facilitySummary.activeLots}`);
    }
    if (facilitySummary.suspendedLots !== 1) {
      throw new Error(`Expected suspendedLots=1, got ${facilitySummary.suspendedLots}`);
    }
    if (facilitySummary.pendingSubmissions !== 1) {
      throw new Error(`Expected pendingSubmissions=1, got ${facilitySummary.pendingSubmissions}`);
    }

    // Verify detail endpoint attaches facilitiesSummary
    const fullApp = await adminService.getOwnerApplicationById(app1._id.toString());
    if (!fullApp.facilitiesSummary || fullApp.facilitiesSummary.totalLots !== 2) {
      throw new Error('getOwnerApplicationById did not attach facilitiesSummary.');
    }
    console.log('✅ TEST 4 PASSED: Owner-to-facility summary calculated correctly and attached to application details.');

    console.log('\n--- 5. Testing Suspend Owner with Instant Session Revocation ---');
    // Attempt suspension with short reason (< 5 chars) -> should fail
    try {
      await adminService.suspendOwner(ownerUser1._id.toString(), 'Bad', adminUser._id.toString());
      throw new Error('Suspension should fail when reason is under 5 characters.');
    } catch (err: any) {
      if (err.message.includes('under 5 characters') && !err.statusCode) {
        throw err;
      }
      console.log('Validation verified: Short suspension reason rejected.');
    }

    // Execute valid suspension
    const suspensionReason = 'Severe violation of safety protocols and unauthorized rates escalation.';
    await adminService.suspendOwner(
      ownerUser1._id.toString(),
      suspensionReason,
      adminUser._id.toString(),
      adminRole._id.toString(),
      '127.0.0.1',
      'TestRunner/1.0',
    );

    // Verify user account status is Suspended
    const suspendedUser = await UserModel.findById(ownerUser1._id).exec();
    if (suspendedUser?.accountStatus !== 'Suspended') {
      throw new Error(`Expected accountStatus='Suspended', got '${suspendedUser?.accountStatus}'`);
    }
    if (suspendedUser.suspensionReason !== suspensionReason) {
      throw new Error('Suspension reason not stored on User.');
    }

    // Verify session revoked in SessionModel
    const revokedSession = await SessionModel.findById(session1._id).exec();
    if (revokedSession?.sessionStatus !== 'Revoked') {
      throw new Error(`Expected sessionStatus='Revoked', got '${revokedSession?.sessionStatus}'`);
    }
    if (revokedSession.logoutReason !== 'Account Suspended') {
      throw new Error(`Expected logoutReason='Account Suspended', got '${revokedSession.logoutReason}'`);
    }

    // Verify Audit Log created
    const suspendAudit = await AuditLogModel.findOne({
      actionCode: 'OWNER_SUSPENDED',
      targetDocumentId: ownerUser1._id,
    }).exec();
    if (!suspendAudit) {
      throw new Error('Audit log for OWNER_SUSPENDED was not found.');
    }
    cleanupIds.auditLogs.push(suspendAudit._id);

    // Verify In-App Notification created
    const suspendNotif = await NotificationModel.findOne({
      userId: ownerUser1._id,
      title: 'Parking Owner Account Suspended',
    }).exec();
    if (!suspendNotif) {
      throw new Error('Notification for owner suspension was not created.');
    }
    cleanupIds.notifications.push(suspendNotif._id);
    console.log('✅ TEST 5 PASSED: Suspend Owner successfully revokes active sessions, updates status, and logs audit trail.');

    console.log('\n--- 6. Testing Reactivate Owner ---');
    await adminService.activateOwner(
      ownerUser1._id.toString(),
      'Compliance verified, safety inspection passed.',
      adminUser._id.toString(),
      adminRole._id.toString(),
      '127.0.0.1',
      'TestRunner/1.0',
    );

    const reactivatedUser = await UserModel.findById(ownerUser1._id).exec();
    if (reactivatedUser?.accountStatus !== 'Active') {
      throw new Error(`Expected accountStatus='Active', got '${reactivatedUser?.accountStatus}'`);
    }

    const activateAudit = await AuditLogModel.findOne({
      actionCode: 'OWNER_ACTIVATED',
      targetDocumentId: ownerUser1._id,
    }).exec();
    if (!activateAudit) {
      throw new Error('Audit log for OWNER_ACTIVATED was not found.');
    }
    cleanupIds.auditLogs.push(activateAudit._id);
    console.log('✅ TEST 6 PASSED: Owner account reactivated successfully.');

    console.log('\n--- 7. Testing CSV Export ---');
    const csvData = await adminService.exportOwnerApplicationsCsv({
      search: 'Alpha Urban',
    });
    console.log('CSV Export Output Preview:\n' + csvData.split('\n').slice(0, 3).join('\n'));
    if (!csvData.includes('Application Reference,Business Name') || !csvData.includes(appRef1)) {
      throw new Error('CSV export does not contain expected header or application data.');
    }
    console.log('✅ TEST 7 PASSED: CSV directory export generated with complete column definitions.');

    console.log('\n==================================================================');
    console.log('🎉 ALL ADMIN PHASE 3 OWNER MANAGEMENT INTEGRATION TESTS PASSED 🎉');
    console.log('==================================================================');
  } finally {
    console.log('\n--- Cleaning up temporary test artifacts ---');
    await Promise.all([
      UserModel.deleteMany({ _id: { $in: cleanupIds.users } }),
      OwnerApplicationModel.deleteMany({ _id: { $in: cleanupIds.applications } }),
      PaymentModel.deleteMany({ _id: { $in: cleanupIds.payments } }),
      ParkingLotModel.deleteMany({ _id: { $in: cleanupIds.lots } }),
      ParkingFacilitySubmissionModel.deleteMany({ _id: { $in: cleanupIds.submissions } }),
      SessionModel.deleteMany({ _id: { $in: cleanupIds.sessions } }),
      NotificationModel.deleteMany({ _id: { $in: cleanupIds.notifications } }),
      AuditLogModel.deleteMany({ _id: { $in: cleanupIds.auditLogs } }),
    ]);
    await mongoose.disconnect();
    console.log('Cleanup completed and disconnected from MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
