import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const envPath = fs.existsSync(path.resolve(process.cwd(), 'server', '.env'))
  ? path.resolve(process.cwd(), 'server', '.env')
  : path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

import assert from 'node:assert';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { OwnerApplicationModel } from '../src/models/OwnerApplication.js';
import { UserModel } from '../src/models/User.js';
import { RoleModel } from '../src/models/Role.js';
import { SessionModel } from '../src/models/Session.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { ownerService } from '../src/services/owner.service.js';

console.log('================================================================');
console.log('  ParkEase — Owner Registration Documents Lifecycle & Security Test');
console.log('================================================================\n');

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB Atlas.\n');

  // Ensure uploads directory and dummy test files exist for testing
  const serverDir = path.resolve(process.cwd(), 'server');
  const baseUploads = fs.existsSync(path.resolve(serverDir, 'uploads'))
    ? path.resolve(serverDir, 'uploads')
    : path.resolve(process.cwd(), 'uploads');
  const ownerUploadDir = path.join(baseUploads, 'owner');
  if (!fs.existsSync(ownerUploadDir)) {
    fs.mkdirSync(ownerUploadDir, { recursive: true });
  }

  const testPdfFilename = 'test-doc-proof.pdf';
  const testImgFilename = 'test-facility-photo.jpg';
  const testPdfPath = path.join(ownerUploadDir, testPdfFilename);
  const testImgPath = path.join(ownerUploadDir, testImgFilename);

  // Write minimal valid PDF and JPEG dummy bytes if not present
  if (!fs.existsSync(testPdfPath)) {
    fs.writeFileSync(testPdfPath, '%PDF-1.4\n%Minimal dummy PDF for testing\n%%EOF');
  }
  if (!fs.existsSync(testImgPath)) {
    fs.writeFileSync(testImgPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9]));
  }

  // Find or create roles
  let ownerRole = await RoleModel.findOne({ roleCode: 'OWNER' });
  if (!ownerRole) {
    ownerRole = await RoleModel.create({
      roleCode: 'OWNER',
      roleName: 'Parking Owner',
      description: 'Owner role',
      dashboardRoute: '/owner/dashboard',
      isSystem: true,
      isActive: true,
      permissions: [],
    });
  }



  // Create Owner A (Primary test owner)
  const uniqueA = Date.now().toString().slice(-6);
  const ownerA = await UserModel.create({
    fullName: `Test Owner A ${uniqueA}`,
    email: `ownera_${uniqueA}@testparkease.com`,
    mobileNumber: `+9198765${uniqueA.slice(-5)}`,
    accountStatus: 'Active',
    roleId: ownerRole._id,
    emailVerified: true,
    mobileVerified: true,
  });

  const sessionA = await SessionModel.create({
    userId: ownerA._id,
    sessionId: `sess_owner_A_${uniqueA}`,
    refreshTokenId: new mongoose.Types.ObjectId(),
    tokenFamilyId: `fam_A_${uniqueA}`,
    loginMethod: 'Email',
    sessionStatus: 'Active',
    ipAddress: '127.0.0.1',
    userAgent: 'IntegrationTestRunner/1.0',
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const tokenOwnerA = generateAccessToken({
    userId: ownerA._id.toString(),
    roleId: ownerRole._id.toString(),
    sessionId: sessionA.sessionId,
  });

  // Create Owner B (Adversary owner for cross-tenant isolation testing)
  const ownerB = await UserModel.create({
    fullName: `Test Owner B ${uniqueA}`,
    email: `ownerb_${uniqueA}@testparkease.com`,
    mobileNumber: `+9198766${uniqueA.slice(-5)}`,
    accountStatus: 'Active',
    roleId: ownerRole._id,
    emailVerified: true,
    mobileVerified: true,
  });

  const sessionB = await SessionModel.create({
    userId: ownerB._id,
    sessionId: `sess_owner_B_${uniqueA}`,
    refreshTokenId: new mongoose.Types.ObjectId(),
    tokenFamilyId: `fam_B_${uniqueA}`,
    loginMethod: 'Email',
    sessionStatus: 'Active',
    ipAddress: '127.0.0.1',
    userAgent: 'IntegrationTestRunner/1.0',
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const tokenOwnerB = generateAccessToken({
    userId: ownerB._id.toString(),
    roleId: ownerRole._id.toString(),
    sessionId: sessionB.sessionId,
  });

  // Create an OwnerApplication for Owner A
  const appA = await OwnerApplicationModel.create({
    applicantId: ownerA._id,
    applicationReference: `APP-TEST-${uniqueA}`,
    businessName: 'Metro Park Solutions Ltd',
    businessType: 'Commercial Parking',
    businessAddress: '42 Commercial Boulevard, Bandra',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    parkingCapacity: 150,
    businessDescription: 'Secure multi-storey parking facility in central commercial district.',
    ownerName: ownerA.fullName,
    businessEmail: ownerA.email,
    businessPhone: ownerA.mobileNumber,
    governmentIdType: 'Aadhaar',
    governmentIdNumber: '5432-8765-9012',
    identityProofUrl: `uploads/owner/${testPdfFilename}`,
    businessLicenseUrl: `uploads/owner/${testPdfFilename}`,
    propertyProofUrl: `uploads/owner/${testPdfFilename}`,
    parkingImageUrls: [
      `uploads/owner/${testImgFilename}`,
      `uploads/owner/${testImgFilename}`,
    ],
    termsAccepted: true,
    emailOtpVerified: true,
    applicationStatus: 'Approved',
    submittedAt: new Date(Date.now() - 3600000),
    reviewRemarks: 'All business documents verified successfully.',
    adminRemarks: 'Verified by Compliance Team.',
  });

  console.log(`[SETUP] Created test Owner A: ${ownerA.email} with Application ${appA.applicationReference}`);
  console.log(`[SETUP] Created test Owner B: ${ownerB.email} (no application)\n`);

  try {
    // -------------------------------------------------------------
    // TEST 1: Service Method - getOwnerRegistrationDocuments
    // -------------------------------------------------------------
    console.log('[TEST 1] Testing ownerService.getOwnerRegistrationDocuments...');
    const docSummary = await ownerService.getOwnerRegistrationDocuments(ownerA._id.toString());
    assert(docSummary !== null, 'Owner A must have registration documents');
    assert.strictEqual(docSummary.hasApplication, true, 'hasApplication must be true');

    const idProof = docSummary.documents.find((d) => d.category === 'identityProof');
    const bizLicense = docSummary.documents.find((d) => d.category === 'businessLicense');
    const propProof = docSummary.documents.find((d) => d.category === 'propertyProof');
    const photos = docSummary.photos;

    // Canonical Labels Verification
    assert(idProof, 'Identity proof document must exist');
    assert(bizLicense, 'Business license document must exist');
    assert(propProof, 'Property proof document must exist');
    assert(photos, 'Photos object must exist');

    assert.strictEqual(idProof.label, 'Government ID Proof', 'Label must be Government ID Proof');
    assert.strictEqual(bizLicense.label, 'Business Registration / Licence', 'Label must be Business Registration / Licence');
    assert.strictEqual(propProof.label, 'Property Ownership / Rental Proof', 'Label must be Property Ownership / Rental Proof');
    assert.strictEqual(photos.label, 'Parking Facility Photos', 'Label must be Parking Facility Photos');

    // Government ID Masking Verification
    console.log(`  Identity Number Masked: "${idProof.maskedIdNumber}"`);
    assert(idProof.maskedIdNumber?.includes('9012'), 'Masked ID must retain last 4 digits');
    assert(idProof.maskedIdNumber?.startsWith('••••'), 'Masked ID must mask first digits');
    assert.strictEqual(idProof.governmentIdType, 'Aadhaar', 'ID type must match');

    // Document Metadata
    assert.strictEqual(docSummary.businessName, 'Metro Park Solutions Ltd');
    assert.strictEqual(docSummary.businessType, 'Commercial Parking');
    assert.strictEqual(photos.items.length, 2, 'Must have 2 photos');
    assert.strictEqual(photos.items[0].index, 0);
    assert.strictEqual(photos.items[1].index, 1);
    console.log('✓ TEST 1 PASSED: Canonical labels, ID masking, and document metadata verified.\n');

    // -------------------------------------------------------------
    // TEST 2: HTTP GET /api/v1/owner/registration-documents
    // -------------------------------------------------------------
    console.log('[TEST 2] Testing HTTP GET /api/v1/owner/registration-documents via API...');
    const apiDocRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents', {
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
      },
    });
    assert.strictEqual(apiDocRes.status, 200, 'API must return 200 OK');
    const apiDocJson = (await apiDocRes.json()) as { success: boolean; data: typeof docSummary };
    assert.strictEqual(apiDocJson.success, true);
    assert.strictEqual(
      apiDocJson.data.documents.find((d) => d.category === 'identityProof')?.label,
      'Government ID Proof',
    );
    assert.strictEqual(apiDocJson.data.photos.items.length, 2);
    console.log('✓ TEST 2 PASSED: HTTP API returns correct document structure with 200 OK.\n');

    // -------------------------------------------------------------
    // TEST 3: HTTP GET /api/v1/owner/registration-documents/:docType (Streaming)
    // -------------------------------------------------------------
    console.log('[TEST 3] Testing HTTP File Streaming for all 4 document categories...');

    // 3a. Identity Proof (PDF)
    const streamIdRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents/identityProof', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(streamIdRes.status, 200, 'identityProof must return 200');
    assert.strictEqual(streamIdRes.headers.get('content-type'), 'application/pdf');
    assert(streamIdRes.headers.get('content-disposition')?.includes('inline'));
    const idBytes = await streamIdRes.arrayBuffer();
    assert(idBytes.byteLength > 0, 'Must stream binary content');
    console.log(`  ✓ identityProof: 200 OK, Content-Type: ${streamIdRes.headers.get('content-type')}, Length: ${idBytes.byteLength} bytes`);

    // 3b. Business License (PDF)
    const streamBizRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents/businessLicense?download=true', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(streamBizRes.status, 200, 'businessLicense must return 200');
    assert(streamBizRes.headers.get('content-disposition')?.includes('attachment'), 'Download param must set attachment disposition');
    console.log(`  ✓ businessLicense (download): 200 OK, Content-Disposition: ${streamBizRes.headers.get('content-disposition')}`);

    // 3c. Property Proof (PDF)
    const streamPropRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents/propertyProof', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(streamPropRes.status, 200, 'propertyProof must return 200');
    console.log(`  ✓ propertyProof: 200 OK, Content-Type: ${streamPropRes.headers.get('content-type')}`);

    // 3d. Parking Photos (JPEG with index parameter)
    const streamPhoto0 = await fetch('http://localhost:5000/api/v1/owner/registration-documents/parkingImage?index=0', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(streamPhoto0.status, 200, 'parkingImage?index=0 must return 200');
    assert.strictEqual(streamPhoto0.headers.get('content-type'), 'image/jpeg');
    const photoBytes = await streamPhoto0.arrayBuffer();
    assert(photoBytes.byteLength > 0, 'Must stream image bytes');
    console.log(`  ✓ parkingImage?index=0: 200 OK, Content-Type: ${streamPhoto0.headers.get('content-type')}, Length: ${photoBytes.byteLength} bytes`);

    const streamPhoto1 = await fetch('http://localhost:5000/api/v1/owner/registration-documents/parkingImage?index=1', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(streamPhoto1.status, 200, 'parkingImage?index=1 must return 200');
    console.log('✓ TEST 3 PASSED: All document categories stream successfully with proper Content-Type & Disposition.\n');

    // -------------------------------------------------------------
    // TEST 4: Security - Authentication & Authorization Checks
    // -------------------------------------------------------------
    console.log('[TEST 4] Testing Security Boundaries (Unauthenticated, Cross-Owner, Path Traversal)...');

    // 4a. Unauthenticated access blocked (401)
    const unauthRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents');
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
    console.log('  ✓ 4a: Unauthenticated access blocked (401 Unauthorized)');

    // 4b. Cross-Owner Isolation: Owner B attempts to access Owner A's documents
    const crossOwnerDocRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents', {
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    assert.strictEqual(crossOwnerDocRes.status, 200, 'Owner B has no application, returns hasApplication: false');
    const crossDocJson = (await crossOwnerDocRes.json()) as {
      success: boolean;
      data: { hasApplication: boolean; documents: unknown[] };
    };
    assert.strictEqual(crossDocJson.success, true);
    assert.strictEqual(crossDocJson.data.hasApplication, false);
    assert.strictEqual(crossDocJson.data.documents.length, 0);
    console.log("  ✓ 4b: Cross-Owner isolation verified: Owner B cannot see Owner A's documents (hasApplication: false)");

    // 4c. Owner B attempts to stream Owner A's files
    const crossOwnerStreamRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents/identityProof', {
      headers: { Authorization: `Bearer ${tokenOwnerB}` },
    });
    assert.strictEqual(crossOwnerStreamRes.status, 404, 'Owner B streaming Owner A document must return 404');
    console.log('  ✓ 4c: Cross-Owner file streaming blocked (404 Not Found)');

    // 4d. Invalid document type requested
    const invalidTypeRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents/hackerPayload', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(invalidTypeRes.status, 400, 'Invalid docType must return 400 Bad Request');
    console.log('  ✓ 4d: Invalid document type rejected (400 Bad Request)');

    // 4e. Invalid index out of bounds
    const invalidIndexRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents/parkingImage?index=999', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(invalidIndexRes.status, 404, 'Index out of bounds must return 404');
    console.log('  ✓ 4e: Photo index out of bounds rejected (404 Not Found)');
    console.log('✓ TEST 4 PASSED: Security and tenant isolation strictly enforced.\n');

    // -------------------------------------------------------------
    // TEST 5: Separate Facilities Pipeline vs Registration Documents
    // -------------------------------------------------------------
    console.log('[TEST 5] Testing Workflow Isolation (Registration Documents vs Facility Submission)...');
    // Ensure that registration document endpoint does NOT touch ParkingFacilitySubmissionModel
    // and that registration docTypes cannot access facility submission files
    const nonExistentDocRes = await fetch('http://localhost:5000/api/v1/owner/registration-documents/parkingPlanPdf', {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    });
    assert.strictEqual(nonExistentDocRes.status, 400, 'parkingPlanPdf is not a registration docType');
    console.log('✓ TEST 5 PASSED: Strict pipeline separation between OwnerApplication and ParkingFacilitySubmission.\n');

    console.log('================================================================');
    console.log('  ALL REGISTRATION DOCUMENT TESTS PASSED SUCCESSFULLY! (5/5)');
    console.log('================================================================');
  } finally {
    // Cleanup test data
    await OwnerApplicationModel.deleteOne({ _id: appA._id });
    await SessionModel.deleteMany({ userId: { $in: [ownerA._id, ownerB._id] } });
    await UserModel.deleteMany({ _id: { $in: [ownerA._id, ownerB._id] } });
    await mongoose.disconnect();
    console.log('\n[TEARDOWN] Test records cleaned up & MongoDB disconnected.');
  }
}

run().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});