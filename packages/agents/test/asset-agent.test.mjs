import assert from 'node:assert/strict';
import test from 'node:test';
import { AssetAgent, toScenePanelData } from '../dist/index.js';

const videoMedia = {
  id: 'media-1',
  fileName: 'launch-video.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 2048,
  durationSeconds: 120,
};

function assetResponse(overrides = {}) {
  return JSON.stringify({
    summary: 'A presenter demonstrates a neon environment.',
    mediaProperties: {
      aspectRatio: '16:9',
      resolution: '1920x1080',
      visualStyle: 'Cinematic tutorial',
      dominantColors: ['violet', 'cyan'],
    },
    scenes: [
      {
        startSeconds: 5,
        endSeconds: 20,
        title: 'Environment reveal',
        description: 'A wide view reveals a neon city environment.',
        environment: 'Virtual city at night',
        shotType: 'Wide shot',
        lighting: 'Neon lighting',
        motion: 'Slow camera pan',
        tone: 'violet',
        objects: [
          { label: 'city skyline', category: 'environment', confidence: 98 },
          { label: 'presenter', category: 'person', confidence: 95 },
        ],
        branding: ['StudioFlow logo'],
        recommendedUse: 'Chapter card',
      },
    ],
    objectTags: ['city', 'tutorial'],
    ...overrides,
  });
}

test('returns AssetAnalysisResult and ScenePanel-compatible scene metadata', async () => {
  const agent = new AssetAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: assetResponse() }) },
    },
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: videoMedia,
    source: { kind: 'uri', uri: 'https://example.com/files/video' },
  });
  const panelData = toScenePanelData(result);

  assert.equal(result.source, 'gemini');
  assert.deepEqual(result.branding, ['StudioFlow logo']);
  assert.deepEqual(result.objectTags, ['city', 'tutorial', 'city skyline', 'presenter']);
  assert.deepEqual(panelData.scenes[0], {
    id: 'scene-1',
    timestamp: '00:05',
    title: 'Environment reveal',
    summary: 'A wide view reveals a neon city environment.',
    signals: [
      'Wide shot',
      'Neon lighting',
      'Slow camera pan',
      'city skyline',
      'presenter',
      'StudioFlow logo',
    ],
    artworkTone: 'violet',
    recommendedUse: 'Chapter card',
  });
});

test('processes long video in bounded ranges with absolute scene timestamps', async () => {
  const requestedRanges = [];
  const agent = new AssetAgent({
    aiClient: {
      models: {
        generateContent: async ({ contents }) => {
          const range = contents.parts.find((part) => part.videoMetadata)?.videoMetadata;
          requestedRanges.push(range);
          return { text: assetResponse() };
        },
      },
    },
    maxVideoChunkSeconds: 900,
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: { ...videoMedia, durationSeconds: 1900 },
    source: { kind: 'uri', uri: 'https://example.com/files/long-video' },
  });

  assert.equal(requestedRanges.length, 3);
  assert.deepEqual(requestedRanges[2], { startOffset: '1800s', endOffset: '1900s' });
  assert.deepEqual(
    result.scenes.map((scene) => scene.timestamp),
    ['00:05', '15:05', '30:05']
  );
});

test('rejects audio because asset analysis requires visual media', async () => {
  const agent = new AssetAgent({ aiClient: null });

  await assert.rejects(
    agent.analyze({
      projectId: 'project-1',
      media: { ...videoMedia, fileName: 'audio.mp3', mimeType: 'audio/mpeg' },
    }),
    /requires video media/
  );
});

test('returns an explicit fallback when Gemini is unavailable', async () => {
  const agent = new AssetAgent({ aiClient: null });
  const result = await agent.analyze({ projectId: 'project-1', media: videoMedia });

  assert.equal(result.source, 'fallback');
  assert.equal(result.scenes[0].recommendedUse, 'Review required');
  assert.deepEqual(toScenePanelData(result).scenes[0].signals, ['Undetermined']);
});
