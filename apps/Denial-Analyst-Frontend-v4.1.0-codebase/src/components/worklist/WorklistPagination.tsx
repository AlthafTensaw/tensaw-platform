/**
 * WorklistPagination — page-based pagination controls.
 *
 * Per the design decision noted in P1.6 README: page-based (Prev/Next) rather
 * than infinite scroll or load-more. Simpler to implement with React Query
 * since each page is its own keyed query.
 *
 * Drop-in path: src/components/worklist/WorklistPagination.tsx
 */

export interface WorklistPaginationProps {
  page: number;
  pageSize: number;
  rowCount: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function WorklistPagination({
  page,
  pageSize,
  rowCount,
  hasMore,
  onPageChange,
}: WorklistPaginationProps): React.ReactElement | null {
  // Hide pagination entirely if we're on page 1 and there's nothing more
  if (page === 1 && !hasMore) return null;

  const firstIndex = (page - 1) * pageSize + 1;
  const lastIndex = firstIndex + rowCount - 1;
  const canGoBack = page > 1;
  const canGoForward = hasMore;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
      <div>
        Page {page}
        {rowCount > 0 && (
          <>
            {' · '}
            <span className="tabular-nums">
              {firstIndex}–{lastIndex}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => onPageChange(page - 1)}
          className="
            rounded border border-slate-300 bg-white px-2 py-1
            text-[11.5px] font-medium text-slate-700 hover:bg-slate-100
            focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:cursor-not-allowed disabled:opacity-40
          "
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => onPageChange(page + 1)}
          className="
            rounded border border-slate-300 bg-white px-2 py-1
            text-[11.5px] font-medium text-slate-700 hover:bg-slate-100
            focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:cursor-not-allowed disabled:opacity-40
          "
        >
          Next →
        </button>
      </div>
    </div>
  );
}
