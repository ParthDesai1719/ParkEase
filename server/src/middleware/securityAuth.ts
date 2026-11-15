import type { NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { RoleModel, type Role } from '../models/Role.js';
import { SecurityStaffAssignmentModel, type SecurityStaffAssignment } from '../models/SecurityStaffAssignment.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { UserModel, type User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedRequest } from './auth.js';

export interface SecurityAuthenticatedRequest extends AuthenticatedRequest {
  parkingLotId?: string;
  activeAssignment?: SecurityStaffAssignment;
  parkingLot?: ParkingLot;
}

/**
 * Middleware that strictly enforces active parking lot assignment authorization for Security Staff.
 * Validates:
 * 1. Authenticated user and role (SECURITY or ADMIN).
 * 2. Account eligibility (rejects Suspended, Deactivated, or Pending accounts).
 * 3. Target parkingLotId from query, header, params, or body.
 * 4. Active assignment in SecurityStaffAssignmentModel (assignmentStatus === 'Active').
 * 5. Facility existence and matching ownership between assignment and parking lot.
 */
export async function requireActiveSecurityAssignment(
  req: SecurityAuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    const roleId = req.roleId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    if (!roleId || !mongoose.isValidObjectId(roleId)) {
      throw new AppError('Access denied: role not associated with session.', 403, 'E007');
    }

    // 1. Verify User Eligibility
    const user = await (UserModel as mongoose.Model<User>).findById(userId).lean().exec();
    if (!user) {
      throw new AppError('User not found.', 401, 'E002');
    }

    if (user.accountStatus === 'Suspended') {
      throw new AppError('Account is suspended.', 403, 'E007');
    }

    if (user.accountStatus === 'Deactivated' || user.accountStatus === 'Deleted') {
      throw new AppError('Account is not eligible for authentication.', 403, 'E042');
    }

    if (user.accountStatus === 'Pending Verification' || user.accountStatus === 'Pending Approval') {
      throw new AppError('Account verification is pending.', 403, 'E043');
    }

    // 2. Verify Role
    const role = await (RoleModel as mongoose.Model<Role>).findById(roleId).lean().exec();
    if (!role || !role.isActive) {
      throw new AppError('Access denied: assigned role is inactive or not found.', 403, 'E007');
    }

    if (role.roleCode !== 'SECURITY' && role.roleCode !== 'ADMIN') {
      throw new AppError('Access denied: insufficient role privileges.', 403, 'E007');
    }

    // 3. Resolve Target Parking Lot ID
    const queryLotId = typeof req.query.parkingLotId === 'string' ? req.query.parkingLotId.trim() : undefined;
    const headerLotId = typeof req.headers['x-parking-lot-id'] === 'string' ? req.headers['x-parking-lot-id'].trim() : undefined;
    const paramLotId = typeof req.params.parkingLotId === 'string' ? req.params.parkingLotId.trim() : undefined;
    const bodyLotId = req.body && typeof req.body.parkingLotId === 'string' ? req.body.parkingLotId.trim() : undefined;

    const rawLotId = queryLotId || headerLotId || paramLotId || bodyLotId;

    if (!rawLotId) {
      throw new AppError('Parking lot ID is required for facility operations.', 400, 'PARKING_LOT_REQUIRED');
    }

    if (!mongoose.isValidObjectId(rawLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_LOT_ID');
    }

    const targetLotObjectId = new mongoose.Types.ObjectId(rawLotId);

    // 4. Verify Facility Existence
    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(targetLotObjectId).lean().exec();
    if (!lot) {
      throw new AppError('Parking lot not found.', 404, 'LOT_NOT_FOUND');
    }

    // 5. If Role is SECURITY, Enforce Active Security Staff Assignment
    if (role.roleCode === 'SECURITY') {
      const assignment = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
        .findOne({
          securityStaffId: new mongoose.Types.ObjectId(userId),
          parkingLotId: targetLotObjectId,
          assignmentStatus: 'Active',
        })
        .lean()
        .exec();

      if (!assignment) {
        throw new AppError(
          'Access denied: You do not have an active security assignment to this parking facility.',
          403,
          'E007',
        );
      }

      // Verify facility and assignment ownership match
      if (!lot.ownerId || (assignment.ownerId && !assignment.ownerId.equals(lot.ownerId))) {
        throw new AppError(
          'Access denied: Facility ownership mismatch on security assignment.',
          403,
          'E007',
        );
      }

      req.activeAssignment = assignment;
    }

    // 6. Attach Context
    req.parkingLotId = rawLotId;
    req.parkingLot = lot;

    next();
  } catch (error) {
    next(error);
  }
}

