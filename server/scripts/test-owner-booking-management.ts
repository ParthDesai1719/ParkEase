import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { VehicleModel } from '../src/models/Vehicle.js';
import { BookingModel } from '../src/models/Booking.js';
import { PaymentModel } from '../src/models/Payment.js';
import { BookingTimelineModel } from '../src/models/BookingTimeline.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { ownerService } from '../src/services/owner.service.js';

console.log('========================================================================');
console.log('  ParkEase — Owner Module Phase 3: Booking Management Verification');
console.log('========================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  const ownerRole = await RoleModel.findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
  const staffRole = await RoleModel.findOne({ roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] } });

  assert(ownerRole, 'Owner role must exist in DB');
  assert(customerRole, 'Customer role must exist in DB');

  const runId = Date.now().toString().slice(-6);

  // 1. Create Test Owner A and Owner B
  const ownerA = await UserModel.create({
    fullName: `Owner Alpha Booking ${runId}`,
    email: `owner_bk_a_${runId}@parkease.com`,
    mobileNumber: `+9196300${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const ownerB = await UserModel.create({
    fullName: `Owner Beta Booking ${runId}`,
    email: `owner_bk_b_${runId}@parkease.com`,
    mobileNumber: `+9196400${runId.slice(-5)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const customer = await UserModel.create({
    fullName: `Customer User Booking ${runId}`,
    email: `cust_bk_${runId}@parkease.com`,
    mobileNumber: `+9196500${runId.slice(-5)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  const vehicleA = await VehicleModel.create({
    customerId: customer._id,
    vehicleNumber: `MH02BK${runId.slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
  });

  const vehicleB = await VehicleModel.create({
    customerId: customer._id,
    vehicleNumber: `MH04WI${runId.slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Hyundai',
    vehicleModel: 'Creta',
  });

  // 2. Create Facilities for Owner A and Owner B
  const lotA = await ParkingLotModel.create({
    ownerId: ownerA._id,
    parkingName: `Alpha Towers Parking ${runId}`,
    address: '100 Marine Drive, Nariman Point',
    contactNumber: '+919820011223',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400021',
    parkingCapacity: 100,
    parkingStatus: 'Active',
    hourlyRate: 80,
    gracePeriodMinutes: 15,
    location: { type: 'Point', coordinates: [72.8258, 18.922] },
    latitude: 18.922,
    longitude: 72.8258,
  });

  const floorA = await ParkingFloorModel.create({
    parkingLotId: lotA._id,
    floorNumber: 1,
    floorName: 'Ground Floor',
    floorStatus: 'Active',
    totalSlots: 10,
    availableSlots: 10,
    occupiedSlots: 0,
    reservedSlots: 0,
    maintenanceSlots: 0,
  });

  const zoneA = await ParkingZoneModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneCode: 'A',
    zoneName: 'Zone Alpha',
    vehicleType: 'Car',
    zoneStatus: 'Active',
    totalSlots: 10,
    availableSlots: 10,
    occupiedSlots: 0,
    reservedSlots: 0,
    maintenanceSlots: 0,
  });

  const slot1 = await ParkingSlotModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: 'A-101',
    slotLabel: 'Premium Slot 1',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
    qrIdentifier: `QR-SLOT-101-${runId}`,
  });

  const slot2 = await ParkingSlotModel.create({
    parkingLotId: lotA._id,
    floorId: floorA._id,
    zoneId: zoneA._id,
    slotNumber: 'A-102',
    slotLabel: 'Standard Slot 2',
    slotType: 'Standard',
    supportedVehicleType: 'Car',
    slotStatus: 'Available',
    qrIdentifier: `QR-SLOT-102-${runId}`,
  });

  const lotB = await ParkingLotModel.create({
    ownerId: ownerB._id,
    parkingName: `Beta Hub Parking ${runId}`,
    address: '200 Bandra West',
    contactNumber: '+919820011224',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400050',
    parkingCapacity: 50,
    parkingStatus: 'Active',
    hourlyRate: 100,
    gracePeriodMinutes: 15,
    location: { type: 'Point', coordinates: [72.83, 19.05] },
    latitude: 19.05,
    longitude: 72.83,
  });

  console.log('✓ Initialized test Owners, Facilities, Hierarchy, and Customer.\n');

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Create Diverse Bookings (Online, Walk-in, Paid Razorpay, Paid Cash)
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Seeding Test Bookings for Owner A ---');
    const now = new Date();
    const entryTime1 = new Date(now.getTime() + 30 * 60 * 1000);
    const exitTime1 = new Date(now.getTime() + 150 * 60 * 1000);

    // Booking 1: Online, Confirmed, Razorpay Paid
    const booking1 = await BookingModel.create({
      bookingReference: `BK-ONL-${runId}-1`,
      customerId: customer._id,
      vehicleId: vehicleA._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      scheduledEntryTime: entryTime1,
      scheduledExitTime: exitTime1,
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 80,
      overstayRateAtBooking: 120,
      baseAmount: 160,
      additionalCharges: 0,
      totalAmount: 160,
      gracePeriodMinutes: 15,
      qrCode: `QR-CODE-${runId}-1`,
    });

    const payment1 = await PaymentModel.create({
      paymentReference: `PAY-RAZ-${runId}-1`,
      bookingId: booking1._id,
      userId: customer._id,
      parkingLotId: lotA._id,
      amount: 160,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      transactionId: `txn_raz_${runId}_1`,
      gatewayPaymentId: `pay_raz_${runId}_1`,
      paymentDate: new Date(),
    });

    await BookingTimelineModel.create({
      bookingId: booking1._id,
      performedBy: customer._id,
      eventCode: 'BOOKING_CREATED',
      eventType: 'Booking Created',
      eventTitle: 'Online Booking Created',
      eventDescription: 'Booking created via ParkEase Web App',
      eventSource: 'Customer',
      eventTime: new Date(now.getTime() - 10 * 60 * 1000),
    });

    // Booking 2: Walk-in, Active, Cash Paid
    const entryTime2 = new Date(now.getTime() - 30 * 60 * 1000);
    const exitTime2 = new Date(now.getTime() + 90 * 60 * 1000);
    const booking2 = await BookingModel.create({
      bookingReference: `BK-WLK-${runId}-2`,
      customerId: customer._id,
      vehicleId: vehicleB._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot2._id,
      currentSlotId: slot2._id,
      bookingType: 'WALK_IN',
      bookingStatus: 'Active',
      scheduledEntryTime: entryTime2,
      scheduledExitTime: exitTime2,
      actualEntryTime: new Date(now.getTime() - 25 * 60 * 1000),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 80,
      overstayRateAtBooking: 120,
      baseAmount: 160,
      additionalCharges: 0,
      totalAmount: 160,
      gracePeriodMinutes: 15,
      qrCode: `QR-CODE-${runId}-2`,
    });

    const payment2 = await PaymentModel.create({
      paymentReference: `PAY-CSH-${runId}-2`,
      bookingId: booking2._id,
      userId: customer._id,
      parkingLotId: lotA._id,
      amount: 160,
      paymentMethod: 'CASH',
      paymentStatus: 'SUCCESSFUL',
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      paymentDate: new Date(),
    });

    // Booking 3: Completed Booking
    const booking3 = await BookingModel.create({
      bookingReference: `BK-CMP-${runId}-3`,
      customerId: customer._id,
      vehicleId: vehicleA._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Completed',
      scheduledEntryTime: new Date(now.getTime() - 180 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() - 60 * 60 * 1000),
      actualEntryTime: new Date(now.getTime() - 175 * 60 * 1000),
      actualExitTime: new Date(now.getTime() - 65 * 60 * 1000),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 80,
      overstayRateAtBooking: 120,
      baseAmount: 160,
      additionalCharges: 0,
      totalAmount: 160,
      gracePeriodMinutes: 15,
    });

    // Booking 0: No Show Booking (Customer paid ₹80 but never checked in -> non-refundable, counted as revenue)
    const bookingNoShow = await BookingModel.create({
      bookingReference: `BK-NSH-${runId}-0`,
      customerId: customer._id,
      vehicleId: vehicleA._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot1._id,
      currentSlotId: slot1._id,
      bookingType: 'ONLINE',
      bookingStatus: 'No Show',
      noShowDetected: true,
      scheduledEntryTime: new Date(now.getTime() - 120 * 60 * 1000),
      scheduledExitTime: new Date(now.getTime() - 60 * 60 * 1000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 80,
      overstayRateAtBooking: 120,
      baseAmount: 80,
      additionalCharges: 0,
      totalAmount: 80,
      refundAmount: 0,
      gracePeriodMinutes: 15,
    });

    await PaymentModel.create({
      paymentReference: `PAY-NSH-${runId}-0`,
      bookingId: bookingNoShow._id,
      userId: customer._id,
      parkingLotId: lotA._id,
      amount: 80,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      transactionId: `txn_nsh_${runId}_0`,
      gatewayPaymentId: `pay_nsh_${runId}_0`,
      paymentDate: new Date(),
    });

    console.log('✓ Successfully created Online, Walk-in, Completed, and No-Show bookings with payments.\n');

    // ------------------------------------------------------------------------
    // TEST 2: Retrieve Bookings Scoped to Owner A Facility
    // ------------------------------------------------------------------------
    console.log('--- TEST 2: Owner A Bookings Listing & Scoping ---');
    const ownerABookings = await ownerService.getOwnerBookings(ownerA._id.toString(), {
      parkingLotId: lotA._id.toString(),
      limit: 10,
    });

    assert.strictEqual(ownerABookings.total, 4, 'Owner A should see exactly 4 bookings');
    assert.strictEqual(ownerABookings.summary.total, 4, 'Summary total count must be 4');
    assert.strictEqual(ownerABookings.summary.confirmed, 1, 'Summary confirmed count must be 1');
    assert.strictEqual(ownerABookings.summary.active, 1, 'Summary active count must be 1');
    assert.strictEqual(ownerABookings.summary.completed, 1, 'Summary completed count must be 1');
    assert.strictEqual(ownerABookings.summary.noShow, 1, 'Summary noShow count must be 1');
    assert.strictEqual(ownerABookings.summary.totalRevenue, 560, 'Total revenue must include non-refundable No Show (560)');

    // Check online vs walk-in creator distinction
    const onlineItem = ownerABookings.bookings.find((b) => b.bookingReference === booking1.bookingReference);
    const walkInItem = ownerABookings.bookings.find((b) => b.bookingReference === booking2.bookingReference);
    assert(onlineItem, 'Online booking must exist in response');
    assert.strictEqual(onlineItem.createdBy, 'Customer', 'Online booking must state Created By: Customer');
    assert(walkInItem, 'Walk-in booking must exist in response');
    assert.strictEqual(walkInItem.createdBy, 'Security Staff', 'Walk-in booking must state Created By: Security Staff');
    console.log('✓ Owner A bookings retrieved with accurate summary stats, creator tags, and revenue.\n');

    // ------------------------------------------------------------------------
    // TEST 3: Cross-Owner Isolation (Owner B cannot access Owner A facility or bookings)
    // ------------------------------------------------------------------------
    console.log('--- TEST 3: Cross-Owner Isolation Verification ---');
    // Owner B querying Owner A's parking lot ID directly must throw 403 Forbidden
    let isolationErrorCaught = false;
    try {
      await ownerService.getOwnerBookings(ownerB._id.toString(), {
        parkingLotId: lotA._id.toString(),
      });
    } catch (err: any) {
      isolationErrorCaught = true;
      assert.strictEqual(err.statusCode, 403, 'Cross-owner facility access must return 403');
    }
    assert(isolationErrorCaught, 'Owner B must be forbidden from querying Owner A facility bookings');

    // Owner B querying booking1 by ID must throw 403 Forbidden
    let detailIsolationCaught = false;
    try {
      await ownerService.getOwnerBookingById(ownerB._id.toString(), booking1._id.toString());
    } catch (err: any) {
      detailIsolationCaught = true;
      assert.strictEqual(err.statusCode, 403, 'Cross-owner booking detail must return 403');
    }
    assert(detailIsolationCaught, 'Owner B must be forbidden from retrieving Owner A booking detail');
    console.log('✓ Cross-owner isolation verified: 403 Forbidden returned on unauthorized facility & booking access.\n');

    // ------------------------------------------------------------------------
    // TEST 4: Search & Filtering Capabilities
    // ------------------------------------------------------------------------
    console.log('--- TEST 4: Search and Filter Verification ---');
    // Filter by status = 'Active'
    const activeFiltered = await ownerService.getOwnerBookings(ownerA._id.toString(), {
      status: 'Active',
    });
    assert.strictEqual(activeFiltered.bookings.length, 1, 'Status filter Active should return 1 booking');
    assert.strictEqual(activeFiltered.bookings[0]._id, booking2._id.toString());

    // Filter by bookingType = 'WALK_IN'
    const walkInFiltered = await ownerService.getOwnerBookings(ownerA._id.toString(), {
      bookingType: 'WALK_IN',
    });
    assert.strictEqual(walkInFiltered.bookings.length, 1, 'Type filter WALK_IN should return 1 booking');
    assert.strictEqual(walkInFiltered.bookings[0].bookingReference, booking2.bookingReference);

    // Search by bookingReference
    const refSearch = await ownerService.getOwnerBookings(ownerA._id.toString(), {
      search: booking1.bookingReference,
    });
    assert.strictEqual(refSearch.bookings.length, 1, 'Search by reference should find exact booking');
    assert.strictEqual(refSearch.bookings[0].bookingReference, booking1.bookingReference);

    // Search by vehicle plate
    const plateSearch = await ownerService.getOwnerBookings(ownerA._id.toString(), {
      search: vehicleB.vehicleNumber,
    });
    assert.strictEqual(plateSearch.bookings.length, 1, 'Search by plate should find matching booking');
    assert.strictEqual(plateSearch.bookings[0].bookingReference, booking2.bookingReference);

    console.log('✓ Status, booking type, reference, and vehicle plate filters verified.\n');

    // ------------------------------------------------------------------------
    // TEST 5: Booking Details Retrieval with Timeline and Payment
    // ------------------------------------------------------------------------
    console.log('--- TEST 5: Booking Detail Retrieval ---');
    const detail = await ownerService.getOwnerBookingById(ownerA._id.toString(), booking1._id.toString());
    assert.strictEqual(detail._id, booking1._id.toString());
    assert.strictEqual(detail.customer?.fullName, customer.fullName);
    assert.strictEqual(detail.vehicle?.vehicleNumber, vehicleA.vehicleNumber);
    assert.strictEqual(detail.parkingLot?.parkingName, lotA.parkingName);
    assert.strictEqual(detail.slot?.slotNumber, 'A-101');
    assert(detail.timeline.length >= 1, 'Timeline events must be populated');
    assert.strictEqual(detail.payments.length, 1, 'Payment records must be populated');
    assert.strictEqual(detail.canCancel, true, 'Confirmed booking should be cancellable');
    assert.strictEqual(detail.canExtend, true, 'Confirmed booking should be extendable');
    assert.strictEqual(detail.canDownloadReceipt, true, 'Paid booking should allow receipt download');
    console.log('✓ Booking details retrieved with complete customer, vehicle, hierarchy, timeline, and payment data.\n');

    // ------------------------------------------------------------------------
    // TEST 6: Operational Cancellation with Mandatory Reason & Online Refund
    // ------------------------------------------------------------------------
    console.log('--- TEST 6: Operational Cancellation (Online / Razorpay) ---');
    // Rejection on missing reason
    let missingReasonCaught = false;
    try {
      await ownerService.cancelOwnerBooking(ownerA._id.toString(), booking1._id.toString(), { reason: '' });
    } catch (err: any) {
      missingReasonCaught = true;
      assert.strictEqual(err.statusCode, 400, 'Empty reason must be rejected with 400');
    }
    assert(missingReasonCaught, 'Silent cancellation without reason must be rejected');

    // Successful operational cancellation
    const cancelRes = await ownerService.cancelOwnerBooking(ownerA._id.toString(), booking1._id.toString(), {
      reason: 'Maintenance Work: Emergency repairs required in Zone A',
    });

    assert.strictEqual(cancelRes.bookingStatus, 'Cancelled', 'Booking status must become Cancelled');
    assert.strictEqual(cancelRes.cancellationBy, 'Parking Owner', 'cancellationBy must be Parking Owner');
    assert(cancelRes.refundAmount > 0, 'Refund amount must be credited for online booking');
    assert.strictEqual(cancelRes.payment?.paymentStatus, 'REFUNDED', 'Online payment must be marked REFUNDED');

    // Verify timeline entry
    const cancelTimeline = cancelRes.timeline.find((t) => t.eventCode === 'BOOKING_CANCELLED');
    assert(cancelTimeline, 'BOOKING_CANCELLED timeline event must exist');
    assert.strictEqual(cancelTimeline.eventSource, 'Parking Owner');

    // Verify audit log
    const cancelAudit = await AuditLogModel.findOne({
      actionCode: 'OWNER_BOOKING_CANCELLED',
      targetDocumentId: booking1._id,
    });
    assert(cancelAudit, 'OWNER_BOOKING_CANCELLED audit log must be persisted');

    // Verify slot was released to Available
    const slot1After = await ParkingSlotModel.findById(slot1._id);
    assert.strictEqual(slot1After?.slotStatus, 'Available', 'Slot must be released to Available upon cancellation');
    console.log('✓ Online cancellation verified: status updated, REFUNDED payment, slot released, timeline & audit persisted.\n');

    // ------------------------------------------------------------------------
    // TEST 7: Operational Cancellation of Walk-in / Cash Booking (Cash Reversal)
    // ------------------------------------------------------------------------
    console.log('--- TEST 7: Operational Cancellation (Walk-in / Cash Reversal) ---');
    const cancelCashRes = await ownerService.cancelOwnerBooking(ownerA._id.toString(), booking2._id.toString(), {
      reason: 'Parking Closure: Severe weather evacuation',
    });

    assert.strictEqual(cancelCashRes.bookingStatus, 'Cancelled');
    assert.strictEqual(cancelCashRes.payment?.paymentStatus, 'CASH_REVERSAL_PENDING', 'Cash booking must enter CASH_REVERSAL_PENDING');
    assert(cancelCashRes.payment?.refundStatus, 'Refund record should exist for cash reversal tracking');

    // Ensure NO Razorpay refund ID was set
    const cashPaymentAfter = await PaymentModel.findOne({ bookingId: booking2._id });
    assert(cashPaymentAfter?.paymentMethod === 'CASH', 'Payment method must remain CASH');
    assert(!cashPaymentAfter?.gatewayRefundId, 'No Razorpay gateway refund ID for cash booking');
    console.log('✓ Cash walk-in cancellation verified: status updated, CASH_REVERSAL_PENDING marked, no gateway refund.\n');

    // ------------------------------------------------------------------------
    // TEST 8: Rejection of Cancellation on Completed Booking (409 Conflict)
    // ------------------------------------------------------------------------
    console.log('--- TEST 8: Ineligible Cancellation Rejection ---');
    let completedCancelCaught = false;
    try {
      await ownerService.cancelOwnerBooking(ownerA._id.toString(), booking3._id.toString(), {
        reason: 'Attempting to cancel already completed booking',
      });
    } catch (err: any) {
      completedCancelCaught = true;
      assert.strictEqual(err.statusCode, 409, 'Cancelling completed booking must return 409');
    }
    assert(completedCancelCaught, 'Completed booking cannot be cancelled');
    console.log('✓ Ineligible cancellation rejection verified (409 Conflict).\n');

    // ------------------------------------------------------------------------
    // TEST 9: Booking Extension (Validation, Overlap Conflict, Backend Price Calculation)
    // ------------------------------------------------------------------------
    console.log('--- TEST 9: Booking Extension & Conflict Detection ---');
    // Create new Confirmed booking 4 on slot2
    const entry4 = new Date(now.getTime() + 60 * 60 * 1000);
    const exit4 = new Date(now.getTime() + 120 * 60 * 1000);

    const booking4 = await BookingModel.create({
      bookingReference: `BK-EXT-${runId}-4`,
      customerId: customer._id,
      vehicleId: vehicleA._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot2._id,
      currentSlotId: slot2._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      scheduledEntryTime: entry4,
      scheduledExitTime: exit4,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 80,
      overstayRateAtBooking: 120,
      baseAmount: 80,
      additionalCharges: 0,
      totalAmount: 80,
      gracePeriodMinutes: 15,
    });

    // Create an overlapping Confirmed booking 5 on the same slot2 from exit4 to exit4 + 2 hours
    const entry5 = new Date(exit4.getTime() + 30 * 60 * 1000); // 30 mins after exit4
    const exit5 = new Date(entry5.getTime() + 60 * 60 * 1000);

    const booking5 = await BookingModel.create({
      bookingReference: `BK-OVR-${runId}-5`,
      customerId: customer._id,
      vehicleId: vehicleB._id,
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      originalSlotId: slot2._id,
      currentSlotId: slot2._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      scheduledEntryTime: entry5,
      scheduledExitTime: exit5,
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 80,
      overstayRateAtBooking: 120,
      baseAmount: 80,
      additionalCharges: 0,
      totalAmount: 80,
      gracePeriodMinutes: 15,
    });

    // Attempt to extend booking 4 past entry5 (should conflict and return 409)
    let overlapConflictCaught = false;
    const requestedConflictExit = new Date(exit5.getTime() + 30 * 60 * 1000);
    try {
      await ownerService.extendOwnerBooking(ownerA._id.toString(), booking4._id.toString(), {
        newScheduledExitTime: requestedConflictExit.toISOString(),
      });
    } catch (err: any) {
      overlapConflictCaught = true;
      assert.strictEqual(err.statusCode, 409, 'Conflicting extension must return 409');
    }
    assert(overlapConflictCaught, 'Extension overlapping with another booking must be rejected with 409');
    console.log('✓ Overlap conflict detection verified: 409 Conflict returned when requested slot interval is booked.');

    // Remove conflicting booking5 and perform successful extension
    await BookingModel.deleteOne({ _id: booking5._id });

    // Extend booking 4 by 2 hours (120 minutes)
    const validExtendedExit = new Date(exit4.getTime() + 120 * 60 * 1000);
    const extendRes = await ownerService.extendOwnerBooking(ownerA._id.toString(), booking4._id.toString(), {
      newScheduledExitTime: validExtendedExit.toISOString(),
    });

    assert.strictEqual(new Date(extendRes.scheduledExitTime).getTime(), validExtendedExit.getTime());
    // 2 hours * ₹80/hr = ₹160 additional charge
    assert.strictEqual(extendRes.additionalCharges, 160, 'Additional charges must equal 2 * hourlyRate');
    assert.strictEqual(extendRes.totalAmount, 240, 'Total amount must equal base (80) + additional (160) = 240');
    assert.strictEqual(extendRes.bookingDurationMinutes, 180, 'Duration must be 60 + 120 = 180 min');

    // Verify timeline record
    const extTimeline = extendRes.timeline.find((t) => t.eventCode === 'BOOKING_EXTENDED');
    assert(extTimeline, 'BOOKING_EXTENDED timeline event must exist');
    assert.strictEqual(extTimeline.eventSource, 'Parking Owner');

    // Verify audit log
    const extAudit = await AuditLogModel.findOne({
      actionCode: 'OWNER_BOOKING_EXTENDED',
      targetDocumentId: booking4._id,
    });
    assert(extAudit, 'OWNER_BOOKING_EXTENDED audit log must be persisted');
    console.log('✓ Booking extension verified: backend price calculation, timeline & audit log persisted.\n');

    console.log('========================================================================');
    console.log('  ALL PHASE 3 OWNER BOOKING MANAGEMENT TESTS PASSED SUCCESSFULLY! (9/9)');
    console.log('========================================================================\n');
  } finally {
    // Cleanup test artifacts
    await UserModel.deleteMany({ _id: { $in: [ownerA._id, ownerB._id, customer._id] } });
    await VehicleModel.deleteMany({ _id: { $in: [vehicleA._id, vehicleB._id] } });
    await ParkingLotModel.deleteMany({ _id: { $in: [lotA._id, lotB._id] } });
    await ParkingFloorModel.deleteMany({ _id: floorA._id });
    await ParkingZoneModel.deleteMany({ _id: zoneA._id });
    await ParkingSlotModel.deleteMany({ _id: { $in: [slot1._id, slot2._id] } });
    await BookingModel.deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await PaymentModel.deleteMany({ parkingLotId: { $in: [lotA._id, lotB._id] } });
    await BookingTimelineModel.deleteMany({ bookingId: { $in: [slot1._id, slot2._id] } });
    await AuditLogModel.deleteMany({ userId: { $in: [ownerA._id, ownerB._id] } });
    await mongoose.disconnect();
    console.log('✓ Teardown complete. Disconnected from MongoDB.');
  }
}

run().catch((err) => {
  console.error('\n❌ Phase 3 verification test failed:', err);
  process.exit(1);
});
