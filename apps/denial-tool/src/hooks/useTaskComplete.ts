/**
 * useTaskComplete — hook wrapping the task.complete mutation.
 *
 * Each task form calls this to fire complete with outcome + facts + note.
 * Centralizes the case_id / task_id wiring so individual forms don't repeat
 * the boilerplate.
 *
 * The `facts` parameter is typed as Record<string, unknown> — strict
 * per-task-type validation (TaskFacts<T>) belongs in the concrete form
 * components before they call into this hook.
 *
 * Drop-in path: src/hooks/useTaskComplete.ts
 */

import { useCallback } from 'react';
import { useActionMutation } from '@tensaw/actions';
import type {
  CaseDetail,
  EngineTask,
  HandlerOutcome,
} from '../actions/schemas-v4';

export interface UseTaskCompleteResult {
  /** Fire task.complete with these args. Throws on error. */
  complete: (
    outcome: HandlerOutcome,
    facts: Record<string, unknown>,
    completionNote?: string,
  ) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

export function useTaskComplete(
  caseDetail: CaseDetail,
  task: EngineTask,
): UseTaskCompleteResult {
  // Real @tensaw/actions returns [fire, { data, isLoading, error, reset }]
  // The stub API used isPending; the real API uses isLoading.
  const [fire, { isLoading, error: actionError }] = useActionMutation('task.complete');

  const complete = useCallback(
    async (
      outcome: HandlerOutcome,
      facts: Record<string, unknown>,
      completionNote?: string,
    ) => {
      await fire({
        case_id: caseDetail.case_id,
        task_id: task.task_id,
        outcome,
        facts_to_set: facts,
        ...(completionNote !== undefined && completionNote.trim() !== ''
          ? { completion_note: completionNote.trim() }
          : {}),
      });
    },
    [caseDetail.case_id, task.task_id, fire],
  );

  // Map ActionError to Error for consumers
  const error: Error | null = actionError !== null
    ? new Error(actionError.message ?? 'Task complete failed')
    : null;

  return { complete, isPending: isLoading, error };
}
