import {
  InvestigationTraceSpan,
  Task,
  TaskAttempt,
  TaskError,
  Workflow,
  WorkflowInvestigation,
} from '@studioflow/shared';
import { WorkflowService, workflowService } from './workflow.service';

interface FailedTaskContext {
  task: Task;
  failedAttempts: Array<TaskAttempt & { error: TaskError }>;
}

export class WorkflowInvestigationService {
  constructor(private readonly workflows: WorkflowService = workflowService) {}

  public async getInvestigation(workflowId: string): Promise<WorkflowInvestigation | null> {
    const workflow = await this.workflows.getWorkflow(workflowId);
    if (!workflow) return null;

    const context = this.findLatestFailedTask(workflow);
    if (!context) return null;

    return this.buildInvestigation(workflow, context);
  }

  private findLatestFailedTask(workflow: Workflow): FailedTaskContext | undefined {
    return workflow.tasks
      .map((task) => ({
        task,
        failedAttempts: task.attempts.filter(
          (attempt): attempt is TaskAttempt & { error: TaskError } =>
            attempt.status === 'failed' && Boolean(attempt.error)
        ),
      }))
      .filter((context) => context.failedAttempts.length > 0)
      .sort((left, right) => {
        const leftTimestamp = this.attemptTimestamp(left.failedAttempts.at(-1));
        const rightTimestamp = this.attemptTimestamp(right.failedAttempts.at(-1));
        return rightTimestamp - leftTimestamp;
      })[0];
  }

  private buildInvestigation(
    workflow: Workflow,
    { task, failedAttempts }: FailedTaskContext
  ): WorkflowInvestigation {
    const firstFailure = failedAttempts[0];
    const latestFailure = failedAttempts.at(-1) || firstFailure;
    const recoveredAttempt = task.attempts.find(
      (attempt) => attempt.attempt > latestFailure.attempt && attempt.status === 'completed'
    );
    const incidentAttempts = task.attempts.filter(
      (attempt) => attempt.attempt >= firstFailure.attempt
    );
    const startedAtMs = this.timestamp(firstFailure.startedAt);
    const finishedAt = recoveredAttempt?.completedAt || workflow.updatedAt;
    const finishedAtMs = Math.max(startedAtMs, this.timestamp(finishedAt));
    const totalDurationMs = Math.max(0, finishedAtMs - startedAtMs);
    const error = latestFailure.error;
    const recovered = Boolean(recoveredAttempt);
    const workflowLabel = this.escapeQueryLabel(workflow.id);
    const agentLabel = this.escapeQueryLabel(task.agentName);

    return {
      source: 'backend',
      incidentId: `${workflow.id}:${task.id}:${firstFailure.attempt}`,
      traceId: workflow.id,
      workflowId: workflow.id,
      failedAgent: task.agentName,
      errorCode: error.code,
      startedAt: firstFailure.startedAt,
      recoveredIn: recovered ? this.formatDuration(totalDurationMs) : 'Pending',
      totalDurationMs,
      diagnosis: this.diagnose(error),
      decision: this.decide(error, recovered),
      action: this.action(task, latestFailure, recoveredAttempt),
      query: `{service_name="studioflow-api"} | json | workflowId="${workflowLabel}" | agentType="${agentLabel}"`,
      metricQuery: `sum(increase(studioflow_agent_failures_total{workflowId="${workflowLabel}",agentType="${agentLabel}"}[$__range]))`,
      steps: [
        {
          label: 'Failure',
          detail: `${task.agentName} returned ${error.code}`,
          tone: 'danger',
        },
        {
          label: 'Correlate',
          detail: `${failedAttempts.length} failed attempt${failedAttempts.length === 1 ? '' : 's'} matched persisted telemetry`,
          tone: 'info',
        },
        {
          label: 'Decide',
          detail: error.retryable ? 'Bounded retry is allowed' : 'Human input is required',
          tone: error.retryable ? 'warning' : 'danger',
        },
        {
          label: recovered ? 'Recovered' : 'Pending',
          detail: recoveredAttempt
            ? `Attempt ${recoveredAttempt.attempt} completed successfully`
            : error.retryable
              ? 'Awaiting the next retry attempt'
              : 'Awaiting a corrected input or producer decision',
          tone: recovered ? 'success' : 'warning',
        },
      ],
      trace: this.buildTrace(incidentAttempts, startedAtMs, finishedAtMs, task.agentName),
      logEvidence: incidentAttempts.map((attempt) => ({
        timestamp: attempt.completedAt || attempt.startedAt,
        source: `${task.agentName}-agent`,
        message:
          attempt.status === 'failed'
            ? `${attempt.error?.code || 'AGENT_ERROR'}: ${attempt.error?.message || 'Agent attempt failed.'}`
            : `Attempt ${attempt.attempt} ${attempt.status.replace('_', ' ')}.`,
      })),
      metricEvidence: [
        { label: 'Failed attempts', value: String(failedAttempts.length) },
        { label: 'Total attempts', value: String(incidentAttempts.length) },
        {
          label: 'Latest attempt duration',
          value: `${this.attemptDuration(incidentAttempts.at(-1), finishedAtMs)}ms`,
        },
        { label: 'Recovery status', value: recovered ? 'Recovered' : 'Pending' },
      ],
    };
  }

