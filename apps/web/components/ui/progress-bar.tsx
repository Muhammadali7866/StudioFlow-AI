import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  label?: string;
  className?: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}

const toneStyles = {
  brand: 'from-brand to-indigo-400',
  success: 'from-emerald-500 to-emerald-300',
  warning: 'from-amber-500 to-amber-300',
  danger: 'from-rose-500 to-rose-300',
};

export function ProgressBar({ value, label, className, tone = 'brand' }: ProgressBarProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{label}</span>
          <span className="font-mono font-semibold text-slate-300">{normalizedValue}%</span>
        </div>
      )}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedValue}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-[width] duration-500',
            toneStyles[tone]
          )}
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  );
}
