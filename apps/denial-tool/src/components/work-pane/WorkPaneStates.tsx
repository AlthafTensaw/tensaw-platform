/**
 * WorkPaneStates — non-data UI states for the middle pane.
 *
 *   - WorkPaneEmpty:     no ?case= in URL ("Pick a denial from the worklist…")
 *   - WorkPaneSkeleton:  case.detail loading
 *   - WorkPaneError:     case.detail errored
 *
 * Drop-in path: src/components/work-pane/WorkPaneStates.tsx
 */

export function WorkPaneEmpty(): React.ReactElement {
  return (
    <div
      role="status"
      className="
        flex h-full flex-col items-center justify-center
        bg-slate-50 px-6 py-12 text-center
      "
    >
      <ClipboardIcon />
      <h3 className="mt-3 text-sm font-semibold text-slate-700">
        No denial selected
      </h3>
      <p className="mt-1 max-w-xs text-[12.5px] text-slate-500">
        Pick a denial from the worklist to view the LLM recommendation,
        accept or override it, and walk through the resolution workflow.
      </p>
    </div>
  );
}

export function WorkPaneSkeleton(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading case detail"
      className="flex h-full flex-col gap-4 px-6 py-4"
    >
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="mb-2 h-5 w-48 rounded bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 rounded bg-slate-100" />
          <div className="h-3 w-32 rounded bg-slate-100" />
          <div className="ml-auto h-5 w-20 rounded bg-slate-200" />
        </div>
      </div>

      {/* Recommendation block skeleton */}
      <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 h-4 w-40 rounded bg-slate-200" />
        <div className="mb-2 h-3 w-full rounded bg-slate-100" />
        <div className="mb-2 h-3 w-5/6 rounded bg-slate-100" />
        <div className="h-3 w-3/4 rounded bg-slate-100" />
      </div>

      {/* Action bar skeleton */}
      <div className="mt-auto flex gap-2 animate-pulse">
        <div className="h-9 w-32 rounded bg-slate-200" />
        <div className="h-9 w-24 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export interface WorkPaneErrorProps {
  message: string;
  onRetry?: () => void;
}

export function WorkPaneError({
  message,
  onRetry,
}: WorkPaneErrorProps): React.ReactElement {
  return (
    <div
      role="alert"
      className="flex h-full items-center justify-center px-6 py-12"
    >
      <div className="
        flex max-w-md items-start gap-3 rounded-lg border border-red-200
        bg-red-50 px-4 py-3 text-[12.5px] text-red-800
      ">
        <ErrorIcon />
        <div className="flex-1">
          <div className="font-semibold">Couldn't load this case</div>
          <div className="mt-0.5 text-red-700">{message}</div>
          {onRetry !== undefined && (
            <button
              type="button"
              onClick={onRetry}
              className="
                mt-2 rounded border border-red-300 bg-white px-2.5 py-1
                text-[11.5px] font-medium text-red-700 hover:bg-red-100
                focus:outline-none focus:ring-2 focus:ring-red-400
              "
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function ClipboardIcon(): React.ReactElement {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-slate-300">
      <rect x="10" y="8" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="6" width="12" height="4" rx="1" fill="currentColor" />
      <path d="M14 18h12M14 23h12M14 28h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ErrorIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-red-600 flex-shrink-0 mt-0.5">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4M10 13v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
