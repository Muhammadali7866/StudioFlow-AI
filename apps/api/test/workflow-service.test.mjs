import assert from 'node:assert/strict';
import test from 'node:test';
import { createGetWorkflowHandler } from '../dist/routes/workflows.js';
import { WorkflowService, WorkflowServiceError } from '../dist/services/workflow.service.js';

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
  const service = new WorkflowService({
    repository,
    idFactory: (prefix) => `${prefix}_${++id}`,
    now: () => new Date(Date.UTC(2026, 7, 31, 12, 0, tick++)),
  });

  return { records, repository, service };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const TASKS = [
  { id: 'transcript', agentName: 'transcript', action: 'Transcribe media' },
  { id: 'assets', agentName: 'asset', action: 'Analyze visual assets' },
];

test('creates a persisted workflow with task and initial state history', async () => {
  const { records, service } = createHarness();
  const workflow = await service.createWorkflow({
    projectId: 'project_1',
    name: 'Launch video',
    tasks: TASKS,
  });

  assert.equal(workflow.status, 'CREATED');
  assert.equal(workflow.tasks.length, 2);
  assert.equal(workflow.tasks[0].workflowId, workflow.id);
  assert.deepEqual(workflow.tasks[0].attempts, []);
  assert.deepEqual(workflow.stateHistory[0], {
    from: null,
    to: 'CREATED',
    changedAt: '2026-08-31T12:00:00.000Z',
    reason: 'Workflow created',
  });
  assert.ok(records.has(workflow.id));
});

test('persists every valid workflow transition in order', async () => {
  const { service } = createHarness();
  const workflow = await service.createWorkflow({ projectId: 'project_1', tasks: TASKS });
  const states = [
    'PROCESSING',
    'TRANSCRIBING',
    'ANALYZING_ASSETS',
    'CHECKING_COMPLIANCE',
    'GENERATING_PUBLISHING_PACKAGE',
    'REVIEW',
    'COMPLETED',
  ];

  for (const state of states) {
    await service.transitionWorkflow(workflow.id, state, `Entered ${state}`);
  }

  const recovered = await service.getWorkflow(workflow.id);
  assert.equal(recovered.status, 'COMPLETED');
  assert.deepEqual(
    recovered.stateHistory.map((entry) => entry.to),
    ['CREATED', ...states]
  );
  assert.equal(recovered.stateHistory.at(-1).reason, 'Entered COMPLETED');
});

test('allows audio-only workflows to skip visual asset analysis', async () => {
  const { service } = createHarness();
  const workflow = await service.createWorkflow({ projectId: 'project_audio', tasks: [TASKS[0]] });

  await service.transitionWorkflow(workflow.id, 'PROCESSING');
  await service.transitionWorkflow(workflow.id, 'TRANSCRIBING');
  const updated = await service.transitionWorkflow(workflow.id, 'CHECKING_COMPLIANCE');

  assert.equal(updated.status, 'CHECKING_COMPLIANCE');
});

test('rejects invalid transitions without mutating persisted state', async () => {
  const { service } = createHarness();
  const workflow = await service.createWorkflow({ projectId: 'project_1', tasks: TASKS });

  await assert.rejects(
    service.transitionWorkflow(workflow.id, 'REVIEW'),
    (error) => error instanceof WorkflowServiceError && error.code === 'INVALID_WORKFLOW_TRANSITION'
  );

  const recovered = await service.getWorkflow(workflow.id);
  assert.equal(recovered.status, 'CREATED');
  assert.equal(recovered.stateHistory.length, 1);
});

test('records successful and failed task attempts', async () => {
  const { service } = createHarness();
  const workflow = await service.createWorkflow({ projectId: 'project_1', tasks: TASKS });

  await service.startTask(workflow.id, 'transcript');
  await service.completeTask(workflow.id, 'transcript', { segments: 12 });
  await service.startTask(workflow.id, 'assets');
  const updated = await service.failTask(workflow.id, 'assets', {
    code: 'ASSET_TIMEOUT',
    message: 'Asset analysis timed out.',
    retryable: true,
  });

  const transcript = updated.tasks.find((task) => task.id === 'transcript');
  const assets = updated.tasks.find((task) => task.id === 'assets');
  assert.equal(transcript.status, 'completed');
  assert.deepEqual(transcript.attempts[0].output, { segments: 12 });
  assert.equal(assets.status, 'failed');
  assert.equal(assets.attempts[0].attempt, 1);
  assert.equal(assets.attempts[0].error.code, 'ASSET_TIMEOUT');
});

test('GET /api/workflows/:workflowId recovers persisted state and returns typed 404 errors', async () => {
  const { service } = createHarness();
  const workflow = await service.createWorkflow({ projectId: 'project_1', tasks: TASKS });
  await service.transitionWorkflow(workflow.id, 'PROCESSING');
  const handler = createGetWorkflowHandler(service);
  const response = {
    body: undefined,
    json(body) {
      this.body = body;
    },
  };
  let forwardedError;

  await handler({ params: { workflowId: workflow.id } }, response, (error) => {
    forwardedError = error;
  });
  assert.equal(forwardedError, undefined);
  assert.equal(response.body.status, 'PROCESSING');
  assert.equal(response.body.stateHistory.length, 2);

  await handler({ params: { workflowId: 'missing' } }, response, (error) => {
    forwardedError = error;
  });
  assert.equal(forwardedError.statusCode, 404);
  assert.equal(forwardedError.errorCode, 'WORKFLOW_NOT_FOUND');
  assert.equal(forwardedError.message, 'Workflow missing was not found.');
});
