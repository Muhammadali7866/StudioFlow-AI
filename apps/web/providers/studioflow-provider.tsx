'use client';

import { createContext, useCallback, useMemo, useState } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import {
  DEMO_AGENTS,
  DEMO_CHAPTERS,
  DEMO_COMPLIANCE,
  DEMO_INVESTIGATION,
  DEMO_LOGS,
  DEMO_PROJECTS,
  DEMO_PUBLISHING_PACKAGE,
  DEMO_SCENES,
  DEMO_TRANSCRIPT,
} from '@/data/demo-data';
import type { AgentResponse, MediaAsset } from '@studioflow/shared';
import type {
  CreateProjectInput,
  ProjectWorkspace,
  PublishingPackage,
  StudioProject,
} from '@/types/studioflow';

interface StudioFlowContextValue {
  projects: StudioProject[];
  findProject: (projectId: string) => StudioProject | undefined;
  getWorkspace: (projectId: string) => ProjectWorkspace | undefined;
  createProject: (input: CreateProjectInput, videoFile?: File) => Promise<string>;
  retryProject: (projectId: string) => void;
  prepareProjectForReview: (projectId: string) => void;
  resolveComplianceCheck: (projectId: string, checkId: string) => void;
  selectTitle: (projectId: string, titleId: string) => void;
  updateDescription: (projectId: string, description: string) => void;
  addTag: (projectId: string, tag: string) => void;
  removeTag: (projectId: string, tag: string) => void;
  approveProject: (projectId: string) => void;
}

export const StudioFlowContext = createContext<StudioFlowContextValue | null>(null);

