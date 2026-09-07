'use client';

import { useCallback } from 'react';
import type {
  AgentResponse,
  MediaAsset,
  Project,
  Workflow,
  WorkflowInvestigation,
} from '@studioflow/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface StartWorkflowResponse {
  workflowId: string;
  status: Workflow['status'];
  workflow: Workflow;
}

const DEFAULT_WORKFLOW_TASKS = [
  { id: 'transcript', agentName: 'transcript', action: 'Transcribe media' },
  { id: 'assets', agentName: 'asset', action: 'Analyze visual assets' },
  { id: 'compliance', agentName: 'compliance', action: 'Check publishing compliance' },
  { id: 'publisher', agentName: 'publisher', action: 'Generate publishing package' },
];

export function useApiClient() {
  const createProject = useCallback(
    async (name: string, description?: string): Promise<Project> => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `Failed to create project (${response.status})`
        );
      }

      return response.json();
    },
    []
  );

  const uploadMedia = useCallback(async (projectId: string, file: File): Promise<MediaAsset> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/projects/${projectId}/media`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || `Failed to upload video asset (${response.status})`
      );
    }

    return response.json();
  }, []);

  const callAgent = useCallback(async (message: string): Promise<AgentResponse> => {
    const response = await fetch(`${API_BASE}/api/agent/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || `Failed to process agent prompt (${response.status})`
      );
    }

    return response.json();
  }, []);

  const startWorkflow = useCallback(
    async (projectId: string, mediaId?: string): Promise<StartWorkflowResponse> => {
      const response = await fetch(`${API_BASE}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          mediaId,
          name: 'StudioFlow publishing workflow',
          tasks: DEFAULT_WORKFLOW_TASKS,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `Failed to start workflow (${response.status})`
        );
      }

      return response.json();
    },
    []
  );

  const getWorkflowInvestigation = useCallback(
    async (workflowId: string): Promise<WorkflowInvestigation> => {
      const response = await fetch(`${API_BASE}/api/workflows/${workflowId}/investigation`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `Failed to load investigation (${response.status})`
        );
      }
      return response.json();
    },
    []
  );

  return {
    createProject,
    uploadMedia,
    callAgent,
    startWorkflow,
    getWorkflowInvestigation,
  };
}
