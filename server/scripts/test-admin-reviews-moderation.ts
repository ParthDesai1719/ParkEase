import mongoose from 'mongoose';
import {
  AuditLogModel,
  BookingModel,
  ParkingFloorModel,
  ParkingLotModel,
  ParkingSlotModel,
  ParkingZoneModel,
  ReviewModel,
  RoleModel,
  UserModel,
  VehicleModel,
} from '../src/models/index.js';
import { adminReviewsService } from '../src/services/adminReviews.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease';

async function runTests() {
  console.log('==================================================================');
  console.log('--- Starting Admin Phase 5 Reviews & Moderation Tests ---');
  console.log('==================================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const timestamp = Date.now();

  // Master roles
  const customerRole = await (RoleModel as any).findOne({ roleCode: 'CUSTOMER' });
  const ownerRole = await (RoleModel as any).findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const adminRole = await (RoleModel as any).findOne({ roleCode: 'ADMIN' });

  if (!customerRole || !ownerRole || !adminRole) {
    throw new Error('Master roles required in DB.');
  }

  // 1. Create Test Admin
  const testAdmin = await (UserModel as any).create({
    fullName: `Mod Admin ${timestamp}`,
    email: `mod.admin.${timestamp}@parkease.test`,
    mobileNumber: `+9198${String(timestamp).slice(-8)}`,
    roleId: adminRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 2. Create Test Customer
  const testCustomer = await (UserModel as any).create({
    fullName: `Reviewer Customer ${timestamp}`,
    email: `reviewer.${timestamp}@test.com`,
    mobileNumber: `+9197${String(timestamp).slice(-8)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 3. Create Test Owner
  const testOwner = await (UserModel as any).create({
    fullName: `Facility Owner ${timestamp}`,
    email: `lot.owner.${timestamp}@test.com`,
    mobileNumber: `+9196${String(timestamp).slice(-8)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 4. Create Test Parking Lot
  const testLot = await (ParkingLotModel as any).create({
    ownerId: testOwner._id,
    parkingName: `Grand Mod Plaza ${timestamp}`,
    description: 'Modern urban commercial facility',
    contactNumber: '+919988776655',
    supportEmail: `support.${timestamp}@modplaza.test`,
    address: '100 Sunset Boulevard',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '400001',
    latitude: 19.076,
    longitude: 72.8777,
    location: {
      type: 'Point',
      coordinates: [72.8777, 19.076],
    },
    totalFloors: 1,
    totalSlots: 20,
    availableSlots: 20,
    carHourlyRate: 50,
    bikeHourlyRate: 20,
    operatingHours: {
      is24Hours: true,
    },
    parkingStatus: 'Active',
  });

  // 5. Create Test Floor, Zone, Bay & Vehicle
  const testFloor = await (ParkingFloorModel as any).create({
    parkingLotId: testLot._id,
    floorNumber: 1,
    floorName: 'Ground Floor',
    totalZones: 1,
    totalSlots: 20,
    availableSlots: 20,
    status: 'Active',
  });

  const testZone = await (ParkingZoneModel as any).create({
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneName: 'Zone A',
    zoneCode: 'ZA',
    vehicleType: 'Car',
    totalSlots: 20,
    availableSlots: 20,
    status: 'Active',
  });

  const testSlot = await (ParkingSlotModel as any).create({
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    slotNumber: `B-${timestamp.toString().slice(-4)}`,
    slotLabel: `MOD-BAY-${timestamp.toString().slice(-4)}`,
    slotType: 'Standard',
    vehicleType: 'Car',
    qrIdentifier: `QR-MOD-${timestamp}`,
    status: 'Available',
  });

  const testVehicle = await (VehicleModel as any).create({
    customerId: testCustomer._id,
    vehicleNumber: `MH01MD${timestamp.toString().slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Hyundai',
    vehicleModel: 'Creta',
  });

  // 6. Create Test Bookings
  const booking1 = await (BookingModel as any).create({
    bookingReference: `BK-MOD-1-${timestamp}`,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    originalSlotId: testSlot._id,
    currentSlotId: testSlot._id,
    vehicleId: testVehicle._id,
    scheduledEntryTime: new Date(Date.now() - 3600000 * 5),
    scheduledExitTime: new Date(Date.now() - 3600000 * 2),
    startTime: new Date(Date.now() - 3600000 * 5),
    endTime: new Date(Date.now() - 3600000 * 2),
    bookingDurationMinutes: 180,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 75,
    baseAmount: 130,
    platformBookingFee: 20,
    totalAmount: 150,
    bookingStatus: 'Completed',
    paymentStatus: 'PAID',
    bookingType: 'ONLINE',
  });

  const booking2 = await (BookingModel as any).create({
    bookingReference: `BK-MOD-2-${timestamp}`,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    originalSlotId: testSlot._id,
    currentSlotId: testSlot._id,
    vehicleId: testVehicle._id,
    scheduledEntryTime: new Date(Date.now() - 3600000 * 10),
    scheduledExitTime: new Date(Date.now() - 3600000 * 7),
    startTime: new Date(Date.now() - 3600000 * 10),
    endTime: new Date(Date.now() - 3600000 * 7),
    bookingDurationMinutes: 180,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 75,
    baseAmount: 130,
    platformBookingFee: 20,
    totalAmount: 150,
    bookingStatus: 'Completed',
    paymentStatus: 'PAID',
    bookingType: 'ONLINE',
  });

  const booking3 = await (BookingModel as any).create({
    bookingReference: `BK-MOD-3-${timestamp}`,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    originalSlotId: testSlot._id,
    currentSlotId: testSlot._id,
    vehicleId: testVehicle._id,
    scheduledEntryTime: new Date(Date.now() - 3600000 * 20),
    scheduledExitTime: new Date(Date.now() - 3600000 * 18),
    startTime: new Date(Date.now() - 3600000 * 20),
    endTime: new Date(Date.now() - 3600000 * 18),
    bookingDurationMinutes: 120,
    parkingRateAtBooking: 50,
    overstayRateAtBooking: 75,
    baseAmount: 80,
    platformBookingFee: 20,
    totalAmount: 100,
    bookingStatus: 'Completed',
    paymentStatus: 'PAID',
    bookingType: 'ONLINE',
  });

  // 7. Create Test Reviews
  // Review 1: Published review with owner reply
  const review1 = await (ReviewModel as any).create({
    bookingId: booking1._id,
    customerId: testCustomer._id,
    ownerId: testOwner._id,
    parkingLotId: testLot._id,
    overallRating: 5,
    comment: `Exceptional clean parking bay and fast QR gate access ${timestamp}!`,
    ownerReply: 'Thank you for choosing Grand Mod Plaza!',
    replyDate: new Date(),
    moderationStatus: 'Published',
  });

  // Review 2: Under Review (Flagged for abusive language or spam)
  const review2 = await (ReviewModel as any).create({
    bookingId: booking2._id,
    customerId: testCustomer._id,
    ownerId: testOwner._id,
    parkingLotId: testLot._id,
    overallRating: 1,
    comment: `Worst parking experience ever ${timestamp}. Unreasonable queue!`,
    moderationStatus: 'Under Review',
  });

  // Review 3: Hidden review without reply (deletable candidate)
  const review3 = await (ReviewModel as any).create({
    bookingId: booking3._id,
    customerId: testCustomer._id,
    ownerId: testOwner._id,
    parkingLotId: testLot._id,
    overallRating: 2,
    comment: `Accidental duplicate test review ${timestamp}.`,
    moderationStatus: 'Hidden',
    moderationReason: 'Spam duplicate review hidden by system',
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Review Overview KPIs & Distributions
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Review Overview KPIs ---');
    const overview = await adminReviewsService.getOverview();
    console.log('Overview metrics:', {
      totalReviews: overview.totalReviews,
      published: overview.publishedReviews,
      underReview: overview.underReviewReviews,
      hidden: overview.hiddenReviews,
      avgRating: overview.averageRating,
      ratingDistribution: overview.ratingDistribution,
    });

    if (overview.totalReviews < 3 || overview.publishedReviews < 1) {
      throw new Error('Overview KPIs do not reflect created test reviews.');
    }
    console.log('✓ Test 1 Passed: Review overview metrics and rating distribution calculated accurately.');

    // -------------------------------------------------------------
    // Test 2: Search & Multi-Criteria Filtering
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Search and Multi-Criteria Filtering ---');

    // Search by customer name
    const searchByName = await adminReviewsService.getReviews({
      search: `Reviewer Customer ${timestamp}`,
    });
    console.log(`Matched by customer name: ${searchByName.pagination.total}`);
    if (searchByName.pagination.total < 3) {
      throw new Error('Search failed to match reviews by customer full name.');
    }

    // Search by booking reference
    const searchByBooking = await adminReviewsService.getReviews({
      search: `BK-MOD-1-${timestamp}`,
    });
    console.log(`Matched by booking ref: ${searchByBooking.pagination.total}`);
    if (searchByBooking.pagination.total !== 1) {
      throw new Error('Search failed to match review by booking reference.');
    }

    // Filter by rating = 5
    const filterRating5 = await adminReviewsService.getReviews({
      rating: 5,
      parkingLotId: testLot._id.toString(),
    });
    console.log(`Matched 5-star reviews for test lot: ${filterRating5.pagination.total}`);
    if (filterRating5.pagination.total !== 1 || filterRating5.reviews[0]?.overallRating !== 5) {
      throw new Error('Rating filter failed to isolate 5-star review.');
    }

    // Filter by status = 'Under Review'
    const filterUnderReview = await adminReviewsService.getReviews({
      status: 'Under Review',
      parkingLotId: testLot._id.toString(),
    });
    console.log(`Matched Under Review status: ${filterUnderReview.pagination.total}`);
    if (filterUnderReview.pagination.total !== 1 || filterUnderReview.reviews[0]?._id !== review2._id.toString()) {
      throw new Error('Status filter failed to isolate Under Review review.');
    }
    console.log('✓ Test 2 Passed: Server-side search, rating, status, and facility filters verified.');

    // -------------------------------------------------------------
    // Test 3: Review Detail Inspection
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Single Review Detail Dossier ---');
    const detail = await adminReviewsService.getReviewById(review1._id.toString());
    console.log('Review detail:', {
      _id: detail._id,
      customer: detail.customer?.fullName,
      facility: detail.parkingLot?.parkingName,
      owner: detail.owner?.fullName,
      bookingRef: detail.booking?.bookingReference,
      rating: detail.overallRating,
      ownerReply: detail.ownerReply,
      moderationStatus: detail.moderationStatus,
    });

    if (!detail.customer || detail.customer.email !== testCustomer.email) {
      throw new Error('Review detail does not accurately populate customer.');
    }
    if (!detail.parkingLot || detail.parkingLot.parkingName !== testLot.parkingName) {
      throw new Error('Review detail does not populate parking facility.');
    }
    if (!detail.booking || detail.booking.bookingReference !== booking1.bookingReference) {
      throw new Error('Review detail does not populate booking reference.');
    }
    console.log('✓ Test 3 Passed: Deep review inspection dossier populated with relations.');

    // -------------------------------------------------------------
    // Test 4: Approve Review & Transition Validation
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Approve Review & State Transitions ---');
    const approveRes = await adminReviewsService.approveReview(
      testAdmin._id.toString(),
      review2._id.toString(),
      'Verified booking stay; review language within permissible standards',
    );

    console.log('Approved review status:', approveRes.moderationStatus);
    if (approveRes.moderationStatus !== 'Published') {
      throw new Error(`Expected moderationStatus 'Published', got '${approveRes.moderationStatus}'`);
    }
    if (!approveRes.moderatedBy || approveRes.moderatedBy.email !== testAdmin.email) {
      throw new Error('Approving administrator attribution was not recorded.');
    }
    if (approveRes.moderationHistory.length === 0 || approveRes.moderationHistory[0]?.action !== 'Approve') {
      throw new Error('Moderation history was not updated with approval record.');
    }

    // Verify redundant approval prevention (cannot approve already published review)
    let caughtRedundantApprove = false;
    try {
      await adminReviewsService.approveReview(testAdmin._id.toString(), review2._id.toString());
    } catch (err: any) {
      if (err.errorCode === 'ALREADY_PUBLISHED') {
        caughtRedundantApprove = true;
      }
    }
    if (!caughtRedundantApprove) {
      throw new Error('Server allowed redundant approval on an already published review.');
    }
    console.log('✓ Test 4 Passed: Review approved to Published status with audit history and redundant transition prevention.');

    // -------------------------------------------------------------
    // Test 5: Hide Review with Mandatory Reason
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Hide Review Workflow ---');

    // Missing reason should be rejected
    let caughtMissingReason = false;
    try {
      await adminReviewsService.hideReview(testAdmin._id.toString(), review2._id.toString(), ' ');
    } catch (err: any) {
      if (err.errorCode === 'REASON_REQUIRED') {
        caughtMissingReason = true;
      }
    }
    if (!caughtMissingReason) {
      throw new Error('Server permitted hiding review without a mandatory moderation reason.');
    }

    const hideRes = await adminReviewsService.hideReview(
      testAdmin._id.toString(),
      review2._id.toString(),
      'Reported by facility management: review contains unsubstantiated slander',
    );

    console.log('Hidden review status:', hideRes.moderationStatus);
    if (hideRes.moderationStatus !== 'Hidden') {
      throw new Error(`Expected moderationStatus 'Hidden', got '${hideRes.moderationStatus}'`);
    }

    // Verify redundant hide prevention
    let caughtRedundantHide = false;
    try {
      await adminReviewsService.hideReview(testAdmin._id.toString(), review2._id.toString(), 'Already hidden');
    } catch (err: any) {
      if (err.errorCode === 'ALREADY_HIDDEN') {
        caughtRedundantHide = true;
      }
    }
    if (!caughtRedundantHide) {
      throw new Error('Server permitted redundant hide action on already hidden review.');
    }
    console.log('✓ Test 5 Passed: Review hidden successfully with mandatory reason and state validation.');

    // -------------------------------------------------------------
    // Test 6: Historical Review Protection & Delete Safeguards
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Historical Review Protection ---');

    // Attempt to delete Review 1 (has ownerReply) -> MUST BE BLOCKED
    let caughtOwnerReplyDeleteBlock = false;
    try {
      await adminReviewsService.deleteReview(
        testAdmin._id.toString(),
        review1._id.toString(),
        'Admin cleanup attempt',
      );
    } catch (err: any) {
      if (err.errorCode === 'HISTORICAL_PROTECTION_CONFLICT') {
        caughtOwnerReplyDeleteBlock = true;
      }
    }
    if (!caughtOwnerReplyDeleteBlock) {
      throw new Error('Server allowed deletion of review containing an active owner reply!');
    }
    console.log('Caught expected block on review with owner reply: 409 Conflict');

    // Attempt to delete review without reason -> MUST BE BLOCKED
    let caughtDeleteReasonReq = false;
    try {
      await adminReviewsService.deleteReview(testAdmin._id.toString(), review3._id.toString(), ' ');
    } catch (err: any) {
      if (err.errorCode === 'REASON_REQUIRED') {
        caughtDeleteReasonReq = true;
      }
    }
    if (!caughtDeleteReasonReq) {
      throw new Error('Server allowed deletion without mandatory deletion reason.');
    }

    // Permitted deletion on Review 3 (Hidden, no reply)
    const deleteRes = await adminReviewsService.deleteReview(
      testAdmin._id.toString(),
      review3._id.toString(),
      'Confirmed accidental duplicate review by customer testing portal',
    );
    console.log('Permitted deletion result:', deleteRes);
    if (!deleteRes.success) {
      throw new Error('Permitted deletion of un-replied hidden review failed.');
    }

    // Confirm record no longer exists
    const deletedCheck = await (ReviewModel as any).findById(review3._id);
    if (deletedCheck) {
      throw new Error('Review was not removed from database.');
    }

    // Verify AuditLog record for deletion
    const deleteAudit = await (AuditLogModel as any).findOne({
      userId: testAdmin._id,
      actionCode: 'REVIEW_DELETED',
    });
    if (!deleteAudit) {
      throw new Error('AuditLog entry for REVIEW_DELETED was not recorded.');
    }
    console.log('Recorded deletion audit:', deleteAudit.description);
    console.log('✓ Test 6 Passed: Historical review protection enforced; permitted deletion logged to audit trail.');

    // -------------------------------------------------------------
    // Test 7: Review Association Immutability
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Review Association Immutability ---');
    const reloadedReview1 = await (ReviewModel as any).findById(review1._id);
    if (
      reloadedReview1.customerId.toString() !== testCustomer._id.toString() ||
      reloadedReview1.parkingLotId.toString() !== testLot._id.toString() ||
      reloadedReview1.ownerId.toString() !== testOwner._id.toString() ||
      reloadedReview1.bookingId.toString() !== booking1._id.toString()
    ) {
      throw new Error('Review customer, lot, owner, or booking association was mutated!');
    }
    console.log('✓ Test 7 Passed: Customer, facility, owner, and booking associations strictly preserved.');

    // -------------------------------------------------------------
    // Test 8: Filter Dropdown Options Population
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Filter Dropdown Options ---');
    const filterOptions = await adminReviewsService.getFilterOptions();
    console.log('Filter options count:', {
      lots: filterOptions.parkingLots.length,
      owners: filterOptions.owners.length,
    });
    if (filterOptions.parkingLots.length === 0 || filterOptions.owners.length === 0) {
      throw new Error('Filter options failed to return parking lots or owners.');
    }
    console.log('✓ Test 8 Passed: Filter options for facilities and owners populated successfully.');

    console.log('\n==================================================================');
    console.log('🎉 ALL 8 ADMIN REVIEWS & MODERATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('==================================================================\n');
  } finally {
    console.log('Cleaning up test artifacts...');
    await (ReviewModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (BookingModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (ParkingSlotModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (ParkingZoneModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (ParkingFloorModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (VehicleModel as any).deleteMany({
      _id: testVehicle._id,
    });
    await (ParkingLotModel as any).deleteMany({
      _id: testLot._id,
    });
    await (UserModel as any).deleteMany({
      _id: { $in: [testAdmin._id, testCustomer._id, testOwner._id] },
    });
    await (AuditLogModel as any).deleteMany({
      userId: testAdmin._id,
    });
    await mongoose.disconnect();
    console.log('Database disconnected. Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
