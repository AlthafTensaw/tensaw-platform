/**
 * WorklistPane — left-pane composition for the 3-pane shell.
 *
 * Wires:
 *   useQueueState        → queue_id for the case.worklist query
 *   useWorklistUrlState  → filters + page
 *   useActionQuery       → case.worklist
 *   WorklistFilters      → filter chip row
 *   CaseCard[]           → row rendering
 *   WorklistPagination   → page controls
 *   WorklistSkeleton/Empty/Error → non-data states
 *
 * URL convention (all params optional):
 *   ?queue=<id>           — sets the active queue (also written by QueueSwitcher)
 *   ?case=<case_id>       — selected case (drives middle pane in P1.X)
 *   ?category=<code>      — filter
 *   ?clinic_id=<id>       — filter
 *   ?primary_payer_id=<id>— filter (requires clinic_id)
 *   ?aging=<bucket>       — filter
 *   ?priority=<level>     — filter
 *   ?page=<n>             — page number
 *
 * Drop-in path: src/pages/WorklistPane.tsx
 */

import { useActionQuery } from '@tensaw/actions';
import { useQueueState } from '../hooks/useQueueState';
import { useWorklistUrlState } from '../hooks/useWorklistUrlState';
import { CaseCard } from '../components/cards/CaseCard';
import { WorklistFiltersBar } from '../components/worklist/WorklistFilters';
import { WorklistPagination } from '../components/worklist/WorklistPagination';
import {
  WorklistSkeleton,
  WorklistEmpty,
  WorklistError,
} from '../components/worklist/WorklistStates';

const PAGE_SIZE = 25;

export function WorklistPane(): React.ReactElement {
  const { activeQueueId, isLoading: queueLoading } = useQueueState();
  const {
    filters,
    page,
    hasAnyFilter,
    clearAllFilters,
    setPage,
  } = useWorklistUrlState();

  // Don't fire the worklist query until we know which queue to ask about
  const queryParams = activeQueueId !== null
    ? {
        queue_id: activeQueueId,
        page,
        page_size: PAGE_SIZE,
        ...(filters.category !== null && { category: filters.category }),
        ...(filters.clinic_id !== null && { clinic_id: filters.clinic_id }),
        ...(filters.primary_payer_id !== null && { primary_payer_id: filters.primary_payer_id }),
        ...(filters.aging_bucket !== null && { aging_bucket: filters.aging_bucket }),
        ...(filters.priority !== null && { priority: filters.priority }),
      }
    : null;

  const {
    data,
    isLoading: worklistLoading,
    error,
    refetch,
  } = useActionQuery('case.worklist', queryParams ?? {});

  // Lookup the queue label for empty-state messaging
  const { data: queueListData } = useActionQuery('queue.list', {});
  const activeQueue = queueListData?.queues.find((q) => q.queue_id === activeQueueId);

  // Render-state derivation
  const isInitialLoading = queueLoading || (worklistLoading && data === undefined);
  const hasErrorWithNoData = error !== null && data === undefined;
  const rows = data?.rows ?? [];
  const hasMore = data?.has_more ?? false;
  const showEmpty = !isInitialLoading && !hasErrorWithNoData && rows.length === 0;

  return (
    <section
      aria-label="Worklist"
      className="flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white"
    >
      <WorklistFiltersBar />

      {/* Result count subheader (only when we have data) */}
      {!isInitialLoading && !hasErrorWithNoData && rows.length > 0 && (
        <div className="border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500">
          {activeQueue?.queue_label ?? 'Worklist'}
          {' · '}
          <span className="tabular-nums">{rows.length}</span>
          {' '}case{rows.length === 1 ? '' : 's'}
          {hasMore && (
            <span className="text-slate-400"> (page {page})</span>
          )}
        </div>
      )}

      {/* Scrollable card list area */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isInitialLoading && <WorklistSkeleton />}

        {hasErrorWithNoData && (
          <WorklistError
            message={error?.message ?? 'Network or server error'}
            onRetry={refetch}
          />
        )}

        {showEmpty && (
          <WorklistEmpty
            hasActiveFilters={hasAnyFilter}
            onClearFilters={hasAnyFilter ? clearAllFilters : undefined}
            queueLabel={activeQueue?.queue_label}
          />
        )}

        {!isInitialLoading && !hasErrorWithNoData && rows.length > 0 && (
          <div className="space-y-1.5">
            {rows.map((row) => (
              <CaseCard key={row.case.case_id} row={row} />
            ))}
          </div>
        )}
      </div>

      <WorklistPagination
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={rows.length}
        hasMore={hasMore}
        onPageChange={setPage}
      />
    </section>
  );
}
