import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { createStartWorkflowHandler } from '../dist/routes/workflows.js';
import { MemoryPubSubService } from '../dist/services/pubsub.service.js';
import { WorkflowService } from '../dist/services/workflow.service.js';
import { WorkflowWorker } from '../dist/workflow.worker.js';

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
  const pubSubService = new MemoryPubSubService();

  return { records, workflowService, pubSubService };
}

test('publishWorkflowStarted stores correct event in MemoryPubSubService', async () => {
  const pubSub = new MemoryPubSubService();
  const messageId = await pubSub.publishWorkflowStarted('wf_1', 'proj_1', 'media_1');

  assert.ok(messageId);
  const events = pubSub.getPublishedEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'WorkflowStarted');
  assert.equal(events[0].workflowId, 'wf_1');
  assert.equal(events[0].projectId, 'proj_1');
  assert.equal(events[0].mediaId, 'media_1');
});

test('subscribeWorkflowEvents delivers published events to subscriber handler', async () => {
  const pubSub = new MemoryPubSubService();
  const received = [];

  const unsubscribe = await pubSub.subscribeWorkflowEvents(async (event) => {
    received.push(event);
  });

  await pubSub.publishWorkflowStarted('wf_2', 'proj_2');

  // Wait brief tick for async delivery
  await setTimeout(50);

  assert.equal(received.length, 1);
  assert.equal(received[0].workflowId, 'wf_2');

  await unsubscribe();
});

test('POST /api/workflows handler publishes event and returns HTTP 202 Accepted', async () => {
  const { workflowService, pubSubService } = createHarness();
  const handler = createStartWorkflowHandler(workflowService, pubSubService);

  const req = {
    body: {
      projectId: 'proj_3',
      mediaId: 'media_3',
      name: 'Launch video',
      tasks: [{ agentName: 'transcript', action: 'Transcribe audio' }],
    },
  };

  let statusCode;
  let jsonResult;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResult = data;
    },
  };

  await handler(req, res, () => {});

  assert.equal(statusCode, 202);
  assert.ok(jsonResult.workflowId);
  assert.equal(jsonResult.status, 'CREATED');
  assert.equal(jsonResult.message, 'Workflow queued for processing.');

  const events = pubSubService.getPublishedEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].workflowId, jsonResult.workflowId);
});

test('WorkflowWorker processes WorkflowStartedEvent and transitions workflow to PROCESSING', async () => {
  const { workflowService, pubSubService } = createHarness();
  const telemetryEvents = [];
  const worker = new WorkflowWorker({
    pubSubService,
    workflowService,
    telemetry: {
      recordWorkflowStarted(workflowId) {
        telemetryEvents.push({ type: 'started', workflowId });
      },
      recordWorkflowFinished(workflowId, status) {
        telemetryEvents.push({ type: 'finished', workflowId, status });
      },
    },
  });

  const workflow = await workflowService.createWorkflow({
    projectId: 'proj_4',
    tasks: [{ agentName: 'transcript', action: 'Transcribe audio' }],
  });

  await worker.handleEvent({
    eventType: 'WorkflowStarted',
    workflowId: workflow.id,
    projectId: 'proj_4',
    publishedAt: new Date().toISOString(),
  });

  const updated = await workflowService.getWorkflow(workflow.id);
  assert.ok(updated);
  assert.ok(updated.status !== 'CREATED');
  assert.deepEqual(telemetryEvents, [
    { type: 'started', workflowId: workflow.id },
    { type: 'finished', workflowId: workflow.id, status: 'completed' },
  ]);
});

test('WorkflowWorker reports failed workflow outcomes to telemetry', async () => {
  const { workflowService, pubSubService } = createHarness();
  const telemetryEvents = [];
  const worker = new WorkflowWorker({
    pubSubService,
    workflowService,
    agentExecutionService: {
      async executeTask(workflowId, taskId) {
        await workflowService.startTask(workflowId, taskId);
        await workflowService.failTask(workflowId, taskId, {
          code: 'AGENT_TIMEOUT',
          message: 'Timed out.',
          retryable: true,
        });
        await workflowService.transitionWorkflow(workflowId, 'FAILED');
        throw new Error('Agent retries exhausted');
      },
    },
    telemetry: {
      recordWorkflowStarted(workflowId) {
        telemetryEvents.push({ type: 'started', workflowId });
      },
      recordWorkflowFinished(workflowId, status) {
        telemetryEvents.push({ type: 'finished', workflowId, status });
      },
    },
  });
  const workflow = await workflowService.createWorkflow({
    projectId: 'proj_failed',
    tasks: [{ id: 'custom', agentName: 'custom', action: 'Fail task' }],
  });

  await worker.handleEvent({
    eventType: 'WorkflowStarted',
    workflowId: workflow.id,
    projectId: workflow.projectId,
    publishedAt: new Date().toISOString(),
  });

  assert.deepEqual(telemetryEvents, [
    { type: 'started', workflowId: workflow.id },
    { type: 'finished', workflowId: workflow.id, status: 'failed' },
  ]);
});
