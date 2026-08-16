'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonStyles } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/cn';
import type { ComplianceCheck, StudioProject } from '@/types/studioflow';

const reviewItems = [
  { id: 'title', label: 'The selected title accurately represents the video.' },
  { id: 'description', label: 'The description and resource references are accurate.' },
  { id: 'captions', label: 'The transcript, captions, and chapter markers were reviewed.' },
  { id: 'package', label: 'The tags and final publishing package are ready.' },
];

interface ApprovalPanelProps {
  project: StudioProject;
  compliance: ComplianceCheck[];
  onApprove: () => void;
}

export function ApprovalPanel({ project, compliance, onApprove }: ApprovalPanelProps) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const unresolved = compliance.filter((check) => check.status !== 'passed' && !check.resolved);
  const allReviewed = reviewItems.every((item) => checkedIds.includes(item.id));
  const canApprove = allReviewed && unresolved.length === 0;
  const approved = project.status === 'completed';

  function toggleItem(itemId: string) {
    setCheckedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  if (approved) {
    return (
      <Panel className="border-success/35 bg-gradient-to-br from-success/[0.09] to-surface p-6 text-center xl:sticky xl:top-32">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-success/25 bg-success/10 text-emerald-200">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <Badge tone="success" className="mt-5">
          Workflow complete
        </Badge>
        <h2 className="mt-4 text-xl font-extrabold text-white">Publishing package approved</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          The human approval is recorded. This package is ready for the creator&apos;s publishing
          process.
        </p>
        <div className="mt-5 rounded-xl border border-line bg-canvas/40 p-3 font-mono text-[10px] leading-5 text-slate-400">
          {project.approvedAt ? `approved_at=${project.approvedAt}` : 'approved_at=recorded'}
        </div>
        <Link
          href="/projects"
          className={buttonStyles({ variant: 'secondary', className: 'mt-5 w-full' })}
        >
          <ArrowLeft className="h-4 w-4" />
          Return to projects
        </Link>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden xl:sticky xl:top-32">
      <header className="border-b border-line/70 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-soft">
            <FileCheck2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">Producer approval</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Confirm each item yourself. Nothing is pre-approved.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-5">
        {unresolved.length > 0 && (
          <div className="rounded-xl border border-warning/25 bg-warning/[0.07] p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <div>
                <p className="text-xs font-bold text-amber-100">
                  {unresolved.length} readiness actions remain
                </p>
                <p className="mt-1 text-[11px] leading-5 text-amber-100/65">
                  Resolve them in the Compliance output before approving.
                </p>
                <Link
                  href={`/projects/${project.id}/outputs?view=compliance`}
                  className="mt-2 inline-flex text-[11px] font-bold text-amber-200 hover:text-amber-100"
                >
                  Review compliance →
                </Link>
              </div>
            </div>
          </div>
        )}

        <fieldset className="space-y-2.5">
          <legend className="eyebrow mb-3">Required confirmations</legend>
          {reviewItems.map((item) => {
            const checked = checkedIds.includes(item.id);
            return (
              <label
                key={item.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition',
                  checked
                    ? 'border-brand/35 bg-brand/[0.07]'
                    : 'border-line bg-raised/40 hover:border-brand/25'
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleItem(item.id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border',
                    checked ? 'border-brand bg-brand text-white' : 'border-slate-600 bg-canvas'
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="text-xs leading-5 text-slate-300">{item.label}</span>
              </label>
            );
          })}
        </fieldset>

        <div className="border-t border-line/60 pt-5">
          <Button size="lg" className="w-full" disabled={!canApprove} onClick={onApprove}>
            {canApprove ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <LockKeyhole className="h-4 w-4" />
            )}
            Approve publishing package
          </Button>
          <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">
            Approval marks StudioFlow complete. It does not publish externally.
          </p>
          <Link
            href={`/projects/${project.id}/outputs?view=publishing`}
            className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'mt-2 w-full' })}
          >
            Request changes in outputs
          </Link>
        </div>
      </div>
    </Panel>
  );
}
