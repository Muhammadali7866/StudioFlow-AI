'use client';

import { useMemo, useState } from 'react';
import { Activity, Bot, Database, Gauge, Sparkles, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { LogSource, Tone, WorkflowLog } from '@/types/studioflow';

type FeedFilter = 'all' | 'director' | 'tools' | 'warnings';

const filters: Array<{ id: FeedFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'director', label: 'Director' },
  { id: 'tools', label: 'Tools' },
  { id: 'warnings', label: 'Warnings' },
];

const sourceConfig: Record<LogSource, { label: string; icon: LucideIcon }> = {
  system: { label: 'System', icon: Activity },
  director: { label: 'Director', icon: Bot },
  gemini: { label: 'Gemini', icon: Sparkles },
  storage: { label: 'Storage', icon: Database },
  specialist: { label: 'Specialist', icon: Wrench },
  grafana: { label: 'Grafana MCP', icon: Gauge },
};

const dotStyles: Record<Tone, string> = {
  neutral: 'bg-slate-500',
  brand: 'bg-brand',
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

function matchesFilter(log: WorkflowLog, filter: FeedFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'director') return log.source === 'director';
  if (filter === 'tools') return ['gemini', 'storage', 'grafana'].includes(log.source);
  return log.tone === 'warning' || log.tone === 'danger';
}

export function ActivityFeed({ logs, paused }: { logs: WorkflowLog[]; paused: boolean }) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesFilter(log, filter)),
    [filter, logs]
  );

  return (
    <section className="surface-panel flex min-h-[34rem] flex-col overflow-hidden xl:sticky xl:top-32 xl:max-h-[calc(100vh-9rem)]">
      <header className="border-b border-line/70 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-200">
              Activity feed
            </h2>
          </div>
          <Badge tone={paused ? 'warning' : 'success'} dot>
            {paused ? 'Paused' : 'Following'}
          </Badge>
        </div>
        <div className="pretty-scrollbar mt-4 flex gap-1 overflow-x-auto">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition',
                filter === item.id ? 'bg-brand text-white' : 'bg-raised text-muted hover:text-white'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div
        className="pretty-scrollbar flex-1 space-y-2 overflow-y-auto p-3 sm:p-4"
        aria-live="polite"
      >
        {filteredLogs.map((log) => {
          const source = sourceConfig[log.source];
          const Icon = source.icon;
          return (
            <article key={log.id} className="rounded-xl border border-line/65 bg-raised/45 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wide text-slate-500">
                  <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[log.tone])} />
                  {log.timestamp}
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-subtle px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  <Icon className="h-3 w-3" />
                  {source.label}
                </span>
              </div>
              <p className="mt-3 font-mono text-[11px] leading-5 text-slate-300">{log.message}</p>
              {log.payload && (
                <pre className="pretty-scrollbar mt-3 overflow-x-auto rounded-lg border border-line/50 bg-black/25 p-3 font-mono text-[10px] leading-5 text-cyan-200">
                  {log.payload}
                </pre>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
