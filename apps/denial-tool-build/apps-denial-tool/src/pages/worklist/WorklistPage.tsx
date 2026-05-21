/**
 * WorklistPage — the main analyst surface.
 *
 * PR-6 changes from PR-5:
 *   - Custom <RecommendationGrid> deleted; replaced with platform
 *     <DataExplorer> using the v2 row-expansion props (expandedRowId,
 *     onExpandedRowIdChange, renderRowDetail, expandTrigger='chevron',
 *     rowDetailVariant='inset').
 *   - Toolbar chrome (density toggle, column visibility menu, search)
 *     now comes from DataExplorer rather than being hand-rolled.
 *   - Filter chips and bulk-action bar (already built on
 *     worklist/primitives in PR-3+) compose through DataExplorer's
 *     `filters` and `bulkActions` ReactNode slots.
 *   - selectedIds state shape changed from Map<string, WorklistRow> →
 *     string[] to match DataExplorer's controlled selection contract.
 *     We resolve the row object via a lookup at use-site (bulk-accept
 *     gate needs the full row for the D-19 check).
 *
 * URL state: filters + page index live in useWorklistFilters
 * (localStorage v4 key per user). Expanded row id is component-local
 * (deliberately — opening a row detail shouldn't survive page reload).
 */

import { useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { DataExplorer } from '@tensaw/composition/data-display';
import { useWorklistFilters } from '../../hooks/useWorklistFilters';
import type { WorklistResponse, WorklistRow } from '../../actions/schemas';
import { WORKLIST_COLUMNS } from './columns';
import { DenialFilterStrip } from '../../components/DenialFilterStrip';
import { DenialBulkActionBar } from '../../components/DenialBulkActionBar';
import { RowDetailPanel } from '../../components/RowDetailPanel';

export function WorklistPage() {
  const { filters, setFilters, page, setPage } = useWorklistFilters();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, refetch } = useActionQuery<
    typeof filters,
    WorklistResponse
  >('denial.list', { ...filters, page });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 50;

  // Lookup table — needed by DenialBulkActionBar for D-19 gate, since
  // it operates on full WorklistRow objects, not just ids.
  const rowsById = useMemo(() => {
    const m = new Map<string, WorklistRow>();
    for (const r of rows) m.set(r.classification.classification_id, r);
    return m;
  }, [rows]);

  const selectedRows = useMemo(
    () =>
      selectedIds
        .map((id) => rowsById.get(id))
        .filter((r): r is WorklistRow => r !== undefined),
    [selectedIds, rowsById],
  );

  const handleMutated = () => {
    refetch();
    setExpandedId(null); // close detail after a mutation; the row may have moved buckets
    setSelectedIds([]);
  };

  return (
    <DataExplorer<WorklistRow>
      rows={rows}
      columns={WORKLIST_COLUMNS}
      totalRows={total}
      getRowId={(r) => r.classification.classification_id}
      loading={isLoading}
      empty={{
        title: 'No claims match these filters',
        description: 'Try clearing a filter or changing the state.',
      }}
      // Pagination
      pageIndex={page - 1}
      pageSize={pageSize}
      onPageChange={(next) => setPage(next + 1)}
      // Selection
      selectionMode="multi"
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      // Filters and bulk actions slots
      filters={
        <DenialFilterStrip filters={filters} onChange={setFilters} />
      }
      bulkActions={
        selectedRows.length > 0 ? (
          <DenialBulkActionBar
            selectedRows={selectedRows}
            onClear={() => setSelectedIds([])}
            onMutated={handleMutated}
          />
        ) : null
      }
      // PR-6 — row expansion via the v2 platform props
      expandedRowId={expandedId}
      onExpandedRowIdChange={setExpandedId}
      renderRowDetail={(row) => (
        <RowDetailPanel row={row} onMutated={handleMutated} />
      )}
      expandTrigger="chevron"
      rowDetailVariant="inset"
    />
  );
}
