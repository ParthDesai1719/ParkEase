export type RoleCode =
  | 'CUSTOMER'
  | 'PARKING_OWNER'
  | 'OWNER'
  | 'SECURITY_STAFF'
  | 'SECURITY'
  | 'ADMIN';

export interface Role {
  _id: string;
  roleName: string;
  roleCode: RoleCode | string;
  description?: string;
  permissions?: string[];
  dashboardRoute: string;
  isSystemRole?: boolean;
  isActive?: boolean;
}

export type AccountStatus =
  'Pending Verification' | 'Pending Approval' | 'Active' | 'Suspended' | 'Deactivated' | 'Deleted';

export type VehicleType = 'Bike' | 'Car' | 'SUV' | 'EV';

export interface Vehicle {
  _id: string;
  customerId?: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor?: string | null;
  manufacturingYear?: number | null;
  fuelType?: string;
  isDefault?: boolean;
  vehicleStatus?: 'Active' | 'Inactive' | 'Suspended' | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  roleId?: Role | string;
  role?: Role;
  profileImage?: string | null;
  dateOfBirth?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer Not To Say';
  accountStatus: AccountStatus;
  emailVerified?: boolean;
  mobileVerified?: boolean;
  preferredLanguage?: 'English' | 'Hindi' | 'Gujarati' | string;
  timezone?: string;
  lastLogin?: string | null;
  isFirstLogin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errorCode?: string;
  timestamp?: string;
}

// Request & Response Payloads matching backend endpoints

export type LoginMethod = 'email' | 'mobile';

export interface RequestLoginOtpPayload {
  method: LoginMethod;
  email?: string;
  mobileNumber?: string;
}

export interface RequestLoginOtpResponse {
  cooldownSeconds: number;
}

export interface VerifyLoginOtpPayload {
  method: LoginMethod;
  email?: string;
  mobileNumber?: string;
  otp: string;
}

export interface VerifyLoginOtpResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface RequestRegisterOtpPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  termsAccepted: boolean;
}

export interface RequestRegisterOtpResponse {
  cooldownSeconds: number;
  email: string;
  mobileNumber: string;
}

export interface VerifyRegisterOtpPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleBrand: string;
  vehicleModel: string;
  termsAccepted: boolean;
  emailOtp: string;
  mobileOtp: string;
}

export interface VerifyRegisterOtpResponse {
  user: User;
  vehicle: Vehicle;
  accessToken: string;
  refreshToken?: string;
}

export type OtpPurpose = 'LOGIN' | 'REGISTRATION_EMAIL' | 'REGISTRATION_MOBILE';

export interface ResendOtpPayload {
  identifier: string;
  type: OtpPurpose;
  deliveryMethod?: 'Email' | 'SMS';
}

export interface ResendOtpResponse {
  cooldownSeconds: number;
}

export interface RefreshTokenPayload {
  refreshToken?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface LogoutPayload {
  refreshToken?: string;
}

export interface GetMeResponse {
  user: User;
  vehicles: Vehicle[];
}
