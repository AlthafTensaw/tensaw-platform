/**
 * OutcomeActionBar — outcome-coded action bar at the bottom of every task form.
 *
 * Outcome colors per the design contract:
 *   - SUCCESS    → emerald (primary, right-aligned)
 *   - NEEDS_INFO → amber (secondary, left-grouped)
 *   - FAIL_FATAL → red (destructive, hidden by default; opt-in)
 *
 * Each task form passes the labels it wants for each outcome — they vary
 * ("Mark complete", "Submit appeal", "Route to coding") even though the
 * outcome enum is constant.
 *
 * Drop-in path: src/components/task-form/OutcomeActionBar.tsx
 */

export interface OutcomeActionBarProps {
  /** Label for the primary SUCCESS button. Required. */
  successLabel: string;
  /** Click handler for SUCCESS. */
  onSuccess: () => void;
  /** True while a submit is in flight — disables all buttons. */
  isPending: boolean;
  /** Whether the SUCCESS button is enabled (in addition to !isPending).
   *  Form validity is checked by the parent; this is the gate. */
  canSubmitSuccess: boolean;

  /** Optional NEEDS_INFO button — label is required if onNeedsInfo is given. */
  needsInfoLabel?: string;
  onNeedsInfo?: () => void;

  /** Optional FAIL_FATAL button — destructive (closes the case). */
  failFatalLabel?: string;
  onFailFatal?: () => void;

  /** Optional cancel/back button (does NOT submit). */
  onCancel?: () => void;
  cancelLabel?: string;
}

export function OutcomeActionBar({
  successLabel,
  onSuccess,
  isPending,
  canSubmitSuccess,
  needsInfoLabel,
  onNeedsInfo,
  failFatalLabel,
  onFailFatal,
  onCancel,
  cancelLabel = 'Cancel',
}: OutcomeActionBarProps): React.ReactElement {
  return (
    <div
      className="
        flex items-center gap-2 border-t border-slate-200 bg-white px-6 py-3
      "
    >
      {onCancel !== undefined && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="
            rounded px-3 py-2 text-[12.5px] font-medium text-slate-700
            hover:bg-slate-100
            focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {cancelLabel}
        </button>
      )}

      {/* NEEDS_INFO + FAIL_FATAL group on the left */}
      {onNeedsInfo !== undefined && needsInfoLabel !== undefined && (
        <button
          type="button"
          onClick={onNeedsInfo}
          disabled={isPending}
          className="
            inline-flex items-center gap-1.5 rounded-md
            border border-amber-300 bg-amber-50 px-3 py-2
            text-[12.5px] font-semibold text-amber-900
            hover:bg-amber-100
            focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <NeedsInfoIcon />
          {needsInfoLabel}
        </button>
      )}

      {onFailFatal !== undefined && failFatalLabel !== undefined && (
        <button
          type="button"
          onClick={onFailFatal}
          disabled={isPending}
          className="
            inline-flex items-center gap-1.5 rounded-md
            border border-red-300 bg-white px-3 py-2
            text-[12.5px] font-semibold text-red-700
            hover:bg-red-50
            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <FailIcon />
          {failFatalLabel}
        </button>
      )}

      {/* SUCCESS button on the right (primary) */}
      <button
        type="button"
        onClick={onSuccess}
        disabled={isPending || !canSubmitSuccess}
        className="
          ml-auto inline-flex items-center gap-1.5 rounded-md
          bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white
          hover:bg-emerald-700
          focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
          disabled:cursor-not-allowed disabled:opacity-50
        "
      >
        <CheckIcon />
        {isPending ? 'Saving…' : successLabel}
      </button>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function CheckIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NeedsInfoIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 4v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FailIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
