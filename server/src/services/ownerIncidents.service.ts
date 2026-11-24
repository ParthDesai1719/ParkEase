import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { IncidentModel, type Incident } from '../models/Incident.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { UserModel, type User } from '../models/User.js';
import { BookingModel } from '../models/Booking.js';
import { VehicleModel } from '../models/Vehicle.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { NotificationModel } from '../models/Notification.js';
import { emitNewNotification, emitIncidentUpdate } from '../socket.js';
import { AppError } from '../utils/AppError.js';

// Ensure Mongoose schema references are registered
void BookingModel;
void VehicleModel;

export interface OwnerIncidentItem {
  _id: string;
  incidentReference: string;
  parkingLotId: string;
  parkingName: string;
  bookingId: string | null;
  bookingReference?: string | null;
  vehicleId: string | null;
  vehicleNumber?: string | null;
  vehicleType?: string | null;
  customerId: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  reportedBy: {
    userId: string;
    fullName: string;
    role?: string;
  };
  incidentSource: string;
  incidentType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  incidentStatus: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
  title: string;
  description: string;
  attachments: string[];
  location: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  closedAt: Date | null;
  responses: Array<{
    responseId: string;
    authorId: string;
    authorRole: string;
    authorName: string;
    message: string;
    attachments: string[];
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OwnerIncidentListResult {
  incidents: OwnerIncidentItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    open: number;
    underInvestigation: number;
    resolved: number;
    closed: number;
    criticalOrHigh: number;
  };
  ownerLots: Array<{ _id: string; parkingName: string; address?: string }>;
}

export class OwnerIncidentsService {
  /**
   * Helper: verify lot ownership for the authenticated owner
   */
  private async getAuthorizedLotIds(ownerId: string, parkingLotId?: string | undefined): Promise<{
    ownerLots: Array<{ _id: string; parkingName: string; address?: string }>;
    targetLotIds: mongoose.Types.ObjectId[];
  }> {
    const ownerObjId = new mongoose.Types.ObjectId(ownerId);
    const rawLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: ownerObjId })
      .select('_id parkingName address city')
      .lean()
      .exec();

    const ownerLots = rawLots.map((l: any) => ({
      _id: l._id.toString(),
      parkingName: l.parkingName || 'Unnamed Facility',
      address: typeof l.address === 'string' ? l.address : l.address?.city || '',
    }));

    const allLotObjIds = rawLots.map((l: any) => l._id as mongoose.Types.ObjectId);

    if (parkingLotId && parkingLotId !== 'all') {
      if (!mongoose.isValidObjectId(parkingLotId)) {
        throw new AppError('Invalid parking lot ID parameter.', 400, 'INVALID_LOT_ID');
      }
      const isOwned = allLotObjIds.some((id) => id.toString() === parkingLotId);
      if (!isOwned) {
        throw new AppError('Unauthorized access to parking facility.', 403, 'FORBIDDEN_LOT_ACCESS');
      }
      return { ownerLots, targetLotIds: [new mongoose.Types.ObjectId(parkingLotId)] };
    }

