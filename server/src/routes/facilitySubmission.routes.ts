import { Router } from 'express';
import {
  createDraftSubmission,
  deleteDraft,
  getOwnerSubmissions,
  getSubmissionById,
  getSubmissionFile,
  submitForReview,
  updateSubmission,
  uploadSubmissionPhoto,
  uploadSubmissionPlanPdf,
} from '../controllers/facilitySubmission.controller.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js';
import { facilityPhotoUpload, facilityPlanPdfUpload } from '../middleware/upload.js';

const router = Router();

// Secure file streaming (accessible by owner or admin)
router.get('/files/:filename', requireAuth, getSubmissionFile);

// All submission management routes require authenticated OWNER with PARKING_MANAGE permission
router.use(requireAuth);
router.use(requireRole('OWNER'));
router.use(requirePermission('PARKING_MANAGE'));

// List all submissions for the logged-in owner
router.get('/', getOwnerSubmissions);

// Create new Draft submission
router.post('/', createDraftSubmission);

// Get specific submission details
router.get('/:id', getSubmissionById);

// Update existing Draft or Changes Requested submission
router.put('/:id', updateSubmission);

// Submit for Administrator Review
router.post('/:id/submit', submitForReview);

// Delete draft submission
router.delete('/:id', deleteDraft);

// File uploads
router.post('/upload-photo', facilityPhotoUpload.single('file'), uploadSubmissionPhoto);
router.post('/upload-plan-pdf', facilityPlanPdfUpload.single('file'), uploadSubmissionPlanPdf);

export default router;

