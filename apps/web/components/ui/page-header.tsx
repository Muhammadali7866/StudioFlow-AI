import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between', className)}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="eyebrow mb-2 text-brand-soft">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
