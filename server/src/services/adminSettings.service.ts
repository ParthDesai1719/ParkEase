import mongoose from 'mongoose';
import { z } from 'zod';
import { SystemSettingsModel, type SystemSettings } from '../models/SystemSettings.js';
import { auditService } from './audit.service.js';
import { AppError } from '../utils/AppError.js';

export const updateSettingsSchema = z.object({
  applicationName: z.string().trim().min(1).max(100).optional(),
  platformLogoUrl: z.string().trim().optional(),
  timezone: z.string().trim().min(1).optional(),
  defaultCurrency: z.string().trim().min(1).max(10).optional(),

  // Booking Rules
  bookingGracePeriodMinutes: z.number().min(0, 'Grace period cannot be negative').optional(),
  minimumBookingDurationHours: z.number().min(1, 'Minimum booking duration must be at least 1 hour').optional(),
  maximumBookingDurationHours: z.number().min(1, 'Maximum booking duration must be at least 1 hour').optional(),
  allowOnlineBookings: z.boolean().optional(),
  allowWalkInBookings: z.boolean().optional(),
  allowBookingExtensions: z.boolean().optional(),
  bookingAdvanceLimitDays: z.number().min(1).optional(),

  // Owner Onboarding
  ownerRegistrationFee: z.number().min(0, 'Owner registration fee cannot be negative').optional(),
  ownerRegistrationEnabled: z.boolean().optional(),
  ownerReviewSlaDays: z.number().min(1, 'Review SLA must be at least 1 day').optional(),
  refundPolicyDescription: z.string().trim().max(1000).optional(),
  refundPolicyEnabled: z.boolean().optional(),

  // Financial & Platform Fee
  taxRatePercentage: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%').optional(),
  platformBookingFee: z.number().min(0, 'Platform booking fee cannot be negative').optional(),

  // Maintenance & System
  maintenanceMode: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().min(5).optional(),
  noShowThresholdPercentage: z.number().min(1).max(100).optional(),
  noShowRefundPercentage: z.number().min(0).max(100).optional(),
}).refine(
  (data) => {
    if (
      data.minimumBookingDurationHours !== undefined &&
      data.maximumBookingDurationHours !== undefined
    ) {
      return data.maximumBookingDurationHours >= data.minimumBookingDurationHours;
    }
    return true;
  },
  {
    message: 'Maximum booking duration must be greater than or equal to minimum booking duration',
    path: ['maximumBookingDurationHours'],
  }
);

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export class AdminSettingsService {
  /**
   * Fetch current system settings, creating singleton defaults if not yet initialized.
   */
  public async getSettings(): Promise<SystemSettings> {
    let settings = await (SystemSettingsModel as unknown as mongoose.Model<SystemSettings>)
      .findOne({ singletonKey: 'GLOBAL' })
      .lean()
      .exec();

    if (!settings) {
      const created = await (SystemSettingsModel as unknown as mongoose.Model<SystemSettings>).create({
        singletonKey: 'GLOBAL',
        applicationName: 'ParkEase',
        platformLogoUrl: '',
        timezone: 'Asia/Kolkata',
        defaultCurrency: 'INR',
        ownerRegistrationFee: 999,
        ownerRegistrationEnabled: true,
        ownerReviewSlaDays: 3,
        refundPolicyDescription: 'Full refund if cancelled before booking start time minus grace period.',
        taxRatePercentage: 18,
        platformBookingFee: 0,
        allowOnlineBookings: true,
        allowWalkInBookings: true,
        minimumBookingDurationHours: 1,
        maximumBookingDurationHours: 24,
        bookingGracePeriodMinutes: 15,
        maintenanceMode: false,
      });
      settings = created.toObject();
    }

    return settings;
  }

  /**
   * Helper to fetch platform booking fee directly.
   */
  public async getPlatformBookingFee(): Promise<number> {
    const settings = await this.getSettings();
    return typeof settings.platformBookingFee === 'number' && settings.platformBookingFee >= 0
      ? settings.platformBookingFee
      : 0;
  }

  /**
   * Update system settings with validation, persistence, and audit logging.
   */
  public async updateSettings(
    rawInput: unknown,
    adminUserId?: string,
    roleId?: string
  ): Promise<SystemSettings> {
    const parseResult = updateSettingsSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid settings payload';
      throw new AppError(firstError, 400, 'INVALID_SETTINGS_PAYLOAD');
    }

    const validatedData = parseResult.data;
    const cleanedData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, v]) => v !== undefined)
    );

    // Fetch existing settings for audit diff
    let settingsDoc = await (SystemSettingsModel as unknown as mongoose.Model<SystemSettings>)
      .findOne({ singletonKey: 'GLOBAL' })
      .exec();

    if (!settingsDoc) {
      // Initialize if not present
      settingsDoc = await (SystemSettingsModel as unknown as mongoose.Model<SystemSettings>).create({
        singletonKey: 'GLOBAL',
        ...cleanedData,
        lastModifiedBy: adminUserId && mongoose.isValidObjectId(adminUserId) ? new mongoose.Types.ObjectId(adminUserId) : null,
      } as any);
    } else {
      const oldState = settingsDoc.toObject();

      // Check cross-field validation with existing values if only one duration is supplied
      const minDuration =
        validatedData.minimumBookingDurationHours ?? settingsDoc.minimumBookingDurationHours ?? 1;
      const maxDuration =
        validatedData.maximumBookingDurationHours ?? settingsDoc.maximumBookingDurationHours ?? 24;

      if (maxDuration < minDuration) {
        throw new AppError(
          'Maximum booking duration must be greater than or equal to minimum booking duration.',
          400,
          'INVALID_DURATION_RANGE'
        );
      }

      Object.assign(settingsDoc, cleanedData);
      if (adminUserId && mongoose.isValidObjectId(adminUserId)) {
        settingsDoc.lastModifiedBy = new mongoose.Types.ObjectId(adminUserId) as any;
      }
      await settingsDoc.save();

      // Audit Log
      await auditService.log({
        userId: adminUserId && mongoose.isValidObjectId(adminUserId) ? new mongoose.Types.ObjectId(adminUserId) : null,
        roleId: roleId && mongoose.isValidObjectId(roleId) ? new mongoose.Types.ObjectId(roleId) : null,
        actionCode: 'SETTINGS_UPDATED',
        module: 'System Configuration',
        actionTitle: 'Platform Settings Updated',
        description: `Updated platform settings fields: ${Object.keys(cleanedData).join(', ')}`,
        beforeData: oldState as unknown as Record<string, unknown>,
        afterData: settingsDoc.toObject() as unknown as Record<string, unknown>,
        actionStatus: 'Success',
      });
    }

    return settingsDoc.toObject();
  }
}

export const adminSettingsService = new AdminSettingsService();
