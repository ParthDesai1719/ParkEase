import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { NotificationModel, type Notification } from '../models/Notification.js';
import { RoleModel, type Role } from '../models/Role.js';
import { UserModel, type User } from '../models/User.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { AppError } from '../utils/AppError.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { otpService } from './otp.service.js';
import { sessionService } from './session.service.js';

interface RequestLoginOtpInput {
  method: 'email' | 'mobile';
  email?: string | undefined;
  mobileNumber?: string | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

interface VerifyLoginOtpInput {
  method: 'email' | 'mobile';
  email?: string | undefined;
  mobileNumber?: string | undefined;
  otp: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

interface RequestRegisterOtpInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  vehicleNumber: string;
  vehicleType: 'Bike' | 'Car' | 'SUV' | 'EV';
  termsAccepted: boolean;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

interface VerifyRegisterOtpInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  vehicleNumber: string;
  vehicleType: 'Bike' | 'Car' | 'SUV' | 'EV';
  termsAccepted: boolean;
  emailOtp: string;
  mobileOtp: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

class AuthService {
  private normalizeEmail(email?: string): string | null {
    return email ? email.trim().toLowerCase() : null;
  }

  private normalizeMobile(mobile?: string): string | null {
    return mobile ? mobile.trim() : null;
  }

  private normalizeVehicleNumber(vehicleNumber: string): string {
    return vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, '');
  }

