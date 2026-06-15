/**
 * GenericTaskForm (v4.1) — the baseline completion form.
 *
 * Renders a completion-note field + the (reused) OutcomeActionBar wired to
 * worklist.complete via useTaskComplete. Sends an empty facts_to_set.
 *
 * Role in the rework:
 *   - R7: CurrentTaskBlock renders THIS for every task_type so the work area is
 *     functional end-to-end (you can complete any task generically).
 *   - R8: typed per-task-type forms replace it for the 17 types; this remains
 *     as GenericTaskFallback for any unmapped/unknown type.
 *
 * Drop-in path: src/components/task-form/GenericTaskForm.tsx
 */

import { useState } from 'react';
import type { WorklistTask } from '../../actions/schemas';
import { TASK_TYPE_LABELS, taskHint } from '../../lib/labels';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface GenericTaskFormProps {
  task: WorklistTask;
  /** Called after a successful completion (parent refetches / advances). */
  onCompleted?: () => void;
  /** Allow the destructive FAIL_FATAL outcome (default true). */
  allowFailFatal?: boolean;
}

export function GenericTaskForm({
  task,
  onCompleted,
  allowFailFatal = true,
}: GenericTaskFormProps): React.ReactElement {
  const { complete, isPending } = useTaskComplete(task.task_id);
  const [note, setNote] = useState('');

  async function fire(outcome: 'SUCCESS' | 'NEEDS_INFO' | 'FAIL_FATAL'): Promise<void> {
    await complete(outcome, {}, note);
    onCompleted?.();
  }

  return (
    <div>
      <div className="px-6 py-4">
        <div className="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Current task</div>
            <div className="mt-0.5 text-[14px] font-semibold text-slate-900">
              {TASK_TYPE_LABELS[task.task_type]}
            </div>
          </div>
          <div className="text-right font-mono text-[10.5px] text-slate-500">{task.task_id}</div>
        </div>

        <p className="mt-3 text-[12.5px] text-slate-600">{taskHint(task.task_type)}</p>

        <div className="mt-3">
          <label
            htmlFor="completion-note"
            className="mb-1 block text-[11.5px] font-medium text-slate-700"
          >
            Completion note
          </label>
          <textarea
            id="completion-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you did / what the next handler should know"
            className="block w-full rounded border border-slate-300 px-2.5 py-1.5 text-[12.5px] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
      </div>

      <OutcomeActionBar
        successLabel="Complete task"
        onSuccess={() => void fire('SUCCESS')}
        isPending={isPending}
        canSubmitSuccess
        needsInfoLabel="Need more info"
        onNeedsInfo={() => void fire('NEEDS_INFO')}
        {...(allowFailFatal
          ? { failFatalLabel: 'Fail (terminal)', onFailFatal: () => void fire('FAIL_FATAL') }
          : {})}
      />
    </div>
  );
}
