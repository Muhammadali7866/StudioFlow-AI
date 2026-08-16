import { Film, ScanLine } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StudioProject } from '@/types/studioflow';

const artworkStyles: Record<StudioProject['artworkTone'], string> = {
  violet: 'from-violet-950 via-indigo-900/80 to-cyan-950',
  cyan: 'from-cyan-950 via-slate-900 to-blue-950',
  amber: 'from-amber-950 via-orange-950/80 to-slate-950',
  rose: 'from-rose-950 via-slate-900 to-violet-950',
};

interface ProjectArtworkProps {
  project: StudioProject;
  className?: string;
  showLabel?: boolean;
}

export function ProjectArtwork({ project, className, showLabel = true }: ProjectArtworkProps) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-gradient-to-br',
        artworkStyles[project.artworkTone],
        className
      )}
    >
      <div className="absolute -left-8 top-1/3 h-28 w-28 rounded-full bg-brand/25 blur-2xl" />
      <div className="absolute -right-8 bottom-0 h-28 w-28 rounded-full bg-accent/15 blur-2xl" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:24px_24px]" />
      <ScanLine className="absolute right-4 top-4 h-5 w-5 text-white/35" />
      <div className="relative flex h-full flex-col justify-between p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-black/20 text-white/80 backdrop-blur">
          <Film className="h-5 w-5" />
        </span>
        {showLabel && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              Source frame
            </p>
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/85">
              {project.sourceFileName}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
