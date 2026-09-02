import { NextFunction, Request, Response, Router } from 'express';
import { AppError } from '../middleware/error.middleware';
import { PubSubService, pubSubService } from '../services/pubsub.service';
import {
  WorkflowService,
  WorkflowServiceError,
  workflowService,
} from '../services/workflow.service';

export function createWorkflowRoutes(
  service: WorkflowService = workflowService,
  pubSub: PubSubService = pubSubService
): Router {
  const router = Router();

  router.post('/workflows', createStartWorkflowHandler(service, pubSub));
  router.get('/workflows/:workflowId', createGetWorkflowHandler(service));
  router.post('/workflows/:workflowId/retry', createRetryWorkflowHandler(service));

  return router;
}

function forwardWorkflowError(error: unknown, next: NextFunction): void {
  if (error instanceof WorkflowServiceError) {
    next(new AppError(error.message, error.statusCode, error.code));
    return;
  }
  next(error);
}

export function createStartWorkflowHandler(
  service: WorkflowService = workflowService,
  pubSub: PubSubService = pubSubService
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, tasks, name, mediaId } = req.body || {};

      if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
        throw new WorkflowServiceError(
          'projectId is required and must be a non-empty string.',
          'WORKFLOW_VALIDATION_ERROR',
          400
        );
      }

      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new WorkflowServiceError(
          'tasks must be a non-empty array of workflow tasks.',
          'WORKFLOW_VALIDATION_ERROR',
          400
        );
      }

      const workflow = await service.createWorkflow({ projectId, tasks, name });
      const messageId = await pubSub.publishWorkflowStarted(workflow.id, projectId, mediaId);

      res.status(202).json({
        workflowId: workflow.id,
        status: workflow.status,
        messageId,
        message: 'Workflow queued for processing.',
        workflow,
      });
    } catch (error) {
      forwardWorkflowError(error, next);
    }
  };
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
      forwardWorkflowError(error, next);
    }
  };
}

export function createRetryWorkflowHandler(service: WorkflowService = workflowService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const taskId = req.body?.taskId;
      if (taskId !== undefined && (typeof taskId !== 'string' || !taskId.trim())) {
        throw new WorkflowServiceError(
          'taskId must be a non-empty string when provided.',
          'WORKFLOW_VALIDATION_ERROR',
          400
        );
      }

      const queued = await service.queueWorkflowRetry(req.params.workflowId, taskId);
      res.status(202).json({
        workflow: queued.workflow,
        retry: {
          taskId: queued.taskId,
          status: 'queued',
        },
      });
    } catch (error) {
      forwardWorkflowError(error, next);
    }
  };
}

export const workflowRoutes = createWorkflowRoutes();
