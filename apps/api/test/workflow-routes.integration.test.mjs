/* global fetch */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { errorHandler, notFoundHandler } from '../dist/middleware/error.middleware.js';
import { createWorkflowRoutes } from '../dist/routes/workflows.js';
import { WorkflowService } from '../dist/services/workflow.service.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarness() {
  const records = new Map();
  let id = 0;
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
    now: () => new Date('2026-09-08T00:00:00.000Z'),
  });
  const pubSub = {
    async publishWorkflowStarted(workflowId) {
      return `message_${workflowId}`;
    },
  };
  const investigations = {
    async getInvestigation() {
      return null;
    },
  };

  return { service, pubSub, investigations };
}

async function startServer(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
}

test('Express workflow routes create and retrieve persisted workflows over HTTP', async () => {
  const harness = createHarness();
  const server = await startServer(
    createWorkflowRoutes(harness.service, harness.pubSub, harness.investigations)
  );

  try {
    const createResponse = await fetch(`${server.baseUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project_1',
        tasks: [{ agentName: 'transcript', action: 'Transcribe media' }],
      }),
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 202);
    assert.equal(created.status, 'CREATED');
    assert.equal(created.messageId, `message_${created.workflowId}`);

    const getResponse = await fetch(`${server.baseUrl}/api/workflows/${created.workflowId}`);
    const recovered = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(recovered.id, created.workflowId);
    assert.equal(recovered.tasks[0].agentName, 'transcript');
  } finally {
    await server.close();
  }
});

test('Express workflow routes return typed validation and not-found errors', async () => {
  const harness = createHarness();
  const server = await startServer(
    createWorkflowRoutes(harness.service, harness.pubSub, harness.investigations)
  );

  try {
    const invalidResponse = await fetch(`${server.baseUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: '', tasks: [] }),
    });
    assert.equal(invalidResponse.status, 400);
    assert.deepEqual(await invalidResponse.json(), {
      error: {
        code: 'WORKFLOW_VALIDATION_ERROR',
        message: 'projectId is required and must be a non-empty string.',
      },
    });

    const missingResponse = await fetch(`${server.baseUrl}/api/workflows/missing`);
    assert.equal(missingResponse.status, 404);
    assert.equal((await missingResponse.json()).error.code, 'WORKFLOW_NOT_FOUND');
  } finally {
    await server.close();
  }
});
