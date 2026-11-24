import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getOwnerBusinessSettings,
  updateOwnerBusinessSettings,
} from '../services/ownerSettings.service.js';
import { AppError } from '../utils/AppError.js';

export async function getOwnerBusinessSettingsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { parkingLotId } = req.query;

  const data = await getOwnerBusinessSettings(
    ownerId.toString(),
    parkingLotId as string | undefined,
  );

  res.status(200).json({
    success: true,
    message: 'Owner business settings retrieved successfully.',
    data,
  });
}

export async function updateOwnerBusinessSettingsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { parkingLotId } = req.params;
  if (!parkingLotId) {
    throw new AppError('Parking lot ID parameter is required.', 400, 'MISSING_LOT_ID');
  }

  const updatedFacility = await updateOwnerBusinessSettings(ownerId.toString(), {
    ...req.body,
    parkingLotId,
  });

  res.status(200).json({
    success: true,
    message: `Operational settings for "${updatedFacility.parkingName}" updated successfully.`,
    data: updatedFacility,
  });
}
