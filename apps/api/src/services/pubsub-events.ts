export type WorkflowEventType = 'WorkflowStarted' | 'TaskCompleted' | 'TaskFailed';

export interface WorkflowStartedEvent {
  eventType: 'WorkflowStarted';
  workflowId: string;
  projectId: string;
  mediaId?: string;
  publishedAt: string;
}

export interface TaskCompletedEvent {
  eventType: 'TaskCompleted';
  workflowId: string;
  taskId: string;
  agentName: string;
  completedAt: string;
}

export interface TaskFailedEvent {
  eventType: 'TaskFailed';
  workflowId: string;
  taskId: string;
  agentName: string;
  errorCode: string;
  retryable: boolean;
  failedAt: string;
}

export type WorkflowEvent = WorkflowStartedEvent | TaskCompletedEvent | TaskFailedEvent;
