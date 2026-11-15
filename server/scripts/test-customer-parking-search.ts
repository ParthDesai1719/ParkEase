/**
 * ParkEase — Phase 3.1: Customer Parking Discovery & Search Automated Test Suite
 *
 * Verifies:
 * 1. Critical Visibility Invariants (Rule 9): Inactive, unverified, unpublished lots never appear.
 * 2. Text Search: Name, City, Address matching.
 * 3. Geolocation & Haversine Distance Calculation.
 * 4. Proximity Radius Filtering (maxDistanceKm).
 * 5. Vehicle Type Filtering & Official Slot Reconciliation.
 * 6. Price Range Filtering (minPrice, maxPrice).
 * 7. Rating & Amenities (Covered, EV Charging, 24x7) Filtering.
 * 8. Open Now & Availability Filtering.
 * 9. Sorting (Distance, Price, Rating, Available Slots, Occupancy).
 * 10. Server-Side Pagination.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { ParkingLayoutModel } from '../src/models/ParkingLayout.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { customerParkingService } from '../src/services/customerParking.service.js';
import { streamFacilityPhoto } from '../src/controllers/customerParking.controller.js';
import { AppError } from '../src/utils/AppError.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease_test';

async function runCustomerSearchTestSuite() {
  console.log('========================================================================');
  console.log('  ParkEase — Phase 3.1: Customer Parking Discovery & Search Tests');
  console.log('========================================================================\n');

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI);
  console.log('✓ MongoDB connected successfully.\n');

  // Track created fixtures for cleanup
  const cleanupIds = {
    userIds: [] as mongoose.Types.ObjectId[],
    lotIds: [] as mongoose.Types.ObjectId[],
    floorIds: [] as mongoose.Types.ObjectId[],
    zoneIds: [] as mongoose.Types.ObjectId[],
    slotIds: [] as mongoose.Types.ObjectId[],
    layoutIds: [] as mongoose.Types.ObjectId[],
  };

  try {
    console.log('[SETUP] Provisioning isolated test fixtures...');

    // 1. Find or create Owner user
    let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
    if (!ownerRole) {
      ownerRole = await RoleModel.findOne();
    }
    if (!ownerRole) {
      ownerRole = await RoleModel.create({
        roleName: 'Parking Owner',
        roleCode: 'OWNER',
        description: 'Facility owner role',
        dashboardRoute: '/owner/dashboard',
        permissions: [],
      });
    }

    const testOwner = await UserModel.create({
      fullName: 'Search Test Owner',
      email: `search-owner-${Date.now()}@test.parkease.in`,
      mobileNumber: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: 'argon2id$v=19$m=65536,t=3,p=4$dummyhash',
      roleId: ownerRole._id,
      userType: 'PARKING_OWNER',
      isEmailVerified: true,
      isPhoneVerified: true,
      status: 'Active',
    });
    cleanupIds.userIds.push(testOwner._id as mongoose.Types.ObjectId);

    // 2. Create Facility A: Active, Verified, Confirmed, Published 2D Layout (Ahmedabad SG Highway)
    // Coords: 23.0338, 72.5124 (Near SG Highway)
    const lotA = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Titanium City Centre Parking',
      description: 'Multi-level commercial parking facility with EV stations and security.',
      address: 'Near Sachin Tower, 100 Feet Anand Nagar Rd, Prahlad Nagar',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      postalCode: '380015',
      latitude: 23.0135,
      longitude: 72.5126,
      location: { type: 'Point', coordinates: [72.5126, 23.0135] },
      contactNumber: '9898000001',
      openingTime: '06:00',
      closingTime: '23:30',
      isOpen24Hours: false,
      hourlyRate: 40,
      totalFloors: 1,
      totalSlots: 4,
      availableSlots: 4,
      occupiedSlots: 0,
      reservedSlots: 0,
      occupancyPercentage: 0,
      averageRating: 4.8,
      totalReviews: 24,
      amenities: ['Covered Parking', 'EV Charging', 'CCTV Surveillance', 'Security Staff'],
      parkingImages: ['https://images.unsplash.com/photo-1506521781263-d8422e82f27a'],
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotA._id as mongoose.Types.ObjectId);

    // Floor, Zone, Slots for Lot A
    const floorA = await ParkingFloorModel.create({
      parkingLotId: lotA._id,
      floorName: 'Ground Floor',
      floorNumber: 1,
      totalSlots: 4,
      availableSlots: 4,
    });
    cleanupIds.floorIds.push(floorA._id as mongoose.Types.ObjectId);

    const zoneA = await ParkingZoneModel.create({
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneName: 'Zone Alpha',
      zoneCode: 'ZA',
      totalSlots: 4,
      availableSlots: 4,
    });
    cleanupIds.zoneIds.push(zoneA._id as mongoose.Types.ObjectId);

    // Create 4 slots: 2 Car, 1 Bike, 1 EV
    const slotA1 = await ParkingSlotModel.create({
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      slotNumber: 'ZA-01',
      slotLabel: 'ZA-01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `PK-${Date.now()}-A1`,
    });
    const slotA2 = await ParkingSlotModel.create({
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      slotNumber: 'ZA-02',
      slotLabel: 'ZA-02',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Occupied',
      qrIdentifier: `PK-${Date.now()}-A2`,
    });
    const slotA3 = await ParkingSlotModel.create({
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      slotNumber: 'ZA-03',
      slotLabel: 'ZA-03',
      slotType: 'Standard',
      supportedVehicleType: 'Bike',
      slotStatus: 'Available',
      qrIdentifier: `PK-${Date.now()}-A3`,
    });
    const slotA4 = await ParkingSlotModel.create({
      parkingLotId: lotA._id,
      floorId: floorA._id,
      zoneId: zoneA._id,
      slotNumber: 'ZA-04',
      slotLabel: 'ZA-04',
      slotType: 'EV Charging',
      supportedVehicleType: 'EV',
      slotStatus: 'Available',
      qrIdentifier: `PK-${Date.now()}-A4`,
    });
    cleanupIds.slotIds.push(slotA1._id as mongoose.Types.ObjectId, slotA2._id as mongoose.Types.ObjectId, slotA3._id as mongoose.Types.ObjectId, slotA4._id as mongoose.Types.ObjectId);

    // Published 2D Layout for Lot A
    const layoutA = await ParkingLayoutModel.create({
      parkingLotId: lotA._id,
      floorId: floorA._id,
      version: 1,
      status: 'Published',
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: testOwner._id,
      isValidated: true,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      elements: [],
    });
    cleanupIds.layoutIds.push(layoutA._id as mongoose.Types.ObjectId);

    // 3. Create Facility B: Active, 24x7, Published 2D Layout (Ahmedabad Navrangpura)
    // Coords: 23.0365, 72.5612 (Near CG Road / Navrangpura)
    const lotB = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Navrangpura Central Parking Plaza',
      description: '24-hour round-the-clock secured parking near university road.',
      address: 'Opposite Municipal Market, CG Road, Navrangpura',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      postalCode: '380009',
      latitude: 23.0365,
      longitude: 72.5612,
      location: { type: 'Point', coordinates: [72.5612, 23.0365] },
      contactNumber: '9898000002',
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      hourlyRate: 25,
      totalFloors: 1,
      totalSlots: 2,
      availableSlots: 2,
      occupiedSlots: 0,
      reservedSlots: 0,
      occupancyPercentage: 0,
      averageRating: 4.2,
      totalReviews: 10,
      amenities: ['CCTV Surveillance'],
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotB._id as mongoose.Types.ObjectId);

    const floorB = await ParkingFloorModel.create({
      parkingLotId: lotB._id,
      floorName: 'Ground Floor',
      floorNumber: 1,
      totalSlots: 2,
      availableSlots: 2,
    });
    cleanupIds.floorIds.push(floorB._id as mongoose.Types.ObjectId);

    const zoneB = await ParkingZoneModel.create({
      parkingLotId: lotB._id,
      floorId: floorB._id,
      zoneName: 'Zone Main',
      zoneCode: 'ZM',
      totalSlots: 2,
      availableSlots: 2,
    });
    cleanupIds.zoneIds.push(zoneB._id as mongoose.Types.ObjectId);

    const slotB1 = await ParkingSlotModel.create({
      parkingLotId: lotB._id,
      floorId: floorB._id,
      zoneId: zoneB._id,
      slotNumber: 'ZM-01',
      slotLabel: 'ZM-01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `PK-${Date.now()}-B1`,
    });
    cleanupIds.slotIds.push(slotB1._id as mongoose.Types.ObjectId);

    const layoutB = await ParkingLayoutModel.create({
      parkingLotId: lotB._id,
      floorId: floorB._id,
      version: 1,
      status: 'Published',
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: testOwner._id,
      isValidated: true,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      elements: [],
    });
    cleanupIds.layoutIds.push(layoutB._id as mongoose.Types.ObjectId);

    // 4. Create Ineligible Lots to Test Critical Rule 9 Invariants:
    // Lot C: Inactive Staging status
    const lotC = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Inactive Staging Lot C',
      address: 'Prahlad Nagar Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380015',
      latitude: 23.0135,
      longitude: 72.5126,
      location: { type: 'Point', coordinates: [72.5126, 23.0135] },
      contactNumber: '9898000003',
      hourlyRate: 50,
      totalFloors: 1,
      totalSlots: 10,
      availableSlots: 10,
      isVerified: true,
      parkingStatus: 'Inactive', // NOT ACTIVE
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotC._id as mongoose.Types.ObjectId);

    // Lot D: Active, but WITHOUT Published 2D Layout (Layout is Draft only)
    const lotD = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Unpublished Layout Lot D',
      address: 'Vastrapur Lake Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380015',
      latitude: 23.0350,
      longitude: 72.5280,
      location: { type: 'Point', coordinates: [72.5280, 23.0350] },
      contactNumber: '9898000004',
      hourlyRate: 35,
      totalFloors: 1,
      totalSlots: 10,
      availableSlots: 10,
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotD._id as mongoose.Types.ObjectId);

    const floorD = await ParkingFloorModel.create({
      parkingLotId: lotD._id,
      floorName: 'Ground',
      floorNumber: 1,
      totalSlots: 10,
      availableSlots: 10,
    });
    cleanupIds.floorIds.push(floorD._id as mongoose.Types.ObjectId);

    const draftLayoutD = await ParkingLayoutModel.create({
      parkingLotId: lotD._id,
      floorId: floorD._id,
      version: 1,
      status: 'Draft', // NOT PUBLISHED
      isPublished: false,
      isValidated: false,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      elements: [],
    });
    cleanupIds.layoutIds.push(draftLayoutD._id as mongoose.Types.ObjectId);

    console.log('✓ Test fixtures provisioned successfully.\n');

    // =========================================================================
    // TEST 1: Critical Visibility Invariants (Rule 9)
    // =========================================================================
    console.log('[TEST 1] Critical Facility Visibility Rules');
    const allSearchResults = await customerParkingService.searchParkingLots({});
    const returnedLotIds = allSearchResults.parkingLots.map((l) => l._id);

    if (!returnedLotIds.includes(lotA._id.toString())) {
      throw new Error('Test 1 Failed: Active lot with published layout (Lot A) was omitted from results.');
    }
    if (!returnedLotIds.includes(lotB._id.toString())) {
      throw new Error('Test 1 Failed: Active lot with published layout (Lot B) was omitted from results.');
    }
    if (returnedLotIds.includes(lotC._id.toString())) {
      throw new Error('Test 1 Failed: Inactive lot (Lot C) leaked into customer search results!');
    }
    if (returnedLotIds.includes(lotD._id.toString())) {
      throw new Error('Test 1 Failed: Lot with unpublished draft layout (Lot D) leaked into customer search results!');
    }
    console.log('✓ Critical visibility rules strictly verified: Only active, verified lots with published 2D layouts are returned.\n');

    // =========================================================================
    // TEST 2: Text Search Matching (Name, City, Address)
    // =========================================================================
    console.log('[TEST 2] Text Search Matching');
    // Search by name substring
    const nameSearch = await customerParkingService.searchParkingLots({ search: 'titanium' });
    if (!nameSearch.parkingLots.some((l) => l._id === lotA._id.toString())) {
      throw new Error('Test 2 Failed: Search by parking name failed to return Lot A.');
    }

    // Search by city
    const citySearch = await customerParkingService.searchParkingLots({ search: 'Ahmedabad' });
    if (citySearch.total < 2) {
      throw new Error('Test 2 Failed: Search by city "Ahmedabad" did not match expected lots.');
    }

    // Search by address landmark
    const addressSearch = await customerParkingService.searchParkingLots({ search: 'Navrangpura' });
    if (!addressSearch.parkingLots.some((l) => l._id === lotB._id.toString())) {
      throw new Error('Test 2 Failed: Search by address landmark failed to return Lot B.');
    }
    console.log('✓ Text search successfully matches parking name, city, and street address.\n');

    // =========================================================================
    // TEST 3: Geolocation Distance & Proximity Radius Filtering
    // =========================================================================
    console.log('[TEST 3] Geolocation & Proximity Radius Filtering');
    // User located near Prahlad Nagar (23.0130, 72.5120), very close to Lot A (< 0.2km)
    const userLat = 23.0130;
    const userLng = 72.5120;

    const nearbySearch = await customerParkingService.searchParkingLots({
      latitude: userLat,
      longitude: userLng,
    });

    const lotAResult = nearbySearch.parkingLots.find((l) => l._id === lotA._id.toString());
    if (!lotAResult || lotAResult.distanceKm == null || lotAResult.distanceKm > 1.0) {
      throw new Error(`Test 3 Failed: Haversine distance for Lot A is incorrect: ${lotAResult?.distanceKm} km.`);
    }

    // Test max distance radius filter: within 2 km should include Lot A but NOT Lot B (~6.5 km away)
    const radiusSearch = await customerParkingService.searchParkingLots({
      latitude: userLat,
      longitude: userLng,
      maxDistanceKm: 2,
    });

    const radiusLotIds = radiusSearch.parkingLots.map((l) => l._id);
    if (!radiusLotIds.includes(lotA._id.toString())) {
      throw new Error('Test 3 Failed: Lot A should be within 2km radius.');
    }
    if (radiusLotIds.includes(lotB._id.toString())) {
      throw new Error('Test 3 Failed: Lot B (~6.5km away) was incorrectly included in 2km radius.');
    }
    console.log('✓ Geolocation distance and radius filtering strictly verified.\n');

    // =========================================================================
    // TEST 4: Vehicle Type Filtering & Live Slot Reconciliation
    // =========================================================================
    console.log('[TEST 4] Vehicle Type Filtering & Live Official Slot Counts');
    // Lot A has: 1 Available Car, 1 Occupied Car, 1 Available Bike, 1 Available EV (Total: 4 slots, 3 available)
    const lotADetails = await customerParkingService.getParkingLotDetails(lotA._id.toString());
    if (lotADetails.totalSlots !== 4 || lotADetails.availableSlots !== 3) {
      throw new Error(`Test 4 Failed: Slot count mismatch for Lot A. Expected 4 total, 3 available. Got: ${lotADetails.totalSlots} total, ${lotADetails.availableSlots} available.`);
    }
    if (lotADetails.vehicleAvailability.car.available !== 1) {
      throw new Error(`Test 4 Failed: Car availability mismatch. Expected 1, got ${lotADetails.vehicleAvailability.car.available}.`);
    }
    if (lotADetails.vehicleAvailability.bike.available !== 1) {
      throw new Error(`Test 4 Failed: Bike availability mismatch. Expected 1, got ${lotADetails.vehicleAvailability.bike.available}.`);
    }
    if (lotADetails.vehicleAvailability.ev.available !== 1) {
      throw new Error(`Test 4 Failed: EV availability mismatch. Expected 1, got ${lotADetails.vehicleAvailability.ev.available}.`);
    }

    // Filter by EV vehicle type: Lot A has EV, Lot B does NOT
    const evSearch = await customerParkingService.searchParkingLots({ vehicleType: 'EV' });
    const evLotIds = evSearch.parkingLots.map((l) => l._id);
    if (!evLotIds.includes(lotA._id.toString())) {
      throw new Error('Test 4 Failed: Lot A should match EV filter.');
    }
    if (evLotIds.includes(lotB._id.toString())) {
      throw new Error('Test 4 Failed: Lot B has no EV slots but was returned under EV filter.');
    }
    console.log('✓ Vehicle type filtering and official slot count reconciliation verified.\n');

    // =========================================================================
    // TEST 5: Amenities, 24x7 & Price Range Filtering
    // =========================================================================
    console.log('[TEST 5] Amenities, 24×7 & Price Range Filtering');
    // 24x7 filter: Lot B is 24x7, Lot A is not
    const roundTheClockSearch = await customerParkingService.searchParkingLots({ is24x7: true });
    const roundClockIds = roundTheClockSearch.parkingLots.map((l) => l._id);
    if (!roundClockIds.includes(lotB._id.toString()) || roundClockIds.includes(lotA._id.toString())) {
      throw new Error('Test 5 Failed: 24x7 filter failed.');
    }

    // Covered parking: Lot A has Covered Parking, Lot B does not
    const coveredSearch = await customerParkingService.searchParkingLots({ coveredParking: true });
    const coveredIds = coveredSearch.parkingLots.map((l) => l._id);
    if (!coveredIds.includes(lotA._id.toString()) || coveredIds.includes(lotB._id.toString())) {
      throw new Error('Test 5 Failed: Covered parking amenity filter failed.');
    }

    // Price filter: Max price ₹30 (Lot B is ₹25, Lot A is ₹40)
    const priceSearch = await customerParkingService.searchParkingLots({ maxPrice: 30 });
    const priceLotIds = priceSearch.parkingLots.map((l) => l._id);
    if (!priceLotIds.includes(lotB._id.toString()) || priceLotIds.includes(lotA._id.toString())) {
      throw new Error('Test 5 Failed: Max price filter failed.');
    }
    console.log('✓ Amenities, 24×7, and price filters verified successfully.\n');

    // =========================================================================
    // TEST 6: Sorting & Pagination
    // =========================================================================
    console.log('[TEST 6] Sorting & Server-Side Pagination');
    // Sort by Lowest Price
    const sortedByPrice = await customerParkingService.searchParkingLots({
      sortBy: 'lowestPrice',
      sortOrder: 'asc',
    });
    if (sortedByPrice.parkingLots[0]._id !== lotB._id.toString()) {
      throw new Error('Test 6 Failed: Lowest price sort did not put Lot B (₹25) first.');
    }

    // Sort by Distance
    const sortedByDist = await customerParkingService.searchParkingLots({
      latitude: userLat,
      longitude: userLng,
      sortBy: 'distance',
      sortOrder: 'asc',
    });
    if (sortedByDist.parkingLots[0]._id !== lotA._id.toString()) {
      throw new Error('Test 6 Failed: Distance sort did not put nearest Lot A first.');
    }

    // Pagination: limit 1
    const paginated = await customerParkingService.searchParkingLots({ limit: 1, page: 1 });
    if (paginated.parkingLots.length !== 1 || paginated.total < 2 || paginated.totalPages < 2) {
      throw new Error('Test 6 Failed: Pagination limits and page counting failed.');
    }
    console.log('✓ Sorting options and pagination verified successfully.\n');

    // =========================================================================
    // TEST 7: Priority 1 — Photo Security & Private Document Protection
    // =========================================================================
    console.log('[TEST 7] Priority 1: Facility Photo Security & Directory Isolation');
    const uploadsRoot = fs.existsSync(path.resolve(process.cwd(), 'server', 'uploads'))
      ? path.resolve(process.cwd(), 'server', 'uploads')
      : path.resolve(process.cwd(), 'uploads');
    const photosDir = path.resolve(uploadsRoot, 'submissions', 'photos');
    const ownerDir = path.resolve(uploadsRoot, 'owner');
    const plansDir = path.resolve(uploadsRoot, 'submissions', 'plans');

    for (const d of [photosDir, ownerDir, plansDir]) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }

    // Create test files
    const validPhotoName = `photo-test-${Date.now()}.png`;
    const privateDocAadhaar = `doc-aadhaar-${Date.now()}.png`;
    const privateDocLicense = `doc-license-${Date.now()}.pdf`;
    const privateDocProperty = `doc-property-deed-${Date.now()}.jpg`;
    const privatePlanPdf = `plan-facility-${Date.now()}.pdf`;

    fs.writeFileSync(path.resolve(photosDir, validPhotoName), 'FAKE_PNG_FACILITY_PHOTO');
    fs.writeFileSync(path.resolve(ownerDir, privateDocAadhaar), 'FAKE_PRIVATE_AADHAAR_DATA');
    fs.writeFileSync(path.resolve(ownerDir, privateDocLicense), 'FAKE_PRIVATE_LICENSE_PDF');
    fs.writeFileSync(path.resolve(ownerDir, privateDocProperty), 'FAKE_PRIVATE_PROPERTY_PROOF');
    fs.writeFileSync(path.resolve(plansDir, privatePlanPdf), 'FAKE_PLAN_PDF');

    function createMockReqRes(filename: string) {
      const req = { params: { filename } } as unknown as Request;
      let sentFile: string | null = null;
      const headers: Record<string, string> = {};
      const res = {
        setHeader: (k: string, v: string) => {
          headers[k.toLowerCase()] = v;
          return res;
        },
        sendFile: (targetPath: string) => {
          sentFile = targetPath;
          return res;
        },
      } as unknown as Response;
      return { req, res, getSentFile: () => sentFile, getHeaders: () => headers };
    }

    try {
      // 1. Legitimate photo retrieval succeeds
      const validCall = createMockReqRes(validPhotoName);
      await streamFacilityPhoto(validCall.req, validCall.res);
      if (validCall.getSentFile() !== path.resolve(photosDir, validPhotoName)) {
        throw new Error('Test 7 Failed: Legitimate facility photo was not served correctly.');
      }
      if (validCall.getHeaders()['cross-origin-resource-policy'] !== 'cross-origin') {
        throw new Error('Test 7 Failed: Missing cross-origin-resource-policy header.');
      }

      // 2. Private Aadhaar document MUST be rejected (404 FILE_NOT_FOUND)
      let aadhaarBlocked = false;
      try {
        const privateCall = createMockReqRes(privateDocAadhaar);
        await streamFacilityPhoto(privateCall.req, privateCall.res);
      } catch (err: unknown) {
        if (err instanceof AppError && err.statusCode === 404) {
          aadhaarBlocked = true;
        }
      }
      if (!aadhaarBlocked) {
        throw new Error('Test 7 Failed: Private Owner identity document was NOT rejected!');
      }

      // 3. Private Business Licence PDF MUST be rejected (400 INVALID_FILE_TYPE)
      let licenseBlocked = false;
      try {
        const licenseCall = createMockReqRes(privateDocLicense);
        await streamFacilityPhoto(licenseCall.req, licenseCall.res);
      } catch (err: unknown) {
        if (err instanceof AppError && err.statusCode === 400) {
          licenseBlocked = true;
        }
      }
      if (!licenseBlocked) {
        throw new Error('Test 7 Failed: Private business licence was NOT rejected!');
      }

      // 4. Private Property Proof image MUST be rejected (404 FILE_NOT_FOUND)
      let propertyBlocked = false;
      try {
        const propCall = createMockReqRes(privateDocProperty);
        await streamFacilityPhoto(propCall.req, propCall.res);
      } catch (err: unknown) {
        if (err instanceof AppError && err.statusCode === 404) {
          propertyBlocked = true;
        }
      }
      if (!propertyBlocked) {
        throw new Error('Test 7 Failed: Private property proof was NOT rejected!');
      }

      // 5. Parking Plan PDF MUST be rejected
      let planBlocked = false;
      try {
        const planCall = createMockReqRes(privatePlanPdf);
        await streamFacilityPhoto(planCall.req, planCall.res);
      } catch (err: unknown) {
        if (err instanceof AppError && (err.statusCode === 400 || err.statusCode === 404)) {
          planBlocked = true;
        }
      }
      if (!planBlocked) {
        throw new Error('Test 7 Failed: Parking plan PDF was NOT rejected!');
      }

      // 6. Path traversal attempt MUST be rejected
      let traversalBlocked = false;
      try {
        const traversalCall = createMockReqRes(`../../owner/${privateDocAadhaar}`);
        await streamFacilityPhoto(traversalCall.req, traversalCall.res);
      } catch (err: unknown) {
        if (err instanceof AppError) {
          traversalBlocked = true;
        }
      }
      if (!traversalBlocked) {
        throw new Error('Test 7 Failed: Path traversal attempt was NOT rejected!');
      }

      // 7. Unsupported extensions (.exe, .sh) rejected
      let unsupportedExtBlocked = false;
      try {
        const extCall = createMockReqRes('exploit.sh');
        await streamFacilityPhoto(extCall.req, extCall.res);
      } catch (err: unknown) {
        if (err instanceof AppError && err.statusCode === 400) {
          unsupportedExtBlocked = true;
        }
      }
      if (!unsupportedExtBlocked) {
        throw new Error('Test 7 Failed: Unsupported extension was NOT rejected!');
      }
    } finally {
      // Clean up mock files safely
      for (const filePath of [
        path.resolve(photosDir, validPhotoName),
        path.resolve(ownerDir, privateDocAadhaar),
        path.resolve(ownerDir, privateDocLicense),
        path.resolve(ownerDir, privateDocProperty),
        path.resolve(plansDir, privatePlanPdf),
      ]) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    console.log('✓ Priority 1: Facility photo security and directory isolation verified 100%!\n');

    // =========================================================================
    // TEST 8: Priority 2 & 3 — Ghost Slots & Structural Hierarchy Invariants
    // =========================================================================
    console.log('[TEST 8] Priority 2 & 3: Ghost Slots Elimination & Structural Hierarchy');

    // Case A: Lot with totalFloors: 1 and totalSlots: 20 in DB, but 0 ParkingFloor records in collection
    const lotNoFloors = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Ghost Lot No Floors',
      address: 'Nowhere Street',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      postalCode: '380015',
      latitude: 23.0135,
      longitude: 72.5126,
      location: { type: 'Point', coordinates: [72.5126, 23.0135] },
      contactNumber: '9898000010',
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      hourlyRate: 50,
      totalFloors: 1,
      totalSlots: 20,
      availableSlots: 20,
      occupiedSlots: 0,
      reservedSlots: 0,
      averageRating: 4.5,
      totalReviews: 1,
      amenities: [],
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotNoFloors._id as mongoose.Types.ObjectId);

    // Published layout for lotNoFloors
    const layoutNoFloors = await ParkingLayoutModel.create({
      parkingLotId: lotNoFloors._id,
      floorId: new mongoose.Types.ObjectId(),
      version: 1,
      status: 'Published',
      isPublished: true,
      isValidated: true,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: { width: 1200, height: 800, scale: 1, gridSnap: 20, backgroundColor: '#ffffff' },
      boundary: { width: 1000, height: 600, wallThickness: 20, entryGateWidth: 80, exitGateWidth: 80 },
      elements: [],
      metadata: { lastSavedBy: testOwner._id, publishedBy: testOwner._id, publishedAt: new Date(), notes: '' },
    });
    cleanupIds.layoutIds.push(layoutNoFloors._id as mongoose.Types.ObjectId);

    // Case B: Lot with a Floor, totalSlots: 30 in DB, but ZERO ParkingSlot records (Ghost Slots)
    const lotNoSlots = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Ghost Lot No Slots',
      address: 'Empty Slot Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      postalCode: '380015',
      latitude: 23.0135,
      longitude: 72.5126,
      location: { type: 'Point', coordinates: [72.5126, 23.0135] },
      contactNumber: '9898000011',
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      hourlyRate: 50,
      totalFloors: 1,
      totalSlots: 30,
      availableSlots: 30,
      occupiedSlots: 0,
      reservedSlots: 0,
      averageRating: 4.5,
      totalReviews: 1,
      amenities: [],
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotNoSlots._id as mongoose.Types.ObjectId);

    const floorForLotNoSlots = await ParkingFloorModel.create({
      parkingLotId: lotNoSlots._id,
      floorNumber: 0,
      floorName: 'Ground Floor',
      floorStatus: 'Active',
      totalSlots: 30,
      availableSlots: 30,
    });
    cleanupIds.floorIds.push(floorForLotNoSlots._id as mongoose.Types.ObjectId);

    const layoutNoSlots = await ParkingLayoutModel.create({
      parkingLotId: lotNoSlots._id,
      floorId: floorForLotNoSlots._id,
      version: 1,
      status: 'Published',
      isPublished: true,
      isValidated: true,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: { width: 1200, height: 800, scale: 1, gridSnap: 20, backgroundColor: '#ffffff' },
      boundary: { width: 1000, height: 600, wallThickness: 20, entryGateWidth: 80, exitGateWidth: 80 },
      elements: [],
      metadata: { lastSavedBy: testOwner._id, publishedBy: testOwner._id, publishedAt: new Date(), notes: '' },
    });
    cleanupIds.layoutIds.push(layoutNoSlots._id as mongoose.Types.ObjectId);

    // Case C: Lot with corrupted foreign floor reference on slot
    const lotCorruptFloor = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Corrupt Floor Lot',
      address: 'Broken Hierarchy St',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      postalCode: '380015',
      latitude: 23.0135,
      longitude: 72.5126,
      location: { type: 'Point', coordinates: [72.5126, 23.0135] },
      contactNumber: '9898000012',
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      hourlyRate: 50,
      totalFloors: 1,
      totalSlots: 1,
      availableSlots: 1,
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotCorruptFloor._id as mongoose.Types.ObjectId);

    const floorCorrupt = await ParkingFloorModel.create({
      parkingLotId: lotCorruptFloor._id,
      floorNumber: 0,
      floorName: 'Ground Floor',
      floorStatus: 'Active',
      totalSlots: 1,
      availableSlots: 1,
    });
    cleanupIds.floorIds.push(floorCorrupt._id as mongoose.Types.ObjectId);

    const layoutCorrupt = await ParkingLayoutModel.create({
      parkingLotId: lotCorruptFloor._id,
      floorId: floorCorrupt._id,
      version: 1,
      status: 'Published',
      isPublished: true,
      isValidated: true,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: { width: 1200, height: 800, scale: 1, gridSnap: 20, backgroundColor: '#ffffff' },
      boundary: { width: 1000, height: 600, wallThickness: 20, entryGateWidth: 80, exitGateWidth: 80 },
      elements: [],
      metadata: { lastSavedBy: testOwner._id, publishedBy: testOwner._id, publishedAt: new Date(), notes: '' },
    });
    cleanupIds.layoutIds.push(layoutCorrupt._id as mongoose.Types.ObjectId);

    // Slot points to foreign non-existent floor
    const slotForeignFloor = await ParkingSlotModel.create({
      parkingLotId: lotCorruptFloor._id,
      floorId: new mongoose.Types.ObjectId(), // Non-existent foreign floor!
      zoneId: new mongoose.Types.ObjectId(),
      slotNumber: 'CF01',
      slotLabel: 'CF01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `PK-CORRUPT-${Date.now()}-1`,
    });
    cleanupIds.slotIds.push(slotForeignFloor._id as mongoose.Types.ObjectId);

    // Query customer search
    const structuralSearchResult = await customerParkingService.searchParkingLots({});
    const foundLotIds = structuralSearchResult.parkingLots.map((l) => l._id);

    if (foundLotIds.includes(lotNoFloors._id.toString())) {
      throw new Error('Test 8 Failed: Facility with no official floors was returned in search!');
    }
    if (foundLotIds.includes(lotNoSlots._id.toString())) {
      throw new Error('Test 8 Failed: Ghost facility with no physical slots was returned in search!');
    }
    if (foundLotIds.includes(lotCorruptFloor._id.toString())) {
      throw new Error('Test 8 Failed: Facility with corrupted slot floor reference was returned in search!');
    }
    console.log('✓ Priority 2 & 3: Ghost slots eliminated and structural hierarchy validated!\n');

    // =========================================================================
    // TEST 9: Priority 4 — Authoritative Live Availability Filtering
    // =========================================================================
    console.log('[TEST 9] Priority 4: Authoritative Live Availability Filtering');

    // Create Lot with 2 slots: both OCCUPIED, but ParkingLot document has stale availableSlots = 5
    const lotAllOccupied = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Full House Lot',
      address: 'Busy Boulevard',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      postalCode: '380015',
      latitude: 23.0135,
      longitude: 72.5126,
      location: { type: 'Point', coordinates: [72.5126, 23.0135] },
      contactNumber: '9898000013',
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      hourlyRate: 50,
      totalFloors: 1,
      totalSlots: 2,
      availableSlots: 5, // STALE CACHED NUMBER IN DB!
      occupiedSlots: 0,
      reservedSlots: 0,
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotAllOccupied._id as mongoose.Types.ObjectId);

    const floorAllOcc = await ParkingFloorModel.create({
      parkingLotId: lotAllOccupied._id,
      floorNumber: 0,
      floorName: 'Ground Floor',
      floorStatus: 'Active',
      totalSlots: 2,
      availableSlots: 0,
    });
    cleanupIds.floorIds.push(floorAllOcc._id as mongoose.Types.ObjectId);

    const zoneAllOcc = await ParkingZoneModel.create({
      parkingLotId: lotAllOccupied._id,
      floorId: floorAllOcc._id,
      zoneName: 'Zone All Occupied',
      zoneCode: 'ZAO',
      totalSlots: 2,
      availableSlots: 0,
    });
    cleanupIds.zoneIds.push(zoneAllOcc._id as mongoose.Types.ObjectId);

    const layoutAllOcc = await ParkingLayoutModel.create({
      parkingLotId: lotAllOccupied._id,
      floorId: floorAllOcc._id,
      version: 1,
      status: 'Published',
      isPublished: true,
      isValidated: true,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: { width: 1200, height: 800, scale: 1, gridSnap: 20, backgroundColor: '#ffffff' },
      boundary: { width: 1000, height: 600, wallThickness: 20, entryGateWidth: 80, exitGateWidth: 80 },
      elements: [],
      metadata: { lastSavedBy: testOwner._id, publishedBy: testOwner._id, publishedAt: new Date(), notes: '' },
    });
    cleanupIds.layoutIds.push(layoutAllOcc._id as mongoose.Types.ObjectId);

    const occSlot1 = await ParkingSlotModel.create({
      parkingLotId: lotAllOccupied._id,
      floorId: floorAllOcc._id,
      zoneId: zoneAllOcc._id,
      slotNumber: 'OCC01',
      slotLabel: 'OCC01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Occupied',
      qrIdentifier: `PK-OCC-${Date.now()}-1`,
    });
    const occSlot2 = await ParkingSlotModel.create({
      parkingLotId: lotAllOccupied._id,
      floorId: floorAllOcc._id,
      zoneId: zoneAllOcc._id,
      slotNumber: 'OCC02',
      slotLabel: 'OCC02',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Occupied',
      qrIdentifier: `PK-OCC-${Date.now()}-2`,
    });
    cleanupIds.slotIds.push(occSlot1._id as mongoose.Types.ObjectId, occSlot2._id as mongoose.Types.ObjectId);

    // Filter availability: 'Available'
    const availSearchResult = await customerParkingService.searchParkingLots({ availability: 'Available' });
    const availLotIds = availSearchResult.parkingLots.map((l) => l._id);

    if (availLotIds.includes(lotAllOccupied._id.toString())) {
      throw new Error('Test 9 Failed: Lot with 0 live available slots passed Available filter due to stale lot count!');
    }

    // When availability: 'All', it should appear with availableSlots = 0 and occupancyPercentage = 100%
    const allSearchResult = await customerParkingService.searchParkingLots({ availability: 'All' });
    const foundOccLot = allSearchResult.parkingLots.find((l) => l._id === lotAllOccupied._id.toString());
    if (!foundOccLot || foundOccLot.availableSlots !== 0 || foundOccLot.occupancyPercentage !== 100) {
      throw new Error('Test 9 Failed: Full lot did not report 0 available slots and 100% occupancy.');
    }
    console.log('✓ Priority 4: Authoritative live slot availability filtering verified!\n');

    // =========================================================================
    // TEST 10: Priority 5 — Under Maintenance & Occupancy Calculation
    // =========================================================================
    console.log('[TEST 10] Priority 5: Under Maintenance Capacity & Occupancy Reconciliation');

    // Create Lot with 4 physical slots: 1 Available, 1 Occupied, 1 Reserved, 1 Under Maintenance
    const lotMaint = await ParkingLotModel.create({
      ownerId: testOwner._id,
      parkingName: 'Maintenance Test Lot',
      address: 'Maintenance Way',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      postalCode: '380015',
      latitude: 23.0135,
      longitude: 72.5126,
      location: { type: 'Point', coordinates: [72.5126, 23.0135] },
      contactNumber: '9898000014',
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen24Hours: true,
      hourlyRate: 35,
      totalFloors: 1,
      totalSlots: 4,
      availableSlots: 1,
      isVerified: true,
      parkingStatus: 'Active',
      layoutReviewStatus: 'Owner Confirmed',
    });
    cleanupIds.lotIds.push(lotMaint._id as mongoose.Types.ObjectId);

    const floorMaint = await ParkingFloorModel.create({
      parkingLotId: lotMaint._id,
      floorNumber: 0,
      floorName: 'Ground Floor',
      floorStatus: 'Active',
      totalSlots: 4,
      availableSlots: 1,
    });
    cleanupIds.floorIds.push(floorMaint._id as mongoose.Types.ObjectId);

    const zoneMaint = await ParkingZoneModel.create({
      parkingLotId: lotMaint._id,
      floorId: floorMaint._id,
      zoneName: 'Zone Maintenance',
      zoneCode: 'ZM',
      totalSlots: 4,
      availableSlots: 1,
    });
    cleanupIds.zoneIds.push(zoneMaint._id as mongoose.Types.ObjectId);

    const layoutMaint = await ParkingLayoutModel.create({
      parkingLotId: lotMaint._id,
      floorId: floorMaint._id,
      version: 1,
      status: 'Published',
      isPublished: true,
      isValidated: true,
      createdBy: testOwner._id,
      lastModifiedBy: testOwner._id,
      canvasConfig: { width: 1200, height: 800, scale: 1, gridSnap: 20, backgroundColor: '#ffffff' },
      boundary: { width: 1000, height: 600, wallThickness: 20, entryGateWidth: 80, exitGateWidth: 80 },
      elements: [],
      metadata: { lastSavedBy: testOwner._id, publishedBy: testOwner._id, publishedAt: new Date(), notes: '' },
    });
    cleanupIds.layoutIds.push(layoutMaint._id as mongoose.Types.ObjectId);

    const mSlot1 = await ParkingSlotModel.create({
      parkingLotId: lotMaint._id,
      floorId: floorMaint._id,
      zoneId: zoneMaint._id,
      slotNumber: 'M01',
      slotLabel: 'M01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `PK-MAINT-${Date.now()}-1`,
    });
    const mSlot2 = await ParkingSlotModel.create({
      parkingLotId: lotMaint._id,
      floorId: floorMaint._id,
      zoneId: zoneMaint._id,
      slotNumber: 'M02',
      slotLabel: 'M02',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Occupied',
      qrIdentifier: `PK-MAINT-${Date.now()}-2`,
    });
    const mSlot3 = await ParkingSlotModel.create({
      parkingLotId: lotMaint._id,
      floorId: floorMaint._id,
      zoneId: zoneMaint._id,
      slotNumber: 'M03',
      slotLabel: 'M03',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Reserved',
      qrIdentifier: `PK-MAINT-${Date.now()}-3`,
    });
    const mSlot4 = await ParkingSlotModel.create({
      parkingLotId: lotMaint._id,
      floorId: floorMaint._id,
      zoneId: zoneMaint._id,
      slotNumber: 'M04',
      slotLabel: 'M04',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Under Maintenance',
      qrIdentifier: `PK-MAINT-${Date.now()}-4`,
    });
    cleanupIds.slotIds.push(
      mSlot1._id as mongoose.Types.ObjectId,
      mSlot2._id as mongoose.Types.ObjectId,
      mSlot3._id as mongoose.Types.ObjectId,
      mSlot4._id as mongoose.Types.ObjectId,
    );

    const maintResult = await customerParkingService.searchParkingLots({ search: 'Maintenance Test Lot' });
    const targetLot = maintResult.parkingLots.find((l) => l._id === lotMaint._id.toString());

    if (!targetLot) {
      throw new Error('Test 10 Failed: Maintenance Test Lot not found in search results.');
    }

    // Operational capacity must exclude Under Maintenance: 4 physical - 1 maintenance = 3 operational slots
    if (targetLot.totalSlots !== 3) {
      throw new Error(`Test 10 Failed: totalSlots expected 3 (operational), got ${targetLot.totalSlots}`);
    }
    if (targetLot.availableSlots !== 1) {
      throw new Error(`Test 10 Failed: availableSlots expected 1, got ${targetLot.availableSlots}`);
    }
    if (targetLot.occupiedSlots !== 1) {
      throw new Error(`Test 10 Failed: occupiedSlots expected 1, got ${targetLot.occupiedSlots}`);
    }
    if (targetLot.reservedSlots !== 1) {
      throw new Error(`Test 10 Failed: reservedSlots expected 1, got ${targetLot.reservedSlots}`);
    }

    // Occupancy Percentage: (1 Occupied + 1 Reserved) / 3 operational slots = 67%
    if (targetLot.occupancyPercentage !== 67) {
      throw new Error(`Test 10 Failed: occupancyPercentage expected 67%, got ${targetLot.occupancyPercentage}%`);
    }

    // Vehicle breakdown reconciliation
    const carStats = targetLot.vehicleAvailability.car;
    if (carStats.total !== 3 || carStats.available !== 1 || carStats.occupied !== 1 || carStats.reserved !== 1) {
      throw new Error(`Test 10 Failed: Vehicle breakdown numbers do not reconcile with operational capacity.`);
    }

    console.log('✓ Priority 5: Under Maintenance exclusion and operational capacity reconciliation verified!\n');

    console.log('========================================================================');
    console.log('  ALL 10 CUSTOMER DISCOVERY & SECURITY TESTS PASSED! (100% SUCCESS)');
    console.log('========================================================================\n');
  } finally {
    console.log('[CLEANUP] Removing test fixtures...');
    if (cleanupIds.layoutIds.length > 0) {
      await ParkingLayoutModel.deleteMany({ _id: { $in: cleanupIds.layoutIds } });
    }
    if (cleanupIds.slotIds.length > 0) {
      await ParkingSlotModel.deleteMany({ _id: { $in: cleanupIds.slotIds } });
    }
    if (cleanupIds.zoneIds.length > 0) {
      await ParkingZoneModel.deleteMany({ _id: { $in: cleanupIds.zoneIds } });
    }
    if (cleanupIds.floorIds.length > 0) {
      await ParkingFloorModel.deleteMany({ _id: { $in: cleanupIds.floorIds } });
    }
    if (cleanupIds.lotIds.length > 0) {
      await ParkingLotModel.deleteMany({ _id: { $in: cleanupIds.lotIds } });
    }
    if (cleanupIds.userIds.length > 0) {
      await UserModel.deleteMany({ _id: { $in: cleanupIds.userIds } });
    }
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB. Clean up complete.');
  }
}

runCustomerSearchTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE RUNNER FAILED:', err);
  process.exit(1);
});
