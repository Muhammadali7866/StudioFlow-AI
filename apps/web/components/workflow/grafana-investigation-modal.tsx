'use client';

import { Activity, CheckCircle2, Clock3, Gauge, SearchCode, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/cn';
import type { RecoveryInvestigation, Tone } from '@/types/studioflow';

const traceTone: Record<Tone, string> = {
  neutral: 'bg-slate-500',
  brand: 'bg-brand',
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

interface GrafanaInvestigationModalProps {
  open: boolean;
  onClose: () => void;
  investigation: RecoveryInvestigation;
}

export function GrafanaInvestigationModal({
  open,
  onClose,
  investigation,
}: GrafanaInvestigationModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Grafana MCP investigation"
      description="Correlated log, metric, and trace evidence used by the Director to choose a safe recovery action."
      className="max-w-5xl"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info" dot>
            Frontend sample
          </Badge>
          <Badge tone="danger">{investigation.errorCode}</Badge>
          <Badge tone="success">Recovered in {investigation.recoveredIn}</Badge>
          <span className="ml-auto font-mono text-[10px] text-slate-500">
            TRACE {investigation.traceId}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: 'Diagnosis',
              value: investigation.diagnosis,
              icon: SearchCode,
              tone: 'text-cyan-200 bg-accent/10',
            },
            {
              label: 'Decision',
              value: investigation.decision,
              icon: Gauge,
              tone: 'text-amber-200 bg-warning/10',
            },
            {
              label: 'Action',
              value: investigation.action,
              icon: CheckCircle2,
              tone: 'text-emerald-200 bg-success/10',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-line bg-raised/55 p-4">
                <span className={cn('grid h-9 w-9 place-items-center rounded-lg', item.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {item.label}
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-300">{item.value}</p>
              </div>
            );
          })}
        </div>

        <section className="rounded-xl border border-line bg-canvas/50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-soft" />
              <h3 className="text-xs font-bold text-white">Correlated trace</h3>
            </div>
            <span className="font-mono text-[10px] text-slate-500">11,200ms total</span>
          </div>
          <div className="mt-5 space-y-3">
            {investigation.trace.map((span) => (
              <div
                key={span.name}
                className="grid items-center gap-2 sm:grid-cols-[9rem_1fr_4.5rem]"
              >
                <div>
                  <p className="truncate font-mono text-[10px] text-slate-300">{span.name}</p>
                  <p className="mt-0.5 truncate text-[9px] text-slate-600">{span.service}</p>
                </div>
                <div className="relative h-5 overflow-hidden rounded-md bg-raised">
                  <span
                    className={cn('absolute top-1 h-3 rounded-sm', traceTone[span.tone])}
                    style={{ left: `${span.offsetPercent}%`, width: `${span.widthPercent}%` }}
                  />
                </div>
                <span className="text-right font-mono text-[10px] text-muted">
                  {span.durationMs}ms
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <TriangleAlert className="h-4 w-4 text-rose-300" />
              Log evidence
            </div>
            <pre className="pretty-scrollbar mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-cyan-200">
              {investigation.query}
            </pre>
            <p className="mt-3 font-mono text-[10px] leading-5 text-slate-400">
              10:45:10.102Z scene-agent error upstream returned 429; no output commit recorded
            </p>
          </section>
          <section className="rounded-xl border border-line bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Clock3 className="h-4 w-4 text-amber-300" />
              Metric evidence
            </div>
            <pre className="pretty-scrollbar mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-cyan-200">
              {investigation.metricQuery}
            </pre>
            <p className="mt-3 font-mono text-[10px] leading-5 text-slate-400">
              short-lived error spike; queue depth returned to baseline within 4.8 seconds
            </p>
          </section>
        </div>

        <p className="rounded-xl border border-brand/20 bg-brand/[0.06] px-4 py-3 text-[11px] leading-5 text-brand-soft/75">
          This slice renders the intended evidence contract. Real telemetry queries and the
          Director&apos;s MCP tool call are connected in the backend slice.
        </p>
      </div>
    </Modal>
  );
}
