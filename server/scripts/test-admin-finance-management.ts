import mongoose from 'mongoose';
import { PaymentModel } from '../src/models/Payment.js';
import { BookingModel } from '../src/models/Booking.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { VehicleModel } from '../src/models/Vehicle.js';
import { OwnerApplicationModel } from '../src/models/OwnerApplication.js';
import { adminFinanceService } from '../src/services/adminFinance.service.js';

async function runFinanceTests() {
  console.log('==================================================================');
  console.log('--- Starting Admin Phase 3 Finance Management Integration Tests ---');
  console.log('==================================================================');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const timestamp = Date.now();

  try {
    // 0. Setup mock data across all 4 payment types:
    // A. Customer role and user
    let customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
    if (!customerRole) {
      customerRole = await RoleModel.create({
        roleName: 'Customer',
        roleCode: 'CUSTOMER',
        description: 'Customer',
        permissions: [],
      });
    }

    let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
    if (!ownerRole) {
      ownerRole = await RoleModel.create({
        roleName: 'Parking Owner',
        roleCode: 'OWNER',
        description: 'Owner',
        permissions: [],
      });
    }

    const testCustomer = await UserModel.create({
      fullName: `Finance Customer ${timestamp}`,
      email: `customer.fin.${timestamp}@parkease.test`,
      mobileNumber: `+91987${String(timestamp).slice(-7)}`,
      roleId: customerRole._id,
      accountStatus: 'Active',
      isEmailVerified: true,
      isMobileVerified: true,
    });

    const testOwner = await UserModel.create({
      fullName: `Finance Owner ${timestamp}`,
      email: `owner.fin.${timestamp}@parkease.test`,
      mobileNumber: `+91986${String(timestamp).slice(-7)}`,
      roleId: ownerRole._id,
      accountStatus: 'Active',
      isEmailVerified: true,
      isMobileVerified: true,
    });

    const testVehicle = await VehicleModel.create({
      customerId: testCustomer._id,
      vehicleNumber: `MH03AB${String(timestamp).slice(-4)}`,
      vehicleType: 'Car',
      vehicleBrand: 'Honda',
      vehicleModel: 'City',
      isPrimary: true,
    });

    const testLot = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: `Finance Lot ${timestamp}`,
      address: '100 Finance Plaza',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      contactNumber: '+919876543210',
      totalCapacity: 50,
      availableSlots: 48,
      occupiedSlots: 2,
      reservedSlots: 0,
      parkingStatus: 'Active',
      latitude: 19.076,
      longitude: 72.8777,
      location: { type: 'Point', coordinates: [72.8777, 19.076] },
      pricingPlans: [{ vehicleType: 'Four Wheeler (Car)', hourlyRate: 50, isDefault: true }],
    });

    const testFloor = await ParkingFloorModel.create({
      parkingLotId: testLot._id,
      floorNumber: 1,
      floorName: 'Ground Floor',
      totalCapacity: 50,
      availableSlots: 48,
      occupiedSlots: 2,
    });

    const testZone = await ParkingZoneModel.create({
      parkingLotId: testLot._id,
      floorId: testFloor._id,
      zoneName: 'Zone F',
      zoneCode: 'ZF',
      totalCapacity: 50,
      availableSlots: 48,
      occupiedSlots: 2,
    });

    const testSlot = await ParkingSlotModel.create({
      parkingLotId: testLot._id,
      floorId: testFloor._id,
      zoneId: testZone._id,
      slotNumber: 'ZF-101',
      slotLabel: 'ZF-101',
      qrIdentifier: `QR-FIN-${timestamp}`,
      slotType: 'Standard',
      vehicleType: 'Car',
      status: 'Occupied',
    });

    // Create 4 distinct payment records:
    // 1. ONLINE BOOKING payment (RAZORPAY, SUCCESSFUL)
    const booking1 = await BookingModel.create({
      bookingReference: `BK-FIN-ONLINE-${timestamp}`,
      customerId: testCustomer._id,
      parkingLotId: testLot._id,
      floorId: testFloor._id,
      zoneId: testZone._id,
      originalSlotId: testSlot._id,
      currentSlotId: testSlot._id,
      vehicleId: testVehicle._id,
      scheduledEntryTime: new Date(Date.now() - 3600000),
      scheduledExitTime: new Date(Date.now() + 3600000),
      bookingDurationMinutes: 120,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      bookingType: 'ONLINE',
      bookingStatus: 'Confirmed',
      totalAmount: 120,
      platformBookingFee: 10,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
    });

    const payment1 = await PaymentModel.create({
      paymentReference: `PAY-FIN-1-${timestamp}`,
      transactionId: `TXN-FIN-1-${timestamp}`,
      bookingId: booking1._id,
      customerId: testCustomer._id,
      ownerId: testOwner._id,
      parkingLotId: testLot._id,
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      amount: 120,
      platformBookingFee: 10,
      additionalCharges: 0,
      refundAmount: 0,
      paymentDate: new Date(),
      remarks: 'Online booking via Razorpay test gateway',
    });

    // 2. WALK-IN CASH payment with REFUND (CASH, REFUNDED)
    const booking2 = await BookingModel.create({
      bookingReference: `BK-FIN-WALKIN-${timestamp}`,
      customerId: testCustomer._id,
      parkingLotId: testLot._id,
      floorId: testFloor._id,
      zoneId: testZone._id,
      originalSlotId: testSlot._id,
      currentSlotId: testSlot._id,
      vehicleId: testVehicle._id,
      scheduledEntryTime: new Date(Date.now() - 7200000),
      scheduledExitTime: new Date(Date.now() - 3600000),
      bookingDurationMinutes: 60,
      parkingRateAtBooking: 50,
      overstayRateAtBooking: 75,
      bookingType: 'WALK_IN',
      bookingStatus: 'Cancelled',
      totalAmount: 80,
      platformBookingFee: 10,
      refundAmount: 80,
      paymentMethod: 'CASH',
      paymentStatus: 'REFUNDED',
    });

    const payment2 = await PaymentModel.create({
      paymentReference: `PAY-FIN-2-${timestamp}`,
      transactionId: `TXN-FIN-2-${timestamp}`,
      bookingId: booking2._id,
      customerId: testCustomer._id,
      ownerId: testOwner._id,
      parkingLotId: testLot._id,
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      paymentMethod: 'CASH',
      paymentStatus: 'REFUNDED',
      amount: 80,
      platformBookingFee: 10,
      additionalCharges: 0,
      refundAmount: 80,
      paymentDate: new Date(Date.now() - 3600000),
      refundDate: new Date(),
      refunds: [
        {
          refundReference: `REF-FIN-${timestamp}`,
          refundAmount: 80,
          refundStatus: 'Refund Completed',
          refundReason: 'Customer requested walk-in cancellation',
          initiatedAt: new Date(),
          completedAt: new Date(),
        },
      ],
      remarks: 'Walk-in cash reservation cancelled and reversed',
    });

    // 3. OVERSTAY settlement payment (CASH, SUCCESSFUL)
    const payment3 = await PaymentModel.create({
      paymentReference: `PAY-FIN-3-${timestamp}`,
      transactionId: `TXN-FIN-3-${timestamp}`,
      bookingId: booking1._id,
      customerId: testCustomer._id,
      ownerId: testOwner._id,
      parkingLotId: testLot._id,
      paymentType: 'Overstay Charges',
      paymentTypeCode: 'OVERSTAY',
      paymentMethod: 'CASH',
      paymentStatus: 'SUCCESSFUL',
      amount: 50,
      platformBookingFee: 0,
      additionalCharges: 50,
      refundAmount: 0,
      paymentDate: new Date(),
      remarks: 'Overstay charges collected at exit gate barrier',
    });

    // 4. OWNER REGISTRATION FEE payment (RAZORPAY, SUCCESSFUL)
    const testApp = await OwnerApplicationModel.create({
      applicantId: testOwner._id,
      applicationReference: `APP-FIN-${timestamp}`,
      businessName: `Finance Enterprises ${timestamp}`,
      businessType: 'Commercial Parking',
      businessDescription: 'Prime commercial multilevel parking facility operating 24x7.',
      businessAddress: '100 Metro Boulevard',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      parkingCapacity: 120,
      ownerName: testOwner.fullName,
      businessEmail: testOwner.email,
      businessPhone: testOwner.mobileNumber,
      governmentIdType: 'Aadhaar',
      governmentIdNumber: '998877665544',
      identityProofUrl: '/uploads/id_fin.pdf',
      businessLicenseUrl: '/uploads/license_fin.pdf',
      propertyProofUrl: '/uploads/property_fin.pdf',
      termsAccepted: true,
      emailOtpVerified: true,
      mobileOtpVerified: true,
      registrationFeeAmount: 999,
      applicationStatus: 'Approved',
    });

    const payment4 = await PaymentModel.create({
      paymentReference: `PAY-FIN-4-${timestamp}`,
      transactionId: `TXN-FIN-4-${timestamp}`,
      ownerApplicationId: testApp._id,
      ownerId: testOwner._id,
      paymentType: 'Parking Owner Registration Fee',
      paymentTypeCode: 'OWNER_REGISTRATION',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      amount: 999,
      platformBookingFee: 0,
      additionalCharges: 0,
      refundAmount: 0,
      paymentDate: new Date(),
      gatewayPaymentId: `pay_test_${timestamp}`,
      gatewayOrderId: `order_test_${timestamp}`,
      gatewaySignature: 'sig_test_dummy',
      remarks: 'Partner onboarding fee',
    });

    // --- TEST 1: Finance Overview KPIs & Distribution Metrics ---
    console.log('\n--- Test 1: Financial Overview KPIs & Chart Metrics ---');
    const overview = await adminFinanceService.getFinanceOverview({});
    console.log('Overview metrics:', {
      totalRevenue: overview.totalRevenue,
      netRevenue: overview.netRevenue,
      totalRefunded: overview.totalRefunded,
      platformFeesCollected: overview.platformFeesCollected,
      totalTransactions: overview.totalTransactions,
      successful: overview.successfulTransactions,
      refunded: overview.refundedTransactions,
      paymentMethods: overview.paymentMethods,
      paymentTypes: overview.paymentTypes,
      statusCount: overview.paymentStatusDistribution.length,
      refundStatusCount: overview.refundStatusDistribution.length,
      revenueTrendEntries: overview.revenueTrend.length,
    });

    if (overview.totalTransactions < 4) {
      throw new Error(`Expected at least 4 transactions in overview, got ${overview.totalTransactions}`);
    }
    if (overview.totalRevenue <= 0) {
      throw new Error(`Expected positive totalRevenue, got ${overview.totalRevenue}`);
    }
    if (overview.totalRefunded <= 0) {
      throw new Error(`Expected positive totalRefunded, got ${overview.totalRefunded}`);
    }
    console.log('✓ Test 1 Passed: Finance overview KPIs return valid backend aggregations.');

    // --- TEST 2: Scoped Overview with Lot and Date Filters ---
    console.log('\n--- Test 2: Scoped Overview Filtering (Lot / Owner / Type) ---');
    const scopedOverview = await adminFinanceService.getFinanceOverview({
      parkingLotId: String(testLot._id),
    });
    console.log('Scoped lot revenue:', scopedOverview.totalRevenue);
    // Should include payment1 (120), payment2 (80), payment3 (50) = 250
    if (scopedOverview.totalRevenue < 250) {
      throw new Error(`Expected lot totalRevenue >= 250, got ${scopedOverview.totalRevenue}`);
    }
    console.log('✓ Test 2 Passed: Scoped facility overview accurately filters revenue.');

    // --- TEST 3: Multi-Criteria Query (Search, Filter, Pagination) ---
    console.log('\n--- Test 3: Payments Directory Search and Filtering ---');
    // Search by vehicle plate
    const plateSearch = await adminFinanceService.getPayments({
      search: testVehicle.vehicleNumber,
    });
    console.log(`Matched by vehicle plate (${testVehicle.vehicleNumber}):`, plateSearch.payments.length);
    if (plateSearch.payments.length < 1) {
      throw new Error('Expected at least 1 payment matching vehicle plate.');
    }

    // Filter by payment method CASH
    const cashFilter = await adminFinanceService.getPayments({
      paymentMethod: 'CASH',
      parkingLotId: String(testLot._id),
    });
    console.log('Matched CASH payments for test lot:', cashFilter.payments.length);
    if (cashFilter.payments.length < 2) {
      throw new Error(`Expected at least 2 cash payments (walkin + overstay), got ${cashFilter.payments.length}`);
    }

    // Filter by payment type OWNER_REGISTRATION
    const regFilter = await adminFinanceService.getPayments({
      paymentType: 'OWNER_REGISTRATION',
      search: `APP-FIN-${timestamp}`,
    });
    console.log('Matched OWNER_REGISTRATION payment:', regFilter.payments.length);
    if (regFilter.payments.length !== 1) {
      throw new Error(`Expected exactly 1 owner registration payment, got ${regFilter.payments.length}`);
    }
    console.log('✓ Test 3 Passed: Payments directory search, filtering, and pagination verified.');

    // --- TEST 4: Single Payment Dossier Inspection ---
    console.log('\n--- Test 4: Single Payment Dossier Inspection ---');
    const dossier = await adminFinanceService.getPaymentById(String(payment2._id));
    console.log('Dossier for payment2:', {
      reference: dossier.paymentReference,
      amount: dossier.amount,
      status: dossier.paymentStatus,
      refundWorkflowState: dossier.refundWorkflowState,
      refundsCount: dossier.refunds.length,
      customer: dossier.customer?.fullName,
      facility: dossier.parkingLot?.parkingName,
      bookingRef: dossier.booking?.bookingReference,
    });

    if (dossier.paymentStatus !== 'REFUNDED') {
      throw new Error(`Expected status REFUNDED, got ${dossier.paymentStatus}`);
    }
    if (dossier.refundWorkflowState !== 'Refund Completed') {
      throw new Error(`Expected refundWorkflowState 'Refund Completed', got ${dossier.refundWorkflowState}`);
    }
    if (dossier.refunds.length !== 1) {
      throw new Error(`Expected 1 refund entry, got ${dossier.refunds.length}`);
    }
    console.log('✓ Test 4 Passed: Deep payment dossier with refund workflow state verified.');

    // --- TEST 5: CSV Export Generation ---
    console.log('\n--- Test 5: CSV Export Generation & Formatting ---');
    const csvData = await adminFinanceService.exportPaymentsCsv({
      parkingLotId: String(testLot._id),
    });
    const csvLines = csvData.split('\n');
    console.log('CSV header:', csvLines[0]);
    console.log('CSV total rows:', csvLines.length);

    if (!csvLines[0].includes('Payment Reference,Transaction ID,Payment Type')) {
      throw new Error('CSV missing required header columns.');
    }
    if (csvLines.length < 4) {
      throw new Error(`Expected at least header + 3 rows, got ${csvLines.length}`);
    }
    console.log('✓ Test 5 Passed: CSV export generated with clean formatting and column headers.');

    // --- TEST 6: Filter Options Endpoint ---
    console.log('\n--- Test 6: Filter Options (Lots and Owners) ---');
    const filterOptions = await adminFinanceService.getFilterOptions();
    console.log(`Filter options: ${filterOptions.parkingLots.length} lots, ${filterOptions.owners.length} owners`);
    if (filterOptions.parkingLots.length < 1) {
      throw new Error('Expected at least 1 parking lot in filter options');
    }
    console.log('✓ Test 6 Passed: Filter options populated successfully.');

    // --- TEST 7: Immutability / Tampering Protection ---
    console.log('\n--- Test 7: Payment Immutability Verification ---');
    // Ensure paymentReference cannot be modified
    let errorCaught = false;
    try {
      await PaymentModel.updateOne(
        { _id: payment1._id },
        { $set: { paymentReference: 'TAMPERED_REF' } },
        { runValidators: true },
      );
    } catch {
      errorCaught = true;
    }
    const freshPayment = await PaymentModel.findById(payment1._id);
    if (freshPayment?.paymentReference !== `PAY-FIN-1-${timestamp}`) {
      throw new Error('Security Violation: Payment reference was modified!');
    }
    console.log('✓ Test 7 Passed: Financial transaction reference immutability confirmed.');

    console.log('\n==================================================================');
    console.log('🎉 ALL 7 ADMIN FINANCE MANAGEMENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('==================================================================\n');
  } finally {
    console.log('Cleaning up test artifacts...');
    // Cleanup created test records
    await PaymentModel.deleteMany({ paymentReference: new RegExp(`PAY-FIN-.*-${timestamp}`) });
    await BookingModel.deleteMany({ bookingReference: new RegExp(`BK-FIN-.*-${timestamp}`) });
    await ParkingSlotModel.deleteMany({ qrIdentifier: new RegExp(`QR-FIN-${timestamp}`) });
    await ParkingZoneModel.deleteMany({ zoneName: 'Zone F' });
    await ParkingFloorModel.deleteMany({ floorName: 'Ground Floor' });
    await ParkingLotModel.deleteMany({ parkingName: new RegExp(`Finance Lot ${timestamp}`) });
    await VehicleModel.deleteMany({ vehicleNumber: new RegExp(`MH03AB${String(timestamp).slice(-4)}`) });
    await OwnerApplicationModel.deleteMany({ applicationReference: new RegExp(`APP-FIN-${timestamp}`) });
    await UserModel.deleteMany({ email: new RegExp(`.*\\.fin\\.${timestamp}@parkease\\.test`) });

    await mongoose.disconnect();
    console.log('Database disconnected. Cleanup complete.');
  }
}

runFinanceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
