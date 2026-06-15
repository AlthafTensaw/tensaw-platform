/**
 * useTaskComplete (v4.1) — wraps the worklist.complete mutation.
 *
 * Engine-handler model: completion is keyed by task_id (no case_id in the
 * body), and fires worklist.complete (not task.complete). On success the engine
 * advances the case + dispatches the next task; the worklist + case-detail
 * caches are invalidated by the registry's INVALIDATE matrix.
 *
 * Per-task-type fact validation (TaskFacts<T>) belongs in the concrete form
 * before calling complete().
 *
 * Drop-in path: src/hooks/useTaskComplete.ts
 */

import { useCallback } from 'react';
import { useActionMutation } from '@tensaw/actions';
import type { HandlerOutcome } from '../actions/schemas';

export interface UseTaskCompleteResult {
  complete: (
    outcome: HandlerOutcome,
    facts: Record<string, unknown>,
    completionNote?: string,
  ) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

export function useTaskComplete(taskId: string): UseTaskCompleteResult {
  const [fire, { isPending, error }] = useActionMutation('worklist.complete');

  const complete = useCallback(
    async (
      outcome: HandlerOutcome,
      facts: Record<string, unknown>,
      completionNote?: string,
    ) => {
      await fire({
        task_id: taskId,
        outcome,
        facts_to_set: facts,
        ...(completionNote !== undefined && completionNote.trim() !== ''
          ? { completion_note: completionNote.trim() }
          : {}),
      });
    },
    [taskId, fire],
  );

  return { complete, isPending, error };
}
