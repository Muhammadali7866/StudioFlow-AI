'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckSquare2, FileStack, GitBranch } from 'lucide-react';
import { ProjectStatusBadge } from '@/components/projects/project-status-badge';
import { useStudioFlow } from '@/hooks/use-studioflow';
import { cn } from '@/lib/cn';

const tabs = [
  { segment: 'workflow', label: 'Workflow', icon: GitBranch },
  { segment: 'outputs', label: 'Outputs', icon: FileStack },
  { segment: 'review', label: 'Final review', icon: CheckSquare2 },
];

export function ProjectNavigation({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { findProject, getWorkspace } = useStudioFlow();
  const project = findProject(projectId);
  const workspace = getWorkspace(projectId);

  if (!project || !workspace) return null;

  const warningCount = workspace.compliance.filter(
    (item) => item.status !== 'passed' && !item.resolved
  ).length;

  return (
    <div className="sticky top-16 z-20 border-b border-line/80 bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5 overflow-x-auto px-4 sm:px-6">
        <nav className="flex min-w-max items-center" aria-label="Project navigation">
          {tabs.map((tab) => {
            const href = `/projects/${project.id}/${tab.segment}`;
            const active = pathname === href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.segment}
                href={href}
                className={cn(
                  'relative flex h-12 items-center gap-2 px-3 text-xs font-semibold transition sm:px-4',
                  active ? 'text-brand-soft' : 'text-muted hover:text-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.segment === 'outputs' && warningCount > 0 && (
                  <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                    {warningCount}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <span className="font-mono text-[10px] text-muted">{project.code}</span>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>
    </div>
  );
}
