/**
 * LeftListPane — denial inbox left pane.
 *
 * Layout:
 *   - Header (sticky): title + count, search box, filter chips
 *   - Selection bar (sticky, when multi-select active)
 *   - Scrolling list of DenialCard rows
 *   - Footer: pagination
 *
 * Card click → sets selectedClaimId.
 * Card cmd/ctrl-click → toggles multi-select membership.
 *
 * v3.0 decisions baked in:
 *   - State chip defaults to "Recommended"
 *   - Three new filter chips: Clinic, Assigned-to, $ pending range
 *   - Card layout per mockup v3.0.3
 *   - "All steps complete" for completed denials
 */

import { useCallback } from 'react';
import type { WorklistRow } from '../../actions/schemas';
import type { WorklistFilters } from '../../hooks/useWorklistFilters';
import { LeftPaneFilters } from './LeftPaneFilters';
import { LeftPaneSelectionBar } from './LeftPaneSelectionBar';
import { DenialCard } from './DenialCard';

interface LeftListPaneProps {
  rows: WorklistRow[];
  total: number;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
  multiSelectIds: string[];
  onMultiSelectChange: (ids: string[]) => void;
  onClearMultiSelect: () => void;
  filters: WorklistFilters;
  setFilter: <K extends keyof WorklistFilters>(
    key: K,
    value: WorklistFilters[K],
  ) => void;
  clearAllFilters: () => void;
  onMutated: () => void;
}

export function LeftListPane({
  rows,
  total,
  loading,
  page,
  onPageChange,
  selectedClaimId,
  onSelectClaim,
  multiSelectIds,
  onMultiSelectChange,
  onClearMultiSelect,
  filters,
  setFilter,
  onMutated,
}: LeftListPaneProps): JSX.Element {
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleCardClick = useCallback(
    (claimId: string, e: React.MouseEvent) => {
      // Cmd/Ctrl-click → toggle multi-select instead of switching the
      // selected (work) claim. Shift-click for range select is a v3.1 thing.
      if (e.metaKey || e.ctrlKey) {
        const isSelected = multiSelectIds.includes(claimId);
        onMultiSelectChange(
          isSelected
            ? multiSelectIds.filter((id) => id !== claimId)
            : [...multiSelectIds, claimId],
        );
        return;
      }
      onSelectClaim(claimId);
    },
    [multiSelectIds, onMultiSelectChange, onSelectClaim],
  );

  const handleCheckboxToggle = useCallback(
    (claimId: string) => {
      const isSelected = multiSelectIds.includes(claimId);
      onMultiSelectChange(
        isSelected
          ? multiSelectIds.filter((id) => id !== claimId)
          : [...multiSelectIds, claimId],
      );
    },
    [multiSelectIds, onMultiSelectChange],
  );

  const isMultiSelectActive = multiSelectIds.length > 0;

  // Resolve selected rows for bulk action bar (need full row data for
  // mixed-category warning etc.)
  const selectedRows = multiSelectIds
    .map((id) => rows.find((r) => String(r.claim.claim_id) === id))
    .filter((r): r is WorklistRow => r !== undefined);

  return (
    <div className="flex flex-col overflow-hidden border-r border-border bg-muted/30">
      {/* Sticky header */}
      <div className="border-b border-border bg-background px-3.5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recommended denials
          </span>
          <span className="font-mono text-[12px] font-semibold tabular-nums">
            {total}
          </span>
        </div>

        <LeftPaneFilters filters={filters} setFilter={setFilter} />
      </div>

      {/* Selection bar (only when multi-select active) */}
      {isMultiSelectActive ? (
        <LeftPaneSelectionBar
          selectedRows={selectedRows}
          totalSelectedCount={multiSelectIds.length}
          onClear={onClearMultiSelect}
          onMutated={onMutated}
        />
      ) : null}

      {/* Scrolling list */}
      <div className="flex-1 overflow-y-auto">
        {loading && rows.length === 0 ? (
          <div className="px-3.5 py-6 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-3.5 py-8 text-center text-xs text-muted-foreground">
            No denials match these filters. Try clearing one.
          </div>
        ) : (
          rows.map((row) => {
            const claimId = String(row.claim.claim_id);
            return (
              <DenialCard
                key={claimId}
                row={row}
                isSelected={selectedClaimId === claimId}
                isMultiSelected={multiSelectIds.includes(claimId)}
                showCheckbox={isMultiSelectActive}
                onClick={(e) => { handleCardClick(claimId, e); }}
                onCheckboxToggle={() => { handleCheckboxToggle(claimId); }}
              />
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-background px-3.5 py-1.5 text-[11.5px] text-muted-foreground">
        <span>
          Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, total)} of {total}
          {netPendingFilterActive(filters) ? (
            <span
              className="ml-1 text-[10.5px] italic"
              title="When $ Range filter is active, the total reflects rows before that filter is applied. Visible row count is accurate; total is approximate. (BE Ask 7 caveat — see v3.0.1 known issues.)"
            >
              (approx)
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { onPageChange(Math.max(1, page - 1)); }}
            disabled={page === 1}
            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="font-mono">
            {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => { onPageChange(Math.min(totalPages, page + 1)); }}
            disabled={page >= totalPages}
            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper: is one of the $ pending filters currently set? When true, the
// worklist `total` is pre-filter (BE Ask 7 service-layer post-filter
// limitation). We surface this with a small "(approx)" hint rather than
// hiding it; v3.1 can do the BE-side denorm to make this exact.
function netPendingFilterActive(filters: WorklistFilters): boolean {
  const f = filters as unknown as {
    min_net_pending?: string | undefined;
    max_net_pending?: string | undefined;
  };
  return f.min_net_pending !== undefined || f.max_net_pending !== undefined;
}
