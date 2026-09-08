import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  sendSuccess(res, 'Authentication verified.', {
    userId: req.userId,
    roleId: req.roleId,
  });
});

export default router;
