/**
 * IntakeTriageForm — the first concrete task form (intake_triage task type).
 *
 * Schema (from schemas-v4 IntakeTriageFactsSchema):
 *   {
 *     triage_category: string         (pre-filled from LLM recommendation)
 *     priority:        'low'|'normal'|'high'  (defaults to 'normal')
 *     triage_route:    'resolution'|'coding_partner'|'payer_call'|'portal_check'
 *     triage_notes:    string (optional)
 *   }
 *
 * This is the ANCHOR pattern for the other 10 task forms (P1.10) — they all
 * follow the same shape: FormField primitives + OutcomeActionBar + useTaskComplete.
 *
 * Drop-in path: src/components/task-form/IntakeTriageForm.tsx
 */

import { useState, useCallback } from 'react';
import { useActionQuery } from '@tensaw/actions';
import type { CaseDetail, EngineTask, PriorityCode } from '../../actions/schemas-v4';
import type { CategoriesResponse } from '../../actions/schemas-v4-tabs';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import {
  FormField,
  Select,
  SegmentedControl,
  RouteGrid,
  Textarea,
} from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface IntakeTriageFormProps {
  case: CaseDetail;
  task: EngineTask;
}

type TriageRoute = 'resolution' | 'coding_partner' | 'direct_appeal' | 'other';

const ROUTE_OPTIONS: { value: TriageRoute; label: string; description: string; icon: string }[] = [
  {
    value: 'resolution',
    label: 'Resolution',
    description: 'Records on hand; ready to draft appeal',
    icon: '📝',
  },
  {
    value: 'coding_partner',
    label: 'Coding partner',
    description: 'CPT / dx / modifier needs review',
    icon: '🔢',
  },
  {
    value: 'direct_appeal',
    label: 'Direct appeal',
    description: 'Straightforward — skip resolution, draft now',
    icon: '⚡',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Payer call, portal check, or unusual route',
    icon: '⚙',
  },
];

const PRIORITY_OPTIONS: { value: PriorityCode; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

export function IntakeTriageForm({
  case: c,
  task,
}: IntakeTriageFormProps): React.ReactElement {
  const { data: catData } = useActionQuery<CategoriesResponse>('category.list', {});
  const { complete, isPending, error: mutationError } = useTaskComplete(c, task);

  // State — initialize from LLM recommendation where possible
  const [triageCategory, setTriageCategory] = useState<string>(
    c.recommended_category ?? '',
  );
  const [priority, setPriority] = useState<PriorityCode>('normal');
  const [triageRoute, setTriageRoute] = useState<TriageRoute | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = triageCategory !== '' && triageRoute !== null;

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      if (!canSubmit) {
        setSubmitError('Pick a category and a route before submitting.');
        return;
      }
      const facts = {
        triage_category: triageCategory,
        priority,
        // canSubmit ensures triageRoute is non-null
        triage_route: triageRoute as TriageRoute,
      };
      // SUCCESS: routes per triage_route. NEEDS_INFO: typically branches to
      // payer_call regardless; the engine handles routing.
      const baseCompletionNote =
        outcome === 'SUCCESS'
          ? `Routed to ${triageRoute}`
          : 'Need more info before routing';
      // Append user's notes to the completion note (the schema doesn't carry
      // them in facts).
      const completionNote = notes.trim() !== ''
        ? `${baseCompletionNote} — ${notes.trim()}`
        : baseCompletionNote;
      try {
        await complete(outcome, facts, completionNote);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [canSubmit, triageCategory, priority, triageRoute, notes, complete],
  );

  const handleSuccess = useCallback(() => submit('SUCCESS'), [submit]);
  const handleNeedsInfo = useCallback(() => submit('NEEDS_INFO'), [submit]);

  // Category options for the dropdown
  const categoryOptions =
    (catData?.categories ?? []).map((c2) => ({
      value: c2.code,
      label: c2.label,
    }));

  const displayError = submitError ?? mutationError?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section
          aria-labelledby="task-form-heading"
          className="space-y-5 rounded-lg border-2 border-blue-300 bg-white p-5"
        >
          <header>
            <h3 id="task-form-heading" className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Intake triage
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Confirm the LLM's category, set priority, and choose how this denial
              should be routed for resolution.
            </p>
          </header>

          {/* Category */}
          <FormField
            id="triage-category"
            label="Category"
            required
            hint="The LLM picked this — confirm or change if it's wrong."
          >
            <Select
              id="triage-category"
              value={triageCategory}
              onChange={setTriageCategory}
              options={categoryOptions}
              placeholder="Pick a category…"
              disabled={isPending}
              describedBy="triage-category-hint"
            />
          </FormField>

          {/* Priority */}
          <FormField
            id="triage-priority"
            label="Priority"
            required
          >
            <SegmentedControl<PriorityCode>
              name="Priority"
              value={priority}
              onChange={setPriority}
              options={PRIORITY_OPTIONS}
              disabled={isPending}
            />
          </FormField>

          {/* Route */}
          <FormField
            id="triage-route"
            label="Route to"
            required
            hint="Where this case goes after triage."
          >
            <RouteGrid<TriageRoute>
              name="Route"
              value={triageRoute}
              onChange={setTriageRoute}
              options={ROUTE_OPTIONS}
              columns={2}
              disabled={isPending}
            />
          </FormField>

          {/* Notes */}
          <FormField
            id="triage-notes"
            label="Notes"
            hint="Optional. Written to the case audit log along with your username."
          >
            <Textarea
              id="triage-notes"
              value={notes}
              onChange={setNotes}
              rows={3}
              placeholder="Anything the next worker should know…"
              disabled={isPending}
              describedBy="triage-notes-hint"
            />
          </FormField>

          {displayError !== null && (
            <div
              role="alert"
              className="
                rounded border border-red-200 bg-red-50 px-3 py-2
                text-[12px] text-red-800
              "
            >
              {displayError}
            </div>
          )}
        </section>
      </div>

      <OutcomeActionBar
        successLabel="Complete triage"
        onSuccess={handleSuccess}
        needsInfoLabel="Needs more info"
        onNeedsInfo={handleNeedsInfo}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
