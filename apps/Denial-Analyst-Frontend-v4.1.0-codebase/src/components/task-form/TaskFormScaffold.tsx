/**
 * TaskFormScaffold (v4.1) — shared wrapper for the 17 completion forms.
 *
 * Owns the common structure + wiring so each concrete form only declares its
 * fields + how to assemble facts_to_set:
 *   - task header (type label + id)
 *   - intro line
 *   - the form's fields (children)
 *   - a completion-note textarea
 *   - the reused OutcomeActionBar, wired to worklist.complete
 *
 * Two form shapes are supported:
 *   - Action forms:   primaryOutcome = 'SUCCESS', plus optional NEEDS_INFO /
 *     FAIL_FATAL escape buttons.
 *   - Decision forms: the analyst's field choice maps to primaryOutcome (e.g.
 *     AWAIT_PAYER → paid=SUCCESS / waiting=NEEDS_INFO / denied=FAIL_FATAL); the
 *     single primary button sends that outcome.
 *
 * facts_to_set comes from getFacts() and is sent on every outcome (harmless for
 * NEEDS_INFO/FAIL_FATAL; the engine only consumes what its workflow defines).
 *
 * Drop-in path: src/components/task-form/TaskFormScaffold.tsx
 */

import { useState, type ReactNode } from 'react';
import type { WorklistTask, HandlerOutcome } from '../../actions/schemas';
import { TASK_TYPE_LABELS } from '../../lib/labels';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { OutcomeActionBar } from './OutcomeActionBar';
import { FormField, Textarea } from './TaskFormShell';

export interface TaskFormScaffoldProps {
  task: WorklistTask;
  onCompleted?: () => void;

  /** One-line description of what the analyst is doing. */
  intro: string;
  /** The form's fields. */
  children: ReactNode;

  /** Primary button label. */
  primaryLabel: string;
  /** Outcome the primary button sends (default SUCCESS). */
  primaryOutcome?: HandlerOutcome;
  /** Validity gate for the primary button. */
  canSubmit: boolean;
  /** Build facts_to_set for submission. */
  getFacts: () => Record<string, unknown>;

  /** Show a NEEDS_INFO escape button. */
  showNeedsInfo?: boolean;
  needsInfoLabel?: string;
  /** Show a FAIL_FATAL escape button. */
  showFailFatal?: boolean;
  failFatalLabel?: string;
}

export function TaskFormScaffold({
  task,
  onCompleted,
  intro,
  children,
  primaryLabel,
  primaryOutcome = 'SUCCESS',
  canSubmit,
  getFacts,
  showNeedsInfo = false,
  needsInfoLabel = 'Need more info',
  showFailFatal = false,
  failFatalLabel = 'Fail (terminal)',
}: TaskFormScaffoldProps): React.ReactElement {
  const { complete, isPending } = useTaskComplete(task.task_id);
  const [note, setNote] = useState('');

  async function fire(outcome: HandlerOutcome): Promise<void> {
    await complete(outcome, getFacts(), note);
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

        <p className="mt-3 text-[12.5px] text-slate-600">{intro}</p>

        <div className="mt-4 space-y-4">{children}</div>

        <div className="mt-4">
          <FormField id="completion-note" label="Completion note">
            <Textarea
              id="completion-note"
              value={note}
              onChange={setNote}
              rows={2}
              placeholder="Anything the next handler should know"
            />
          </FormField>
        </div>
      </div>

      <OutcomeActionBar
        successLabel={primaryLabel}
        onSuccess={() => void fire(primaryOutcome)}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
        {...(showNeedsInfo ? { needsInfoLabel, onNeedsInfo: () => void fire('NEEDS_INFO') } : {})}
        {...(showFailFatal ? { failFatalLabel, onFailFatal: () => void fire('FAIL_FATAL') } : {})}
      />
    </div>
  );
}
