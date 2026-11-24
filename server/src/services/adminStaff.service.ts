import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import {
  AuditLogModel,
  BookingModel,
  IncidentModel,
  NotificationModel,
  OwnerApplicationModel,
  ParkingLotModel,
  RoleModel,
  SecurityStaffAssignmentModel,
  SessionModel,
  UserModel,
  VehicleMovementLogModel,
  type Role,
  type User,
  type ParkingLot,
} from '../models/index.js';
import { emailService } from './email.service.js';
import { emitNewNotification, emitStaffStatusUpdate } from '../socket.js';

export interface AdminStaffOverview {
  totalSecurityStaff: number;
  activeSecurityStaff: number;
  suspendedSecurityStaff: number;
  recentlyAddedStaff: number;
}

export interface AdminStaffQuery {
  search?: string | undefined;
  ownerId?: string | undefined;
  parkingLotId?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface AdminStaffListItem {
  _id: string;
  employeeId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: 'Security Staff';
  accountStatus: string;
  lastLogin: Date | null;
  createdAt: Date;
  owner: {
    _id: string;
    fullName: string;
    email: string;
    businessName?: string | undefined;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address?: string | undefined;
    city?: string | undefined;
  } | null;
  activeAssignmentsCount: number;
  assignment: {
    _id: string;
    assignmentStatus: 'Active' | 'Inactive';
    assignedAt: Date;
    assignmentReason?: string | null | undefined;
  } | null;
}

export interface AdminStaffListResult {
  staff: AdminStaffListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminStaffDetailResult {
  staff: {
    _id: string;
    employeeId: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    role: 'Security Staff';
    accountStatus: string;
    emailVerified: boolean;
    mobileVerified: boolean;
    createdAt: Date;
    lastLogin: Date | null;
    preferredLanguage: string;
    timezone: string;
    suspensionReason?: string | null | undefined;
    suspendedAt?: Date | null | undefined;
  };
  currentAssignment: {
    _id: string;
    parkingLotId: {
      _id: string;
      parkingName: string;
      address: string;
      city: string;
      totalCapacity?: number | undefined;
      parkingStatus?: string | undefined;
    };
    ownerId: {
      _id: string;
      fullName: string;
      email: string;
      mobileNumber?: string | undefined;
      businessName?: string | undefined;
    };
    assignedAt: Date;
    assignedBy?: {
      _id: string;
      fullName: string;
      email: string;
    } | null | undefined;
    assignmentReason?: string | null | undefined;
    assignmentStatus: string;
  } | null;
  assignmentHistory: Array<{
    _id: string;
    parkingLotId: {
      _id: string;
      parkingName: string;
      address: string;
      city: string;
    };
    ownerId: {
      _id: string;
      fullName: string;
      email: string;
      businessName?: string | undefined;
    };
    assignmentStatus: string;
    assignedAt: Date;
    unassignedAt?: Date | null | undefined;
    assignmentReason?: string | null | undefined;
  }>;
  operationalMetrics: {
    totalCheckIns: number;
    totalCheckOuts: number;
    totalWalkIns: number;
    totalIncidents: number;
  };
  activityLogs: Array<{
    _id: string;
    action: string;
    module: string;
    description: string;
    createdAt: Date;
    status: string;
    metadata?: Record<string, unknown> | undefined;
  }>;
}

export interface CreateAdminStaffInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  ownerId: string;
  parkingLotId: string;
  employeeId?: string | undefined;
  assignmentReason?: string | undefined;
}

export interface UpdateAdminStaffInput {
  fullName?: string | undefined;
  mobileNumber?: string | undefined;
  employeeId?: string | undefined;
}

export interface TransferAdminStaffInput {
  newOwnerId: string;
  newParkingLotId: string;
  transferReason?: string | undefined;
}

export class AdminStaffService {
  /**
   * Helper to resolve the Security Staff Role
   */
  private async getSecurityRole(): Promise<any> {
    const securityRole = await (RoleModel as any).findOne({
      roleCode: { $in: ['SECURITY', 'SECURITY_STAFF'] },
      isActive: true,
    });
    if (!securityRole) {
      throw new AppError('Security Staff role is not configured in the system.', 500, 'E031');
    }
    return securityRole;
  }

  /**
   * 1. Get KPI Overview Metrics for Security Staff Dashboard
   */
  public async getStaffOverview(): Promise<AdminStaffOverview> {
    const securityRole = await this.getSecurityRole();
    const staffFilter: Record<string, any> = {
      roleId: securityRole._id,
      accountStatus: { $ne: 'Deleted' },
    };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalSecurityStaff, activeSecurityStaff, suspendedSecurityStaff, recentlyAddedStaff] =
      await Promise.all([
        (UserModel as any).countDocuments(staffFilter),
        (UserModel as any).countDocuments({
          ...staffFilter,
          accountStatus: 'Active',
        }),
        (UserModel as any).countDocuments({
          ...staffFilter,
          accountStatus: 'Suspended',
        }),
        (UserModel as any).countDocuments({
          ...staffFilter,
          createdAt: { $gte: thirtyDaysAgo },
        }),
      ]);

    return {
      totalSecurityStaff,
      activeSecurityStaff,
      suspendedSecurityStaff,
      recentlyAddedStaff,
    };
  }