function createProjectCode(): string {
  return `SF-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

function clonePublishingPackage(): PublishingPackage {
  return {
    ...DEMO_PUBLISHING_PACKAGE,
    titleOptions: DEMO_PUBLISHING_PACKAGE.titleOptions.map((option) => ({ ...option })),
    tags: [...DEMO_PUBLISHING_PACKAGE.tags],
    chapters: DEMO_PUBLISHING_PACKAGE.chapters.map((chapter) => ({ ...chapter })),
    readiness: DEMO_PUBLISHING_PACKAGE.readiness.map((item) => ({ ...item })),
  };
}

function createWorkspace(project: StudioProject, queued = false): ProjectWorkspace {
  return {
    agents: DEMO_AGENTS.map((agent) =>
      queued
        ? {
            ...agent,
            tools: [...agent.tools],
            status: agent.role === 'director' ? 'running' : 'waiting',
            progress: agent.role === 'director' ? 12 : undefined,
            duration: undefined,
            currentAction:
              agent.role === 'director'
                ? 'Preparing specialist tasks'
                : 'Waiting for Director assignment',
          }
        : { ...agent, tools: [...agent.tools] }
    ),
    logs: queued
      ? [
          {
            id: `${project.id}-created`,
            timestamp: new Date().toLocaleTimeString([], { hour12: false }),
            source: 'system',
            message: `Workflow initialized for project ${project.code}.`,
            tone: 'neutral',
          },
          {
            id: `${project.id}-director`,
            timestamp: new Date().toLocaleTimeString([], { hour12: false }),
            source: 'director',
            message: 'Director is preparing the specialist execution plan.',
            tone: 'brand',
          },
        ]
      : DEMO_LOGS.map((log) => ({ ...log })),
    transcript: DEMO_TRANSCRIPT.map((segment) => ({ ...segment })),
    chapters: DEMO_CHAPTERS.map((chapter) => ({ ...chapter })),
    scenes: DEMO_SCENES.map((scene) => ({ ...scene, signals: [...scene.signals] })),
    compliance: DEMO_COMPLIANCE.map((check) => ({ ...check })),
    publishingPackage: clonePublishingPackage(),
    investigation: {
      ...DEMO_INVESTIGATION,
      steps: DEMO_INVESTIGATION.steps.map((step) => ({ ...step })),
      trace: DEMO_INVESTIGATION.trace.map((span) => ({ ...span })),
    },
  };
}

function createInitialWorkspaces(): Record<string, ProjectWorkspace> {
  return Object.fromEntries(DEMO_PROJECTS.map((project) => [project.id, createWorkspace(project)]));
}

export function StudioFlowProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<StudioProject[]>(DEMO_PROJECTS);
  const [workspaces, setWorkspaces] =
    useState<Record<string, ProjectWorkspace>>(createInitialWorkspaces);
  const apiClient = useApiClient();

  const findProject = useCallback(
    (projectId: string) => projects.find((project) => project.id === projectId),
    [projects]
  );

  const getWorkspace = useCallback((projectId: string) => workspaces[projectId], [workspaces]);

  const createProject = useCallback(
    async (input: CreateProjectInput, videoFile?: File): Promise<string> => {
      let backendProjectId: string | undefined;
      let agentResponseData: AgentResponse | undefined;
      let mediaAssetData: MediaAsset | undefined;

      try {
        const apiProject = await apiClient.createProject(input.name, input.goal);
        backendProjectId = apiProject.id;

        if (videoFile && backendProjectId) {
          mediaAssetData = await apiClient.uploadMedia(backendProjectId, videoFile);
        }

        const promptMsg = `New project created: "${input.name}". Goal: "${input.goal}".` + (mediaAssetData ? ` Video file uploaded: ${mediaAssetData.fileName}.` : '');
        agentResponseData = await apiClient.callAgent(promptMsg);
      } catch (err: any) {
        console.warn('⚠️ [StudioFlow API Warning] API execution fallback active:', err?.message || err);
      }

      const id = backendProjectId || `project-${Date.now()}`;
      const project: StudioProject = {
        id,
        code: createProjectCode(),
        name: input.name,
        goal: input.goal,
        status: 'processing',
        progress: 12,
        activeStage: 'Director preparing the execution plan',
        sourceFileName: input.sourceFileName,
        sourceFileSize: input.sourceFileSize,
        duration: 'Analyzing',
        targetPlatform: 'YouTube',
        createdAt: new Date().toISOString(),
        recoveredIncidents: 0,
        artworkTone: 'violet',
        agentResponse: agentResponseData,
        mediaAsset: mediaAssetData,
      };

      setProjects((current) => [project, ...current]);
      setWorkspaces((current) => ({
        ...current,
        [project.id]: createWorkspace(project, true),
      }));
      return id;
    },
    [apiClient]
  );

  const retryProject = useCallback((projectId: string) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              status: 'processing',
              progress: 42,
              activeStage: 'Director evaluating retry',
              issue: undefined,
            }
          : project
      )
    );
    setWorkspaces((current) => {
      const workspace = current[projectId];
      if (!workspace) return current;
      return {
        ...current,
        [projectId]: {
          ...workspace,
          agents: workspace.agents.map((agent) => ({
            ...agent,
            status:
              agent.role === 'director'
                ? 'running'
                : agent.role === 'scene'
                  ? 'retrying'
                  : 'waiting',
            currentAction:
              agent.role === 'director'
                ? 'Evaluating retry evidence'
                : agent.role === 'scene'
                  ? 'Waiting for retry backoff'
                  : 'Waiting for Director assignment',
          })),
        },
      };
    });
  }, []);

  const prepareProjectForReview = useCallback((projectId: string) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              status: 'needs_review',
              progress: 100,
              activeStage: 'Awaiting producer approval',
            }
          : project
      )
    );
    setWorkspaces((current) => {
      const workspace = current[projectId];
      if (!workspace) return current;
      return {
        ...current,
        [projectId]: {
          ...workspace,
          agents: workspace.agents.map((agent) => ({
            ...agent,
            status: 'completed',
            progress: 100,
            currentAction: undefined,
            duration: agent.duration ?? '2m 08s',
          })),
        },
      };
    });
  }, []);

  const resolveComplianceCheck = useCallback((projectId: string, checkId: string) => {
    setWorkspaces((current) => {
      const workspace = current[projectId];
      if (!workspace) return current;

      const compliance = workspace.compliance.map((check) =>
        check.id === checkId ? { ...check, resolved: true } : check
      );
      const allResolved = compliance.every((check) => check.status === 'passed' || check.resolved);
      const publishingPackage = allResolved
        ? {
            ...workspace.publishingPackage,
            readiness: workspace.publishingPackage.readiness.map((item) =>
              item.id === 'captions' || item.id === 'compliance'
                ? { ...item, completed: true }
                : item
            ),
          }
        : workspace.publishingPackage;

      return {
        ...current,
        [projectId]: { ...workspace, compliance, publishingPackage },
      };
    });
  }, []);

  const updatePublishingPackage = useCallback(
    (projectId: string, updater: (current: PublishingPackage) => PublishingPackage) => {
      setWorkspaces((current) => {
        const workspace = current[projectId];
        if (!workspace) return current;
        return {
          ...current,
          [projectId]: {
            ...workspace,
            publishingPackage: updater(workspace.publishingPackage),
          },
        };
      });
    },
    []
  );

  const selectTitle = useCallback(
    (projectId: string, titleId: string) => {
      updatePublishingPackage(projectId, (current) => ({
        ...current,
        selectedTitleId: titleId,
      }));
    },
    [updatePublishingPackage]
  );

  const updateDescription = useCallback(
    (projectId: string, description: string) => {
      updatePublishingPackage(projectId, (current) => ({ ...current, description }));
    },
    [updatePublishingPackage]
  );

  const addTag = useCallback(
    (projectId: string, tag: string) => {
      const normalized = tag.trim();
      if (!normalized) return;

      updatePublishingPackage(projectId, (current) => {
        if (current.tags.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
          return current;
        }
        return { ...current, tags: [...current.tags, normalized] };
      });
    },
    [updatePublishingPackage]
  );

  const removeTag = useCallback(
    (projectId: string, tag: string) => {
      updatePublishingPackage(projectId, (current) => ({
        ...current,
        tags: current.tags.filter((item) => item !== tag),
      }));
    },
    [updatePublishingPackage]
  );

  const approveProject = useCallback((projectId: string) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              status: 'completed',
              progress: 100,
              activeStage: 'Publishing package approved',
              approvedAt: new Date().toISOString(),
            }
          : project
      )
    );
  }, []);

  const value = useMemo<StudioFlowContextValue>(
    () => ({
      projects,
      findProject,
      getWorkspace,
      createProject,
      retryProject,
      prepareProjectForReview,
      resolveComplianceCheck,
      selectTitle,
      updateDescription,
      addTag,
      removeTag,
      approveProject,
    }),
    [
      addTag,
      approveProject,
      createProject,
      findProject,
      getWorkspace,
      prepareProjectForReview,
      projects,
      removeTag,
      resolveComplianceCheck,
      retryProject,
      selectTitle,
      updateDescription,
    ]
  );

  return <StudioFlowContext.Provider value={value}>{children}</StudioFlowContext.Provider>;
}
