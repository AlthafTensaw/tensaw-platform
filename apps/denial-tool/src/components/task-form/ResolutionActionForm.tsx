/**
 * ResolutionActionForm — task_type='resolution_action'
 *
 * Schema (ResolutionActionFactsSchema):
 *   {
 *     action_type: 'appeal' | 'refile' | 'corrected_claim' | 'reconsideration',
 *     submitted_at: datetime string,
 *     confirmation_number: string | null
 *   }
 *
 * The analyst declares what corrective action they submitted to the payer
 * and provides a confirmation number when available.
 *
 * Drop-in path: src/components/task-form/ResolutionActionForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, Input, RouteGrid } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface ResolutionActionFormProps {
  case: CaseDetail;
  task: EngineTask;
}

type ActionType = 'appeal' | 'refile' | 'corrected_claim' | 'reconsideration';

const ACTION_OPTIONS: { value: ActionType; label: string; description: string; icon: string }[] = [
  {
    value: 'appeal',
    label: 'Appeal',
    description: 'Formal written appeal to dispute the denial',
    icon: '📨',
  },
  {
    value: 'refile',
    label: 'Refile',
    description: 'Resubmit the original claim (timing or transmission issue)',
    icon: '↻',
  },
  {
    value: 'corrected_claim',
    label: 'Corrected claim',
    description: 'Resubmit with fixes (modifier, dx, CPT)',
    icon: '✎',
  },
  {
    value: 'reconsideration',
    label: 'Reconsideration',
    description: 'Informal request to review without full appeal',
    icon: '↻',
  },
];

/** Build a datetime-local default value: YYYY-MM-DDTHH:MM */
function defaultSubmittedAt(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ResolutionActionForm({
  case: c,
  task,
}: ResolutionActionFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string>(defaultSubmittedAt);
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = actionType !== null && submittedAt !== '';

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      if (actionType === null) {
        setSubmitError('Pick an action type.');
        return;
      }
      // Convert datetime-local to ISO with seconds + Z
      const iso = new Date(submittedAt).toISOString();
      try {
        await complete(
          outcome,
          {
            action_type: actionType,
            submitted_at: iso,
            confirmation_number: confirmationNumber.trim() !== '' ? confirmationNumber.trim() : null,
          },
          `${actionType.replace('_', ' ')} submitted${confirmationNumber.trim() !== '' ? ` (conf ${confirmationNumber.trim()})` : ''}`,
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [actionType, submittedAt, confirmationNumber, complete],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Resolution action
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Record what corrective action you submitted to {c.primary_payer_alias ?? "the payer"} for claim {c.claim_id}.
            </p>
          </header>

          <FormField
            id="resolution-action-type"
            label="What did you submit?"
            required
          >
            <RouteGrid<ActionType>
              name="Action type"
              value={actionType}
              onChange={setActionType}
              options={ACTION_OPTIONS}
              columns={2}
              disabled={isPending}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="resolution-submitted-at"
              label="Submitted at"
              required
              hint="When the submission was sent."
            >
              <Input
                id="resolution-submitted-at"
                type="text"
                value={submittedAt}
                onChange={setSubmittedAt}
                disabled={isPending}
                describedBy="resolution-submitted-at-hint"
              />
            </FormField>

            <FormField
              id="resolution-confirmation"
              label="Confirmation number"
              hint="Optional. The payer's submission tracking ID."
            >
              <Input
                id="resolution-confirmation"
                value={confirmationNumber}
                onChange={setConfirmationNumber}
                placeholder="e.g. A-2026-00428"
                disabled={isPending}
                describedBy="resolution-confirmation-hint"
              />
            </FormField>
          </div>

          {displayError !== null && (
            <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {displayError}
            </div>
          )}
        </section>
      </div>

      <OutcomeActionBar
        successLabel="Mark submitted"
        onSuccess={() => submit('SUCCESS')}
        needsInfoLabel="Submission blocked"
        onNeedsInfo={() => submit('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
