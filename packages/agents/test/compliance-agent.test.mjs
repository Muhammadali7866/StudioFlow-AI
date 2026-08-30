import assert from 'node:assert/strict';
import test from 'node:test';
import { ComplianceAgent, toCompliancePanelData } from '../dist/index.js';

const mediaMetadata = {
  id: 'media-1',
  fileName: 'podcast-episode.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 4096,
  durationSeconds: 300,
};

const sampleTranscriptResult = {
  projectId: 'project-1',
  mediaId: 'media-1',
  language: 'en',
  summary: 'A developer introduces StudioFlow features and mentions sponsorship.',
  transcript: [
    {
      id: 'seg-1',
      startSeconds: 0,
      endSeconds: 10,
      timestamp: '00:00',
      speaker: 'Speaker 1',
      text: 'Welcome back! Today we are sponsored by Acme Cloud services.',
      confidence: 95,
    },
    {
      id: 'seg-2',
      startSeconds: 10,
      endSeconds: 30,
      timestamp: '00:10',
      speaker: 'Speaker 1',
      text: 'Let us build a full stack multi-agent AI system together.',
      confidence: 98,
    },
  ],
  chapters: [],
  speakers: [],
  source: 'gemini',
  generatedAt: '2026-08-29T00:00:00.000Z',
};

const sampleAssetResult = {
  projectId: 'project-1',
  mediaId: 'media-1',
  summary: 'Developer at desk with IDE open.',
  mediaProperties: {
    aspectRatio: '16:9',
    resolution: '1920x1080',
    visualStyle: 'Screencast',
    dominantColors: ['violet', 'cyan'],
  },
  scenes: [
    {
      id: 'scene-1',
      startSeconds: 0,
      endSeconds: 30,
      timestamp: '00:00',
      title: 'Intro & IDE reveal',
      description: 'Screencast of code editor and presenter overlay.',
      environment: 'Studio',
      shotType: 'Screen recording',
      lighting: 'Bright',
      motion: 'Static screen',
      tone: 'violet',
      objects: [{ label: 'code editor', category: 'software', confidence: 99 }],
      branding: ['Acme logo'],
      recommendedUse: 'Full video',
    },
  ],
  objectTags: ['code editor'],
  branding: ['Acme logo'],
  source: 'gemini',
  generatedAt: '2026-08-29T00:00:00.000Z',
};

function complianceResponse(overrides = {}) {
  return JSON.stringify({
    overallStatus: 'warning',
    summary: 'Compliance audit complete. Paid sponsorship disclosure requires overlay placement.',
    checks: [
      {
        category: 'safety',
        title: 'Safety & Content Guidelines',
        description: 'No offensive language, dangerous activities, or harmful content detected.',
        status: 'passed',
        resolution: 'No action required.',
        resolved: true,
      },
      {
        category: 'disclosure',
        title: 'Sponsorship & Paid Promotion Disclosure',
        description: 'Audio sponsor mention detected ("Acme Cloud") at 00:00.',
        status: 'warning',
        resolution: 'Ensure platform paid sponsorship toggle is enabled and visual disclosure is displayed.',
        resolved: false,
      },
      {
        category: 'accessibility',
        title: 'Captions & Speech Transcript',
        description: 'High confidence transcript available for caption generation.',
        status: 'passed',
        resolution: 'Full captions ready for export.',
        resolved: true,
      },
      {
        category: 'metadata',
        title: 'Video Title & Description Readiness',
        description: 'Valid filename and video properties available.',
        status: 'passed',
        resolution: 'Populate platform description prior to publishing.',
        resolved: true,
      },
    ],
    ...overrides,
  });
}

test('returns ComplianceAnalysisResult for valid transcript and visual input', async () => {
  const agent = new ComplianceAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: complianceResponse() }) },
    },
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
    transcriptResult: sampleTranscriptResult,
    assetResult: sampleAssetResult,
  });

  assert.equal(result.source, 'gemini');
  assert.equal(result.overallStatus, 'warning');
  assert.equal(result.checks.length, 4);
  assert.equal(result.checks[1].category, 'disclosure');
  assert.equal(result.checks[1].status, 'warning');
});

test('flags disclosure warning when sponsorship text is present in transcript', async () => {
  const agent = new ComplianceAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: complianceResponse() }) },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
    transcriptResult: sampleTranscriptResult,
  });

  const disclosureCheck = result.checks.find((c) => c.category === 'disclosure');
  assert.ok(disclosureCheck);
  assert.equal(disclosureCheck.status, 'warning');
  assert.equal(disclosureCheck.resolved, false);
});

test('returns fallback result when aiClient is null', async () => {
  const agent = new ComplianceAgent({ aiClient: null });
  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
  });

  assert.equal(result.source, 'fallback');
  assert.equal(result.overallStatus, 'warning');
  assert.equal(result.checks.length, 4);
  assert.equal(result.checks[0].resolution, 'Manual review required prior to publication.');
});

test('toCompliancePanelData maps result to frontend panel shape', async () => {
  const agent = new ComplianceAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: complianceResponse() }) },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
    transcriptResult: sampleTranscriptResult,
    assetResult: sampleAssetResult,
  });

  const panelData = toCompliancePanelData(result);

  assert.equal(panelData.overallStatus, 'warning');
  assert.equal(panelData.checks.length, 4);
  assert.deepEqual(panelData.checks[0], {
    category: 'safety',
    title: 'Safety & Content Guidelines',
    description: 'No offensive language, dangerous activities, or harmful content detected.',
    status: 'passed',
    resolution: 'No action required.',
    resolved: true,
  });
});

test('falls back gracefully when Gemini returns invalid JSON', async () => {
  const agent = new ComplianceAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: 'NOT_VALID_JSON' }) },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: mediaMetadata,
  });

  assert.equal(result.source, 'fallback');
  assert.equal(result.overallStatus, 'warning');
});
