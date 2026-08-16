import { Clock3, Eye, ScanLine, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/cn';
import type { SceneInsight, StudioProject } from '@/types/studioflow';

const frameStyles: Record<StudioProject['artworkTone'], string> = {
  violet: 'from-violet-950 via-indigo-900 to-cyan-950',
  cyan: 'from-cyan-950 via-blue-950 to-slate-950',
  amber: 'from-amber-950 via-orange-950 to-slate-950',
  rose: 'from-rose-950 via-violet-950 to-slate-950',
};

function SceneFrame({ scene }: { scene: SceneInsight }) {
  return (
    <div
      className={cn(
        'relative h-40 overflow-hidden bg-gradient-to-br',
        frameStyles[scene.artworkTone]
      )}
    >
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_65%_35%,rgba(255,255,255,.4),transparent_2px),linear-gradient(110deg,transparent_30%,rgba(255,255,255,.12)_50%,transparent_70%)] [background-size:32px_32px,100%_100%]" />
      <div className="absolute bottom-0 left-[12%] h-[70%] w-[18%] bg-black/35 [clip-path:polygon(20%_0,80%_0,100%_100%,0_100%)]" />
      <div className="absolute bottom-0 right-[15%] h-[52%] w-[28%] bg-black/30 [clip-path:polygon(8%_15%,92%_0,100%_100%,0_100%)]" />
      <span className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/35 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur">
        {scene.timestamp}
      </span>
      <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-white/15 bg-black/35 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white/70 backdrop-blur">
        <ScanLine className="h-3 w-3" />
        source frame
      </span>
    </div>
  );
}

export function ScenePanel({ scenes }: { scenes: SceneInsight[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Scenes analyzed', value: '37', icon: Eye },
          { label: 'High-signal moments', value: scenes.length.toString(), icon: Sparkles },
          { label: 'Timeline coverage', value: '100%', icon: Clock3 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.label} className="flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-cyan-200">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-lg font-extrabold text-white">{item.value}</p>
                <p className="text-[11px] text-muted">{item.label}</p>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {scenes.map((scene) => (
          <Panel key={scene.id} className="overflow-hidden">
            <SceneFrame scene={scene} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">{scene.title}</h2>
                  <p className="mt-2 text-xs leading-5 text-muted">{scene.summary}</p>
                </div>
                <Badge tone="info" className="shrink-0">
                  {scene.recommendedUse}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line/60 pt-4">
                {scene.signals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-md bg-raised px-2 py-1 text-[10px] font-medium text-slate-400"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <p className="rounded-xl border border-accent/20 bg-accent/[0.055] p-4 text-xs leading-5 text-cyan-100/70">
        Scene analysis identifies useful moments from the uploaded source. This scope does not claim
        to generate new thumbnails or social cuts.
      </p>
    </div>
  );
}
