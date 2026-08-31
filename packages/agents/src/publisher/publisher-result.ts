import { DEFAULT_PLATFORMS } from './prompt';
import type {
  PlatformMetadata,
  PublisherAnalysisResult,
  PublisherPanelData,
  PublisherRequest,
  TargetPlatform,
} from './types';

export interface PublisherChunkResult {
  summary: string;
  platforms: PlatformMetadata[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapJson(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1] : trimmed;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function isTargetPlatform(value: unknown): value is TargetPlatform {
  return (
    value === 'youtube' ||
    value === 'tiktok' ||
    value === 'instagram' ||
    value === 'twitter' ||
    value === 'linkedin'
  );
}

function parsePlatformMetadata(rawItem: unknown, index: number): PlatformMetadata {
  if (!isRecord(rawItem)) {
    throw new Error(`platforms[${index}] must be an object.`);
  }

  const platformRaw = requireString(rawItem.platform, `platforms[${index}].platform`).toLowerCase();
  if (!isTargetPlatform(platformRaw)) {
    throw new Error(
      `platforms[${index}].platform must be one of youtube|tiktok|instagram|twitter|linkedin.`
    );
  }

  const title = requireString(rawItem.title, `platforms[${index}].title`);
  const description = requireString(rawItem.description, `platforms[${index}].description`);

  let hashtags: string[] = [];
  if (Array.isArray(rawItem.hashtags)) {
    hashtags = rawItem.hashtags
      .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
      .map((h) => (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`));
  }

  const callToAction =
    typeof rawItem.callToAction === 'string' && rawItem.callToAction.trim().length > 0
      ? rawItem.callToAction.trim()
      : undefined;

  let chapterMarkers: string[] | undefined;
  if (Array.isArray(rawItem.chapterMarkers)) {
    const validMarkers = rawItem.chapterMarkers
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim());

    if (validMarkers.length > 0) {
      chapterMarkers = validMarkers;
    }
  }

  return {
    platform: platformRaw,
    title,
    description,
    hashtags,
    ...(callToAction ? { callToAction } : {}),
    ...(chapterMarkers ? { chapterMarkers } : {}),
  };
}

export function parsePublisherResponse(rawText: string): PublisherChunkResult {
  const cleaned = unwrapJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Invalid JSON response from Gemini for publisher analysis.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Publisher response must be a JSON object.');
  }

  const summary = requireString(parsed.summary, 'summary');

  if (!Array.isArray(parsed.platforms) || parsed.platforms.length === 0) {
    throw new Error('platforms must be a non-empty array.');
  }

  const platforms = parsed.platforms.map((item, index) => parsePlatformMetadata(item, index));

  return {
    summary,
    platforms,
  };
}

export function createFallbackPublisherResult(
  request: PublisherRequest,
  generatedAt: string
): PublisherAnalysisResult {
  const targetPlatforms =
    request.targetPlatforms && request.targetPlatforms.length > 0
      ? request.targetPlatforms
      : DEFAULT_PLATFORMS;

  const baseTitle = request.media.fileName.replace(/\.[^/.]+$/, '');
  const hasTranscript = Boolean(request.transcriptResult);

  const chapters =
    request.transcriptResult?.chapters && request.transcriptResult.chapters.length > 0
      ? request.transcriptResult.chapters.map((ch) => `${ch.timestamp} ${ch.title}`)
      : undefined;

  const platforms: PlatformMetadata[] = targetPlatforms.map((platform) => {
    switch (platform) {
      case 'youtube':
        return {
          platform: 'youtube',
          title: `[Review Required] ${baseTitle}`,
          description: hasTranscript
            ? `${request.transcriptResult?.summary}\n\nAutomated publishing copy generation unavailable. Manual review required.`
            : `Publishing metadata for '${request.media.fileName}'. Manual review required prior to upload.`,
          hashtags: ['#StudioFlow', '#VideoContent'],
          callToAction: 'Subscribe for more updates!',
          ...(chapters ? { chapterMarkers: chapters } : {}),
        };
      case 'tiktok':
        return {
          platform: 'tiktok',
          title: `[Review Required] ${baseTitle}`,
          description: `Check out this new video: ${baseTitle}! #fyp #viral #content`,
          hashtags: ['#fyp', '#viral', '#content', '#StudioFlow'],
          callToAction: 'Follow for more!',
        };
      case 'instagram':
        return {
          platform: 'instagram',
          title: `[Review Required] ${baseTitle}`,
          description: `Behind the scenes look: ${baseTitle}.\n\nAI publishing generation unavailable. Please review copy.`,
          hashtags: ['#reels', '#contentcreator', '#video', '#StudioFlow'],
          callToAction: 'Link in bio for full details.',
        };
      case 'twitter':
        return {
          platform: 'twitter',
          title: `[Review Required] ${baseTitle}`,
          description: `New video release: ${baseTitle}. Watch the highlights now.`,
          hashtags: ['#Tech', '#Video'],
        };
      case 'linkedin':
        return {
          platform: 'linkedin',
          title: `[Review Required] ${baseTitle}`,
          description: `Excited to share insights from our latest production: ${baseTitle}.\n\nKey takeaway: Review publishing copy prior to platform distribution.`,
          hashtags: ['#ProfessionalContent', '#MediaProduction', '#StudioFlow'],
          callToAction: 'What are your thoughts? Drop a comment below.',
        };
    }
  });

  return {
    projectId: request.projectId,
    mediaId: request.media.id,
    summary: 'Publisher metadata generated in fallback mode. AI copy generation unavailable.',
    platforms,
    source: 'fallback',
    generatedAt,
  };
}

export function toPublisherPanelData(result: PublisherAnalysisResult): PublisherPanelData {
  return {
    summary: result.summary,
    platforms: result.platforms.map((p) => ({
      platform: p.platform,
      title: p.title,
      description: p.description,
      hashtags: p.hashtags,
      ...(p.callToAction ? { callToAction: p.callToAction } : {}),
      ...(p.chapterMarkers ? { chapterMarkers: p.chapterMarkers } : {}),
    })),
  };
}
