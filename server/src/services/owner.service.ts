import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { OwnerApplicationModel, type OwnerApplication } from '../models/OwnerApplication.js';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { UserModel, type User } from '../models/User.js';
import { RoleModel, type Role } from '../models/Role.js';
import { SystemSettingsModel, type SystemSettings } from '../models/SystemSettings.js';
import { SessionModel, type Session } from '../models/Session.js';
import { NotificationModel } from '../models/Notification.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingFloorModel, type ParkingFloor } from '../models/ParkingFloor.js';
import { ParkingLayoutModel, type ParkingLayout } from '../models/ParkingLayout.js';
import { ParkingZoneModel, type ParkingZone } from '../models/ParkingZone.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { BookingTimelineModel, type BookingTimeline } from '../models/BookingTimeline.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { VehicleMovementLogModel } from '../models/VehicleMovementLog.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { SecurityStaffAssignmentModel, type SecurityStaffAssignment } from '../models/SecurityStaffAssignment.js';
import { AppError } from '../utils/AppError.js';
import { otpService } from './otp.service.js';
import { emailService } from './email.service.js';
import { auditService } from './audit.service.js';
import { razorpayService } from './razorpay.service.js';
import { notificationService } from './notification.service.js';
import { customerBookingService } from './customerBooking.service.js';
import { emitSlotStatusUpdate, emitBookingStatusUpdate, emitStaffStatusUpdate } from '../socket.js';

export interface RegistrationConfigResult {
  ownerRegistrationFee: number;
  defaultCurrency: string;
  paymentGateway: string;
  razorpayKeyId: string;
}

export interface RegisterOwnerInput {
  businessName: string;
  businessType: string;
  businessAddress: string;
  city: string;
  state: string;
  postalCode: string;
  parkingCapacity: number;
  businessDescription: string;
  ownerName: string;
  businessEmail: string;
  businessPhone: string;
  governmentIdType: string;
  governmentIdNumber: string;
  identityProofUrl: string;
  businessLicenseUrl: string;
  propertyProofUrl: string;
  parkingImageUrls: string[];
  termsAccepted: boolean;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface VerifyPaymentInput {
  applicationReference: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

const activeApplicationStatuses = ['Draft', 'Submitted', 'Pending Review'] as const;

class OwnerService {
  /**
   * Fetch platform configuration for Parking Owner Registration.
   */
  public async getRegistrationConfig(): Promise<RegistrationConfigResult> {
    const settings = await (SystemSettingsModel as unknown as mongoose.Model<SystemSettings>)
      .findOne({ singletonKey: 'GLOBAL' })
      .lean()
      .exec();
    return {
      ownerRegistrationFee: settings?.ownerRegistrationFee ?? 999,
      defaultCurrency: settings?.defaultCurrency ?? 'INR',
      paymentGateway: settings?.paymentGateway ?? 'RAZORPAY_TEST',
      razorpayKeyId: env.RAZORPAY_KEY_ID || '',
    };
  }

  /**
   * Normalize Indian phone number to canonical +91XXXXXXXXXX.
   */
  private normalizePhone(phone: string): string {
    const cleaned = (phone || '').trim().replace(/[\s-]/g, '');
    if (cleaned.startsWith('+91')) return cleaned;
    if (cleaned.length === 10 && /^\d+$/.test(cleaned)) return `+91${cleaned}`;
    return cleaned;
  }

  /**
   * Step 1 to 4: Create or update Draft Owner Application.
   * Generates or resumes draft, validates contact and fields, links/creates applicant User,
   * and immediately triggers Email OTP.
   */
  public async createDraftApplication(input: RegisterOwnerInput): Promise<{
    applicationReference: string;
    businessEmail: string;
    businessPhone: string;
    registrationFeeAmount: number;
    status: string;
    message: string;
  }> {
    const email = input.businessEmail.trim().toLowerCase();
    const phone = this.normalizePhone(input.businessPhone);

    if (!input.termsAccepted) {
      throw new AppError(
        'You must accept the Terms & Conditions and Privacy Policy to proceed.',
        400,
        'TERMS_REQUIRED',
      );
    }

    if (!/^\+91\d{10}$/.test(phone)) {
      throw new AppError(
        'Invalid mobile number. Please enter a valid 10-digit Indian mobile number.',
        400,
        'INVALID_PHONE',
      );
    }

    // 1. Check if an approved Parking Owner already exists with this email or mobile
    const ownerRole = await (RoleModel as unknown as mongoose.Model<Role>).findOne({ roleCode: 'OWNER' }).lean().exec();
    if (ownerRole) {
      const existingOwnerUser = await (UserModel as unknown as mongoose.Model<User>).findOne({
        $or: [{ email }, { mobileNumber: phone }],
        roleId: ownerRole._id,
      }).lean().exec();

      if (existingOwnerUser) {
        throw new AppError(
          'An approved Parking Owner account already exists with this email or mobile number. Please log in to your Owner Dashboard.',
          409,
          'OWNER_ALREADY_EXISTS',
        );
      }
    }

    // 2. Resolve or create Applicant User
    let applicantUser = await (UserModel as unknown as mongoose.Model<User>).findOne({
      $or: [{ email }, { mobileNumber: phone }],
    }).exec();

    if (!applicantUser) {
      const customerRole = await (RoleModel as unknown as mongoose.Model<Role>).findOne({ roleCode: 'CUSTOMER' }).lean().exec();
      if (!customerRole) {
        throw new AppError('Default applicant role was not found in system.', 500, 'ROLE_NOT_FOUND');
      }

      applicantUser = await (UserModel as unknown as mongoose.Model<User>).create({
        fullName: input.ownerName.trim(),
        email,
        mobileNumber: phone,
        roleId: customerRole._id,
        accountStatus: 'Pending Verification',
        emailVerified: false,
        mobileVerified: false,
      });
    }

    // 3. Check for existing active application for this applicant (UQ_ApplicantActiveApplication)
    const existingActiveApp = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({
        applicantId: applicantUser._id,
        applicationStatus: { $in: activeApplicationStatuses },
      })
      .exec();

    let application: mongoose.HydratedDocument<OwnerApplication>;
    const config = await this.getRegistrationConfig();

    if (existingActiveApp) {
      if (existingActiveApp.applicationStatus === 'Pending Review' || existingActiveApp.applicationStatus === 'Submitted') {
        throw new AppError(
          `You already have an active application (${existingActiveApp.applicationReference}) currently under review. Please track its status on the tracking portal.`,
          409,
          'ACTIVE_APPLICATION_EXISTS',
        );
      }

      // Existing application is in Draft: update draft details
      existingActiveApp.businessName = input.businessName.trim();
      existingActiveApp.businessType = input.businessType as OwnerApplication['businessType'];
      existingActiveApp.businessAddress = input.businessAddress.trim();
      existingActiveApp.city = input.city.trim();
      existingActiveApp.state = input.state.trim();
      existingActiveApp.postalCode = input.postalCode.trim();
      existingActiveApp.parkingCapacity = Number(input.parkingCapacity);
      existingActiveApp.businessDescription = input.businessDescription.trim();
      existingActiveApp.ownerName = input.ownerName.trim();
      existingActiveApp.businessEmail = email;
      existingActiveApp.businessPhone = phone;
      existingActiveApp.governmentIdType = input.governmentIdType as OwnerApplication['governmentIdType'];
      existingActiveApp.governmentIdNumber = input.governmentIdNumber.trim();
      existingActiveApp.identityProofUrl = input.identityProofUrl.trim();
      existingActiveApp.businessLicenseUrl = input.businessLicenseUrl.trim();
      existingActiveApp.propertyProofUrl = input.propertyProofUrl.trim();
      existingActiveApp.parkingImageUrls = Array.isArray(input.parkingImageUrls) ? input.parkingImageUrls : [];
      existingActiveApp.termsAccepted = true;
      existingActiveApp.registrationFeeAmount = config.ownerRegistrationFee;

      application = await existingActiveApp.save();
    } else {
      // Create new Draft Application
      const appRef = `APP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>).create({
        applicantId: applicantUser._id,
        applicationReference: appRef,
        businessName: input.businessName.trim(),
        businessType: input.businessType as OwnerApplication['businessType'],
        businessAddress: input.businessAddress.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        postalCode: input.postalCode.trim(),
        parkingCapacity: Number(input.parkingCapacity),
        businessDescription: input.businessDescription.trim(),
        ownerName: input.ownerName.trim(),
        businessEmail: email,
        businessPhone: phone,
        governmentIdType: input.governmentIdType as OwnerApplication['governmentIdType'],
        governmentIdNumber: input.governmentIdNumber.trim(),
        identityProofUrl: input.identityProofUrl.trim(),
        businessLicenseUrl: input.businessLicenseUrl.trim(),
        propertyProofUrl: input.propertyProofUrl.trim(),
        parkingImageUrls: Array.isArray(input.parkingImageUrls) ? input.parkingImageUrls : [],
        termsAccepted: true,
        emailOtpVerified: false,
        mobileOtpVerified: false,
        registrationFeeAmount: config.ownerRegistrationFee,
        applicationStatus: 'Draft',
      });

      // Canonical Audit Log
      await auditService.log({
        userId: applicantUser._id,
        actionCode: 'OWNER_APPLICATION_CREATED',
        module: 'Owner Application Management',
        actionTitle: 'Owner Registration Application Created',
        description: `Draft application ${application.applicationReference} initiated for "${application.businessName}".`,
        targetCollection: 'ownerApplications',
        targetDocumentId: application._id as mongoose.Types.ObjectId,
        metadata: {
          applicationReference: application.applicationReference,
          businessName: application.businessName,
        },
        ipAddress: input.ipAddress,
        deviceInfo: input.userAgent,
        actionStatus: 'Success',
      });
    }

    // 4. Trigger Email OTP (if an OTP was recently sent within cooldown, keep the active OTP)
    try {
      await otpService.requestOtp({
        email,
        verificationType: 'REGISTRATION_EMAIL',
        purposeLabel: 'Parking Owner Registration — Email Verification',
      });
    } catch (otpErr) {
      if (otpErr instanceof AppError && otpErr.errorCode === 'E030') {
        // Cooldown active, existing OTP is still valid for this registration
      } else {
        throw otpErr;
      }
    }

    return {
      applicationReference: application.applicationReference,
      businessEmail: application.businessEmail,
      businessPhone: application.businessPhone,
      registrationFeeAmount: application.registrationFeeAmount,
      status: application.applicationStatus,
      message: 'Registration details saved. Verification OTP sent to your email address.',
    };
  }

  /**
   * Request Email OTP challenge for existing draft application.
   */
  public async requestEmailOtp(applicationReference: string): Promise<{ message: string; cooldownSeconds: number }> {
    const app = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicationReference })
      .exec();

    if (!app) throw new AppError('Owner application not found.', 404, 'NOT_FOUND');
    if (app.applicationStatus !== 'Draft') {
      throw new AppError('Application is already submitted and cannot be modified.', 400, 'INVALID_STATUS');
    }

    return otpService.requestOtp({
      email: app.businessEmail,
      verificationType: 'REGISTRATION_EMAIL',
      purposeLabel: 'Parking Owner Registration — Email Verification',
    });
  }

  /**
   * Verify Email OTP. Upon success, marks emailOtpVerified and triggers Mobile OTP per V1 rule.
   */
  public async verifyEmailOtp(
    applicationReference: string,
    otp: string,
  ): Promise<{ emailOtpVerified: boolean; mobileOtpSent: boolean; message: string }> {
    const app = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicationReference })
      .exec();

    if (!app) throw new AppError('Owner application not found.', 404, 'NOT_FOUND');
    if (app.applicationStatus !== 'Draft') {
      throw new AppError('Application is already submitted.', 400, 'INVALID_STATUS');
    }

    await otpService.verifyOtp({
      email: app.businessEmail,
      verificationType: 'REGISTRATION_EMAIL',
      otp,
    });

    app.emailOtpVerified = true;
    await app.save();

    // Per V1 specification: Mobile OTP is also delivered to registered email
    // with explicit labeling identifying it as the mobile verification challenge.
    try {
      await otpService.requestOtp({
        email: app.businessEmail,
        mobileNumber: app.businessPhone,
        verificationType: 'REGISTRATION_MOBILE',
        purposeLabel: `Mobile Number Verification (${app.businessPhone}) [Owner Registration]`,
      });
    } catch (mobileOtpErr) {
      console.error('[OwnerService] Auto Mobile OTP dispatch notice:', mobileOtpErr);
    }

    return {
      emailOtpVerified: true,
      mobileOtpSent: true,
      message: 'Email verified successfully. Mobile verification OTP sent to your email.',
    };
  }

  /**
   * Request Mobile OTP challenge for draft application. Requires Email OTP to be verified first.
   */
  public async requestMobileOtp(applicationReference: string): Promise<{ message: string; cooldownSeconds: number }> {
    const app = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicationReference })
      .exec();

    if (!app) throw new AppError('Owner application not found.', 404, 'NOT_FOUND');
    if (app.applicationStatus !== 'Draft') {
      throw new AppError('Application is already submitted.', 400, 'INVALID_STATUS');
    }

    if (!app.emailOtpVerified) {
      throw new AppError('You must verify your email OTP before requesting mobile verification.', 400, 'EMAIL_NOT_VERIFIED');
    }

    return otpService.requestOtp({
      email: app.businessEmail,
      mobileNumber: app.businessPhone,
      verificationType: 'REGISTRATION_MOBILE',
      purposeLabel: `Mobile Number Verification (${app.businessPhone}) [Owner Registration]`,
    });
  }

  /**
   * Verify Mobile OTP. Upon success, unlocks payment access.
   */
  public async verifyMobileOtp(
    applicationReference: string,
    otp: string,
  ): Promise<{ emailOtpVerified: boolean; mobileOtpVerified: boolean; message: string }> {
    const app = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicationReference })
      .exec();

    if (!app) throw new AppError('Owner application not found.', 404, 'NOT_FOUND');
    if (app.applicationStatus !== 'Draft') {
      throw new AppError('Application is already submitted.', 400, 'INVALID_STATUS');
    }

    if (!app.emailOtpVerified) {
      throw new AppError('Email verification must be completed first.', 400, 'EMAIL_NOT_VERIFIED');
    }

    await otpService.verifyOtp({
      email: app.businessEmail,
      mobileNumber: app.businessPhone,
      verificationType: 'REGISTRATION_MOBILE',
      otp,
    });

    app.mobileOtpVerified = true;
    await app.save();

    return {
      emailOtpVerified: true,
      mobileOtpVerified: true,
      message: 'Mobile number verified successfully. Platform registration fee payment is now unlocked.',
    };
  }

  /**
   * Create Razorpay Order.
   * STRICT SECURITY: Locked until both Email and Mobile OTPs are verified.
   */
  public async createPaymentOrder(applicationReference: string): Promise<{
    orderId: string;
    amountPaise: number;
    amount: number;
    currency: string;
    keyId: string;
    applicationReference: string;
    businessName: string;
    ownerName: string;
    email: string;
    contact: string;
  }> {
    const app = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicationReference })
      .exec();

    if (!app) throw new AppError('Owner application not found.', 404, 'NOT_FOUND');

    if (!app.emailOtpVerified || !app.mobileOtpVerified) {
      throw new AppError(
        'Payment is locked. Both Email OTP and Mobile OTP must be successfully verified before initiating payment.',
        403,
        'PAYMENT_LOCKED',
      );
    }

    if (app.applicationStatus !== 'Draft') {
      throw new AppError('Application is not in Draft state.', 400, 'INVALID_APPLICATION_STATUS');
    }

    const feeAmount = app.registrationFeeAmount || 999;
    const amountPaise = feeAmount * 100;

    // Create Razorpay Order
    const order = await razorpayService.createOrder({
      amountPaise,
      currency: 'INR',
      receipt: app.applicationReference,
      notes: {
        ownerApplicationId: app._id.toString(),
        applicantId: app.applicantId.toString(),
        businessName: app.businessName,
      },
    });

    // Create or update centralized Payment document
    const paymentRef = `PAY-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const payment = await (PaymentModel as mongoose.Model<Payment>).create({
      paymentReference: paymentRef,
      ownerApplicationId: app._id,
      ownerId: app.applicantId,
      paymentType: 'Parking Owner Registration Fee',
      paymentTypeCode: 'OWNER_REGISTRATION',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PENDING',
      gatewayOrderId: order.id,
      amount: feeAmount,
      additionalCharges: 0,
      refundAmount: 0,
      remarks: 'One-time Parking Owner registration fee processed through Razorpay Test Mode.',
    });

    app.paymentId = payment._id as mongoose.Types.ObjectId;
    await app.save();

    return {
      orderId: order.id,
      amountPaise,
      amount: feeAmount,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
      applicationReference: app.applicationReference,
      businessName: app.businessName,
      ownerName: app.ownerName,
      email: app.businessEmail,
      contact: app.businessPhone,
    };
  }

  /**
   * Verify Razorpay Payment.
   * Server-side signature validation. Sets payment to SUCCESSFUL and application to Pending Review.
   * Does NOT activate owner account or grant Owner Dashboard access.
   */
  public async verifyPayment(input: VerifyPaymentInput): Promise<{
    applicationReference: string;
    paymentReference: string;
    paymentId: string;
    amount: number;
    applicationStatus: string;
    paymentStatus: string;
    submittedAt: Date;
    businessName: string;
    ownerName: string;
  }> {
    const app = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicationReference: input.applicationReference })
      .exec();

    if (!app) throw new AppError('Owner application not found.', 404, 'NOT_FOUND');

    if (!app.emailOtpVerified || !app.mobileOtpVerified) {
      throw new AppError('Unauthorized: Application OTPs are not verified.', 403, 'PAYMENT_LOCKED');
    }

    // Idempotency: If already submitted and paid
    if (app.applicationStatus === 'Pending Review' && app.paymentId) {
      const existingPayment = await (PaymentModel as mongoose.Model<Payment>).findById(app.paymentId).exec();
      if (existingPayment && existingPayment.paymentStatus === 'SUCCESSFUL') {
        return {
          applicationReference: app.applicationReference,
          paymentReference: existingPayment.paymentReference,
          paymentId: existingPayment.gatewayPaymentId || input.razorpay_payment_id,
          amount: app.registrationFeeAmount,
          applicationStatus: app.applicationStatus,
          paymentStatus: existingPayment.paymentStatus,
          submittedAt: app.submittedAt || app.createdAt,
          businessName: app.businessName,
          ownerName: app.ownerName,
        };
      }
    }

    // Server-side cryptographic HMAC-SHA256 signature verification
    const isValidSignature = razorpayService.verifySignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });

