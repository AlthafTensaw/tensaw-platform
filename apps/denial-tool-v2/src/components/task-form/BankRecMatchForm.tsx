/**
 * BankRecMatchForm — task_type='bank_rec_match'
 *
 * Schema (BankRecMatchFactsSchema):
 *   { match_confirmed: boolean }
 *
 * Drop-in path: src/components/task-form/BankRecMatchForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, SegmentedControl } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface BankRecMatchFormProps {
  case: CaseDetail;
  task: EngineTask;
}

export function BankRecMatchForm({
  case: c,
  task,
}: BankRecMatchFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [matchConfirmed, setMatchConfirmed] = useState<'no' | 'yes'>('no');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = matchConfirmed === 'yes';

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      try {
        await complete(
          outcome,
          { match_confirmed: matchConfirmed === 'yes' },
          outcome === 'SUCCESS'
            ? 'Bank deposit matched to remit; reconciliation complete'
            : 'Match not confirmed; discrepancy needs investigation',
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [matchConfirmed, complete],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Bank reconciliation match
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Confirm the bank deposit matches the expected remit for claim {c.claim_id}.
            </p>
          </header>

          <FormField
            id="match-confirmed"
            label="Match confirmed?"
            required
            hint="Bank deposit amount equals the expected remit amount."
          >
            <SegmentedControl<'no' | 'yes'>
              name="Match confirmed"
              value={matchConfirmed}
              onChange={setMatchConfirmed}
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes, matches' },
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
        successLabel="Confirm match"
        onSuccess={() => submit('SUCCESS')}
        needsInfoLabel="Investigate discrepancy"
        onNeedsInfo={() => submit('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
