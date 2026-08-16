import { Bot, FileText, ScanLine, ShieldCheck, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AgentStatusBadge } from '@/components/workflow/agent-status-badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { cn } from '@/lib/cn';
import type { AgentRole, AgentRun } from '@/types/studioflow';

const roleConfig: Record<AgentRole, { icon: LucideIcon; tone: string }> = {
  director: { icon: Bot, tone: 'bg-brand/10 text-brand-soft border-brand/25' },
  transcript: { icon: FileText, tone: 'bg-sky-500/10 text-sky-200 border-sky-500/20' },
  scene: { icon: ScanLine, tone: 'bg-accent/10 text-cyan-200 border-accent/20' },
  compliance: {
    icon: ShieldCheck,
    tone: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
  },
  publishing: { icon: Tags, tone: 'bg-amber-500/10 text-amber-200 border-amber-500/20' },
};

export function AgentCard({ agent }: { agent: AgentRun }) {
  const config = roleConfig[agent.role];
  const Icon = config.icon;

  return (
    <article
      className={cn(
        'rounded-2xl border bg-surface/85 p-4 transition sm:p-5',
        agent.status === 'running' ? 'border-brand/45 shadow-glow' : 'border-line/80'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
            config.tone
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">{agent.name}</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-500">{agent.model}</p>
            </div>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">{agent.description}</p>
        </div>
      </div>

      {agent.currentAction && (
        <div className="mt-4 rounded-xl border border-line/60 bg-canvas/45 px-3 py-2.5 text-[11px] leading-5 text-slate-300">
          {agent.currentAction}
        </div>
      )}

      {typeof agent.progress === 'number' && agent.status === 'running' && (
        <ProgressBar value={agent.progress} className="mt-4" />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
        {agent.tools.map((tool) => (
          <span
            key={tool}
            className="rounded-md bg-raised px-2 py-1 font-mono text-[9px] text-slate-400"
          >
            {tool}
          </span>
        ))}
        {agent.duration && (
          <span className="ml-auto font-mono text-[10px] text-slate-500">{agent.duration}</span>
        )}
      </div>
    </article>
  );
}