    if (!isValidSignature) {
      throw new AppError(
        'Payment signature verification failed. Potential payment tampering detected.',
        400,
        'PAYMENT_SIGNATURE_INVALID',
      );
    }

    // Update Centralized Payment Record
    let payment = await (PaymentModel as mongoose.Model<Payment>)
      .findOne({ gatewayOrderId: input.razorpay_order_id })
      .exec();

    if (!payment && app.paymentId) {
      payment = await (PaymentModel as mongoose.Model<Payment>).findById(app.paymentId).exec();
    }

    const txnId = `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    if (payment) {
      payment.paymentStatus = 'SUCCESSFUL';
      payment.gatewayPaymentId = input.razorpay_payment_id;
      payment.gatewaySignature = input.razorpay_signature;
      payment.transactionId = txnId;
      payment.paymentDate = new Date();
      await payment.save();
    } else {
      const paymentRef = `PAY-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      payment = await (PaymentModel as mongoose.Model<Payment>).create({
        paymentReference: paymentRef,
        ownerApplicationId: app._id,
        ownerId: app.applicantId,
        paymentType: 'Parking Owner Registration Fee',
        paymentTypeCode: 'OWNER_REGISTRATION',
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'SUCCESSFUL',
        gatewayOrderId: input.razorpay_order_id,
        gatewayPaymentId: input.razorpay_payment_id,
        gatewaySignature: input.razorpay_signature,
        transactionId: txnId,
        amount: app.registrationFeeAmount,
        additionalCharges: 0,
        refundAmount: 0,
        paymentDate: new Date(),
        remarks: 'One-time Parking Owner registration fee processed through Razorpay Test Mode.',
      });
    }

    // Update Application Status to Pending Review
    app.applicationStatus = 'Pending Review';
    app.submittedAt = new Date();
    app.paymentId = payment._id as mongoose.Types.ObjectId;
    await app.save();

    // Mark Applicant User verified
    await (UserModel as mongoose.Model<User>).findByIdAndUpdate(app.applicantId, {
      emailVerified: true,
      mobileVerified: true,
      accountStatus: 'Pending Approval',
    });

    // Invalidate/revoke all active sessions for this applicant user to enforce immediate logout
    await (SessionModel as mongoose.Model<Session>).updateMany(
      { userId: app.applicantId, sessionStatus: 'Active' },
      {
        sessionStatus: 'Revoked',
        logoutReason: 'Security Action',
      },
    );

    // Lifecycle Notification: Parking Owner Application Submitted
    try {
      await notificationService.createNotification({
        userId: app.applicantId,
        notificationType: 'Parking Owner Registration',
        eventType: 'Parking Owner Application Submitted',
        title: 'Parking Owner Application Submitted',
        message: `Your parking owner application for "${app.businessName}" (Reference: ${app.applicationReference}) has been submitted successfully and is pending administrator review.`,
        priority: 'High',
        actionUrl: '/owner/registration-status',
        metadata: {
          applicationReference: app.applicationReference,
          businessName: app.businessName,
          status: 'Pending Review',
        },
      });

      // Also notify Administrators in real-time
      await notificationService.notifyAdmins({
        title: 'New Parking Owner Registration',
        message: `Applicant ${app.ownerName} submitted registration application for "${app.businessName}" (${app.applicationReference}) with completed fee payment.`,
        notificationType: 'Parking Owner Registration',
        eventType: 'Parking Owner Application Submitted',
        priority: 'High',
        actionUrl: '/admin/owners',
        metadata: {
          applicationReference: app.applicationReference,
          businessName: app.businessName,
          applicantId: app.applicantId.toString(),
          status: 'Pending Review',
        },
      });
    } catch (notifErr) {
      console.error('[OwnerService] In-app notification creation error:', notifErr);
    }

    // Confirmation Email
    try {
      await emailService.sendEmail({
        to: app.businessEmail,
        subject: `ParkEase — Registration Fee Received (${app.applicationReference})`,
        text: `Dear ${app.ownerName},\n\nWe have received your ₹${app.registrationFeeAmount} registration fee payment (Payment ID: ${input.razorpay_payment_id}) for "${app.businessName}".\n\nYour application reference is ${app.applicationReference}. Your registration is now Under Review by our platform administrators.\n\nYou can track the live review status anytime at /owner/registration-status.\n\nThank you,\nThe ParkEase Team`,
        emailType: 'OWNER_REGISTRATION',
      });
    } catch (emailErr) {
      console.error('[OwnerService] Confirmation email send error:', emailErr);
    }

    // Canonical Audit Log
    await auditService.log({
      userId: app.applicantId,
      actionCode: 'OWNER_APPLICATION_PAYMENT_SUCCESSFUL',
      module: 'Payment Management',
      actionTitle: 'Owner Registration Payment Successful',
      description: `Registration fee ₹${app.registrationFeeAmount} verified via Razorpay for application ${app.applicationReference}. Application submitted to Pending Review queue.`,
      targetCollection: 'ownerApplications',
      targetDocumentId: app._id as mongoose.Types.ObjectId,
      beforeData: { applicationStatus: 'Draft' },
      afterData: { applicationStatus: 'Pending Review', paymentStatus: 'SUCCESSFUL', paymentReference: payment.paymentReference },
      metadata: {
        applicationReference: app.applicationReference,
        paymentReference: payment.paymentReference,
        gatewayPaymentId: input.razorpay_payment_id,
        amount: app.registrationFeeAmount,
      },
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    return {
      applicationReference: app.applicationReference,
      paymentReference: payment.paymentReference,
      paymentId: input.razorpay_payment_id,
      amount: app.registrationFeeAmount,
      applicationStatus: app.applicationStatus,
      paymentStatus: payment.paymentStatus,
      submittedAt: app.submittedAt,
      businessName: app.businessName,
      ownerName: app.ownerName,
    };
  }

  /**
   * Securely retrieve the authenticated owner's registration application documents,
   * verification status, canonical labels, and masked government identification.
   */
  public async getOwnerRegistrationDocuments(userId: string): Promise<OwnerRegistrationDocumentsResult> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID format.', 400, 'INVALID_USER_ID');
    }

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicantId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    if (!application) {
      return {
        hasApplication: false,
        documents: [],
        photos: {
          category: 'parkingImage',
          label: 'Parking Facility Photos',
          uploadDate: null,
          verificationStatus: 'Not Submitted',
          items: [],
          count: 0,
        },
      };
    }

    const uploadDate = application.submittedAt || application.createdAt;
    const verificationStatus = application.applicationStatus;

    const documents: OwnerDocumentItem[] = [
      {
        category: 'identityProof',
        label: 'Government ID Proof',
        url: application.identityProofUrl,
        fileName: path.basename(application.identityProofUrl || ''),
        documentType: getDocType(application.identityProofUrl || ''),
        uploadDate,
        verificationStatus,
        hasFile: !!application.identityProofUrl,
        governmentIdType: application.governmentIdType,
        maskedIdNumber: maskGovernmentId(application.governmentIdType, application.governmentIdNumber),
      },
      {
        category: 'businessLicense',
        label: 'Business Registration / Licence',
        url: application.businessLicenseUrl,
        fileName: path.basename(application.businessLicenseUrl || ''),
        documentType: getDocType(application.businessLicenseUrl || ''),
        uploadDate,
        verificationStatus,
        hasFile: !!application.businessLicenseUrl,
      },
      {
        category: 'propertyProof',
        label: 'Property Ownership / Rental Proof',
        url: application.propertyProofUrl,
        fileName: path.basename(application.propertyProofUrl || ''),
        documentType: getDocType(application.propertyProofUrl || ''),
        uploadDate,
        verificationStatus,
        hasFile: !!application.propertyProofUrl,
      },
    ];

    const photoItems: OwnerPhotoItem[] = (application.parkingImageUrls || []).map((url, index) => ({
      index,
      fileName: path.basename(url),
      url,
      documentType: 'Image',
    }));

    return {
      hasApplication: true,
      applicationReference: application.applicationReference,
      businessName: application.businessName,
      businessType: application.businessType,
      businessAddress: application.businessAddress,
      city: application.city,
      state: application.state,
      postalCode: application.postalCode,
      parkingCapacity: application.parkingCapacity,
      applicationStatus: application.applicationStatus,
      adminRemarks: application.adminRemarks || null,
      rejectionReason: application.rejectionReason || null,
      submittedAt: application.submittedAt || null,
      reviewedAt: application.reviewedAt || null,
      documents,
      photos: {
        category: 'parkingImage',
        label: 'Parking Facility Photos',
        uploadDate,
        verificationStatus,
        items: photoItems,
        count: photoItems.length,
      },
    };
  }

  /**
   * Securely stream a registration document belonging to the authenticated owner.
   * Strictly verifies applicant ownership and prevents path traversal.
   */
  public async getOwnerRegistrationDocumentFile(
    userId: string,
    docType: string,
    index?: number,
  ): Promise<OwnerDocumentFileResult> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID format.', 400, 'INVALID_USER_ID');
    }

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({ applicantId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    if (!application) {
      throw new AppError('Owner registration application not found for this account.', 404, 'APPLICATION_NOT_FOUND');
    }

    let targetUrlOrPath: string | undefined;

    switch (docType) {
      case 'identityProof':
        targetUrlOrPath = application.identityProofUrl;
        break;
      case 'businessLicense':
        targetUrlOrPath = application.businessLicenseUrl;
        break;
      case 'propertyProof':
        targetUrlOrPath = application.propertyProofUrl;
        break;
      case 'parkingImage': {
        const imgIndex = typeof index === 'number' ? index : 0;
        if (Array.isArray(application.parkingImageUrls) && application.parkingImageUrls[imgIndex]) {
          targetUrlOrPath = application.parkingImageUrls[imgIndex];
        }
        break;
      }
      default:
        throw new AppError(`Invalid document category: ${docType}`, 400, 'INVALID_DOCUMENT_TYPE');
    }

    if (!targetUrlOrPath || !targetUrlOrPath.trim()) {
      throw new AppError('Requested document has not been uploaded.', 404, 'DOCUMENT_NOT_FOUND');
    }

    const trimmed = targetUrlOrPath.trim();

    // 1. Remote URL handling
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return {
        isRemote: true,
        url: trimmed,
        filePath: '',
        mimeType: '',
        fileName: path.basename(trimmed),
      };
    }

    // 2. Local file path resolution & path traversal safety
    const uploadsRoot = fs.existsSync(path.resolve(process.cwd(), 'server', 'uploads'))
      ? path.resolve(process.cwd(), 'server', 'uploads')
      : path.resolve(process.cwd(), 'uploads');

    const ownerUploadsDir = path.resolve(uploadsRoot, 'owner');

    let relPath = trimmed;
    if (relPath.startsWith('server/uploads/')) {
      relPath = relPath.slice('server/uploads/'.length);
    } else if (relPath.startsWith('uploads/')) {
      relPath = relPath.slice('uploads/'.length);
    } else if (relPath.startsWith('/uploads/')) {
      relPath = relPath.slice('/uploads/'.length);
    }

    let resolvedFile = path.resolve(uploadsRoot, relPath);

    // If not found directly, check directly inside ownerUploadsDir
    if (!fs.existsSync(resolvedFile)) {
      const fallbackFile = path.resolve(ownerUploadsDir, path.basename(trimmed));
      if (fs.existsSync(fallbackFile)) {
        resolvedFile = fallbackFile;
      }
    }

    // Path traversal check
    if (!resolvedFile.startsWith(uploadsRoot)) {
      throw new AppError('Access denied: Invalid file path traversal attempt.', 403, 'FORBIDDEN');
    }

    if (!fs.existsSync(resolvedFile)) {
      throw new AppError('Document file not found on storage server.', 404, 'DOCUMENT_NOT_FOUND');
    }

    const ext = path.extname(resolvedFile).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.svg') mimeType = 'image/svg+xml';

    return {
      isRemote: false,
      filePath: resolvedFile,
      mimeType,
      fileName: path.basename(resolvedFile),
    };
  }

  /**
   * Retrieves aggregated dashboard metrics for an authenticated owner.
   * Optionally filtered by a specific parkingLotId (with strict ownership check).
   */
  public async getOwnerDashboardStats(
    ownerId: string,
    parkingLotId?: string,
  ): Promise<OwnerDashboardStatsResult> {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw new AppError('Invalid owner ID format.', 400, 'INVALID_OWNER_ID');
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // 1. Reconcile live booking statuses across system (expired -> No Show, overdue -> Overstay)
    try {
      await customerBookingService.reconcileBookingStatuses();
    } catch (reconcileErr) {
      console.warn('Auto-reconciliation encountered a warning:', reconcileErr);
    }

    // 2. Determine target lots and strictly validate ownership if specific lot is requested
    let targetLotIds: mongoose.Types.ObjectId[] = [];
    if (parkingLotId && parkingLotId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
        throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_PARKING_LOT_ID');
      }
      const targetLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
        .findById(parkingLotId)
        .select('ownerId')
        .lean()
        .exec();

      if (!targetLot) {
        throw new AppError('Parking facility not found.', 404, 'NOT_FOUND');
      }

      const lotOwnerId = (targetLot.ownerId as { _id?: mongoose.Types.ObjectId })?._id?.toString() || targetLot.ownerId?.toString();
      if (lotOwnerId !== ownerId) {
        throw new AppError('Access denied: You do not own this parking facility.', 403, 'FORBIDDEN');
      }
      targetLotIds = [new mongoose.Types.ObjectId(parkingLotId)];
    }

    // 3. Fetch all official parking lots owned by this owner
    const allOwnerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: ownerObjectId })
      .select(
        '_id parkingName city state parkingStatus totalFloors totalSlots availableSlots occupiedSlots reservedSlots occupancyPercentage hourlyRate',
      )
      .sort({ parkingName: 1 })
      .lean()
      .exec();

    const parkingLotsSummary = allOwnerLots.map((lot) => ({
      _id: (lot as unknown as { _id: mongoose.Types.ObjectId })._id.toString(),
      parkingName: lot.parkingName,
      city: lot.city,
      state: lot.state,
      parkingStatus: lot.parkingStatus,
      totalFloors: lot.totalFloors || 1,
      totalSlots: lot.totalSlots || 0,
      availableSlots: lot.availableSlots || 0,
      occupiedSlots: lot.occupiedSlots || 0,
      reservedSlots: lot.reservedSlots || 0,
      occupancyPercentage: lot.occupancyPercentage || 0,
      hourlyRate: lot.hourlyRate || 0,
    }));

    // If owner requested all lots but has none, return zeroes
    if (targetLotIds.length === 0) {
      if (allOwnerLots.length === 0) {
        return {
          totalSlots: 0,
          availableSlots: 0,
          occupiedSlots: 0,
          reservedSlots: 0,
          occupancyPercentage: 0,
          todayBookingsCount: 0,
          todayRevenue: 0,
          activeSecurityStaffCount: 0,
          recentBookings: [],
          parkingLotsSummary: [],
        };
      }
      targetLotIds = allOwnerLots.map((l) => (l as unknown as { _id: mongoose.Types.ObjectId })._id);
    }

    // 4. Calculate total slot counts across target lots
    const activeTargetLots = allOwnerLots.filter((l) =>
      targetLotIds.some((tid) => tid.equals((l as unknown as { _id: mongoose.Types.ObjectId })._id)),
    );

    let totalSlots = 0;
    let availableSlots = 0;
    let occupiedSlots = 0;
    let reservedSlots = 0;

    for (const lot of activeTargetLots) {
      totalSlots += lot.totalSlots || 0;
      availableSlots += lot.availableSlots || 0;
      occupiedSlots += lot.occupiedSlots || 0;
      reservedSlots += lot.reservedSlots || 0;
    }
    const occupancyPercentage =
      totalSlots > 0 ? Math.min(100, Math.round((occupiedSlots / totalSlots) * 100)) : 0;

    // 5. Today's Bookings Count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayBookingsCount = await (BookingModel as mongoose.Model<Booking>).countDocuments({
      parkingLotId: { $in: targetLotIds },
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    });

    // 6. Today's Net Revenue (amount - refundAmount) for paid bookings today
    const revenueAggregation = await (PaymentModel as mongoose.Model<Payment>).aggregate([
      {
        $match: {
          parkingLotId: { $in: targetLotIds },
          paymentTypeCode: 'BOOKING',
          paymentStatus: { $in: ['SUCCESSFUL', 'REFUNDED'] },
          createdAt: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: null,
          netRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'SUCCESSFUL'] },
                { $subtract: ['$amount', { $ifNull: ['$refundAmount', 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const todayRevenue =
      revenueAggregation.length > 0 && revenueAggregation[0].netRevenue > 0
        ? Math.round(revenueAggregation[0].netRevenue * 100) / 100
        : 0;

    // 7. Active Security Staff Count
    const activeSecurityStaffCount = await (
      SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>
    ).countDocuments({
      ownerId: ownerObjectId,
      assignmentStatus: 'Active',
      parkingLotId: { $in: targetLotIds },
    });

    // 8. Recent Bookings (limit 10)
    const rawRecentBookings = await (BookingModel as mongoose.Model<Booking>)
      .find({
        parkingLotId: { $in: targetLotIds },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customerId', 'fullName email mobileNumber')
      .populate('vehicleId', 'vehicleNumber vehicleType')
      .populate('currentSlotId', 'slotNumber slotLabel')
      .populate('parkingLotId', 'parkingName city')
      .lean()
      .exec();

    const recentBookings = rawRecentBookings.map((b) => {
      const bObj = b as unknown as Record<string, unknown>;
      const customer = bObj.customerId as { fullName?: string; email?: string; mobileNumber?: string } | undefined;
      const vehicle = bObj.vehicleId as { vehicleNumber?: string; vehicleType?: string } | undefined;
      const slot = bObj.currentSlotId as { slotNumber?: string; slotLabel?: string } | undefined;
      const lot = bObj.parkingLotId as { _id?: mongoose.Types.ObjectId; parkingName?: string; city?: string } | undefined;

      return {
        _id: (bObj._id as mongoose.Types.ObjectId).toString(),
        bookingReference: String(bObj.bookingReference || ''),
        bookingStatus: String(bObj.bookingStatus || 'Confirmed'),
        bookingType: String(bObj.bookingType || 'ONLINE'),
        scheduledEntryTime: new Date(bObj.scheduledEntryTime as string | Date),
        scheduledExitTime: new Date(bObj.scheduledExitTime as string | Date),
        actualEntryTime: bObj.actualEntryTime ? new Date(bObj.actualEntryTime as string | Date) : null,
        actualExitTime: bObj.actualExitTime ? new Date(bObj.actualExitTime as string | Date) : null,
        totalAmount: Number(bObj.totalAmount || 0),
        createdAt: new Date(bObj.createdAt as string | Date),
        customer: customer
          ? {
              fullName: customer.fullName || 'Customer',
              email: customer.email || '',
              mobileNumber: customer.mobileNumber,
            }
          : null,
        vehicle: vehicle
          ? {
              vehicleNumber: vehicle.vehicleNumber || 'Unknown',
              vehicleType: vehicle.vehicleType || 'Car',
            }
          : null,
        slot: slot
          ? {
              slotNumber: slot.slotNumber || '',
              slotLabel: slot.slotLabel || slot.slotNumber || '',
            }
          : null,
        parkingLot: lot
          ? {
              _id: lot._id ? lot._id.toString() : '',
              parkingName: lot.parkingName || 'Facility',
              city: lot.city || '',
            }
          : null,
      };
    });

    return {
      totalSlots,
      availableSlots,
      occupiedSlots,
      reservedSlots,
      occupancyPercentage,
      todayBookingsCount,
      todayRevenue,
      activeSecurityStaffCount,
      recentBookings,
      parkingLotsSummary,
    };
  }

  /**
   * Updates permitted business and operational information for an owner-owned parking lot.
   * Strictly forbids structural modifications (floors, zones, slots, lanes, boundaries, coordinates, ownerId).
   */
  public async updateOwnerParkingLotBusinessInfo(
    ownerId: string,
    parkingLotId: string,
    updateData: OwnerParkingLotBusinessUpdate,
  ): Promise<ParkingLot> {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw new AppError('Invalid owner ID format.', 400, 'INVALID_OWNER_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_PARKING_LOT_ID');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(parkingLotId);
    if (!lot) {
      throw new AppError('Parking lot not found.', 404, 'PARKING_LOT_NOT_FOUND');
    }

    // Ownership Enforcement
    const lotOwnerId = (lot.ownerId as { _id?: mongoose.Types.ObjectId })?._id?.toString() || lot.ownerId?.toString();
    if (lotOwnerId !== ownerId) {
      throw new AppError('Access denied: You do not own this parking facility.', 403, 'FORBIDDEN');
    }

    // Validate and sanitize permitted business fields ONLY:
    const updates: Record<string, unknown> = {};

    if (updateData.description !== undefined) {
      if (typeof updateData.description === 'string' && updateData.description.length > 1000) {
        throw new AppError('Description cannot exceed 1000 characters.', 400, 'INVALID_DESCRIPTION');
      }
      updates.description = updateData.description;
    }

    if (updateData.contactNumber !== undefined) {
      if (typeof updateData.contactNumber !== 'string' || !updateData.contactNumber.trim()) {
        throw new AppError('Contact number cannot be empty.', 400, 'INVALID_CONTACT');
      }
      updates.contactNumber = updateData.contactNumber.trim();
    }

    if (updateData.supportEmail !== undefined) {
      if (updateData.supportEmail && typeof updateData.supportEmail === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updateData.supportEmail.trim())) {
          throw new AppError('Invalid support email address.', 400, 'INVALID_EMAIL');
        }
        updates.supportEmail = updateData.supportEmail.trim();
      } else {
        updates.supportEmail = null;
      }
    }

    if (updateData.openingTime !== undefined) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(updateData.openingTime)) {
        throw new AppError('Opening time must be in HH:mm format (00:00 to 23:59).', 400, 'INVALID_TIME');
      }
      updates.openingTime = updateData.openingTime;
    }

    if (updateData.closingTime !== undefined) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(updateData.closingTime)) {
        throw new AppError('Closing time must be in HH:mm format (00:00 to 23:59).', 400, 'INVALID_TIME');
      }
      updates.closingTime = updateData.closingTime;
    }

    if (updateData.isOpen24Hours !== undefined) {
      updates.isOpen24Hours = Boolean(updateData.isOpen24Hours);
      if (updates.isOpen24Hours) {
        updates.openingTime = '00:00';
        updates.closingTime = '23:59';
      }
    }

    if (updateData.hourlyRate !== undefined) {
      const rate = Number(updateData.hourlyRate);
      if (isNaN(rate) || rate < 0) {
        throw new AppError('Hourly rate must be a non-negative number.', 400, 'INVALID_HOURLY_RATE');
      }
      updates.hourlyRate = rate;
    }

    if (updateData.gracePeriodMinutes !== undefined) {
      const grace = Number(updateData.gracePeriodMinutes);
      if (isNaN(grace) || grace < 0 || grace > 120) {
        throw new AppError('Grace period must be between 0 and 120 minutes.', 400, 'INVALID_GRACE_PERIOD');
      }
      updates.gracePeriodMinutes = grace;
    }

    if (updateData.amenities !== undefined) {
      if (!Array.isArray(updateData.amenities)) {
        throw new AppError('Amenities must be an array of strings.', 400, 'INVALID_AMENITIES');
      }
      const allowedAmenities = [
        'CCTV Surveillance',
        'Covered Parking',
        'EV Charging',
        'Disabled Parking',
        'Security Staff',
        'Car Wash',
        'Washroom',
        'Drinking Water',
        'Lift Access',
        'Fire Safety System',
      ];
      for (const amenity of updateData.amenities) {
        if (!allowedAmenities.includes(amenity)) {
          throw new AppError(`Invalid amenity: "${amenity}".`, 400, 'UNSUPPORTED_AMENITY');
        }
      }
      updates.amenities = updateData.amenities;
    }

    if (updateData.parkingStatus !== undefined) {
      const allowedStatuses = ['Active', 'Inactive', 'Under Maintenance', 'Temporarily Closed'];
      if (!allowedStatuses.includes(updateData.parkingStatus)) {
        throw new AppError(`Invalid parking status: "${updateData.parkingStatus}".`, 400, 'INVALID_STATUS');
      }
      if (updateData.parkingStatus === 'Active' && lot.layoutReviewStatus !== 'Owner Confirmed') {
        throw new AppError(
          'Facility cannot be activated until the parking layout is confirmed and approved by the owner.',
          400,
          'LAYOUT_NOT_CONFIRMED',
        );
      }
      updates.parkingStatus = updateData.parkingStatus;
    }

    if (updateData.parkingImages !== undefined && Array.isArray(updateData.parkingImages)) {
      updates.parkingImages = updateData.parkingImages.filter(
        (img) => typeof img === 'string' && img.trim().length > 0,
      );
    }

    // Apply permitted business updates only
    Object.assign(lot, updates);
    await lot.save();

    // Audit Log
    try {
      await auditService.log({
        actionCode: 'OWNER_PARKING_LOT_UPDATE',
        module: 'Parking Management',
        actionTitle: 'Owner Parking Lot Business Update',
        description: `Updated business information for ${lot.parkingName}`,
        targetCollection: 'parkingLots',
        targetDocumentId: lot._id,
        changedFields: updates,
        actionStatus: 'Success',
        userId: new mongoose.Types.ObjectId(ownerId),
      });
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr);
    }

    return lot.toObject() as unknown as ParkingLot;
  }

  /**
   * Retrieves official slots across one or all parking lots owned by the authenticated owner.
   * Supports filtering by parking lot, floor, zone, operational status, slot type, and search.
   */
  public async getOwnerSlots(
    ownerId: string,
    params: {
      parkingLotId?: string | undefined;
      floorId?: string | undefined;
      zoneId?: string | undefined;
      status?: string | undefined;
      slotType?: string | undefined;
      vehicleType?: string | undefined;
      search?: string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    },
  ): Promise<OwnerSlotsResult> {
    if (!ownerId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id parkingName city state parkingStatus')
      .lean();

    if (ownerLots.length === 0) {
      return {
        slots: [],
        total: 0,
        page: 1,
        limit: params.limit || 50,
        pages: 0,
        summary: {
          total: 0,
          available: 0,
          occupied: 0,
          reserved: 0,
          maintenance: 0,
        },
      };
    }

    const ownerLotIds = ownerLots.map((l) => l._id);

    // If specific parkingLotId requested, enforce ownership
    let targetLotId: mongoose.Types.ObjectId | undefined;
    if (params.parkingLotId) {
      if (!mongoose.Types.ObjectId.isValid(params.parkingLotId)) {
        throw new AppError('Invalid parking lot ID.', 400, 'INVALID_ID');
      }
      const isOwned = ownerLotIds.some((id) => id.toString() === params.parkingLotId);
      if (!isOwned) {
        throw new AppError('Access denied: You do not own this parking facility.', 403, 'FORBIDDEN');
      }
      targetLotId = new mongoose.Types.ObjectId(params.parkingLotId);
    }

    const filter: Record<string, unknown> = {
      parkingLotId: targetLotId ? targetLotId : { $in: ownerLotIds },
    };

    if (params.floorId && mongoose.Types.ObjectId.isValid(params.floorId)) {
      filter.floorId = new mongoose.Types.ObjectId(params.floorId);
    }

    if (params.zoneId && mongoose.Types.ObjectId.isValid(params.zoneId)) {
      filter.zoneId = new mongoose.Types.ObjectId(params.zoneId);
    }

    if (params.status && params.status !== 'All') {
      const s = params.status.trim();
      if (s === 'Maintenance' || s === 'Under Maintenance' || s === 'Blocked') {
        filter.slotStatus = 'Under Maintenance';
      } else {
        filter.slotStatus = s;
      }
    }

    if (params.slotType && params.slotType !== 'All') {
      filter.slotType = params.slotType;
    }

    if (params.vehicleType && params.vehicleType !== 'All') {
      filter.supportedVehicleType = params.vehicleType;
    }

    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      filter.$or = [
        { slotNumber: { $regex: q, $options: 'i' } },
        { slotLabel: { $regex: q, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    // Summary counts filter scoped to selected lot or all owner lots
    const summaryFilter: Record<string, unknown> = {
      parkingLotId: targetLotId ? targetLotId : { $in: ownerLotIds },
    };
    if (filter.floorId) summaryFilter.floorId = filter.floorId;
    if (filter.zoneId) summaryFilter.zoneId = filter.zoneId;

    const [total, slots, summaryAggregation] = await Promise.all([
      (ParkingSlotModel as mongoose.Model<ParkingSlot>).countDocuments(filter),
      (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .find(filter)
        .populate('parkingLotId', 'parkingName address city state postalCode parkingStatus')
        .populate('floorId', 'floorName floorNumber floorStatus')
        .populate('zoneId', 'zoneName zoneCode vehicleType zoneStatus')
        .populate({
          path: 'currentBookingId',
          select: 'bookingReference customerId vehicleId scheduledEntryTime scheduledExitTime actualEntryTime bookingStatus',
          populate: [
            { path: 'customerId', select: 'fullName email mobileNumber' },
            { path: 'vehicleId', select: 'vehicleNumber vehicleType vehicleBrand vehicleModel' },
          ],
        })
        .sort({ slotNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      (ParkingSlotModel as mongoose.Model<ParkingSlot>).aggregate([
        { $match: summaryFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ['$slotStatus', 'Available'] }, 1, 0] } },
            occupied: { $sum: { $cond: [{ $eq: ['$slotStatus', 'Occupied'] }, 1, 0] } },
            reserved: { $sum: { $cond: [{ $eq: ['$slotStatus', 'Reserved'] }, 1, 0] } },
            maintenance: { $sum: { $cond: [{ $eq: ['$slotStatus', 'Under Maintenance'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const summaryStats = summaryAggregation[0] || {
      total: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
    };

    return {
      slots: slots as unknown as OwnerSlotsResult['slots'],
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
      summary: {
        total: summaryStats.total,
        available: summaryStats.available,
        occupied: summaryStats.occupied,
        reserved: summaryStats.reserved,
        maintenance: summaryStats.maintenance,
      },
    };
  }

  /**
   * Retrieves comprehensive details of a single slot, verifying owner ownership.
   */
  public async getOwnerSlotById(ownerId: string, slotId: string): Promise<any> {
    if (!ownerId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    if (!mongoose.Types.ObjectId.isValid(slotId)) {
      throw new AppError('Invalid parking slot ID format.', 400, 'INVALID_SLOT_ID');
    }

    const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .findById(slotId)
      .populate('parkingLotId', 'parkingName address city state postalCode parkingStatus ownerId')
      .populate('floorId', 'floorName floorNumber floorStatus')
      .populate('zoneId', 'zoneName zoneCode vehicleType zoneStatus')
      .populate({
        path: 'currentBookingId',
        select: 'bookingReference customerId vehicleId scheduledEntryTime scheduledExitTime actualEntryTime bookingStatus totalAmount',
        populate: [
          { path: 'customerId', select: 'fullName email mobileNumber' },
          { path: 'vehicleId', select: 'vehicleNumber vehicleType vehicleBrand vehicleModel' },
        ],
      })
      .lean();

    if (!slot) {
      throw new AppError('Parking slot not found.', 404, 'SLOT_NOT_FOUND');
    }

    const lot = slot.parkingLotId as { _id?: mongoose.Types.ObjectId; ownerId?: mongoose.Types.ObjectId | string };
    const lotOwnerId = lot?.ownerId?.toString();
    if (lotOwnerId !== ownerId) {
      throw new AppError('Access denied: You do not own this parking facility.', 403, 'FORBIDDEN');
    }

    // If slot has an active/confirmed booking without currentBookingId link, lookup booking
    let activeBooking: unknown = slot.currentBookingId;
    if (!activeBooking && (slot.slotStatus === 'Occupied' || slot.slotStatus === 'Reserved')) {
      activeBooking = await (BookingModel as mongoose.Model<Booking>)
        .findOne({
          currentSlotId: slot._id,
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
        })
        .populate('customerId', 'fullName email mobileNumber')
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel')
        .lean();
    }

    return {
      ...slot,
      activeBooking: activeBooking || null,
    };
  }

  /**
   * Updates operational status of an Owner's parking slot (Available <-> Under Maintenance / Blocked)
   * Validates backend ownership, rejects structural modifications, checks active bookings,
   * updates counters, records audit logs, and emits real-time WebSocket notifications.
   */
  public async updateOwnerSlotOperationalStatus(
    ownerId: string,
    slotId: string,
    payload: {
      slotStatus?: string;
      remarks?: string | null | undefined;
      isOverflow?: boolean;
    },
    context?: {
      ipAddress?: string | undefined;
      userAgent?: string | undefined;
    },
  ): Promise<any> {
    if (!ownerId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    if (!mongoose.Types.ObjectId.isValid(slotId)) {
      throw new AppError('Invalid parking slot ID format.', 400, 'INVALID_SLOT_ID');
    }

    if (payload.slotStatus === undefined && payload.isOverflow === undefined) {
      throw new AppError('Either slotStatus or isOverflow must be specified for update.', 400, 'MISSING_UPDATE_PAYLOAD');
    }

    const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(slotId);
    if (!slot) {
      throw new AppError('Parking slot not found.', 404, 'SLOT_NOT_FOUND');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(slot.parkingLotId);
    if (!lot) {
      throw new AppError('Associated parking facility not found.', 404, 'PARKING_LOT_NOT_FOUND');
    }

    const lotOwnerId = (lot.ownerId as { _id?: mongoose.Types.ObjectId })?._id?.toString() || lot.ownerId?.toString();
    if (lotOwnerId !== ownerId) {
      throw new AppError('Access denied: You do not own this parking facility.', 403, 'FORBIDDEN');
    }

    const oldStatus = slot.slotStatus;
    const oldIsOverflow = Boolean(slot.isOverflow);
    let targetStatus: 'Available' | 'Under Maintenance' | undefined;

    // Handle isOverflow Toggle
    if (payload.isOverflow !== undefined) {
      const targetIsOverflow = Boolean(payload.isOverflow);
      if (!targetIsOverflow && slot.isOverflow) {
        // Safety check: Cannot remove overflow designation if slot has active or confirmed bookings
        const activeBooking = await (BookingModel as mongoose.Model<Booking>).findOne({
          currentSlotId: slot._id,
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
        });
        if (activeBooking) {
          throw new AppError(
            `Cannot remove overflow designation: Slot ${slot.slotNumber} currently has an active booking (${activeBooking.bookingReference}).`,
            409,
            'ACTIVE_BOOKING_CONFLICT',
          );
        }
      }

      slot.isOverflow = targetIsOverflow;

      // Sync 2D layout element in ParkingLayoutModel
      try {
        const layout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).findOne({
          parkingLotId: slot.parkingLotId,
          floorId: slot.floorId,
        });
        if (layout && layout.elements) {
          let layoutModified = false;
          for (const el of layout.elements as any[]) {
            if (el.slotId?.toString() === slot._id.toString() || el.slotNumber === slot.slotNumber) {
              el.isOverflow = targetIsOverflow;
              layoutModified = true;
              break;
            }
          }
          if (layoutModified) {
            await layout.save();
          }
        }
      } catch (layoutSyncErr) {
        console.warn('Failed to sync layout element isOverflow:', layoutSyncErr);
      }

      // Re-count facility overflow slots
      const overflowCount = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).countDocuments({
        parkingLotId: lot._id,
        isOverflow: true,
      });
      lot.overflowSlotCount = overflowCount;
      await lot.save();
    }

    // Handle slotStatus Transition
    if (payload.slotStatus !== undefined) {
      const rawStatus = (payload.slotStatus || '').trim();
      if (rawStatus === 'Available') {
        targetStatus = 'Available';
      } else if (rawStatus === 'Under Maintenance' || rawStatus === 'Maintenance' || rawStatus === 'Blocked') {
        targetStatus = 'Under Maintenance';
      } else {
        throw new AppError(
          'Invalid operational status change. Supported operational states are "Available" and "Under Maintenance" (Blocked).',
          400,
          'INVALID_STATUS_TRANSITION',
        );
      }

      // 1. Current physical occupancy / reservation checks
      if (slot.slotStatus === 'Occupied') {
        throw new AppError(
          `Cannot change status: Slot ${slot.slotNumber} is currently occupied by a parked vehicle.`,
          409,
          'SLOT_OCCUPIED_CONFLICT',
        );
      }

      if (slot.slotStatus === 'Reserved') {
        throw new AppError(
          `Cannot change status: Slot ${slot.slotNumber} is currently reserved for an incoming customer booking.`,
          409,
          'SLOT_RESERVED_CONFLICT',
        );
      }

      // 2. Booking conflict check for Under Maintenance transition
      if (targetStatus === 'Under Maintenance') {
        const conflictingBooking = await (BookingModel as mongoose.Model<Booking>)
          .findOne({
            currentSlotId: slot._id,
            bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
          })
          .select('bookingReference bookingStatus scheduledEntryTime')
          .lean();

        if (conflictingBooking) {
          throw new AppError(
            `Cannot place slot under maintenance: Active or confirmed booking (${conflictingBooking.bookingReference}) is assigned to this slot.`,
            409,
            'ACTIVE_BOOKING_CONFLICT',
          );
        }
      }

      slot.slotStatus = targetStatus;

      if (payload.remarks !== undefined) {
        slot.remarks = payload.remarks && payload.remarks.trim().length > 0 ? payload.remarks.trim().slice(0, 250) : null;
      } else if (targetStatus === 'Available') {
        slot.remarks = null;
      }
    }

    await slot.save();

    // 3. Reconcile hierarchy slot availability counters
    try {
      await customerBookingService.reconcileHierarchyCounters({
        parkingLotId: slot.parkingLotId as mongoose.Types.ObjectId,
        floorId: slot.floorId as mongoose.Types.ObjectId,
        zoneId: slot.zoneId as mongoose.Types.ObjectId,
      });
    } catch (reconcileErr) {
      console.warn('Reconcile hierarchy counters warning:', reconcileErr);
    }

    // 4. Record Immutable Audit Log
    try {
      const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerId).select('roleId');
      const actionDetails = [];
      if (targetStatus) actionDetails.push(`Status: ${oldStatus} -> ${targetStatus}`);
      if (payload.isOverflow !== undefined) actionDetails.push(`Overflow: ${oldIsOverflow} -> ${slot.isOverflow}`);

      await (AuditLogModel as mongoose.Model<any>).create({
        userId: new mongoose.Types.ObjectId(ownerId),
        roleId: ownerUser?.roleId ?? null,
        actionCode: 'SLOT_STATUS_UPDATED',
        module: 'Parking Management',
        actionTitle: 'Operational Slot Status / Overflow Changed',
        description: `Slot "${slot.slotNumber}" updated by Parking Owner. ${actionDetails.join(', ')}.${slot.remarks ? ` Remarks: ${slot.remarks}` : ''}`,
        targetDocumentId: slot._id,
        targetCollection: 'parkingSlots',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        actionStatus: 'Success',
        metadata: {
          parkingLotId: slot.parkingLotId,
          floorId: slot.floorId,
          zoneId: slot.zoneId,
          oldStatus,
          newStatus: slot.slotStatus,
          isOverflow: slot.isOverflow,
          remarks: slot.remarks,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log write error for slot status change:', auditErr);
    }

    // 5. Emit Real-time WebSocket Event
    try {
      emitSlotStatusUpdate({
        parkingLotId: slot.parkingLotId.toString(),
        floorId: slot.floorId.toString(),
        zoneId: slot.zoneId.toString(),
        slotId: slot._id.toString(),
        slotNumber: slot.slotNumber,
        slotStatus: slot.slotStatus,
        isOverflow: slot.isOverflow,
        remarks: slot.remarks,
        timestamp: new Date().toISOString(),
      });
    } catch (socketErr) {
      console.warn('Socket emission warning for slot status change:', socketErr);
    }

    // Return populated slot details
    const populated = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .findById(slot._id)
      .populate('parkingLotId', 'parkingName address city state parkingStatus')
      .populate('floorId', 'floorName floorNumber floorStatus')
      .populate('zoneId', 'zoneName zoneCode vehicleType zoneStatus')
      .lean();

    return populated;
  }

  /**
   * Fetch paginated list of bookings scoped to the authenticated Owner's facilities.
   * Supports facility switcher, status tabs, booking type, payment status, date range, search, and summary counts.
   */
  public async getOwnerBookings(
    ownerId: string,
    params: OwnerBookingsQueryParams,
  ): Promise<OwnerBookingsResult> {
    // 0. Auto-reconcile booking statuses (no-show, overstay, expired pending)
    try {
      await customerBookingService.reconcileBookingStatuses();
    } catch (recErr) {
      console.warn('Reconcile booking statuses warning:', recErr);
    }

    // 1. Verify owner facilities
    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id name parkingName address')
      .lean();

    const ownerLotIds = ownerLots.map((l) => l._id);
    if (ownerLotIds.length === 0) {
      return {
        bookings: [],
        total: 0,
        page: 1,
        limit: params.limit || 10,
        pages: 0,
        summary: {
          total: 0,
          pendingPayment: 0,
          confirmed: 0,
          active: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          overstay: 0,
          totalRevenue: 0,
        },
      };
    }

    if (params.parkingLotId) {
      if (!mongoose.Types.ObjectId.isValid(params.parkingLotId)) {
        throw new AppError('Invalid parking facility ID.', 400, 'INVALID_FACILITY_ID');
      }
      const isOwnerLot = ownerLotIds.some((id) => id.toString() === params.parkingLotId);
      if (!isOwnerLot) {
        throw new AppError(
          'Forbidden: Parking facility does not belong to this owner.',
          403,
          'FORBIDDEN_FACILITY_ACCESS',
        );
      }
    }

    const scopedLotIds = params.parkingLotId
      ? [new mongoose.Types.ObjectId(params.parkingLotId)]
      : ownerLotIds;

    // 2. Build summary counts scoped to selected facility/facilities
    const summaryFilter: any = {
      parkingLotId: { $in: scopedLotIds },
    };

    const [
      totalCount,
      pendingPaymentCount,
      confirmedCount,
      activeCount,
      completedCount,
      cancelledCount,
      noShowCount,
      overstayCount,
      revenueAgg,
    ] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).countDocuments(summaryFilter),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        ...summaryFilter,
        bookingStatus: 'Pending Payment',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        ...summaryFilter,
        bookingStatus: 'Confirmed',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        ...summaryFilter,
        bookingStatus: 'Active',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        ...summaryFilter,
        bookingStatus: 'Completed',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        ...summaryFilter,
        bookingStatus: 'Cancelled',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        ...summaryFilter,
        bookingStatus: 'No Show',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        ...summaryFilter,
        bookingStatus: 'Overstay',
      }),
      (BookingModel as mongoose.Model<Booking>).aggregate([
        {
          $match: {
            parkingLotId: { $in: scopedLotIds },
            bookingStatus: { $in: ['Confirmed', 'Active', 'Completed', 'Overstay', 'No Show'] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: { $subtract: ['$totalAmount', { $ifNull: ['$refundAmount', 0] }] },
            },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    // 3. Build filter query
    const filter: any = {
      parkingLotId: { $in: scopedLotIds },
    };

    if (params.status && params.status !== 'ALL') {
      filter.bookingStatus = params.status;
    }

    if (params.bookingType && params.bookingType !== 'ALL') {
      filter.bookingType = params.bookingType;
    }

    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (params.startDate) {
        dateFilter.$gte = new Date(params.startDate);
      }
      if (params.endDate) {
        dateFilter.$lte = new Date(params.endDate);
      }
      filter.scheduledEntryTime = dateFilter;
    }

    if (params.paymentStatus && params.paymentStatus !== 'ALL') {
      const matchingPayments = await (PaymentModel as any)
        .find({ paymentStatus: params.paymentStatus })
        .select('bookingId')
        .lean();
      const bookingIdsWithPaymentStatus = matchingPayments
        .map((p: any) => p.bookingId)
        .filter(Boolean);
      filter._id = { $in: bookingIdsWithPaymentStatus };
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const [matchingUsers, matchingVehicles] = await Promise.all([
        (UserModel as mongoose.Model<User>)
          .find({
            $or: [
              { fullName: { $regex: escaped, $options: 'i' } },
              { email: { $regex: escaped, $options: 'i' } },
              { mobileNumber: { $regex: escaped, $options: 'i' } },
            ],
          })
          .select('_id')
          .lean(),
        (VehicleModel as mongoose.Model<Vehicle>)
          .find({ vehicleNumber: { $regex: escaped, $options: 'i' } })
          .select('_id')
          .lean(),
      ]);

      const searchConditions: any[] = [{ bookingReference: { $regex: escaped, $options: 'i' } }];
      if (matchingUsers.length > 0) {
        searchConditions.push({ customerId: { $in: matchingUsers.map((u) => u._id) } });
      }
      if (matchingVehicles.length > 0) {
        searchConditions.push({ vehicleId: { $in: matchingVehicles.map((v) => v._id) } });
      }

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // 4. Pagination & Sorting
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const allowedSortFields = [
      'createdAt',
      'scheduledEntryTime',
      'scheduledExitTime',
      'totalAmount',
      'bookingStatus',
      'bookingReference',
    ];
    const sortBy = allowedSortFields.includes(params.sortBy || '') ? params.sortBy! : 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

    const [totalFiltered, rawBookings] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).countDocuments(filter),
      (BookingModel as mongoose.Model<Booking>)
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'fullName email mobileNumber avatarUrl')
        .populate('vehicleId', 'vehicleNumber vehicleType brand model')
        .populate('parkingLotId', 'name parkingName address')
        .populate('floorId', 'floorName floorNumber')
        .populate('zoneId', 'zoneName zoneCode vehicleType')
        .populate('currentSlotId', 'slotNumber slotLabel slotStatus')
        .lean(),
    ]);

    // 5. Fetch payments for populated bookings
    const bookingIds = rawBookings.map((b) => b._id);
    const payments = await (PaymentModel as mongoose.Model<Payment>)
      .find({ bookingId: { $in: bookingIds } })
      .sort({ createdAt: -1 })
      .lean();

    const paymentMap = new Map<string, any>();
    for (const p of payments) {
      if (p.bookingId && !paymentMap.has(p.bookingId.toString())) {
        paymentMap.set(p.bookingId.toString(), p);
      }
    }

    const bookings: OwnerBookingItem[] = rawBookings.map((b: any) => {
      const pm = paymentMap.get(b._id.toString());
      const pLot = b.parkingLotId;
      const parkingName = pLot?.parkingName || pLot?.name || 'Parking Facility';

      const isLiveOverstay =
        (b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') &&
        !b.actualExitTime &&
        Date.now() > new Date(b.scheduledExitTime).getTime();
      const liveOverstayMins = isLiveOverstay
        ? Math.max(
            b.overstayDurationMinutes || 1,
            Math.ceil((Date.now() - new Date(b.scheduledExitTime).getTime()) / (60 * 1000)),
          )
        : b.overstayDurationMinutes || 0;
      const liveOverstayHours = isLiveOverstay ? Math.max(1, Math.ceil(liveOverstayMins / 60)) : 0;
      const liveOverstayRate = b.overstayRateAtBooking || b.parkingRateAtBooking || 0;
      const liveOverstayCharge = isLiveOverstay
        ? Math.max(b.overstayCharge || 0, Math.round(liveOverstayHours * liveOverstayRate))
        : b.overstayCharge || 0;

      return {
        _id: b._id.toString(),
        bookingReference: b.bookingReference,
        bookingType: b.bookingType,
        bookingStatus: isLiveOverstay ? 'Overstay' : b.bookingStatus,
        createdBy: b.bookingType === 'WALK_IN' ? 'Security Staff' : 'Customer',
        scheduledEntryTime: b.scheduledEntryTime,
        scheduledExitTime: b.scheduledExitTime,
        actualEntryTime: b.actualEntryTime || null,
        actualExitTime: b.actualExitTime || null,
        bookingDurationMinutes: b.bookingDurationMinutes || 0,
        parkingRateAtBooking: b.parkingRateAtBooking || 0,
        baseAmount: b.baseAmount || 0,
        additionalCharges: Math.max(b.additionalCharges || 0, liveOverstayCharge),
        totalAmount: Math.max(b.totalAmount || 0, (b.baseAmount || 0) + (b.platformBookingFee || 0) + liveOverstayCharge),
        refundAmount: b.refundAmount || 0,
        noShowDetected: Boolean(b.noShowDetected),
        overstayDetected: Boolean(b.overstayDetected || isLiveOverstay),
        overstayDurationMinutes: liveOverstayMins,
        overstayCharge: liveOverstayCharge,
        qrCode: b.qrCode,
        cancellationReason: b.cancellationReason || null,
        cancellationBy: b.cancellationBy || null,
        createdAt: b.createdAt,
        customer: b.customerId
          ? {
              _id: b.customerId._id?.toString() || b.customerId.toString(),
              fullName: b.customerId.fullName || 'Unknown Customer',
              email: b.customerId.email || '',
              mobileNumber: b.customerId.mobileNumber || '',
              avatarUrl: b.customerId.avatarUrl || null,
            }
          : null,
        vehicle: b.vehicleId
          ? {
              _id: b.vehicleId._id?.toString() || b.vehicleId.toString(),
              vehicleNumber: b.vehicleId.vehicleNumber || '',
              vehicleType: b.vehicleId.vehicleType || '',
              brand: b.vehicleId.brand,
              model: b.vehicleId.model,
            }
          : null,
        parkingLot: pLot
          ? {
              _id: pLot._id?.toString() || pLot.toString(),
              parkingName,
              address: pLot.address,
            }
          : null,
        floor: b.floorId
          ? {
              _id: b.floorId._id?.toString() || b.floorId.toString(),
              floorName: b.floorId.floorName,
              floorNumber: b.floorId.floorNumber,
            }
          : null,
        zone: b.zoneId
          ? {
              _id: b.zoneId._id?.toString() || b.zoneId.toString(),
              zoneName: b.zoneId.zoneName,
              zoneCode: b.zoneId.zoneCode,
              vehicleType: b.zoneId.vehicleType,
            }
          : null,
        slot: b.currentSlotId
          ? {
              _id: b.currentSlotId._id?.toString() || b.currentSlotId.toString(),
              slotNumber: b.currentSlotId.slotNumber,
              slotLabel: b.currentSlotId.slotLabel,
              slotStatus: b.currentSlotId.slotStatus,
            }
          : null,
        payment: pm
          ? {
              _id: pm._id.toString(),
              paymentReference: pm.paymentReference,
              paymentMethod: pm.paymentMethod,
              paymentStatus: pm.paymentStatus,
              amount: pm.amount || 0,
              paymentDate: pm.paymentDate || pm.createdAt,
              refundAmount: pm.refundAmount || 0,
              refundStatus: pm.refunds?.[0]?.refundStatus,
            }
          : null,
      };
    });

    return {
      bookings,
      total: totalFiltered,
      page,
      limit,
      pages: Math.ceil(totalFiltered / limit),
      summary: {
        total: totalCount,
        pendingPayment: pendingPaymentCount,
        confirmed: confirmedCount,
        active: activeCount,
        completed: completedCount,
        cancelled: cancelledCount,
        noShow: noShowCount,
        overstay: overstayCount,
        totalRevenue,
      },
    };
  }

  /**
   * Fetch comprehensive booking details scoped to the authenticated Owner's facility,
   * including customer, vehicle, facility, floor, zone, slot, timeline, and payments.
   */
  public async getOwnerBookingById(
    ownerId: string,
    bookingId: string,
  ): Promise<OwnerBookingDetailResult> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    // Auto-reconcile booking statuses
    try {
      await customerBookingService.reconcileBookingStatuses();
    } catch (recErr) {
      console.warn('Reconcile booking statuses warning:', recErr);
    }

    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id')
      .lean();
    const ownerLotIds = ownerLots.map((l) => l._id.toString());

    const rawBooking: any = await (BookingModel as mongoose.Model<Booking>)
      .findById(bookingId)
      .populate('customerId', 'fullName email mobileNumber avatarUrl')
      .populate('vehicleId', 'vehicleNumber vehicleType brand model color')
      .populate('parkingLotId', 'name parkingName address contactNumber supportEmail hourlyRate gracePeriodMinutes')
      .populate('floorId', 'floorName floorNumber')
      .populate('zoneId', 'zoneName zoneCode vehicleType')
      .populate('currentSlotId', 'slotNumber slotLabel slotStatus isEVCharging isDisabledAccessible')
      .lean();

    if (!rawBooking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    const lotIdStr =
      rawBooking.parkingLotId?._id?.toString() || rawBooking.parkingLotId?.toString();
    if (!ownerLotIds.includes(lotIdStr)) {
      throw new AppError(
        'Forbidden: Parking facility does not belong to this owner.',
        403,
        'FORBIDDEN_FACILITY_ACCESS',
      );
    }

    // Fetch timeline and payments
    const [rawTimeline, rawPayments] = await Promise.all([
      (BookingTimelineModel as mongoose.Model<BookingTimeline>)
        .find({ bookingId: rawBooking._id })
        .sort({ eventTime: 1 })
        .populate('performedBy', 'fullName role')
        .lean(),
      (PaymentModel as mongoose.Model<Payment>)
        .find({ bookingId: rawBooking._id })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const pLot = rawBooking.parkingLotId;
    const parkingName = pLot?.parkingName || pLot?.name || 'Parking Facility';

    const pm = rawPayments[0];

    const canCancel =
      rawBooking.bookingStatus !== 'Cancelled' && rawBooking.bookingStatus !== 'Completed';

    const canExtend =
      rawBooking.bookingStatus === 'Confirmed' || rawBooking.bookingStatus === 'Active';

    const canDownloadReceipt =
      Boolean(pm && (pm.paymentStatus === 'SUCCESSFUL' || pm.paymentStatus === 'REFUNDED')) ||
      rawBooking.bookingStatus === 'Completed' ||
      rawBooking.bookingStatus === 'Active' ||
      rawBooking.bookingStatus === 'Confirmed';

    const isLiveDetailOverstay =
      (rawBooking.bookingStatus === 'Active' || rawBooking.bookingStatus === 'Overstay') &&
      !rawBooking.actualExitTime &&
      Date.now() > new Date(rawBooking.scheduledExitTime).getTime();
    const detailOverstayMins = isLiveDetailOverstay
      ? Math.max(
          rawBooking.overstayDurationMinutes || 1,
          Math.ceil((Date.now() - new Date(rawBooking.scheduledExitTime).getTime()) / (60 * 1000)),
        )
      : rawBooking.overstayDurationMinutes || 0;
    const detailOverstayHours = isLiveDetailOverstay ? Math.max(1, Math.ceil(detailOverstayMins / 60)) : 0;
    const detailOverstayRate = rawBooking.overstayRateAtBooking || rawBooking.parkingRateAtBooking || 0;
    const detailOverstayCharge = isLiveDetailOverstay
      ? Math.max(rawBooking.overstayCharge || 0, Math.round(detailOverstayHours * detailOverstayRate))
      : rawBooking.overstayCharge || 0;

    return {
      _id: rawBooking._id.toString(),
      bookingReference: rawBooking.bookingReference,
      bookingType: rawBooking.bookingType,
      bookingStatus: isLiveDetailOverstay ? 'Overstay' : rawBooking.bookingStatus,
      createdBy: rawBooking.bookingType === 'WALK_IN' ? 'Security Staff' : 'Customer',
      scheduledEntryTime: rawBooking.scheduledEntryTime,
      scheduledExitTime: rawBooking.scheduledExitTime,
      actualEntryTime: rawBooking.actualEntryTime || null,
      actualExitTime: rawBooking.actualExitTime || null,
      bookingDurationMinutes: rawBooking.bookingDurationMinutes || 0,
      parkingRateAtBooking: rawBooking.parkingRateAtBooking || 0,
      baseAmount: rawBooking.baseAmount || 0,
      additionalCharges: Math.max(rawBooking.additionalCharges || 0, detailOverstayCharge),
      totalAmount: Math.max(
        rawBooking.totalAmount || 0,
        (rawBooking.baseAmount || 0) + (rawBooking.platformBookingFee || 0) + detailOverstayCharge,
      ),
      refundAmount: rawBooking.refundAmount || 0,
      noShowDetected: Boolean(rawBooking.noShowDetected),
      overstayDetected: Boolean(rawBooking.overstayDetected || isLiveDetailOverstay),
      overstayDurationMinutes: detailOverstayMins,
      overstayCharge: detailOverstayCharge,
      qrCode: rawBooking.qrCode,
      cancellationReason: rawBooking.cancellationReason || null,
      cancellationBy: rawBooking.cancellationBy || null,
      createdAt: rawBooking.createdAt,
      customer: rawBooking.customerId
        ? {
            _id: rawBooking.customerId._id?.toString() || rawBooking.customerId.toString(),
            fullName: rawBooking.customerId.fullName || 'Unknown Customer',
            email: rawBooking.customerId.email || '',
            mobileNumber: rawBooking.customerId.mobileNumber || '',
            avatarUrl: rawBooking.customerId.avatarUrl || null,
          }
        : null,
      vehicle: rawBooking.vehicleId
        ? {
            _id: rawBooking.vehicleId._id?.toString() || rawBooking.vehicleId.toString(),
            vehicleNumber: rawBooking.vehicleId.vehicleNumber || '',
            vehicleType: rawBooking.vehicleId.vehicleType || '',
            brand: rawBooking.vehicleId.brand,
            model: rawBooking.vehicleId.model,
          }
        : null,
      parkingLot: pLot
        ? {
            _id: pLot._id?.toString() || pLot.toString(),
            parkingName,
            address: pLot.address,
          }
        : null,
      floor: rawBooking.floorId
        ? {
            _id: rawBooking.floorId._id?.toString() || rawBooking.floorId.toString(),
            floorName: rawBooking.floorId.floorName,
            floorNumber: rawBooking.floorId.floorNumber,
          }
        : null,
      zone: rawBooking.zoneId
        ? {
            _id: rawBooking.zoneId._id?.toString() || rawBooking.zoneId.toString(),
            zoneName: rawBooking.zoneId.zoneName,
            zoneCode: rawBooking.zoneId.zoneCode,
            vehicleType: rawBooking.zoneId.vehicleType,
          }
        : null,
      slot: rawBooking.currentSlotId
        ? {
            _id: rawBooking.currentSlotId._id?.toString() || rawBooking.currentSlotId.toString(),
            slotNumber: rawBooking.currentSlotId.slotNumber,
            slotLabel: rawBooking.currentSlotId.slotLabel,
            slotStatus: rawBooking.currentSlotId.slotStatus,
          }
        : null,
      payment: pm
        ? {
            _id: pm._id.toString(),
            paymentReference: pm.paymentReference,
            paymentMethod: pm.paymentMethod,
            paymentStatus: pm.paymentStatus,
            amount: pm.amount || 0,
            paymentDate: pm.paymentDate || pm.createdAt,
            refundAmount: pm.refundAmount || 0,
            refundStatus: pm.refunds?.[0]?.refundStatus || undefined,
          }
        : null,
      timeline: rawTimeline.map((t: any) => ({
        _id: t._id.toString(),
        eventCode: t.eventCode,
        eventType: t.eventType,
        eventTitle: t.eventTitle,
        eventDescription: t.eventDescription || null,
        eventSource: t.eventSource,
        eventTime: t.eventTime,
        performedBy: t.performedBy
          ? {
              _id: t.performedBy._id?.toString() || t.performedBy.toString(),
              fullName: t.performedBy.fullName || 'System',
              role: t.performedBy.role,
            }
          : null,
        metadata: t.metadata || {},
      })),
      payments: rawPayments.map((p: any) => ({
        _id: p._id.toString(),
        paymentReference: p.paymentReference,
        paymentType: p.paymentType || 'Parking Booking',
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        amount: p.amount || 0,
        transactionId: p.transactionId || null,
        gatewayOrderId: p.gatewayOrderId || null,
        gatewayPaymentId: p.gatewayPaymentId || null,
        refundAmount: p.refundAmount || 0,
        refundDate: p.refundDate || null,
        refunds: p.refunds || [],
        createdAt: p.createdAt,
      })),
      canCancel,
      canExtend,
      canDownloadReceipt,
    };
  }

  /**
   * Operational cancellation by Parking Owner with mandatory reason.
   * Enforces status eligibility, refund / cash reversal processing, slot release,
   * timeline creation, immutable audit logging, customer notification, and socket emission.
   */
  public async cancelOwnerBooking(
    ownerId: string,
    bookingId: string,
    payload: { reason: string },
    context?: { ipAddress?: string | undefined; userAgent?: string | undefined } | undefined,
  ): Promise<OwnerBookingDetailResult> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const reason = (payload.reason || '').trim();
    if (!reason) {
      throw new AppError(
        'A mandatory operational reason must be provided for facility cancellations.',
        400,
        'CANCELLATION_REASON_REQUIRED',
      );
    }

    // Verify owner facility authorization
    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id')
      .lean();
    const ownerLotIds = ownerLots.map((l) => l._id.toString());

    const session = await mongoose.startSession();
    let updatedBookingDoc: any = null;
    let paymentDoc: any = null;
    let refundAmount = 0;
    let refundType: 'ONLINE' | 'CASH' | 'NONE' = 'NONE';
    let lotIdStr = '';
    let floorIdStr = '';
    let zoneIdStr = '';
    let customerIdStr = '';

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        lotIdStr = booking.parkingLotId.toString();
        if (!ownerLotIds.includes(lotIdStr)) {
          throw new AppError(
            'Forbidden: Parking facility does not belong to this owner.',
            403,
            'FORBIDDEN_FACILITY_ACCESS',
          );
        }

        if (booking.bookingStatus === 'Cancelled' || booking.bookingStatus === 'Completed') {
          throw new AppError(
            `Cannot cancel a booking with status '${booking.bookingStatus}'.`,
            409,
            'INVALID_BOOKING_STATE_FOR_CANCELLATION',
          );
        }

        customerIdStr = booking.customerId.toString();
        floorIdStr = booking.floorId?.toString() || '';
        zoneIdStr = booking.zoneId?.toString() || '';

        booking.bookingStatus = 'Cancelled';
        booking.cancellationBy = 'Parking Owner';
        booking.cancellationReason = reason;

        // Find associated successful payment
        const payment = await (PaymentModel as mongoose.Model<Payment>)
          .findOne({ bookingId: booking._id, paymentStatus: 'SUCCESSFUL' })
          .session(session)
          .exec();

        if (payment) {
          refundAmount = booking.totalAmount || payment.amount || 0;
          booking.refundAmount = refundAmount;
          payment.refundAmount = refundAmount;
          payment.refundDate = new Date();
          payment.refunds = payment.refunds || [];

          if (payment.paymentMethod === 'RAZORPAY') {
            refundType = 'ONLINE';
            payment.paymentStatus = 'REFUNDED';
            payment.refunds.push({
              refundReference: `REF-${Date.now().toString(36).toUpperCase()}`,
              refundAmount,
              refundStatus: 'Refund Completed',
              refundReason: reason,
              initiatedAt: new Date(),
              completedAt: new Date(),
              initiatedBy: new mongoose.Types.ObjectId(ownerId),
              remarks: 'Owner operational cancellation refund',
            } as any);
          } else {
            // CASH / WALK-IN
            refundType = 'CASH';
            payment.paymentStatus = 'CASH_REVERSAL_PENDING';
            payment.refunds.push({
              refundReference: `CASH-REV-${Date.now().toString(36).toUpperCase()}`,
              refundAmount,
              refundStatus: 'Refund Pending',
              refundReason: reason,
              initiatedAt: new Date(),
              initiatedBy: new mongoose.Types.ObjectId(ownerId),
              remarks: 'Cash reversal pending for walk-in / cash booking',
            } as any);
          }
          await payment.save({ session });
          paymentDoc = payment;
        }

        await booking.save({ session });
        updatedBookingDoc = booking;

        // Release slot if currently held
        if (booking.currentSlotId) {
          const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
            .findById(booking.currentSlotId)
            .session(session)
            .exec();

          if (slot) {
            const isHeld =
              slot.currentBookingId?.toString() === booking._id.toString() ||
              (slot.slotStatus === 'Reserved' && !slot.currentBookingId);

            if (isHeld && slot.slotStatus !== 'Under Maintenance') {
              slot.slotStatus = 'Available';
              slot.currentBookingId = null;
              await slot.save({ session });
            }
          }
        }

        // Record Timeline Event
        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy: new mongoose.Types.ObjectId(ownerId),
              eventCode: 'BOOKING_CANCELLED',
              eventType: 'Booking Cancelled',
              eventTitle: 'Booking Cancelled by Parking Owner',
              eventDescription: reason,
              eventSource: 'Parking Owner',
              eventTime: new Date(),
              metadata: {
                operationalReason: reason,
                refundAmount,
                refundType,
                cancelledBy: 'Parking Owner',
              },
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    // Reconcile hierarchy counters
    if (lotIdStr && floorIdStr && zoneIdStr) {
      try {
        await customerBookingService.reconcileHierarchyCounters({
          parkingLotId: new mongoose.Types.ObjectId(lotIdStr),
          floorId: new mongoose.Types.ObjectId(floorIdStr),
          zoneId: new mongoose.Types.ObjectId(zoneIdStr),
        });
      } catch (recErr) {
        console.warn('Reconcile hierarchy counters warning:', recErr);
      }
    }

    // Audit Log
    try {
      await auditService.log({
        actionCode: 'OWNER_BOOKING_CANCELLED',
        module: 'Booking Management',
        actionTitle: 'Owner Operational Booking Cancellation',
        description: `Owner cancelled booking ${updatedBookingDoc.bookingReference}. Reason: ${reason}. Refund: ₹${refundAmount} (${refundType})`,
        targetCollection: 'bookings',
        targetDocumentId: new mongoose.Types.ObjectId(bookingId),
        metadata: {
          bookingReference: updatedBookingDoc.bookingReference,
          parkingLotId: lotIdStr,
          reason,
          refundAmount,
          refundType,
        },
        actionStatus: 'Success',
        userId: new mongoose.Types.ObjectId(ownerId),
        ipAddress: context?.ipAddress,
        deviceInfo: context?.userAgent,
      });
    } catch (auditErr) {
      console.warn('Audit log error:', auditErr);
    }

    // Customer Notification
    if (customerIdStr) {
      try {
        await notificationService.createNotification({
          userId: customerIdStr,
          title: 'Booking Cancelled by Facility Owner',
          message: `Your booking ${updatedBookingDoc.bookingReference} has been cancelled by the parking owner: ${reason}.${refundAmount > 0 ? ` Refund of ₹${refundAmount} (${String(refundType) === 'CASH' ? 'cash reversal' : 'online'}) has been processed.` : ''}`,
          notificationType: 'Booking',
          eventType: 'Booking Cancelled',
          priority: 'High',
          metadata: {
            bookingId,
            bookingReference: updatedBookingDoc.bookingReference,
            reason,
            refundAmount,
          },
        });
      } catch (notifErr) {
        console.warn('Notification send warning:', notifErr);
      }
    }

    // Socket.IO Emit
    try {
      emitBookingStatusUpdate({
        bookingId,
        bookingReference: updatedBookingDoc.bookingReference,
        parkingLotId: lotIdStr,
        customerId: customerIdStr,
        bookingStatus: 'Cancelled',
        paymentStatus: paymentDoc?.paymentStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit warning:', sErr);
    }

    return this.getOwnerBookingById(ownerId, bookingId);
  }

  /**
   * Operational extension by Parking Owner.
   * Validates Confirmed/Active status, verifies slot availability (no overlapping booking),
   * calculates additional charges strictly on backend based on rates,
   * records timeline, audit log, customer notification, and socket emission.
   */
  public async extendOwnerBooking(
    ownerId: string,
    bookingId: string,
    payload: { newScheduledExitTime: string },
    context?: { ipAddress?: string | undefined; userAgent?: string | undefined } | undefined,
  ): Promise<OwnerBookingDetailResult> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    if (!payload.newScheduledExitTime) {
      throw new AppError(
        'New scheduled exit time is required for booking extension.',
        400,
        'NEW_EXIT_TIME_REQUIRED',
      );
    }

    const newExitDate = new Date(payload.newScheduledExitTime);
    if (isNaN(newExitDate.getTime())) {
      throw new AppError('Invalid new scheduled exit time format.', 400, 'INVALID_EXIT_TIME');
    }

    // Verify owner facility authorization
    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id')
      .lean();
    const ownerLotIds = ownerLots.map((l) => l._id.toString());

    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    const lotIdStr = booking.parkingLotId.toString();
    if (!ownerLotIds.includes(lotIdStr)) {
      throw new AppError(
        'Forbidden: Parking facility does not belong to this owner.',
        403,
        'FORBIDDEN_FACILITY_ACCESS',
      );
    }

    if (booking.bookingStatus !== 'Confirmed' && booking.bookingStatus !== 'Active') {
      throw new AppError(
        `Cannot extend a booking with status '${booking.bookingStatus}'. Only Confirmed or Active bookings can be extended.`,
        409,
        'INVALID_BOOKING_STATE_FOR_EXTENSION',
      );
    }

    const currentExit = new Date(booking.scheduledExitTime);
    if (newExitDate.getTime() <= currentExit.getTime()) {
      throw new AppError(
        'New scheduled exit time must be strictly after the current scheduled exit time.',
        400,
        'INVALID_EXTENSION_WINDOW',
      );
    }

    // Check slot availability during extended interval [currentExit, newExitDate]
    const conflictingBooking = await (BookingModel as mongoose.Model<Booking>).findOne({
      _id: { $ne: booking._id },
      currentSlotId: booking.currentSlotId,
      bookingStatus: { $in: ['Confirmed', 'Active'] },
      scheduledEntryTime: { $lt: newExitDate },
      scheduledExitTime: { $gt: currentExit },
    });

    if (conflictingBooking) {
      throw new AppError(
        'Cannot extend booking: slot is already reserved or occupied for another booking during the requested extension period.',
        409,
        'SLOT_UNAVAILABLE_FOR_EXTENSION',
      );
    }

    // Backend price calculation
    const extensionMs = newExitDate.getTime() - currentExit.getTime();
    const extensionMinutes = Math.round(extensionMs / (1000 * 60));
    const extensionHours = Math.ceil(extensionMinutes / 60);
    const hourlyRate = booking.parkingRateAtBooking || 0;
    const additionalCharge = extensionHours * hourlyRate;

    const previousScheduledExitTime = booking.scheduledExitTime;

    booking.scheduledExitTime = newExitDate;
    booking.bookingDurationMinutes = (booking.bookingDurationMinutes || 0) + extensionMinutes;
    booking.additionalCharges = (booking.additionalCharges || 0) + additionalCharge;
    booking.totalAmount = (booking.totalAmount || 0) + additionalCharge;

    await booking.save();

    // Record Timeline Event
    await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
      bookingId: booking._id,
      performedBy: new mongoose.Types.ObjectId(ownerId),
      eventCode: 'BOOKING_EXTENDED',
      eventType: 'Booking Extended',
      eventTitle: 'Booking Extended by Parking Owner',
      eventDescription: `Extended by ${extensionHours} hour(s) (${extensionMinutes} min) to ${newExitDate.toISOString()}. Additional charge: ₹${additionalCharge}.`,
      eventSource: 'Parking Owner',
      eventTime: new Date(),
      metadata: {
        previousScheduledExitTime,
        newScheduledExitTime: newExitDate,
        extensionMinutes,
        extensionHours,
        hourlyRate,
        additionalCharge,
      },
    });

    // Audit Log
    try {
      await auditService.log({
        actionCode: 'OWNER_BOOKING_EXTENDED',
        module: 'Booking Management',
        actionTitle: 'Owner Booking Extension',
        description: `Owner extended booking ${booking.bookingReference} by ${extensionHours} hour(s) to ${newExitDate.toISOString()}. Additional charge: ₹${additionalCharge}`,
        targetCollection: 'bookings',
        targetDocumentId: new mongoose.Types.ObjectId(bookingId),
        metadata: {
          bookingReference: booking.bookingReference,
          previousScheduledExitTime,
          newScheduledExitTime: newExitDate,
          extensionMinutes,
          additionalCharge,
        },
        actionStatus: 'Success',
        userId: new mongoose.Types.ObjectId(ownerId),
        ipAddress: context?.ipAddress,
        deviceInfo: context?.userAgent,
      });
    } catch (auditErr) {
      console.warn('Audit log error:', auditErr);
    }

    // Customer Notification
    try {
      await notificationService.createNotification({
        userId: booking.customerId.toString(),
        title: 'Booking Extended by Parking Facility',
        message: `Your booking ${booking.bookingReference} has been extended to ${newExitDate.toLocaleString()}. Additional charge: ₹${additionalCharge}.`,
        notificationType: 'Booking',
        eventType: 'Booking Extended',
        priority: 'Normal',
        metadata: {
          bookingId,
          bookingReference: booking.bookingReference,
          newScheduledExitTime: newExitDate.toISOString(),
          additionalCharge,
        },
      });
    } catch (notifErr) {
      console.warn('Notification send warning:', notifErr);
    }

    // Socket.IO Emit
    try {
      emitBookingStatusUpdate({
        bookingId,
        bookingReference: booking.bookingReference,
        parkingLotId: lotIdStr,
        customerId: booking.customerId.toString(),
        bookingStatus: booking.bookingStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit warning:', sErr);
    }

    return this.getOwnerBookingById(ownerId, bookingId);
  }

  // =========================================================================
  // Owner Module Phase 4: Staff Management Methods
  // =========================================================================

  /**
   * Get all security staff assigned to the authenticated owner's facilities.
   */
  public async getOwnerStaff(
    ownerId: string,
    query: OwnerStaffQuery = {},
  ): Promise<OwnerStaffListResult> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // 1. Fetch all lots belonging to the owner
    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: ownerObjectId })
      .select('_id parkingName address city')
      .lean();

    const allOwnerLotObjectIds = ownerLots.map((l) => l._id);

    // If specific facility requested, validate ownership
    let targetLotObjectIds = allOwnerLotObjectIds;
    if (query.parkingLotId && query.parkingLotId !== 'ALL') {
      const isOwned = ownerLots.some((l) => l._id.toString() === query.parkingLotId);
      if (!isOwned) {
        throw new AppError('You do not own or manage this parking facility.', 403, 'E006');
      }
      targetLotObjectIds = [new mongoose.Types.ObjectId(query.parkingLotId)];
    }

    // 2. Find all assignments (active and inactive) scoped to target lots or owner
    const assignments = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .find({
        $or: [
          { ownerId: ownerObjectId, parkingLotId: { $in: targetLotObjectIds } },
          { parkingLotId: { $in: targetLotObjectIds } },
        ],
      })
      .populate('parkingLotId', 'parkingName address city')
      .sort({ assignedAt: -1 })
      .lean();

    // Map staffId -> assignments
    const staffAssignmentsMap = new Map<string, typeof assignments>();
    assignments.forEach((asg) => {
      const staffIdStr = asg.securityStaffId.toString();
      if (!staffAssignmentsMap.has(staffIdStr)) {
        staffAssignmentsMap.set(staffIdStr, []);
      }
      staffAssignmentsMap.get(staffIdStr)!.push(asg);
    });

    // 3. Calculate summary KPIs across ALL owner staff (unfiltered by page or search)
    const allOwnerAssignments = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .find({
        $or: [
          { ownerId: ownerObjectId },
          { parkingLotId: { $in: allOwnerLotObjectIds } },
        ],
      })
      .lean();

    const distinctStaffIds = Array.from(new Set(allOwnerAssignments.map((a) => a.securityStaffId.toString()))).map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const allStaffUsers = distinctStaffIds.length > 0
      ? await (UserModel as mongoose.Model<User>)
          .find({ _id: { $in: distinctStaffIds } })
          .select('_id accountStatus invitationStatus createdAt')
          .lean()
      : [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalStaff = allStaffUsers.length;
    const activeStaff = allStaffUsers.filter((u) => u.accountStatus === 'Active').length;
    const suspendedStaff = allStaffUsers.filter((u) => u.accountStatus === 'Suspended').length;
    const pendingInvitations = allStaffUsers.filter(
      (u) => u.accountStatus === 'Pending Verification' || (u as any).invitationStatus === 'Sent',
    ).length;
    const recentlyAdded = allStaffUsers.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length;

    const summary: OwnerStaffSummary = {
      totalStaff,
      activeStaff,
      suspendedStaff,
      pendingInvitations,
      recentlyAdded,
    };

    // 4. Query staff users for the current view
    const currentStaffObjectIds = Array.from(staffAssignmentsMap.keys()).map((id) => new mongoose.Types.ObjectId(id));

    if (currentStaffObjectIds.length === 0) {
      return {
        staff: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
        totalPages: 0,
        summary,
      };
    }

    const userFilter: any = {
      _id: { $in: currentStaffObjectIds },
    };

    if (query.accountStatus && query.accountStatus !== 'ALL') {
      userFilter.accountStatus = query.accountStatus;
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      userFilter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex },
        { employeeId: searchRegex },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [matchedUsers, totalCount] = await Promise.all([
      (UserModel as mongoose.Model<User>)
        .find(userFilter)
        .populate('roleId', 'roleCode roleName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      (UserModel as mongoose.Model<User>).countDocuments(userFilter),
    ]);

    // Format output
    const staffItems: OwnerStaffItem[] = matchedUsers.map((u: any) => {
      const userAssignments = staffAssignmentsMap.get(u._id.toString()) || [];
      const activeAsgs = userAssignments.filter((a) => a.assignmentStatus === 'Active');

      const primaryAsg = activeAsgs[0] || userAssignments[0];
      let assignedParkingLot: { _id: string; lotName: string; city?: string } | null = null;

      if (primaryAsg && primaryAsg.parkingLotId) {
        const lotInfo = primaryAsg.parkingLotId as any;
        assignedParkingLot = {
          _id: lotInfo._id ? lotInfo._id.toString() : lotInfo.toString(),
          lotName: lotInfo.parkingName || lotInfo.lotName || 'Assigned Facility',
          city: lotInfo.city || lotInfo.physicalAddress?.city || '',
        };
      }

      return {
        _id: u._id.toString(),
        employeeId: u.employeeId || primaryAsg?.employeeId || null,
        fullName: u.fullName,
        email: u.email,
        mobileNumber: u.mobileNumber,
        role: u.roleId?.roleName || 'Security Staff',
        accountStatus: u.accountStatus,
        invitationStatus: u.invitationStatus || (u.accountStatus === 'Pending Verification' ? 'Sent' : 'Accepted'),
        invitationSentAt: u.invitationSentAt || null,
        lastLogin: u.lastLogin || null,
        createdAt: u.createdAt,
        assignedParkingLot,
        activeAssignments: activeAsgs.map((a: any) => ({
          _id: a._id.toString(),
          parkingLotId: (a.parkingLotId?._id || a.parkingLotId).toString(),
          lotName: a.parkingLotId?.parkingName || a.parkingLotId?.lotName || 'Parking Facility',
          physicalAddress: a.parkingLotId?.address || a.parkingLotId?.physicalAddress?.streetAddress || '',
          assignedAt: a.assignedAt,
          employeeId: a.employeeId || null,
          assignmentReason: a.assignmentReason || null,
        })),
      };
    });

    return {
      staff: staffItems,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      summary,
    };
  }

  /**
   * Get single staff member details, assignment history, and operational stats.
   */
  public async getOwnerStaffById(
    ownerId: string,
    staffId: string,
  ): Promise<OwnerStaffDetailResult> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);

    // Verify staff user exists
    const staffUser = await (UserModel as mongoose.Model<User>)
      .findById(staffObjectId)
      .populate('roleId', 'roleCode roleName')
      .lean();

    if (!staffUser) {
      throw new AppError('Security staff member not found.', 404, 'E009');
    }

    // Verify owner authorization: must have at least one assignment for this owner
    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: ownerObjectId })
      .select('_id')
      .lean();
    const ownerLotIds = ownerLots.map((l) => l._id);

    const assignments = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .find({
        securityStaffId: staffObjectId,
        $or: [
          { ownerId: ownerObjectId },
          { parkingLotId: { $in: ownerLotIds } },
        ],
      })
      .populate('parkingLotId', 'parkingName address city state')
      .populate('assignedBy', 'fullName email')
      .populate('unassignedBy', 'fullName email')
      .sort({ assignedAt: -1 })
      .lean();

    if (assignments.length === 0) {
      throw new AppError('You are not authorized to view this staff member.', 403, 'E006');
    }

    const activeAsgs = assignments.filter((a) => a.assignmentStatus === 'Active');
    const primaryAsg = activeAsgs[0] || assignments[0];
    const lotInfo = primaryAsg?.parkingLotId as any;

    const staffItem: OwnerStaffItem = {
      _id: staffUser._id.toString(),
      employeeId: (staffUser as any).employeeId || primaryAsg?.employeeId || null,
      fullName: staffUser.fullName,
      email: staffUser.email,
      mobileNumber: staffUser.mobileNumber,
      role: (staffUser.roleId as any)?.roleName || 'Security Staff',
      accountStatus: staffUser.accountStatus,
      invitationStatus: (staffUser as any).invitationStatus || (staffUser.accountStatus === 'Pending Verification' ? 'Sent' : 'Accepted'),
      invitationSentAt: (staffUser as any).invitationSentAt || null,
      lastLogin: staffUser.lastLogin || null,
      createdAt: staffUser.createdAt,
      assignedParkingLot: lotInfo ? {
        _id: lotInfo._id.toString(),
        lotName: lotInfo.parkingName || lotInfo.lotName || 'Parking Facility',
        city: lotInfo.city || lotInfo.physicalAddress?.city || '',
      } : null,
      activeAssignments: activeAsgs.map((a: any) => ({
        _id: a._id.toString(),
        parkingLotId: (a.parkingLotId?._id || a.parkingLotId).toString(),
        lotName: a.parkingLotId?.parkingName || a.parkingLotId?.lotName || 'Parking Facility',
        physicalAddress: a.parkingLotId?.address || a.parkingLotId?.physicalAddress?.streetAddress || '',
        assignedAt: a.assignedAt,
        employeeId: a.employeeId || null,
        assignmentReason: a.assignmentReason || null,
      })),
    };

    const assignmentHistory = assignments.map((a: any) => ({
      _id: a._id.toString(),
      parkingLotId: (a.parkingLotId?._id || a.parkingLotId).toString(),
      lotName: a.parkingLotId?.parkingName || a.parkingLotId?.lotName || 'Parking Facility',
      assignmentStatus: a.assignmentStatus as 'Active' | 'Inactive',
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy ? {
        _id: (a.assignedBy as any)._id.toString(),
        fullName: (a.assignedBy as any).fullName,
        email: (a.assignedBy as any).email,
      } : undefined,
      unassignedAt: a.unassignedAt || null,
      unassignedBy: a.unassignedBy ? {
        _id: (a.unassignedBy as any)._id.toString(),
        fullName: (a.unassignedBy as any).fullName,
        email: (a.unassignedBy as any).email,
      } : undefined,
      assignmentReason: a.assignmentReason || null,
      employeeId: a.employeeId || null,
    }));

    // Operational statistics from VehicleMovementLog
    const [totalCheckIns, totalCheckOuts] = await Promise.all([
      (VehicleMovementLogModel as any).countDocuments({ verifiedBy: staffObjectId }),
      (VehicleMovementLogModel as any).countDocuments({ exitVerifiedBy: staffObjectId }),
    ]);

    return {
      staff: staffItem,
      assignmentHistory,
      operationalStats: {
        totalCheckIns,
        totalCheckOuts,
      },
    };
  }

  /**
   * Invite or add a Security Staff member under the owner's facility.
   */
  public async inviteOwnerStaff(
    ownerId: string,
    input: InviteOwnerStaffInput,
  ): Promise<OwnerStaffItem> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const lotObjectId = new mongoose.Types.ObjectId(input.parkingLotId);

    // 1. Verify lot ownership
    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(lotObjectId);
    if (!lot) {
      throw new AppError('Parking facility not found.', 404, 'E012');
    }
    if (lot.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('You are not authorized to assign staff to this facility.', 403, 'E006');
    }

    // 2. Validate input fields
    const fullName = (input.fullName || '').trim();
    if (!fullName || fullName.length < 3 || fullName.length > 100) {
      throw new AppError('Full name must be between 3 and 100 characters.', 400, 'E001');
    }

    const email = (input.email || '').toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('A valid email address is required.', 400, 'E001');
    }

    let mobile = (input.mobileNumber || '').trim();
    if (!mobile.startsWith('+91')) {
      mobile = `+91${mobile.replace(/\D/g, '')}`;
    }
    if (!/^\+91\d{10}$/.test(mobile)) {
      throw new AppError('Mobile number must be in +91XXXXXXXXXX format.', 400, 'E001');
    }

    // 3. Resolve Security Staff Role
    const securityRole = await (RoleModel as mongoose.Model<Role>).findOne({
      roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] },
      isActive: true,
    });
    if (!securityRole) {
      throw new AppError('Security Staff role is not configured in the system.', 500, 'E031');
    }

    // 4. Check existing user
    let user = await (UserModel as mongoose.Model<User>).findOne({
      $or: [{ email }, { mobileNumber: mobile }],
    });

    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerObjectId);

    if (user) {
      // Must be Security role
      if (user.roleId.toString() !== securityRole._id.toString()) {
        throw new AppError(
          'A user with this email or mobile number already exists with a different platform role. Security staff must have a dedicated security account.',
          409,
          'E008',
        );
      }

      // Check if already actively assigned to this lot
      const existingActiveAssignment = await (
        SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>
      ).findOne({
        securityStaffId: user._id,
        parkingLotId: lotObjectId,
        assignmentStatus: 'Active',
      });

      if (existingActiveAssignment) {
        throw new AppError(
          'This security staff member is already actively assigned to this parking facility.',
          409,
          'E050',
        );
      }

      // Update employee ID if provided and not yet set
      if (input.employeeId && !(user as any).employeeId) {
        (user as any).employeeId = input.employeeId.trim();
        await user.save();
      }

      // Create new assignment
      await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>).create({
        securityStaffId: user._id,
        ownerId: ownerObjectId,
        parkingLotId: lotObjectId,
        assignmentStatus: 'Active',
        assignedAt: new Date(),
        assignedBy: ownerObjectId,
        assignmentReason: input.assignmentReason?.trim() || 'Assigned to facility by owner',
        employeeId: input.employeeId?.trim() || (user as any).employeeId || null,
      });
    } else {
      // Create new user with Security Staff role
      user = await (UserModel as mongoose.Model<User>).create({
        fullName,
        email,
        mobileNumber: mobile,
        roleId: securityRole._id,
        accountStatus: 'Pending Verification',
        emailVerified: false,
        mobileVerified: false,
        employeeId: input.employeeId?.trim() || null,
        invitationStatus: 'Sent',
        invitationSentAt: new Date(),
        preferredLanguage: 'English',
        timezone: 'Asia/Kolkata',
      });

      // Create assignment
      await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>).create({
        securityStaffId: user._id,
        ownerId: ownerObjectId,
        parkingLotId: lotObjectId,
        assignmentStatus: 'Active',
        assignedAt: new Date(),
        assignedBy: ownerObjectId,
        assignmentReason: input.assignmentReason?.trim() || 'Initial staff assignment',
        employeeId: input.employeeId?.trim() || null,
      });
    }

    // 5. Send invitation email
    try {
      await emailService.sendSecurityStaffInvitationEmail({
        to: email,
        staffName: fullName,
        ownerName: ownerUser?.fullName || 'Parking Facility Owner',
        facilityName: (lot as any).parkingName || (lot as any).lotName || 'Parking Facility',
      });
    } catch (eErr) {
      console.warn('Failed to send security staff invitation email:', eErr);
    }

    // 6. In-App Notification
    try {
      await NotificationModel.create({
        notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        userId: user._id,
        senderId: ownerObjectId,
        notificationType: 'Account',
        eventType: 'Staff Invited',
        title: 'Assigned as Security Staff',
        message: `You have been invited and assigned as Security Staff for ${(lot as any).parkingName || (lot as any).lotName}. Please sign in to verify your account.`,
        priority: 'High',
        deliveryChannel: 'In-App',
        deliveryStatus: 'Delivered',
        deliveredAt: new Date(),
      });
    } catch (nErr) {
      console.warn('Failed to create staff invited notification:', nErr);
    }

    // 7. Audit Log
    await auditService.log({
      userId: ownerObjectId,
      roleId: ownerUser?.roleId,
      actionCode: 'STAFF_INVITED',
      module: 'Staff Management',
      actionTitle: 'Security Staff Invited',
      description: `Owner invited security staff ${fullName} (${email}) for facility ${(lot as any).parkingName || (lot as any).lotName}.`,
      targetCollection: 'users',
      targetDocumentId: user._id,
      metadata: { parkingLotId: lot._id.toString() },
      actionStatus: 'Success',
    });

    // 8. Socket Notification
    try {
      emitStaffStatusUpdate({
        staffId: user._id.toString(),
        ownerId: ownerId.toString(),
        parkingLotId: lot._id.toString(),
        status: user.accountStatus,
        event: 'INVITED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return (await this.getOwnerStaffById(ownerId, user._id.toString())).staff;
  }

  /**
   * Assign an existing security staff member to an additional facility owned by the owner.
   */
  public async assignOwnerStaff(
    ownerId: string,
    staffId: string,
    input: AssignOwnerStaffInput,
  ): Promise<OwnerStaffDetailResult> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);
    const lotObjectId = new mongoose.Types.ObjectId(input.parkingLotId);

    // Validate facility ownership
    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(lotObjectId);
    if (!lot) {
      throw new AppError('Parking facility not found.', 404, 'E012');
    }
    if (lot.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('You are not authorized to assign staff to this facility.', 403, 'E006');
    }

    // Validate staff exists and is security role
    const staffUser = await (UserModel as mongoose.Model<User>)
      .findById(staffObjectId)
      .populate('roleId', 'roleCode');
    if (!staffUser) {
      throw new AppError('Security staff member not found.', 404, 'E009');
    }

    const roleCode = (staffUser.roleId as any)?.roleCode;
    if (roleCode !== 'SECURITY' && roleCode !== 'SECURITY_STAFF') {
      throw new AppError('Only security personnel can be assigned to facilities.', 400, 'E008');
    }

    // Check duplicate active assignment to same lot
    const activeAssignment = await (
      SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>
    ).findOne({
      securityStaffId: staffObjectId,
      parkingLotId: lotObjectId,
      assignmentStatus: 'Active',
    });

    if (activeAssignment) {
      throw new AppError(
        'This security staff member is already actively assigned to this parking facility.',
        409,
        'E050',
      );
    }

    // Create new active assignment
    await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>).create({
      securityStaffId: staffObjectId,
      ownerId: ownerObjectId,
      parkingLotId: lotObjectId,
      assignmentStatus: 'Active',
      assignedAt: new Date(),
      assignedBy: ownerObjectId,
      assignmentReason: input.assignmentReason?.trim() || 'Facility assignment',
      employeeId: input.employeeId?.trim() || (staffUser as any).employeeId || null,
    });

    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerObjectId);

    // Audit log
    await auditService.log({
      userId: ownerObjectId,
      roleId: ownerUser?.roleId,
      actionCode: 'STAFF_ASSIGNED',
      module: 'Staff Management',
      actionTitle: 'Security Staff Assigned to Facility',
      description: `Owner assigned security staff ${staffUser.fullName} to facility ${(lot as any).parkingName || (lot as any).lotName}.`,
      targetCollection: 'securityStaffAssignments',
      targetDocumentId: staffObjectId,
      metadata: { parkingLotId: lot._id.toString() },
      actionStatus: 'Success',
    });

    // Socket notification
    try {
      emitStaffStatusUpdate({
        staffId: staffId.toString(),
        ownerId: ownerId.toString(),
        parkingLotId: lot._id.toString(),
        status: staffUser.accountStatus,
        event: 'ASSIGNED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return this.getOwnerStaffById(ownerId, staffId);
  }

  /**
   * Suspend or activate a staff account, or deactivate a facility assignment.
   */
  public async updateOwnerStaffStatus(
    ownerId: string,
    staffId: string,
    input: UpdateOwnerStaffStatusInput,
  ): Promise<OwnerStaffDetailResult> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);

    // Ensure staff belongs to this owner
    await this.getOwnerStaffById(ownerId, staffId);

    const staffUser = await (UserModel as mongoose.Model<User>).findById(staffObjectId);
    if (!staffUser) {
      throw new AppError('Staff member not found.', 404, 'E009');
    }
    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerObjectId);

    // 1. If updating accountStatus ('Active' | 'Suspended')
    if (input.accountStatus) {
      if (!['Active', 'Suspended'].includes(input.accountStatus)) {
        throw new AppError('Invalid account status. Allowed values: Active, Suspended.', 400, 'E001');
      }

      staffUser.accountStatus = input.accountStatus;
      await staffUser.save();

      const actionCode = input.accountStatus === 'Suspended' ? 'STAFF_SUSPENDED' : 'STAFF_ACTIVATED';
      const actionTitle = input.accountStatus === 'Suspended' ? 'Security Staff Suspended' : 'Security Staff Activated';

      await auditService.log({
        userId: ownerObjectId,
        roleId: ownerUser?.roleId,
        actionCode,
        module: 'Staff Management',
        actionTitle,
        description: `Owner set security staff ${staffUser.fullName} status to ${input.accountStatus}. Reason: ${input.reason || 'Not specified'}`,
        targetCollection: 'users',
        targetDocumentId: staffObjectId,
        actionStatus: 'Success',
      });

      try {
        await NotificationModel.create({
          notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          userId: staffObjectId,
          senderId: ownerObjectId,
          notificationType: 'Account',
          eventType: input.accountStatus === 'Suspended' ? 'Staff Suspended' : 'Staff Activated',
          title: `Account ${input.accountStatus}`,
          message: `Your staff account has been set to ${input.accountStatus} by the parking facility owner.${input.reason ? ` Reason: ${input.reason}` : ''}`,
          priority: 'High',
          deliveryChannel: 'In-App',
          deliveryStatus: 'Delivered',
          deliveredAt: new Date(),
        });
      } catch (nErr) {
        console.warn('Failed to send status notification:', nErr);
      }
    }

    // 2. If deactivating a specific lot assignment
    if (input.assignmentStatus === 'Inactive' && input.parkingLotId) {
      const lotObjectId = new mongoose.Types.ObjectId(input.parkingLotId);
      const activeAsg = await (
        SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>
      ).findOne({
        securityStaffId: staffObjectId,
        parkingLotId: lotObjectId,
        assignmentStatus: 'Active',
      });

      if (activeAsg) {
        activeAsg.assignmentStatus = 'Inactive';
        activeAsg.unassignedAt = new Date();
        activeAsg.unassignedBy = ownerObjectId;
        if (input.reason) {
          activeAsg.assignmentReason = input.reason;
        }
        await activeAsg.save();

        await auditService.log({
          userId: ownerObjectId,
          roleId: ownerUser?.roleId,
          actionCode: 'STAFF_UNASSIGNED',
          module: 'Staff Management',
          actionTitle: 'Security Staff Unassigned from Facility',
          description: `Owner unassigned security staff ${staffUser.fullName} from facility ${input.parkingLotId}. Reason: ${input.reason || 'Deactivated'}`,
          targetCollection: 'securityStaffAssignments',
          targetDocumentId: activeAsg._id,
          metadata: { parkingLotId: lotObjectId.toString() },
          actionStatus: 'Success',
        });
      }
    }

    try {
      emitStaffStatusUpdate({
        staffId: staffId.toString(),
        ownerId: ownerId.toString(),
        parkingLotId: input.parkingLotId ?? undefined,
        status: staffUser.accountStatus,
        event: input.accountStatus ? input.accountStatus.toUpperCase() : 'ASSIGNMENT_UPDATED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return this.getOwnerStaffById(ownerId, staffId);
  }

  /**
   * Update permitted security staff information (Name, Mobile, Employee ID).
   */
  public async updateOwnerStaff(
    ownerId: string,
    staffId: string,
    input: UpdateOwnerStaffInfoInput,
  ): Promise<OwnerStaffItem> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);

    // Verify ownership
    await this.getOwnerStaffById(ownerId, staffId);

    const staffUser = await (UserModel as mongoose.Model<User>).findById(staffObjectId);
    if (!staffUser) {
      throw new AppError('Security staff member not found.', 404, 'E009');
    }

    if (input.fullName && input.fullName.trim()) {
      const name = input.fullName.trim();
      if (name.length < 3 || name.length > 100) {
        throw new AppError('Full name must be between 3 and 100 characters.', 400, 'E001');
      }
      staffUser.fullName = name;
    }

    if (input.mobileNumber && input.mobileNumber.trim()) {
      let mobile = input.mobileNumber.trim();
      if (!mobile.startsWith('+91')) {
        mobile = `+91${mobile.replace(/\D/g, '')}`;
      }
      if (!/^\+91\d{10}$/.test(mobile)) {
        throw new AppError('Mobile number must be in +91XXXXXXXXXX format.', 400, 'E001');
      }

      if (mobile !== staffUser.mobileNumber) {
        const existing = await (UserModel as mongoose.Model<User>).findOne({
          mobileNumber: mobile,
          _id: { $ne: staffObjectId },
        });
        if (existing) {
          throw new AppError('This mobile number is already in use by another account.', 409, 'E008');
        }
        staffUser.mobileNumber = mobile;
        staffUser.mobileVerified = false;
      }
    }

    if (input.employeeId !== undefined) {
      (staffUser as any).employeeId = input.employeeId ? input.employeeId.trim() : null;
    }

    await staffUser.save();

    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerObjectId);

    await auditService.log({
      userId: ownerObjectId,
      roleId: ownerUser?.roleId,
      actionCode: 'STAFF_UPDATED',
      module: 'Staff Management',
      actionTitle: 'Security Staff Details Updated',
      description: `Owner updated staff details for ${staffUser.fullName}.`,
      targetCollection: 'users',
      targetDocumentId: staffObjectId,
      actionStatus: 'Success',
    });

    return (await this.getOwnerStaffById(ownerId, staffId)).staff;
  }

  /**
   * Resend invitation email to a security staff member.
   */
  public async resendStaffInvitation(
    ownerId: string,
    staffId: string,
  ): Promise<{ success: boolean; message: string }> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);

    // Verify staff belongs to this owner
    const details = await this.getOwnerStaffById(ownerId, staffId);

    const staffUser = await (UserModel as mongoose.Model<User>).findById(staffObjectId);
    if (!staffUser) {
      throw new AppError('Security staff member not found.', 404, 'E009');
    }

    (staffUser as any).invitationSentAt = new Date();
    (staffUser as any).invitationStatus = 'Sent';
    await staffUser.save();

    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerObjectId);
    const facilityName = details.staff.assignedParkingLot?.lotName || 'Parking Facility';

    await emailService.sendSecurityStaffInvitationEmail({
      to: staffUser.email,
      staffName: staffUser.fullName,
      ownerName: ownerUser?.fullName || 'Parking Facility Owner',
      facilityName,
    });

    await auditService.log({
      userId: ownerObjectId,
      roleId: ownerUser?.roleId,
      actionCode: 'STAFF_INVITATION_RESENT',
      module: 'Staff Management',
      actionTitle: 'Staff Invitation Resent',
      description: `Owner resent invitation email to ${staffUser.fullName} (${staffUser.email}).`,
      targetCollection: 'users',
      targetDocumentId: staffObjectId,
      actionStatus: 'Success',
    });

    return {
      success: true,
      message: `Invitation email resent successfully to ${staffUser.email}.`,
    };
  }
}

