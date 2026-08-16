import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StudioFlowLogoProps {
  compact?: boolean;
  className?: string;
}

export function StudioFlowLogo({ compact = false, className }: StudioFlowLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/45 bg-brand/15 shadow-glow">
        <span className="absolute inset-1 rounded-lg bg-gradient-to-br from-brand/35 via-transparent to-accent/20" />
        <svg aria-hidden="true" viewBox="0 0 32 32" className="relative h-6 w-6 text-brand-soft">
          <path
            d="M16 3.5 26.5 9.6v12.2L16 28 5.5 21.8V9.6L16 3.5Z"
            fill="currentColor"
            fillOpacity=".18"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="16" cy="10" r="2" fill="currentColor" />
          <circle cx="10.2" cy="20.2" r="2" fill="currentColor" />
          <circle cx="21.8" cy="20.2" r="2" fill="currentColor" />
          <path
            d="m16 12 4.7 7.1M15 12l-3.8 6.6M12.2 20.2h7.6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-accent" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-[17px] font-extrabold tracking-tight text-white">
            StudioFlow
          </span>
          <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-brand-soft">
            Agentic media
          </span>
        </span>
      )}
    </div>
  );
}
