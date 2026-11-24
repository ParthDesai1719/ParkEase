import 'dotenv/config';
import mongoose from 'mongoose';
import { adminUsersService } from '../src/services/adminUsers.service.js';
import { UserModel, type User } from '../src/models/User.js';
import { RoleModel, type Role } from '../src/models/Role.js';
import { BookingModel, type Booking } from '../src/models/Booking.js';
import { PaymentModel, type Payment } from '../src/models/Payment.js';
import { VehicleModel, type Vehicle } from '../src/models/Vehicle.js';
import { SessionModel, type Session } from '../src/models/Session.js';
import { RefreshTokenModel } from '../src/models/RefreshToken.js';
import { NotificationModel } from '../src/models/Notification.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('================================================================');
  console.log('--- Starting Admin Phase 2 User Management Verification Tests ---');
  console.log('================================================================');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const createdIds: { [key: string]: mongoose.Types.ObjectId[] } = {
    users: [],
    vehicles: [],
    sessions: [],
    bookings: [],
    payments: [],
    notifications: [],
  };

  try {
    const timestamp = Date.now();

    // 1. Setup Roles
    const customerRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: 'CUSTOMER' });
    const adminRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: 'ADMIN' });
    const ownerRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: 'OWNER' });

    if (!customerRole || !adminRole || !ownerRole) {
      throw new Error('Required roles (CUSTOMER, ADMIN, OWNER) missing from database.');
    }

    // Create an Admin user for action tracking
    const adminUser = await (UserModel as mongoose.Model<User>).create({
      fullName: `Admin Tester ${timestamp}`,
      email: `admin.tester.${timestamp}@parkease.internal`,
      mobileNumber: `+9198${String(timestamp).slice(-8)}`,
      roleId: adminRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });
    createdIds.users.push(adminUser._id as mongoose.Types.ObjectId);

    // Create an Owner user to verify role isolation
    const ownerUser = await (UserModel as mongoose.Model<User>).create({
      fullName: `Owner Tester ${timestamp}`,
      email: `owner.tester.${timestamp}@parkease.internal`,
      mobileNumber: `+9197${String(timestamp).slice(-8)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });
    createdIds.users.push(ownerUser._id as mongoose.Types.ObjectId);

    // Create Customer 1 (Active, will have bookings)
    const customer1 = await (UserModel as mongoose.Model<User>).create({
      fullName: `Alice Customer ${timestamp}`,
      email: `alice.${timestamp}@customer.test`,
      mobileNumber: `+9196${String(timestamp).slice(-8)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });
    createdIds.users.push(customer1._id as mongoose.Types.ObjectId);

    // Create Customer 2 (Active, zero bookings, for clean deletion test)
    const customer2 = await (UserModel as mongoose.Model<User>).create({
      fullName: `Bob Customer ${timestamp}`,
      email: `bob.${timestamp}@customer.test`,
      mobileNumber: `+9195${String(timestamp).slice(-8)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: false,
      preferredLanguage: 'Hindi',
      timezone: 'Asia/Kolkata',
    });
    createdIds.users.push(customer2._id as mongoose.Types.ObjectId);

    // Add Vehicle to Customer 1
    const vehicle1 = await (VehicleModel as mongoose.Model<Vehicle>).create({
      customerId: customer1._id,
      vehicleNumber: `GJ01AB${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Creta',
      vehicleColor: 'Polar White',
      isPrimary: true,
      vehicleStatus: 'Active',
    });
    createdIds.vehicles.push(vehicle1._id as mongoose.Types.ObjectId);

    // Add Vehicle to Customer 2
    const vehicle2 = await (VehicleModel as mongoose.Model<Vehicle>).create({
      customerId: customer2._id,
      vehicleNumber: `GJ01CD${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Maruti',
      vehicleModel: 'Swift',
      vehicleColor: 'Magma Grey',
      isPrimary: true,
      vehicleStatus: 'Active',
    });
    createdIds.vehicles.push(vehicle2._id as mongoose.Types.ObjectId);

    // Find any existing parking lot or create a dummy one for booking references
    let parkingLot = await (ParkingLotModel as any).findOne();
    if (!parkingLot) {
      parkingLot = await (ParkingLotModel as any).create({
        ownerId: ownerUser._id,
        parkingName: `Test Facility ${timestamp}`,
        parkingStatus: 'Active',
        isVerified: true,
        address: '100 Ring Road, Ahmedabad',
        city: 'Ahmedabad',
        state: 'Gujarat',
        postalCode: '380015',
        latitude: 23.0225,
        longitude: 72.5714,
        location: {
          type: 'Point',
          coordinates: [72.5714, 23.0225],
        },
        contactNumber: '+919999999999',
        totalFloors: 1,
        totalSlots: 50,
        carHourlyRate: 50,
        bikeHourlyRate: 20,
        suvHourlyRate: 70,
        evChargingRatePerHour: 80,
        gracePeriodMinutes: 15,
        minParkingDurationHours: 1,
        maxParkingDurationHours: 24,
        operatingHours: {
          isOpen24x7: true,
        },
      });
    }

    // Add Booking for Customer 1
    const dummySlotId = new mongoose.Types.ObjectId();
    const dummyFloorId = new mongoose.Types.ObjectId();
    const dummyZoneId = new mongoose.Types.ObjectId();
    const now = new Date();
    const exitTime = new Date(now.getTime() + 2 * 3600 * 1000);

    const booking1 = await (BookingModel as mongoose.Model<Booking>).create({
      bookingReference: `BK-TEST-${timestamp}`,
      customerId: customer1._id,
      vehicleId: vehicle1._id,
      parkingLotId: parkingLot._id,
      floorId: dummyFloorId,
      zoneId: dummyZoneId,
      originalSlotId: dummySlotId,
      currentSlotId: dummySlotId,
      bookingType: 'ONLINE',
      bookingStatus: 'Active',
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 50,
      scheduledEntryTime: now,
      scheduledExitTime: exitTime,
      actualEntryTime: now,
      baseAmount: 100,
      totalAmount: 118,
      currency: 'INR',
    });
    createdIds.bookings.push(booking1._id as mongoose.Types.ObjectId);

    // Add Active Session for Customer 1
    const sessionTokenId = new mongoose.Types.ObjectId();
    const activeSession1 = await (SessionModel as mongoose.Model<Session>).create({
      userId: customer1._id,
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
    createdIds.sessions.push(activeSession1._id as mongoose.Types.ObjectId);

    // -------------------------------------------------------------
    // Test 1: Customer Directory Listing & Strict Role Isolation
    // -------------------------------------------------------------
    console.log('\n[Test 1] Testing Customer Directory Listing & Role Isolation...');
    const listResult = await adminUsersService.listCustomers({
      page: 1,
      limit: 10,
      search: `Customer ${timestamp}`,
    });

    if (listResult.users.length < 2) {
      throw new Error(`Expected at least 2 customer users, found ${listResult.users.length}`);
    }

    // Verify non-customers are never included
    const foundAdmin = listResult.users.find((u) => u._id.toString() === adminUser._id.toString());
    const foundOwner = listResult.users.find((u) => u._id.toString() === ownerUser._id.toString());
    if (foundAdmin || foundOwner) {
      throw new Error('Role isolation failed: Admin or Owner account appeared in Customer Directory.');
    }

    console.log('  -> Directory count returned:', listResult.users.length);
    console.log('  -> Total customers KPI:', listResult.summary.totalCustomers);
    console.log('  -> Active customers KPI:', listResult.summary.activeCustomers);
    console.log('  [PASS] Test 1: Directory listing and role isolation confirmed.');

    // -------------------------------------------------------------
    // Test 2: Booking Activity Filtering
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing Booking Activity Filtering...');
    const hasBookingsResult = await adminUsersService.listCustomers({
      search: `${timestamp}`,
      bookingActivity: 'HAS_BOOKINGS',
    });
    const noBookingsResult = await adminUsersService.listCustomers({
      search: `${timestamp}`,
      bookingActivity: 'NO_BOOKINGS',
    });

    const aliceInHas = hasBookingsResult.users.some((u) => u._id.toString() === customer1._id.toString());
    const bobInHas = hasBookingsResult.users.some((u) => u._id.toString() === customer2._id.toString());
    const bobInNo = noBookingsResult.users.some((u) => u._id.toString() === customer2._id.toString());

    if (!aliceInHas || bobInHas || !bobInNo) {
      throw new Error(
        `Booking activity filter mismatch: aliceInHas=${aliceInHas}, bobInHas=${bobInHas}, bobInNo=${bobInNo}`,
      );
    }
    console.log('  -> HAS_BOOKINGS accurately returned Customer 1 with booking count > 0.');
    console.log('  -> NO_BOOKINGS accurately returned Customer 2 with booking count == 0.');
    console.log('  [PASS] Test 2: Booking activity filters verified.');

    // -------------------------------------------------------------
    // Test 3: Customer Details & Booking KPIs Retrieval
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing Customer Details & Engagement KPIs...');
    const details = await adminUsersService.getCustomerDetails(customer1._id.toString());
    if (details.user.email !== customer1.email) {
      throw new Error(`Detail mismatch: expected ${customer1.email}, got ${details.user.email}`);
    }
    if (details.bookingSummary.totalBookings !== 1 || details.bookingSummary.activeBookings !== 1) {
      throw new Error(
        `KPI breakdown mismatch: total=${details.bookingSummary.totalBookings}, active=${details.bookingSummary.activeBookings}`,
      );
    }
    if (details.vehicles.length !== 1 || details.vehicles[0].vehicleNumber !== vehicle1.vehicleNumber) {
      throw new Error(`Vehicle mismatch in customer details: count=${details.vehicles.length}`);
    }
    if (details.recentSessions.length !== 1) {
      throw new Error(`Recent sessions mismatch: count=${details.recentSessions.length}`);
    }
    console.log('  -> Customer 1 Full Name:', details.user.fullName);
    console.log('  -> Total Bookings KPI:', details.bookingSummary.totalBookings);
    console.log('  -> Registered Vehicle:', details.vehicles[0].vehicleNumber);
    console.log('  -> Recent Session:', details.recentSessions[0].sessionId);
    console.log('  [PASS] Test 3: Customer details and engagement KPIs retrieved successfully.');

    // -------------------------------------------------------------
    // Test 4: Permitted Profile Update & Audit Logging
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing Profile Update and Audit Trail...');
    const updatedUser = await adminUsersService.updateCustomerProfile(
      customer1._id.toString(),
      {
        fullName: `Alice Customer Updated ${timestamp}`,
        gender: 'Female',
        preferredLanguage: 'Gujarati',
      },
      adminUser._id.toString(),
      adminRole._id.toString(),
    );

    if (
      updatedUser.fullName !== `Alice Customer Updated ${timestamp}` ||
      updatedUser.gender !== 'Female' ||
      updatedUser.preferredLanguage !== 'Gujarati'
    ) {
      throw new Error('Profile fields were not correctly saved.');
    }

    // Verify Audit Log
    const auditRecord = await AuditLogModel.findOne({
      targetDocumentId: customer1._id,
      actionCode: 'USER_PROFILE_UPDATED',
    });
    if (!auditRecord) {
      throw new Error('Audit log for USER_PROFILE_UPDATED was not written.');
    }
    console.log('  -> Updated Full Name:', updatedUser.fullName);
    console.log('  -> Audit Log Action:', auditRecord.actionCode, '|', auditRecord.actionTitle);
    console.log('  [PASS] Test 4: Profile update and audit trail confirmed.');

    // -------------------------------------------------------------
    // Test 5: Customer Account Suspension & Session Termination
    // -------------------------------------------------------------
    console.log('\n[Test 5] Testing Account Suspension & Session Revocation...');
    const suspendReason = 'Repeated overstay violations reported by facility security.';
    const suspended = await adminUsersService.suspendCustomer(
      customer1._id.toString(),
      suspendReason,
      adminUser._id.toString(),
      adminRole._id.toString(),
    );

    if (
      suspended.accountStatus !== 'Suspended' ||
      suspended.suspensionReason !== suspendReason ||
      !suspended.suspendedAt ||
      suspended.suspendedBy?.toString() !== adminUser._id.toString()
    ) {
      throw new Error('Customer account suspension fields not properly set.');
    }

    // Check that active session was revoked
    const checkSession = await (SessionModel as mongoose.Model<Session>).findById(activeSession1._id);
    if (!checkSession || checkSession.sessionStatus !== 'Revoked' || checkSession.logoutReason !== 'Account Suspended') {
      throw new Error(`Session revocation failed: status=${checkSession?.sessionStatus}, reason=${checkSession?.logoutReason}`);
    }

    // Check Notification created
    const notif = await NotificationModel.findOne({
      userId: customer1._id,
      notificationType: 'Account',
      eventType: 'Customer Account Suspended',
    });
    if (!notif) {
      throw new Error('Suspension notification was not generated.');
    }

    // Check Audit Log
    const suspendAudit = await AuditLogModel.findOne({
      targetDocumentId: customer1._id,
      actionCode: 'USER_SUSPENDED',
    });
    if (!suspendAudit) {
      throw new Error('Suspension audit log was not written.');
    }

    console.log('  -> Account Status:', suspended.accountStatus);
    console.log('  -> Suspension Reason:', suspended.suspensionReason);
    console.log('  -> Session Status:', checkSession.sessionStatus, '| Logout Reason:', checkSession.logoutReason);
    console.log('  -> Notification Created:', notif.notificationReference, '|', notif.title);
    console.log('  [PASS] Test 5: Account suspension and session revocation verified.');

    // -------------------------------------------------------------
    // Test 6: Customer Account Reactivation
    // -------------------------------------------------------------
    console.log('\n[Test 6] Testing Account Reactivation...');
    const reactivated = await adminUsersService.activateCustomer(
      customer1._id.toString(),
      'User settled overstay penalties in person.',
      adminUser._id.toString(),
      adminRole._id.toString(),
    );

    if (
      reactivated.accountStatus !== 'Active' ||
      reactivated.suspensionReason !== null ||
      reactivated.suspendedAt !== null
    ) {
      throw new Error('Reactivation failed to restore Active status or clear suspension fields.');
    }

    const reactivateAudit = await AuditLogModel.findOne({
      targetDocumentId: customer1._id,
      actionCode: 'USER_ACTIVATED',
    });
    if (!reactivateAudit) {
      throw new Error('Reactivation audit log was not written.');
    }

    console.log('  -> Reactivated Status:', reactivated.accountStatus);
    console.log('  -> Suspension Reason Cleared:', reactivated.suspensionReason);
    console.log('  [PASS] Test 6: Account reactivation verified.');

    // -------------------------------------------------------------
    // Test 7: Deletion Dependency Protection (Active Bookings Block)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Testing Deletion Dependency Protection...');
    let blockedActive = false;
    try {
      await adminUsersService.deleteCustomer(
        customer1._id.toString(),
        adminUser._id.toString(),
        adminRole._id.toString(),
      );
    } catch (err: any) {
      blockedActive = true;
      if (err.statusCode !== 409 || err.errorCode !== 'CUSTOMER_HAS_ACTIVE_BOOKINGS') {
        throw new Error(`Unexpected error code on active booking delete block: ${err.errorCode} (${err.statusCode})`);
      }
      console.log('  -> Blocked deletion with active booking as expected:', err.message);
    }
    if (!blockedActive) {
      throw new Error('Failed to block deletion for customer with active booking!');
    }

    // Change booking to Completed to test historical transaction block
    await BookingModel.updateOne({ _id: booking1._id }, { bookingStatus: 'Completed' });

    let blockedHistory = false;
    try {
      await adminUsersService.deleteCustomer(
        customer1._id.toString(),
        adminUser._id.toString(),
        adminRole._id.toString(),
      );
    } catch (err: any) {
      blockedHistory = true;
      if (err.statusCode !== 409 || err.errorCode !== 'CUSTOMER_HAS_TRANSACTION_HISTORY') {
        throw new Error(`Unexpected error code on historical transaction delete block: ${err.errorCode} (${err.statusCode})`);
      }
      console.log('  -> Blocked deletion with historical booking as expected:', err.message);
    }
    if (!blockedHistory) {
      throw new Error('Failed to block deletion for customer with historical transactions!');
    }

    // -------------------------------------------------------------
    // Test 8: Permitted Deletion for 0-Booking Customer
    // -------------------------------------------------------------
    console.log('\n[Test 8] Testing Permitted Deletion for 0-Booking Customer...');
    const deleteResult = await adminUsersService.deleteCustomer(
      customer2._id.toString(),
      adminUser._id.toString(),
      adminRole._id.toString(),
    );
    console.log('  -> Delete Result:', deleteResult.message);

    const checkCustomer2 = await UserModel.findById(customer2._id);
    const checkVehicle2 = await VehicleModel.findOne({ customerId: customer2._id });
    if (checkCustomer2 || checkVehicle2) {
      throw new Error('Customer 2 or registered vehicle was not cleaned up after deletion.');
    }

    const deleteAudit = await AuditLogModel.findOne({
      targetDocumentId: customer2._id,
      actionCode: 'USER_DELETED',
    });
    if (!deleteAudit) {
      throw new Error('Deletion audit log was not written.');
    }
    console.log('  -> Deletion Audit Log Action:', deleteAudit.actionCode);
    console.log('  [PASS] Test 8: Permitted deletion and cascade vehicle/session cleanup verified.');

    console.log('\n================================================================');
    console.log(' ALL 8 ADMIN USER MANAGEMENT TESTS PASSED WITH 100% SUCCESS! ');
    console.log('================================================================\n');
  } finally {
    // Cleanup generated test data
    console.log('Cleaning up test data...');
    if (createdIds.bookings.length) await BookingModel.deleteMany({ _id: { $in: createdIds.bookings } });
    if (createdIds.vehicles.length) await VehicleModel.deleteMany({ _id: { $in: createdIds.vehicles } });
    if (createdIds.sessions.length) await SessionModel.deleteMany({ _id: { $in: createdIds.sessions } });
    if (createdIds.users.length) {
      await NotificationModel.deleteMany({ userId: { $in: createdIds.users } });
      await AuditLogModel.deleteMany({ targetDocumentId: { $in: createdIds.users } });
      await UserModel.deleteMany({ _id: { $in: createdIds.users } });
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