// =========================================================================
// Owner Module Phase 4: Staff Management Interfaces
// =========================================================================

export interface OwnerStaffSummary {
  totalStaff: number;
  activeStaff: number;
  suspendedStaff: number;
  pendingInvitations: number;
  recentlyAdded: number;
}

export interface OwnerStaffItem {
  _id: string;
  employeeId?: string | null;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: string;
  accountStatus: string;
  invitationStatus: string;
  invitationSentAt?: Date | null;
  lastLogin?: Date | null;
  createdAt: Date;
  assignedParkingLot?: {
    _id: string;
    lotName: string;
    city?: string;
  } | null;
  activeAssignments: Array<{
    _id: string;
    parkingLotId: string;
    lotName: string;
    physicalAddress?: string;
    assignedAt: Date;
    employeeId?: string | null;
    assignmentReason?: string | null;
  }>;
}

export interface OwnerStaffListResult {
  staff: OwnerStaffItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: OwnerStaffSummary;
}

export interface OwnerStaffDetailResult {
  staff: OwnerStaffItem;
  assignmentHistory: Array<{
    _id: string;
    parkingLotId: string;
    lotName: string;
    assignmentStatus: 'Active' | 'Inactive';
    assignedAt: Date;
    assignedBy?: { _id: string; fullName: string; email: string } | null | undefined;
    unassignedAt?: Date | null | undefined;
    unassignedBy?: { _id: string; fullName: string; email: string } | null | undefined;
    assignmentReason?: string | null | undefined;
    employeeId?: string | null | undefined;
  }>;
  operationalStats: {
    totalCheckIns: number;
    totalCheckOuts: number;
  };
}

