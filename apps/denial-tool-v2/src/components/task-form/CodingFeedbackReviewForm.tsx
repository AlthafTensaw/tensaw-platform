/**
 * CodingFeedbackReviewForm — task_type='coding_feedback_review'
 *
 * Schema (CodingFeedbackReviewFactsSchema):
 *   { selected_action: 'proceed' | 'dispute' | 'reroute' }
 *
 * Shown on the originator's personal queue after the coding partner finishes
 * reviewing. The originator decides what to do with coding's verdict.
 *
 * Drop-in path: src/components/task-form/CodingFeedbackReviewForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, RouteGrid, Textarea } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface CodingFeedbackReviewFormProps {
  case: CaseDetail;
  task: EngineTask;
}

type FeedbackAction = 'proceed' | 'dispute' | 'reroute';

const ACTION_OPTIONS: { value: FeedbackAction; label: string; description: string; icon: string }[] = [
  {
    value: 'proceed',
    label: 'Proceed',
    description: "Coding's verdict is right — move forward with their recommendation",
    icon: '✓',
  },
  {
    value: 'dispute',
    label: 'Dispute',
    description: 'Disagree with coding; escalate or kick back for re-review',
    icon: '↯',
  },
  {
    value: 'reroute',
    label: 'Re-route',
    description: 'Send elsewhere (e.g. straight to payer call instead)',
    icon: '↪',
  },
];

export function CodingFeedbackReviewForm({
  case: c,
  task,
}: CodingFeedbackReviewFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [selectedAction, setSelectedAction] = useState<FeedbackAction | null>(null);
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = selectedAction !== null;

  const submit = useCallback(
    async (outcome: 'SUCCESS') => {
      setSubmitError(null);
      if (selectedAction === null) {
        setSubmitError('Pick an action.');
        return;
      }
      try {
        await complete(
          outcome,
          { selected_action: selectedAction },
          notes.trim() !== '' ? notes.trim() : `Action: ${selectedAction}`,
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [selectedAction, notes, complete],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Coding feedback review
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              The coding partner has finished reviewing this case. Decide
              how to proceed with their verdict.
            </p>
          </header>

          <FormField
            id="feedback-action"
            label="Your decision"
            required
          >
            <RouteGrid<FeedbackAction>
              name="Decision"
              value={selectedAction}
              onChange={setSelectedAction}
              options={ACTION_OPTIONS}
              columns={1}
              disabled={isPending}
            />
          </FormField>

          <FormField
            id="feedback-notes"
            label="Notes"
            hint="Optional. Add context for whoever picks this up next."
          >
            <Textarea
              id="feedback-notes"
              value={notes}
              onChange={setNotes}
              rows={3}
              placeholder="e.g. Coding flagged modifier 25; appeal letter ready to draft."
              disabled={isPending}
              describedBy="feedback-notes-hint"
            />
          </FormField>

          {displayError !== null && (
            <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {displayError}
            </div>
          )}
        </section>
      </div>

      <OutcomeActionBar
        successLabel="Submit decision"
        onSuccess={() => submit('SUCCESS')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
