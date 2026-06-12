/**
 * PayerCallForm — task_type='payer_call'
 *
 * Schema (PayerCallFactsSchema):
 *   {
 *     call_reference_number: string,
 *     payer_status: string,
 *     callback_required: boolean
 *   }
 *
 * Completed after phoning the payer. Records the call reference, what the
 * payer said about the claim status, and whether they promised a callback.
 *
 * Drop-in path: src/components/task-form/PayerCallForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, Input, Textarea, SegmentedControl } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface PayerCallFormProps {
  case: CaseDetail;
  task: EngineTask;
}

export function PayerCallForm({
  case: c,
  task,
}: PayerCallFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [callReference, setCallReference] = useState('');
  const [payerStatus, setPayerStatus] = useState('');
  const [callbackRequired, setCallbackRequired] = useState<'no' | 'yes'>('no');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = callReference.trim() !== '' && payerStatus.trim() !== '';

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      if (!canSubmit) {
        setSubmitError('Reference number and payer status are required.');
        return;
      }
      try {
        await complete(
          outcome,
          {
            call_reference_number: callReference.trim(),
            payer_status: payerStatus.trim(),
            callback_required: callbackRequired === 'yes',
          },
          callbackRequired === 'yes'
            ? `Payer call · ref ${callReference.trim()} · awaiting callback`
            : `Payer call · ref ${callReference.trim()}`,
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [canSubmit, callReference, payerStatus, callbackRequired, complete],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Payer call
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Record the call to {c.primary_payer_alias ?? c.primary_payer_name ?? 'the payer'} for claim {c.claim_id}.
            </p>
          </header>

          <FormField
            id="call-reference"
            label="Call reference number"
            required
            hint="The reference / case number the payer's rep gave you."
          >
            <Input
              id="call-reference"
              value={callReference}
              onChange={setCallReference}
              placeholder="e.g. REF-2026-0061204"
              disabled={isPending}
              describedBy="call-reference-hint"
            />
          </FormField>

          <FormField
            id="payer-status"
            label="What the payer said"
            required
            hint="The status they reported. Free text."
          >
            <Textarea
              id="payer-status"
              value={payerStatus}
              onChange={setPayerStatus}
              rows={3}
              placeholder="e.g. Denial code CO-50 confirmed; payer requesting clinical notes for medical necessity review. Allow 30-45 days for response."
              disabled={isPending}
              describedBy="payer-status-hint"
            />
          </FormField>

          <FormField
            id="callback-required"
            label="Callback required?"
            hint="Did the payer say they'd call back?"
          >
            <SegmentedControl<'no' | 'yes'>
              name="Callback required"
              value={callbackRequired}
              onChange={setCallbackRequired}
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
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
        successLabel="Log call"
        onSuccess={() => submit('SUCCESS')}
        needsInfoLabel="Couldn't reach"
        onNeedsInfo={() => submit('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