export interface InviteOwnerStaffInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  parkingLotId: string;
  employeeId?: string | undefined;
  assignmentReason?: string | undefined;
}

export interface AssignOwnerStaffInput {
  parkingLotId: string;
  employeeId?: string | undefined;
  assignmentReason?: string | undefined;
}

export interface UpdateOwnerStaffStatusInput {
  accountStatus?: 'Active' | 'Suspended' | undefined;
  assignmentStatus?: 'Active' | 'Inactive' | undefined;
  parkingLotId?: string | undefined;
  reason?: string | undefined;
}

export interface UpdateOwnerStaffInfoInput {
  fullName?: string | undefined;
  mobileNumber?: string | undefined;
  employeeId?: string | undefined;
}

export interface OwnerStaffQuery {
  parkingLotId?: string | undefined;
  accountStatus?: string | undefined;
  assignmentStatus?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface OwnerBookingsQueryParams {
  parkingLotId?: string | undefined;
  status?: string | undefined;
  bookingType?: 'ONLINE' | 'WALK_IN' | 'ALL' | undefined;
  paymentStatus?: string | undefined;
  search?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface OwnerBookingItem {
  _id: string;
  bookingReference: string;
  bookingType: 'ONLINE' | 'WALK_IN';
  bookingStatus: string;
  createdBy: 'Customer' | 'Security Staff';
  scheduledEntryTime: Date;
  scheduledExitTime: Date;
  actualEntryTime?: Date | null | undefined;
  actualExitTime?: Date | null | undefined;
  bookingDurationMinutes: number;
  parkingRateAtBooking: number;
  baseAmount: number;
  additionalCharges: number;
  totalAmount: number;
  refundAmount: number;
  noShowDetected: boolean;
  overstayDetected: boolean;
  overstayDurationMinutes?: number | undefined;
  overstayCharge?: number | undefined;
  qrCode?: string | undefined;
  cancellationReason?: string | null | undefined;
  cancellationBy?: string | null | undefined;
  createdAt: Date;
  customer: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    avatarUrl?: string | null | undefined;
  } | null;
  vehicle: {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    brand?: string | undefined;
    model?: string | undefined;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address?: unknown;
  } | null;
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
  } | null;
  zone: {
    _id: string;
    zoneName: string;
    zoneCode: string;
    vehicleType?: string | undefined;
  } | null;
  slot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
    slotStatus: string;
  } | null;
  payment: {
    _id: string;
    paymentReference: string;
    paymentMethod: 'RAZORPAY' | 'CASH';
    paymentStatus: string;
    amount: number;
    paymentDate?: Date | null | undefined;
    refundAmount?: number | undefined;
    refundStatus?: string | undefined;
  } | null;
}

