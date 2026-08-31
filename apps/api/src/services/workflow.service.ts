import { randomUUID } from 'crypto';
import {
  Task,
  TaskError,
  Workflow,
  WorkflowState,
  WorkflowStateHistoryEntry,
} from '@studioflow/shared';
import { firestoreService } from './firestore';

export const WORKFLOW_TRANSITIONS: Readonly<Record<WorkflowState, readonly WorkflowState[]>> = {
  CREATED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['TRANSCRIBING', 'FAILED'],
  TRANSCRIBING: ['ANALYZING_ASSETS', 'CHECKING_COMPLIANCE', 'FAILED'],
  ANALYZING_ASSETS: ['CHECKING_COMPLIANCE', 'FAILED'],
  CHECKING_COMPLIANCE: ['GENERATING_PUBLISHING_PACKAGE', 'FAILED'],
  GENERATING_PUBLISHING_PACKAGE: ['REVIEW', 'FAILED'],
  REVIEW: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
};

export type WorkflowServiceErrorCode =
  | 'WORKFLOW_NOT_FOUND'
  | 'INVALID_WORKFLOW_TRANSITION'
  | 'WORKFLOW_VALIDATION_ERROR'
  | 'TASK_NOT_FOUND'
  | 'TASK_STATE_CONFLICT';

export class WorkflowServiceError extends Error {
  constructor(
    message: string,
    public readonly code: WorkflowServiceErrorCode,
    public readonly statusCode: number
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface WorkflowRepository {
  saveWorkflow(workflow: Workflow): Promise<Workflow>;
  getWorkflowById(id: string): Promise<Workflow | null>;
  updateWorkflow(id: string, update: (workflow: Workflow) => Workflow): Promise<Workflow | null>;
}

export interface CreateWorkflowTaskInput {
  id?: string;
  agentName: string;
  action: string;
}

export interface CreateWorkflowInput {
  id?: string;
  projectId: string;
  name?: string;
  tasks: CreateWorkflowTaskInput[];
}

export interface WorkflowServiceOptions {
  repository?: WorkflowRepository;
  now?: () => Date;
  idFactory?: (prefix: 'workflow' | 'task') => string;
}

function assertNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new WorkflowServiceError(`${field} is required.`, 'WORKFLOW_VALIDATION_ERROR', 400);
  }
  return normalized;
}

function getTask(workflow: Workflow, taskId: string): Task {
  const task = workflow.tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new WorkflowServiceError(
      `Task ${taskId} was not found in workflow ${workflow.id}.`,
      'TASK_NOT_FOUND',
      404
    );
  }
  return task;
}

