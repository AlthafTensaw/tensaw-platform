/**
 * PostingApplyForm — task_type='posting_apply'
 *
 * Schema (PostingApplyFactsSchema):
 *   { posting_confirmed: boolean }
 *
 * Single-field form. SUCCESS only when posting_confirmed=true.
 *
 * Drop-in path: src/components/task-form/PostingApplyForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, SegmentedControl } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';
import { formatCurrency } from '../../utils/formatters';

export interface PostingApplyFormProps {
  case: CaseDetail;
  task: EngineTask;
}

export function PostingApplyForm({
  case: c,
  task,
}: PostingApplyFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [postingConfirmed, setPostingConfirmed] = useState<'no' | 'yes'>('no');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = postingConfirmed === 'yes';

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      try {
        await complete(
          outcome,
          { posting_confirmed: postingConfirmed === 'yes' },
          outcome === 'SUCCESS'
            ? `Payment posted to ledger for case ${c.case_id}`
            : 'Posting not yet confirmed; needs investigation',
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [postingConfirmed, complete, c.case_id],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Posting
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Confirm the payment of {formatCurrency(c.paid_primary + c.paid_patient)} was applied to the ledger for claim {c.claim_id}.
            </p>
          </header>

          <FormField
            id="posting-confirmed"
            label="Payment applied?"
            required
            hint="Confirms the remit was posted to the patient's account in the AR system."
          >
            <SegmentedControl<'no' | 'yes'>
              name="Payment applied"
              value={postingConfirmed}
              onChange={setPostingConfirmed}
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes, applied' },
              ]}
              disabled={isPending}
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
        successLabel="Mark posted"
        onSuccess={() => submit('SUCCESS')}
        needsInfoLabel="Can't confirm"
        onNeedsInfo={() => submit('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
