export const SPECIALIST_AGENT_NAMES = ['transcript', 'asset', 'compliance', 'publisher'] as const;

export type SpecialistAgentName = (typeof SPECIALIST_AGENT_NAMES)[number];

export interface MediaMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  uri?: string;
}

export interface MediaJob {
  projectId: string;
  objective: string;
  media: MediaMetadata;
  targetPlatform?: string;
}

export interface WorkflowTask {
  id: string;
  agent: SpecialistAgentName;
  action: string;
  description: string;
  dependsOn: string[];
  expectedOutput: string;
}

export interface WorkflowPlan {
  version: '1.0';
  projectId: string;
  objective: string;
  media: MediaMetadata;
  summary: string;
  tasks: WorkflowTask[];
  executionOrder: string[][];
  source: 'gemini' | 'fallback';
  createdAt: string;
}

export interface DelegationContext {
  plan: WorkflowPlan;
  task: WorkflowTask;
}

export type SpecialistHandler = (context: DelegationContext) => Promise<unknown>;

export interface DelegationResult {
  taskId: string;
  agent: SpecialistAgentName;
  status: 'completed' | 'failed';
  output?: unknown;
  error?: string;
}
