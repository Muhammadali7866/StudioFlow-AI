import assert from 'node:assert/strict';
import test from 'node:test';
import { createRetryWorkflowHandler } from '../dist/routes/workflows.js';
import { classifyAgentError, isRetryableError } from '../dist/services/agent-error.js';
import {
  AgentExecutionError,
  AgentExecutionService,
} from '../dist/services/agent-execution.service.js';
import { WorkflowService } from '../dist/services/workflow.service.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarness() {
  const records = new Map();
  let id = 0;
  let tick = 0;
  const repository = {
    async saveWorkflow(workflow) {
      records.set(workflow.id, clone(workflow));
      return clone(workflow);
    },
    async getWorkflowById(workflowId) {
      const workflow = records.get(workflowId);
      return workflow ? clone(workflow) : null;
    },
    async updateWorkflow(workflowId, update) {
      const workflow = records.get(workflowId);
      if (!workflow) return null;
      const updated = update(clone(workflow));
      records.set(workflowId, clone(updated));
      return clone(updated);
    },
  };
  const workflowService = new WorkflowService({
    repository,
    idFactory: (prefix) => `${prefix}_${++id}`,
    now: () => new Date(Date.UTC(2026, 7, 31, 14, 0, tick++)),
  });

  return { records, workflowService };
}

async function createProcessingWorkflow(workflowService) {
  const workflow = await workflowService.createWorkflow({
    projectId: 'project_1',
    tasks: [{ id: 'transcript', agentName: 'transcript', action: 'Transcribe media' }],
  });
  await workflowService.transitionWorkflow(workflow.id, 'PROCESSING');
  return workflow;
}

test('classifies transient provider failures separately from invalid input', () => {
  assert.equal(isRetryableError({ status: 429, message: 'Quota exceeded' }), true);
  assert.equal(isRetryableError({ code: 'ETIMEDOUT', message: 'Timed out' }), true);
  assert.equal(isRetryableError({ statusCode: 503, message: 'Unavailable' }), true);
  assert.equal(isRetryableError({ cause: { code: 'ECONNRESET' } }), true);
  assert.equal(isRetryableError({ code: 429, message: 'Provider quota' }), true);
  assert.equal(isRetryableError({ code: 'INVALID_ARGUMENT', message: 'Bad media' }), false);
  assert.equal(isRetryableError(new Error('Unknown failure')), false);

  assert.deepEqual(classifyAgentError({ status: 400, message: 'Bad request' }), {
    code: 'AGENT_INVALID_INPUT',
    message: 'Bad request',
    retryable: false,
    statusCode: 400,
  });
});

test('recovers transient failures within bounded exponential backoff', async () => {
  const { workflowService } = createHarness();
  const workflow = await createProcessingWorkflow(workflowService);
  const delays = [];
  let calls = 0;
  const executionService = new AgentExecutionService({
    workflowService,
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 1_000,
    },
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  const output = await executionService.executeTask(workflow.id, 'transcript', async () => {
    calls += 1;
    if (calls < 3) throw { status: 503, message: 'Gemini unavailable' };
    return { segments: 14 };
  });

  assert.deepEqual(output, { segments: 14 });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [100, 200]);
  const recovered = await workflowService.getWorkflow(workflow.id);
  assert.equal(recovered.status, 'PROCESSING');
  assert.equal(recovered.tasks[0].status, 'completed');
  assert.deepEqual(
    recovered.tasks[0].attempts.map((attempt) => attempt.status),
    ['failed', 'failed', 'completed']
  );
});

test('fails the workflow after the initial attempt and three retries', async () => {
  const { workflowService } = createHarness();
  const workflow = await createProcessingWorkflow(workflowService);
  const delays = [];
  let calls = 0;
  const executionService = new AgentExecutionService({
    workflowService,
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 10,
      backoffMultiplier: 2,
      maxDelayMs: 25,
    },
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  await assert.rejects(
    executionService.executeTask(workflow.id, 'transcript', async () => {
      calls += 1;
      throw { status: 429, message: 'Rate limited' };
    }),
    (error) =>
      error instanceof AgentExecutionError &&
      error.code === 'AGENT_RETRY_EXHAUSTED' &&
      error.attempts === 4 &&
      error.lastError.code === 'AGENT_RATE_LIMITED'
  );

  assert.equal(calls, 4);
  assert.deepEqual(delays, [10, 20, 25]);
  const failed = await workflowService.getWorkflow(workflow.id);
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.tasks[0].attempts.length, 4);
  assert.equal(failed.tasks[0].error.code, 'AGENT_RATE_LIMITED');
  assert.match(failed.stateHistory.at(-1).reason, /after 4 attempts/);
});

test('fails non-retryable input errors immediately with a clear code', async () => {
  const { workflowService } = createHarness();
  const workflow = await createProcessingWorkflow(workflowService);
  const delays = [];
  let calls = 0;
  const executionService = new AgentExecutionService({
    workflowService,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  await assert.rejects(
    executionService.executeTask(workflow.id, 'transcript', async () => {
      calls += 1;
      throw { code: 'INVALID_ARGUMENT', status: 400, message: 'Media payload is invalid.' };
    }),
    (error) =>
      error instanceof AgentExecutionError &&
      error.code === 'AGENT_INVALID_INPUT' &&
      error.attempts === 1 &&
      error.statusCode === 400
  );

  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
  const failed = await workflowService.getWorkflow(workflow.id);
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.tasks[0].attempts.length, 1);
  assert.equal(failed.tasks[0].error.retryable, false);
});

test('POST retry requeues the failed task and restores the pre-failure state', async () => {
  const { workflowService } = createHarness();
  const workflow = await createProcessingWorkflow(workflowService);
  await workflowService.startTask(workflow.id, 'transcript');
  await workflowService.failTask(workflow.id, 'transcript', {
    code: 'AGENT_TIMEOUT',
    message: 'Timed out.',
    retryable: true,
    statusCode: 408,
  });
  await workflowService.transitionWorkflow(workflow.id, 'FAILED', 'Retries exhausted');

  const handler = createRetryWorkflowHandler(workflowService);
  const response = {
    statusCode: undefined,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  let forwardedError;

  await handler({ params: { workflowId: workflow.id }, body: {} }, response, (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError, undefined);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.retry.taskId, 'transcript');
  assert.equal(response.body.retry.status, 'queued');
  assert.equal(response.body.workflow.status, 'PROCESSING');
  assert.equal(response.body.workflow.tasks[0].status, 'pending');
  assert.equal(response.body.workflow.tasks[0].attempts.length, 1);
  assert.equal(response.body.workflow.tasks[0].error, undefined);
  assert.deepEqual(response.body.workflow.stateHistory.at(-1), {
    from: 'FAILED',
    to: 'PROCESSING',
    changedAt: '2026-08-31T14:00:05.000Z',
    reason: 'Manual retry queued for task transcript',
  });

  await handler({ params: { workflowId: workflow.id }, body: {} }, response, (error) => {
    forwardedError = error;
  });
  assert.equal(forwardedError.statusCode, 409);
  assert.equal(forwardedError.errorCode, 'WORKFLOW_RETRY_NOT_ALLOWED');
});
