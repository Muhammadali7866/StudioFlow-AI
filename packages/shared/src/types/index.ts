export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'failed';
export type MediaAssetStatus = 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type AgentExecutionStatus = 'idle' | 'running' | 'success' | 'failed';

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
  name: string;
  tasks: Task[];
  status: 'active' | 'completed' | 'failed';
  createdAt: string;
}

export interface Task {
  id: string;
  workflowId: string;
  agentName: string;
  action: string;
  status: TaskStatus;
  output?: Record<string, unknown>;
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
