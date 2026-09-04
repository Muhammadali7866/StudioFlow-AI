import assert from 'node:assert/strict';
import test from 'node:test';
import { createGetWorkflowInvestigationHandler } from '../dist/routes/workflows.js';
import { WorkflowInvestigationService } from '../dist/services/workflow-investigation.service.js';
import { WorkflowService } from '../dist/services/workflow.service.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarness() {
  const records = new Map();
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
    idFactory: (prefix) => `${prefix}_1`,
    now: () => new Date(Date.UTC(2026, 8, 4, 10, 0, tick++)),
  });
  const investigationService = new WorkflowInvestigationService(workflowService);
  return { workflowService, investigationService };
}

async function createRecoveredWorkflow(workflowService) {
  const workflow = await workflowService.createWorkflow({
    projectId: 'project_1',
    tasks: [{ id: 'transcript', agentName: 'transcript', action: 'Transcribe media' }],
  });
  await workflowService.transitionWorkflow(workflow.id, 'PROCESSING');
  await workflowService.startTask(workflow.id, 'transcript');
  await workflowService.failTask(workflow.id, 'transcript', {
    code: 'AGENT_TIMEOUT',
    message: 'Gemini timed out.',
    retryable: true,
    statusCode: 408,
  });
  await workflowService.startTask(workflow.id, 'transcript');
  await workflowService.completeTask(workflow.id, 'transcript', { segments: 12 });
  return workflow;
}

test('builds correlated investigation evidence from persisted task attempts', async () => {
  const { workflowService, investigationService } = createHarness();
  const workflow = await createRecoveredWorkflow(workflowService);

  const investigation = await investigationService.getInvestigation(workflow.id);

  assert.equal(investigation.source, 'backend');
  assert.equal(investigation.workflowId, workflow.id);
  assert.equal(investigation.failedAgent, 'transcript');
  assert.equal(investigation.errorCode, 'AGENT_TIMEOUT');
  assert.equal(investigation.recoveredIn, '3.0s');
  assert.equal(investigation.totalDurationMs, 3_000);
  assert.match(investigation.diagnosis, /transient provider/);
  assert.match(investigation.decision, /bounded retry policy recovered/);
  assert.equal(investigation.trace.length, 2);
  assert.deepEqual(
    investigation.trace.map(({ name, durationMs, tone }) => ({ name, durationMs, tone })),
    [
      { name: 'transcript.attempt.1', durationMs: 1_000, tone: 'danger' },
      { name: 'transcript.attempt.2', durationMs: 1_000, tone: 'success' },
    ]
  );
  assert.equal(investigation.logEvidence[0].message, 'AGENT_TIMEOUT: Gemini timed out.');
  assert.deepEqual(investigation.metricEvidence, [
    { label: 'Failed attempts', value: '1' },
    { label: 'Total attempts', value: '2' },
    { label: 'Latest attempt duration', value: '1000ms' },
    { label: 'Recovery status', value: 'Recovered' },
  ]);
});

test('serves investigation evidence and returns a typed error when none exists', async () => {
  const { workflowService, investigationService } = createHarness();
  const workflow = await createRecoveredWorkflow(workflowService);
  const handler = createGetWorkflowInvestigationHandler(workflowService, investigationService);
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
  assert.equal(response.body.source, 'backend');

  const cleanWorkflow = await workflowService.createWorkflow({
    id: 'workflow_clean',
    projectId: 'project_2',
    tasks: [{ id: 'clean_task', agentName: 'asset', action: 'Analyze assets' }],
  });
  await handler({ params: { workflowId: cleanWorkflow.id } }, response, (error) => {
    forwardedError = error;
  });
  assert.equal(forwardedError.statusCode, 404);
  assert.equal(forwardedError.errorCode, 'WORKFLOW_INVESTIGATION_NOT_FOUND');
});
