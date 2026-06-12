/**
 * PortalStatusCheckForm — task_type='portal_status_check'
 *
 * Schema (PortalStatusCheckFactsSchema):
 *   {
 *     portal_status: string,
 *     reference_number: string | null,
 *     screenshot_attached: boolean
 *   }
 *
 * Drop-in path: src/components/task-form/PortalStatusCheckForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, Input, Textarea, SegmentedControl } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface PortalStatusCheckFormProps {
  case: CaseDetail;
  task: EngineTask;
}

export function PortalStatusCheckForm({
  case: c,
  task,
}: PortalStatusCheckFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [portalStatus, setPortalStatus] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [screenshotAttached, setScreenshotAttached] = useState<'no' | 'yes'>('no');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = portalStatus.trim() !== '';

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      if (!canSubmit) {
        setSubmitError('Portal status is required.');
        return;
      }
      try {
        await complete(
          outcome,
          {
            portal_status: portalStatus.trim(),
            reference_number: referenceNumber.trim() !== '' ? referenceNumber.trim() : null,
            screenshot_attached: screenshotAttached === 'yes',
          },
          `Portal check: ${portalStatus.trim().slice(0, 80)}`,
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [canSubmit, portalStatus, referenceNumber, screenshotAttached, complete],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Portal status check
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Record the claim status from {c.primary_payer_alias ?? c.primary_payer_name ?? "the payer"}'s portal for claim {c.claim_id}.
            </p>
          </header>

          <FormField
            id="portal-status"
            label="Portal status"
            required
            hint="What the portal shows for this claim. Free text."
          >
            <Textarea
              id="portal-status"
              value={portalStatus}
              onChange={setPortalStatus}
              rows={3}
              placeholder="e.g. Claim shown as 'Denied — medical necessity'. No clinical notes uploaded. Re-submission window closes 09/15."
              disabled={isPending}
              describedBy="portal-status-hint"
            />
          </FormField>

          <FormField
            id="portal-reference"
            label="Reference number"
            hint="Optional. Portal tracking ID if shown."
          >
            <Input
              id="portal-reference"
              value={referenceNumber}
              onChange={setReferenceNumber}
              placeholder="e.g. P-2026-00712"
              disabled={isPending}
              describedBy="portal-reference-hint"
            />
          </FormField>

          <FormField
            id="screenshot-attached"
            label="Screenshot attached?"
            hint="Uploaded a screenshot to the Files tab?"
          >
            <SegmentedControl<'no' | 'yes'>
              name="Screenshot attached"
              value={screenshotAttached}
              onChange={setScreenshotAttached}
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
        successLabel="Log check"
        onSuccess={() => submit('SUCCESS')}
        needsInfoLabel="Portal unavailable"
        onNeedsInfo={() => submit('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
