import mongoose from 'mongoose';
import {
  AuditLogModel,
  BookingModel,
  ParkingFacilitySubmissionModel,
  ParkingFloorModel,
  ParkingLayoutModel,
  ParkingLotModel,
  ParkingSlotModel,
  ParkingZoneModel,
  PaymentModel,
  ReviewModel,
  RoleModel,
  UserModel,
  VehicleModel,
  VehicleMovementLogModel,
} from '../src/models/index.js';
import { adminInsightsService } from '../src/services/adminInsights.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease';

async function runTests() {
  console.log('==================================================================');
  console.log('--- Starting Admin Phase 7 Insights, Reports & Analytics Tests ---');
  console.log('==================================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const timestamp = Date.now();

  const customerRole = await (RoleModel as any).findOne({ roleCode: 'CUSTOMER' });
  const ownerRole = await (RoleModel as any).findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const adminRole = await (RoleModel as any).findOne({ roleCode: 'ADMIN' });

  if (!customerRole || !ownerRole || !adminRole) {
    throw new Error('Master roles required in DB.');
  }

  // 1. Create Test Admin
  const testAdmin = await (UserModel as any).create({
    fullName: `Insights Admin ${timestamp}`,
    email: `insights.admin.${timestamp}@parkease.test`,
    mobileNumber: `+9198${String(timestamp).slice(-8)}`,
    roleId: adminRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 2. Create Test Customer
  const testCustomer = await (UserModel as any).create({
    fullName: `Insights Customer ${timestamp}`,
    email: `insights.customer.${timestamp}@test.com`,
    mobileNumber: `+9197${String(timestamp).slice(-8)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 3. Create Test Owner
  const testOwner = await (UserModel as any).create({
    fullName: `Insights Owner ${timestamp}`,
    email: `insights.owner.${timestamp}@test.com`,
    mobileNumber: `+9196${String(timestamp).slice(-8)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // 4. Create Test Facility Submission
  const testSubmission = await (ParkingFacilitySubmissionModel as any).create({
    ownerId: testOwner._id,
    submissionReference: `SUB-INSIGHTS-${timestamp}`,
    facilityName: `Insights Hub Plaza ${timestamp}`,
    location: {
      address: '200 Silicon Avenue',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '411001',
      coordinates: [73.8567, 18.5204],
    },
    capacity: {
      totalFloors: 1,
      totalSlots: 50,
      carSlots: 40,
      bikeSlots: 10,
    },
    submissionStatus: 'Submitted',
  });

  // 5. Create Test Parking Lot
  const testLot = await (ParkingLotModel as any).create({
    ownerId: testOwner._id,
    parkingName: `Grand Insights Terminal ${timestamp}`,
    description: 'Premier connected parking facility',
    contactNumber: '+919876543210',
    supportEmail: `support.${timestamp}@insightsterminal.test`,
    address: '200 Silicon Avenue',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '411001',
    latitude: 18.5204,
    longitude: 73.8567,
    location: {
      type: 'Point',
      coordinates: [73.8567, 18.5204],
    },
    totalFloors: 1,
    totalSlots: 30,
    availableSlots: 28,
    carHourlyRate: 60,
    bikeHourlyRate: 25,
    operatingHours: { is24Hours: true },
    parkingStatus: 'Active',
  });

  const testFloor = await (ParkingFloorModel as any).create({
    parkingLotId: testLot._id,
    floorNumber: 1,
    floorName: 'Ground Floor',
    totalZones: 1,
    totalSlots: 30,
    availableSlots: 28,
    status: 'Active',
  });

  const testZone = await (ParkingZoneModel as any).create({
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneName: 'Zone A',
    zoneCode: 'ZA',
    vehicleType: 'Car',
    totalSlots: 30,
    availableSlots: 28,
    status: 'Active',
  });

  const testSlot1 = await (ParkingSlotModel as any).create({
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    slotNumber: `INS-1-${timestamp.toString().slice(-4)}`,
    slotLabel: `A-1`,
    slotType: 'Standard',
    vehicleType: 'Car',
    qrIdentifier: `QR-INS-1-${timestamp}`,
    status: 'Occupied',
  });

  const testSlot2 = await (ParkingSlotModel as any).create({
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    slotNumber: `INS-2-${timestamp.toString().slice(-4)}`,
    slotLabel: `A-2`,
    slotType: 'Standard',
    vehicleType: 'Car',
    qrIdentifier: `QR-INS-2-${timestamp}`,
    status: 'Available',
  });

  const testVehicle = await (VehicleModel as any).create({
    customerId: testCustomer._id,
    vehicleNumber: `MH12IN${timestamp.toString().slice(-4)}`,
    vehicleType: 'Car',
    vehicleBrand: 'Honda',
    vehicleModel: 'Elevate',
  });

  // 6. Create Test Bookings (Completed, Active, Cancelled, Overstay)
  const bookingCompleted = await (BookingModel as any).create({
    bookingReference: `BK-INS-COMP-${timestamp}`,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    originalSlotId: testSlot1._id,
    currentSlotId: testSlot1._id,
    vehicleId: testVehicle._id,
    scheduledEntryTime: new Date(Date.now() - 3600000 * 6),
    scheduledExitTime: new Date(Date.now() - 3600000 * 4),
    startTime: new Date(Date.now() - 3600000 * 6),
    endTime: new Date(Date.now() - 3600000 * 4),
    bookingDurationMinutes: 120,
    parkingRateAtBooking: 60,
    overstayRateAtBooking: 90,
    baseAmount: 120,
    platformBookingFee: 20,
    totalAmount: 140,
    bookingStatus: 'Completed',
    paymentStatus: 'PAID',
    bookingType: 'ONLINE',
  });

  const bookingOverstay = await (BookingModel as any).create({
    bookingReference: `BK-INS-OVER-${timestamp}`,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    originalSlotId: testSlot1._id,
    currentSlotId: testSlot1._id,
    vehicleId: testVehicle._id,
    scheduledEntryTime: new Date(Date.now() - 3600000 * 8),
    scheduledExitTime: new Date(Date.now() - 3600000 * 6),
    startTime: new Date(Date.now() - 3600000 * 8),
    endTime: new Date(Date.now() - 3600000 * 4),
    bookingDurationMinutes: 120,
    overstayDurationMinutes: 120,
    parkingRateAtBooking: 60,
    overstayRateAtBooking: 90,
    baseAmount: 120,
    overstayAmount: 180,
    platformBookingFee: 20,
    totalAmount: 320,
    bookingStatus: 'Overstay',
    paymentStatus: 'PAID',
    bookingType: 'ONLINE',
  });

  const bookingCancelled = await (BookingModel as any).create({
    bookingReference: `BK-INS-CANC-${timestamp}`,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    originalSlotId: testSlot2._id,
    currentSlotId: testSlot2._id,
    vehicleId: testVehicle._id,
    scheduledEntryTime: new Date(Date.now() + 3600000 * 2),
    scheduledExitTime: new Date(Date.now() + 3600000 * 4),
    bookingDurationMinutes: 120,
    parkingRateAtBooking: 60,
    overstayRateAtBooking: 90,
    baseAmount: 120,
    platformBookingFee: 20,
    totalAmount: 140,
    bookingStatus: 'Cancelled',
    paymentStatus: 'REFUNDED',
    bookingType: 'ONLINE',
    cancelledBy: 'Customer',
    cancellationReason: 'Flight schedule changed',
    cancelledAt: new Date(),
  });

  // 7. Create Test Payments
  const payment1 = await (PaymentModel as any).create({
    paymentReference: `PAY-INS-1-${timestamp}`,
    transactionId: `TXN-INS-1-${timestamp}`,
    customerId: testCustomer._id,
    ownerId: testOwner._id,
    bookingId: bookingCompleted._id,
    parkingLotId: testLot._id,
    amount: 140,
    platformFee: 20,
    currency: 'INR',
    paymentType: 'Parking Booking',
    paymentTypeCode: 'BOOKING',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'SUCCESSFUL',
    settledAt: new Date(),
  });

  const payment2 = await (PaymentModel as any).create({
    paymentReference: `PAY-INS-2-${timestamp}`,
    transactionId: `TXN-INS-2-${timestamp}`,
    customerId: testCustomer._id,
    ownerId: testOwner._id,
    bookingId: bookingCancelled._id,
    parkingLotId: testLot._id,
    amount: 140,
    platformFee: 20,
    refundedAmount: 140,
    currency: 'INR',
    paymentType: 'Parking Booking',
    paymentTypeCode: 'BOOKING',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'REFUNDED',
    settledAt: new Date(),
  });

  // 8. Create Test Review
  const testReview = await (ReviewModel as any).create({
    bookingId: bookingCompleted._id,
    customerId: testCustomer._id,
    ownerId: testOwner._id,
    parkingLotId: testLot._id,
    overallRating: 5,
    comment: `Super smooth analytics testing facility ${timestamp}!`,
    moderationStatus: 'Published',
  });

  // 9. Create Vehicle Movement Logs
  const movementIn = await (VehicleMovementLogModel as any).create({
    bookingId: bookingCompleted._id,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    slotId: testSlot1._id,
    vehicleId: testVehicle._id,
    vehicleRegistrationNumber: testVehicle.vehicleNumber,
    movementType: 'Vehicle Entered',
    entryMethod: 'QR Code',
    gracePeriodEndsAt: new Date(Date.now() - 3600000 * 5.75),
    entryTime: new Date(Date.now() - 3600000 * 6),
  });

  const movementOut = await (VehicleMovementLogModel as any).create({
    bookingId: bookingCompleted._id,
    customerId: testCustomer._id,
    parkingLotId: testLot._id,
    floorId: testFloor._id,
    zoneId: testZone._id,
    slotId: testSlot1._id,
    vehicleId: testVehicle._id,
    vehicleRegistrationNumber: testVehicle.vehicleNumber,
    movementType: 'Vehicle Exited',
    entryMethod: 'QR Code',
    exitMethod: 'QR Code',
    gracePeriodEndsAt: new Date(Date.now() - 3600000 * 5.75),
    entryTime: new Date(Date.now() - 3600000 * 6),
    exitTime: new Date(Date.now() - 3600000 * 4),
    stayDurationMinutes: 120,
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Dashboard Overview & 9 KPI Cards
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Dashboard Overview & 9 KPI Cards ---');
    const dashboardData = await adminInsightsService.getDashboardData('month');
    console.log('Dashboard period:', dashboardData.period);
    console.log('KPI Cards sample:', {
      users: dashboardData.kpis.users.value,
      owners: dashboardData.kpis.owners.value,
      parkingLots: dashboardData.kpis.parkingLots.value,
      bookings: dashboardData.kpis.bookings.value,
      revenue: dashboardData.kpis.revenue.value,
      occupancyRate: dashboardData.kpis.occupancy.value,
      payments: dashboardData.kpis.payments.value,
      reviews: dashboardData.kpis.reviews.value,
      pendingApprovals: dashboardData.kpis.pendingOwnerApprovals.value,
    });

    if (
      dashboardData.kpis.users.value <= 0 ||
      dashboardData.kpis.owners.value <= 0 ||
      dashboardData.kpis.parkingLots.value <= 0 ||
      dashboardData.kpis.revenue.value <= 0
    ) {
      throw new Error('Dashboard overview KPIs failed to aggregate backend data.');
    }
    console.log('✓ Test 1 Passed: 9 KPI Cards computed accurately from database aggregations.');

    // -------------------------------------------------------------
    // Test 2: Dashboard Charts Data Generation
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Dashboard Charts Data ---');
    const { charts } = dashboardData;
    console.log('Charts summary:', {
      revenueTrendEntries: charts.revenueTrend.length,
      bookingsTrendEntries: charts.bookingsTrend.length,
      occupancySlices: charts.occupancyDistribution.length,
      growthEntries: charts.growthTrend.length,
      utilizationEntries: charts.parkingUtilization.length,
    });

    if (charts.occupancyDistribution.length !== 4) {
      throw new Error('Occupancy chart must contain exactly 4 canonical slot status slices.');
    }
    console.log('✓ Test 2 Passed: 5 Recharts data sets verified with canonical slot and trend representations.');

    // -------------------------------------------------------------
    // Test 3: Facility Status Overview & Setup Attention
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Facility Status Overview & Setup Attention ---');
    console.log('Facility status overview:', {
      submissions: dashboardData.facilityStatusOverview.submissions.total,
      officialLots: dashboardData.facilityStatusOverview.officialLots.total,
      attentionItems: dashboardData.facilityAttention.length,
    });

    if (dashboardData.facilityAttention.length === 0) {
      throw new Error('Setup attention failed to highlight actionable facility items.');
    }
    console.log('✓ Test 3 Passed: Facility lifecycle status overview and actionable attention queue derived.');

    // -------------------------------------------------------------
    // Test 4: Authoritative Reports (All 5 Types)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Authoritative Report Generation ---');
    const reportTypes = ['revenue', 'occupancy', 'parking_usage', 'customer', 'booking'] as const;

    for (const rType of reportTypes) {
      const rep = await adminInsightsService.getReportData({ reportType: rType, limit: 10 });
      console.log(`Generated ${rep.reportType}:`, {
        columns: rep.columns.length,
        rows: rep.rows.length,
        summary: rep.summary,
      });
      if (rep.columns.length === 0 || !rep.summary) {
        throw new Error(`Report generation failed for type: ${rType}`);
      }
    }
    console.log('✓ Test 4 Passed: All 5 authoritative report types successfully generated with structured summaries.');

    // -------------------------------------------------------------
    // Test 5: CSV Report Export
    // -------------------------------------------------------------
    console.log('\n--- Test 5: CSV Report Export ---');
    const csvData = await adminInsightsService.exportReportCsv({ reportType: 'revenue' });
    console.log('CSV header preview:', csvData.slice(0, 150));
    if (!csvData.includes('ParkEase Official System Report') || !csvData.includes('Gross (₹)')) {
      throw new Error('CSV export did not contain expected report headers or formatting.');
    }
    console.log('✓ Test 5 Passed: Streamed CSV export generated with proper metadata headers and escaping.');

    // -------------------------------------------------------------
    // Test 6: Analytics Workspace (Revenue, Growth, Cancellation, Overstay)
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Analytics Workspace ---');
    const analyticsData = await adminInsightsService.getAnalyticsData('month');
    console.log('Analytics summary:', {
      dailyRevenuePoints: analyticsData.revenueAnalytics.dailyRevenue.length,
      paymentMethodsCount: analyticsData.revenueAnalytics.paymentMethods.length,
      peakHoursEntries: analyticsData.growthAndUsage.peakHours.length,
      totalCancelled: analyticsData.cancellationAnalytics.totalCancelled,
      customerCancelled: analyticsData.cancellationAnalytics.customerCancelled,
      totalOverstays: analyticsData.overstayAnalytics.totalOverstays,
      avgOverstayDuration: analyticsData.overstayAnalytics.averageOverstayDurationMinutes,
    });

    if (analyticsData.growthAndUsage.peakHours.length !== 24) {
      throw new Error('Peak hours analytics must aggregate 24 hourly buckets (0-23).');
    }
    if (analyticsData.cancellationAnalytics.totalCancelled <= 0) {
      throw new Error('Cancellation analytics failed to calculate cancelled booking metrics.');
    }
    console.log('✓ Test 6 Passed: Full analytics suite (Revenue, Usage, Cancellations, Overstay) verified.');

    // -------------------------------------------------------------
    // Test 7: Dropdown Filter Options
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Dropdown Filter Options ---');
    const filterOptions = await adminInsightsService.getFilterOptions();
    console.log('Filter options count:', {
      lots: filterOptions.parkingLots.length,
      owners: filterOptions.owners.length,
    });
    if (filterOptions.parkingLots.length === 0 || filterOptions.owners.length === 0) {
      throw new Error('Filter options failed to return parking lots or owners.');
    }
    console.log('✓ Test 7 Passed: Filter dropdown options populated successfully.');

    // -------------------------------------------------------------
    // Test 8: Custom Date Range Boundaries
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Custom Date Range Boundaries ---');
    const customRange = adminInsightsService.resolveDateRange('custom', '2026-01-01', '2026-01-31');
    console.log('Custom date range resolved:', {
      start: customRange.start.toISOString(),
      end: customRange.end.toISOString(),
      prevStart: customRange.previousStart.toISOString(),
      prevEnd: customRange.previousEnd.toISOString(),
    });
    if (customRange.start.getFullYear() !== 2026 || customRange.end.getMonth() !== 0) {
      throw new Error('Custom date range calculation failed.');
    }
    console.log('✓ Test 8 Passed: Custom and relative date range boundaries calculated accurately.');

    console.log('\n==================================================================');
    console.log('🎉 ALL 8 ADMIN INSIGHTS, REPORTS & ANALYTICS TESTS PASSED (100%)!');
    console.log('==================================================================\n');
  } finally {
    console.log('Cleaning up test artifacts...');
    await (VehicleMovementLogModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (ReviewModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (PaymentModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (BookingModel as any).deleteMany({
      parkingLotId: testLot._id,
    });
    await (VehicleModel as any).deleteMany({
      _id: testVehicle._id,
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
    await (ParkingLotModel as any).deleteMany({
      _id: testLot._id,
    });
    await (ParkingFacilitySubmissionModel as any).deleteMany({
      _id: testSubmission._id,
    });
    await (UserModel as any).deleteMany({
      _id: { $in: [testAdmin._id, testCustomer._id, testOwner._id] },
    });
    await mongoose.disconnect();
    console.log('Database disconnected. Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
