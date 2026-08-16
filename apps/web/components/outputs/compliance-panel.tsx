'use client';

import { AlertTriangle, Check, CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { ProgressBar } from '@/components/ui/progress-bar';
import { cn } from '@/lib/cn';
import type { ComplianceCheck } from '@/types/studioflow';

interface CompliancePanelProps {
  checks: ComplianceCheck[];
  onResolve: (checkId: string) => void;
}

export function CompliancePanel({ checks, onResolve }: CompliancePanelProps) {
  const readyCount = checks.filter((check) => check.status === 'passed' || check.resolved).length;
  const score = Math.round((readyCount / checks.length) * 100);
  const unresolvedCount = checks.length - readyCount;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
      <Panel className="overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-line/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Readiness checks</h2>
              <p className="mt-1 text-xs text-muted">
                Human review is required for warnings; passing checks need no action.
              </p>
            </div>
          </div>
          <Badge tone={unresolvedCount ? 'warning' : 'success'}>
            {unresolvedCount ? `${unresolvedCount} actions remaining` : 'Ready for approval'}
          </Badge>
        </header>

        <div className="divide-y divide-line/60">
          {checks.map((check) => {
            const complete = check.status === 'passed' || check.resolved;
            const Icon = complete
              ? CheckCircle2
              : check.status === 'failed'
                ? XCircle
                : AlertTriangle;
            return (
              <article
                key={check.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start"
              >
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
                    complete
                      ? 'border-success/20 bg-success/10 text-emerald-200'
                      : 'border-warning/25 bg-warning/10 text-amber-200'
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {check.category}
                    </span>
                    {check.timestamp && <Badge tone="warning">{check.timestamp}</Badge>}
                    {check.resolved && check.status !== 'passed' && (
                      <Badge tone="success">Reviewed</Badge>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-200">{check.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted">{check.description}</p>
                  {!complete && check.resolution && (
                    <p className="mt-3 rounded-lg border border-warning/20 bg-warning/[0.055] px-3 py-2 text-[11px] leading-5 text-amber-100/75">
                      Required: {check.resolution}
                    </p>
                  )}
                </div>
                {!complete && (
                  <Button variant="secondary" size="sm" onClick={() => onResolve(check.id)}>
                    <Check className="h-3.5 w-3.5" />
                    Mark reviewed
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-5 xl:sticky xl:top-32 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Package readiness</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-white">{score}%</p>
          </div>
          <span
            className={cn(
              'grid h-14 w-14 place-items-center rounded-2xl',
              score === 100 ? 'bg-success/10 text-emerald-200' : 'bg-warning/10 text-amber-200'
            )}
          >
            {score === 100 ? <CheckCircle2 className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
          </span>
        </div>
        <ProgressBar value={score} tone={score === 100 ? 'success' : 'warning'} className="mt-5" />
        <div className="mt-5 space-y-3 border-t border-line/60 pt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Passed or reviewed</span>
            <span className="font-semibold text-slate-200">
              {readyCount} of {checks.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Blocking failures</span>
            <span className="font-semibold text-slate-200">
              {checks.filter((check) => check.status === 'failed' && !check.resolved).length}
            </span>
          </div>
        </div>
        <p className="mt-5 rounded-xl bg-raised/70 p-3 text-[11px] leading-5 text-muted">
          StudioFlow reports readiness signals; the producer remains responsible for the final
          publishing decision.
        </p>
      </Panel>
    </div>
  );
}
