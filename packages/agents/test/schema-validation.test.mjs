import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAssetChunkResponse } from '../dist/asset/asset-result.js';
import { parseComplianceResponse } from '../dist/compliance/compliance-result.js';
import { parseWorkflowPlanResponse } from '../dist/director/workflow-plan.js';
import { parsePublisherResponse } from '../dist/publisher/publisher-result.js';
import { parseTranscriptChunkResponse } from '../dist/transcript/transcript-result.js';

test('workflow plan schema rejects unsupported specialist agents', () => {
  assert.throws(
    () =>
      parseWorkflowPlanResponse(
        JSON.stringify({
          summary: 'Invalid plan',
          tasks: [
            {
              id: 'unknown-task',
              agent: 'unknown',
              action: 'run',
              description: 'Run an unknown agent.',
              dependsOn: [],
              expectedOutput: 'UnknownResult',
            },
          ],
        })
      ),
    /tasks\[0\]\.agent is not a supported specialist/
  );
});

test('transcript schema reports the exact malformed field', () => {
  assert.throws(
    () =>
      parseTranscriptChunkResponse(
        JSON.stringify({
          language: 'en',
          summary: 'Summary',
          transcript: [
            {
              startSeconds: 0,
              endSeconds: 1,
              speaker: 'Host',
              text: 'Hello',
              confidence: 'high',
            },
          ],
          chapters: [{ startSeconds: 0, title: 'Intro', summary: 'Introduction' }],
          speakers: [{ label: 'Host', description: 'Presenter' }],
        })
      ),
    /transcript\[0\]\.confidence must be a finite number/
  );
});

test('asset schema rejects unsupported scene tones', () => {
  assert.throws(
    () =>
      parseAssetChunkResponse(
        JSON.stringify({
          summary: 'Scene summary',
          mediaProperties: {
            aspectRatio: '16:9',
            resolution: '1920x1080',
            visualStyle: 'Studio',
            dominantColors: ['blue'],
          },
          scenes: [
            {
              startSeconds: 0,
              endSeconds: 10,
              title: 'Intro',
              description: 'Presenter enters.',
              environment: 'Studio',
              shotType: 'Wide',
              lighting: 'Bright',
              motion: 'Static',
              tone: 'green',
              objects: [],
              branding: [],
              recommendedUse: 'Opening',
            },
          ],
          objectTags: [],
        })
      ),
    /scenes\[0\]\.tone is not supported/
  );
});

test('compliance schema rejects unknown check categories', () => {
  assert.throws(
    () =>
      parseComplianceResponse(
        JSON.stringify({
          overallStatus: 'warning',
          summary: 'Review required.',
          checks: [
            {
              category: 'legal',
              title: 'Rights',
              description: 'Review rights.',
              status: 'warning',
              resolution: 'Manual review.',
              resolved: false,
            },
          ],
        })
      ),
    /checks\[0\]\.category must be one of/
  );
});

test('publisher schema requires at least one platform', () => {
  assert.throws(
    () => parsePublisherResponse(JSON.stringify({ summary: 'Empty package', platforms: [] })),
    /platforms must be a non-empty array/
  );
});
