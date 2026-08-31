import { TaskError } from '@studioflow/shared';
import { classifyAgentError } from './agent-error';
import { WorkflowService, workflowService } from './workflow.service';

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export interface AgentExecutionContext {
  workflowId: string;
  taskId: string;
  attempt: number;
}

export type AgentTaskOperation<T extends Record<string, unknown>> = (
  context: AgentExecutionContext
) => Promise<T>;

export interface AgentExecutionServiceOptions {
  workflowService?: WorkflowService;
  retryPolicy?: Partial<RetryPolicy>;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class AgentExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly attempts: number,
    public readonly lastError: TaskError,
    public readonly statusCode: number
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 5_000,
};

export class AgentExecutionService {
  private readonly workflows: WorkflowService;
  private readonly retryPolicy: RetryPolicy;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: AgentExecutionServiceOptions = {}) {
    this.workflows = options.workflowService || workflowService;
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...options.retryPolicy };
    this.sleep =
      options.sleep ||
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.validatePolicy();
  }

  public async executeTask<T extends Record<string, unknown>>(
    workflowId: string,
    taskId: string,
    operation: AgentTaskOperation<T>
  ): Promise<T> {
    const maximumAttempts = this.retryPolicy.maxRetries + 1;

    for (let runAttempt = 1; runAttempt <= maximumAttempts; runAttempt += 1) {
      const started = await this.workflows.startTask(workflowId, taskId);
      const persistedTask = started.tasks.find((task) => task.id === taskId);
      const persistedAttempt = persistedTask?.attempts.at(-1)?.attempt ?? runAttempt;

      let output: T;
      try {
        output = await operation({
          workflowId,
          taskId,
          attempt: persistedAttempt,
        });
      } catch (error) {
        const classified = classifyAgentError(error);
        await this.workflows.failTask(workflowId, taskId, classified);

        const retryExhausted = runAttempt === maximumAttempts;
        if (!classified.retryable || retryExhausted) {
          await this.failWorkflow(workflowId, taskId, classified, runAttempt);
          const code = classified.retryable ? 'AGENT_RETRY_EXHAUSTED' : classified.code;
          const statusCode = classified.retryable ? 502 : classified.statusCode || 422;
          throw new AgentExecutionError(
            classified.retryable
              ? `Agent task ${taskId} failed after ${runAttempt} attempts.`
              : classified.message,
            code,
            runAttempt,
            classified,
            statusCode
          );
        }

        await this.sleep(this.getBackoffDelay(runAttempt));
        continue;
      }

      await this.workflows.completeTask(workflowId, taskId, output);
      return output;
    }

    throw new Error('Agent retry loop exited unexpectedly.');
  }

  private getBackoffDelay(completedAttempt: number): number {
    const delay =
      this.retryPolicy.initialDelayMs *
      this.retryPolicy.backoffMultiplier ** Math.max(0, completedAttempt - 1);
    return Math.min(delay, this.retryPolicy.maxDelayMs);
  }

  private async failWorkflow(
    workflowId: string,
    taskId: string,
    error: TaskError,
    attempts: number
  ): Promise<void> {
    const workflow = await this.workflows.getWorkflow(workflowId);
    if (!workflow || workflow.status === 'FAILED' || workflow.status === 'COMPLETED') return;

    await this.workflows.transitionWorkflow(
      workflowId,
      'FAILED',
      `Task ${taskId} failed after ${attempts} attempt${attempts === 1 ? '' : 's'} (${error.code})`
    );
  }

  private validatePolicy(): void {
    const { maxRetries, initialDelayMs, backoffMultiplier, maxDelayMs } = this.retryPolicy;
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new Error('maxRetries must be a non-negative integer.');
    }
    if (initialDelayMs < 0 || maxDelayMs < 0 || backoffMultiplier < 1) {
      throw new Error(
        'Retry delays must be non-negative and backoffMultiplier must be at least 1.'
      );
    }
    if (initialDelayMs > maxDelayMs) {
      throw new Error('initialDelayMs cannot exceed maxDelayMs.');
    }
  }
}

export const agentExecutionService = new AgentExecutionService();
