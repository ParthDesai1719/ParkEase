import { Router } from 'express';
import { submitContactMessage } from '../controllers/contact.controller.js';

const router = Router();

// POST /api/v1/contact
router.post('/', submitContactMessage);

export default router;
