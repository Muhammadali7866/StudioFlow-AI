'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, CheckCircle2, Circle, Pause, Play, RotateCcw } from 'lucide-react';
import { ProjectNotFound } from '@/components/projects/project-not-found';
import { ActivityFeed } from '@/components/workflow/activity-feed';
import { AgentCard } from '@/components/workflow/agent-card';
import { GrafanaInvestigationModal } from '@/components/workflow/grafana-investigation-modal';
import { RecoveryCard } from '@/components/workflow/recovery-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useStudioFlow } from '@/hooks/use-studioflow';

const directorTasks = [
  { label: 'Inspect source metadata and create execution plan', complete: true },
  { label: 'Run transcript and scene analysis in parallel', complete: true },
  { label: 'Recover failed scene-analysis attempt', complete: true },
  { label: 'Validate compliance and prepare publishing handoff', complete: false },
];

export default function WorkflowPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const { findProject, getWorkspace, retryProject, prepareProjectForReview } = useStudioFlow();
  const [paused, setPaused] = useState(false);
  const [investigationOpen, setInvestigationOpen] = useState(false);
  const project = findProject(params.projectId);
  const workspace = getWorkspace(params.projectId);

  if (!project || !workspace) return <ProjectNotFound />;

  const director = workspace.agents.find((agent) => agent.role === 'director');
  const specialists = workspace.agents.filter((agent) => agent.role !== 'director');
  const projectId = project.id;

  function openOutputs() {
    prepareProjectForReview(projectId);
    router.push(`/projects/${projectId}/outputs`);
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-7 sm:px-6 lg:py-8">
      <PageHeader
        eyebrow={`${project.code} · ${project.targetPlatform}`}
        title="Live agent workflow"
        description={`The Director is coordinating the release package for “${project.name}” and recording every specialist decision.`}
        actions={
          <>
            {project.status === 'failed' && (
              <Button variant="danger" onClick={() => retryProject(project.id)}>
                <RotateCcw className="h-4 w-4" />
                Retry run
              </Button>
            )}
            <Button variant="secondary" onClick={() => setPaused((current) => !current)}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? 'Resume updates' : 'Pause updates'}
            </Button>
            <Button onClick={openOutputs}>
              View generated outputs
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,.75fr)]">
        <div className="space-y-5">
          {director && (
            <Panel className="border-brand/45 bg-gradient-to-br from-brand/[0.09] via-surface to-surface p-5 shadow-glow sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/35 bg-brand/15 text-brand-soft">
                    <Bot className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-white">Director Agent</h2>
                      <Badge tone="brand" dot>
                        Orchestrating
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                      Goal: {project.goal}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-brand-soft">RUN wf_8a92</span>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {directorTasks.map((task) => (
                  <div
                    key={task.label}
                    className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-canvas/35 px-3 py-2.5"
                  >
                    {task.complete ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 animate-soft-pulse text-brand-soft" />
                    )}
                    <span className="text-[11px] leading-5 text-slate-300">{task.label}</span>
                  </div>
                ))}
              </div>
              <ProgressBar value={project.progress} label={project.activeStage} className="mt-5" />
            </Panel>
          )}

          <RecoveryCard
            investigation={workspace.investigation}
            onOpen={() => setInvestigationOpen(true)}
          />

          <section aria-labelledby="specialists-heading">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 id="specialists-heading" className="text-sm font-bold text-white">
                  Specialist agents
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Four bounded tasks coordinated by the Director
                </p>
              </div>
              <Badge tone="neutral">{specialists.length} specialists</Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {specialists.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        </div>

        <ActivityFeed logs={workspace.logs} paused={paused} />
      </div>

      <GrafanaInvestigationModal
        open={investigationOpen}
        onClose={() => setInvestigationOpen(false)}
        investigation={workspace.investigation}
      />
    </main>
  );
}
