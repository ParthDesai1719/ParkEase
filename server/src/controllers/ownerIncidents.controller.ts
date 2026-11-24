import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ownerIncidentsService } from '../services/ownerIncidents.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * GET /api/v1/owner/incidents
 * Retrieves incidents belonging to facilities owned by the authenticated Owner.
 */
export async function getOwnerIncidentsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const result = await ownerIncidentsService.getOwnerIncidents({
    ownerId,
    parkingLotId: req.query.parkingLotId as string | undefined,
    status: req.query.status as string | undefined,
    severity: req.query.severity as string | undefined,
    incidentType: req.query.incidentType as string | undefined,
    search: req.query.search as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/v1/owner/incidents/:id
 * Retrieves full details and conversation history for an incident owned by the authenticated Owner.
 */
export async function getOwnerIncidentDetailHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const rawId = req.params.id;
  const incidentId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!incidentId) {
    throw new AppError('Incident ID is required.', 400, 'INCIDENT_ID_REQUIRED');
  }

  const result = await ownerIncidentsService.getOwnerIncidentDetail({
    ownerId,
    incidentId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * POST /api/v1/owner/incidents/:id/responses
 * Submits an owner response to an incident conversation.
 */
export async function addOwnerIncidentResponseHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const rawId = req.params.id;
  const incidentId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { message, attachments } = req.body as { message?: string; attachments?: string[] };

  if (!incidentId) {
    throw new AppError('Incident ID is required.', 400, 'INCIDENT_ID_REQUIRED');
  }
  if (!message || message.trim().length === 0) {
    throw new AppError('Response message is required.', 400, 'MESSAGE_REQUIRED');
  }

  const result = await ownerIncidentsService.addOwnerIncidentResponse({
    ownerId,
    incidentId,
    message,
    ...(attachments !== undefined ? { attachments } : {}),
  });

  res.status(200).json({
    success: true,
    message: 'Response recorded successfully.',
    data: result,
  });
}

/**
 * PATCH /api/v1/owner/incidents/:id/status
 * Updates an incident status following strict lifecycle rules.
 */
export async function updateOwnerIncidentStatusHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const rawId = req.params.id;
  const incidentId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { status, resolutionNotes } = req.body as {
    status?: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
    resolutionNotes?: string;
  };

  if (!incidentId) {
    throw new AppError('Incident ID is required.', 400, 'INCIDENT_ID_REQUIRED');
  }
  if (!status) {
    throw new AppError('Status is required.', 400, 'STATUS_REQUIRED');
  }

  const result = await ownerIncidentsService.updateOwnerIncidentStatus({
    ownerId,
    incidentId,
    status,
    ...(resolutionNotes !== undefined ? { resolutionNotes } : {}),
  });

  res.status(200).json({
    success: true,
    message: `Incident marked as ${status}.`,
    data: result,
  });
}
