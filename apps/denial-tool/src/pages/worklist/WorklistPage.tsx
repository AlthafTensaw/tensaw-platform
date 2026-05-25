import { useEffect, useMemo, useState } from 'react';
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

export function WorklistPage(): JSX.Element {
  const { filters, setFilter, clearAll } = useWorklistFilters();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // v2.3 decision: persist selection across pagination, clear on filter change.
  // We watch the filters object; any time it changes, drop selection.
  useEffect(() => {
    setSelectedIds([]);
    setPage(1);
  }, [filters]);

  const worklistRequest = useMemo<WorklistRequest>(
    () => ({ ...filters, page, page_size: 50 }),
    [filters, page],
  );

  const { data, isLoading, refetch } = useActionQuery<WorklistResponse>(
    'denial.list',
    worklistRequest,
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 50;

  const rowsById = useMemo(() => {
    const m = new Map<string, WorklistRow>();
    for (const r of rows) m.set(r.classification.classification_id, r);
    return m;
  }, [rows]);

  // selectedRows = only the rows we have data for (i.e. on current page).
  // Off-page selections still count toward the selection bar count (they're
  // in selectedIds), but the bulk-assign dialog only has data for on-page
  // rows, which is fine — the dialog only needs primary_category + workflow
  // for the mixed-category warning, and that's representative enough.
  const selectedRows = useMemo(
    () =>
      selectedIds
        .map((id) => rowsById.get(id))
        .filter((r): r is WorklistRow => r !== undefined),
    [selectedIds, rowsById],
  );
  const offPageSelectedCount = selectedIds.length - selectedRows.length;

  const handleMutated = (): void => {
    void refetch();
    setExpandedId(null);
    setSelectedIds([]);
  };

  return (
    <div className="denial-hide-search">
      <DataExplorer<WorklistRow>
        rows={rows}
        columns={WORKLIST_COLUMNS}
        totalRows={total}
        getRowId={(r) => r.classification.classification_id}
        loading={isLoading}
        empty={{
          title: 'No claims match these filters',
          description: 'Try clearing a filter, changing the state, or removing the "Needs human review" toggle.',
        }}
        pageIndex={page - 1}
        pageSize={pageSize}
        onPageChange={(next) => { setPage(next + 1); }}
        selectionMode="multi"
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        filters={<DenialFilterStrip filters={filters} setFilter={setFilter} clearAll={clearAll} />}
        bulkActions={
          selectedIds.length > 0 ? (
            <DenialBulkActionBar
              selectedRows={selectedRows}
              offPageSelectedCount={offPageSelectedCount}
              totalSelectedCount={selectedIds.length}
              onClear={() => { setSelectedIds([]); }}
              onMutated={handleMutated}
            />
          ) : null
        }
        expandedRowId={expandedId}
        onExpandedRowIdChange={setExpandedId}
        renderRowDetail={(row) => <RowDetailPanel row={row} onMutated={handleMutated} />}
        expandTrigger="chevron"
        rowDetailVariant="inset"
      />
    </div>
  );
}
