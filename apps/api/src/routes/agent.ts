import { Router, Request, Response, NextFunction } from 'express';
import { rootAgent } from '@studioflow/agents';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// POST /api/agent/test - Test Google ADK / Gemini connectivity
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    const promptMessage = typeof message === 'string' ? message : 'Hello StudioFlow';

    const response = await rootAgent.processMessage(promptMessage);
    res.json(response);
  } catch (error: any) {
    next(new AppError(`Failed to execute ADK Root Agent: ${error?.message || error}`, 500, 'AGENT_EXECUTION_ERROR'));
  }
});

export const agentRoutes = router;
