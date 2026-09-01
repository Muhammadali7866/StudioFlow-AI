import { env } from '@studioflow/config';
import app from './app';
import { workflowWorker } from './workflow.worker';

const PORT = env.port || 4000;

app.listen(PORT, async () => {
  console.log(`🚀 [StudioFlow API] Server running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔍 Status Check: http://localhost:${PORT}/api/status`);

  try {
    await workflowWorker.start();
    console.log(`📨 [StudioFlow Worker] Pub/Sub subscriber worker listening for workflow events`);
  } catch (error) {
    console.warn(`⚠️ [StudioFlow Worker] Failed to start Pub/Sub worker subscriber:`, error);
  }
});

export default app;
