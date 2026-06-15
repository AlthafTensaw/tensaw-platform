/**
 * AMReviewForm — task_type='am_review'
 *
 * Schema (AMReviewFactsSchema):
 *   {
 *     final_decision: 'approve' | 'escalate' | 'close',
 *     escalation_note: string | null
 *   }
 *
 * Manager-level sign-off step. 'approve' → workflow continues; 'escalate' →
 * routes to senior review (requires note); 'close' → terminal close-out.
 *
 * Drop-in path: src/components/task-form/AMReviewForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, Textarea, RouteGrid } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface AMReviewFormProps {
  case: CaseDetail;
  task: EngineTask;
}

type FinalDecision = 'approve' | 'escalate' | 'close';

const DECISION_OPTIONS: { value: FinalDecision; label: string; description: string; icon: string }[] = [
  {
    value: 'approve',
    label: 'Approve',
    description: 'Resolution looks correct; continue workflow to posting',
    icon: '✓',
  },
  {
    value: 'escalate',
    label: 'Escalate',
    description: 'Needs senior review (note required)',
    icon: '↑',
  },
  {
    value: 'close',
    label: 'Close',
    description: 'No further action; close the case as-is (write-off or accept loss)',
    icon: '⊘',
  },
];

export function AMReviewForm({
  case: c,
  task,
}: AMReviewFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [finalDecision, setFinalDecision] = useState<FinalDecision | null>(null);
  const [escalationNote, setEscalationNote] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Escalation requires a note
  const canSubmit =
    finalDecision === 'approve' ||
    finalDecision === 'close' ||
    (finalDecision === 'escalate' && escalationNote.trim() !== '');

  const submit = useCallback(async () => {
    setSubmitError(null);
    if (finalDecision === null) {
      setSubmitError('Pick a decision.');
      return;
    }
    if (finalDecision === 'escalate' && escalationNote.trim() === '') {
      setSubmitError('Escalation requires a note explaining why.');
      return;
    }
    try {
      await complete(
        'SUCCESS',
        {
          final_decision: finalDecision,
          escalation_note: escalationNote.trim() !== '' ? escalationNote.trim() : null,
        },
        finalDecision === 'escalate'
          ? `Escalated by AM: ${escalationNote.trim()}`
          : `AM decision: ${finalDecision}`,
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
    }
  }, [finalDecision, escalationNote, complete]);

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              AM review · manager sign-off
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Final decision on resolution for claim {c.claim_id} ({c.patient_name ?? 'patient'}).
            </p>
          </header>

          <FormField
            id="final-decision"
            label="Decision"
            required
          >
            <RouteGrid<FinalDecision>
              name="Decision"
              value={finalDecision}
              onChange={setFinalDecision}
              options={DECISION_OPTIONS}
              columns={1}
              disabled={isPending}
            />
          </FormField>

          {finalDecision === 'escalate' && (
            <FormField
              id="escalation-note"
              label="Escalation note"
              required
              hint="Required. Explain what needs senior review."
            >
              <Textarea
                id="escalation-note"
                value={escalationNote}
                onChange={setEscalationNote}
                rows={4}
                placeholder="e.g. Payer's denial cites coverage exclusion not documented in policy. Recommend legal review before refile."
                disabled={isPending}
                describedBy="escalation-note-hint"
              />
            </FormField>
          )}

          {displayError !== null && (
            <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {displayError}
            </div>
          )}
        </section>
      </div>

      <OutcomeActionBar
        successLabel="Submit decision"
        onSuccess={submit}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
