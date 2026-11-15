import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { AuditLogModel } from '../src/models/AuditLog.js';
import { ParkingLotModel } from '../src/models/ParkingLot.js';
import { ParkingFloorModel } from '../src/models/ParkingFloor.js';
import { ParkingZoneModel } from '../src/models/ParkingZone.js';
import { ParkingSlotModel } from '../src/models/ParkingSlot.js';
import { RoleModel } from '../src/models/Role.js';
import { UserModel } from '../src/models/User.js';
import { facilitySubmissionService } from '../src/services/facilitySubmission.service.js';

async function runVerification() {
  console.log('--- STARTING FACILITY SUBMISSION WORKFLOW VERIFICATION ---');

  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // 1. Find or create an approved Owner user
  const ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
  if (!ownerRole) throw new Error('OWNER role not found in database.');

  let testOwner = await UserModel.findOne({ email: 'test-owner-facility@parkease.com' });
  if (!testOwner) {
    testOwner = await UserModel.create({
      fullName: 'Test Facility Owner',
      email: 'test-owner-facility@parkease.com',
      mobileNumber: '+919988776655',
      roleId: ownerRole._id,
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
    });
    console.log('✓ Created test owner user:', testOwner.email);
  } else {
    console.log('✓ Using existing test owner user:', testOwner.email);
  }

  // Count existing official lots, floors, zones, slots
  const initialLots = await ParkingLotModel.countDocuments();
  const initialFloors = await ParkingFloorModel.countDocuments();
  const initialZones = await ParkingZoneModel.countDocuments();
  const initialSlots = await ParkingSlotModel.countDocuments();

  // 2. Test Draft Creation
  console.log('\n[TEST 1] Create Draft Facility Submission');
  const draft = await facilitySubmissionService.createDraft(testOwner._id.toString(), {
    facilityName: 'Emerald Grand Commercial Hub',
    shortDescription: 'Multi-deck covered smart parking',
    detailedDescription: 'Prime central business district facility with 24x7 security surveillance.',
    facilityType: 'Commercial Parking',
    contactName: 'Test Facility Owner',
    contactPhone: '+919988776655',
    contactEmail: 'test-owner-facility@parkease.com',
    location: {
      address: 'Plot 42, CG Road, Navrangpura, Ahmedabad, Gujarat, 380009',
      addressLine1: 'Plot 42, CG Road',
      areaLocality: 'Navrangpura',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380009',
      latitude: 23.0335,
      longitude: 72.5621,
      confirmed: false, // not yet confirmed
    },
    capacity: {
      totalSlots: 100,
      breakdown: { car: 70, suv: 20, bike: 10 },
    },
    floors: [
      { floorName: 'Ground Level', floorNumber: 0, slotCount: 50, parkingType: 'Covered' },
      { floorName: 'Basement 1', floorNumber: -1, slotCount: 50, parkingType: 'Basement' },
    ],
    operatingInfo: {
      isOpen24x7: true,
      openingTime: '00:00',
      closingTime: '23:59',
    },
    pricing: {
      carHourlyRate: 40,
      suvHourlyRate: 50,
      bikeHourlyRate: 20,
      gracePeriodMinutes: 15,
    },
    photos: [
      { url: 'uploads/submissions/photos/test-sample.jpg', category: 'Exterior', isPrimary: true },
    ],
    primaryImageUrl: 'uploads/submissions/photos/test-sample.jpg',
  });

  if (!draft.submissionReference.startsWith('PFS-')) {
    throw new Error(`Invalid submission reference generated: ${draft.submissionReference}`);
  }
  if (draft.submissionStatus !== 'Draft') {
    throw new Error(`Expected Draft status, got ${draft.submissionStatus}`);
  }
  console.log(`✓ Draft created successfully: ${draft.submissionReference} (Status: ${draft.submissionStatus})`);

  // Verify Audit Log for Draft Creation
  const createAudit = await AuditLogModel.findOne({
    actionCode: 'PARKING_FACILITY_SUBMISSION_CREATED',
    targetDocumentId: draft._id,
  });
  if (!createAudit) throw new Error('Audit log for draft creation was not found.');
  console.log('✓ AuditLog record created for PARKING_FACILITY_SUBMISSION_CREATED');

  // 3. Test Draft Updating
  console.log('\n[TEST 2] Update Draft Facility Submission');
  const updatedDraft = await facilitySubmissionService.updateSubmission(
    testOwner._id.toString(),
    draft._id.toString(),
    {
      facilityName: 'Emerald Grand Smart Parking Facility',
      location: {
        confirmed: true, // Now confirmed on map
      },
    },
  );

  if (updatedDraft.facilityName !== 'Emerald Grand Smart Parking Facility') {
    throw new Error('Draft facility name did not update correctly.');
  }
  if (!updatedDraft.location.confirmed) {
    throw new Error('Location confirmed flag did not update.');
  }
  console.log('✓ Draft updated successfully with confirmed map marker');

  // 4. Test Submission Validation (Floor mismatch failure test)
  console.log('\n[TEST 3] Validation enforcement (Floor sum mismatch)');
  let validationFailedAsExpected = false;
  try {
    // Set floors to 80 while capacity is 100
    await facilitySubmissionService.updateSubmission(testOwner._id.toString(), draft._id.toString(), {
      floors: [
        { floorName: 'Ground Level', floorNumber: 0, slotCount: 40, parkingType: 'Covered' },
        { floorName: 'Basement 1', floorNumber: -1, slotCount: 40, parkingType: 'Basement' },
      ],
    });
    // Attempt to submit
    await facilitySubmissionService.submitForReview(testOwner._id.toString(), draft._id.toString());
  } catch (err: unknown) {
    validationFailedAsExpected = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✓ Submission correctly rejected on floor sum mismatch: "${msg}"`);
  }
  if (!validationFailedAsExpected) {
    throw new Error('Expected validation error for floor slot mismatch, but submission succeeded unexpectedly.');
  }

  // 5. Test Successful Submission
  console.log('\n[TEST 4] Successful Submission for Administrator Review');
  // Re-align floors to match total capacity (100)
  await facilitySubmissionService.updateSubmission(testOwner._id.toString(), draft._id.toString(), {
    floors: [
      { floorName: 'Ground Level', floorNumber: 0, slotCount: 60, parkingType: 'Covered' },
      { floorName: 'Basement 1', floorNumber: -1, slotCount: 40, parkingType: 'Basement' },
    ],
  });

  const submitted = await facilitySubmissionService.submitForReview(
    testOwner._id.toString(),
    draft._id.toString(),
  );

  if (submitted.submissionStatus !== 'Submitted') {
    throw new Error(`Expected status Submitted, got ${submitted.submissionStatus}`);
  }
  if (!submitted.submittedAt) {
    throw new Error('submittedAt date was not stamped.');
  }
  console.log(`✓ Facility successfully submitted: ${submitted.submissionReference} (Status: ${submitted.submissionStatus})`);

  // Verify Audit Log for Submission
  const submitAudit = await AuditLogModel.findOne({
    actionCode: 'FACILITY_SUBMITTED',
    targetDocumentId: draft._id,
  });
  if (!submitAudit) throw new Error('Audit log for submission was not found.');
  console.log('✓ AuditLog record created for FACILITY_SUBMITTED');

  // 6. Test Post-Submission Immutability
  console.log('\n[TEST 5] Post-Submission Immutability Check');
  let lockCheckPassed = false;
  try {
    await facilitySubmissionService.updateSubmission(testOwner._id.toString(), draft._id.toString(), {
      facilityName: 'Illegal Renaming Attempt After Submit',
    });
  } catch (err: unknown) {
    lockCheckPassed = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✓ Post-submission edit blocked as expected: "${msg}"`);
  }
  if (!lockCheckPassed) {
    throw new Error('Expected edit to be blocked on Submitted status, but it succeeded.');
  }

  // 7. CRITICAL STRUCTURAL BOUNDARY CHECK: Verify zero official records were created
  console.log('\n[TEST 6] Critical Architectural Rule: Zero Official Structure Records');
  const finalLots = await ParkingLotModel.countDocuments();
  const finalFloors = await ParkingFloorModel.countDocuments();
  const finalZones = await ParkingZoneModel.countDocuments();
  const finalSlots = await ParkingSlotModel.countDocuments();

  if (finalLots !== initialLots) {
    throw new Error(`CRITICAL BREACH: Official ParkingLot records changed from ${initialLots} to ${finalLots}`);
  }
  if (finalFloors !== initialFloors) {
    throw new Error(`CRITICAL BREACH: Official ParkingFloor records changed from ${initialFloors} to ${finalFloors}`);
  }
  if (finalZones !== initialZones) {
    throw new Error(`CRITICAL BREACH: Official ParkingZone records changed from ${initialZones} to ${finalZones}`);
  }
  if (finalSlots !== initialSlots) {
    throw new Error(`CRITICAL BREACH: Official ParkingSlot records changed from ${initialSlots} to ${finalSlots}`);
  }

  console.log('✓ STRICT ISOLATION CONFIRMED:');
  console.log(`  - Official Lots:   ${initialLots} -> ${finalLots} (No change)`);
  console.log(`  - Official Floors: ${initialFloors} -> ${finalFloors} (No change)`);
  console.log(`  - Official Zones:  ${initialZones} -> ${finalZones} (No change)`);
  console.log(`  - Official Slots:  ${initialSlots} -> ${finalSlots} (No change)`);

  // 8. Test Non-Owner / Unauthorized Access Rejection
  console.log('\n[TEST 7] Security / Authorization Checks');
  const customerRole = await RoleModel.findOne({ roleCode: 'CUSTOMER' });
  const testCustomer = await UserModel.create({
    fullName: 'Intruder Customer',
    email: `intruder-${Date.now()}@parkease.com`,
    mobileNumber: `+9198${Date.now().toString().slice(-8)}`,
    roleId: customerRole!._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  let ownershipCheckPassed = false;
  try {
    await facilitySubmissionService.getSubmissionById(draft._id.toString(), testCustomer._id.toString(), false);
  } catch {
    ownershipCheckPassed = true;
    console.log('✓ Unauthorized customer access blocked with 404/403');
  }
  if (!ownershipCheckPassed) {
    throw new Error('Customer was able to access owner submission!');
  }

  // Clean up test customer
  await UserModel.deleteOne({ _id: testCustomer._id });

  console.log('\n======================================================');
  console.log('✓ ALL 7 ARCHITECTURAL & WORKFLOW VERIFICATIONS PASSED!');
  console.log('======================================================');

  await mongoose.disconnect();
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
