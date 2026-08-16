import { Captions, CheckCircle2, FileText, Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import type { ComplianceCheck, PublishingPackage, StudioProject } from '@/types/studioflow';

interface PackageSummaryProps {
  project: StudioProject;
  packageData: PublishingPackage;
  compliance: ComplianceCheck[];
}

export function PackageSummary({ project, packageData, compliance }: PackageSummaryProps) {
  const selectedTitle = packageData.titleOptions.find(
    (option) => option.id === packageData.selectedTitleId
  );
  const reviewedChecks = compliance.filter(
    (check) => check.status === 'passed' || check.resolved
  ).length;

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <header className="border-b border-line/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Selected title</p>
              <h2 className="mt-2 max-w-3xl text-lg font-extrabold leading-7 text-white sm:text-xl">
                {selectedTitle?.title}
              </h2>
            </div>
            <Badge tone="brand">{selectedTitle?.audienceFit}</Badge>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">{selectedTitle?.rationale}</p>
        </header>

        <div className="grid gap-px bg-line/60 sm:grid-cols-3">
          {[
            {
              label: 'Description',
              value: `${packageData.description.length} characters`,
              icon: FileText,
            },
            { label: 'Tags', value: `${packageData.tags.length} reviewed`, icon: Tags },
            {
              label: 'Chapters',
              value: `${packageData.chapters.length} generated`,
              icon: Captions,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 bg-surface p-4 sm:p-5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-raised text-brand-soft">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-200">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Description preview</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">
              {packageData.description}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line/60 pt-5">
          {packageData.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[10px] text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/10 text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">Human approval boundary</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              {reviewedChecks} of {compliance.length} readiness checks are passed or reviewed.
              Approval completes the StudioFlow workflow; it does not publish to YouTube.
            </p>
            <p className="mt-2 font-mono text-[10px] text-slate-500">PROJECT {project.code}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
