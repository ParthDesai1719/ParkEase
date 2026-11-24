import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { adminEmailCenterService, type RecipientCategory } from '../services/adminEmailCenter.service.js';
import { generateParkEaseEmailHtml } from '../services/email.service.js';
import { AppError } from '../utils/AppError.js';

export async function getEmailCenterOverview(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const overview = await adminEmailCenterService.getOverview();
  res.status(200).json({
    success: true,
    data: overview,
  });
}

export async function searchRecipients(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const category = (req.query.category as string) || 'ALL_CUSTOMERS';
  const search = req.query.search as string | undefined;

  const validCategories: RecipientCategory[] = [
    'ALL_OWNERS',
    'ALL_CUSTOMERS',
    'SPECIFIC_OWNER',
    'SPECIFIC_CUSTOMER',
  ];

  if (!validCategories.includes(category as RecipientCategory)) {
    throw new AppError('Invalid recipient category specified.', 400, 'INVALID_CATEGORY');
  }

  const result = await adminEmailCenterService.searchRecipients(
    category as RecipientCategory,
    search,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function sendAdminEmail(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const adminUserId = req.userId;
  if (!adminUserId) {
    throw new AppError('Authentication required to send administrative email.', 401, 'E007');
  }

  const { recipientCategory, recipientIds, subject, content, massEmailConfirmed } = req.body;

  const result = await adminEmailCenterService.sendEmail(adminUserId, {
    recipientCategory,
    recipientIds,
    subject,
    content,
    massEmailConfirmed: Boolean(massEmailConfirmed),
  });

  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
}

export async function getEmailHistory(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const history = await adminEmailCenterService.getEmailHistory(req.query);
  res.status(200).json({
    success: true,
    data: history.emails,
    pagination: history.pagination,
  });
}

export async function getEmailById(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id as string;
  const email = await adminEmailCenterService.getEmailById(id);
  res.status(200).json({
    success: true,
    data: email,
  });
}

export async function previewAdminEmail(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { subject, content } = req.body;
  const sanitized = adminEmailCenterService.sanitizeHtml(content || '');
  const previewHtml = generateParkEaseEmailHtml({
    title: subject || 'Untitled Notification',
    subtitle: 'Official Administrative Communication',
    badge: {
      text: 'ParkEase Notice',
      variant: 'info',
    },
    bodyHtml: sanitized,
    footerNotice:
      'This official email was dispatched directly by ParkEase Platform Operations. Replies to this email are monitored by system administrators.',
  });

  res.status(200).json({
    success: true,
    data: {
      sanitizedContent: sanitized,
      renderedHtml: previewHtml,
    },
  });
}
