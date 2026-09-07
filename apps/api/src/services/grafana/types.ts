export type AgentMetricStatus = 'completed' | 'failed';
export type WorkflowMetricStatus = 'completed' | 'failed';

export interface AgentTelemetryEvent {
  workflowId: string;
  agentType: string;
  durationMs: number;
  attempt: number;
  status: AgentMetricStatus;
  geminiLatency: number;
  retryScheduled?: boolean;
  errorCode?: string;
}

export interface AgentTelemetryRecorder {
  recordAgentAttempt(event: AgentTelemetryEvent): void;
}

export interface WorkflowTelemetryRecorder {
  recordWorkflowStarted(workflowId: string): void;
  recordWorkflowFinished(workflowId: string, status: WorkflowMetricStatus): void;
}

export interface AgentTelemetryClient extends AgentTelemetryRecorder, WorkflowTelemetryRecorder {
  forceFlush(): Promise<boolean>;
  shutdown(): Promise<void>;
  isEnabled(): boolean;
}
