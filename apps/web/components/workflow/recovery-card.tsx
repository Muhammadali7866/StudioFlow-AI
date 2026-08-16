import {
  ArrowRight,
  Activity,
  CheckCircle2,
  Gauge,
  PauseCircle,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RecoveryInvestigation } from '@/types/studioflow';

interface RecoveryCardProps {
  investigation: RecoveryInvestigation;
  onOpen: () => void;
}

const stepIcons = [TriangleAlert, PauseCircle, Gauge, CheckCircle2];

export function RecoveryCard({ investigation, onOpen }: RecoveryCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-accent/30 bg-accent/[0.055] shadow-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/15 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-cyan-100">
          <Activity className="h-4 w-4" />
          <h2 className="text-xs font-bold uppercase tracking-[0.12em]">
            Director failure investigation
          </h2>
        </div>
        <Badge tone="success">Recovered in {investigation.recoveredIn}</Badge>
      </header>
      <div className="p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {investigation.steps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <div key={step.label} className="rounded-xl border border-line/70 bg-raised/55 p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-cyan-200" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    {index + 1}. {step.label}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-200">
                  {step.detail}
                </p>
              </div>
            );
          })}
        </div>

        <dl className="mt-4 space-y-2 rounded-xl border border-line/60 bg-black/20 p-3.5 font-mono text-[10px] leading-5 sm:text-[11px]">
          <div className="grid gap-1 sm:grid-cols-[5.5rem_1fr]">
            <dt className="text-slate-500">Observed</dt>
            <dd className="text-rose-200">{investigation.errorCode}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[5.5rem_1fr]">
            <dt className="text-slate-500">Decision</dt>
            <dd className="text-cyan-200">
              Retry after correlated telemetry confirmed an idempotent transient failure.
            </dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[5.5rem_1fr]">
            <dt className="text-slate-500">Action</dt>
            <dd className="text-emerald-200">Attempt 1 succeeded and the workflow resumed.</dd>
          </div>
        </dl>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 px-0 text-cyan-200 hover:bg-transparent hover:text-cyan-100"
          onClick={onOpen}
        >
          View Grafana MCP evidence
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}
