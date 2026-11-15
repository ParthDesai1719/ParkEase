import assert from 'node:assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load server .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import {
  ParkingLotModel,
  ParkingFloorModel,
  ParkingZoneModel,
  ParkingSlotModel,
  ParkingLayoutModel,
  UserModel,
  RoleModel,
  AuditLogModel,
} from '../src/models/index.js';
import { ParkingLayoutService } from '../src/services/parkingLayout.service.js';

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  ParkEase — 2D Parking Layout Backend Foundation Comprehensive Test');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease';
  console.log(`Connecting to MongoDB: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}...`);
  await mongoose.connect(mongoUri);
  console.log('✓ MongoDB connected successfully.\n');

  let testAdminUser: any;
  let testOwnerUser: any;
  let anotherOwnerUser: any;
  let testLot: any;
  let foreignLot: any;
  let testFloor: any;
  let foreignFloor: any;
  let testZone: any;
  let testSlots: any[] = [];
  let foreignSlot: any;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Provision Test Entities
    // ------------------------------------------------------------------------
    console.log('[SETUP] Provisioning isolated test fixtures...');

    // Find or create roles
    let adminRole = await RoleModel.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleModel.create({
        roleName: 'System Administrator',
        roleCode: 'ADMIN',
        description: 'Administrator role for tests',
        isSystem: true,
        isActive: true,
        permissions: [],
      });
    }

    let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
    if (!ownerRole) {
      ownerRole = await RoleModel.create({
        roleName: 'Parking Owner',
        roleCode: 'OWNER',
        description: 'Parking owner role for tests',
        isSystem: true,
        isActive: true,
        permissions: [],
      });
    }

    // Provision Admin User
    testAdminUser = await UserModel.create({
      fullName: 'Layout Admin Tester',
      email: `layout-admin-${Date.now()}@test.parkease.in`,
      mobileNumber: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      roleId: adminRole._id,
      isEmailVerified: true,
      accountStatus: 'Active',
    });

    // Provision Owner Users
    testOwnerUser = await UserModel.create({
      fullName: 'Layout Owner Tester',
      email: `layout-owner-${Date.now()}@test.parkease.in`,
      mobileNumber: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
      roleId: ownerRole._id,
      isEmailVerified: true,
      accountStatus: 'Active',
    });

    anotherOwnerUser = await UserModel.create({
      fullName: 'Foreign Owner Tester',
      email: `foreign-owner-${Date.now()}@test.parkease.in`,
      mobileNumber: `+9196${Math.floor(10000000 + Math.random() * 90000000)}`,
      roleId: ownerRole._id,
      isEmailVerified: true,
      accountStatus: 'Active',
    });

    // Provision Test Parking Lot (Initial status: Inactive / Under Review)
    testLot = await ParkingLotModel.create({
      ownerId: testOwnerUser._id,
      parkingName: 'Test Plaza Hub',
      parkingType: 'Commercial',
      address: '100 Silicon Highway',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560100',
      latitude: 12.9716,
      longitude: 77.5946,
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716],
      },
      contactNumber: '+919876543210',
      totalFloors: 1,
      totalCapacity: 3,
      availableCapacity: 3,
      pricingModel: 'Hourly',
      hourlyRate: 50,
      amenities: ['CCTV Surveillance', 'Covered Parking'],
      parkingStatus: 'Inactive', // NOT Active yet
    });

    // Provision Foreign Parking Lot (for cross-lot integrity checks)
    foreignLot = await ParkingLotModel.create({
      ownerId: anotherOwnerUser._id,
      parkingName: 'Foreign Complex',
      parkingType: 'Commercial',
      address: '200 Outer Ring Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560103',
      latitude: 12.98,
      longitude: 77.6,
      location: {
        type: 'Point',
        coordinates: [77.6, 12.98],
      },
      contactNumber: '+919876543211',
      totalFloors: 1,
      totalCapacity: 1,
      availableCapacity: 1,
      pricingModel: 'Hourly',
      hourlyRate: 40,
      amenities: ['CCTV Surveillance'],
      parkingStatus: 'Inactive',
    });

    // Provision Floors
    testFloor = await ParkingFloorModel.create({
      parkingLotId: testLot._id,
      floorName: 'Ground Floor G1',
      floorNumber: 0,
      totalZones: 1,
      totalSlots: 3,
      availableSlots: 3,
      floorStatus: 'Active',
    });

    foreignFloor = await ParkingFloorModel.create({
      parkingLotId: foreignLot._id,
      floorName: 'Level 1 Foreign',
      floorNumber: 0,
      totalZones: 1,
      totalSlots: 1,
      availableSlots: 1,
      floorStatus: 'Active',
    });

    // Provision Zones
    testZone = await ParkingZoneModel.create({
      parkingLotId: testLot._id,
      floorId: testFloor._id,
      zoneName: 'Zone A',
      zoneCode: 'A',
      vehicleType: 'Car',
      totalSlots: 3,
      availableSlots: 3,
      zoneStatus: 'Active',
    });

    const foreignZone = await ParkingZoneModel.create({
      parkingLotId: foreignLot._id,
      floorId: foreignFloor._id,
      zoneName: 'Foreign Zone',
      zoneCode: 'FZ',
      vehicleType: 'Car',
      totalSlots: 1,
      availableSlots: 1,
      zoneStatus: 'Active',
    });

    // Provision Official Slots
    testSlots = await ParkingSlotModel.create([
      {
        parkingLotId: testLot._id,
        floorId: testFloor._id,
        zoneId: testZone._id,
        slotNumber: 'A01',
        slotLabel: 'A01',
        slotType: 'Standard',
        supportedVehicleType: 'Car',
        slotStatus: 'Available',
        qrIdentifier: `PK-TEST-A01-${Date.now()}`,
      },
      {
        parkingLotId: testLot._id,
        floorId: testFloor._id,
        zoneId: testZone._id,
        slotNumber: 'A02',
        slotLabel: 'A02',
        slotType: 'Standard',
        supportedVehicleType: 'Car',
        slotStatus: 'Available',
        qrIdentifier: `PK-TEST-A02-${Date.now()}`,
      },
      {
        parkingLotId: testLot._id,
        floorId: testFloor._id,
        zoneId: testZone._id,
        slotNumber: 'A03',
        slotLabel: 'A03',
        slotType: 'EV Charging',
        supportedVehicleType: 'Car',
        slotStatus: 'Available',
        qrIdentifier: `PK-TEST-A03-${Date.now()}`,
      },
    ]);

    foreignSlot = await ParkingSlotModel.create({
      parkingLotId: foreignLot._id,
      floorId: foreignFloor._id,
      zoneId: foreignZone._id,
      slotNumber: 'FZ01',
      slotLabel: 'FZ01',
      slotType: 'Standard',
      supportedVehicleType: 'Car',
      slotStatus: 'Available',
      qrIdentifier: `PK-FOREIGN-FZ01-${Date.now()}`,
    });

    console.log('✓ Test fixtures provisioned: 1 Lot, 1 Floor, 1 Zone, 3 Official Slots.\n');

    // ------------------------------------------------------------------------
    // TEST 1: ADMINISTRATOR AUTHORIZATION
    // ------------------------------------------------------------------------
    console.log('[TEST 1] Administrator Authorization');
    // Function check: Admin can access layout endpoints
    const adminAccess = await ParkingLayoutService.getFloorLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      { userRole: 'ADMIN', userId: testAdminUser._id.toString() },
    );
    assert.ok(adminAccess, 'Admin must be able to retrieve floor layout metadata');
    assert.strictEqual(adminAccess.floor.floorName, 'Ground Floor G1');
    console.log('✓ Administrator authorization verified.');

    // ------------------------------------------------------------------------
    // TEST 2: OWNER ACCESS RESTRICTIONS
    // ------------------------------------------------------------------------
    console.log('\n[TEST 2] Owner Access Restrictions');
    // 2a. Owner cannot read layout of lot they do not own
    let ownerForbidden = false;
    try {
      await ParkingLayoutService.getFloorLayout(
        testLot._id.toString(),
        testFloor._id.toString(),
        { userRole: 'OWNER', userId: anotherOwnerUser._id.toString() },
      );
    } catch (err: any) {
      ownerForbidden = err.statusCode === 403;
    }
    assert.ok(ownerForbidden, 'Owner attempting to access layout of another owner lot must receive 403 Forbidden.');

    // 2b. Owner can only access published layout (no unpublished draft returned)
    const ownerAccess = await ParkingLayoutService.getFloorLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      { userRole: 'OWNER', userId: testOwnerUser._id.toString() },
    );
    assert.strictEqual(ownerAccess.hasPublishedLayout, false, 'Owner must NOT receive draft layout before publication.');
    console.log('✓ Owner access restrictions verified: Cross-lot 403 and draft isolation enforced.');

    // ------------------------------------------------------------------------
    // TEST 3: DRAFT LAYOUT CREATION
    // ------------------------------------------------------------------------
    console.log('\n[TEST 3] Draft Layout Creation');
    const initDraftRes = await ParkingLayoutService.initDraftLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      testAdminUser._id.toString(),
      '127.0.0.1',
    );
    assert.strictEqual(initDraftRes.isNew, true, 'First draft initialization must flag isNew=true');
    assert.strictEqual(initDraftRes.layout.version, 1, 'Initial draft version must be 1');
    assert.strictEqual(initDraftRes.layout.status, 'Draft', 'Status must be Draft');
    assert.strictEqual(initDraftRes.layout.isPublished, false, 'isPublished must be false');
    assert.strictEqual(initDraftRes.layout.canvasConfig.width, 1600, 'Canvas width must default to 1600');
    assert.strictEqual(initDraftRes.layout.canvasConfig.height, 1000, 'Canvas height must default to 1000');
    assert.strictEqual(initDraftRes.unplacedSlots.length, 3, 'All 3 floor slots must initially be unplaced');

    // Verify audit log entry
    const auditInit = await AuditLogModel.findOne({
      actionCode: 'LAYOUT_DRAFT_INITIALIZED',
      targetDocumentId: initDraftRes.layout._id,
    });
    assert.ok(auditInit, 'Audit log LAYOUT_DRAFT_INITIALIZED must be recorded.');
    console.log('✓ Draft layout creation verified with proper canvasConfig, versioning, and audit log.');

    // ------------------------------------------------------------------------
    // TEST 4: DRAFT RETRIEVAL
    // ------------------------------------------------------------------------
    console.log('\n[TEST 4] Draft Layout Retrieval');
    const getDraftRes = await ParkingLayoutService.getFloorLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      { userRole: 'ADMIN', userId: testAdminUser._id.toString() },
    );
    assert.ok(getDraftRes.isDraft, 'Retrieved layout must indicate isDraft=true');
    assert.strictEqual(getDraftRes.layout.version, 1);
    assert.strictEqual(getDraftRes.unplacedSlots.length, 3);
    console.log('✓ Draft layout retrieval verified with unplaced slots count and draft indicators.');

    // ------------------------------------------------------------------------
    // TEST 5: LAYOUT ELEMENT CREATION & MODIFICATION
    // ------------------------------------------------------------------------
    console.log('\n[TEST 5] Layout Element Creation & Modification');
    const sampleElements = [
      {
        elementId: 'ENTRANCE-1',
        elementType: 'Entrance' as const,
        x: 50,
        y: 50,
        width: 100,
        height: 60,
        rotation: 0,
        zIndex: 2,
        label: 'Main Entry Gate',
      },
      {
        elementId: 'EXIT-1',
        elementType: 'Exit' as const,
        x: 1400,
        y: 50,
        width: 100,
        height: 60,
        rotation: 0,
        zIndex: 2,
        label: 'Main Exit Gate',
      },
      {
        elementId: 'LANE-1',
        elementType: 'DrivingLane' as const,
        x: 200,
        y: 150,
        width: 1100,
        height: 120,
        rotation: 0,
        zIndex: 1,
        laneDirection: 'Two-Way' as const,
      },
      {
        elementId: 'PILLAR-1',
        elementType: 'Pillar' as const,
        x: 500,
        y: 350,
        width: 40,
        height: 40,
        rotation: 0,
        zIndex: 3,
      },
      {
        elementId: 'WALL-1',
        elementType: 'Wall' as const,
        x: 0,
        y: 0,
        width: 1600,
        height: 20,
        rotation: 0,
        zIndex: 2,
      },
      {
        elementId: 'RESTRICTED-1',
        elementType: 'RestrictedArea' as const,
        x: 50,
        y: 700,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 2,
        restrictedReason: 'Electrical Transformer Room',
      },
      {
        elementId: 'RESERVED-1',
        elementType: 'ReservedArea' as const,
        x: 300,
        y: 700,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 2,
        reservedFor: 'Emergency Services Only',
      },
      {
        elementId: 'SLOT-EL-A01',
        elementType: 'ParkingSlot' as const,
        slotId: testSlots[0]._id.toString(),
        x: 200,
        y: 300,
        width: 60,
        height: 100,
        rotation: 0,
        zIndex: 2,
      },
      {
        elementId: 'SLOT-EL-A02',
        elementType: 'ParkingSlot' as const,
        slotId: testSlots[1]._id.toString(),
        x: 280,
        y: 300,
        width: 60,
        height: 100,
        rotation: 0,
        zIndex: 2,
      },
    ];

    const saveElementsRes = await ParkingLayoutService.saveLayoutElements(
      testLot._id.toString(),
      testFloor._id.toString(),
      { elements: sampleElements },
      testAdminUser._id.toString(),
      '127.0.0.1',
    );

    assert.strictEqual(saveElementsRes.layout.elements.length, 9, 'Must persist all 9 layout elements');
    assert.strictEqual(saveElementsRes.stats.placedSlotsCount, 2, '2 slots must be recorded as placed');
    assert.strictEqual(saveElementsRes.stats.unplacedSlotsCount, 1, '1 slot remaining unplaced');
    assert.strictEqual(saveElementsRes.stats.lanesCount, 1);
    assert.strictEqual(saveElementsRes.stats.pillarsCount, 1);
    assert.strictEqual(saveElementsRes.stats.wallsCount, 1);
    assert.strictEqual(saveElementsRes.stats.entrancesCount, 1);
    assert.strictEqual(saveElementsRes.stats.exitsCount, 1);

    // Verify slot element was auto-enriched with canonical slotNumber and zoneId
    const slotEl1 = saveElementsRes.layout.elements.find((el: any) => el.elementId === 'SLOT-EL-A01');
    assert.strictEqual(slotEl1.slotNumber, 'A01', 'Slot element must be auto-enriched with canonical slotNumber');
    assert.strictEqual(slotEl1.zoneId.toString(), testZone._id.toString(), 'Slot element must reference official zoneId');

    console.log('✓ Layout element creation and modification verified across all physical element types.');

    // ------------------------------------------------------------------------
    // TEST 6: ELEMENT DELETION
    // ------------------------------------------------------------------------
    console.log('\n[TEST 6] Layout Element Deletion');
    const removeRes = await ParkingLayoutService.removeLayoutElement(
      testLot._id.toString(),
      testFloor._id.toString(),
      'PILLAR-1',
      testAdminUser._id.toString(),
      '127.0.0.1',
    );
    assert.strictEqual(removeRes.layout.elements.length, 8, 'Element count must decrease by 1');
    assert.strictEqual(removeRes.stats.pillarsCount, 0, 'Pillar count must be updated to 0');
    console.log('✓ Layout element deletion verified.');

    // ------------------------------------------------------------------------
    // TEST 7: CORRECT LOT & FLOOR ASSOCIATIONS
    // ------------------------------------------------------------------------
    console.log('\n[TEST 7] Lot & Floor Association Integrity');
    let wrongAssociationRejected = false;
    try {
      // Attempt to access testFloor under foreignLot
      await ParkingLayoutService.getFloorLayout(
        foreignLot._id.toString(),
        testFloor._id.toString(),
        { userRole: 'ADMIN', userId: testAdminUser._id.toString() },
      );
    } catch (err: any) {
      wrongAssociationRejected = err.statusCode === 404;
    }
    assert.ok(wrongAssociationRejected, 'Querying floor under incorrect parkingLotId must throw 404 Not Found.');
    console.log('✓ Lot & Floor association strictly verified.');

    // ------------------------------------------------------------------------
    // TEST 8: INVALID SLOT REFERENCES
    // ------------------------------------------------------------------------
    console.log('\n[TEST 8] Invalid Slot Reference Prevention');
    const fakeSlotId = new mongoose.Types.ObjectId().toString();
    let invalidSlotRejected = false;
    try {
      await ParkingLayoutService.saveLayoutElements(
        testLot._id.toString(),
        testFloor._id.toString(),
        {
          elements: [
            {
              elementId: 'SLOT-FAKE',
              elementType: 'ParkingSlot',
              slotId: fakeSlotId,
              x: 100,
              y: 100,
              width: 50,
              height: 80,
            },
          ],
        },
        testAdminUser._id.toString(),
        '127.0.0.1',
      );
    } catch (err: any) {
      invalidSlotRejected = err.statusCode === 400 && err.message.includes('do not exist');
    }
    assert.ok(invalidSlotRejected, 'Non-existent slotId reference must be rejected with 400.');
    console.log('✓ Non-existent slot reference prevention verified.');

    // ------------------------------------------------------------------------
    // TEST 9: CROSS-LOT & CROSS-FLOOR REFERENCE PREVENTION
    // ------------------------------------------------------------------------
    console.log('\n[TEST 9] Cross-Lot & Cross-Floor Reference Prevention');
    let crossLotRejected = false;
    try {
      await ParkingLayoutService.saveLayoutElements(
        testLot._id.toString(),
        testFloor._id.toString(),
        {
          elements: [
            {
              elementId: 'SLOT-FOREIGN',
              elementType: 'ParkingSlot',
              slotId: foreignSlot._id.toString(), // belongs to foreignLot
              x: 100,
              y: 100,
              width: 50,
              height: 80,
            },
          ],
        },
        testAdminUser._id.toString(),
        '127.0.0.1',
      );
    } catch (err: any) {
      crossLotRejected = err.statusCode === 400 && err.message.includes('Cross-lot reference violation');
    }
    assert.ok(crossLotRejected, 'Slot from a different parking lot must be rejected with Cross-lot reference violation.');
    console.log('✓ Cross-lot reference violation prevention verified.');

    // ------------------------------------------------------------------------
    // TEST 10: DUPLICATE INITIALIZATION PREVENTION
    // ------------------------------------------------------------------------
    console.log('\n[TEST 10] Duplicate Initialization Prevention');
    const duplicateInit = await ParkingLayoutService.initDraftLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      testAdminUser._id.toString(),
      '127.0.0.1',
    );
    assert.strictEqual(duplicateInit.isNew, false, 'Subsequent initDraftLayout must return isNew=false');
    assert.strictEqual(duplicateInit.message, 'Existing draft layout loaded.');
    console.log('✓ Duplicate draft layout initialization idempotency verified.');

    // ------------------------------------------------------------------------
    // TEST 11: VALIDATION WORKFLOW
    // ------------------------------------------------------------------------
    console.log('\n[TEST 11] Layout Validation Workflow');
    // 11a. Incomplete layout validation (A03 is unplaced)
    const incompleteVal = await ParkingLayoutService.validateDraftLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      testAdminUser._id.toString(),
      '127.0.0.1',
    );
    assert.strictEqual(incompleteVal.isValid, false, 'Layout with unplaced slots must fail validation');
    assert.ok(incompleteVal.errors.some((e) => e.includes('unplaced')), 'Validation error must mention unplaced slots');

    // 11b. Add remaining slot A03
    const completeElements = [
      ...sampleElements.filter((el) => el.elementId !== 'PILLAR-1'),
      {
        elementId: 'SLOT-EL-A03',
        elementType: 'ParkingSlot' as const,
        slotId: testSlots[2]._id.toString(),
        x: 360,
        y: 300,
        width: 60,
        height: 100,
        rotation: 0,
        zIndex: 2,
      },
    ];

    await ParkingLayoutService.saveLayoutElements(
      testLot._id.toString(),
      testFloor._id.toString(),
      { elements: completeElements },
      testAdminUser._id.toString(),
      '127.0.0.1',
    );

    // 11c. Re-validate complete layout
    const completeVal = await ParkingLayoutService.validateDraftLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      testAdminUser._id.toString(),
      '127.0.0.1',
    );
    assert.strictEqual(completeVal.isValid, true, 'Fully mapped layout with entrance and exit must pass validation');
    assert.strictEqual(completeVal.layout.status, 'Validated', 'Status must transition to Validated');
    console.log('✓ Validation workflow verified: Flags incomplete layouts and approves complete valid layouts.');

    // ------------------------------------------------------------------------
    // TEST 12: PUBLISHED LAYOUT PRESERVATION & DRAFT ISOLATION
    // ------------------------------------------------------------------------
    console.log('\n[TEST 12] Published Layout Preservation & Draft Isolation');
    // 12a. Publish the validated draft
    const publishRes = await ParkingLayoutService.publishDraftLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      testAdminUser._id.toString(),
      '127.0.0.1',
    );
    assert.strictEqual(publishRes.layout.status, 'Published');
    assert.strictEqual(publishRes.layout.isPublished, true);
    assert.strictEqual(publishRes.layout.version, 1);
    const publishedElementsCount = publishRes.layout.elements.length;

    // 12b. Initialize a new revision (version 2 draft)
    const revisionDraft = await ParkingLayoutService.initDraftLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      testAdminUser._id.toString(),
      '127.0.0.1',
    );
    assert.strictEqual(revisionDraft.layout.version, 2, 'Cloned revision draft must increment version to 2');
    assert.strictEqual(revisionDraft.layout.status, 'Draft');
    assert.strictEqual(revisionDraft.layout.isPublished, false);

    // 12c. Modify the version 2 draft (add a new wall)
    await ParkingLayoutService.saveLayoutElements(
      testLot._id.toString(),
      testFloor._id.toString(),
      {
        elements: [
          ...completeElements,
          {
            elementId: 'WALL-NEW-V2',
            elementType: 'Wall',
            x: 50,
            y: 50,
            width: 100,
            height: 20,
          },
        ],
      },
      testAdminUser._id.toString(),
      '127.0.0.1',
    );

    // 12d. Verify published version 1 was NOT altered by draft modifications
    const publishedCheck = await ParkingLayoutModel.findOne({
      parkingLotId: testLot._id,
      floorId: testFloor._id,
      version: 1,
      isPublished: true,
    });
    assert.ok(publishedCheck, 'Published version 1 document must exist untouched');
    assert.strictEqual(
      publishedCheck.elements.length,
      publishedElementsCount,
      'Published layout element count must remain strictly unchanged',
    );

    // 12e. Verify owner view returns published version 1, not draft version 2
    const ownerFetch = await ParkingLayoutService.getFloorLayout(
      testLot._id.toString(),
      testFloor._id.toString(),
      { userRole: 'OWNER', userId: testOwnerUser._id.toString() },
    );
    assert.strictEqual(ownerFetch.layout.version, 1, 'Owner must only see published version 1');
    assert.strictEqual(ownerFetch.layout.elements.length, publishedElementsCount);

    console.log('✓ Published layout preservation and draft isolation verified.');

    // ------------------------------------------------------------------------
    // TEST 13: EXISTING PARKING SLOT RECORDS IMMUTABILITY
    // ------------------------------------------------------------------------
    console.log('\n[TEST 13] ParkingSlot Records Immutability');
    const existingSlotsAfterLayout = await ParkingSlotModel.find({
      parkingLotId: testLot._id,
    }).sort({ slotNumber: 1 });

    assert.strictEqual(existingSlotsAfterLayout.length, 3, 'Must maintain exactly 3 slot documents');
    assert.strictEqual(existingSlotsAfterLayout[0]._id.toString(), testSlots[0]._id.toString());
    assert.strictEqual(existingSlotsAfterLayout[1]._id.toString(), testSlots[1]._id.toString());
    assert.strictEqual(existingSlotsAfterLayout[2]._id.toString(), testSlots[2]._id.toString());
    assert.strictEqual(existingSlotsAfterLayout[0].slotNumber, 'A01');
    assert.strictEqual(existingSlotsAfterLayout[0].slotStatus, 'Available');
    console.log('✓ Official ParkingSlot documents strictly preserved (no duplication, recreation, or deletion).');

    // ------------------------------------------------------------------------
    // TEST 14: NO AUTOMATIC PARKING LOT ACTIVATION
    // ------------------------------------------------------------------------
    console.log('\n[TEST 14] No Automatic Parking Lot Activation');
    const lotAfterPublish = await ParkingLotModel.findById(testLot._id);
    assert.strictEqual(
      lotAfterPublish!.parkingStatus,
      'Inactive',
      'Publishing a layout must NEVER activate the Parking Lot! Must remain "Inactive".',
    );
    console.log('✓ Parking Lot activation independence strictly verified.');

    console.log('\n========================================================================');
    console.log('  ALL 14 TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');
  } finally {
    // Clean up test documents
    console.log('[CLEANUP] Cleaning up test records...');
    if (testLot) {
      await ParkingLayoutModel.deleteMany({ parkingLotId: testLot._id });
      await ParkingSlotModel.deleteMany({ parkingLotId: testLot._id });
      await ParkingZoneModel.deleteMany({ parkingLotId: testLot._id });
      await ParkingFloorModel.deleteMany({ parkingLotId: testLot._id });
      await ParkingLotModel.deleteOne({ _id: testLot._id });
    }
    if (foreignLot) {
      await ParkingLayoutModel.deleteMany({ parkingLotId: foreignLot._id });
      await ParkingSlotModel.deleteMany({ parkingLotId: foreignLot._id });
      await ParkingZoneModel.deleteMany({ parkingLotId: foreignLot._id });
      await ParkingFloorModel.deleteMany({ parkingLotId: foreignLot._id });
      await ParkingLotModel.deleteOne({ _id: foreignLot._id });
    }
    if (testAdminUser) await UserModel.deleteOne({ _id: testAdminUser._id });
    if (testOwnerUser) await UserModel.deleteOne({ _id: testOwnerUser._id });
    if (anotherOwnerUser) await UserModel.deleteOne({ _id: anotherOwnerUser._id });

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB. Clean up complete.\n');
  }
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed with error:', err);
  process.exit(1);
});
