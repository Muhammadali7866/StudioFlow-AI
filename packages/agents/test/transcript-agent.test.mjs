import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';
import { FileState } from '@google/genai';
import { TranscriptAgent, toTranscriptPanelData } from '../dist/index.js';

const videoMedia = {
  id: 'media-1',
  fileName: 'launch-video.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 1024,
  durationSeconds: 120,
};

function transcriptResponse(overrides = {}) {
  return JSON.stringify({
    language: 'en',
    summary: 'A concise media summary.',
    transcript: [
      {
        startSeconds: 0,
        endSeconds: 5,
        speaker: 'Host',
        text: 'Welcome to StudioFlow.',
        confidence: 98,
      },
    ],
    chapters: [
      {
        startSeconds: 0,
        title: 'Introduction',
        summary: 'The host introduces the topic.',
      },
    ],
    speakers: [{ label: 'Host', description: 'Primary presenter.' }],
    ...overrides,
  });
}

test('returns a TranscriptPanel-compatible structured result', async () => {
  const agent = new TranscriptAgent({
    aiClient: {
      models: { generateContent: async () => ({ text: transcriptResponse() }) },
    },
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: videoMedia,
    source: { kind: 'uri', uri: 'https://example.com/files/video' },
  });
  const panelData = toTranscriptPanelData(result);

  assert.equal(result.source, 'gemini');
  assert.equal(result.summary, 'A concise media summary.');
  assert.deepEqual(panelData.segments[0], {
    id: 'segment-1',
    timestamp: '00:00',
    speaker: 'Host',
    text: 'Welcome to StudioFlow.',
    confidence: 98,
  });
  assert.equal(panelData.chapters[0].timestamp, '00:00');
});

test('processes long video in bounded ranges and preserves absolute timestamps', async () => {
  const requestedRanges = [];
  const agent = new TranscriptAgent({
    aiClient: {
      models: {
        generateContent: async ({ contents }) => {
          const range = contents.parts.find((part) => part.videoMetadata)?.videoMetadata;
          requestedRanges.push(range);
          return { text: transcriptResponse() };
        },
      },
    },
    maxVideoChunkSeconds: 1800,
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: { ...videoMedia, durationSeconds: 3900 },
    source: { kind: 'uri', uri: 'https://example.com/files/long-video' },
  });

  assert.equal(requestedRanges.length, 3);
  assert.deepEqual(requestedRanges[0], { startOffset: '0s', endOffset: '1800s' });
  assert.deepEqual(
    result.transcript.map((segment) => segment.timestamp),
    ['00:00', '30:00', '60:00']
  );
});

test('supports audio-only media without video range metadata', async () => {
  let parts;
  const agent = new TranscriptAgent({
    aiClient: {
      models: {
        generateContent: async ({ contents }) => {
          parts = contents.parts;
          return { text: transcriptResponse() };
        },
      },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: {
      ...videoMedia,
      fileName: 'interview.mp3',
      mimeType: 'audio/mpeg',
      durationSeconds: 3900,
    },
    source: { kind: 'uri', uri: 'https://example.com/files/audio' },
  });

  assert.equal(result.source, 'gemini');
  assert.equal(
    parts.some((part) => part.videoMetadata),
    false
  );
});

test('spools a readable stream for upload and removes the temporary file', async () => {
  let uploadedPath;
  let uploadedContent;
  const agent = new TranscriptAgent({
    aiClient: {
      files: {
        upload: async (filePath) => {
          uploadedPath = filePath;
          uploadedContent = await readFile(filePath, 'utf8');
          return {
            name: 'files/uploaded-video',
            uri: 'https://example.com/files/uploaded-video',
            mimeType: 'video/mp4',
            state: FileState.ACTIVE,
          };
        },
      },
      models: { generateContent: async () => ({ text: transcriptResponse() }) },
    },
  });

  const result = await agent.analyze({
    projectId: 'project-1',
    media: videoMedia,
    source: { kind: 'stream', stream: Readable.from(['video-bytes']) },
  });

  assert.equal(result.source, 'gemini');
  assert.equal(uploadedContent, 'video-bytes');
  await assert.rejects(access(uploadedPath), { code: 'ENOENT' });
});

test('returns an explicit flagged fallback when Gemini is unavailable', async () => {
  const agent = new TranscriptAgent({ aiClient: null });
  const result = await agent.analyze({ projectId: 'project-1', media: videoMedia });

  assert.equal(result.source, 'fallback');
  assert.equal(result.transcript[0].flagged, true);
  assert.equal(result.transcript[0].confidence, 0);
});
