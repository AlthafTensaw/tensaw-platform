/**
 * QueueRoutingChip — small chip indicating which queue the current task
 * is on. Anchored on mockup #3 card line 3 (right side).
 *
 * Visual: monospace-ish text, dark background, white-ish foreground.
 * Personal queues get a distinct (warmer) color to stand out from team queues.
 *
 * Reusable beyond CaseCard — used in CaseDetail and possibly TaskFormShell
 * later. That's why it's a standalone component.
 *
 * Drop-in path: src/components/cards/QueueRoutingChip.tsx
 */

import { queueChipLabel } from '../../lib/labels';

export interface QueueRoutingChipProps {
  queueId: string;
}

export function QueueRoutingChip({ queueId }: QueueRoutingChipProps): React.ReactElement {
  const isPersonal = queueId.startsWith('user_');
  const label = queueChipLabel(queueId);

  return (
    <span
      title={queueId}
      className={`
        ml-auto inline-flex items-center
        rounded px-1.5 py-0.5
        font-mono text-[10px] tracking-tight
        ${isPersonal
          ? 'bg-orange-100 text-orange-800'
          : 'bg-slate-100 text-slate-700'}
      `}
    >
      {label}
    </span>
  );
}
