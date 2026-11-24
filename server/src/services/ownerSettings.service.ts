import mongoose from 'mongoose';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { UserModel, type User } from '../models/User.js';
import { SystemSettingsModel, type SystemSettings } from '../models/SystemSettings.js';
import { AppError } from '../utils/AppError.js';

export interface OwnerBusinessSettingsFacility {
  _id: string;
  parkingName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  contactNumber: string;
  supportEmail: string | null;
  openingTime: string;
  closingTime: string;
  isOpen24Hours: boolean;
  operatingDays: string[];
  hourlyRate: number;
  gracePeriodMinutes: number;
  exitGracePeriodMinutes: number;
  maxBookingDurationHours: number;
  allowOnlineBookings: boolean;
  allowWalkInBookings: boolean;
  overstayGracePeriodMinutes: number;
  overstayChargeMultiplier: number;
  timezone: string;
  currency: string;
  parkingStatus: string;
  isVerified: boolean;
}

export interface OwnerBusinessSettingsResponse {
  facilities: OwnerBusinessSettingsFacility[];
  selectedFacility: OwnerBusinessSettingsFacility | null;
  businessProfile: {
    ownerName: string;
    email: string;
    mobileNumber: string;
    timezone: string;
  };
  platformGovernance: {
    refundPolicyDescription: string;
    noShowThresholdPercentage: number;
    noShowRefundPercentage: number;
    platformBookingFee: number;
    taxRatePercentage: number;
    defaultCurrency: string;
  };
}

export interface UpdateOwnerBusinessSettingsInput {
  parkingLotId: string;
  // Business Profile
  contactNumber?: string;
  supportEmail?: string | null;
  // Operating Hours
  isOpen24Hours?: boolean;
  openingTime?: string;
  closingTime?: string;
  operatingDays?: string[];
  // Booking Config
  gracePeriodMinutes?: number;
  exitGracePeriodMinutes?: number;
  maxBookingDurationHours?: number;
  allowOnlineBookings?: boolean;
  allowWalkInBookings?: boolean;
  // Overstay Config
  overstayGracePeriodMinutes?: number;
  overstayChargeMultiplier?: number;
  // Pricing
  hourlyRate?: number;
}

export async function getOwnerBusinessSettings(
  ownerId: string,
  parkingLotId?: string,
): Promise<OwnerBusinessSettingsResponse> {
  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    throw new AppError('Invalid owner ID format.', 400, 'INVALID_OWNER_ID');
  }

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

  // 1. Fetch Owner Profile
  const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerObjectId).lean();
  if (!ownerUser) {
    throw new AppError('Owner account not found.', 404, 'USER_NOT_FOUND');
  }

  // 2. Fetch All Facilities for Owner
  const rawLots = await (ParkingLotModel as any)
    .find({
      ownerId: { $in: [ownerObjectId, ownerId] },
      parkingStatus: { $ne: 'Deleted' },
    })
    .sort({ parkingName: 1 })
    .lean()
    .exec();

  const facilities: OwnerBusinessSettingsFacility[] = rawLots.map((lot: any) => ({
    _id: lot._id.toString(),
    parkingName: lot.parkingName,
    address: lot.address,
    city: lot.city,
    state: lot.state,
    postalCode: lot.postalCode,
    contactNumber: lot.contactNumber || ownerUser.mobileNumber,
    supportEmail: lot.supportEmail || ownerUser.email,
    openingTime: lot.openingTime || '00:00',
    closingTime: lot.closingTime || '23:59',
    isOpen24Hours: Boolean(lot.isOpen24Hours),
    operatingDays: lot.operatingDays || [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ],
    hourlyRate: Number(lot.hourlyRate || 0),
    gracePeriodMinutes: Number(lot.gracePeriodMinutes || 15),
    exitGracePeriodMinutes: Number(lot.exitGracePeriodMinutes || 15),
    maxBookingDurationHours: Number(lot.maxBookingDurationHours || 24),
    allowOnlineBookings: lot.allowOnlineBookings !== false,
    allowWalkInBookings: lot.allowWalkInBookings !== false,
    overstayGracePeriodMinutes: Number(lot.overstayGracePeriodMinutes || 15),
    overstayChargeMultiplier: Number(lot.overstayChargeMultiplier || 1.5),
    timezone: lot.timezone || 'Asia/Kolkata',
    currency: lot.currency || 'INR',
    parkingStatus: lot.parkingStatus || 'Active',
    isVerified: Boolean(lot.isVerified),
  }));

  // Determine active selected facility
  let selectedFacility: OwnerBusinessSettingsFacility | null = null;
  if (parkingLotId) {
    selectedFacility = facilities.find((f) => f._id === parkingLotId) ?? null;
  }
  if (!selectedFacility && facilities.length > 0) {
    selectedFacility = facilities[0] ?? null;
  }

  // 3. Platform Governance Settings (Non-overridable read-only rules)
  const systemSettings =
    (await (SystemSettingsModel as unknown as mongoose.Model<SystemSettings>)
      .findOne({ singletonKey: 'GLOBAL' })
      .lean()) ||
    (await (SystemSettingsModel as unknown as mongoose.Model<SystemSettings>)
      .findOne()
      .lean());

  return {
    facilities,
    selectedFacility,
    businessProfile: {
      ownerName: ownerUser.fullName,
      email: ownerUser.email,
      mobileNumber: ownerUser.mobileNumber,
      timezone: ownerUser.timezone || 'Asia/Kolkata',
    },
    platformGovernance: {
      refundPolicyDescription:
        systemSettings?.refundPolicyDescription ||
        'Full refund if cancelled before booking start time minus grace period. Standard platform cancellation rules apply.',
      noShowThresholdPercentage: systemSettings?.noShowThresholdPercentage ?? 50,
      noShowRefundPercentage: systemSettings?.noShowRefundPercentage ?? 40,
      platformBookingFee: systemSettings?.platformBookingFee ?? 0,
      taxRatePercentage: systemSettings?.taxRatePercentage ?? 18,
      defaultCurrency: systemSettings?.defaultCurrency || 'INR',
    },
  };
}

