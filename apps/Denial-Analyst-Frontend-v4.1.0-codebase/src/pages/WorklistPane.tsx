/**
 * WorklistPane (v4.1) — left-pane composition for the engine-handler model.
 *
 * Wires:
 *   useTeamQueue             → active TEAM for the worklist.list query
 *   useWorklistUrlState(v41) → filters + page
 *   useActionQuery           → worklist.list (DMS-LOCAL table; no engine call)
 *   WorklistFiltersBar(v41)  → filter chip row (task_type first-class + HD)
 *   CaseCard(v41)[]          → dispatched-task row rendering
 *   WorklistPagination       → page controls (DB-backed → exact totals)
 *   WorklistSkeleton/Empty/Error → reused unchanged
 *
 * Key differences from v4.0.0:
 *   - Reads worklist.list (not case.worklist); rows are WorklistTask, not joins.
 *   - Active dimension is a Team (not a queue_id); label from TEAM_LABELS — no
 *     queue.list query.
 *   - Pagination shows exact "X of N" since total is exact (DB-backed).
 *
 * Drop-in path: src/pages/WorklistPane.tsx
 */

import { useActionQuery } from '@tensaw/actions';
import { useTeamQueue } from '../hooks/useTeamQueue';
import { useWorklistUrlState } from '../hooks/useWorklistUrlState';
import { TEAM_LABELS, type Team } from '../actions/schemas';
import { CaseCard } from '../components/cards/CaseCard';
import { WorklistFiltersBar } from '../components/worklist/WorklistFilters';
import { WorklistPagination } from '../components/worklist/WorklistPagination';
import {
  WorklistSkeleton,
  WorklistEmpty,
  WorklistError,
} from '../components/worklist/WorklistStates';

const PAGE_SIZE = 25;

export interface WorklistPaneProps {
  /** Caller's role-default team (shell passes from JWT roles). */
  defaultTeam?: Team;
}

export function WorklistPane({ defaultTeam }: WorklistPaneProps): React.ReactElement {
  const { activeTeam } = useTeamQueue(defaultTeam);
  const { filters, page, hasAnyFilter, clearAllFilters, setPage } = useWorklistUrlState();

  // worklist.list query params — team + active filters. task_type is sent as a
  // one-element array (the request schema is array-typed; the chip is single).
  const queryParams = {
    team: activeTeam,
    page,
    page_size: PAGE_SIZE,
    ...(filters.task_type !== null && { task_type: [filters.task_type] }),
    ...(filters.clinic_id !== null && { clinic_id: filters.clinic_id }),
    ...(filters.primary_payer_id !== null && { primary_payer_id: filters.primary_payer_id }),
    ...(filters.aging_bucket !== null && { aging_bucket: filters.aging_bucket }),
    ...(filters.priority !== null && { priority: filters.priority }),
    ...(filters.is_high_dollar && { is_high_dollar: true }),
  };

  const { data, isLoading, error, refetch } = useActionQuery('worklist.list', queryParams);

  const teamLabel = TEAM_LABELS[activeTeam];

  const isInitialLoading = isLoading && data === undefined;
  const hasErrorWithNoData = error !== null && data === undefined;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.has_more ?? false;
  const showEmpty = !isInitialLoading && !hasErrorWithNoData && rows.length === 0;

  return (
    <section
      aria-label="Worklist"
      className="flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white"
    >
      <WorklistFiltersBar />

      {/* Result count subheader */}
      {!isInitialLoading && !hasErrorWithNoData && rows.length > 0 && (
        <div className="border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500">
          {teamLabel}
          {' · '}
          <span className="tabular-nums">{total}</span>
          {' '}task{total === 1 ? '' : 's'}
        </div>
      )}

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isInitialLoading && <WorklistSkeleton />}

        {hasErrorWithNoData && (
          <WorklistError message={error?.message ?? 'Network or server error'} onRetry={refetch} />
        )}

        {showEmpty && (
          <WorklistEmpty
            hasActiveFilters={hasAnyFilter}
            onClearFilters={hasAnyFilter ? clearAllFilters : undefined}
            queueLabel={teamLabel}
          />
        )}

        {!isInitialLoading && !hasErrorWithNoData && rows.length > 0 && (
          <div className="space-y-1.5">
            {rows.map((task) => (
              <CaseCard key={task.task_id} task={task} />
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
