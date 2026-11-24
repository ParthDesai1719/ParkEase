import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import {
  BookingModel,
  FavouriteLocationModel,
  ParkingLotModel,
  ParkingSlotModel,
  ParkingFloorModel,
  ParkingZoneModel,
  ParkingLayoutModel,
  ReviewModel,
  UserModel,
  RoleModel,
  VehicleModel,
} from '../src/models/index.js';
import { customerReviewService } from '../src/services/customerReview.service.js';
import { customerParkingService } from '../src/services/customerParking.service.js';
import { adminReviewsService } from '../src/services/adminReviews.service.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('========================================================================');
  console.log('  ParkEase — Customer Reviews & Favourite Locations Verification Tests');
  console.log('========================================================================\n');

  console.log('Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ MongoDB connected successfully.\n');

  // Test state identifiers
  const runId = Date.now().toString().slice(-6);
  const testEmailPrefix = `cr_test_${runId}`;

  let customerA: any = null;
  let customerB: any = null;
  let owner: any = null;
  let admin: any = null;
  let parkingLot: any = null;

  try {
    console.log('[SETUP] Provisioning test roles, users, facility, and bookings...');

    // 1. Roles
    let customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    if (!customerRole) {
      customerRole = await RoleModel.create({
        roleName: 'Customer',
        roleCode: 'CUSTOMER',
        description: 'Customer role',
        permissions: [],
        dashboardRoute: '/customer/dashboard',
      });
    }

    let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
    if (!ownerRole) {
      ownerRole = await RoleModel.create({
        roleName: 'Parking Owner',
        roleCode: 'OWNER',
        description: 'Parking Owner role',
        permissions: [],
        dashboardRoute: '/owner/dashboard',
      });
    }

    let adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleModel.create({
        roleName: 'Administrator',
        roleCode: 'ADMIN',
        description: 'System Administrator role',
        permissions: [],
        dashboardRoute: '/admin/dashboard',
      });
    }

    // 2. Users: Customer A, Customer B, Owner, Admin
    const random8 = Math.floor(10000000 + Math.random() * 90000000);
    customerA = await UserModel.create({
      fullName: `Customer Alpha ${runId}`,
      email: `${testEmailPrefix}_a@parkease.test`,
      mobileNumber: `+9191${random8}`,
      password: 'HashedPassword123!',
      roleId: customerRole._id,
      isVerified: true,
      status: 'ACTIVE',
    });

    customerB = await UserModel.create({
      fullName: `Customer Beta ${runId}`,
      email: `${testEmailPrefix}_b@parkease.test`,
      mobileNumber: `+9192${random8}`,
      password: 'HashedPassword123!',
      roleId: customerRole._id,
      isVerified: true,
      status: 'ACTIVE',
    });

    owner = await UserModel.create({
      fullName: `Facility Owner ${runId}`,
      email: `${testEmailPrefix}_owner@parkease.test`,
      mobileNumber: `+9193${random8}`,
      password: 'HashedPassword123!',
      roleId: ownerRole._id,
      isVerified: true,
      status: 'ACTIVE',
    });

    admin = await UserModel.create({
      fullName: `System Admin ${runId}`,
      email: `${testEmailPrefix}_admin@parkease.test`,
      mobileNumber: `+9194${random8}`,
      password: 'HashedPassword123!',
      roleId: adminRole._id,
      isVerified: true,
      status: 'ACTIVE',
    });

    // 3. Vehicles
    const vehicleA = await VehicleModel.create({
      customerId: customerA._id,
      vehicleNumber: `MH12AB${Math.floor(1000 + Math.random() * 8999)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Honda',
      vehicleModel: 'City',
      vehicleColor: 'White',
      fuelType: 'Petrol',
      isDefault: true,
      vehicleStatus: 'Active',
    });

    const vehicleB = await VehicleModel.create({
      customerId: customerB._id,
      vehicleNumber: `MH14CD${Math.floor(1000 + Math.random() * 8999)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'i20',
      vehicleColor: 'Blue',
      fuelType: 'Petrol',
      isDefault: true,
      vehicleStatus: 'Active',
    });

    // 4. Parking Facility
    parkingLot = await ParkingLotModel.create({
      ownerId: owner._id,
      parkingName: `Skyline Plaza Hub ${runId}`,
      description: 'Airport commercial parking facility',
      address: '100 Airport Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      country: 'India',
      latitude: 18.5204,
      longitude: 73.8567,
      contactNumber: '+919876543210',
      location: {
        type: 'Point',
        coordinates: [73.8567, 18.5204],
      },
      hourlyRate: 50,
      totalSlots: 50,
      availableSlots: 45,
      occupiedSlots: 5,
      reservedSlots: 0,
      averageRating: 0,
      totalReviews: 0,
      parkingStatus: 'Active',
      isVerified: true,
      hasPublishedLayout: true,
      layoutReviewStatus: 'Owner Confirmed',
    });

    const floor = await ParkingFloorModel.create({
      parkingLotId: parkingLot._id,
      floorName: 'Ground Floor',
      floorLevel: 0,
      totalSlots: 50,
      floorStatus: 'Active',
    });

    const zone = await ParkingZoneModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneName: 'Zone A',
      zoneCode: 'A',
      vehicleType: 'Car',
      hourlyRate: 50,
      totalSlots: 50,
      availableSlots: 50,
      occupiedSlots: 0,
      zoneStatus: 'Active',
    });

    const slot = await ParkingSlotModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      slotNumber: 'A-101',
      slotLabel: 'Car Bay A-101',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `QR-CR-A101-${runId}`,
    });

    await ParkingLayoutModel.create({
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      version: 1,
      status: 'Published',
      isValidated: true,
      isPublished: true,
      publishedAt: new Date(),
      createdBy: owner._id,
      lastModifiedBy: owner._id,
      canvasConfig: { width: 800, height: 600, gridSize: 20, snapToGrid: true, backgroundColor: '#f8fafc' },
      elements: [
        {
          elementId: `slot-${slot._id}`,
          elementType: 'ParkingSlot',
          x: 40,
          y: 80,
          width: 50,
          height: 90,
          rotation: 0,
          zIndex: 1,
          slotId: slot._id,
          slotNumber: 'A-101',
          zoneId: zone._id,
          zoneCode: 'A',
        },
      ],
    });

    // 5. Bookings for Customer A:
    // - Booking 1: Completed (Eligible for Review)
    // - Booking 2: Completed (Eligible for Review)
    // - Booking 3: Confirmed / Upcoming (Ineligible for Review)
    const now = Date.now();
    const booking1Completed = await BookingModel.create({
      bookingReference: `BK-COMP1-${runId}`,
      customerId: customerA._id,
      vehicleId: vehicleA._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot._id,
      currentSlotId: slot._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Completed',
      scheduledEntryTime: new Date(now - 3600000 * 5),
      scheduledExitTime: new Date(now - 3600000 * 3),
      actualEntryTime: new Date(now - 3600000 * 5),
      actualExitTime: new Date(now - 3600000 * 3),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
      qrCode: `QR-COMP1-${runId}`,
      pricingSnapshot: {
        baseRatePerHour: 50,
        hoursBooked: 2,
        totalPrice: 100,
        currency: 'INR',
      },
    });

    const booking2Completed = await BookingModel.create({
      bookingReference: `BK-COMP2-${runId}`,
      customerId: customerA._id,
      vehicleId: vehicleA._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot._id,
      currentSlotId: slot._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Completed',
      scheduledEntryTime: new Date(now - 3600000 * 8),
      scheduledExitTime: new Date(now - 3600000 * 6),
      actualEntryTime: new Date(now - 3600000 * 8),
      actualExitTime: new Date(now - 3600000 * 6),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
      qrCode: `QR-COMP2-${runId}`,
      pricingSnapshot: {
        baseRatePerHour: 50,
        hoursBooked: 2,
        totalPrice: 100,
        currency: 'INR',
      },
    });

    const booking3Active = await BookingModel.create({
      bookingReference: `BK-ACTV-${runId}`,
      customerId: customerA._id,
      vehicleId: vehicleA._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot._id,
      currentSlotId: slot._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Active',
      scheduledEntryTime: new Date(now - 1800000),
      scheduledExitTime: new Date(now + 1800000),
      actualEntryTime: new Date(now - 1800000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 50,
      totalAmount: 50,
      qrCode: `QR-ACTV-${runId}`,
      pricingSnapshot: {
        baseRatePerHour: 50,
        hoursBooked: 1,
        totalPrice: 50,
        currency: 'INR',
      },
    });

    // Booking for Customer B (Completed)
    const bookingBCompleted = await BookingModel.create({
      bookingReference: `BK-CUSTB-${runId}`,
      customerId: customerB._id,
      vehicleId: vehicleB._id,
      parkingLotId: parkingLot._id,
      floorId: floor._id,
      zoneId: zone._id,
      originalSlotId: slot._id,
      currentSlotId: slot._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Completed',
      scheduledEntryTime: new Date(now - 3600000 * 4),
      scheduledExitTime: new Date(now - 3600000 * 2),
      actualEntryTime: new Date(now - 3600000 * 4),
      actualExitTime: new Date(now - 3600000 * 2),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      baseAmount: 100,
      totalAmount: 100,
      qrCode: `QR-CUSTB-${runId}`,
      pricingSnapshot: {
        baseRatePerHour: 50,
        hoursBooked: 2,
        totalPrice: 100,
        currency: 'INR',
      },
    });

    console.log('✓ Test fixtures provisioned.\n');

    // =========================================================================
    // SECTION 1: CUSTOMER REVIEWS TESTS
    // =========================================================================
    console.log('[TEST 1] Verifying Eligible Bookings for Review...');
    const eligibleBefore = await customerReviewService.getEligibleBookingsForReview(
      customerA._id.toString(),
    );
    assert(
      eligibleBefore.length === 2,
      `Customer A has exactly 2 eligible completed bookings awaiting review (got ${eligibleBefore.length})`,
    );
    assert(
      eligibleBefore.some((b) => b.bookingReference === booking1Completed.bookingReference),
      'Booking 1 is included in eligible bookings list',
    );
    assert(
      !eligibleBefore.some((b) => b.bookingReference === booking3Active.bookingReference),
      'Active/non-completed booking is excluded from eligible bookings list',
    );

    console.log('\n[TEST 2] Verifying Input Validations for Review Submission...');
    // Invalid rating < 1
    let threwInvalidRatingLow = false;
    try {
      await customerReviewService.submitReview(customerA._id.toString(), {
        bookingId: booking1Completed._id.toString(),
        overallRating: 0,
        comment: 'Invalid rating',
      });
    } catch (err: any) {
      threwInvalidRatingLow = err.errorCode === 'INVALID_RATING';
    }
    assert(threwInvalidRatingLow, 'Rating 0 rejected with INVALID_RATING error');

    // Invalid rating > 5
    let threwInvalidRatingHigh = false;
    try {
      await customerReviewService.submitReview(customerA._id.toString(), {
        bookingId: booking1Completed._id.toString(),
        overallRating: 6,
        comment: 'Too high rating',
      });
    } catch (err: any) {
      threwInvalidRatingHigh = err.errorCode === 'INVALID_RATING';
    }
    assert(threwInvalidRatingHigh, 'Rating 6 rejected with INVALID_RATING error');

    // Fractional rating
    let threwFractional = false;
    try {
      await customerReviewService.submitReview(customerA._id.toString(), {
        bookingId: booking1Completed._id.toString(),
        overallRating: 4.5,
        comment: 'Fractional rating',
      });
    } catch (err: any) {
      threwFractional = err.errorCode === 'INVALID_RATING';
    }
    assert(threwFractional, 'Non-integer rating 4.5 rejected with INVALID_RATING error');

    // Comment exceeding 1000 chars
    let threwLongComment = false;
    try {
      await customerReviewService.submitReview(customerA._id.toString(), {
        bookingId: booking1Completed._id.toString(),
        overallRating: 5,
        comment: 'A'.repeat(1001),
      });
    } catch (err: any) {
      threwLongComment = err.errorCode === 'COMMENT_TOO_LONG';
    }
    assert(threwLongComment, 'Comment > 1000 characters rejected with COMMENT_TOO_LONG error');

    console.log('\n[TEST 3] Verifying Security Boundaries: Cross-Customer & Ineligible Bookings...');
    // Customer A attempts to review Customer B's booking
    let threwCrossCustomer = false;
    try {
      await customerReviewService.submitReview(customerA._id.toString(), {
        bookingId: bookingBCompleted._id.toString(),
        overallRating: 5,
        comment: 'Unauthorized review attempt',
      });
    } catch (err: any) {
      threwCrossCustomer = err.errorCode === 'FORBIDDEN_BOOKING_ACCESS';
    }
    assert(
      threwCrossCustomer,
      'Customer A attempting to review Customer B booking rejected with 403 FORBIDDEN_BOOKING_ACCESS',
    );

    // Customer A attempts to review non-completed booking (Active)
    let threwIneligibleStatus = false;
    try {
      await customerReviewService.submitReview(customerA._id.toString(), {
        bookingId: booking3Active._id.toString(),
        overallRating: 5,
        comment: 'Premature review attempt',
      });
    } catch (err: any) {
      threwIneligibleStatus = err.errorCode === 'INELIGIBLE_BOOKING_STATUS';
    }
    assert(
      threwIneligibleStatus,
      'Submitting review for non-completed booking rejected with INELIGIBLE_BOOKING_STATUS',
    );

    console.log('\n[TEST 4] Successful Review Submission & Automatic Rating Recalculation...');
    const submittedReview1 = await customerReviewService.submitReview(customerA._id.toString(), {
      bookingId: booking1Completed._id.toString(),
      overallRating: 5,
      comment: 'Excellent facility! Clean, well-lit bays and quick gate check-in.',
    });
    assert(
      submittedReview1.overallRating === 5 && submittedReview1.moderationStatus === 'Published',
      'Review 1 submitted successfully with 5 stars and Published status',
    );

    // Check parking lot updated stats
    const updatedLotAfterRev1 = await ParkingLotModel.findById(parkingLot._id);
    assert(
      updatedLotAfterRev1?.totalReviews === 1 && updatedLotAfterRev1?.averageRating === 5,
      `Facility stats updated immediately: totalReviews=1, averageRating=5.0 (got ${updatedLotAfterRev1?.averageRating})`,
    );

    console.log('\n[TEST 5] Duplicate Review Prevention on Same Booking...');
    let threwDuplicate = false;
    try {
      await customerReviewService.submitReview(customerA._id.toString(), {
        bookingId: booking1Completed._id.toString(),
        overallRating: 4,
        comment: 'Second attempt on same booking',
      });
    } catch (err: any) {
      threwDuplicate = err.errorCode === 'DUPLICATE_REVIEW';
    }
    assert(
      threwDuplicate,
      'Duplicate review submission on already reviewed booking rejected with DUPLICATE_REVIEW',
    );

    console.log('\n[TEST 6] Submit Second Review & Verify Average Rating Math...');
    const submittedReview2 = await customerReviewService.submitReview(customerA._id.toString(), {
      bookingId: booking2Completed._id.toString(),
      overallRating: 3,
      comment: 'Decent experience, but slightly tight turning radius in Zone A.',
    });
    assert(
      submittedReview2.overallRating === 3,
      'Review 2 submitted successfully with 3 stars',
    );

    // Average of 5 and 3 should be 4.0
    const updatedLotAfterRev2 = await ParkingLotModel.findById(parkingLot._id);
    assert(
      updatedLotAfterRev2?.totalReviews === 2 && updatedLotAfterRev2?.averageRating === 4,
      `Facility stats aggregated accurately: totalReviews=2, averageRating=4.0 (got ${updatedLotAfterRev2?.averageRating})`,
    );

    console.log('\n[TEST 7] Customer Review Retrieval & Remaining Eligible Bookings...');
    const customerReviews = await customerReviewService.getCustomerReviews(
      customerA._id.toString(),
    );
    assert(
      customerReviews.length === 2,
      `Customer A retrieves their 2 past reviews (got ${customerReviews.length})`,
    );
    assert(
      customerReviews[0].parkingName === parkingLot.parkingName,
      'Review contains populated parking facility name',
    );

    const eligibleAfter = await customerReviewService.getEligibleBookingsForReview(
      customerA._id.toString(),
    );
    assert(
      eligibleAfter.length === 0,
      `Eligible bookings awaiting review updated to 0 after reviewing all completed bookings (got ${eligibleAfter.length})`,
    );

    console.log('\n[TEST 8] Review Editing & Security Enforcement...');
    // Customer B attempts to edit Customer A's review
    let threwCrossEdit = false;
    try {
      await customerReviewService.updateReview(
        customerB._id.toString(),
        submittedReview1._id,
        { overallRating: 1, comment: 'Hacked review' },
      );
    } catch (err: any) {
      threwCrossEdit = err.errorCode === 'FORBIDDEN_REVIEW_ACCESS';
    }
    assert(
      threwCrossEdit,
      'Unauthorized user attempting to edit another customer’s review rejected with 403',
    );

    // Customer A updates Review 2 from 3 stars to 4 stars
    const editedReview = await customerReviewService.updateReview(
      customerA._id.toString(),
      submittedReview2._id,
      {
        overallRating: 4,
        comment: 'Updated: Management improved lane signage. Good experience.',
      },
    );
    assert(
      editedReview.overallRating === 4 && editedReview.isEdited === true,
      'Review 2 updated to 4 stars and isEdited flag set to true',
    );

    // New average of 5 and 4 should be 4.5
    const updatedLotAfterEdit = await ParkingLotModel.findById(parkingLot._id);
    assert(
      updatedLotAfterEdit?.totalReviews === 2 && updatedLotAfterEdit?.averageRating === 4.5,
      `Facility average recalculated after edit: averageRating=4.5 (got ${updatedLotAfterEdit?.averageRating})`,
    );

    console.log('\n[TEST 9] Review Deletion & Recalculation...');
    // Customer B attempts to delete Customer A's review
    let threwCrossDelete = false;
    try {
      await customerReviewService.deleteReview(
        customerB._id.toString(),
        submittedReview1._id,
      );
    } catch (err: any) {
      threwCrossDelete = err.errorCode === 'FORBIDDEN_REVIEW_ACCESS';
    }
    assert(
      threwCrossDelete,
      'Unauthorized user attempting to delete another customer’s review rejected with 403',
    );

    // Customer A deletes Review 1 (5 stars)
    const deleteResult = await customerReviewService.deleteReview(
      customerA._id.toString(),
      submittedReview1._id,
    );
    assert(deleteResult.success === true, 'Review 1 deleted successfully');

    // Remaining review is Review 2 (4 stars)
    const updatedLotAfterDelete = await ParkingLotModel.findById(parkingLot._id);
    assert(
      updatedLotAfterDelete?.totalReviews === 1 && updatedLotAfterDelete?.averageRating === 4,
      `Facility stats after deletion: totalReviews=1, averageRating=4.0 (got ${updatedLotAfterDelete?.averageRating})`,
    );

    console.log('\n[TEST 10] Admin Moderation Recalculation Integration...');
    // Admin hides the remaining Review 2 -> Published reviews becomes 0
    await adminReviewsService.hideReview(
      admin._id.toString(),
      submittedReview2._id,
      'Automated moderation test hiding',
    );
    const lotAfterAdminHide = await ParkingLotModel.findById(parkingLot._id);
    assert(
      lotAfterAdminHide?.totalReviews === 0 && lotAfterAdminHide?.averageRating === 0,
      'Admin hiding review recalculates facility rating to 0 published reviews',
    );

    // Admin approves it back -> Published reviews becomes 1, rating=4.0
    await adminReviewsService.approveReview(
      admin._id.toString(),
      submittedReview2._id,
      'Re-approved after moderation review',
    );
    const lotAfterAdminApprove = await ParkingLotModel.findById(parkingLot._id);
    assert(
      lotAfterAdminApprove?.totalReviews === 1 && lotAfterAdminApprove?.averageRating === 4,
      'Admin approving review recalculates facility rating back to 4.0',
    );

    // =========================================================================
    // SECTION 2: FAVOURITE LOCATIONS TESTS
    // =========================================================================
    console.log('\n[TEST 11] Favourite Locations Lifecycle & Cross-Customer Isolation...');
    // Initial state: empty favourites for Customer A
    const initialFavsA = await customerParkingService.getCustomerFavourites(
      customerA._id.toString(),
    );
    assert(
      initialFavsA.length === 0,
      'Customer A starts with 0 favourite locations',
    );

    // Add favourite for Customer A
    const addFavResult = await customerParkingService.toggleFavourite(
      customerA._id.toString(),
      parkingLot._id.toString(),
    );
    assert(
      addFavResult.isFavourite === true,
      'Customer A successfully added facility to favourites',
    );

    // Verify retrieval & enrichment (pricing, slots, rating, address)
    const favsAAfterAdd = await customerParkingService.getCustomerFavourites(
      customerA._id.toString(),
      18.5204,
      73.8567,
    );
    assert(
      favsAAfterAdd.length === 1,
      'Customer A getCustomerFavourites returns 1 saved facility',
    );
    assert(
      favsAAfterAdd[0].parkingName === parkingLot.parkingName &&
        favsAAfterAdd[0].hourlyRate === 50 &&
        favsAAfterAdd[0].availableSlots >= 1,
      'Saved facility is enriched with live pricing, available slots, and details',
    );

    // Cross-customer isolation check: Customer B must see 0 favourites
    const favsB = await customerParkingService.getCustomerFavourites(
      customerB._id.toString(),
    );
    assert(
      favsB.length === 0,
      'Cross-customer isolation verified: Customer B cannot see Customer A favourites',
    );

    // Check favourite status helper
    const statusA = await customerParkingService.getFavouriteStatus(
      customerA._id.toString(),
      parkingLot._id.toString(),
    );
    const statusB = await customerParkingService.getFavouriteStatus(
      customerB._id.toString(),
      parkingLot._id.toString(),
    );
    assert(statusA.isFavourite === true, 'getFavouriteStatus returns true for Customer A');
    assert(statusB.isFavourite === false, 'getFavouriteStatus returns false for Customer B');

    // Remove favourite explicitly
    const removeResult = await customerParkingService.removeFavourite(
      customerA._id.toString(),
      parkingLot._id.toString(),
    );
    assert(
      removeResult.isFavourite === false,
      'removeFavourite successfully deactivates favourite',
    );

    const favsAAfterRemove = await customerParkingService.getCustomerFavourites(
      customerA._id.toString(),
    );
    assert(
      favsAAfterRemove.length === 0,
      'Customer A getCustomerFavourites is now empty after removal',
    );

    // Re-toggle back to active (duplicate prevention check)
    await customerParkingService.toggleFavourite(
      customerA._id.toString(),
      parkingLot._id.toString(),
    );
    const favDocCount = await (FavouriteLocationModel as any).countDocuments({
      customerId: customerA._id,
      parkingLotId: parkingLot._id,
    });
    assert(
      favDocCount === 1,
      'Duplicate prevention verified: exactly 1 database record exists for (customer, parkingLot)',
    );

  } catch (error: any) {
    console.error('Test execution encountered unexpected error:', error);
    failed++;
  } finally {
    console.log('\n[CLEANUP] Removing test fixtures...');
    await ReviewModel.deleteMany({ comment: { $regex: testEmailPrefix } });
    await BookingModel.deleteMany({ bookingReference: { $regex: runId } });
    await FavouriteLocationModel.deleteMany({ customerId: { $in: [customerA?._id, customerB?._id] } });
    await ParkingSlotModel.deleteMany({ parkingLotId: parkingLot?._id });
    await ParkingZoneModel.deleteMany({ parkingLotId: parkingLot?._id });
    await ParkingFloorModel.deleteMany({ parkingLotId: parkingLot?._id });
    await ParkingLayoutModel.deleteMany({ parkingLotId: parkingLot?._id });
    await ParkingLotModel.deleteMany({ _id: parkingLot?._id });
    await VehicleModel.deleteMany({ userId: { $in: [customerA?._id, customerB?._id] } });
    await UserModel.deleteMany({ email: { $regex: testEmailPrefix } });
    console.log('✓ Cleanup completed.');
    await mongoose.disconnect();
  }

  console.log('\n========================================================================');
  console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
