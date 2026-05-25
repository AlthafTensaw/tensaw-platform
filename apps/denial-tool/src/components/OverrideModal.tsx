/**
 * OverrideModal — Dialog + ActionForm rewrite.
 *
 * PR-7 fixes:
 *   - classification_id now flows through to the ActionForm submission
 *     (bug #15). Previously the form schema didn't include it, so the
 *     dispatched mutation had no path id and the request 404'd.
 *   - Form values are flat — classification_id, reason, corrected_*,
 *     notes — matching the action registry's request shape. The
 *     dispatcher substitutes classification_id into the path and sends
 *     the rest as the body.
 *   - Token rewrites.
 */

import { Dialog } from '@tensaw/design-system/overlays';
import { ActionForm } from '@tensaw/wired-components';
import { Button } from '@tensaw/design-system/primitives';
import { Select } from '@tensaw/design-system/forms';
import { Textarea } from '@tensaw/design-system/primitives';
import { Alert } from '@tensaw/design-system/feedback';
import { z } from 'zod';
import {
  CATEGORY_VALUES,
  OVERRIDE_REASON_COPY,
  OverrideReasonEnum,
  type OverrideReason,
  type Classification,
} from '../actions/schemas';

interface OverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classification: Classification;
  onSuccess?: () => void;
}

// PR-7: the form's schema mirrors the action's request shape exactly,
// classification_id included. The dispatcher needs it in the payload
// to substitute into POST /v1/classifications/{classification_id}/override.
const OverrideFormSchema = z.object({
  classification_id: z.string().uuid(),
  reason: OverrideReasonEnum,
  corrected_category: z.string().optional(),
  corrected_branch: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
type OverrideFormValues = z.infer<typeof OverrideFormSchema>;

const REASON_OPTIONS: { value: OverrideReason; label: string }[] = (
  Object.keys(OVERRIDE_REASON_COPY) as OverrideReason[]
).map((key) => ({ value: key, label: OVERRIDE_REASON_COPY[key].label }));

// PR-7: Radix Select doesn't accept empty string values (bug #3). Use a
// sentinel and convert at the boundary.
const CATEGORY_OPTIONS = CATEGORY_VALUES.map((v) => ({ value: v, label: v }));

export function OverrideModal({
  open,
  onOpenChange,
  classification,
  onSuccess,
}: OverrideModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Override classification"
      description={`Current: ${classification.primary_category}`}
      size="md"
    >
      <ActionForm<OverrideFormValues, unknown>
        actionId="denial.override"
        schema={OverrideFormSchema}
        defaultValues={{
          // PR-7: classification_id baked into defaults — it doesn't
          // need a form field, but it must be in the payload.
          classification_id: classification.classification_id,
          reason: undefined as unknown as OverrideReason,
          corrected_category: undefined,
          corrected_branch: undefined,
          notes: undefined,
        }}
        toastOnSuccess="Override recorded"
        onSuccess={() => {
          onSuccess?.();
          onOpenChange(false);
        }}
      >
        {(methods) => {
          const reason = methods.watch('reason');
          const correctedCategory = methods.watch('corrected_category');
          const reasonCopy = reason ? OVERRIDE_REASON_COPY[reason] : null;
          const requiresCategory = reasonCopy?.requiresCategory ?? false;
          const categoryMatchesCurrent =
            correctedCategory === classification.primary_category;

          return (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Reason <span className="text-destructive">*</span>
                </label>
                <Select<OverrideReason>
                  value={reason ?? null}
                  onValueChange={(v) => {
                    methods.setValue('reason', v, { shouldValidate: true });
                  }}
                  options={REASON_OPTIONS}
                  placeholder="Pick a reason…"
                  aria-label="Reason"
                />
              </div>

              {reasonCopy ? (
                <Alert variant="info">
                  {reasonCopy.description}
                </Alert>
              ) : null}

              {requiresCategory ? (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-foreground">
                    Corrected category <span className="text-destructive">*</span>
                  </label>
                  <Select<string>
                    value={correctedCategory ?? null}
                    onValueChange={(v) => {
                      methods.setValue('corrected_category', v, { shouldValidate: true });
                    }}
                    options={CATEGORY_OPTIONS}
                    placeholder="Pick the correct category…"
                    error={categoryMatchesCurrent}
                    aria-label="Corrected category"
                  />
                  {categoryMatchesCurrent ? (
                    <p className="text-xs text-destructive">
                      Pick a category different from the current one
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Notes (optional)
                </label>
                <Textarea
                  rows={3}
                  placeholder="Context for the audit trail…"
                  value={methods.watch('notes') ?? ''}
                  onChange={(e) => {
                    methods.setValue('notes', e.target.value);
                  }}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => { onOpenChange(false); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    !reason ||
                    (requiresCategory &&
                      (!correctedCategory || categoryMatchesCurrent))
                  }
                  loading={methods.formState.isSubmitting}
                >
                  Submit override
                </Button>
              </div>
            </div>
          );
        }}
      </ActionForm>
    </Dialog>
  );
}