  /**
   * 2. Searchable, Sortable, Paginated Staff Directory
   */
  public async getStaffList(query: AdminStaffQuery = {}): Promise<AdminStaffListResult> {
    const securityRole = await this.getSecurityRole();

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const baseFilter: Record<string, any> = {
      roleId: securityRole._id,
      accountStatus: { $ne: 'Deleted' },
    };

    // Filter by status
    if (query.status && query.status !== 'All') {
      baseFilter.accountStatus = query.status;
    }

    // Filter by owner
    if (query.ownerId && query.ownerId !== 'All' && mongoose.Types.ObjectId.isValid(query.ownerId)) {
      const ownerStaffIds = await (SecurityStaffAssignmentModel as any)
        .find({
          ownerId: new mongoose.Types.ObjectId(query.ownerId),
          assignmentStatus: 'Active',
        })
        .distinct('securityStaffId');

      baseFilter._id = { $in: ownerStaffIds };
    }

    // Filter by parking lot
    if (
      query.parkingLotId &&
      query.parkingLotId !== 'All' &&
      mongoose.Types.ObjectId.isValid(query.parkingLotId)
    ) {
      const lotStaffIds = await (SecurityStaffAssignmentModel as any)
        .find({
          parkingLotId: new mongoose.Types.ObjectId(query.parkingLotId),
          assignmentStatus: 'Active',
        })
        .distinct('securityStaffId');

      if (baseFilter._id && '$in' in baseFilter._id) {
        const existing = (baseFilter._id.$in as mongoose.Types.ObjectId[]).map((id) =>
          id.toString(),
        );
        const intersected = lotStaffIds.filter((id: any) => existing.includes(id.toString()));
        baseFilter._id = { $in: intersected };
      } else {
        baseFilter._id = { $in: lotStaffIds };
      }
    }

    // Search filter across Employee ID, Name, Email, Mobile Number, Parking Lot
    if (query.search && query.search.trim()) {
      const rawSearch = query.search.trim();
      const escaped = rawSearch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      // Also find parking lots matching search to include staff assigned to those lots
      const matchingLots = await (ParkingLotModel as any)
        .find({ parkingName: searchRegex })
        .select('_id')
        .lean();

      let lotStaffIdsFromSearch: mongoose.Types.ObjectId[] = [];
      if (matchingLots.length > 0) {
        lotStaffIdsFromSearch = await (SecurityStaffAssignmentModel as any)
          .find({
            parkingLotId: { $in: matchingLots.map((l: any) => l._id) },
            assignmentStatus: 'Active',
          })
          .distinct('securityStaffId');
      }

      const orConditions: Array<Record<string, any>> = [
        { fullName: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex },
        { employeeId: searchRegex },
      ];

      if (lotStaffIdsFromSearch.length > 0) {
        orConditions.push({ _id: { $in: lotStaffIdsFromSearch } });
      }

      if (baseFilter.$and) {
        baseFilter.$and.push({ $or: orConditions });
      } else {
        baseFilter.$or = orConditions;
      }
    }

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sortOptions: Record<string, 1 | -1> = { [sortField]: sortDir };

    const [total, staffUsers] = await Promise.all([
      (UserModel as any).countDocuments(baseFilter),
      (UserModel as any)
        .find(baseFilter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const staffIds = staffUsers.map((u: any) => u._id);

    // Fetch active assignments for all these staff members
    const assignments = await (SecurityStaffAssignmentModel as any)
      .find({
        securityStaffId: { $in: staffIds },
        assignmentStatus: 'Active',
      })
      .populate('parkingLotId', 'parkingName address city')
      .populate('ownerId', 'fullName email businessName')
      .sort({ assignedAt: -1 })
      .lean();

    // Map business names for owners from OwnerApplication if needed
    const ownerIds = assignments.map((a: any) => a.ownerId?._id).filter(Boolean);
    const ownerApps = await (OwnerApplicationModel as any)
      .find({ applicantId: { $in: ownerIds }, applicationStatus: 'Approved' })
      .select('applicantId businessName')
      .lean();

    const ownerBizMap = new Map<string, string>();
    for (const app of ownerApps) {
      if (app.applicantId && app.businessName) {
        ownerBizMap.set(app.applicantId.toString(), app.businessName);
      }
    }

    // Group assignments by staffId
    const assignmentMap = new Map<string, any[]>();
    for (const a of assignments) {
      const sId = (a.securityStaffId as mongoose.Types.ObjectId).toString();
      const existing = assignmentMap.get(sId) || [];
      existing.push(a);
      assignmentMap.set(sId, existing);
    }

    const staffList: AdminStaffListItem[] = staffUsers.map((user: any) => {
      const userAssignments = assignmentMap.get(user._id.toString()) || [];
      const primaryAssignment = userAssignments[0] || null;

      let ownerData = null;
      let lotData = null;

      if (primaryAssignment) {
        if (primaryAssignment.ownerId) {
          const o = primaryAssignment.ownerId;
          const bizName = ownerBizMap.get(o._id.toString()) || o.businessName || '';
          ownerData = {
            _id: o._id.toString(),
            fullName: o.fullName || 'Parking Owner',
            email: o.email || '',
            businessName: bizName,
          };
        }

        if (primaryAssignment.parkingLotId) {
          const l = primaryAssignment.parkingLotId;
          lotData = {
            _id: l._id.toString(),
            parkingName: l.parkingName || 'Assigned Facility',
            address: l.address || '',
            city: l.city || '',
          };
        }
      }

      return {
        _id: user._id.toString(),
        employeeId: user.employeeId || `SEC-${user._id.toString().slice(-6).toUpperCase()}`,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: 'Security Staff',
        accountStatus: user.accountStatus,
        lastLogin: user.lastLogin || null,
        createdAt: user.createdAt || new Date(),
        owner: ownerData,
        parkingLot: lotData,
        activeAssignmentsCount: userAssignments.length,
        assignment: primaryAssignment
          ? {
              _id: primaryAssignment._id.toString(),
              assignmentStatus: primaryAssignment.assignmentStatus,
              assignedAt: primaryAssignment.assignedAt,
              assignmentReason: primaryAssignment.assignmentReason || undefined,
            }
          : null,
      };
    });

    return {
      staff: staffList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Helper to list approved owners for dropdown filtering/creation
   */
  public async getOwnerOptions(): Promise<
    Array<{ _id: string; fullName: string; email: string; businessName: string }>
  > {
    const ownerRole = await (RoleModel as any).findOne({
      roleCode: { $in: ['OWNER', 'PARKING_OWNER'] },
      isActive: true,
    });
    if (!ownerRole) return [];

    const owners = await (UserModel as any)
      .find({
        roleId: ownerRole._id,
        accountStatus: { $in: ['Active', 'Pending Approval'] },
      })
      .select('_id fullName email')
      .lean();

    const ownerIds = owners.map((o: any) => o._id);
    const apps = await (OwnerApplicationModel as any)
      .find({ applicantId: { $in: ownerIds }, applicationStatus: 'Approved' })
      .select('applicantId businessName')
      .lean();

    const bizMap = new Map<string, string>();
    for (const a of apps) {
      if (a.applicantId && a.businessName) {
        bizMap.set(a.applicantId.toString(), a.businessName);
      }
    }

    return owners.map((o: any) => ({
      _id: o._id.toString(),
      fullName: o.fullName,
      email: o.email,
      businessName: bizMap.get(o._id.toString()) || '',
    }));
  }

  /**
   * 4. Helper to list parking lots (optionally scoped to an owner)
   */
  public async getParkingLotOptions(
    ownerId?: string,
  ): Promise<
    Array<{
      _id: string;
      parkingName: string;
      address: string;
      city: string;
      ownerId: string;
    }>
  > {
    const filter: Record<string, any> = {
      parkingStatus: { $ne: 'Deleted' },
    };

    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(ownerId);
    }

    const lots = await (ParkingLotModel as any)
      .find(filter)
      .select('_id parkingName address city ownerId')
      .sort({ parkingName: 1 })
      .lean();

    return lots.map((l: any) => ({
      _id: l._id.toString(),
      parkingName: l.parkingName,
      address: l.address || '',
      city: l.city || '',
      ownerId: l.ownerId.toString(),
    }));
  }

  /**
   * 5. Get detailed Staff Profile, Assignments, Operational Metrics & Activity Logs
   */
  public async getStaffById(staffId: string): Promise<AdminStaffDetailResult> {
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new AppError('Invalid Security Staff ID format.', 400, 'E001');
    }

    const securityRole = await this.getSecurityRole();
    const staffUser = await (UserModel as any)
      .findOne({
        _id: new mongoose.Types.ObjectId(staffId),
        roleId: securityRole._id,
      })
      .lean();

    if (!staffUser) {
      throw new AppError('Security Staff member not found.', 404, 'E009');
    }

    // Fetch assignments history
    const rawAssignments = await (SecurityStaffAssignmentModel as any)
      .find({ securityStaffId: staffUser._id })
      .populate('parkingLotId', 'parkingName address city totalCapacity parkingStatus')
      .populate('ownerId', 'fullName email mobileNumber businessName')
      .populate('assignedBy', 'fullName email')
      .populate('unassignedBy', 'fullName email')
      .sort({ assignedAt: -1 })
      .lean();

    // Map owner business names
    const ownerIds = rawAssignments.map((a: any) => a.ownerId?._id).filter(Boolean);
    const ownerApps = await (OwnerApplicationModel as any)
      .find({ applicantId: { $in: ownerIds }, applicationStatus: 'Approved' })
      .select('applicantId businessName')
      .lean();

    const ownerBizMap = new Map<string, string>();
    for (const app of ownerApps) {
      if (app.applicantId && app.businessName) {
        ownerBizMap.set(app.applicantId.toString(), app.businessName);
      }
    }

    const activeAssignment = rawAssignments.find((a: any) => a.assignmentStatus === 'Active') || null;

    let currentAssignment = null;
    if (activeAssignment && activeAssignment.parkingLotId && activeAssignment.ownerId) {
      const o = activeAssignment.ownerId as any;
      const l = activeAssignment.parkingLotId as any;
      const ab = activeAssignment.assignedBy as any;

      currentAssignment = {
        _id: activeAssignment._id.toString(),
        parkingLotId: {
          _id: l._id.toString(),
          parkingName: l.parkingName || 'Facility',
          address: l.address || '',
          city: l.city || '',
          totalCapacity: l.totalCapacity || 0,
          parkingStatus: l.parkingStatus || 'Active',
        },
        ownerId: {
          _id: o._id.toString(),
          fullName: o.fullName || 'Parking Owner',
          email: o.email || '',
          mobileNumber: o.mobileNumber || '',
          businessName: ownerBizMap.get(o._id.toString()) || o.businessName || '',
        },
        assignedAt: activeAssignment.assignedAt,
        assignedBy: ab
          ? {
              _id: ab._id.toString(),
              fullName: ab.fullName || 'System',
              email: ab.email || '',
            }
          : null,
        assignmentReason: activeAssignment.assignmentReason || undefined,
        assignmentStatus: activeAssignment.assignmentStatus,
      };
    }

    const assignmentHistory = rawAssignments.map((a: any) => ({
      _id: a._id.toString(),
      parkingLotId: {
        _id: a.parkingLotId?._id?.toString() || '',
        parkingName: a.parkingLotId?.parkingName || 'Facility',
        address: a.parkingLotId?.address || '',
        city: a.parkingLotId?.city || '',
      },
      ownerId: {
        _id: a.ownerId?._id?.toString() || '',
        fullName: a.ownerId?.fullName || 'Parking Owner',
        email: a.ownerId?.email || '',
        businessName: a.ownerId?._id ? ownerBizMap.get(a.ownerId._id.toString()) || '' : '',
      },
      assignmentStatus: a.assignmentStatus,
      assignedAt: a.assignedAt,
      unassignedAt: a.unassignedAt || null,
      assignmentReason: a.assignmentReason || undefined,
    }));

    // Operational Metrics
    const staffObjectId = staffUser._id;
    const [totalCheckIns, totalCheckOuts, totalWalkIns, totalIncidents] = await Promise.all([
      (VehicleMovementLogModel as any).countDocuments({
        verifiedBy: staffObjectId,
      }),
      (VehicleMovementLogModel as any).countDocuments({
        exitVerifiedBy: staffObjectId,
      }),
      (BookingModel as any).countDocuments({
        entryVerifiedBy: staffObjectId,
      }),
      (IncidentModel as any).countDocuments({
        reportedBy: staffObjectId,
      }),
    ]);

    // Activity Logs
    const rawAuditLogs = await (AuditLogModel as any)
      .find({
        $or: [
          { userId: staffObjectId },
          { targetDocumentId: staffObjectId },
          { 'metadata.staffId': staffObjectId.toString() },
          { 'metadata.securityStaffId': staffObjectId.toString() },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const activityLogs = rawAuditLogs.map((log: any) => ({
      _id: log._id.toString(),
      action: log.actionTitle || log.action || 'Operational Event',
      module: log.module || 'Staff Management',
      description: log.description || log.eventDescription || '',
      createdAt: log.createdAt || log.eventTime || new Date(),
      status: log.actionStatus || 'Success',
      metadata: log.metadata || undefined,
    }));

    return {
      staff: {
        _id: staffUser._id.toString(),
        employeeId:
          staffUser.employeeId ||
          `SEC-${staffUser._id.toString().slice(-6).toUpperCase()}`,
        fullName: staffUser.fullName,
        email: staffUser.email,
        mobileNumber: staffUser.mobileNumber,
        role: 'Security Staff',
        accountStatus: staffUser.accountStatus,
        emailVerified: staffUser.emailVerified,
        mobileVerified: staffUser.mobileVerified,
        createdAt: staffUser.createdAt || new Date(),
        lastLogin: staffUser.lastLogin || null,
        preferredLanguage: staffUser.preferredLanguage,
        timezone: staffUser.timezone,
        suspensionReason: staffUser.suspensionReason || null,
        suspendedAt: staffUser.suspendedAt || null,
      },
      currentAssignment,
      assignmentHistory,
      operationalMetrics: {
        totalCheckIns,
        totalCheckOuts,
        totalWalkIns,
        totalIncidents,
      },
      activityLogs,
    };
  }

  /**
   * 6. Create Staff: Validate Owner -> Lot relationship, enforce role strictly as Security Staff
   */
  public async createStaff(
    adminUserId: string,
    input: CreateAdminStaffInput,
  ): Promise<AdminStaffListItem> {
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

    if (!mongoose.Types.ObjectId.isValid(input.ownerId)) {
      throw new AppError('Invalid Parking Owner ID format.', 400, 'E001');
    }
    if (!mongoose.Types.ObjectId.isValid(input.parkingLotId)) {
      throw new AppError('Invalid Parking Lot ID format.', 400, 'E001');
    }

    const ownerObjectId = new mongoose.Types.ObjectId(input.ownerId);
    const lotObjectId = new mongoose.Types.ObjectId(input.parkingLotId);

    // 1. Verify that the parking lot exists AND belongs to the specified owner!
    const lot = await (ParkingLotModel as any).findById(lotObjectId);
    if (!lot) {
      throw new AppError('Parking facility not found.', 404, 'E012');
    }
    if (lot.ownerId.toString() !== ownerObjectId.toString()) {
      throw new AppError(
        'The selected parking facility does not belong to the selected owner.',
        400,
        'E006',
      );
    }

    const ownerUser = await (UserModel as any).findById(ownerObjectId);
    if (!ownerUser) {
      throw new AppError('Parking owner not found.', 404, 'E009');
    }

    // 2. Resolve Security Staff role strictly
    const securityRole = await this.getSecurityRole();

    // 3. Check existing user
    let user = await (UserModel as any).findOne({
      $or: [{ email }, { mobileNumber: mobile }],
    });

    const employeeId =
      input.employeeId?.trim() || `SEC-${Date.now().toString().slice(-6).toUpperCase()}`;

    if (user) {
      // Must be Security role (Admin cannot change role or create non-security account here)
      if (user.roleId.toString() !== securityRole._id.toString()) {
        throw new AppError(
          'A user with this email or mobile number already exists with a different platform role. Administrators must not change user roles through staff management.',
          409,
          'E008',
        );
      }

      // Check if already actively assigned to this lot
      const existingAssignment = await (SecurityStaffAssignmentModel as any).findOne({
        securityStaffId: user._id,
        parkingLotId: lotObjectId,
        assignmentStatus: 'Active',
      });

      if (existingAssignment) {
        throw new AppError(
          'This security staff member is already actively assigned to this parking facility.',
          409,
          'E050',
        );
      }

      if (input.employeeId && !user.employeeId) {
        user.employeeId = input.employeeId.trim();
        await user.save();
      }

      // Create new assignment
      await (SecurityStaffAssignmentModel as any).create({
        securityStaffId: user._id,
        ownerId: ownerObjectId,
        parkingLotId: lotObjectId,
        assignmentStatus: 'Active',
        assignedAt: new Date(),
        assignedBy: new mongoose.Types.ObjectId(adminUserId),
        assignmentReason: input.assignmentReason?.trim() || 'Assigned by Administrator',
        employeeId,
      });
    } else {
      // Create new User with Security Staff role
      user = await (UserModel as any).create({
        fullName,
        email,
        mobileNumber: mobile,
        roleId: securityRole._id,
        accountStatus: 'Pending Verification',
        emailVerified: false,
        mobileVerified: false,
        employeeId,
        invitationStatus: 'Sent',
        invitationSentAt: new Date(),
        preferredLanguage: 'English',
        timezone: 'Asia/Kolkata',
      });

      // Create active assignment
      await (SecurityStaffAssignmentModel as any).create({
        securityStaffId: user._id,
        ownerId: ownerObjectId,
        parkingLotId: lotObjectId,
        assignmentStatus: 'Active',
        assignedAt: new Date(),
        assignedBy: new mongoose.Types.ObjectId(adminUserId),
        assignmentReason: input.assignmentReason?.trim() || 'Initial staff assignment by Administrator',
        employeeId,
      });
    }

    // 4. Send invitation email & in-app notification
    try {
      await emailService.sendSecurityStaffInvitationEmail({
        to: email,
        staffName: fullName,
        ownerName: ownerUser.fullName,
        facilityName: lot.parkingName,
      });
    } catch (eErr) {
      console.warn('Security staff invitation email warning:', eErr);
    }

    try {
      const notif = await NotificationModel.create({
        notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        userId: user._id,
        senderId: new mongoose.Types.ObjectId(adminUserId),
        notificationType: 'Account',
        eventType: 'Staff Invited',
        title: 'Assigned as Security Staff',
        message: `You have been added as Security Staff for ${lot.parkingName} by Platform Administrator. Please sign in to verify your account.`,
        priority: 'High',
        deliveryChannel: 'In-App',
        deliveryStatus: 'Delivered',
        deliveredAt: new Date(),
      });
      emitNewNotification(user._id.toString(), notif);
    } catch (nErr) {
      console.warn('Security staff notification error:', nErr);
    }

    // 5. Audit Log
    try {
      await AuditLogModel.create({
        actionCode: 'STAFF_CREATED',
        module: 'Staff Management',
        userId: new mongoose.Types.ObjectId(adminUserId),
        targetId: user._id,
        targetCollection: 'users',
        targetDocumentId: user._id,
        actionTitle: 'Security Staff Account Created',
        description: `Administrator provisioned Security Staff ${fullName} (${email}) for lot ${lot.parkingName} (Owner: ${ownerUser.fullName}).`,
        actionStatus: 'Success',
        metadata: {
          staffId: user._id.toString(),
          ownerId: ownerObjectId.toString(),
          parkingLotId: lotObjectId.toString(),
          employeeId,
        },
      });
    } catch (aErr) {
      console.warn('Audit log write error:', aErr);
    }

    // 6. Real-time Socket Emission
    try {
      emitStaffStatusUpdate({
        staffId: user._id.toString(),
        ownerId: ownerObjectId.toString(),
        parkingLotId: lotObjectId.toString(),
        status: user.accountStatus,
        event: 'STAFF_CREATED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return {
      _id: user._id.toString(),
      employeeId,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: 'Security Staff',
      accountStatus: user.accountStatus,
      lastLogin: user.lastLogin || null,
      createdAt: user.createdAt || new Date(),
      owner: {
        _id: ownerUser._id.toString(),
        fullName: ownerUser.fullName,
        email: ownerUser.email,
      },
      parkingLot: {
        _id: lot._id.toString(),
        parkingName: lot.parkingName,
        address: lot.address || '',
        city: lot.city || '',
      },
      activeAssignmentsCount: 1,
      assignment: {
        _id: 'new',
        assignmentStatus: 'Active',
        assignedAt: new Date(),
        assignmentReason: input.assignmentReason?.trim() || undefined,
      },
    };
  }

  /**
   * 7. Update permitted Security Staff profile info (Name, Mobile, Employee ID)
   */
  public async updateStaff(
    adminUserId: string,
    staffId: string,
    input: UpdateAdminStaffInput,
  ): Promise<AdminStaffListItem> {
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new AppError('Invalid Security Staff ID format.', 400, 'E001');
    }

    const securityRole = await this.getSecurityRole();
    const staffUser = await (UserModel as any).findOne({
      _id: new mongoose.Types.ObjectId(staffId),
      roleId: securityRole._id,
    });

    if (!staffUser) {
      throw new AppError('Security Staff member not found.', 404, 'E009');
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

      const existingMobile = await (UserModel as any).findOne({
        mobileNumber: mobile,
        _id: { $ne: staffUser._id },
      });
      if (existingMobile) {
        throw new AppError('Another user is already registered with this mobile number.', 409, 'E008');
      }
      staffUser.mobileNumber = mobile;
    }

    if (input.employeeId && input.employeeId.trim()) {
      staffUser.employeeId = input.employeeId.trim();
    }

    await staffUser.save();

    // Audit Log
    try {
      await AuditLogModel.create({
        actionCode: 'STAFF_UPDATED',
        module: 'Staff Management',
        userId: new mongoose.Types.ObjectId(adminUserId),
        targetId: staffUser._id,
        targetCollection: 'users',
        targetDocumentId: staffUser._id,
        actionTitle: 'Security Staff Profile Updated',
        description: `Administrator updated profile details for Security Staff ${staffUser.fullName} (${staffUser.email}).`,
        actionStatus: 'Success',
        metadata: {
          staffId: staffUser._id.toString(),
          employeeId: staffUser.employeeId,
        },
      });
    } catch (aErr) {
      console.warn('Audit log write error:', aErr);
    }

    // Return updated staff item
    const res = await this.getStaffList({ search: staffUser.email, limit: 1 });
    const item = res.staff[0];
    if (!item) {
      throw new AppError('Updated staff record could not be retrieved.', 500, 'E031');
    }
    return item;
  }

  /**
   * 8. Suspend Security Staff: Disciplinary account lock and session revocation
   */
  public async suspendStaff(
    adminUserId: string,
    staffId: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new AppError('Invalid Security Staff ID format.', 400, 'E001');
    }

    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 5) {
      throw new AppError('Suspension reason is required and must be at least 5 characters.', 400, 'E001');
    }

    const securityRole = await this.getSecurityRole();
    const staffUser = await (UserModel as any).findOne({
      _id: new mongoose.Types.ObjectId(staffId),
      roleId: securityRole._id,
    });

    if (!staffUser) {
      throw new AppError('Security Staff member not found.', 404, 'E009');
    }

    if (staffUser.accountStatus === 'Suspended') {
      throw new AppError('This security staff member is already suspended.', 400, 'E001');
    }

    staffUser.accountStatus = 'Suspended';
    staffUser.suspensionReason = cleanReason;
    staffUser.suspendedAt = new Date();
    staffUser.suspendedBy = new mongoose.Types.ObjectId(adminUserId);
    await staffUser.save();

    // Revoke all active sessions immediately
    await (SessionModel as any).updateMany(
      { userId: staffUser._id, sessionStatus: 'Active' },
      {
        $set: {
          sessionStatus: 'Revoked',
          logoutReason: 'Account Suspended',
          logoutTime: new Date(),
          revokedAt: new Date(),
          revokedBy: new mongoose.Types.ObjectId(adminUserId),
        },
      },
    );

    // Notification & Email
    try {
      await emailService.sendSecurityStaffSuspendedEmail({
        to: staffUser.email,
        staffName: staffUser.fullName,
        reason: cleanReason,
      });
    } catch (eErr) {
      console.warn('Suspension email error:', eErr);
    }

    try {
      const notif = await NotificationModel.create({
        notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        userId: staffUser._id,
        senderId: new mongoose.Types.ObjectId(adminUserId),
        notificationType: 'Account',
        eventType: 'Staff Suspended',
        title: 'Account Suspended',
        message: `Your Security Staff account has been suspended by an Administrator. Reason: ${cleanReason}`,
        priority: 'Critical',
        deliveryChannel: 'In-App',
        deliveryStatus: 'Delivered',
        deliveredAt: new Date(),
      });
      emitNewNotification(staffUser._id.toString(), notif);
    } catch (nErr) {
      console.warn('Suspension notification error:', nErr);
    }

    // Audit Log
    try {
      await AuditLogModel.create({
        actionCode: 'STAFF_SUSPENDED',
        module: 'Staff Management',
        userId: new mongoose.Types.ObjectId(adminUserId),
        targetId: staffUser._id,
        targetCollection: 'users',
        targetDocumentId: staffUser._id,
        actionTitle: 'Security Staff Account Suspended',
        description: `Administrator suspended Security Staff ${staffUser.fullName} (${staffUser.email}). Reason: ${cleanReason}`,
        actionStatus: 'Success',
        metadata: {
          staffId: staffUser._id.toString(),
          reason: cleanReason,
        },
      });
    } catch (aErr) {
      console.warn('Audit log write error:', aErr);
    }

    // Socket Event
    try {
      emitStaffStatusUpdate({
        staffId: staffUser._id.toString(),
        ownerId: '',
        status: 'Suspended',
        event: 'STAFF_SUSPENDED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return {
      success: true,
      message: 'Security staff account suspended successfully and active sessions revoked.',
    };
  }

  /**
   * 9. Activate Security Staff: Restore duty access
   */
  public async activateStaff(
    adminUserId: string,
    staffId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new AppError('Invalid Security Staff ID format.', 400, 'E001');
    }

    const securityRole = await this.getSecurityRole();
    const staffUser = await (UserModel as any).findOne({
      _id: new mongoose.Types.ObjectId(staffId),
      roleId: securityRole._id,
    });

    if (!staffUser) {
      throw new AppError('Security Staff member not found.', 404, 'E009');
    }

    if (staffUser.accountStatus === 'Active') {
      throw new AppError('This security staff member is already active.', 400, 'E001');
    }

    staffUser.accountStatus = 'Active';
    staffUser.suspensionReason = null;
    staffUser.suspendedAt = null;
    staffUser.suspendedBy = null;
    await staffUser.save();

    // Notification & Email
    try {
      await emailService.sendSecurityStaffActivatedEmail({
        to: staffUser.email,
        staffName: staffUser.fullName,
      });
    } catch (eErr) {
      console.warn('Activation email error:', eErr);
    }

    try {
      const notif = await NotificationModel.create({
        notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        userId: staffUser._id,
        senderId: new mongoose.Types.ObjectId(adminUserId),
        notificationType: 'Account',
        eventType: 'Staff Activated',
        title: 'Account Reactivated',
        message: 'Your Security Staff account has been reactivated. You may now log in to the gate terminal.',
        priority: 'High',
        deliveryChannel: 'In-App',
        deliveryStatus: 'Delivered',
        deliveredAt: new Date(),
      });
      emitNewNotification(staffUser._id.toString(), notif);
    } catch (nErr) {
      console.warn('Activation notification error:', nErr);
    }

    // Audit Log
    try {
      await AuditLogModel.create({
        actionCode: 'STAFF_ACTIVATED',
        module: 'Staff Management',
        userId: new mongoose.Types.ObjectId(adminUserId),
        targetId: staffUser._id,
        targetCollection: 'users',
        targetDocumentId: staffUser._id,
        actionTitle: 'Security Staff Account Reactivated',
        description: `Administrator reactivated Security Staff ${staffUser.fullName} (${staffUser.email}).`,
        actionStatus: 'Success',
        metadata: {
          staffId: staffUser._id.toString(),
        },
      });
    } catch (aErr) {
      console.warn('Audit log write error:', aErr);
    }

    // Socket Event
    try {
      emitStaffStatusUpdate({
        staffId: staffUser._id.toString(),
        ownerId: '',
        status: 'Active',
        event: 'STAFF_ACTIVATED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return {
      success: true,
      message: 'Security staff account reactivated successfully.',
    };
  }

  /**
   * 10. Transfer Parking Lot: Reassign staff to a new facility, validating Owner -> Facility relationship
   */
  public async transferStaff(
    adminUserId: string,
    staffId: string,
    input: TransferAdminStaffInput,
  ): Promise<AdminStaffDetailResult> {
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new AppError('Invalid Security Staff ID format.', 400, 'E001');
    }
    if (!mongoose.Types.ObjectId.isValid(input.newOwnerId)) {
      throw new AppError('Invalid New Parking Owner ID format.', 400, 'E001');
    }
    if (!mongoose.Types.ObjectId.isValid(input.newParkingLotId)) {
      throw new AppError('Invalid New Parking Lot ID format.', 400, 'E001');
    }

    const staffObjectId = new mongoose.Types.ObjectId(staffId);
    const newOwnerObjectId = new mongoose.Types.ObjectId(input.newOwnerId);
    const newLotObjectId = new mongoose.Types.ObjectId(input.newParkingLotId);

    const securityRole = await this.getSecurityRole();
    const staffUser = await (UserModel as any).findOne({
      _id: staffObjectId,
      roleId: securityRole._id,
    });

    if (!staffUser) {
      throw new AppError('Security Staff member not found.', 404, 'E009');
    }

    // 1. Validate that the destination parking lot belongs to the destination owner!
    const newLot = await (ParkingLotModel as any).findById(newLotObjectId);
    if (!newLot) {
      throw new AppError('Destination parking facility not found.', 404, 'E012');
    }
    if (newLot.ownerId.toString() !== newOwnerObjectId.toString()) {
      throw new AppError(
        'The destination parking facility does not belong to the selected owner.',
        400,
        'E006',
      );
    }

    const newOwnerUser = await (UserModel as any).findById(newOwnerObjectId);
    if (!newOwnerUser) {
      throw new AppError('Destination parking owner not found.', 404, 'E009');
    }

    // 2. Check if already actively assigned to this exact facility
    const existingActive = await (SecurityStaffAssignmentModel as any).findOne({
      securityStaffId: staffObjectId,
      parkingLotId: newLotObjectId,
      assignmentStatus: 'Active',
    });

    if (existingActive) {
      throw new AppError(
        'This security staff member is already actively assigned to this destination facility.',
        409,
        'E050',
      );
    }

    // 3. Deactivate previous active assignment(s)
    await (SecurityStaffAssignmentModel as any).updateMany(
      {
        securityStaffId: staffObjectId,
        assignmentStatus: 'Active',
      },
      {
        $set: {
          assignmentStatus: 'Inactive',
          unassignedAt: new Date(),
          unassignedBy: new mongoose.Types.ObjectId(adminUserId),
        },
      },
    );

    // 4. Create new active assignment
    await (SecurityStaffAssignmentModel as any).create({
      securityStaffId: staffObjectId,
      ownerId: newOwnerObjectId,
      parkingLotId: newLotObjectId,
      assignmentStatus: 'Active',
      assignedAt: new Date(),
      assignedBy: new mongoose.Types.ObjectId(adminUserId),
      assignmentReason: input.transferReason?.trim() || 'Transferred by Administrator',
      employeeId: staffUser.employeeId || null,
    });

    // 5. Send Transfer Notification & Email
    try {
      await emailService.sendSecurityStaffTransferEmail({
        to: staffUser.email,
        staffName: staffUser.fullName,
        newFacilityName: newLot.parkingName,
        newOwnerName: newOwnerUser.fullName,
      });
    } catch (eErr) {
      console.warn('Transfer email warning:', eErr);
    }

    try {
      const notif = await NotificationModel.create({
        notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        userId: staffUser._id,
        senderId: new mongoose.Types.ObjectId(adminUserId),
        notificationType: 'Account',
        eventType: 'Staff Assignment Updated',
        title: 'Facility Assignment Transferred',
        message: `Your duty has been transferred to ${newLot.parkingName} (Owner: ${newOwnerUser.fullName}) by Administrator.`,
        priority: 'High',
        deliveryChannel: 'In-App',
        deliveryStatus: 'Delivered',
        deliveredAt: new Date(),
      });
      emitNewNotification(staffUser._id.toString(), notif);
    } catch (nErr) {
      console.warn('Transfer notification error:', nErr);
    }

    // 6. Audit Log
    try {
      await AuditLogModel.create({
        actionCode: 'STAFF_TRANSFERRED',
        module: 'Staff Management',
        userId: new mongoose.Types.ObjectId(adminUserId),
        targetId: staffUser._id,
        targetCollection: 'securityStaffAssignments',
        targetDocumentId: newLotObjectId,
        actionTitle: 'Security Staff Facility Transferred',
        description: `Administrator transferred Security Staff ${staffUser.fullName} to ${newLot.parkingName} (Owner: ${newOwnerUser.fullName}).`,
        actionStatus: 'Success',
        metadata: {
          staffId: staffUser._id.toString(),
          newOwnerId: newOwnerObjectId.toString(),
          newParkingLotId: newLotObjectId.toString(),
          reason: input.transferReason?.trim(),
        },
      });
    } catch (aErr) {
      console.warn('Audit log write error:', aErr);
    }

    // 7. Socket Event
    try {
      emitStaffStatusUpdate({
        staffId: staffUser._id.toString(),
        ownerId: newOwnerObjectId.toString(),
        parkingLotId: newLotObjectId.toString(),
        status: staffUser.accountStatus,
        event: 'STAFF_TRANSFERRED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return this.getStaffById(staffId);
  }

  /**
   * 11. Delete Security Staff: Dependency safeguard preventing destruction of historical records
   */
  public async deleteStaff(
    adminUserId: string,
    staffId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new AppError('Invalid Security Staff ID format.', 400, 'E001');
    }

    const staffObjectId = new mongoose.Types.ObjectId(staffId);
    const securityRole = await this.getSecurityRole();

    const staffUser = await (UserModel as any).findOne({
      _id: staffObjectId,
      roleId: securityRole._id,
    });

    if (!staffUser) {
      throw new AppError('Security Staff member not found.', 404, 'E009');
    }

    // Check operational dependencies
    const [movementsCount, bookingsCount, incidentsCount] = await Promise.all([
      (VehicleMovementLogModel as any).countDocuments({
        $or: [{ verifiedBy: staffObjectId }, { exitVerifiedBy: staffObjectId }],
      }),
      (BookingModel as any).countDocuments({
        entryVerifiedBy: staffObjectId,
      }),
      (IncidentModel as any).countDocuments({
        reportedBy: staffObjectId,
      }),
    ]);

    if (movementsCount > 0 || bookingsCount > 0 || incidentsCount > 0) {
      throw new AppError(
        `Cannot delete security staff member with recorded operational history (${movementsCount} vehicle movements, ${bookingsCount} bookings, ${incidentsCount} incidents). Please suspend or deactivate the account to preserve compliance audit trails.`,
        409,
        'E011',
      );
    }

    // Safe to delete assignments and mark/remove user
    await (SecurityStaffAssignmentModel as any).deleteMany({
      securityStaffId: staffObjectId,
    });

    staffUser.accountStatus = 'Deleted';
    await staffUser.save();

    // Revoke sessions
    await (SessionModel as any).updateMany(
      { userId: staffObjectId, sessionStatus: 'Active' },
      {
        $set: {
          sessionStatus: 'Revoked',
          logoutReason: 'Administrator Revoked',
          logoutTime: new Date(),
          revokedAt: new Date(),
          revokedBy: new mongoose.Types.ObjectId(adminUserId),
        },
      },
    );

    // Audit Log
    try {
      await AuditLogModel.create({
        actionCode: 'STAFF_DELETED',
        module: 'Staff Management',
        userId: new mongoose.Types.ObjectId(adminUserId),
        targetId: staffObjectId,
        targetCollection: 'users',
        targetDocumentId: staffObjectId,
        actionTitle: 'Security Staff Account Deleted',
        description: `Administrator permanently deleted unutilized Security Staff account ${staffUser.fullName} (${staffUser.email}).`,
        actionStatus: 'Success',
        metadata: {
          staffId: staffObjectId.toString(),
        },
      });
    } catch (aErr) {
      console.warn('Audit log write error:', aErr);
    }

    // Socket Event
    try {
      emitStaffStatusUpdate({
        staffId: staffObjectId.toString(),
        ownerId: '',
        status: 'Deleted',
        event: 'STAFF_DELETED',
        timestamp: new Date().toISOString(),
      });
    } catch (sErr) {
      console.warn('Socket emit error:', sErr);
    }

    return {
      success: true,
      message: 'Security staff account deleted successfully.',
    };
  }
}

export const adminStaffService = new AdminStaffService();
