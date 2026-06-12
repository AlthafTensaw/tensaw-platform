/**
 * useQueueState — single source of truth for "which queue am I viewing".
 *
 * Reads from `?queue=<queue_id>` URL param. Falls back to the caller's
 * default queue from queue.list (is_default_for_caller=true) when the URL
 * has no value.
 *
 * Used by:
 *   - QueueSwitcher (reads + writes when user picks)
 *   - WorklistPage (reads to drive the case.worklist query — wired in P1.6)
 *
 * Drop-in path: src/hooks/useQueueState.ts
 */

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActionQuery } from '@tensaw/actions';

export interface QueueState {
  /** The active queue id; null only when queue.list is still loading and
   *  there is no URL param yet. */
  activeQueueId: string | null;
  /** Update the active queue (writes to ?queue=). */
  setActiveQueueId: (queueId: string) => void;
  /** True while queue.list is in-flight and we have no URL fallback. */
  isLoading: boolean;
}

export function useQueueState(): QueueState {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading } = useActionQuery('queue.list', {});

  const queueFromUrl = searchParams.get('queue');
  const defaultQueueId =
    data?.queues.find((q) => q.is_default_for_caller)?.queue_id ?? null;
  const activeQueueId = queueFromUrl ?? defaultQueueId;

  const setActiveQueueId = useCallback(
    (queueId: string) => {
      const next: Record<string, string> = {};
      // Preserve other URL params; in real react-router this is more elegant
      const existing = searchParams.toString();
      if (existing) {
        const p = new URLSearchParams(existing);
        p.forEach((v, k) => {
          // Drop ?page= and ?case= when switching queues — they belong to the
          // previous queue's context
          if (k !== 'queue' && k !== 'page' && k !== 'case') next[k] = v;
        });
      }
      next.queue = queueId;
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  return {
    activeQueueId,
    setActiveQueueId,
    isLoading: isLoading && queueFromUrl === null,
  };
}
