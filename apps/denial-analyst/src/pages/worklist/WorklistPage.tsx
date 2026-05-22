/**
 * WorklistPage — the main analyst surface.
 *
 * PR-7 fixes:
 *   - useMemo on the worklist request to stabilize React Query's
 *     query key (bug #6). Without it, the inline { ...filters, page }
 *     object literal created a new reference every render and RQ
 *     refetched in a loop.
 */

import { useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { DataExplorer } from '@tensaw/composition/data-display';
import { useWorklistFilters } from '../../hooks/useWorklistFilters';
import type {
  WorklistRequest,
  WorklistResponse,
  WorklistRow,
} from '../../actions/schemas';
import { WORKLIST_COLUMNS } from './columns';
import { DenialFilterStrip } from '../../components/DenialFilterStrip';
import { DenialBulkActionBar } from '../../components/DenialBulkActionBar';
import { RowDetailPanel } from '../../components/RowDetailPanel';

export function WorklistPage() {
  const { filters, setFilters } = useWorklistFilters();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleFilterChange = (nextFilters: typeof filters) => {
    setFilters(nextFilters);
    setPage(1);
  };

  // PR-7: stable reference for the query key (bug #6).
  // Without useMemo, { ...filters, page } is a new object every
  // render → infinite refetch.
  const worklistRequest = useMemo<WorklistRequest>(
    () => ({ ...filters, page, page_size: 50 }),
    [filters, page],
  );

  const { data, isLoading, refetch } = useActionQuery<WorklistResponse>(
    'denial.list',
    worklistRequest,
  );

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 50;

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
    void refetch();
    setExpandedId(null);
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
      pageIndex={page - 1}
      pageSize={pageSize}
      onPageChange={(next) => { setPage(next + 1); }}
      selectionMode="multi"
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      filters={
        <DenialFilterStrip filters={filters} onChange={handleFilterChange} />
      }
      bulkActions={
        selectedRows.length > 0 ? (
          <DenialBulkActionBar
            selectedRows={selectedRows}
            onClear={() => { setSelectedIds([]); }}
            onMutated={handleMutated}
          />
        ) : null
      }
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
