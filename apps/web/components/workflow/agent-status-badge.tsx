import { Badge } from '@/components/ui/badge';
import type { AgentStatus, Tone } from '@/types/studioflow';

const statusConfig: Record<AgentStatus, { label: string; tone: Tone; dot: boolean }> = {
  running: { label: 'Running', tone: 'brand', dot: true },
  completed: { label: 'Completed', tone: 'success', dot: false },
  waiting: { label: 'Waiting', tone: 'neutral', dot: false },
  failed: { label: 'Failed', tone: 'danger', dot: true },
  retrying: { label: 'Retrying', tone: 'warning', dot: true },
  needs_human: { label: 'Needs human', tone: 'danger', dot: true },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge tone={config.tone} dot={config.dot}>
      {config.label}
    </Badge>
  );
}
