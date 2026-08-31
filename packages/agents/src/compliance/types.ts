import type { AssetAnalysisResult } from '../asset/types';
import type { MediaMetadata } from '../director/types';
import type { TranscriptAnalysisResult } from '../transcript/types';

export type ComplianceCategory = 'safety' | 'disclosure' | 'accessibility' | 'metadata';

export type ComplianceStatus = 'passed' | 'warning' | 'failed';

export interface ComplianceCheckItem {
  category: ComplianceCategory;
  title: string;
  description: string;
  status: ComplianceStatus;
  resolution: string;
  resolved: boolean;
}

export interface ComplianceAnalysisResult {
  projectId: string;
  mediaId: string;
  overallStatus: ComplianceStatus;
  summary: string;
  checks: ComplianceCheckItem[];
  source: 'gemini' | 'fallback';
  generatedAt: string;
}

export interface ComplianceRequest {
  projectId: string;
  media: MediaMetadata;
  transcriptResult?: TranscriptAnalysisResult;
  assetResult?: AssetAnalysisResult;
}

export interface CompliancePanelData {
  overallStatus: ComplianceStatus;
  summary: string;
  checks: Array<{
    category: ComplianceCategory;
    title: string;
    description: string;
    status: ComplianceStatus;
    resolution: string;
    resolved: boolean;
  }>;
}