export interface OwnerBookingsSummary {
  total: number;
  pendingPayment: number;
  confirmed: number;
  active: number;
  completed: number;
  cancelled: number;
  noShow: number;
  overstay: number;
  totalRevenue: number;
}

export interface OwnerBookingsResult {
  bookings: OwnerBookingItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: OwnerBookingsSummary;
}

export interface OwnerBookingDetailResult extends OwnerBookingItem {
  timeline: Array<{
    _id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription?: string | null | undefined;
    eventSource: string;
    eventTime: Date;
    performedBy?: {
      _id: string;
      fullName: string;
      role?: string | undefined;
    } | null | undefined;
    metadata?: Record<string, unknown> | undefined;
  }>;
  payments: Array<{
    _id: string;
    paymentReference: string;
    paymentType: string;
    paymentMethod: 'RAZORPAY' | 'CASH';
    paymentStatus: string;
    amount: number;
    transactionId?: string | null | undefined;
    gatewayOrderId?: string | null | undefined;
    gatewayPaymentId?: string | null | undefined;
    refundAmount?: number | undefined;
    refundDate?: Date | null | undefined;
    refunds?: Array<{
      refundReference: string;
      refundAmount: number;
      refundStatus: string;
      refundReason: string;
      initiatedAt: Date;
      completedAt?: Date | null | undefined;
      remarks?: string | null | undefined;
    }> | undefined;
    createdAt: Date;
  }>;
  canCancel: boolean;
  canExtend: boolean;
  canDownloadReceipt: boolean;
}

