import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ParkingLayoutService, type SaveLayoutInput } from '../services/parkingLayout.service.js';
import {
  saveLayoutElementsSchema,
  floorLayoutParamSchema,
  removeElementParamSchema,
  replicateLaneNetworkSchema,
} from '../validators/parkingLayout.validator.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function getFloorLayoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const result = await ParkingLayoutService.getFloorLayout(id, floorId, {
      userRole: 'ADMIN',
      userId: req.userId,
      includeDraft: true,
    });
    sendSuccess(res, 'Floor layout retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function initDraftLayoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const result = await ParkingLayoutService.initDraftLayout(
      id,
      floorId,
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result, result.isNew ? 201 : 200);
  } catch (error) {
    next(error);
  }
}

export async function saveLayoutElementsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const validatedBody = saveLayoutElementsSchema.parse(req.body);
    const result = await ParkingLayoutService.saveLayoutElements(
      id,
      floorId,
      validatedBody as unknown as SaveLayoutInput,
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function removeLayoutElementHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId, elementId } = removeElementParamSchema.parse(req.params);
    const result = await ParkingLayoutService.removeLayoutElement(
      id,
      floorId,
      elementId,
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function validateDraftLayoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const result = await ParkingLayoutService.validateDraftLayout(
      id,
      floorId,
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function publishDraftLayoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const result = await ParkingLayoutService.publishDraftLayout(
      id,
      floorId,
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function discardDraftLayoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const result = await ParkingLayoutService.discardDraftLayout(
      id,
      floorId,
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function getOwnerPublishedLayoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const result = await ParkingLayoutService.getFloorLayout(id, floorId, {
      userRole: 'OWNER',
      userId: req.userId!,
      includeDraft: false,
    });
    sendSuccess(res, 'Owner floor layout retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function replicateLaneNetworkHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, floorId } = floorLayoutParamSchema.parse(req.params);
    const body = replicateLaneNetworkSchema.parse(req.body);
    const result = await ParkingLayoutService.replicateLaneNetwork(
      id,
      floorId,
      body.targetFloorIds,
      {
        replaceExisting: body.replaceExisting,
        adminUserId: req.userId!,
        ipAddress: req.ip,
      },
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function updateCanvasBoundaryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { width, height } = req.body;
    const result = await ParkingLayoutService.updateFacilityCanvasBoundary(
      id,
      width,
      height,
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/owner/parking-lots/:id/layout/confirm
 * Owner approves and confirms the 2D visual layout
 */
export async function ownerConfirmLayoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { notes } = req.body as { notes?: string };
    const result = await ParkingLayoutService.ownerConfirmLayout(
      id,
      req.userId!,
      notes,
      req.ip,
    );
    sendSuccess(res, result.message, result.parkingLot);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/owner/parking-lots/:id/layout/request-changes
 * Owner submits revision feedback for the 2D visual layout
 */
export async function ownerRequestLayoutChangesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { notes, floorId } = req.body as { notes: string; floorId?: string };
    const result = await ParkingLayoutService.ownerRequestLayoutChanges(
      id,
      req.userId!,
      notes,
      floorId,
      req.ip,
    );
    sendSuccess(res, result.message, result.parkingLot);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/owner/parking-lots/:id/activate
 * or POST /api/v1/admin/parking-lots/:id/activate
 * Activates facility and sets parkingStatus to Active (Go Live)
 */
export async function activateFacilityHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const result = await ParkingLayoutService.activateFacility(
      id,
      req.userId!,
      req.roleId,
      req.ip,
    );
    sendSuccess(res, result.message, result.parkingLot);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/parking-lots/:id/overflow-config
 * Updates the overflow capacity threshold
 */
export async function updateOverflowConfigHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { overflowCapacity } = req.body as { overflowCapacity: number };
    const result = await ParkingLayoutService.updateOverflowConfig(
      id,
      Number(overflowCapacity),
      req.userId!,
      req.ip,
    );
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}
