import { env } from '@studioflow/config';
import app from './app';
import { grafanaService } from './services/grafana';
import { workflowWorker } from './workflow.worker';

const PORT = env.port || 4000;

const server = app.listen(PORT, async () => {
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

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`🛑 [StudioFlow API] ${signal} received; shutting down gracefully`);

  server.close((error) => {
    if (error) {
      console.error('❌ [StudioFlow API] Failed to close HTTP server:', error);
      process.exitCode = 1;
    }
  });
  await Promise.allSettled([workflowWorker.stop(), grafanaService.shutdown()]);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

export default app;
