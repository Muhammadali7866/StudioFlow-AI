import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import multer from 'multer';
import { AppError } from '../middleware/error.middleware';
import { firestoreService } from '../services/firestore';
import { storageService } from '../services/storage';
import { Project, MediaAsset } from '@studioflow/shared';

const router = Router();

// M6-01: Strict MIME-type + file extension allowlist (removed application/octet-stream bypass)
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/aac',
]);
const ALLOWED_EXTENSIONS = new Set([
  '.mp4', '.mov', '.webm', '.avi', '.mkv',
  '.mp3', '.wav', '.ogg', '.m4a', '.aac',
]);

const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max video
    fieldSize: 10 * 1024,        // 10 KB for text fields
    fields: 10,                  // Max 10 non-file fields
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Invalid file type. Allowed formats: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
          400,
          'INVALID_FILE_TYPE'
        )
      );
    }
  },
});

// POST /api/projects - Create Project
router.post('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Project name is required.', 400, 'VALIDATION_ERROR');
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newProject: Project = {
      id: projectId,
      name: name.trim(),
      description: description?.trim(),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      ownerId: req.user?.uid ?? 'anonymous', // M6-01: use authenticated Firebase uid
      mediaAssets: [],
    };

    const savedProject = await firestoreService.saveProject(newProject);
    res.status(201).json(savedProject);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects - List all projects
router.get('/projects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await firestoreService.listProjects();
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Get Project by ID
router.get('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await firestoreService.getProjectById(id);

    if (!project) {
      throw new AppError('Project was not found.', 404, 'PROJECT_NOT_FOUND');
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/media - Upload Video/Media Asset
router.post(
  '/projects/:projectId/media',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const file = req.file;

      if (!file) {
        throw new AppError('No video file attached to request.', 400, 'FILE_MISSING');
      }

      // Verify project exists
      const project = await firestoreService.getProjectById(projectId);
      if (!project) {
        throw new AppError('Parent project was not found.', 404, 'PROJECT_NOT_FOUND');
      }

      const mediaId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const destinationPath = `projects/${projectId}/${mediaId}_${file.originalname}`;

      // Upload file to Storage Service
      const uploadResult = await storageService.uploadFile(
        file.buffer,
        destinationPath,
        file.mimetype
      );

      const mediaAsset: MediaAsset = {
        id: mediaId,
        projectId,
        fileName: file.originalname,
        storagePath: uploadResult.storagePath,
        mimeType: file.mimetype,
        size: file.size,
        status: 'uploaded',
        createdAt: new Date().toISOString(),
        publicUrl: uploadResult.publicUrl,
      };

      // Save media metadata to Firestore
      const savedAsset = await firestoreService.saveMediaAsset(mediaAsset);
      res.status(201).json(savedAsset);
    } catch (error) {
      next(error);
    }
  }
);

export const projectRoutes = router;
