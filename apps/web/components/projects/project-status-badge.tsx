import { Badge } from '@/components/ui/badge';
import type { ProjectStatus } from '@/types/studioflow';

const statusConfig: Record<
  ProjectStatus,
  { label: string; tone: Parameters<typeof Badge>[0]['tone']; dot: boolean }
> = {
  processing: { label: 'Processing', tone: 'brand', dot: true },
  needs_review: { label: 'Needs review', tone: 'warning', dot: true },
  completed: { label: 'Completed', tone: 'success', dot: false },
  failed: { label: 'Needs human', tone: 'danger', dot: true },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusConfig[status];
  return (
    <Badge tone={config.tone} dot={config.dot}>
      {config.label}
    </Badge>
  );
}
