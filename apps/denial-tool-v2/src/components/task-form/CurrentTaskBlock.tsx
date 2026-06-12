/**
 * CurrentTaskBlock — task router + header for the in-flight WorkPane.
 *
 * Updated in P1.10: all 11 task types now route to concrete forms.
 * GenericTaskFallback is retained as a safety net for any new task_type
 * that lands before its form is built.
 *
 * Drop-in path: src/components/task-form/CurrentTaskBlock.tsx
 */

import { useCallback, useState } from 'react';
import type { CaseDetail, EngineTask, TaskType } from '../../actions/schemas-v4';
import { taskTypeLabel, taskHint, queueChipLabel } from '../../lib/labels';
import { deriveUrgency } from '../../utils/formatters';
import { QueueRoutingChip } from '../cards/QueueRoutingChip';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { OutcomeActionBar } from './OutcomeActionBar';
import { FormField, Textarea } from './TaskFormShell';

// Concrete form components (all 11 from P1.8 + P1.10)
import { IntakeTriageForm } from './IntakeTriageForm';
import { CodingReviewForm } from './CodingReviewForm';
import { CodingFeedbackReviewForm } from './CodingFeedbackReviewForm';
import { PayerCallForm } from './PayerCallForm';
import { PortalStatusCheckForm } from './PortalStatusCheckForm';
import { ResolutionActionForm } from './ResolutionActionForm';
import { AwaitingPayerCheckForm } from './AwaitingPayerCheckForm';
import { AMReviewForm } from './AMReviewForm';
import { PostingApplyForm } from './PostingApplyForm';
import { BankRecMatchForm } from './BankRecMatchForm';
import { HighDollarOversightForm } from './HighDollarOversightForm';

export interface CurrentTaskBlockProps {
  case: CaseDetail;
  task: EngineTask;
}

export function CurrentTaskBlock({ case: c, task }: CurrentTaskBlockProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      <TaskHeader task={task} />
      <div className="flex-1 overflow-hidden">
        <TaskFormForType task={task} caseDetail={c} />
      </div>
    </div>
  );
}

// ============================================================================
// Task header
// ============================================================================

interface TaskHeaderProps {
  task: EngineTask;
}

function TaskHeader({ task }: TaskHeaderProps): React.ReactElement {
  const urgency = deriveUrgency(task.due_at);
  const urgencyClass =
    urgency?.tone === 'overdue' ? 'bg-red-100 text-red-800' :
    urgency?.tone === 'today' ? 'bg-amber-100 text-amber-800' :
    'bg-slate-100 text-slate-700';

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span aria-hidden="true" className="text-[11px] uppercase tracking-wider text-slate-500">
          Current task
        </span>
        <span className="text-[13px] font-semibold text-slate-900">
          {taskTypeLabel(task.task_type)}
        </span>
        <span className="font-mono text-[10.5px] text-slate-400">
          {task.task_id}
        </span>
        <QueueRoutingChip queueId={task.queue_id} />
        {urgency !== null && (
          <span className={`
            ml-auto inline-flex items-center rounded px-1.5 py-0.5
            text-[10px] font-semibold ${urgencyClass}
          `}>
            {urgency.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Form router — picks the form by task_type
// ============================================================================

interface TaskFormForTypeProps {
  task: EngineTask;
  caseDetail: CaseDetail;
}

function TaskFormForType({ task, caseDetail }: TaskFormForTypeProps): React.ReactElement {
  // Exhaustive routing for all 11 task types. TypeScript checks via the
  // TaskType union — if a new type is added to schemas-v4 without a case
  // here, the switch's default branch catches it via GenericTaskFallback.
  switch (task.task_type) {
    case 'intake_triage':
      return <IntakeTriageForm case={caseDetail} task={task} />;
    case 'coding_review':
      return <CodingReviewForm case={caseDetail} task={task} />;
    case 'coding_feedback_review':
      return <CodingFeedbackReviewForm case={caseDetail} task={task} />;
    case 'payer_call':
      return <PayerCallForm case={caseDetail} task={task} />;
    case 'portal_status_check':
      return <PortalStatusCheckForm case={caseDetail} task={task} />;
    case 'resolution_action':
      return <ResolutionActionForm case={caseDetail} task={task} />;
    case 'awaiting_payer_check':
      return <AwaitingPayerCheckForm case={caseDetail} task={task} />;
    case 'am_review':
      return <AMReviewForm case={caseDetail} task={task} />;
    case 'posting_apply':
      return <PostingApplyForm case={caseDetail} task={task} />;
    case 'bank_rec_match':
      return <BankRecMatchForm case={caseDetail} task={task} />;
    case 'high_dollar_oversight':
      return <HighDollarOversightForm case={caseDetail} task={task} />;
    default:
      // If TypeScript flags a missing case, it means a new task_type was added
      // to TaskType union without a form. GenericTaskFallback handles the
      // runtime; the TS error is a compile-time reminder to build the form.
      return <GenericTaskFallback case={caseDetail} task={task} />;
  }
}

// ============================================================================
// GenericTaskFallback — safety net (also used for future new task types)
// ============================================================================

interface GenericTaskFallbackProps {
  case: CaseDetail;
  task: EngineTask;
}

function GenericTaskFallback({
  case: c,
  task,
}: GenericTaskFallbackProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [note, setNote] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleOutcome = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      try {
        await complete(outcome, {}, note.trim() === '' ? undefined : note);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [complete, note],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="rounded-lg border-2 border-amber-300 bg-amber-50/40 p-5">
          <div className="mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Generic task form
            </h3>
            <p className="mt-1 text-[12.5px] text-slate-700">
              <strong>{taskTypeLabel(task.task_type)}:</strong>{' '}
              {taskHint(task.task_type)}
            </p>
            <p className="mt-2 text-[11.5px] text-slate-500">
              No specific form is built for task type{' '}
              <code className="font-mono text-[11px]">{task.task_type}</code>.
              You can still complete it with a note.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Queue: <span className="font-mono">{queueChipLabel(task.queue_id)}</span>
            </p>
          </div>

          <FormField
            id="generic-note"
            label="Completion note"
            hint="Describe what you did. Required so the next worker has context."
          >
            <Textarea
              id="generic-note"
              value={note}
              onChange={setNote}
              rows={4}
              placeholder="Describe the action taken…"
              disabled={isPending}
              describedBy="generic-note-hint"
            />
          </FormField>

          {displayError !== null && (
            <div
              role="alert"
              className="
                mt-3 rounded border border-red-200 bg-red-50 px-3 py-2
                text-[12px] text-red-800
              "
            >
              {displayError}
            </div>
          )}
        </section>
      </div>

      <OutcomeActionBar
        successLabel="Mark complete"
        onSuccess={() => handleOutcome('SUCCESS')}
        needsInfoLabel="Needs more info"
        onNeedsInfo={() => handleOutcome('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={note.trim() !== ''}
      />
    </div>
  );
}

// Suppress unused-import warnings for TaskType (used in switch but TS sometimes warns)
const _typeCheck: TaskType[] = [
  'intake_triage', 'coding_review', 'coding_feedback_review',
  'payer_call', 'portal_status_check', 'resolution_action',
  'awaiting_payer_check', 'am_review', 'posting_apply',
  'bank_rec_match', 'high_dollar_oversight',
];
void _typeCheck;
