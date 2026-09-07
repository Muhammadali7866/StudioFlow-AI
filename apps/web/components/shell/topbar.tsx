'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, Plus } from 'lucide-react';
import { StudioFlowLogo } from '@/components/brand/studioflow-logo';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import { useStudioFlow } from '@/hooks/use-studioflow';

interface TopbarProps {
  onOpenNavigation: () => void;
}

function currentLabel(pathname: string): string {
  if (pathname.endsWith('/new')) return 'New project';
  if (pathname.endsWith('/workflow')) return 'Workflow';
  if (pathname.endsWith('/outputs')) return 'Outputs';
  if (pathname.endsWith('/review')) return 'Final review';
  return 'Projects';
}

export function Topbar({ onOpenNavigation }: TopbarProps) {
  const pathname = usePathname();
  const { projects } = useStudioFlow();
  const project = projects.find((item) => pathname.includes(`/projects/${item.id}/`));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/80 bg-canvas/85 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenNavigation}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted hover:text-white lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/projects" className="sm:hidden" aria-label="StudioFlow projects">
          <StudioFlowLogo compact />
        </Link>
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <Link
            href="/projects"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-muted hover:text-white"
          >
            Workspace
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          {project && (
            <>
              <span className="max-w-[18rem] truncate text-xs font-semibold text-slate-200">
                {project.name}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            </>
          )}
          <span className="text-xs font-semibold text-brand-soft">{currentLabel(pathname)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone="info" dot className="hidden md:inline-flex">
          Live + demo
        </Badge>
        <Link href="/projects/new" className={buttonStyles({ size: 'sm' })}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New project</span>
        </Link>
      </div>
    </header>
  );
}
