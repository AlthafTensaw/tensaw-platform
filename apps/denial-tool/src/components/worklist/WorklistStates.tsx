/**
 * WorklistStates — non-data UI states for the worklist pane.
 *
 *   - WorklistSkeleton: 5 shimmer placeholder cards during initial load
 *   - WorklistEmpty:    "no cases" view with optional Clear-filters CTA
 *                       (mockup #7)
 *   - WorklistError:    inline error + retry button
 *
 * Drop-in path: src/components/worklist/WorklistStates.tsx
 */

import type { ReactNode } from 'react';

// ============================================================================
// Skeleton — show during initial load
// ============================================================================

export function WorklistSkeleton(): React.ReactElement {
  return (
    <div role="status" aria-label="Loading cases" className="space-y-1.5">
      {Array.from({ length: 5 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonCard(): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="
        rounded-md border border-slate-200 bg-white px-3 py-2.5
        animate-pulse
      "
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-3 w-12 rounded bg-slate-200" />
      </div>
      <div className="mb-1.5 h-2 w-48 rounded bg-slate-100" />
      <div className="mb-1.5 h-2 w-40 rounded bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-3 w-14 rounded bg-slate-100" />
        <div className="h-3 w-20 rounded bg-slate-100" />
      </div>
    </div>
  );
}

// ============================================================================
// Empty — per mockup #7
// ============================================================================

export interface WorklistEmptyProps {
  /** True when the empty result is from filters being too narrow.
   *  Renders the Clear-filters CTA. */
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
  /** Optional queue label for the "in {queue}" phrasing. */
  queueLabel?: string;
}

export function WorklistEmpty({
  hasActiveFilters,
  onClearFilters,
  queueLabel,
}: WorklistEmptyProps): React.ReactElement {
  return (
    <div
      role="status"
      className="
        flex flex-col items-center justify-center gap-3
        rounded-lg border border-dashed border-slate-300 bg-slate-50
        px-6 py-12 text-center
      "
    >
      <EmptyIcon />
      {hasActiveFilters ? (
        <>
          <h3 className="text-sm font-semibold text-slate-800">No matching cases</h3>
          <p className="max-w-xs text-[12.5px] text-slate-600">
            No cases match your current filters{queueLabel !== undefined ? ` in ${queueLabel}` : ''}.
            Try widening one of them.
          </p>
          {onClearFilters !== undefined && (
            <button
              type="button"
              onClick={onClearFilters}
              className="
                rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white
                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
              "
            >
              Clear filters
            </button>
          )}
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-slate-800">All caught up</h3>
          <p className="max-w-xs text-[12.5px] text-slate-600">
            No open cases{queueLabel !== undefined ? ` in ${queueLabel}` : ''} right now.
            New denials will appear here as they're classified.
          </p>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Error
// ============================================================================

export interface WorklistErrorProps {
  message: string;
  onRetry?: () => void;
}

export function WorklistError({ message, onRetry }: WorklistErrorProps): React.ReactElement {
  return (
    <div
      role="alert"
      className="
        flex items-start gap-3 rounded-lg border border-red-200 bg-red-50
        px-4 py-3 text-[12.5px] text-red-800
      "
    >
      <ErrorIcon />
      <div className="flex-1">
        <div className="font-semibold">Couldn't load the worklist</div>
        <div className="mt-0.5 text-red-700">{message}</div>
      </div>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="
            rounded border border-red-300 bg-white px-2.5 py-1 text-[11.5px] font-medium
            text-red-700 hover:bg-red-100
            focus:outline-none focus:ring-2 focus:ring-red-400
          "
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Inline icons
// ============================================================================

function EmptyIcon(): React.ReactElement {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="text-slate-400">
      <rect x="6" y="8" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 14h12M10 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

// Re-export ReactNode for convenience
export type { ReactNode };
