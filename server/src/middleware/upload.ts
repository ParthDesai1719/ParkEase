import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { AppError } from '../utils/AppError.js';

// Resolve uploads/owner directory
const uploadsRoot = fs.existsSync(path.resolve(process.cwd(), 'server', 'uploads'))
  ? path.resolve(process.cwd(), 'server', 'uploads')
  : path.resolve(process.cwd(), 'uploads');
const ownerUploadsDir = path.resolve(uploadsRoot, 'owner');
const submissionPhotosDir = path.resolve(uploadsRoot, 'submissions', 'photos');
const submissionPlansDir = path.resolve(uploadsRoot, 'submissions', 'plans');
const avatarsDir = path.resolve(uploadsRoot, 'avatars');
export const incidentUploadsDir = path.resolve(uploadsRoot, 'incidents');
export const brandingDir = path.resolve(uploadsRoot, 'branding');

for (const dir of [ownerUploadsDir, submissionPhotosDir, submissionPlansDir, avatarsDir, incidentUploadsDir, brandingDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpeg', '.jpg', '.png', '.webp']);

// Disk storage configuration
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    if (!fs.existsSync(ownerUploadsDir)) {
      fs.mkdirSync(ownerUploadsDir, { recursive: true });
    }
    cb(null, ownerUploadsDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.bin';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const secureFileName = `doc-${Date.now()}-${randomHex}${safeExt}`;
    cb(null, secureFileName);
  },
});

// File filter validation
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const mime = file.mimetype.toLowerCase();
  const rawExt = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mime) || !ALLOWED_EXTENSIONS.has(rawExt)) {
    return cb(
      new AppError(
        'Invalid file type. Only PDF documents and JPG, PNG, or WebP images are allowed.',
        400,
        'INVALID_FILE_TYPE',
      ),
    );
  }

  cb(null, true);
};

// 5MB maximum file size per global file upload standards
export const ownerDocumentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 6, // 3 proof docs + up to 3 parking images in a single call if needed
  },
});

// Facility Photo Upload configuration (images only, max 10MB)
const photoStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    if (!fs.existsSync(submissionPhotosDir)) {
      fs.mkdirSync(submissionPhotosDir, { recursive: true });
    }
    cb(null, submissionPhotosDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_IMAGE_EXTENSIONS.has(rawExt) ? rawExt : '.jpg';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const userId = (req as Request & { user?: { _id?: { toString(): string } } }).user?._id?.toString() || 'anonymous';
    cb(null, `photo-${userId}-${Date.now()}-${randomHex}${safeExt}`);
  },
});

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp']);

const photoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const mime = file.mimetype.toLowerCase();
  const rawExt = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_IMAGE_TYPES.has(mime) || !ALLOWED_IMAGE_EXTENSIONS.has(rawExt)) {
    return cb(
      new AppError(
        'Invalid photo file type. Only JPG, PNG, and WebP images are allowed for parking photos.',
        400,
        'INVALID_IMAGE_TYPE',
      ),
    );
  }

  cb(null, true);
};

export const facilityPhotoUpload = multer({
  storage: photoStorage,
  fileFilter: photoFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per photo
    files: 10,
  },
});

// Facility Parking Plan PDF Upload configuration (PDF only, max 15MB)
const planPdfStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    if (!fs.existsSync(submissionPlansDir)) {
      fs.mkdirSync(submissionPlansDir, { recursive: true });
    }
    cb(null, submissionPlansDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const userId = (req as Request & { user?: { _id?: { toString(): string } } }).user?._id?.toString() || 'anonymous';
    cb(null, `plan-${userId}-${Date.now()}-${randomHex}.pdf`);
  },
});

const pdfFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const mime = file.mimetype.toLowerCase();
  const rawExt = path.extname(file.originalname).toLowerCase();

  if (mime !== 'application/pdf' || rawExt !== '.pdf') {
    return cb(
      new AppError(
        'Invalid file type. Parking plan reference document must be a PDF file.',
        400,
        'INVALID_PDF_TYPE',
      ),
    );
  }

  cb(null, true);
};

export const facilityPlanPdfUpload = multer({
  storage: planPdfStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
    files: 1, // Maximum one PDF
  },
});

// Profile Avatar Upload configuration (JPG, PNG, WebP only, max 5MB)
const avatarStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }
    cb(null, avatarsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_IMAGE_EXTENSIONS.has(rawExt) ? rawExt : '.jpg';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const reqWithAuth = req as Request & { userId?: string; user?: { _id?: { toString(): string } } };
    const userId = reqWithAuth.userId || reqWithAuth.user?._id?.toString() || 'user';
    cb(null, `avatar-${userId}-${Date.now()}-${randomHex}${safeExt}`);
  },
});

export const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: photoFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per avatar
    files: 1,
  },
});

// Incident Image Upload configuration (JPG, PNG, WebP only, max 10MB per file, max 5 files)
const incidentStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    if (!fs.existsSync(incidentUploadsDir)) {
      fs.mkdirSync(incidentUploadsDir, { recursive: true });
    }
    cb(null, incidentUploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_IMAGE_EXTENSIONS.has(rawExt) ? rawExt : '.jpg';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const reqWithAuth = req as Request & { userId?: string; user?: { _id?: { toString(): string } } };
    const userId = reqWithAuth.userId || reqWithAuth.user?._id?.toString() || 'staff';
    cb(null, `incident-${userId}-${Date.now()}-${randomHex}${safeExt}`);
  },
});

export const incidentImagesUpload = multer({
  storage: incidentStorage,
  fileFilter: photoFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per incident image
    files: 5, // Maximum 5 images per incident
  },
});

// Platform Branding Logo Upload configuration (JPG, PNG, WebP, SVG, max 5MB)
const ALLOWED_LOGO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);
const ALLOWED_LOGO_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp', '.svg']);

const logoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const mime = file.mimetype.toLowerCase();
  const rawExt = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_LOGO_MIME_TYPES.has(mime) || !ALLOWED_LOGO_EXTENSIONS.has(rawExt)) {
    return cb(
      new AppError(
        'Invalid file type. Only JPG, PNG, WebP, and SVG images are permitted for logos.',
        400,
        'INVALID_IMAGE_TYPE',
      ),
    );
  }
  cb(null, true);
};

const logoStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    if (!fs.existsSync(brandingDir)) {
      fs.mkdirSync(brandingDir, { recursive: true });
    }
    cb(null, brandingDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_LOGO_EXTENSIONS.has(rawExt) ? rawExt : '.png';
    const randomHex = crypto.randomBytes(8).toString('hex');
    cb(null, `logo-${Date.now()}-${randomHex}${safeExt}`);
  },
});

export const logoUpload = multer({
  storage: logoStorage,
  fileFilter: logoFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});



