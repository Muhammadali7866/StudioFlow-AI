import { NextFunction, Request, Response, Router } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  WorkflowService,
  WorkflowServiceError,
  workflowService,
} from '../services/workflow.service';

export function createWorkflowRoutes(service: WorkflowService = workflowService): Router {
  const router = Router();

  router.get('/workflows/:workflowId', createGetWorkflowHandler(service));

  return router;
}

export function createGetWorkflowHandler(service: WorkflowService = workflowService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workflow = await service.getWorkflow(req.params.workflowId);
      if (!workflow) {
        throw new WorkflowServiceError(
          `Workflow ${req.params.workflowId} was not found.`,
          'WORKFLOW_NOT_FOUND',
          404
        );
      }
      res.json(workflow);
    } catch (error) {
      if (error instanceof WorkflowServiceError) {
        next(new AppError(error.message, error.statusCode, error.code));
        return;
      }
      next(error);
    }
  };
}

export const workflowRoutes = createWorkflowRoutes();
