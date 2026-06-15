/**
 * AwaitingPayerCheckForm — task_type='awaiting_payer_check'
 *
 * Schema (AwaitingPayerCheckFactsSchema):
 *   {
 *     response_received: boolean,
 *     response_details: string | null
 *   }
 *
 * The "have they responded yet?" task. Periodic check after a resolution
 * action was submitted. If response received → mark complete → workflow
 * advances. If not → NEEDS_INFO → engine spawns the task again in N days.
 *
 * Drop-in path: src/components/task-form/AwaitingPayerCheckForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, Textarea, SegmentedControl } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface AwaitingPayerCheckFormProps {
  case: CaseDetail;
  task: EngineTask;
}

export function AwaitingPayerCheckForm({
  case: c,
  task,
}: AwaitingPayerCheckFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [responseReceived, setResponseReceived] = useState<'no' | 'yes' | null>(null);
  const [responseDetails, setResponseDetails] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // If response_received=yes, details should be filled. If no, details can be empty.
  const canSubmit =
    responseReceived === 'yes' && responseDetails.trim() !== '' ||
    responseReceived === 'no';

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      if (responseReceived === null) {
        setSubmitError('Indicate whether the payer responded.');
        return;
      }
      try {
        await complete(
          outcome,
          {
            response_received: responseReceived === 'yes',
            response_details: responseReceived === 'yes' && responseDetails.trim() !== ''
              ? responseDetails.trim()
              : null,
          },
          responseReceived === 'yes'
            ? `Payer responded: ${responseDetails.trim().slice(0, 80)}`
            : 'No response yet from payer',
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [responseReceived, responseDetails, complete],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Awaiting payer response
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Has {c.primary_payer_alias ?? "the payer"} responded to the submission on claim {c.claim_id} yet?
            </p>
          </header>

          <FormField
            id="response-received"
            label="Response received?"
            required
          >
            <SegmentedControl<'no' | 'yes'>
              name="Response received"
              value={responseReceived}
              onChange={setResponseReceived}
              options={[
                { value: 'no', label: 'Not yet' },
                { value: 'yes', label: 'Yes, received' },
              ]}
              disabled={isPending}
            />
          </FormField>

          {responseReceived === 'yes' && (
            <FormField
              id="response-details"
              label="Response details"
              required
              hint="What the payer's response says (approval, partial pay, denial reason, etc.)."
            >
              <Textarea
                id="response-details"
                value={responseDetails}
                onChange={setResponseDetails}
                rows={4}
                placeholder="e.g. Appeal approved at 80% of billed; payment of $920 expected within 14 days."
                disabled={isPending}
                describedBy="response-details-hint"
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
        successLabel={responseReceived === 'yes' ? 'Continue workflow' : 'Re-check later'}
        onSuccess={() => submit(responseReceived === 'yes' ? 'SUCCESS' : 'NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
