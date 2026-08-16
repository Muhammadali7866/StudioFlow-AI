'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ScanLine, ShieldCheck, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CompliancePanel } from '@/components/outputs/compliance-panel';
import { PublishingPanel } from '@/components/outputs/publishing-panel';
import { ScenePanel } from '@/components/outputs/scene-panel';
import { TranscriptPanel } from '@/components/outputs/transcript-panel';
import { cn } from '@/lib/cn';
import type {
  ComplianceCheck,
  PublishingPackage,
  SceneInsight,
  TranscriptSegment,
  Chapter,
} from '@/types/studioflow';

export type OutputView = 'transcript' | 'scenes' | 'compliance' | 'publishing';

const views: Array<{ id: OutputView; label: string; description: string; icon: LucideIcon }> = [
  { id: 'transcript', label: 'Transcript', description: 'Captions & chapters', icon: FileText },
  { id: 'scenes', label: 'Scenes', description: 'Visual analysis', icon: ScanLine },
  { id: 'compliance', label: 'Compliance', description: 'Readiness checks', icon: ShieldCheck },
  { id: 'publishing', label: 'Publishing', description: 'Metadata package', icon: Tags },
];

interface OutputsWorkspaceProps {
  projectId: string;
  initialView: OutputView;
  transcript: TranscriptSegment[];
  chapters: Chapter[];
  scenes: SceneInsight[];
  compliance: ComplianceCheck[];
  packageData: PublishingPackage;
  onResolveCompliance: (checkId: string) => void;
  onSelectTitle: (titleId: string) => void;
  onUpdateDescription: (description: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function OutputsWorkspace({
  projectId,
  initialView,
  transcript,
  chapters,
  scenes,
  compliance,
  packageData,
  onResolveCompliance,
  onSelectTitle,
  onUpdateDescription,
  onAddTag,
  onRemoveTag,
}: OutputsWorkspaceProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<OutputView>(initialView);
  const warnings = compliance.filter((item) => item.status !== 'passed' && !item.resolved).length;

  function changeView(view: OutputView) {
    setActiveView(view);
    router.replace(`/projects/${projectId}/outputs?view=${view}`, { scroll: false });
  }

  return (
    <>
      <div className="pretty-scrollbar overflow-x-auto rounded-2xl border border-line bg-surface p-1.5">
        <div
          className="grid min-w-[680px] grid-cols-4 gap-1"
          role="tablist"
          aria-label="Generated outputs"
        >
          {views.map((view) => {
            const Icon = view.icon;
            const active = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeView(view.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
                  active
                    ? 'border-brand/35 bg-brand/15 text-white'
                    : 'border-transparent text-muted hover:bg-raised hover:text-white'
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                    active ? 'bg-brand/20 text-brand-soft' : 'bg-raised text-slate-500'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    {view.label}
                    {view.id === 'compliance' && warnings > 0 && (
                      <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] text-amber-200">
                        {warnings}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {view.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5" role="tabpanel">
        {activeView === 'transcript' && (
          <TranscriptPanel segments={transcript} chapters={chapters} />
        )}
        {activeView === 'scenes' && <ScenePanel scenes={scenes} />}
        {activeView === 'compliance' && (
          <CompliancePanel checks={compliance} onResolve={onResolveCompliance} />
        )}
        {activeView === 'publishing' && (
          <PublishingPanel
            projectId={projectId}
            packageData={packageData}
            onSelectTitle={onSelectTitle}
            onUpdateDescription={onUpdateDescription}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
          />
        )}
      </div>
    </>
  );
}
