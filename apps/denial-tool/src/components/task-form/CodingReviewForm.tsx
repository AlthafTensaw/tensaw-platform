/**
 * CodingReviewForm — task_type='coding_review'
 *
 * Schema (CodingReviewFactsSchema):
 *   {
 *     cpt_corrected: boolean,
 *     modifier_changed: boolean,
 *     dx_adequate: boolean,
 *     recommendation: 'proceed' | 'reject' | 'escalate'
 *   }
 *
 * Done by the coding partner. After completion, the engine routes the case
 * back to the originator's personal queue as a coding_feedback_review task.
 *
 * Drop-in path: src/components/task-form/CodingReviewForm.tsx
 */

import { useState, useCallback } from 'react';
import type { CaseDetail, EngineTask } from '../../actions/schemas-v4';
import { useTaskComplete } from '../../hooks/useTaskComplete';
import { FormField, SegmentedControl, Textarea } from './TaskFormShell';
import { OutcomeActionBar } from './OutcomeActionBar';

export interface CodingReviewFormProps {
  case: CaseDetail;
  task: EngineTask;
}

type Recommendation = 'proceed' | 'reject' | 'escalate';

export function CodingReviewForm({
  case: c,
  task,
}: CodingReviewFormProps): React.ReactElement {
  const { complete, isPending, error } = useTaskComplete(c, task);

  const [cptCorrected, setCptCorrected] = useState<'no' | 'yes'>('no');
  const [modifierChanged, setModifierChanged] = useState<'no' | 'yes'>('no');
  const [dxAdequate, setDxAdequate] = useState<'no' | 'yes'>('yes');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = recommendation !== null;

  const submit = useCallback(
    async (outcome: 'SUCCESS' | 'NEEDS_INFO') => {
      setSubmitError(null);
      if (recommendation === null) {
        setSubmitError('Pick a recommendation.');
        return;
      }
      try {
        await complete(
          outcome,
          {
            cpt_corrected: cptCorrected === 'yes',
            modifier_changed: modifierChanged === 'yes',
            dx_adequate: dxAdequate === 'yes',
            recommendation,
          },
          notes.trim() !== '' ? notes.trim() : `Coding recommendation: ${recommendation}`,
        );
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    },
    [cptCorrected, modifierChanged, dxAdequate, recommendation, notes, complete],
  );

  const displayError = submitError ?? error?.message ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section className="space-y-4 rounded-lg border-2 border-blue-300 bg-white p-5">
          <header>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Coding review
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Verify CPT, modifiers, and diagnosis adequacy on claim {c.claim_id} (denied as <em>{c.recommended_category}</em>). Recommend how the originator should proceed.
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField
              id="cpt-corrected"
              label="CPT corrected?"
              hint="Did you change the CPT code?"
            >
              <SegmentedControl<'no' | 'yes'>
                name="CPT corrected"
                value={cptCorrected}
                onChange={setCptCorrected}
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
                disabled={isPending}
              />
            </FormField>

            <FormField
              id="modifier-changed"
              label="Modifier changed?"
              hint="Added, removed, or swapped modifier(s)?"
            >
              <SegmentedControl<'no' | 'yes'>
                name="Modifier changed"
                value={modifierChanged}
                onChange={setModifierChanged}
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
                disabled={isPending}
              />
            </FormField>

            <FormField
              id="dx-adequate"
              label="Dx adequate?"
              hint="ICD codes support medical necessity?"
            >
              <SegmentedControl<'no' | 'yes'>
                name="Dx adequate"
                value={dxAdequate}
                onChange={setDxAdequate}
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
                disabled={isPending}
              />
            </FormField>
          </div>

          <FormField
            id="coding-recommendation"
            label="Recommendation"
            required
            hint="What should the originator do next?"
          >
            <SegmentedControl<Recommendation>
              name="Recommendation"
              value={recommendation}
              onChange={setRecommendation}
              options={[
                { value: 'proceed', label: 'Proceed' },
                { value: 'reject', label: 'Reject' },
                { value: 'escalate', label: 'Escalate' },
              ]}
              disabled={isPending}
            />
          </FormField>

          <FormField
            id="coding-notes"
            label="Notes for originator"
            hint="What you changed and why. Required if changes were made."
          >
            <Textarea
              id="coding-notes"
              value={notes}
              onChange={setNotes}
              rows={3}
              placeholder="e.g. Added modifier 25 to 99214; dx J45.20 supports medical necessity."
              disabled={isPending}
              describedBy="coding-notes-hint"
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
        successLabel="Return to originator"
        onSuccess={() => submit('SUCCESS')}
        needsInfoLabel="Need more info"
        onNeedsInfo={() => submit('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
