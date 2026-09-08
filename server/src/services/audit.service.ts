import type mongoose from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';

export interface CreateAuditLogParams {
  userId?: mongoose.Types.ObjectId | null | undefined;
  roleId?: mongoose.Types.ObjectId | null | undefined;
  actionCode: string;
  module:
    | 'Authentication'
    | 'User Management'
    | 'Account Management'
    | 'Vehicle Management'
    | 'Parking Management'
    | 'Booking Management'
    | 'Payment Management'
    | 'Review Moderation'
    | 'Incident Management'
    | 'Notification Management'
    | 'Email Management'
    | 'Owner Application Management'
    | 'Staff Management'
    | 'System Configuration'
    | 'Security'
    | 'Audit Management';
  actionTitle: string;
  description?: string | null | undefined;
  targetCollection?: string | null | undefined;
  targetDocumentId?: mongoose.Types.ObjectId | null | undefined;
  beforeData?: Record<string, unknown> | null | undefined;
  afterData?: Record<string, unknown> | null | undefined;
  changedFields?: Record<string, unknown> | null | undefined;
  metadata?: Record<string, unknown> | undefined;
  ipAddress?: string | null | undefined;
  deviceInfo?: string | null | undefined;
  actionStatus?: 'Success' | 'Failed' | 'Blocked' | undefined;
}

class AuditService {
  public async log(params: CreateAuditLogParams): Promise<void> {
    try {
      await AuditLogModel.create({
        userId: params.userId ?? null,
        roleId: params.roleId ?? null,
        actionCode: params.actionCode,
        module: params.module,
        actionTitle: params.actionTitle.slice(0, 100),
        description: params.description ? params.description.slice(0, 1000) : null,
        targetCollection: params.targetCollection ?? null,
        targetDocumentId: params.targetDocumentId ?? null,
        beforeData: params.beforeData ?? null,
        afterData: params.afterData ?? null,
        changedFields: params.changedFields ?? null,
        metadata: params.metadata ?? {},
        ipAddress: params.ipAddress ?? null,
        deviceInfo: params.deviceInfo ? params.deviceInfo.slice(0, 300) : null,
        actionStatus: params.actionStatus ?? 'Success',
      });
    } catch (error) {
      console.error('Failed to create AuditLog:', error);
    }
  }
}

export const auditService = new AuditService();
