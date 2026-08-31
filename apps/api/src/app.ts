import cors from 'cors';
import express, { Request, Response } from 'express';
import path from 'path';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request-logger';
import { agentRoutes } from './routes/agent';
import { projectRoutes } from './routes/projects';
import { workflowRoutes } from './routes/workflows';
import { firestoreService } from './services/firestore';
import { storageService } from './services/storage';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

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

app.use('/api', projectRoutes);
app.use('/api', workflowRoutes);
app.use('/api/agent', agentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
