import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import multer from 'multer';
import { AppError } from '../middleware/error.middleware';
import { firestoreService, type FirestoreService } from '../services/firestore';
import { storageService, type StorageService } from '../services/storage';
import { Project, MediaAsset } from '@studioflow/shared';

export type ProjectRepository = Pick<
  FirestoreService,
  'saveProject' | 'listProjects' | 'getProjectById' | 'saveMediaAsset'
>;
export type MediaStorage = Pick<StorageService, 'uploadFile'>;

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
  '.mp4',
  '.mov',
  '.webm',
  '.avi',
  '.mkv',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
]);

const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max video
    fieldSize: 10 * 1024, // 10 KB for text fields
    fields: 10, // Max 10 non-file fields
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

function startsWith(buffer: Buffer, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => buffer[offset + index] === byte);
}

function containsAscii(buffer: Buffer, value: string, offset: number): boolean {
  return (
    buffer.length >= offset + value.length &&
    buffer.toString('ascii', offset, offset + value.length) === value
  );
}

export function hasValidMediaSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length === 0) return false;

  switch (mimeType) {
    case 'video/mp4':
    case 'video/quicktime':
    case 'audio/x-m4a':
      return containsAscii(buffer, 'ftyp', 4);
    case 'video/webm':
    case 'video/x-matroska':
      return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'video/x-msvideo':
      return containsAscii(buffer, 'RIFF', 0) && containsAscii(buffer, 'AVI ', 8);
    case 'audio/wav':
      return containsAscii(buffer, 'RIFF', 0) && containsAscii(buffer, 'WAVE', 8);
    case 'audio/ogg':
      return containsAscii(buffer, 'OggS', 0);
    case 'audio/mpeg':
      return (
        containsAscii(buffer, 'ID3', 0) ||
        (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      );
    case 'audio/aac':
      return buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0;
    default:
      return false;
  }
}

export function createProjectRoutes(
  repository: ProjectRepository = firestoreService,
  storage: MediaStorage = storageService
): Router {
  const router = Router();

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

      const savedProject = await repository.saveProject(newProject);
      res.status(201).json(savedProject);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/projects - List all projects
  router.get('/projects', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const projects = await repository.listProjects();
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/projects/:id - Get Project by ID
  router.get('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const project = await repository.getProjectById(id);

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
        if (!hasValidMediaSignature(file.buffer, file.mimetype)) {
          throw new AppError(
            'Uploaded media content is corrupt or does not match its declared file type.',
            400,
            'CORRUPT_MEDIA_FILE'
          );
        }

        // Verify project exists
        const project = await repository.getProjectById(projectId);
        if (!project) {
          throw new AppError('Parent project was not found.', 404, 'PROJECT_NOT_FOUND');
        }

        const mediaId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const destinationPath = `projects/${projectId}/${mediaId}_${file.originalname}`;

        let uploadResult: Awaited<ReturnType<MediaStorage['uploadFile']>>;
        try {
          uploadResult = await storage.uploadFile(file.buffer, destinationPath, file.mimetype);
        } catch {
          throw new AppError(
            'Media storage is temporarily unavailable. Please try the upload again.',
            503,
            'STORAGE_UNAVAILABLE'
          );
        }

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
        const savedAsset = await repository.saveMediaAsset(mediaAsset);
        res.status(201).json(savedAsset);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export const projectRoutes = createProjectRoutes();
