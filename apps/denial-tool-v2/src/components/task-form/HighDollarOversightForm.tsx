/**
 * HighDollarOversightForm — task_type='high_dollar_oversight'
 *
 * Schema (HighDollarOversightFactsSchema):
 *   {
 *     reviewed_at: datetime string,
 *     oversight_note: string | null
 *   }
 *
 * Sidecar task on HD cases (≥$750 pending). Manager confirms they've
 * reviewed the high-dollar case. reviewed_at auto-fills with submit time.
 *
 * Drop-in path: src/components/task-form/HighDollarOversightForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, Textarea } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';
import { formatCurrency } from '../../utils/formatters';

export interface HighDollarOversightFormProps {
  case: CaseDetail;
  task: EngineTask;
}

export function HighDollarOversightForm({
  case: c,
  task,
}: HighDollarOversightFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);
  const [oversightNote, setOversightNote] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setSubmitError(null);
    try {
      await complete(
        'SUCCESS',
        {
          reviewed_at: new Date().toISOString(),
          oversight_note: oversightNote.trim() !== '' ? oversightNote.trim() : null,
        },
        oversightNote.trim() !== ''
          ? `HD oversight: ${oversightNote.trim().slice(0, 80)}`
          : 'HD oversight signed off',
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
    }
  }, [oversightNote, complete]);

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-amber-300 bg-amber-50/40 p-5">
          <header>
            <div className="flex items-center gap-2 mb-1">
              <span
                title="High-dollar case"
                className="
                  inline-flex items-center rounded border border-amber-300 bg-amber-100
                  px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-900
                "
              >
                HD
              </span>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                High-dollar oversight
              </h3>
            </div>
            <p className="text-[12.5px] text-slate-700">
              Confirm you've reviewed this high-dollar case ({formatCurrency(c.net_pending)} pending on claim {c.claim_id}).
            </p>
          </header>

          <FormField
            id="oversight-note"
            label="Oversight note"
            hint="Optional. Anything worth recording for the audit trail."
          >
            <Textarea
              id="oversight-note"
              value={oversightNote}
              onChange={setOversightNote}
              rows={4}
              placeholder="e.g. Reviewed; appeal looks well-supported. Notes in Files tab."
              disabled={isPending}
              describedBy="oversight-note-hint"
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
        successLabel="Sign off"
        onSuccess={submit}
        isPending={isPending}
        canSubmitSuccess={true}
      />
    </div>
  );
}
