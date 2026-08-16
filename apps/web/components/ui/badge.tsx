import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/types/studioflow';

const toneStyles: Record<Tone, string> = {
  neutral: 'border-line bg-subtle/80 text-slate-300',
  brand: 'border-brand/35 bg-brand/15 text-brand-soft',
  info: 'border-accent/30 bg-accent/10 text-cyan-200',
  success: 'border-success/30 bg-success/10 text-emerald-200',
  warning: 'border-warning/30 bg-warning/10 text-amber-200',
  danger: 'border-danger/30 bg-danger/10 text-rose-200',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({
  className,
  tone = 'neutral',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
        toneStyles[tone],
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