    return { ownerLots, targetLotIds: allLotObjIds };
  }

  /**
   * Helper: map raw mongoose incident doc to standard response item
   */
  private mapIncidentItem(inc: any): OwnerIncidentItem {
    const lotId = inc.parkingLotId?._id ? inc.parkingLotId._id.toString() : inc.parkingLotId?.toString();
    return {
      _id: inc._id.toString(),
      incidentReference: inc.incidentReference,
      parkingLotId: lotId,
      parkingName: inc.parkingLotId?.parkingName || 'Assigned Parking Facility',
      bookingId: inc.bookingId?._id ? inc.bookingId._id.toString() : inc.bookingId ? inc.bookingId.toString() : null,
      bookingReference: inc.bookingId?.bookingReference || null,
      vehicleId: inc.vehicleId?._id ? inc.vehicleId._id.toString() : inc.vehicleId ? inc.vehicleId.toString() : null,
      vehicleNumber: inc.vehicleId?.vehicleNumber || null,
      vehicleType: inc.vehicleId?.vehicleType || null,
      customerId: inc.customerId?._id ? inc.customerId._id.toString() : inc.customerId ? inc.customerId.toString() : null,
      customerName: inc.customerId?.fullName || null,
      customerMobile: inc.customerId?.mobileNumber || null,
      reportedBy: {
        userId: inc.reportedBy?._id ? inc.reportedBy._id.toString() : inc.reportedBy?.toString(),
        fullName: inc.reportedBy?.fullName || 'Security Staff',
        role: 'SECURITY',
      },
      incidentSource: inc.incidentSource || 'Security Staff Report',
      incidentType: inc.incidentType,
      severity: inc.severity,
      incidentStatus: inc.incidentStatus,
      title: inc.title,
      description: inc.description,
      attachments: Array.isArray(inc.attachments) ? inc.attachments : [],
      location: inc.location || null,
      resolvedAt: inc.resolvedAt || null,
      resolutionNotes: inc.resolutionNotes || null,
      closedAt: inc.closedAt || null,
      responses: Array.isArray(inc.responses)
        ? inc.responses.map((r: any) => ({
            responseId: r.responseId || r._id?.toString(),
            authorId: r.authorId?._id ? r.authorId._id.toString() : r.authorId?.toString(),
            authorRole: r.authorRole,
            authorName: r.authorName,
            message: r.message,
            attachments: Array.isArray(r.attachments) ? r.attachments : [],
            createdAt: r.createdAt || new Date(),
          }))
        : [],
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    };
  }

  /**
   * Retrieves list of incidents scoped to the authenticated Owner's facilities.
   */
  public async getOwnerIncidents(params: {
    ownerId: string;
    parkingLotId?: string | undefined;
    status?: string | undefined;
    severity?: string | undefined;
    incidentType?: string | undefined;
    search?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }): Promise<OwnerIncidentListResult> {
    const { ownerId, parkingLotId, status, severity, incidentType, search, dateFrom, dateTo } = params;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const { ownerLots, targetLotIds } = await this.getAuthorizedLotIds(ownerId, parkingLotId);

    if (targetLotIds.length === 0) {
      return {
        incidents: [],
        pagination: { totalCount: 0, totalPages: 0, currentPage: page, limit },
        summary: { total: 0, open: 0, underInvestigation: 0, resolved: 0, closed: 0, criticalOrHigh: 0 },
        ownerLots: [],
      };
    }

    const match: Record<string, any> = {
      parkingLotId: { $in: targetLotIds },
    };

    if (status && ['Open', 'Under Investigation', 'Resolved', 'Closed'].includes(status)) {
      match.incidentStatus = status;
    }

    if (severity && ['Low', 'Medium', 'High', 'Critical'].includes(severity)) {
      match.severity = severity;
    }

    if (incidentType && incidentType.trim().length > 0) {
      match.incidentType = incidentType.trim();
    }

    if (search && search.trim().length > 0) {
      const s = search.trim();
      match.$or = [
        { incidentReference: { $regex: s, $options: 'i' } },
        { title: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
      ];
    }

    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom);
        if (!isNaN(dFrom.getTime())) match.createdAt.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo);
        if (!isNaN(dTo.getTime())) {
          dTo.setHours(23, 59, 59, 999);
          match.createdAt.$lte = dTo;
        }
      }
    }

    const [rawIncidents, totalCount, summaryAgg] = await Promise.all([
      (IncidentModel as mongoose.Model<Incident>)
        .find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reportedBy', 'fullName email')
        .populate('parkingLotId', 'parkingName address city')
        .populate('bookingId', 'bookingReference scheduledEntryTime scheduledExitTime')
        .populate('vehicleId', 'vehicleNumber vehicleType')
        .populate('customerId', 'fullName mobileNumber email')
        .lean()
        .exec(),
      (IncidentModel as mongoose.Model<Incident>).countDocuments(match),
      (IncidentModel as mongoose.Model<Incident>).aggregate([
        { $match: { parkingLotId: { $in: targetLotIds } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $eq: ['$incidentStatus', 'Open'] }, 1, 0] } },
            underInvestigation: { $sum: { $cond: [{ $eq: ['$incidentStatus', 'Under Investigation'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$incidentStatus', 'Resolved'] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ['$incidentStatus', 'Closed'] }, 1, 0] } },
            criticalOrHigh: {
              $sum: { $cond: [{ $in: ['$severity', ['Critical', 'High']] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const summary = summaryAgg[0] || {
      total: 0,
      open: 0,
      underInvestigation: 0,
      resolved: 0,
      closed: 0,
      criticalOrHigh: 0,
    };

    return {
      incidents: rawIncidents.map((inc) => this.mapIncidentItem(inc)),
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
      summary: {
        total: summary.total || 0,
        open: summary.open || 0,
        underInvestigation: summary.underInvestigation || 0,
        resolved: summary.resolved || 0,
        closed: summary.closed || 0,
        criticalOrHigh: summary.criticalOrHigh || 0,
      },
      ownerLots,
    };
  }

  /**
   * Retrieves single incident details verifying that the incident belongs to the Owner's lot.
   */
  public async getOwnerIncidentDetail(params: {
    ownerId: string;
    incidentId: string;
  }): Promise<OwnerIncidentItem> {
    const { ownerId, incidentId } = params;

    if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
      throw new AppError('Valid incident ID is required.', 400, 'INVALID_INCIDENT_ID');
    }

    const inc: any = await (IncidentModel as mongoose.Model<Incident>)
      .findById(incidentId)
      .populate('reportedBy', 'fullName email')
      .populate('parkingLotId', 'parkingName address city state')
      .populate('bookingId', 'bookingReference scheduledEntryTime scheduledExitTime bookingStatus')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel')
      .populate('customerId', 'fullName mobileNumber email')
      .lean()
      .exec();

    if (!inc) {
      throw new AppError('Incident report not found.', 404, 'INCIDENT_NOT_FOUND');
    }

    const lotId = inc.parkingLotId?._id ? inc.parkingLotId._id.toString() : inc.parkingLotId.toString();
    const isOwned = await (ParkingLotModel as mongoose.Model<ParkingLot>).exists({
      _id: new mongoose.Types.ObjectId(lotId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    if (!isOwned) {
      throw new AppError('Unauthorized access to facility incident.', 403, 'FORBIDDEN_LOT_ACCESS');
    }

    return this.mapIncidentItem(inc);
  }

  /**
   * Appends a communication response to an incident by the Parking Owner.
   */
  public async addOwnerIncidentResponse(params: {
    ownerId: string;
    incidentId: string;
    message: string;
    attachments?: string[] | undefined;
  }): Promise<OwnerIncidentItem> {
    const { ownerId, incidentId, message, attachments } = params;

    if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
      throw new AppError('Valid incident ID is required.', 400, 'INVALID_INCIDENT_ID');
    }

    const cleanMessage = (message || '').trim();
    if (cleanMessage.length < 1 || cleanMessage.length > 2000) {
      throw new AppError('Response message must be between 1 and 2000 characters.', 400, 'INVALID_MESSAGE');
    }

    const inc = await (IncidentModel as any).findById(incidentId).exec();
    if (!inc) {
      throw new AppError('Incident report not found.', 404, 'INCIDENT_NOT_FOUND');
    }

    const lotId = inc.parkingLotId.toString();
    const isOwned = await (ParkingLotModel as any).exists({
      _id: new mongoose.Types.ObjectId(lotId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    if (!isOwned) {
      throw new AppError('Unauthorized access to facility incident.', 403, 'FORBIDDEN_LOT_ACCESS');
    }

    if (inc.incidentStatus === 'Closed') {
      throw new AppError('Cannot add response to a closed incident.', 400, 'INCIDENT_ALREADY_CLOSED');
    }

    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerId).lean().exec();
    if (!ownerUser) {
      throw new AppError('Authenticated owner user not found.', 401, 'USER_NOT_FOUND');
    }

    const newResponse = {
      responseId: new mongoose.Types.ObjectId().toString(),
      authorId: ownerUser._id,
      authorRole: 'PARKING_OWNER',
      authorName: ownerUser.fullName || 'Facility Owner',
      message: cleanMessage,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: new Date(),
    };

    if (!Array.isArray(inc.responses)) {
      inc.responses = [];
    }
    inc.responses.push(newResponse);

    await inc.save();

    // Audit log
    await (AuditLogModel as any).create({
      userId: ownerUser._id,
      actionCode: 'INCIDENT_RESPONSE_RECORDED',
      module: 'Owner',
      actionTitle: `Owner Response Added to Incident ${inc.incidentReference}`,
      description: `Owner ${ownerUser.fullName} responded: "${cleanMessage.slice(0, 80)}..."`,
      targetCollection: 'incidents',
      targetDocumentId: inc._id,
      actionStatus: 'Success',
    });

    // Notify incident reporter (Security Staff)
    try {
      if (inc.reportedBy) {
        const notif = await (NotificationModel as any).create({
          notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          userId: inc.reportedBy,
          senderId: ownerUser._id,
          notificationType: 'Incident Response',
          eventType: 'INCIDENT_RESPONSE_RECORDED',
          title: `Owner Response: ${inc.incidentReference}`,
          message: `Facility Owner ${ownerUser.fullName} responded: "${cleanMessage.slice(0, 100)}..."`,
          priority: 'Normal',
          actionUrl: `/security/incidents`,
          metadata: { incidentId: inc._id.toString(), incidentReference: inc.incidentReference, parkingLotId: lotId },
        });
        emitNewNotification(inc.reportedBy.toString(), notif);
      }
    } catch {
      // Non-blocking
    }

    // Emit Socket.IO update
    emitIncidentUpdate({
      incidentId: inc._id.toString(),
      incidentReference: inc.incidentReference,
      parkingLotId: lotId,
      action: 'UPDATED',
      incidentType: inc.incidentType,
      severity: inc.severity,
      incidentStatus: inc.incidentStatus,
      title: inc.title,
      timestamp: new Date().toISOString(),
    });

    return this.getOwnerIncidentDetail({
      ownerId,
      incidentId: inc._id.toString(),
    });
  }

  /**
   * Updates incident status following strict lifecycle rules.
   */
  public async updateOwnerIncidentStatus(params: {
    ownerId: string;
    incidentId: string;
    status: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
    resolutionNotes?: string | undefined;
  }): Promise<OwnerIncidentItem> {
    const { ownerId, incidentId, status, resolutionNotes } = params;

    if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
      throw new AppError('Valid incident ID is required.', 400, 'INVALID_INCIDENT_ID');
    }

    const allowedStatuses = ['Open', 'Under Investigation', 'Resolved', 'Closed'];
    if (!allowedStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`, 400, 'INVALID_STATUS');
    }

    const inc = await (IncidentModel as any).findById(incidentId).exec();
    if (!inc) {
      throw new AppError('Incident report not found.', 404, 'INCIDENT_NOT_FOUND');
    }

    const lotId = inc.parkingLotId.toString();
    const isOwned = await (ParkingLotModel as any).exists({
      _id: new mongoose.Types.ObjectId(lotId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    if (!isOwned) {
      throw new AppError('Unauthorized access to facility incident.', 403, 'FORBIDDEN_LOT_ACCESS');
    }

    const prevStatus = inc.incidentStatus;

    if (prevStatus === 'Closed') {
      throw new AppError('Closed incidents are historically finalized and cannot be modified.', 400, 'INCIDENT_ALREADY_CLOSED');
    }

    if (status === 'Closed' && prevStatus !== 'Resolved') {
      throw new AppError('An incident must be marked Resolved before it can be Closed.', 400, 'CANNOT_CLOSE_UNRESOLVED');
    }

    if (status === 'Resolved' && (!resolutionNotes || resolutionNotes.trim().length === 0) && !inc.resolutionNotes) {
      throw new AppError('Resolution notes are required when resolving an incident.', 400, 'RESOLUTION_NOTES_REQUIRED');
    }

    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerId).lean().exec();
    if (!ownerUser) {
      throw new AppError('Authenticated owner user not found.', 401, 'USER_NOT_FOUND');
    }

    inc.incidentStatus = status as any;

    if (resolutionNotes !== undefined && resolutionNotes.trim().length > 0) {
      inc.resolutionNotes = resolutionNotes.trim();
    }

    if (status === 'Resolved') {
      inc.resolvedAt = new Date();
    } else if (status === 'Closed') {
      if (!inc.resolvedAt) inc.resolvedAt = new Date();
      inc.closedAt = new Date();
    }

    await inc.save();

    // Audit log
    await (AuditLogModel as any).create({
      userId: ownerUser._id,
      actionCode: 'INCIDENT_STATUS_UPDATED',
      module: 'Owner',
      actionTitle: `Incident Status Updated to ${status}`,
      description: `Owner ${ownerUser.fullName} updated incident ${inc.incidentReference} status from ${prevStatus} to ${status}. Notes: ${resolutionNotes || 'None'}`,
      targetCollection: 'incidents',
      targetDocumentId: inc._id,
      actionStatus: 'Success',
    });

    // Notify incident reporter (Security Staff)
    try {
      if (inc.reportedBy) {
        const notif = await (NotificationModel as any).create({
          notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          userId: inc.reportedBy,
          senderId: ownerUser._id,
          notificationType: 'Incident Update',
          eventType: 'INCIDENT_STATUS_UPDATED',
          title: `Incident ${inc.incidentReference} ${status}`,
          message: `Facility Owner ${ownerUser.fullName} updated incident status to ${status}.`,
          priority: inc.severity === 'Critical' || inc.severity === 'High' ? 'Critical' : 'Normal',
          actionUrl: `/security/incidents`,
          metadata: { incidentId: inc._id.toString(), incidentReference: inc.incidentReference, parkingLotId: lotId },
        });
        emitNewNotification(inc.reportedBy.toString(), notif);
      }
    } catch {
      // Non-blocking
    }

    // Socket notification
    const actionKey: 'RESOLVED' | 'CLOSED' | 'UPDATED' =
      status === 'Resolved' ? 'RESOLVED' : status === 'Closed' ? 'CLOSED' : 'UPDATED';

    emitIncidentUpdate({
      incidentId: inc._id.toString(),
      incidentReference: inc.incidentReference,
      parkingLotId: lotId,
      action: actionKey,
      incidentType: inc.incidentType,
      severity: inc.severity,
      incidentStatus: status,
      title: inc.title,
      timestamp: new Date().toISOString(),
    });

    return this.getOwnerIncidentDetail({
      ownerId,
      incidentId: inc._id.toString(),
    });
  }
}

export const ownerIncidentsService = new OwnerIncidentsService();