export interface OwnerDashboardStatsResult {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyPercentage: number;
  todayBookingsCount: number;
  todayRevenue: number;
  activeSecurityStaffCount: number;
  recentBookings: Array<{
    _id: string;
    bookingReference: string;
    bookingStatus: string;
    bookingType: string;
    scheduledEntryTime: Date;
    scheduledExitTime: Date;
    actualEntryTime: Date | null;
    actualExitTime: Date | null;
    totalAmount: number;
    createdAt: Date;
    customer: {
      fullName: string;
      email: string;
      mobileNumber?: string | undefined;
    } | null;
    vehicle: {
      vehicleNumber: string;
      vehicleType: string;
    } | null;
    slot: {
      slotNumber: string;
      slotLabel: string;
    } | null;
    parkingLot: {
      _id: string;
      parkingName: string;
      city: string;
    } | null;
  }>;
  parkingLotsSummary: Array<{
    _id: string;
    parkingName: string;
    city: string;
    state: string;
    parkingStatus: string;
    totalFloors: number;
    totalSlots: number;
    availableSlots: number;
    occupiedSlots: number;
    reservedSlots: number;
    occupancyPercentage: number;
    hourlyRate: number;
  }>;
}

export interface OwnerSlotsResult {
  slots: Array<{
    _id: string;
    slotNumber: string;
    slotLabel: string;
    slotType: string;
    supportedVehicleType: string;
    slotStatus: string;
    qrIdentifier: string;
    remarks: string | null;
    parkingLotId: {
      _id: string;
      parkingName: string;
      address?: unknown;
      city: string;
      state: string;
      postalCode?: string;
      parkingStatus: string;
    };
    floorId: {
      _id: string;
      floorName: string;
      floorNumber: number;
      floorStatus: string;
    };
    zoneId: {
      _id: string;
      zoneName: string;
      zoneCode: string;
      vehicleType?: string;
      zoneStatus: string;
    };
    currentBookingId?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    maintenance: number;
  };
}

