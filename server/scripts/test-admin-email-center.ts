import mongoose from 'mongoose';
import {
  AuditLogModel,
  EmailLogModel,
  RoleModel,
  UserModel,
} from '../src/models/index.js';
import { adminEmailCenterService } from '../src/services/adminEmailCenter.service.js';
import { generateParkEaseEmailHtml } from '../src/services/email.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkease';

async function runTests() {
  console.log('==================================================================');
  console.log('--- Starting Admin Phase 4 Communication Center Integration Tests ---');
  console.log('==================================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const timestamp = Date.now();

  // 0. Setup test entities
  const customerRole = await (RoleModel as any).findOne({ roleCode: 'CUSTOMER' });
  const ownerRole = await (RoleModel as any).findOne({ roleCode: { $in: ['OWNER', 'PARKING_OWNER'] } });
  const adminRole = await (RoleModel as any).findOne({ roleCode: 'ADMIN' });

  if (!customerRole || !ownerRole || !adminRole) {
    throw new Error('Master roles (CUSTOMER, OWNER, ADMIN) must exist in DB.');
  }

  // Create test admin
  const testAdmin = await (UserModel as any).create({
    fullName: `Email Admin ${timestamp}`,
    email: `email.admin.${timestamp}@parkease.test`,
    mobileNumber: `+9198${String(timestamp).slice(-8)}`,
    roleId: adminRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // Create test customer 1
  const testCustomer1 = await (UserModel as any).create({
    fullName: `Customer Comm ${timestamp}`,
    email: `customer.comm.${timestamp}@test.com`,
    mobileNumber: `+9197${String(timestamp).slice(-8)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // Create test customer 2
  const testCustomer2 = await (UserModel as any).create({
    fullName: `Customer Comm Two ${timestamp}`,
    email: `customer2.comm.${timestamp}@test.com`,
    mobileNumber: `+9196${String(timestamp).slice(-8)}`,
    roleId: customerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  // Create test owner
  const testOwner = await (UserModel as any).create({
    fullName: `Owner Comm ${timestamp}`,
    email: `owner.comm.${timestamp}@test.com`,
    mobileNumber: `+9195${String(timestamp).slice(-8)}`,
    roleId: ownerRole._id,
    accountStatus: 'Active',
    emailVerified: true,
    mobileVerified: true,
  });

  try {
    // -------------------------------------------------------------
    // Test 1: HTML Sanitization
    // -------------------------------------------------------------
    console.log('\n--- Test 1: HTML Sanitization & Security ---');
    const dangerousHtml = `
      <h1>Special Announcement</h1>
      <p>Hello ParkEase user!</p>
      <script>alert("XSS exploit");</script>
      <img src="x" onerror="stealCookies()" />
      <a href="javascript:doMalicious()">Click here</a>
      <a href="https://parkease.com">Safe link</a>
      <iframe src="https://evil.com"></iframe>
      <div style="color: red; position: fixed; behavior: url(xss.htc);">Notice</div>
    `;

    const sanitized = adminEmailCenterService.sanitizeHtml(dangerousHtml);
    if (sanitized.includes('<script>') || sanitized.includes('alert(')) {
      throw new Error('Sanitizer failed: script tag was not stripped.');
    }
    if (sanitized.includes('onerror=')) {
      throw new Error('Sanitizer failed: onerror event handler was not stripped.');
    }
    if (sanitized.includes('javascript:')) {
      throw new Error('Sanitizer failed: javascript: scheme was not neutralized.');
    }
    if (sanitized.includes('<iframe')) {
      throw new Error('Sanitizer failed: iframe was not stripped.');
    }
    if (!sanitized.includes('Safe link') || !sanitized.includes('https://parkease.com')) {
      throw new Error('Sanitizer failed: safe link was improperly modified.');
    }
    console.log('Sanitized output preview:\n', sanitized.slice(0, 150), '...');
    console.log('✓ Test 1 Passed: Malicious scripts, event handlers, and iframes neutralized.');

    // -------------------------------------------------------------
    // Test 2: Recipient Discovery & Search
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Recipient Discovery & Search ---');
    const allCustomers = await adminEmailCenterService.searchRecipients('ALL_CUSTOMERS');
    console.log(`All Customers estimated count: ${allCustomers.estimatedCount}`);
    if (allCustomers.estimatedCount < 2) {
      throw new Error('Expected at least 2 active customers in search.');
    }

    const specificCust = await adminEmailCenterService.searchRecipients(
      'SPECIFIC_CUSTOMER',
      `customer.comm.${timestamp}`,
    );
    console.log(`Matched specific customer: ${specificCust.recipients.length}`);
    if (specificCust.recipients.length !== 1 || specificCust.recipients[0]?.email !== testCustomer1.email) {
      throw new Error('Failed to accurately find specific customer by email.');
    }

    const specificOwner = await adminEmailCenterService.searchRecipients(
      'SPECIFIC_OWNER',
      `Owner Comm ${timestamp}`,
    );
    console.log(`Matched specific owner: ${specificOwner.recipients.length}`);
    if (specificOwner.recipients.length !== 1 || specificOwner.recipients[0]?.email !== testOwner.email) {
      throw new Error('Failed to accurately find specific owner by name.');
    }
    console.log('✓ Test 2 Passed: Recipient discovery, role filtering, and text search verified.');

    // -------------------------------------------------------------
    // Test 3: Validation & Mass Email Confirmation Safeguard
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Mass Send Confirmation Safeguard ---');
    let caughtMassConfirmation = false;
    try {
      await adminEmailCenterService.sendEmail(testAdmin._id.toString(), {
        recipientCategory: 'ALL_CUSTOMERS',
        subject: 'Platform Scheduled Maintenance Notice',
        content: '<p>System maintenance scheduled for midnight.</p>',
        massEmailConfirmed: false, // Intentionally unconfirmed
      });
    } catch (err: any) {
      if (err.errorCode === 'MASS_CONFIRMATION_REQUIRED') {
        caughtMassConfirmation = true;
      }
    }
    if (!caughtMassConfirmation) {
      throw new Error('Server allowed mass email to ALL_CUSTOMERS without explicit confirmation!');
    }
    console.log('✓ Test 3 Passed: Mass email strictly blocked without explicit confirmation.');

    // -------------------------------------------------------------
    // Test 4: Single Specific Recipient Send & Delivery Recording
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Single Specific Recipient Email Dispatch ---');
    const sendResult = await adminEmailCenterService.sendEmail(testAdmin._id.toString(), {
      recipientCategory: 'SPECIFIC_CUSTOMER',
      recipientIds: [testCustomer1._id.toString()],
      subject: `Exclusive ParkEase Welcome Offer ${timestamp}`,
      content: '<p>Hello <strong>Valued Customer</strong>, enjoy ₹50 off on your next reservation!</p>',
      massEmailConfirmed: true,
    });

    console.log('Send result:', sendResult);
    if (!sendResult.success || sendResult.successfulDeliveries !== 1) {
      throw new Error('Failed to dispatch single specific email.');
    }

    // Verify EmailLog record was created
    const logRecord = await (EmailLogModel as any).findOne({
      recipientEmails: testCustomer1.email,
      subject: `Exclusive ParkEase Welcome Offer ${timestamp}`,
    });

    if (!logRecord) {
      throw new Error('EmailLog record was not saved to database.');
    }
    if (logRecord.deliveryStatus !== 'Sent') {
      throw new Error(`Expected deliveryStatus 'Sent', got '${logRecord.deliveryStatus}'`);
    }
    if (logRecord.source !== 'Admin') {
      throw new Error(`Expected source 'Admin', got '${logRecord.source}'`);
    }
    if (logRecord.recipientCategory !== 'SPECIFIC_CUSTOMER') {
      throw new Error(`Expected recipientCategory 'SPECIFIC_CUSTOMER', got '${logRecord.recipientCategory}'`);
    }
    console.log('Logged email reference:', logRecord.emailReference);
    console.log('✓ Test 4 Passed: Email successfully dispatched and recorded with delivery status.');

    // -------------------------------------------------------------
    // Test 5: Mass Email Send & Audit Trail
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Mass Email Send & Audit Trail ---');
    const massResult = await adminEmailCenterService.sendEmail(testAdmin._id.toString(), {
      recipientCategory: 'SPECIFIC_CUSTOMER',
      recipientIds: [testCustomer1._id.toString(), testCustomer2._id.toString()],
      subject: `Important Parking Policy Update ${timestamp}`,
      content: '<p>Please review our updated peak-hour parking guidelines.</p>',
      massEmailConfirmed: true,
    });

    console.log('Mass send result:', massResult);
    if (!massResult.success || massResult.totalTargeted !== 2) {
      throw new Error('Mass email failed to target both recipients.');
    }

    // Verify AuditLogModel
    const auditRecord = await (AuditLogModel as any).findOne({
      userId: testAdmin._id,
      actionCode: 'MASS_EMAIL_SENT',
    });
    if (!auditRecord) {
      throw new Error('AuditLog entry for MASS_EMAIL_SENT was not recorded.');
    }
    console.log('Recorded audit log:', auditRecord.description);
    console.log('✓ Test 5 Passed: Mass email dispatched with accurate audit trail.');

    // -------------------------------------------------------------
    // Test 6: Email History Query, Filters & Pagination
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Email History Query & Multi-Filters ---');
    const historyRes = await adminEmailCenterService.getEmailHistory({
      page: 1,
      limit: 10,
      search: `Exclusive ParkEase Welcome Offer ${timestamp}`,
      source: 'Admin',
    });

    console.log(`History search count: ${historyRes.pagination.total}`);
    if (historyRes.emails.length !== 1) {
      throw new Error('History query failed to find the sent test email.');
    }
    const item = historyRes.emails[0];
    if (item.sender?.email !== testAdmin.email) {
      throw new Error('History entry does not populate sending administrator.');
    }
    console.log('✓ Test 6 Passed: Email history retrieved with populated relations and search filter.');

    // -------------------------------------------------------------
    // Test 7: Email Center Overview KPIs
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Email Center Overview KPIs ---');
    const overview = await adminEmailCenterService.getOverview();
    console.log('Overview metrics:', {
      totalEmailsSent: overview.totalEmailsSent,
      successfulDeliveries: overview.successfulDeliveries,
      failedDeliveries: overview.failedDeliveries,
      activeCustomersCount: overview.activeCustomersCount,
      activeOwnersCount: overview.activeOwnersCount,
      recentActivityCount: overview.recentActivity.length,
    });

    if (overview.totalEmailsSent < 2 || overview.successfulDeliveries < 2) {
      throw new Error('Overview counters do not reflect sent test emails.');
    }
    if (overview.recentActivity.length === 0) {
      throw new Error('Recent activity feed is empty.');
    }
    console.log('✓ Test 7 Passed: Overview KPI counters and recent activity accurately derived.');

    // -------------------------------------------------------------
    // Test 8: Single Email Detail Dossier
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Single Email Detail Dossier ---');
    const detailDossier = await adminEmailCenterService.getEmailById(logRecord._id.toString());
    if (!detailDossier || detailDossier.emailReference !== logRecord.emailReference) {
      throw new Error('Detail dossier does not match requested email record.');
    }
    if (!detailDossier.sender || detailDossier.sender.email !== testAdmin.email) {
      throw new Error('Detail dossier did not populate sender administrator.');
    }
    console.log('✓ Test 8 Passed: Deep email inspection dossier verified.');

    // -------------------------------------------------------------
    // Test 9: Branded Email Layout Compatibility
    // -------------------------------------------------------------
    console.log('\n--- Test 9: ParkEase Branded Email Layout Verification ---');
    const sampleHtml = generateParkEaseEmailHtml({
      title: 'Platform Test Notification',
      subtitle: 'System Health Check',
      badge: { text: 'Verified', variant: 'success' },
      bodyHtml: '<p>Testing brand consistency.</p>',
    });

    if (!sampleHtml.includes('ParkEase — Smart Parking Made Simple') || !sampleHtml.includes('/brand/document-logo.png')) {
      throw new Error('Email layout does not contain official ParkEase branding logo.');
    }
    if (!sampleHtml.includes('/brand/document-footer.png')) {
      throw new Error('Email layout does not contain official document footer banner.');
    }
    console.log('✓ Test 9 Passed: ParkEase official branded email layout verified.');

    console.log('\n==================================================================');
    console.log('🎉 ALL 9 ADMIN EMAIL CENTER INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('==================================================================\n');
  } finally {
    console.log('Cleaning up test data...');
    await (UserModel as any).deleteMany({
      _id: { $in: [testAdmin._id, testCustomer1._id, testCustomer2._id, testOwner._id] },
    });
    await (EmailLogModel as any).deleteMany({
      senderId: testAdmin._id,
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
