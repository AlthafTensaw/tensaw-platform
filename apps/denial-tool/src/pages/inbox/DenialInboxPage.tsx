/**
 * DenialInboxPage — v3.0 three-pane shell.
 *
 * Replaces WorklistPage. Coordinates shared state between:
 *   - LeftListPane  (filter + search + list of denial cards)
 *   - WorkPane      (work surface for the selected denial)
 *   - ReferencePane (5 tabs of reference content for the selected denial)
 *
 * Selected claim ID is the shared key. Left pane sets it via click; middle
 * and right derive their content from it.
 *
 * Selection (multi-select) is a separate state from "current claim selected
 * for work" — multi-select lights up the bulk action bar over the left
 * pane, but the work pane keeps showing whichever single denial was last
 * clicked. Pattern matches v2.3 behavior.
 *
 * No claim selected (initial load, empty filters) → middle and right show
 * empty states. We pre-select the first row when results arrive, matching
 * v3.0 decision #3 ("default to pre-select first").
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { useWorklistFilters } from '../../hooks/useWorklistFilters';
import type {
  WorklistRequest,
  WorklistResponse,
  WorklistRow,
} from '../../actions/schemas';
import { LeftListPane } from './LeftListPane';
import { WorkPane } from './WorkPane';
import { ReferencePane } from './ReferencePane';
import { EmptyWorkPane } from './EmptyWorkPane';
import { CategoryProvider } from './CategoryContext';
import { usePermissions } from '../../auth/permissions';

export function DenialInboxPage(): JSX.Element {
  const { filters, setFilter, clearAll } = useWorklistFilters();
  const { has } = usePermissions();
  const canReclassify = has('denial.classify_claim');
  const [page, setPage] = useState(1);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [multiSelectIds, setMultiSelectIds] = useState<string[]>([]);

  // Reset pagination + clear selection when filters change.
  // (Matches v2.3 selection-clearing behavior.)
  useEffect(() => {
    setPage(1);
    setMultiSelectIds([]);
  }, [filters]);

  const worklistRequest = useMemo<WorklistRequest>(
    () => ({ ...filters, page, page_size: 50 }),
    [filters, page],
  );

  const { data, isLoading, refetch } = useActionQuery<WorklistResponse>(
    'denial.list',
    worklistRequest,
  );

  const rows: WorklistRow[] = data?.rows ?? [];
  const total = data?.total ?? 0;

  // Pre-select first row when results arrive and no selection yet.
  // (v3.0 decision #3.)
  // v3.0.2: dropped the search-driven filteredRows derivation — search
  // was removed per product decision.
  useEffect(() => {
    if (selectedClaimId === null && rows.length > 0) {
      setSelectedClaimId(String(rows[0]!.claim.claim_id));
    }
    // If the previously selected claim is no longer in the list (filter
    // changed it out), pick the first available.
    if (
      selectedClaimId !== null &&
      rows.length > 0 &&
      !rows.some((r) => String(r.claim.claim_id) === selectedClaimId)
    ) {
      setSelectedClaimId(String(rows[0]!.claim.claim_id));
    }
    // If results emptied entirely, clear selection so empty state shows.
    if (rows.length === 0 && selectedClaimId !== null && !isLoading) {
      setSelectedClaimId(null);
    }
  }, [rows, selectedClaimId, isLoading]);

  const selectedRow = useMemo<WorklistRow | null>(() => {
    if (selectedClaimId === null) return null;
    return (
      rows.find((r) => String(r.claim.claim_id) === selectedClaimId) ?? null
    );
  }, [rows, selectedClaimId]);

  const handleMutated = useCallback((): void => {
    void refetch();
    // Don't clear selection on mutation — analyst usually wants to stay
    // on the row they just worked.
  }, [refetch]);

  const handleClearMultiSelect = useCallback((): void => {
    setMultiSelectIds([]);
  }, []);

  return (
    <CategoryProvider>
      <div className="grid h-[calc(100vh-52px)] grid-cols-[360px_1fr_440px] overflow-hidden">
        <LeftListPane
          rows={rows}
          total={total}
          loading={isLoading}
          page={page}
          onPageChange={setPage}
          selectedClaimId={selectedClaimId}
          onSelectClaim={setSelectedClaimId}
          multiSelectIds={multiSelectIds}
          onMultiSelectChange={setMultiSelectIds}
          onClearMultiSelect={handleClearMultiSelect}
          filters={filters}
          setFilter={setFilter}
          clearAllFilters={clearAll}
          onMutated={handleMutated}
        />

        {selectedRow !== null ? (
          <WorkPane row={selectedRow} canReclassify={canReclassify} onMutated={handleMutated} />
        ) : (
          <EmptyWorkPane loading={isLoading} />
        )}

        {selectedRow !== null ? (
          <ReferencePane row={selectedRow} />
        ) : (
          <div className="border-l border-border bg-muted/30" />
        )}
      </div>
    </CategoryProvider>
  );
}
