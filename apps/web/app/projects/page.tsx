'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ProjectArtwork } from '@/components/projects/project-artwork';
import { ProjectStatusBadge } from '@/components/projects/project-status-badge';
import { Button, buttonStyles } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useStudioFlow } from '@/hooks/use-studioflow';
import { cn } from '@/lib/cn';
import { formatProjectDate } from '@/lib/format';
import type { ProjectStatus, StudioProject } from '@/types/studioflow';

type Filter = 'all' | ProjectStatus;

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All projects' },
  { id: 'processing', label: 'Processing' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Needs human' },
];

function projectDestination(project: StudioProject): string {
  if (project.status === 'processing' || project.status === 'failed') {
    return `/projects/${project.id}/workflow`;
  }
  return `/projects/${project.id}/review`;
}

export default function ProjectsPage() {
  const { projects, retryProject } = useStudioFlow();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesFilter = filter === 'all' || project.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.code.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, projects, query]);

  const activeCount = projects.filter((project) => project.status === 'processing').length;
  const reviewCount = projects.filter((project) => project.status === 'needs_review').length;
  const completedCount = projects.filter((project) => project.status === 'completed').length;
  const recoveredCount = projects.reduce((sum, project) => sum + project.recoveredIncidents, 0);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-7 px-4 py-7 sm:px-6 lg:py-9">
      <PageHeader
        eyebrow="Creator workspace"
        title="Projects"
        description="Move every finished video from upload to an approved publishing package with one observable agent workflow."
        actions={
          <Link href="/projects/new" className={buttonStyles({ size: 'lg' })}>
            <Plus className="h-4 w-4" />
            New project
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Project summary">
        {[
          {
            label: 'Active runs',
            value: activeCount,
            icon: Activity,
            tone: 'text-brand-soft',
            background: 'bg-brand/10',
          },
          {
            label: 'Needs review',
            value: reviewCount,
            icon: Clock3,
            tone: 'text-amber-200',
            background: 'bg-warning/10',
          },
          {
            label: 'Approved',
            value: completedCount,
            icon: CheckCircle2,
            tone: 'text-emerald-200',
            background: 'bg-success/10',
          },
          {
            label: 'Auto-recovered',
            value: recoveredCount,
            icon: ShieldCheck,
            tone: 'text-cyan-200',
            background: 'bg-accent/10',
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Panel key={metric.label} className="flex items-center gap-4 p-4 sm:p-5">
              <span
                className={cn(
                  'grid h-11 w-11 place-items-center rounded-xl',
                  metric.background,
                  metric.tone
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-white">{metric.value}</p>
                <p className="text-xs font-medium text-muted">{metric.label}</p>
              </div>
            </Panel>
          );
        })}
      </section>

      {recoveredCount > 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-accent/25 bg-accent/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-cyan-200">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-cyan-100">Director recovery captured</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-cyan-100/65">
                The active run recovered from a transient model failure after consulting correlated
                Grafana telemetry.
              </p>
            </div>
          </div>
          <Link
            href="/projects/cyberpunk-city/workflow"
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            View recovery
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <section className="space-y-4" aria-labelledby="project-list-heading">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 id="project-list-heading" className="text-base font-bold text-white">
              Recent projects
            </h2>
            <p className="mt-1 text-xs text-muted">{visibleProjects.length} visible projects</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or project ID"
                aria-label="Search projects"
                className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-brand"
              />
            </div>
            <div className="pretty-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition',
                    filter === item.id
                      ? 'bg-brand/20 text-brand-soft'
                      : 'text-muted hover:bg-raised hover:text-white'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleProjects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleProjects.map((project) => (
              <Panel
                key={project.id}
                className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-brand/35"
              >
                <ProjectArtwork project={project} className="h-36" />
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        {project.code}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-white">
                        {project.name}
                      </h3>
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </div>

                  <p className="line-clamp-2 min-h-10 text-xs leading-5 text-muted">
                    {project.goal}
                  </p>

                  {project.status === 'processing' && (
                    <ProgressBar value={project.progress} label={project.activeStage} />
                  )}

                  {project.issue && (
                    <div className="rounded-xl border border-danger/25 bg-danger/[0.07] p-3 text-xs leading-5 text-rose-200/80">
                      {project.issue}
                    </div>
                  )}

                  <dl className="grid grid-cols-2 gap-3 border-t border-line/60 pt-4 text-xs">
                    <div>
                      <dt className="text-slate-500">Source</dt>
                      <dd className="mt-1 truncate font-medium text-slate-300">
                        {project.sourceFileName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Created</dt>
                      <dd className="mt-1 font-medium text-slate-300">
                        {formatProjectDate(project.createdAt)}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2">
                    {project.status === 'failed' && (
                      <Button variant="danger" size="sm" onClick={() => retryProject(project.id)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    )}
                    <Link
                      href={projectDestination(project)}
                      className={buttonStyles({
                        variant: project.status === 'failed' ? 'secondary' : 'primary',
                        size: 'sm',
                        className: 'ml-auto',
                      })}
                    >
                      {project.status === 'needs_review' || project.status === 'completed'
                        ? 'Open review'
                        : 'Open workflow'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <Panel className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand-soft">
                <FolderKanban className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-base font-bold text-white">No matching projects</h3>
              <p className="mt-2 text-sm text-muted">
                Clear the search or choose another status filter.
              </p>
            </div>
          </Panel>
        )}
      </section>
    </main>
  );
}