  private buildTrace(
    attempts: TaskAttempt[],
    incidentStartedAt: number,
    incidentFinishedAt: number,
    agentName: string
  ): InvestigationTraceSpan[] {
    const timelineMs = Math.max(1, incidentFinishedAt - incidentStartedAt);
    return attempts.map((attempt) => {
      const attemptStartedAt = this.timestamp(attempt.startedAt);
      const durationMs = this.attemptDuration(attempt, incidentFinishedAt);
      return {
        name: `${agentName}.attempt.${attempt.attempt}`,
        service: `${agentName}-agent`,
        durationMs,
        offsetPercent: this.percent(attemptStartedAt - incidentStartedAt, timelineMs),
        widthPercent: Math.max(2, this.percent(durationMs, timelineMs)),
        tone:
          attempt.status === 'failed'
            ? 'danger'
            : attempt.status === 'completed'
              ? 'success'
              : 'warning',
      };
    });
  }

  private diagnose(error: TaskError): string {
    if (error.code.includes('RATE_LIMIT')) {
      return 'The model provider throttled the request; persisted workflow data remained intact.';
    }
    if (error.code.includes('TIMEOUT') || error.code.includes('UNAVAILABLE')) {
      return 'A transient provider or network failure interrupted the agent operation.';
    }
    if (!error.retryable) {
      return 'The agent rejected the input, so repeating the same operation would not resolve it.';
    }
    return 'The agent failed with a retryable error and did not commit a successful task output.';
  }

  private decide(error: TaskError, recovered: boolean): string {
    if (recovered) {
      return 'The bounded retry policy recovered the idempotent task without restarting the workflow.';
    }
    if (error.retryable) {
      return 'A bounded retry is safe because failed attempts do not persist partial task output.';
    }
    return 'Automated retry is unsafe until the invalid input or configuration is corrected.';
  }

  private action(task: Task, failedAttempt: TaskAttempt, recoveredAttempt?: TaskAttempt): string {
    if (recoveredAttempt) {
      return `Attempt ${recoveredAttempt.attempt} succeeded and ${task.agentName} processing resumed.`;
    }
    if (failedAttempt.error?.retryable) {
      return `Queue the next bounded retry for ${task.agentName}.`;
    }
    return `Correct the ${task.agentName} input before retrying.`;
  }

  private attemptDuration(attempt: TaskAttempt | undefined, fallbackEnd: number): number {
    if (!attempt) return 0;
    return Math.max(
      0,
      this.timestamp(attempt.completedAt, fallbackEnd) - this.timestamp(attempt.startedAt)
    );
  }

  private attemptTimestamp(attempt: TaskAttempt | undefined): number {
    return this.timestamp(attempt?.completedAt || attempt?.startedAt);
  }

  private timestamp(value: string | undefined, fallback = 0): number {
    if (!value) return fallback;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : fallback;
  }

  private percent(value: number, total: number): number {
    return Math.min(100, Math.max(0, (value / total) * 100));
  }

  private escapeQueryLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1_000) return `${milliseconds}ms`;
    return `${(milliseconds / 1_000).toFixed(1)}s`;
  }
}

export const workflowInvestigationService = new WorkflowInvestigationService();