export interface OwnerParkingLotBusinessUpdate {
  description?: string;
  contactNumber?: string;
  supportEmail?: string | null;
  openingTime?: string;
  closingTime?: string;
  isOpen24Hours?: boolean;
  hourlyRate?: number;
  gracePeriodMinutes?: number;
  amenities?: string[];
  parkingStatus?: 'Active' | 'Inactive' | 'Under Maintenance' | 'Temporarily Closed';
  parkingImages?: string[];
}

export interface OwnerDocumentItem {
  category: 'identityProof' | 'businessLicense' | 'propertyProof';
  label: string;
  url: string;
  fileName: string;
  documentType: 'PDF' | 'Image';
  uploadDate: Date | null;
  verificationStatus: string;
  hasFile: boolean;
  governmentIdType?: string;
  maskedIdNumber?: string;
}

export interface OwnerPhotoItem {
  index: number;
  fileName: string;
  url: string;
  documentType: 'Image';
}

export interface OwnerRegistrationDocumentsResult {
  hasApplication: boolean;
  applicationReference?: string;
  businessName?: string;
  businessType?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  parkingCapacity?: number;
  applicationStatus?: string;
  adminRemarks?: string | null;
  rejectionReason?: string | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  documents: OwnerDocumentItem[];
  photos: {
    category: 'parkingImage';
    label: string;
    uploadDate: Date | null;
    verificationStatus: string;
    items: OwnerPhotoItem[];
    count: number;
  };
}

export interface OwnerDocumentFileResult {
  filePath: string;
  mimeType: string;
  fileName: string;
  isRemote: boolean;
  url?: string;
}

function maskGovernmentId(idType?: string, idNumber?: string): string {
  if (!idNumber) return '';
  const clean = idNumber.trim();
  if (clean.length <= 4) return '•••• ' + clean;

  const last4 = clean.slice(-4);
  const typeLower = (idType || '').toLowerCase();

  if (typeLower.includes('aadhaar')) {
    return '•••• •••• ' + last4;
  }

  return '••••••' + last4;
}

function getDocType(filenameOrPath: string): 'PDF' | 'Image' {
  const ext = path.extname(filenameOrPath).toLowerCase();
  if (ext === '.pdf') return 'PDF';
  return 'Image';
}

export const ownerService = new OwnerService();
