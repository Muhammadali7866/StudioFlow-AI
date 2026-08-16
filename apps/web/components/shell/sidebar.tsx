'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, GitBranch, Plus, X, Zap } from 'lucide-react';
import { StudioFlowLogo } from '@/components/brand/studioflow-logo';
import { DEMO_PROJECT_ID } from '@/data/demo-data';
import { cn } from '@/lib/cn';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderKanban, exact: true },
  { href: '/projects/new', label: 'New project', icon: Plus, exact: true },
  {
    href: `/projects/${DEMO_PROJECT_ID}/workflow`,
    label: 'Live workflow',
    icon: GitBranch,
    exact: false,
  },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line/80 bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line/70 px-4">
          <Link href="/projects" onClick={onClose} aria-label="StudioFlow projects">
            <StudioFlowLogo />
          </Link>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5" aria-label="Primary navigation">
          <p className="eyebrow px-3 pb-3">Workspace</p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                    active
                      ? 'border-brand/35 bg-brand/15 text-brand-soft shadow-glow'
                      : 'border-transparent text-muted hover:bg-raised hover:text-white'
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-brand-soft' : 'text-slate-500')} />
                  {item.label}
                  {item.label === 'Live workflow' && (
                    <span className="ml-auto flex h-2 w-2">
                      <span className="absolute h-2 w-2 animate-ping rounded-full bg-accent opacity-50" />
                      <span className="relative h-2 w-2 rounded-full bg-accent" />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3">
          <div className="rounded-xl border border-line bg-raised/65 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Zap className="h-3.5 w-3.5 text-brand-soft" />
                Agent engine
              </span>
              <span className="rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-200">
                UI DEMO
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              Interactive frontend state. API orchestration connects in the next slice.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