export class WorkflowService {
  private readonly repository: WorkflowRepository;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: 'workflow' | 'task') => string;

  constructor(options: WorkflowServiceOptions = {}) {
    this.repository = options.repository || firestoreService;
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || ((prefix) => `${prefix}_${randomUUID()}`);
  }

  public async createWorkflow(input: CreateWorkflowInput): Promise<Workflow> {
    const projectId = assertNonEmpty(input.projectId, 'projectId');
    if (input.tasks.length === 0) {
      throw new WorkflowServiceError(
        'At least one workflow task is required.',
        'WORKFLOW_VALIDATION_ERROR',
        400
      );
    }

    const workflowId = input.id ? assertNonEmpty(input.id, 'id') : this.idFactory('workflow');
    const timestamp = this.now().toISOString();
    const taskIds = new Set<string>();
    const tasks = input.tasks.map((taskInput): Task => {
      const taskId = taskInput.id
        ? assertNonEmpty(taskInput.id, 'task.id')
        : this.idFactory('task');
      if (taskIds.has(taskId)) {
        throw new WorkflowServiceError(
          `Workflow task IDs must be unique. Duplicate: ${taskId}.`,
          'WORKFLOW_VALIDATION_ERROR',
          400
        );
      }
      taskIds.add(taskId);

      return {
        id: taskId,
        workflowId,
        agentName: assertNonEmpty(taskInput.agentName, 'task.agentName'),
        action: assertNonEmpty(taskInput.action, 'task.action'),
        status: 'pending',
        attempts: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });

    const initialHistory: WorkflowStateHistoryEntry = {
      from: null,
      to: 'CREATED',
      changedAt: timestamp,
      reason: 'Workflow created',
    };
    const workflow: Workflow = {
      id: workflowId,
      projectId,
      tasks,
      status: 'CREATED',
      stateHistory: [initialHistory],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    if (input.name?.trim()) {
      workflow.name = input.name.trim();
    }

    return this.repository.saveWorkflow(workflow);
  }

  public getWorkflow(workflowId: string): Promise<Workflow | null> {
    return this.repository.getWorkflowById(workflowId);
  }

  public async transitionWorkflow(
    workflowId: string,
    nextState: WorkflowState,
    reason?: string
  ): Promise<Workflow> {
    const changedAt = this.now().toISOString();
    return this.updateExistingWorkflow(workflowId, (workflow) => {
      const allowedStates = WORKFLOW_TRANSITIONS[workflow.status];
      if (!allowedStates.includes(nextState)) {
        throw new WorkflowServiceError(
          `Workflow cannot transition from ${workflow.status} to ${nextState}.`,
          'INVALID_WORKFLOW_TRANSITION',
          409
        );
      }

      const historyEntry: WorkflowStateHistoryEntry = {
        from: workflow.status,
        to: nextState,
        changedAt,
      };
      if (reason?.trim()) {
        historyEntry.reason = reason.trim();
      }

      return {
        ...workflow,
        status: nextState,
        stateHistory: [...workflow.stateHistory, historyEntry],
        updatedAt: changedAt,
      };
    });
  }

  public async startTask(workflowId: string, taskId: string): Promise<Workflow> {
    const startedAt = this.now().toISOString();
    return this.updateExistingWorkflow(workflowId, (workflow) => {
      const task = getTask(workflow, taskId);
      if (task.status !== 'pending' && task.status !== 'failed') {
        throw new WorkflowServiceError(
          `Task ${taskId} cannot start while it is ${task.status}.`,
          'TASK_STATE_CONFLICT',
          409
        );
      }

      const nextAttempt = {
        attempt: task.attempts.length + 1,
        status: 'in_progress' as const,
        startedAt,
      };

      const updatedTask: Task = {
        ...task,
        status: 'in_progress',
        attempts: [...task.attempts, nextAttempt],
        updatedAt: startedAt,
      };
      delete updatedTask.error;
      delete updatedTask.output;

      return this.replaceTask(workflow, taskId, updatedTask);
    });
  }

  public async completeTask(
    workflowId: string,
    taskId: string,
    output?: Record<string, unknown>
  ): Promise<Workflow> {
    return this.finishTask(workflowId, taskId, 'completed', output);
  }

  public async failTask(workflowId: string, taskId: string, error: TaskError): Promise<Workflow> {
    if (!error.code.trim() || !error.message.trim()) {
      throw new WorkflowServiceError(
        'Task error code and message are required.',
        'WORKFLOW_VALIDATION_ERROR',
        400
      );
    }
    return this.finishTask(workflowId, taskId, 'failed', undefined, error);
  }

  private async finishTask(
    workflowId: string,
    taskId: string,
    status: 'completed' | 'failed',
    output?: Record<string, unknown>,
    error?: TaskError
  ): Promise<Workflow> {
    const completedAt = this.now().toISOString();
    return this.updateExistingWorkflow(workflowId, (workflow) => {
      const task = getTask(workflow, taskId);
      const currentAttempt = task.attempts.at(-1);
      if (task.status !== 'in_progress' || !currentAttempt) {
        throw new WorkflowServiceError(
          `Task ${taskId} cannot finish while it is ${task.status}.`,
          'TASK_STATE_CONFLICT',
          409
        );
      }

      const finishedAttempt = {
        ...currentAttempt,
        status,
        completedAt,
        ...(output ? { output } : {}),
        ...(error ? { error } : {}),
      };
      const attempts = [...task.attempts.slice(0, -1), finishedAttempt];
      const updatedTask: Task = {
        ...task,
        status,
        attempts,
        updatedAt: completedAt,
      };

      if (output) {
        updatedTask.output = output;
      } else {
        delete updatedTask.output;
      }
      if (error) {
        updatedTask.error = error;
      } else {
        delete updatedTask.error;
      }

      return this.replaceTask(workflow, taskId, updatedTask);
    });
  }

  private replaceTask(workflow: Workflow, taskId: string, task: Task): Workflow {
    return {
      ...workflow,
      tasks: workflow.tasks.map((candidate) => (candidate.id === taskId ? task : candidate)),
      updatedAt: task.updatedAt,
    };
  }

  private async updateExistingWorkflow(
    workflowId: string,
    update: (workflow: Workflow) => Workflow
  ): Promise<Workflow> {
    const updated = await this.repository.updateWorkflow(workflowId, update);
    if (!updated) {
      throw new WorkflowServiceError(
        `Workflow ${workflowId} was not found.`,
        'WORKFLOW_NOT_FOUND',
        404
      );
    }
    return updated;
  }
}

export const workflowService = new WorkflowService();
