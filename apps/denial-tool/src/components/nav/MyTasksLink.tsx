/**
 * MyTasksLink — "My tasks" link in the TopNav with the NeedsMyReviewBadge.
 *
 * Wires to ?queue=user_<self_id> on the worklist page. In production the
 * personal queue id comes from the JWT-derived caller identity; for the mock
 * we read it from queue.list (the queue with queue_type='personal').
 *
 * Drop-in path: src/components/nav/MyTasksLink.tsx
 */

import { Link } from 'react-router-dom';
import { useActionQuery } from '@tensaw/actions';
import type { Queue } from '../../actions/schemas-v4';
import { NeedsMyReviewBadge } from './NeedsMyReviewBadge';

export function MyTasksLink(): React.ReactElement {
  const { data } = useActionQuery<{ queues: Queue[] }>('queue.list', {});
  const personal = data?.queues?.find((q) => q.queue_type === 'personal');
  const to = personal !== undefined
    ? `/inbox?queue=${encodeURIComponent(personal.queue_id)}`
    : '/inbox';

  return (
    <Link
      to={to}
      className="
        flex items-center gap-1 rounded-md px-3 py-2
        text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white
        focus:outline-none focus:ring-2 focus:ring-blue-500
      "
    >
      <span>My tasks</span>
      <NeedsMyReviewBadge />
    </Link>
  );
}
