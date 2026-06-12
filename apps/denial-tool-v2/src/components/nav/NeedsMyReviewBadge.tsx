/**
 * NeedsMyReviewBadge — the small red count bubble on My tasks.
 *
 * Reads from queue.list — the personal queue (queue_type='personal') is the
 * caller's; pending_count is the count of returned items. Renders null when
 * the count is 0 (don't show an empty bubble).
 *
 * Drop-in path: src/components/nav/NeedsMyReviewBadge.tsx
 */

import { useActionQuery } from '@tensaw/actions';

export interface NeedsMyReviewBadgeProps {
  /** Optional explicit count override (testing / SSR pre-fill). */
  count?: number;
}

export function NeedsMyReviewBadge({
  count: explicitCount,
}: NeedsMyReviewBadgeProps): React.ReactElement | null {
  const { data } = useActionQuery('queue.list', {});

  let count = explicitCount;
  if (count === undefined && data) {
    const personal = data.queues.find((q) => q.queue_type === 'personal');
    count = personal?.pending_count ?? 0;
  }

  if (count === undefined || count <= 0) return null;

  // Cap at 99 for layout (99+ rendered if higher)
  const display = count > 99 ? '99+' : String(count);

  return (
    <span
      role="status"
      aria-label={`${count} task${count === 1 ? '' : 's'} waiting for your review`}
      className="
        ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center
        rounded-full bg-red-500 px-1.5
        text-[11px] font-semibold leading-none text-white
        ring-2 ring-slate-900
      "
    >
      {display}
    </span>
  );
}
