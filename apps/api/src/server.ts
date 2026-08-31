import { env } from '@studioflow/config';
import app from './app';

const PORT = env.port || 4000;

app.listen(PORT, () => {
  console.log(`🚀 [StudioFlow API] Server running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔍 Status Check: http://localhost:${PORT}/api/status`);
});

export default app;
