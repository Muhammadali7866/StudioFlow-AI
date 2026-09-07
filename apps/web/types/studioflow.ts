import type {
  AgentResponse,
  InvestigationStep as SharedInvestigationStep,
  InvestigationTraceSpan,
  MediaAsset,
  WorkflowInvestigation,
} from '@studioflow/shared';

export type ProjectStatus = 'processing' | 'needs_review' | 'completed' | 'failed';

export type AgentRole = 'director' | 'transcript' | 'scene' | 'compliance' | 'publishing';

export type AgentStatus =
  'running' | 'completed' | 'waiting' | 'failed' | 'retrying' | 'needs_human';

export type LogSource = 'system' | 'director' | 'gemini' | 'storage' | 'specialist' | 'grafana';

export type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';

export interface StudioProject {
  id: string;
  code: string;
  name: string;
  goal: string;
  status: ProjectStatus;
  progress: number;
  activeStage: string;
  sourceFileName: string;
  sourceFileSize: string;
  duration: string;
  targetPlatform: 'YouTube';
  createdAt: string;
  recoveredIncidents: number;
  issue?: string;
  approvedAt?: string;
  artworkTone: 'violet' | 'cyan' | 'amber' | 'rose';
  workflowId?: string;
  agentResponse?: AgentResponse;
  mediaAsset?: MediaAsset;
}

export interface AgentRun {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  status: AgentStatus;
  model: string;
  tools: string[];
  progress?: number;
  currentAction?: string;
  duration?: string;
}

export interface WorkflowLog {
  id: string;
  timestamp: string;
  source: LogSource;
  message: string;
  tone: Tone;
  payload?: string;
}

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  confidence: number;
  flagged?: boolean;
}

export interface Chapter {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
}

export interface SceneInsight {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  signals: string[];
  artworkTone: StudioProject['artworkTone'];
  recommendedUse: string;
}

export type ComplianceStatus = 'passed' | 'warning' | 'failed';

export interface ComplianceCheck {
  id: string;
  category: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  timestamp?: string;
  resolution?: string;
  resolved: boolean;
}

export interface TitleOption {
  id: string;
  title: string;
  audienceFit: 'Best fit' | 'Strong' | 'Focused';
  rationale: string;
}

export interface ReadinessItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface PublishingPackage {
  titleOptions: TitleOption[];
  selectedTitleId: string;
  description: string;
  tags: string[];
  chapters: Chapter[];
  readiness: ReadinessItem[];
}

export type InvestigationStep = SharedInvestigationStep;
export type TraceSpan = InvestigationTraceSpan;
export type RecoveryInvestigation = WorkflowInvestigation;

export interface CreateProjectInput {
  name: string;
  goal: string;
  sourceFileName: string;
  sourceFileSize: string;
}

export interface ProjectWorkspace {
  agents: AgentRun[];
  logs: WorkflowLog[];
  transcript: TranscriptSegment[];
  chapters: Chapter[];
  scenes: SceneInsight[];
  compliance: ComplianceCheck[];
  publishingPackage: PublishingPackage;
  investigation: RecoveryInvestigation;
}
