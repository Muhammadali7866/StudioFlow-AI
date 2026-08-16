'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Clipboard, Plus, Tags, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonStyles } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { ProgressBar } from '@/components/ui/progress-bar';
import { cn } from '@/lib/cn';
import { copyText } from '@/lib/download';
import type { PublishingPackage } from '@/types/studioflow';

interface PublishingPanelProps {
  projectId: string;
  packageData: PublishingPackage;
  onSelectTitle: (titleId: string) => void;
  onUpdateDescription: (description: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function PublishingPanel({
  projectId,
  packageData,
  onSelectTitle,
  onUpdateDescription,
  onAddTag,
  onRemoveTag,
}: PublishingPanelProps) {
  const [newTag, setNewTag] = useState('');
  const [copied, setCopied] = useState(false);
  const completedReadiness = packageData.readiness.filter((item) => item.completed).length;
  const readinessScore = Math.round((completedReadiness / packageData.readiness.length) * 100);
  const selectedTitle = useMemo(
    () => packageData.titleOptions.find((item) => item.id === packageData.selectedTitleId),
    [packageData.selectedTitleId, packageData.titleOptions]
  );

  async function copyPackage() {
    const content = `${selectedTitle?.title ?? ''}\n\n${packageData.description}\n\n${packageData.tags.join(', ')}`;
    const succeeded = await copyText(content);
    if (succeeded) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <div className="space-y-5">
        <Panel className="overflow-hidden">
          <header className="border-b border-line/70 p-5">
            <h2 className="text-sm font-bold text-white">Title options</h2>
            <p className="mt-1 text-xs text-muted">
              Choose the framing that best matches the creator&apos;s goal and audience.
            </p>
          </header>
          <div className="space-y-3 p-4 sm:p-5">
            {packageData.titleOptions.map((option) => {
              const selected = option.id === packageData.selectedTitleId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectTitle(option.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition',
                    selected
                      ? 'border-brand/55 bg-brand/[0.09] shadow-glow'
                      : 'border-line bg-raised/45 hover:border-brand/30'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                      selected ? 'border-brand bg-brand text-white' : 'border-slate-600'
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-6 text-white">
                      {option.title}
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 text-muted">
                      {option.rationale}
                    </span>
                  </span>
                  <Badge
                    tone={option.audienceFit === 'Best fit' ? 'brand' : 'neutral'}
                    className="shrink-0"
                  >
                    {option.audienceFit}
                  </Badge>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line/70 p-5">
            <div>
              <h2 className="text-sm font-bold text-white">Description</h2>
              <p className="mt-1 text-xs text-muted">
                Editable before the package can be approved.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={copyPackage}>
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ) : (
                <Clipboard className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy package'}
            </Button>
          </header>
          <div className="p-5">
            <textarea
              value={packageData.description}
              onChange={(event) => onUpdateDescription(event.target.value)}
              rows={13}
              className="pretty-scrollbar w-full resize-y rounded-xl border border-line bg-canvas/55 p-4 text-sm leading-6 text-slate-200 focus:border-brand"
            />
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-brand-soft" />
            <h2 className="text-sm font-bold text-white">Tags</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {packageData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[11px] text-slate-300"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="text-slate-500 hover:text-rose-200"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onAddTag(newTag);
              setNewTag('');
            }}
          >
            <input
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              placeholder="Add a tag"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-canvas/55 px-3 text-sm text-white placeholder:text-slate-600 focus:border-brand"
            />
            <Button variant="secondary" type="submit" disabled={!newTag.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </Panel>
      </div>

      <div className="space-y-5 xl:sticky xl:top-32">
        <Panel className="p-5">
          <p className="eyebrow">Package readiness</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <span className="text-4xl font-black tracking-tight text-white">{readinessScore}%</span>
            <Badge tone={readinessScore === 100 ? 'success' : 'warning'}>
              {completedReadiness}/{packageData.readiness.length} ready
            </Badge>
          </div>
          <ProgressBar
            value={readinessScore}
            tone={readinessScore === 100 ? 'success' : 'warning'}
            className="mt-5"
          />
          <ul className="mt-5 space-y-2.5 border-t border-line/60 pt-5">
            {packageData.readiness.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5 text-xs">
                <span
                  className={cn(
                    'grid h-4 w-4 place-items-center rounded-full',
                    item.completed
                      ? 'bg-success/15 text-emerald-200'
                      : 'bg-warning/15 text-amber-200'
                  )}
                >
                  {item.completed ? (
                    <Check className="h-2.5 w-2.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className={item.completed ? 'text-slate-300' : 'text-muted'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="overflow-hidden">
          <header className="border-b border-line/70 p-4">
            <h2 className="text-xs font-bold text-white">Chapter markers</h2>
          </header>
          <ol className="pretty-scrollbar max-h-64 divide-y divide-line/60 overflow-y-auto">
            {packageData.chapters.map((chapter) => (
              <li key={chapter.id} className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-[10px] text-cyan-200">{chapter.timestamp}</span>
                <span className="truncate text-xs text-slate-300">{chapter.title}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Link
          href={`/projects/${projectId}/review`}
          className={buttonStyles({ size: 'lg', className: 'w-full' })}
        >
          Review publishing package
          <CheckCircle2 className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
