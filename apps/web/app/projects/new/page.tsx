'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bot,
  Check,
  FileText,
  Film,
  ScanLine,
  ShieldCheck,
  Tags,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useDemoUpload } from '@/hooks/use-demo-upload';
import { useStudioFlow } from '@/hooks/use-studioflow';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';

const workflowSteps = [
  {
    name: 'Transcript & chapters',
    description: 'Timestamped transcript, confidence signals, and chapter boundaries.',
    icon: FileText,
  },
  {
    name: 'Scene analysis',
    description: 'Key moments, visual signals, and reusable source frames.',
    icon: ScanLine,
  },
  {
    name: 'Compliance readiness',
    description: 'Caption, accessibility, disclosure, and metadata checks.',
    icon: ShieldCheck,
  },
  {
    name: 'Publishing package',
    description: 'Titles, description, tags, chapters, and approval checklist.',
    icon: Tags,
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { createProject } = useStudioFlow();
  const upload = useDemoUpload();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('Prepare this video for a clear, engaging YouTube release.');
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  const canSubmit = Boolean(name.trim() && goal.trim() && upload.file && upload.phase === 'ready');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !upload.file || submitting) return;

    setSubmitting(true);
    setSubmitStatus('Saving project & uploading video asset...');

    try {
      const projectId = await createProject(
        {
          name: name.trim(),
          goal: goal.trim(),
          sourceFileName: upload.file.name,
          sourceFileSize: formatBytes(upload.file.size),
        },
        upload.file
      );

      router.push(`/projects/${projectId}/workflow`);
    } catch (err: any) {
      console.error('❌ Failed to process project workflow creation:', err);
      setSubmitStatus(null);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-7 px-4 py-7 sm:px-6 lg:py-9">
      <PageHeader
        eyebrow="New workflow"
        title="Prepare a finished video"
        description="Give the Director a source video and release goal. Every specialist in this frozen workflow is required and coordinated automatically."
      />

      <form
        onSubmit={handleSubmit}
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]"
      >
        <div className="space-y-5">
          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand-soft">
                  <Film className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">Project details</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    A concise goal helps the Director evaluate every specialist output.
                  </p>
                </div>
              </div>
            </PanelHeader>
            <PanelBody className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-300">
                  Project name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder="e.g. Building a Cyberpunk City"
                  className="h-11 w-full rounded-xl border border-line bg-canvas/70 px-3.5 text-sm text-white placeholder:text-slate-600 focus:border-brand"
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-300">
                  Release goal
                  <span className="font-normal text-slate-500">YouTube</span>
                </span>
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  required
                  rows={4}
                  className="w-full resize-y rounded-xl border border-line bg-canvas/70 px-3.5 py-3 text-sm leading-6 text-white placeholder:text-slate-600 focus:border-brand"
                />
              </label>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Source video</h2>
                  <p className="mt-1 text-xs text-muted">
                    MP4, MOV, or WebM · up to 250 MB for this frontend demonstration
                  </p>
                </div>
                {upload.file && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={upload.reset}
                    aria-label="Remove selected video"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </PanelHeader>
            <PanelBody>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.selectFile(file);
                }}
              />

              {!upload.file ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    const file = event.dataTransfer.files[0];
                    if (file) upload.selectFile(file);
                  }}
                  className={cn(
                    'grid min-h-56 w-full place-items-center rounded-2xl border border-dashed p-6 text-center transition',
                    dragging
                      ? 'border-brand bg-brand/10'
                      : 'border-line bg-canvas/45 hover:border-brand/50 hover:bg-brand/[0.04]'
                  )}
                >
                  <span>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand-soft">
                      <UploadCloud className="h-6 w-6" />
                    </span>
                    <span className="mt-4 block text-sm font-bold text-white">
                      Drop your finished video here
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted">
                      or choose a file from your computer
                    </span>
                  </span>
                </button>
              ) : (
                <div className="rounded-2xl border border-line bg-canvas/45 p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-soft">
                      {upload.phase === 'ready' ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <UploadCloud className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {upload.file.name}
                          </p>
                          <p className="mt-1 text-xs text-muted">{formatBytes(upload.file.size)}</p>
                        </div>
                        <span className="text-xs font-semibold text-brand-soft">
                          {upload.phase === 'ready' ? 'Ready' : 'Preparing'}
                        </span>
                      </div>
                      <ProgressBar
                        value={upload.progress}
                        className="mt-4"
                        tone={upload.phase === 'ready' ? 'success' : 'brand'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {upload.error && (
                <p className="mt-3 text-xs font-medium text-rose-300">{upload.error}</p>
              )}
              <p className="mt-4 text-[11px] leading-5 text-slate-500">
                Frontend slice: the file stays in your browser. Cloud Storage upload replaces this
                adapter in the backend slice.
              </p>
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-5 xl:sticky xl:top-36">
          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-cyan-200">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">Director plan</h2>
                  <p className="mt-0.5 text-xs text-muted">One required, observable workflow</p>
                </div>
              </div>
            </PanelHeader>
            <PanelBody className="space-y-3">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.name}
                    className="flex gap-3 rounded-xl border border-line/65 bg-raised/45 p-3.5"
                  >
                    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-soft">
                      <Icon className="h-4 w-4" />
                      <span className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-slate-700 text-[8px] font-bold text-white">
                        {index + 1}
                      </span>
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-200">{step.name}</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </PanelBody>
          </Panel>

          <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 text-xs leading-5 text-cyan-100/70">
            The Director also observes specialist failures and records whether it retried
            automatically or requested human intervention.
          </div>

          <Button type="submit" size="lg" disabled={!canSubmit || submitting} className="w-full">
            {submitting ? (submitStatus || 'Opening workflow…') : 'Create project & start workflow'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </main>
  );
}
