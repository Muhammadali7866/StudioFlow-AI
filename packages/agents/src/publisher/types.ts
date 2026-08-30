import type { AssetAnalysisResult } from '../asset/types';
import type { ComplianceAnalysisResult } from '../compliance/types';
import type { MediaMetadata } from '../director/types';
import type { TranscriptAnalysisResult } from '../transcript/types';

export type TargetPlatform = 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin';

export interface PlatformMetadata {
  platform: TargetPlatform;
  title: string;
  description: string;
  hashtags: string[];
  callToAction?: string;
  chapterMarkers?: string[];
}

export interface PublisherAnalysisResult {
  projectId: string;
  mediaId: string;
  summary: string;
  platforms: PlatformMetadata[];
  source: 'gemini' | 'fallback';
  generatedAt: string;
}

export interface PublisherRequest {
  projectId: string;
  media: MediaMetadata;
  targetPlatforms?: TargetPlatform[];
  transcriptResult?: TranscriptAnalysisResult;
  assetResult?: AssetAnalysisResult;
  complianceResult?: ComplianceAnalysisResult;
}

export interface PublisherPanelData {
  summary: string;
  platforms: Array<{
    platform: TargetPlatform;
    title: string;
    description: string;
    hashtags: string[];
    callToAction?: string;
    chapterMarkers?: string[];
  }>;
}
