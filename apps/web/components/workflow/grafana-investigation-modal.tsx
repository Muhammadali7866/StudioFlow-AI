'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  SearchCode,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useApiClient } from '@/hooks/use-api-client';
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
  workflowId?: string;
}

export function GrafanaInvestigationModal({
  open,
  onClose,
  investigation,
  workflowId,
}: GrafanaInvestigationModalProps) {
  const { getWorkflowInvestigation } = useApiClient();
  const [liveInvestigation, setLiveInvestigation] = useState<RecoveryInvestigation>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (!open || !workflowId) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(undefined);
    getWorkflowInvestigation(workflowId)
      .then((result) => {
        if (!cancelled) setLiveInvestigation(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLiveInvestigation(undefined);
          setLoadError(error instanceof Error ? error.message : 'Failed to load investigation.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getWorkflowInvestigation, open, workflowId]);

  const activeInvestigation = workflowId ? liveInvestigation : investigation;

  if (!activeInvestigation) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Grafana investigation"
        description="Live workflow evidence from the StudioFlow observability backend."
        className="max-w-2xl"
      >
        <div className="flex min-h-48 items-center justify-center p-6 text-center">
          {loading ? (
            <div className="space-y-3 text-sm text-muted">
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-accent" />
              <p>Loading correlated workflow telemetry…</p>
            </div>
          ) : (
            <div className="space-y-2">
              <TriangleAlert className="mx-auto h-6 w-6 text-amber-300" />
              <p className="text-sm font-semibold text-slate-200">No investigation available</p>
              <p className="max-w-md text-xs leading-5 text-muted">
                {loadError || 'No failed agent attempt has been recorded for this workflow.'}
              </p>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Grafana investigation"
      description="Correlated log, metric, and trace evidence used by the Director to choose a safe recovery action."
      className="max-w-5xl"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info" dot>
            {activeInvestigation.source === 'backend' ? 'Live backend telemetry' : 'Demo sample'}
          </Badge>
          <Badge tone="danger">{activeInvestigation.errorCode}</Badge>
          <Badge tone={activeInvestigation.recoveredIn === 'Pending' ? 'warning' : 'success'}>
            {activeInvestigation.recoveredIn === 'Pending'
              ? 'Recovery pending'
              : `Recovered in ${activeInvestigation.recoveredIn}`}
          </Badge>
          <span className="ml-auto font-mono text-[10px] text-slate-500">
            TRACE {activeInvestigation.traceId}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: 'Diagnosis',
              value: activeInvestigation.diagnosis,
              icon: SearchCode,
              tone: 'text-cyan-200 bg-accent/10',
            },
            {
              label: 'Decision',
              value: activeInvestigation.decision,
              icon: Gauge,
              tone: 'text-amber-200 bg-warning/10',
            },
            {
              label: 'Action',
              value: activeInvestigation.action,
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
            <span className="font-mono text-[10px] text-slate-500">
              {activeInvestigation.totalDurationMs.toLocaleString()}ms total
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {activeInvestigation.trace.map((span) => (
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
              {activeInvestigation.query}
            </pre>
            <div className="mt-3 space-y-2 font-mono text-[10px] leading-5 text-slate-400">
              {activeInvestigation.logEvidence.map((entry) => (
                <p key={`${entry.timestamp}-${entry.message}`}>
                  {new Date(entry.timestamp).toLocaleTimeString()} {entry.source} {entry.message}
                </p>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-line bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Clock3 className="h-4 w-4 text-amber-300" />
              Metric evidence
            </div>
            <pre className="pretty-scrollbar mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-cyan-200">
              {activeInvestigation.metricQuery}
            </pre>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {activeInvestigation.metricEvidence.map((entry) => (
                <div key={entry.label} className="rounded-lg bg-raised/70 px-3 py-2">
                  <dt className="text-[9px] uppercase tracking-wide text-slate-500">
                    {entry.label}
                  </dt>
                  <dd className="mt-1 font-mono text-[11px] text-slate-300">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <p className="rounded-xl border border-brand/20 bg-brand/[0.06] px-4 py-3 text-[11px] leading-5 text-brand-soft/75">
          {activeInvestigation.source === 'backend'
            ? 'Evidence is derived from persisted backend attempts and correlated with the same labels used by the Grafana dashboard.'
            : 'Demo evidence is shown because this sample project is not connected to a persisted backend workflow.'}
        </p>
      </div>
    </Modal>
  );
}
