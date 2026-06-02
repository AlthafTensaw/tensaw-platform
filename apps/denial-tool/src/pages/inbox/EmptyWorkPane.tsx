/**
 * EmptyWorkPane — shown when no denial is selected in the left pane.
 *
 * Reached when: filters return zero rows, or analyst clears search to empty,
 * or initial-load before data arrives + first row auto-select hasn't run.
 */

export function EmptyWorkPane({ loading }: { loading: boolean }): JSX.Element {
  if (loading) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground">
        Loading denials…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div className="text-base font-medium">No denial selected</div>
      <div className="max-w-xs text-sm text-muted-foreground">
        Pick a denial from the list on the left to see its details, work the
        steps, and review reference info.
      </div>
    </div>
  );
}
