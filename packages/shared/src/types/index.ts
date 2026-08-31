export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'failed';
export type MediaAssetStatus = 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type AgentExecutionStatus = 'idle' | 'running' | 'success' | 'failed';
export type WorkflowState =
  | 'CREATED'
  | 'PROCESSING'
  | 'TRANSCRIBING'
  | 'ANALYZING_ASSETS'
  | 'CHECKING_COMPLIANCE'
  | 'GENERATING_PUBLISHING_PACKAGE'
  | 'REVIEW'
  | 'COMPLETED'
  | 'FAILED';

export interface WorkflowStateHistoryEntry {
  from: WorkflowState | null;
  to: WorkflowState;
  changedAt: string;
  reason?: string;
}

export interface TaskError {
  code: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

export interface TaskAttempt {
  attempt: number;
  status: Exclude<TaskStatus, 'pending'>;
  startedAt: string;
  completedAt?: string;
  output?: Record<string, unknown>;
  error?: TaskError;
}

export interface AgentResponse {
  agentName: string;
  status: 'ok' | 'error';
  message: string;
  geminiRawResponse?: string;
  isFallback?: boolean;
  timestamp?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}
//
export interface MediaAsset {
  id: string;
  projectId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  status: MediaAssetStatus;
  createdAt: string;
  publicUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
  mediaAssets: MediaAsset[];
  description?: string;
}

export interface Workflow {
  id: string;
  projectId: string;
  tasks: Task[];
  status: WorkflowState;
  stateHistory: WorkflowStateHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  name?: string;
}

export interface Task {
  id: string;
  workflowId: string;
  agentName: string;
  action: string;
  status: TaskStatus;
  attempts: TaskAttempt[];
  output?: Record<string, unknown>;
  error?: TaskError;
  createdAt: string;
  updatedAt: string;
}

export interface AgentExecution {
  id: string;
  agentName: string;
  input: string;
  output?: string;
  status: AgentExecutionStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface StatusCheckResponse {
  api: boolean;
  firestore: boolean;
  storage: boolean;
  timestamp: string;
}
