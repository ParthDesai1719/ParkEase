import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { NotificationModel, type Notification } from '../models/Notification.js';
import { RoleModel, type Role } from '../models/Role.js';
import { UserModel, type User } from '../models/User.js';
import { OwnerApplicationModel, type OwnerApplication } from '../models/OwnerApplication.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { AppError } from '../utils/AppError.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { otpService, type DeliveryMethod } from './otp.service.js';
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
  vehicleBrand: string;
  vehicleModel: string;
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
  vehicleBrand: string;
  vehicleModel: string;
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
    if (!mobile) return null;
    const cleaned = mobile.trim().replace(/[\s-]/g, '');
    return cleaned.startsWith('+91') ? cleaned : `+91${cleaned}`;
  }

  private normalizeVehicleNumber(vehicleNumber: string): string {
    return vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, '');
  }

  /**
   * Validate that an applicant or user does not have an unapproved Parking Owner registration application.
   * Parking Owners are not permitted to log in (as a customer or otherwise) before administrator approval.
   */
  private async checkPendingOwnerApplication(
    user: (User & { _id: mongoose.Types.ObjectId }) | null,
    email: string | null,
    mobile: string | null,
  ): Promise<void> {
    const queryConditions: Record<string, unknown>[] = [];
    if (user?._id) queryConditions.push({ applicantId: user._id });
    if (email) queryConditions.push({ businessEmail: email });
    if (mobile) queryConditions.push({ businessPhone: mobile });

    if (queryConditions.length > 0) {
      const ownerApp = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
        .findOne({ $or: queryConditions })
        .sort({ createdAt: -1 })
        .exec();

      if (ownerApp && ownerApp.applicationStatus !== 'Approved') {
        if (ownerApp.applicationStatus === 'Pending Review' || ownerApp.applicationStatus === 'Submitted') {
          throw new AppError(
            `Your Parking Owner registration application (${ownerApp.applicationReference}) is currently pending administrator review and approval. You cannot log in until your application has been approved.`,
            403,
            'E043',
          );
        }

        if (ownerApp.applicationStatus === 'Draft') {
          throw new AppError(
            `Your Parking Owner registration application (${ownerApp.applicationReference}) is incomplete. Please complete your registration and payment to proceed.`,
            403,
            'E043',
          );
        }

        if (ownerApp.applicationStatus === 'Rejected') {
          throw new AppError(
            `Your Parking Owner registration application (${ownerApp.applicationReference}) was rejected${ownerApp.rejectionReason ? `: "${ownerApp.rejectionReason}"` : ''}. Please contact platform support.`,
            403,
            'E044',
          );
        }
      }
    }

    if (user) {
      if (user.accountStatus === 'Pending Approval') {
        throw new AppError(
          'Your account is currently pending administrator approval. You cannot log in until your application has been approved.',
          403,
          'E043',
        );
      }

      if (user.accountStatus === 'Pending Verification') {
        const userRole = await (RoleModel as mongoose.Model<Role>).findById(user.roleId).exec();
        const isSecurity = userRole?.roleCode === 'SECURITY' || userRole?.roleCode === 'SECURITY_STAFF';
        if (!isSecurity && (user as any).invitationStatus !== 'Sent') {
          throw new AppError(
            'Your account registration is pending verification. Please complete your registration process before logging in.',
            403,
            'E043',
          );
        }
      }
    }
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

    // Check if user is an unapproved Parking Owner applicant before allowing OTP request
    await this.checkPendingOwnerApplication(
      user as (User & { _id: mongoose.Types.ObjectId }) | null,
      email,
      mobile,
    );

    // If account does not exist, return an explicit 404 error with code E014 so the UI can direct them to registration
    if (!user) {
      throw new AppError(
        input.method === 'email'
          ? 'No account was found with this email address. Please register as a customer to get started.'
          : 'No account was found with this mobile number. Please register as a customer to get started.',
        404,
        'E014',
      );
    }

    // Check account status
    if (user.accountStatus === 'Suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'E007');
    }
    if (user.accountStatus === 'Deactivated' || user.accountStatus === 'Deleted') {
      throw new AppError('Your account is not eligible for authentication.', 403, 'E042');
    }

    const isEmailLogin = input.method === 'email';
    const result = await otpService.requestOtp({
      userId: user._id,
      email: isEmailLogin ? user.email : undefined,
      mobileNumber: !isEmailLogin ? user.mobileNumber : undefined,
      verificationType: 'LOGIN',
      deliveryMethod: isEmailLogin ? 'Email' : 'SMS',
      purposeLabel: isEmailLogin ? 'Email Login' : `Mobile Login (${user.mobileNumber})`,
    });

    await auditService.log({
      userId: user._id,
      roleId: user.roleId,
      actionCode: 'AUTH_OTP_REQUESTED',
      module: 'Authentication',
      actionTitle: 'Login OTP Requested',
      description: `Login OTP requested via ${input.method}. Delivered to ${isEmailLogin ? user.email : user.mobileNumber} in Mailpit.`,
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    return {
      message: isEmailLogin
        ? 'Verification code sent to your email in Mailpit.'
        : 'Verification code sent to your mobile number in Mailpit.',
      cooldownSeconds: result.cooldownSeconds,
    };
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

    // Check if user is an unapproved Parking Owner applicant before allowing login completion
    await this.checkPendingOwnerApplication(
      user as User & { _id: mongoose.Types.ObjectId },
      email,
      mobile,
    );

    if (user.accountStatus === 'Suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'E007');
    }
    if (user.accountStatus === 'Deactivated' || user.accountStatus === 'Deleted') {
      throw new AppError('Your account is not eligible for authentication.', 403, 'E042');
    }

    // Verify OTP
    const isEmailLogin = input.method === 'email';
    const otpRecord = await otpService.verifyOtp({
      email: isEmailLogin ? user.email : undefined,
      mobileNumber: !isEmailLogin ? user.mobileNumber : undefined,
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
      (user as any).invitationStatus = 'Accepted';
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

    await user.populate('roleId');
    const userObj = user.toObject();

    return {
      user: {
        ...userObj,
        role: user.roleId,
      } as unknown as User & { _id: mongoose.Types.ObjectId },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  public async requestRegisterOtp(input: RequestRegisterOtpInput): Promise<{
    message: string;
    cooldownSeconds: number;
    email: string;
    mobileNumber: string;
  }> {
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

    const existingOwnerApp = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({
        $or: [{ businessEmail: email }, { businessPhone: mobile }],
      })
      .exec();
    if (existingOwnerApp) {
      throw new AppError(
        `This ${existingOwnerApp.businessEmail === email ? 'email' : 'mobile number'} is associated with a Parking Owner registration (${existingOwnerApp.applicationReference}).`,
        409,
        'E013',
      );
    }

    const existingVehicle = await (VehicleModel as mongoose.Model<Vehicle>)
      .findOne({ vehicleNumber })
      .exec();
    if (existingVehicle) {
      throw new AppError('This vehicle number is already registered.', 409, 'E020');
    }

    // Generate Email OTP (delivered to user's email <email>)
    const emailOtpResult = await otpService.requestOtp({
      email,
      verificationType: 'REGISTRATION_EMAIL',
      deliveryMethod: 'Email',
      purposeLabel: 'Customer Registration Email Verification',
    });

    // Generate Mobile OTP (delivered to user's mobile number <mobileDigits>)
    await otpService.requestOtp({
      mobileNumber: mobile,
      verificationType: 'REGISTRATION_MOBILE',
      deliveryMethod: 'SMS',
      purposeLabel: 'Customer Registration Mobile Verification',
    });

    await auditService.log({
      actionCode: 'AUTH_OTP_REQUESTED',
      module: 'Authentication',
      actionTitle: 'Registration OTPs Requested',
      description: `Registration OTP challenges created: email OTP delivered to ${email} and mobile OTP delivered to ${mobile} in Mailpit.`,
      ipAddress: input.ipAddress,
      deviceInfo: input.userAgent,
      actionStatus: 'Success',
    });

    return {
      message: 'Verification codes for email and mobile have been sent to Mailpit.',
      cooldownSeconds: emailOtpResult.cooldownSeconds,
      email,
      mobileNumber: mobile,
    };
  }

  public async verifyRegisterOtpAndCreateAccount(input: VerifyRegisterOtpInput): Promise<{
    user: User & { _id: mongoose.Types.ObjectId };
    vehicle: Vehicle;
    accessToken: string;
    refreshToken: string;
  }> {
    const email = this.normalizeEmail(input.email)!;
    const mobile = this.normalizeMobile(input.mobileNumber)!;
    const vehicleNumber = this.normalizeVehicleNumber(input.vehicleNumber);

    // Re-verify uniqueness before final creation
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

    const existingOwnerApp = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne({
        $or: [{ businessEmail: email }, { businessPhone: mobile }],
      })
      .exec();
    if (existingOwnerApp) {
      throw new AppError(
        `This ${existingOwnerApp.businessEmail === email ? 'email' : 'mobile number'} is associated with a Parking Owner registration (${existingOwnerApp.applicationReference}).`,
        409,
        'E013',
      );
    }
    const existingVehicle = await (VehicleModel as mongoose.Model<Vehicle>)
      .findOne({ vehicleNumber })
      .exec();
    if (existingVehicle) {
      throw new AppError('This vehicle number is already registered.', 409, 'E020');
    }

    // Verify both OTPs
    let emailOtpRecord;
    let mobileOtpRecord;
    try {
      emailOtpRecord = await otpService.verifyOtp({
        email,
        verificationType: 'REGISTRATION_EMAIL',
        otp: input.emailOtp,
      });

      mobileOtpRecord = await otpService.verifyOtp({
        mobileNumber: mobile,
        verificationType: 'REGISTRATION_MOBILE',
        otp: input.mobileOtp,
      });
    } catch (err) {
      await auditService.log({
        actionCode: 'AUTH_OTP_FAILED',
        module: 'Authentication',
        actionTitle: 'Registration OTP Verification Failed',
        description: `Failed registration OTP verification attempt for email ${email} and mobile ${mobile}.`,
        ipAddress: input.ipAddress,
        deviceInfo: input.userAgent,
        actionStatus: 'Failed',
      });
      throw err;
    }

    // Consume both OTPs (enforcing single-use)
    await otpService.consumeOtp(emailOtpRecord._id);
    await otpService.consumeOtp(mobileOtpRecord._id);

    // Resolve CUSTOMER role from existing database data (do NOT seed or create)
    const customerRole = await (RoleModel as mongoose.Model<Role>)
      .findOne({ roleCode: 'CUSTOMER', isActive: true })
      .exec();
    if (!customerRole) {
      throw new AppError('Customer role is not configured in the system.', 500, 'E031');
    }

    // Atomic multi-document transaction for User, Vehicle, and Notification creation
    const mongoSession = await mongoose.startSession();
    let user: User & { _id: mongoose.Types.ObjectId };
    let vehicle: Vehicle;

    try {
      mongoSession.startTransaction();

      // 1. Create Customer User within transaction
      const [createdUser] = await (UserModel as mongoose.Model<User>).create(
        [
          {
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
          },
        ],
        { session: mongoSession },
      );

      user = createdUser as unknown as User & { _id: mongoose.Types.ObjectId };

      // 2. Create initial Vehicle within transaction
      const [createdVehicle] = await (VehicleModel as mongoose.Model<Vehicle>).create(
        [
          {
            customerId: user._id,
            vehicleNumber,
            vehicleType: input.vehicleType,
            vehicleBrand: input.vehicleBrand.trim(),
            vehicleModel: input.vehicleModel.trim(),
            vehicleColor: null,
            manufacturingYear: null,
            fuelType: input.vehicleType === 'EV' ? 'Electric' : 'Petrol',
            isDefault: true,
            rcVerified: false,
            vehicleStatus: 'Active',
            remarks: null,
          },
        ],
        { session: mongoSession },
      );

      vehicle = createdVehicle as unknown as Vehicle;

      // 3. Create in-app Welcome Notification per dbproject-5.txt within transaction
      const notifRef = `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await (NotificationModel as mongoose.Model<Notification>).create(
        [
          {
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
          },
        ],
        { session: mongoSession },
      );

      await mongoSession.commitTransaction();
    } catch (dbError) {
      await mongoSession.abortTransaction();
      throw dbError;
    } finally {
      await mongoSession.endSession();
    }

    // 4. Send Welcome Email
    await emailService.sendWelcomeEmail(user.email, user.fullName);

    // 5. Create Session and Refresh Token
    const { session, accessToken, rawRefreshToken } = await sessionService.createSession({
      user: user as unknown as User & { _id: mongoose.Types.ObjectId },
      loginMethod: 'Email',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    // 6. Audit logs
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

    const userObj =
      typeof (user as unknown as mongoose.Document).toObject === 'function'
        ? (user as unknown as mongoose.Document).toObject()
        : (user as Record<string, unknown>);

    return {
      user: {
        ...userObj,
        role: customerRole,
      } as unknown as User & { _id: mongoose.Types.ObjectId },
      vehicle,
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
    let deliveryEmail = email;
    let deliveryMethod: DeliveryMethod = params.deliveryMethod || 'Email';

    if (params.type === 'LOGIN') {
      const user = await (UserModel as mongoose.Model<User>)
        .findOne(email ? { email } : { mobileNumber: mobile })
        .exec();
      if (!user) {
        throw new AppError(
          isEmail
            ? 'No account was found with this email address.'
            : 'No account was found with this mobile number.',
          404,
          'E014',
        );
      }
      userId = user._id;
      deliveryEmail = isEmail ? user.email : null;
      deliveryMethod = isEmail ? 'Email' : 'SMS';
    } else if (params.type === 'REGISTRATION_MOBILE') {
      deliveryMethod = 'SMS';
      deliveryEmail = null;
    } else if (params.type === 'REGISTRATION_EMAIL') {
      deliveryMethod = 'Email';
    }

    const purposeLabel =
      params.type === 'REGISTRATION_EMAIL'
        ? 'Customer Registration Email Verification'
        : params.type === 'REGISTRATION_MOBILE'
          ? 'Customer Registration Mobile Verification'
          : isEmail
            ? 'Email Login'
            : `Mobile Login (${mobile || params.identifier})`;

    return otpService.requestOtp({
      userId,
      email: deliveryEmail ?? undefined,
      mobileNumber: mobile ?? undefined,
      verificationType: params.type,
      deliveryMethod,
      purposeLabel,
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
        roleId: user.roleId,
        profileImage: user.profileImage,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
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