  public async requestLoginOtp(
    input: RequestLoginOtpInput,
  ): Promise<{ message: string; cooldownSeconds: number }> {
    const email = this.normalizeEmail(input.email);
    const mobile = this.normalizeMobile(input.mobileNumber);

    // Look up user
    const query: Record<string, unknown> = {};
    if (input.method === 'email') {
      if (!email) throw new AppError('Email address is required.', 400, 'E001');
      query.email = email;
    } else {
      if (!mobile) throw new AppError('Mobile number is required.', 400, 'E001');
      query.mobileNumber = mobile;
    }

    const user = await (UserModel as mongoose.Model<User>).findOne(query).exec();

    // To prevent account enumeration, if user is not found, return a generic success message without leaking existence
    if (!user) {
      return {
        message: 'If an account exists with these details, a verification code has been sent.',
        cooldownSeconds: 30,
      };
    }

    // Check account status
    if (user.accountStatus === 'Suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'E007');
    }
    if (user.accountStatus === 'Deactivated' || user.accountStatus === 'Deleted') {
      throw new AppError('Your account is not eligible for authentication.', 403, 'E042');
    }

    // In V1, both email and mobile OTPs for login are sent to the registered email address
    const result = await otpService.requestOtp({
      userId: user._id,
      email: user.email,
      mobileNumber: input.method === 'mobile' ? user.mobileNumber : undefined,
      verificationType: 'LOGIN',
      deliveryMethod: 'Email',
      purposeLabel: 'Login',
    });

    await auditService.log({
      userId: user._id,
      roleId: user.roleId,
      actionCode: 'AUTH_OTP_REQUESTED',
      module: 'Authentication',
      actionTitle: 'Login OTP Requested',
      description: `Login OTP requested via ${input.method}.`,
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    return result;
  }

  public async verifyLoginOtp(input: VerifyLoginOtpInput): Promise<{
    user: User & { _id: mongoose.Types.ObjectId };
    accessToken: string;
    refreshToken: string;
  }> {
    const email = this.normalizeEmail(input.email);
    const mobile = this.normalizeMobile(input.mobileNumber);

    const userQuery: Record<string, unknown> = {};
    if (input.method === 'email') {
      if (!email) throw new AppError('Email address is required.', 400, 'E001');
      userQuery.email = email;
    } else {
      if (!mobile) throw new AppError('Mobile number is required.', 400, 'E001');
      userQuery.mobileNumber = mobile;
    }

    const user = await (UserModel as mongoose.Model<User>).findOne(userQuery).exec();
    if (!user) {
      throw new AppError('Authentication failed. User not found.', 401, 'E002');
    }

    if (user.accountStatus === 'Suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'E007');
    }
    if (user.accountStatus === 'Deactivated' || user.accountStatus === 'Deleted') {
      throw new AppError('Your account is not eligible for authentication.', 403, 'E042');
    }

    // Verify OTP
    const otpRecord = await otpService.verifyOtp({
      email: user.email,
      mobileNumber: input.method === 'mobile' ? user.mobileNumber : undefined,
      verificationType: 'LOGIN',
      otp: input.otp,
    });

    // Consume the verified OTP
    await otpService.consumeOtp(otpRecord._id);

    // Update user state if pending verification
    if (user.accountStatus === 'Pending Verification') {
      user.accountStatus = 'Active';
      user.emailVerified = true;
      if (input.method === 'mobile') {
        user.mobileVerified = true;
      }
    }
    user.lastLogin = new Date();
    await user.save();

    // Create session and rotating refresh token
    const { session, accessToken, rawRefreshToken } = await sessionService.createSession({
      user: user as unknown as User & { _id: mongoose.Types.ObjectId },
      loginMethod: input.method === 'email' ? 'Email' : 'Mobile Number',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await auditService.log({
      userId: user._id,
      roleId: user.roleId,
      actionCode: 'AUTH_OTP_VERIFIED',
      module: 'Authentication',
      actionTitle: 'Login Successful',
      description: `User successfully authenticated via ${input.method} OTP. Session ${session.sessionId} started.`,
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    return {
      user: user as unknown as User & { _id: mongoose.Types.ObjectId },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  public async requestRegisterOtp(input: RequestRegisterOtpInput): Promise<{ message: string }> {
    const email = this.normalizeEmail(input.email)!;
    const mobile = this.normalizeMobile(input.mobileNumber)!;
    const vehicleNumber = this.normalizeVehicleNumber(input.vehicleNumber);

    // Uniqueness checks
    const existingEmail = await (UserModel as mongoose.Model<User>).findOne({ email }).exec();
    if (existingEmail) {
      throw new AppError('An account with this email address already exists.', 409, 'E013');
    }

    const existingMobile = await (UserModel as mongoose.Model<User>)
      .findOne({ mobileNumber: mobile })
      .exec();
    if (existingMobile) {
      throw new AppError('An account with this mobile number already exists.', 409, 'E014');
    }

    const existingVehicle = await (VehicleModel as mongoose.Model<Vehicle>)
      .findOne({ vehicleNumber })
      .exec();
    if (existingVehicle) {
      throw new AppError('This vehicle number is already registered.', 409, 'E020');
    }

    // Generate Email OTP
    await otpService.requestOtp({
      email,
      verificationType: 'REGISTRATION_EMAIL',
      deliveryMethod: 'Email',
      purposeLabel: 'Customer Registration Email Verification',
    });

    // Generate Mobile OTP (delivered to email in V1 as per specification)
    await otpService.requestOtp({
      email,
      mobileNumber: mobile,
      verificationType: 'REGISTRATION_MOBILE',
      deliveryMethod: 'Email',
      purposeLabel: 'Customer Registration Mobile Verification',
    });

    await auditService.log({
      actionCode: 'AUTH_OTP_REQUESTED',
      module: 'Authentication',
      actionTitle: 'Registration OTPs Requested',
      description: `Registration OTP challenges created for email ${email} and mobile ${mobile}.`,
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    return {
      message: 'Verification codes for email and mobile have been sent to your email address.',
    };
  }

  public async verifyRegisterOtpAndCreateAccount(input: VerifyRegisterOtpInput): Promise<{
    user: User & { _id: mongoose.Types.ObjectId };
    accessToken: string;
    refreshToken: string;
  }> {
    const email = this.normalizeEmail(input.email)!;
    const mobile = this.normalizeMobile(input.mobileNumber)!;
    const vehicleNumber = this.normalizeVehicleNumber(input.vehicleNumber);

    // Re-verify uniqueness
    const existingEmail = await (UserModel as mongoose.Model<User>).findOne({ email }).exec();
    if (existingEmail) {
      throw new AppError('An account with this email address already exists.', 409, 'E013');
    }
    const existingMobile = await (UserModel as mongoose.Model<User>)
      .findOne({ mobileNumber: mobile })
      .exec();
    if (existingMobile) {
      throw new AppError('An account with this mobile number already exists.', 409, 'E014');
    }
    const existingVehicle = await (VehicleModel as mongoose.Model<Vehicle>)
      .findOne({ vehicleNumber })
      .exec();
    if (existingVehicle) {
      throw new AppError('This vehicle number is already registered.', 409, 'E020');
    }

    // Verify both OTPs
    const emailOtpRecord = await otpService.verifyOtp({
      email,
      verificationType: 'REGISTRATION_EMAIL',
      otp: input.emailOtp,
    });

    const mobileOtpRecord = await otpService.verifyOtp({
      email,
      mobileNumber: mobile,
      verificationType: 'REGISTRATION_MOBILE',
      otp: input.mobileOtp,
    });

    // Consume both OTPs
    await otpService.consumeOtp(emailOtpRecord._id);
    await otpService.consumeOtp(mobileOtpRecord._id);

    // Resolve CUSTOMER role from existing database data (do NOT seed or create)
    const customerRole = await (RoleModel as mongoose.Model<Role>)
      .findOne({ roleCode: 'CUSTOMER', isActive: true })
      .exec();
    if (!customerRole) {
      throw new AppError('Customer role is not configured in the system.', 500, 'E031');
    }

    // Create User
    const user = await (UserModel as mongoose.Model<User>).create({
      fullName: input.fullName.trim(),
      email,
      mobileNumber: mobile,
      roleId: customerRole._id,
      profileImage: null,
      dateOfBirth: null,
      gender: 'Prefer Not To Say',
      accountStatus: 'Active',
      emailVerified: true,
      mobileVerified: true,
      lastLogin: new Date(),
      preferredLanguage: 'English',
      timezone: 'Asia/Kolkata',
    });

    // Create initial Vehicle per approved resolution
    await (VehicleModel as mongoose.Model<Vehicle>).create({
      customerId: user._id,
      vehicleNumber,
      vehicleType: input.vehicleType,
      vehicleBrand: 'Standard',
      vehicleModel: 'Standard',
      vehicleColor: null,
      manufacturingYear: null,
      fuelType: input.vehicleType === 'EV' ? 'Electric' : 'Petrol',
      isDefault: true,
      rcVerified: false,
      vehicleStatus: 'Active',
      remarks: null,
    });

    // Create in-app Welcome Notification per dbproject-5.txt
    const notifRef = `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await (NotificationModel as mongoose.Model<Notification>).create({
      notificationReference: notifRef,
      userId: user._id,
      senderId: null,
      bookingId: null,
      paymentId: null,
      templateId: null,
      notificationType: 'Account',
      eventType: 'Customer Registration Successful',
      title: 'Welcome to ParkEase',
      message:
        'Your customer account has been created successfully. Explore available parking slots near you.',
      priority: 'Normal',
      deliveryChannel: 'In-App',
      deliveryStatus: 'Delivered',
      deliveredAt: new Date(),
      isRead: false,
      readAt: null,
      actionUrl: '/customer/dashboard',
      metadata: {},
      expiresAt: null,
    });

    // Send Welcome Email
    await emailService.sendWelcomeEmail(user.email, user.fullName);

    // Create Session and Refresh Token
    const { session, accessToken, rawRefreshToken } = await sessionService.createSession({
      user: user as unknown as User & { _id: mongoose.Types.ObjectId },
      loginMethod: 'Email',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    // Audit logs
    await auditService.log({
      userId: user._id,
      roleId: user.roleId,
      actionCode: 'USER_CREATED',
      module: 'User Management',
      actionTitle: 'Customer Account Created',
      description: `Customer account registered for ${user.email} with initial vehicle ${vehicleNumber}.`,
      targetCollection: 'users',
      targetDocumentId: user._id,
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    await auditService.log({
      userId: user._id,
      roleId: user.roleId,
      actionCode: 'AUTH_OTP_VERIFIED',
      module: 'Authentication',
      actionTitle: 'Registration OTP Verified',
      description: `Registration OTPs successfully verified for ${user.email}. Session ${session.sessionId} initialized.`,
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    return {
      user: user as unknown as User & { _id: mongoose.Types.ObjectId },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  public async resendOtp(params: {
    identifier: string;
    type: 'LOGIN' | 'REGISTRATION_EMAIL' | 'REGISTRATION_MOBILE';
    deliveryMethod?: 'Email' | 'SMS' | undefined;
  }): Promise<{ message: string; cooldownSeconds: number }> {
    const isEmail = params.identifier.includes('@');
    const email = isEmail ? this.normalizeEmail(params.identifier) : null;
    const mobile = !isEmail ? this.normalizeMobile(params.identifier) : null;

    let userId: mongoose.Types.ObjectId | null = null;
    if (params.type === 'LOGIN') {
      const user = await (UserModel as mongoose.Model<User>)
        .findOne(email ? { email } : { mobileNumber: mobile })
        .exec();
      if (user) {
        userId = user._id;
      }
    }

    return otpService.requestOtp({
      userId,
      email: email ?? undefined,
      mobileNumber: mobile ?? undefined,
      verificationType: params.type,
      deliveryMethod: params.deliveryMethod || 'Email',
      purposeLabel: params.type.replace(/_/g, ' '),
    });
  }

  public async getCurrentUser(userId: string): Promise<Record<string, unknown>> {
    const user = await (UserModel as mongoose.Model<User>)
      .findOne({ _id: userId })
      .populate('roleId')
      .exec();
    if (!user) {
      throw new AppError('User not found.', 404, 'E009');
    }

    // Also fetch vehicles if customer
    const vehicles = await (VehicleModel as mongoose.Model<Vehicle>)
      .find({ customerId: user._id, vehicleStatus: 'Active' })
      .exec();

    return {
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.roleId,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified,
        lastLogin: user.lastLogin,
        preferredLanguage: user.preferredLanguage,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      vehicles,
    };
  }
}

export const authService = new AuthService();
