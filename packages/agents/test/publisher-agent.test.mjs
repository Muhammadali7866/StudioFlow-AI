import assert from 'node:assert/strict';
import test from 'node:test';
import { PublisherAgent, toPublisherPanelData } from '../dist/index.js';

const mediaMetadata = {
  id: 'media-1',
  fileName: 'ai-tutorial.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 8192,
  durationSeconds: 180,
};

const sampleTranscriptResult = {
  projectId: 'project-1',
  mediaId: 'media-1',
  language: 'en',
  summary: 'A step-by-step tutorial demonstrating multi-agent AI architecture in StudioFlow.',
  transcript: [
    {
      id: 'seg-1',
      startSeconds: 0,
      endSeconds: 15,
      timestamp: '00:00',
      speaker: 'Host',
      text: 'Welcome! Today we are building a multi-agent system.',
      confidence: 98,
    },
  ],
  chapters: [
    { id: 'ch-1', startSeconds: 0, timestamp: '00:00', title: 'Introduction', summary: 'Welcome overview.' },
    { id: 'ch-2', startSeconds: 60, timestamp: '01:00', title: 'Architecture Overview', summary: 'Multi-agent diagram.' },
  ],
  speakers: [],
  source: 'gemini',
  generatedAt: '2026-08-29T00:00:00.000Z',
};

function publisherResponse(overrides = {}) {
  return JSON.stringify({
    summary: 'Optimized multi-platform publishing package for StudioFlow video release.',
    platforms: [
      {
        platform: 'youtube',
        title: 'Building a Multi-Agent AI System | StudioFlow Tutorial',
        description: 'Learn how to architect and deploy multi-agent AI systems with Google ADK and Gemini 2.5 Flash.\n\nChapters:\n00:00 Introduction\n01:00 Architecture Overview',
        hashtags: ['#AI', '#MultiAgent', '#TypeScript', '#GeminiAI'],
        callToAction: 'Subscribe to StudioFlow for more tutorials!',
        chapterMarkers: ['00:00 Introduction', '01:00 Architecture Overview'],
      },
      {
        platform: 'tiktok',
        title: 'Build Multi-Agent AI in 3 Minutes! 🚀',
        description: 'How to build multi-agent AI systems step by step! #fyp #ai #coding',
        hashtags: ['#fyp', '#ai', '#coding', '#tech'],
        callToAction: 'Follow for more dev tips!',
      },
      {
        platform: 'instagram',
        title: 'Multi-Agent AI Engine Revealed',
        description: 'Inside the architecture of modern AI systems. Swipe to see the workflow diagram.',
        hashtags: ['#reels', '#ai', '#developer', '#tech'],
        callToAction: 'Link in bio.',
      },
      {
        platform: 'twitter',
        title: 'Multi-Agent AI Architecture 🧵',
        description: 'Architecting multi-agent systems with Gemini 2.5 Flash and Node.js. Key insights inside.',
        hashtags: ['#AI', '#TypeScript'],
      },
      {
        platform: 'linkedin',
        title: 'Architecting Enterprise Multi-Agent AI Workflows',
        description: 'Detailed technical overview of multi-agent engine design principles using Google ADK.',
        hashtags: ['#AIEngineering', '#SoftwareArchitecture', '#StudioFlow'],
        callToAction: 'Read the full guide and join the discussion below.',
      },
    ],
    ...overrides,
  });
}

test('returns PublisherAnalysisResult for all 5 platforms', async () => {
  const agent = new PublisherAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: publisherResponse() }) },
    },
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
    transcriptResult: sampleTranscriptResult,
  });

  assert.equal(result.source, 'gemini');
  assert.equal(result.platforms.length, 5);
  assert.equal(result.platforms[0].platform, 'youtube');
  assert.equal(result.platforms[1].platform, 'tiktok');
  assert.ok(result.platforms[0].hashtags.includes('#AI'));
});

test('generates YouTube chapter markers from transcript chapters', async () => {
  const agent = new PublisherAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: publisherResponse() }) },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
    transcriptResult: sampleTranscriptResult,
  });

  const youtubePlatform = result.platforms.find((p) => p.platform === 'youtube');
  assert.ok(youtubePlatform);
  assert.deepEqual(youtubePlatform.chapterMarkers, ['00:00 Introduction', '01:00 Architecture Overview']);
});

test('returns fallback result when aiClient is null', async () => {
  const agent = new PublisherAgent({ aiClient: null });
  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
    transcriptResult: sampleTranscriptResult,
  });

  assert.equal(result.source, 'fallback');
  assert.equal(result.platforms.length, 5);
  assert.equal(result.platforms[0].platform, 'youtube');
  assert.ok(result.platforms[0].title.includes('[Review Required]'));
  assert.deepEqual(result.platforms[0].chapterMarkers, ['00:00 Introduction', '01:00 Architecture Overview']);
});

test('toPublisherPanelData maps result to frontend panel shape', async () => {
  const agent = new PublisherAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: publisherResponse() }) },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
  });

  const panelData = toPublisherPanelData(result);

  assert.equal(panelData.platforms.length, 5);
  assert.equal(panelData.platforms[0].platform, 'youtube');
  assert.equal(panelData.platforms[0].title, 'Building a Multi-Agent AI System | StudioFlow Tutorial');
});

test('falls back gracefully when Gemini returns invalid JSON', async () => {
  const agent = new PublisherAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: 'INVALID_JSON' }) },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
  });

  assert.equal(result.source, 'fallback');
  assert.equal(result.platforms.length, 5);
});
