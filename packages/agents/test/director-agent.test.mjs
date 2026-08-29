import assert from 'node:assert/strict';
import test from 'node:test';
import { DirectorAgent, buildExecutionOrder } from '../dist/index.js';

const videoJob = {
  projectId: 'project-1',
  objective: 'Prepare a YouTube publishing package.',
  targetPlatform: 'YouTube',
  media: {
    id: 'media-1',
    fileName: 'launch-video.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 1024,
    durationSeconds: 120,
  },
};

test('generates an ordered fallback plan for standard video input', async () => {
  const agent = new DirectorAgent({
    aiClient: null,
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  });

  const plan = await agent.generatePlan(videoJob);

  assert.equal(plan.source, 'fallback');
  assert.deepEqual(
    plan.tasks.map((task) => task.agent),
    ['transcript', 'asset', 'compliance', 'publisher']
  );
  assert.deepEqual(plan.executionOrder, [
    ['transcript-analysis', 'asset-analysis'],
    ['compliance-review'],
    ['publishing-package'],
  ]);
  assert.equal(plan.createdAt, '2026-08-29T00:00:00.000Z');
});

test('accepts a valid structured Gemini workflow plan', async () => {
  const agent = new DirectorAgent({
    aiClient: {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            summary: 'Analyze in parallel, then review and package.',
            tasks: [
              {
                id: 'transcript',
                agent: 'transcript',
                action: 'transcribe',
                description: 'Transcribe the media.',
                dependsOn: [],
                expectedOutput: 'TranscriptAnalysisResult',
              },
              {
                id: 'assets',
                agent: 'asset',
                action: 'inspect-scenes',
                description: 'Inspect visual scenes.',
                dependsOn: [],
                expectedOutput: 'AssetAnalysisResult',
              },
              {
                id: 'compliance',
                agent: 'compliance',
                action: 'review',
                description: 'Review specialist results.',
                dependsOn: ['transcript', 'assets'],
                expectedOutput: 'ComplianceAnalysisResult',
              },
              {
                id: 'publisher',
                agent: 'publisher',
                action: 'package',
                description: 'Create publishing metadata.',
                dependsOn: ['compliance'],
                expectedOutput: 'PublishingPackageResult',
              },
            ],
          }),
        }),
      },
    },
  });

  const plan = await agent.generatePlan(videoJob);

  assert.equal(plan.source, 'gemini');
  assert.deepEqual(plan.executionOrder, [['transcript', 'assets'], ['compliance'], ['publisher']]);
});

test('omits visual analysis for audio-only media', async () => {
  const agent = new DirectorAgent({ aiClient: null });
  const plan = await agent.generatePlan({
    ...videoJob,
    media: {
      ...videoJob.media,
      fileName: 'podcast.mp3',
      mimeType: 'audio/mpeg',
    },
  });

  assert.deepEqual(
    plan.tasks.map((task) => task.agent),
    ['transcript', 'compliance', 'publisher']
  );
});

test('rejects cyclic task dependencies', () => {
  assert.throws(
    () =>
      buildExecutionOrder([
        {
          id: 'first',
          agent: 'transcript',
          action: 'first',
          description: 'First task',
          dependsOn: ['second'],
          expectedOutput: 'FirstResult',
        },
        {
          id: 'second',
          agent: 'asset',
          action: 'second',
          description: 'Second task',
          dependsOn: ['first'],
          expectedOutput: 'SecondResult',
        },
      ]),
    /contain a cycle/
  );
});

test('delegates a ready task through its registered specialist handler', async () => {
  const agent = new DirectorAgent({
    aiClient: null,
    handlers: {
      transcript: async ({ task }) => ({ handled: task.id }),
    },
  });
  const plan = await agent.generatePlan(videoJob);

  assert.deepEqual(
    agent.getReadyTasks(plan, []).map((task) => task.id),
    ['transcript-analysis', 'asset-analysis']
  );

  const result = await agent.delegateTask(plan, 'transcript-analysis');
  assert.deepEqual(result, {
    taskId: 'transcript-analysis',
    agent: 'transcript',
    status: 'completed',
    output: { handled: 'transcript-analysis' },
  });
});