export async function updateOwnerBusinessSettings(
  ownerId: string,
  input: UpdateOwnerBusinessSettingsInput,
): Promise<OwnerBusinessSettingsFacility> {
  const { parkingLotId } = input;

  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    throw new AppError('Invalid owner ID format.', 400, 'INVALID_OWNER_ID');
  }
  if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
    throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_PARKING_LOT_ID');
  }

  const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(parkingLotId);
  if (!lot) {
    throw new AppError('Parking facility not found.', 404, 'NOT_FOUND');
  }

  // Ownership Enforcement
  const lotOwnerId = (lot.ownerId as any)?._id?.toString() || lot.ownerId?.toString();
  if (lotOwnerId !== ownerId) {
    throw new AppError('Access denied: You do not own this facility.', 403, 'FORBIDDEN');
  }

  const updates: Record<string, unknown> = {};

  // 1. Support Contact
  if (input.contactNumber !== undefined) {
    const trimmed = input.contactNumber.trim();
    if (!trimmed) {
      throw new AppError('Contact phone number cannot be empty.', 400, 'INVALID_CONTACT');
    }
    updates.contactNumber = trimmed;
  }

  // 2. Support Email
  if (input.supportEmail !== undefined) {
    if (input.supportEmail && input.supportEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.supportEmail.trim())) {
        throw new AppError('Invalid support email format.', 400, 'INVALID_EMAIL');
      }
      updates.supportEmail = input.supportEmail.trim();
    } else {
      updates.supportEmail = null;
    }
  }

  // 3. Operating Hours
  if (input.isOpen24Hours !== undefined) {
    updates.isOpen24Hours = Boolean(input.isOpen24Hours);
    if (updates.isOpen24Hours) {
      updates.openingTime = '00:00';
      updates.closingTime = '23:59';
    }
  }

  if (!updates.isOpen24Hours) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (input.openingTime !== undefined) {
      if (!timeRegex.test(input.openingTime)) {
        throw new AppError('Opening time must be in HH:mm format.', 400, 'INVALID_OPENING_TIME');
      }
      updates.openingTime = input.openingTime;
    }
    if (input.closingTime !== undefined) {
      if (!timeRegex.test(input.closingTime)) {
        throw new AppError('Closing time must be in HH:mm format.', 400, 'INVALID_CLOSING_TIME');
      }
      updates.closingTime = input.closingTime;
    }
  }

  if (input.operatingDays !== undefined) {
    if (!Array.isArray(input.operatingDays) || input.operatingDays.length === 0) {
      throw new AppError('At least one operating day must be selected.', 400, 'INVALID_OPERATING_DAYS');
    }
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const d of input.operatingDays) {
      if (!validDays.includes(d)) {
        throw new AppError(`Invalid day: "${d}".`, 400, 'INVALID_DAY');
      }
    }
    updates.operatingDays = input.operatingDays;
  }

  // 4. Booking Configuration
  if (input.gracePeriodMinutes !== undefined) {
    const gp = Number(input.gracePeriodMinutes);
    if (isNaN(gp) || gp < 0 || gp > 120) {
      throw new AppError('Booking grace period must be between 0 and 120 minutes.', 400, 'INVALID_GRACE');
    }
    updates.gracePeriodMinutes = gp;
  }

  if (input.exitGracePeriodMinutes !== undefined) {
    const egp = Number(input.exitGracePeriodMinutes);
    if (isNaN(egp) || egp < 0 || egp > 60) {
      throw new AppError('Exit grace period must be between 0 and 60 minutes.', 400, 'INVALID_EXIT_GRACE');
    }
    updates.exitGracePeriodMinutes = egp;
  }

  if (input.maxBookingDurationHours !== undefined) {
    const maxDur = Number(input.maxBookingDurationHours);
    if (isNaN(maxDur) || maxDur < 1 || maxDur > 168) {
      throw new AppError('Maximum booking duration must be between 1 and 168 hours (7 days).', 400, 'INVALID_MAX_DURATION');
    }
    updates.maxBookingDurationHours = maxDur;
  }

  if (input.allowOnlineBookings !== undefined) {
    updates.allowOnlineBookings = Boolean(input.allowOnlineBookings);
  }

  if (input.allowWalkInBookings !== undefined) {
    updates.allowWalkInBookings = Boolean(input.allowWalkInBookings);
  }

  // 5. Overstay Configuration
  if (input.overstayGracePeriodMinutes !== undefined) {
    const ogp = Number(input.overstayGracePeriodMinutes);
    if (isNaN(ogp) || ogp < 0 || ogp > 60) {
      throw new AppError('Overstay grace period must be between 0 and 60 minutes.', 400, 'INVALID_OVERSTAY_GRACE');
    }
    updates.overstayGracePeriodMinutes = ogp;
  }

  if (input.overstayChargeMultiplier !== undefined) {
    const mult = Number(input.overstayChargeMultiplier);
    if (isNaN(mult) || mult < 1 || mult > 5) {
      throw new AppError('Overstay charge multiplier must be between 1.0x and 5.0x.', 400, 'INVALID_OVERSTAY_MULTIPLIER');
    }
    updates.overstayChargeMultiplier = mult;
  }

  // 6. Hourly Rate
  if (input.hourlyRate !== undefined) {
    const rate = Number(input.hourlyRate);
    if (isNaN(rate) || rate < 0) {
      throw new AppError('Hourly rate must be a non-negative number.', 400, 'INVALID_HOURLY_RATE');
    }
    updates.hourlyRate = rate;
  }

  // Apply updates to ParkingLot
  const updatedLot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findByIdAndUpdate(
    parkingLotId,
    { $set: updates },
    { new: true, runValidators: true },
  ).lean();

  if (!updatedLot) {
    throw new AppError('Failed to update facility settings.', 500, 'UPDATE_FAILED');
  }

  const u = updatedLot as any;
  return {
    _id: u._id.toString(),
    parkingName: u.parkingName,
    address: u.address,
    city: u.city,
    state: u.state,
    postalCode: u.postalCode,
    contactNumber: u.contactNumber,
    supportEmail: u.supportEmail,
    openingTime: u.openingTime,
    closingTime: u.closingTime,
    isOpen24Hours: Boolean(u.isOpen24Hours),
    operatingDays: u.operatingDays || [],
    hourlyRate: Number(u.hourlyRate || 0),
    gracePeriodMinutes: Number(u.gracePeriodMinutes || 15),
    exitGracePeriodMinutes: Number(u.exitGracePeriodMinutes || 15),
    maxBookingDurationHours: Number(u.maxBookingDurationHours || 24),
    allowOnlineBookings: u.allowOnlineBookings !== false,
    allowWalkInBookings: u.allowWalkInBookings !== false,
    overstayGracePeriodMinutes: Number(u.overstayGracePeriodMinutes || 15),
    overstayChargeMultiplier: Number(u.overstayChargeMultiplier || 1.5),
    timezone: u.timezone || 'Asia/Kolkata',
    currency: u.currency || 'INR',
    parkingStatus: u.parkingStatus || 'Active',
    isVerified: Boolean(u.isVerified),
  };
}
