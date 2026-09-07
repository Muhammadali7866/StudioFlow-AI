/* global Blob, FormData, fetch */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import express from 'express';
import { errorHandler } from '../dist/middleware/error.middleware.js';
import { createProjectRoutes } from '../dist/routes/projects.js';

const project = {
  id: 'project_1',
  name: 'Launch',
  status: 'draft',
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  mediaAssets: [],
};

function createRepository() {
  const savedAssets = [];
  return {
    savedAssets,
    async saveProject(value) {
      return value;
    },
    async listProjects() {
      return [project];
    },
    async getProjectById(id) {
      return id === project.id ? project : null;
    },
    async saveMediaAsset(asset) {
      savedAssets.push(asset);
      return asset;
    },
  };
}

async function startServer(repository, storage) {
  const app = express();
  app.use('/api', createProjectRoutes(repository, storage));
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

function mediaForm(bytes) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'video/mp4' }), 'launch.mp4');
  return form;
}

test('media upload persists metadata after successful storage', async () => {
  const repository = createRepository();
  const storage = {
    async uploadFile(_buffer, destinationPath) {
      return {
        storagePath: `gs://test-bucket/${destinationPath}`,
        publicUrl: `https://storage.test/${destinationPath}`,
      };
    },
  };
  const server = await startServer(repository, storage);
  const mp4Header = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom')]);

  try {
    const response = await fetch(`${server.baseUrl}/api/projects/${project.id}/media`, {
      method: 'POST',
      body: mediaForm(mp4Header),
    });
    const uploaded = await response.json();

    assert.equal(response.status, 201);
    assert.equal(uploaded.projectId, project.id);
    assert.equal(uploaded.fileName, 'launch.mp4');
    assert.match(uploaded.storagePath, /^gs:\/\/test-bucket\/projects\/project_1\//);
    assert.equal(repository.savedAssets.length, 1);
  } finally {
    await server.close();
  }
});

test('media upload rejects corrupt content before calling storage', async () => {
  const repository = createRepository();
  let storageCalls = 0;
  const storage = {
    async uploadFile() {
      storageCalls += 1;
      return { storagePath: 'unused' };
    },
  };
  const server = await startServer(repository, storage);

  try {
    const response = await fetch(`${server.baseUrl}/api/projects/${project.id}/media`, {
      method: 'POST',
      body: mediaForm(Buffer.from('not-an-mp4')),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'CORRUPT_MEDIA_FILE',
        message: 'Uploaded media content is corrupt or does not match its declared file type.',
      },
    });
    assert.equal(storageCalls, 0);
    assert.equal(repository.savedAssets.length, 0);
  } finally {
    await server.close();
  }
});

test('media upload exposes a retryable typed error during storage outages', async () => {
  const repository = createRepository();
  const storage = {
    async uploadFile() {
      throw new Error('simulated bucket outage');
    },
  };
  const server = await startServer(repository, storage);
  const mp4Header = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom')]);

  try {
    const response = await fetch(`${server.baseUrl}/api/projects/${project.id}/media`, {
      method: 'POST',
      body: mediaForm(mp4Header),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Media storage is temporarily unavailable. Please try the upload again.',
      },
    });
    assert.equal(repository.savedAssets.length, 0);
  } finally {
    await server.close();
  }
});
