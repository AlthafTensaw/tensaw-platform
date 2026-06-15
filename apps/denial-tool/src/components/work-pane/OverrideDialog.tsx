/**
 * OverrideDialog — modal for the Override flow in ProposedView.
 *
 * Asks the analyst to pick a different category and (optionally) why. On
 * submit, fires the case.override mutation; on success, the parent closes
 * the dialog and the case re-renders as overridden state.
 *
 * Simple custom modal — no Radix dep. Backdrop click + Escape close.
 *
 * Drop-in path: src/components/work-pane/OverrideDialog.tsx
 */

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useActionQuery, useActionMutation } from '@tensaw/actions';
import type { CategoriesResponse } from '../../actions/schemas-v4-tabs';
import { categoryLabel } from '../../lib/labels';

export interface OverrideDialogProps {
  caseId: string;
  /** The LLM-recommended category, shown for context (read-only). */
  recommendedCategory: string | null;
  /** Called when the modal should close (cancel, success, or backdrop). */
  onClose: () => void;
  /** Called on successful override — parent typically invalidates the case query. */
  onSuccess?: () => void;
}

export function OverrideDialog({
  caseId,
  recommendedCategory,
  onClose,
  onSuccess,
}: OverrideDialogProps): React.ReactElement {
  const { data: catData } = useActionQuery<CategoriesResponse>('category.list', {});
  const [fireOverride, { isLoading: isPending, error: mutationError }] =
    useActionMutation('case.override');

  const [chosenCategory, setChosenCategory] = useState<string>('');
  const [reasoning, setReasoning] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Categories excluding the currently recommended one (you can't "override" to
  // the same category — that's an Accept)
  const overrideOptions = (catData?.categories ?? []).filter(
    (c) => c.code !== recommendedCategory,
  );

  // Escape to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);
      if (chosenCategory === '') {
        setSubmitError('Pick a category to override to.');
        return;
      }
      try {
        await fireOverride({
          case_id: caseId,
          override_category: chosenCategory,
          ...(reasoning.trim() !== '' && { override_reasoning: reasoning.trim() }),
        });
        if (onSuccess !== undefined) onSuccess();
        onClose();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Override failed');
      }
    },
    [caseId, chosenCategory, reasoning, fireOverride, onSuccess, onClose],
  );

  const displayError = submitError ?? (mutationError?.message ?? null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-slate-900/40 backdrop-blur-[1px]
      "
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-md rounded-lg border border-slate-200 bg-white
          shadow-xl
        "
      >
        <header className="border-b border-slate-200 px-4 py-3">
          <h3 id="override-title" className="text-sm font-semibold text-slate-900">
            Override classification
          </h3>
          {recommendedCategory !== null && (
            <p className="mt-0.5 text-[12px] text-slate-600">
              The LLM recommended <strong>{categoryLabel(recommendedCategory)}</strong>.
              Pick a different category if you disagree.
            </p>
          )}
        </header>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
          {/* Category picker */}
          <div>
            <label
              htmlFor="override-category"
              className="block text-[11.5px] font-medium text-slate-700"
            >
              Override to <span className="text-red-600">*</span>
            </label>
            <select
              id="override-category"
              required
              value={chosenCategory}
              onChange={(e) => setChosenCategory(e.target.value)}
              className="
                mt-1 block w-full rounded border border-slate-300 bg-white
                px-2.5 py-1.5 text-[13px] text-slate-900
                focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
              "
            >
              <option value="" disabled>
                Pick a category…
              </option>
              {overrideOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reasoning textarea */}
          <div>
            <label
              htmlFor="override-reasoning"
              className="block text-[11.5px] font-medium text-slate-700"
            >
              Reasoning <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="override-reasoning"
              rows={3}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Why does this case belong in the new category?"
              className="
                mt-1 block w-full rounded border border-slate-300 bg-white
                px-2.5 py-1.5 text-[12.5px] text-slate-900
                placeholder:text-slate-400
                focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
              "
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Written to the case audit log along with your username.
            </p>
          </div>

          {displayError !== null && (
            <div
              role="alert"
              className="
                rounded border border-red-200 bg-red-50 px-2.5 py-1.5
                text-[11.5px] text-red-800
              "
            >
              {displayError}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="
                rounded px-3 py-1.5 text-[12px] font-medium text-slate-700
                hover:bg-slate-100
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:opacity-50
              "
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || chosenCategory === ''}
              className="
                rounded bg-amber-600 px-3 py-1.5 text-[12px] font-medium text-white
                hover:bg-amber-700
                focus:outline-none focus:ring-2 focus:ring-amber-500
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              {isPending ? 'Submitting…' : 'Submit override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
