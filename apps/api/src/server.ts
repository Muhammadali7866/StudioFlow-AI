import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { env } from '@studioflow/config';
import { firestoreService } from './services/firestore';
import { storageService } from './services/storage';
import { projectRoutes } from './routes/projects';
import { agentRoutes } from './routes/agent';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request-logger';

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve local upload fallbacks if necessary
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// GET /health - Basic health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// GET /api/status - Connectivity check endpoint for API, Firestore, and Cloud Storage
app.get('/api/status', async (_req: Request, res: Response) => {
  const isFirestoreOk = await firestoreService.checkHealth();
  const isStorageOk = await storageService.checkHealth();

  res.json({
    api: true,
    firestore: isFirestoreOk,
    storage: isStorageOk,
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api', projectRoutes);
app.use('/api/agent', agentRoutes);

// Error Handling & 404
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = env.port || 4000;

app.listen(PORT, () => {
  console.log(`🚀 [StudioFlow API] Server running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔍 Status Check: http://localhost:${PORT}/api/status`);
});

export default app;
