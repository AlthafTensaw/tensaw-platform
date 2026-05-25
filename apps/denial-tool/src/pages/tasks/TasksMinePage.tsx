/**
 * TasksMinePage — Bhavana's "what's on my plate" view.
 *
 * Task-centric (one row per assigned step, not per classification).
 * Fetches GET /v1/tasks/mine via the useTasksMine() hook.
 * Mutations (status changes) refetch the list to honor server-side sort.
 *
 * v2.0.4 wiring: Pending→Complete via POST /complete; In-progress + reopen
 * disabled until backend v1.8.0's PUT /status (when it ships, the
 * useUnifiedStatusEndpoint prop flips to true here too).
 */

import { useMemo } from 'react';
import { Select } from '@tensaw/design-system/forms';
import { Icon } from '@tensaw/design-system/primitives';
import { useTasksMine } from '../../hooks/useTasksMine';
import { TaskRow } from '../../components/TaskRow';
import type { StepPriority, StepStatus } from '../../actions/schemas';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending,in_progress', label: 'Pending + In progress' },
  { value: 'pending', label: 'Pending only' },
  { value: 'in_progress', label: 'In progress only' },
  { value: 'pending,in_progress,complete', label: 'All (incl. complete)' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any priority' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

const DUE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue only' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due this week' },
  { value: 'month', label: 'Due this month' },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function TasksMinePage(): JSX.Element {
  const {
    tasks,
    total,
    page,
    pageSize,
    hasMore,
    isLoading,
    refetch,
    filters,
    setFilter,
    setPage,
    includePreAcceptance,
    setIncludePreAcceptance,
  } = useTasksMine();

  // Summary counts from the current page — for nav-tab badge we'd refetch
  // with page_size=1 to get the total without payload, but on this page
  // we can compute approximate counts from what's loaded.
  const counts = useMemo(() => {
    const today = toISODate(new Date());
    let overdue = 0;
    let dueToday = 0;
    let inProgress = 0;
    for (const t of tasks) {
      if (t.is_overdue) overdue += 1;
      const eff = t.step.effective_due_date ?? '';
      if (eff === today && !t.is_overdue) dueToday += 1;
      if (t.step.status === 'in_progress') inProgress += 1;
    }
    return { overdue, dueToday, inProgress };
  }, [tasks]);

  const onStatusFilterChange = (value: string): void => {
    setFilter('status', value.split(',') as StepStatus[]);
  };

  const onPriorityFilterChange = (value: string): void => {
    setFilter('priority', value !== 'all' ? ([value] as StepPriority[]) : []);
  };

  const onDueFilterChange = (value: string): void => {
    const today = new Date();
    if (value === 'all' || value === '') {
      setFilter('due_before', null);
      setFilter('due_after', null);
      return;
    }
    if (value === 'overdue') {
      setFilter('due_before', toISODate(today));
      setFilter('due_after', null);
      return;
    }
    if (value === 'today') {
      const t = toISODate(today);
      setFilter('due_before', t);
      setFilter('due_after', t);
      return;
    }
    if (value === 'week') {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      setFilter('due_before', toISODate(end));
      setFilter('due_after', toISODate(today));
      return;
    }
    if (value === 'month') {
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      setFilter('due_before', toISODate(end));
      setFilter('due_after', toISODate(today));
    }
  };

  const statusValue = filters.status.length === 0
    ? 'pending,in_progress,complete'
    : filters.status.join(',');
  const priorityValue = filters.priority[0] ?? 'all';

  const dueValue = useMemo(() => {
    if (!filters.due_before && !filters.due_after) return 'all';
    const today = toISODate(new Date());
    if (filters.due_before && !filters.due_after) {
      if (filters.due_before < today) return 'overdue';
      return 'all';
    }
    if (filters.due_before && filters.due_after) {
      if (filters.due_before === today && filters.due_after === today) return 'today';
      const diffDays = Math.round((new Date(filters.due_before).getTime() - new Date(filters.due_after).getTime()) / 86400000);
      if (diffDays <= 7) return 'week';
      return 'month';
    }
    return 'all';
  }, [filters.due_before, filters.due_after]);

  const handleMutated = (): void => {
    refetch();
  };

  return (
    <div className="flex flex-col">
      {/* Summary band */}
      <div className="px-6 py-5 bg-gradient-to-r from-teal-50 to-background border-b border-border">
        <h1 className="text-lg font-semibold mb-1">My tasks</h1>
        <p className="text-xs text-muted-foreground mb-3">
          All workflow steps assigned to you across the denial worklist. Sorted by urgency.
        </p>
        <div className="flex gap-2 flex-wrap">
          {counts.overdue > 0 ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-100 text-red-800 text-xs">
              <Icon name="AlertTriangle" size="xs" />
              <span className="font-semibold text-sm tabular-nums">
                {String(counts.overdue)}
              </span>
              overdue
            </span>
          ) : null}
          {counts.dueToday > 0 ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-100 text-amber-800 text-xs">
              <Icon name="Clock" size="xs" />
              <span className="font-semibold text-sm tabular-nums">
                {String(counts.dueToday)}
              </span>
              due today
            </span>
          ) : null}
          {counts.inProgress > 0 ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-100 text-blue-800 text-xs">
              <Icon name="Activity" size="xs" />
              <span className="font-semibold text-sm tabular-nums">
                {String(counts.inProgress)}
              </span>
              in progress
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-teal-100 text-teal-900 text-xs">
            <span className="font-semibold text-sm tabular-nums">{String(total)}</span>
            total assigned
          </span>
        </div>
      </div>

      {/* Filter strip */}
      <div className="px-6 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
          Filters
        </span>
        <Select<string>
          value={statusValue}
          onValueChange={onStatusFilterChange}
          options={STATUS_OPTIONS}
          aria-label="Status filter"
          className="w-48"
        />
        <Select<string>
          value={priorityValue}
          onValueChange={onPriorityFilterChange}
          options={PRIORITY_OPTIONS}
          aria-label="Priority filter"
          className="w-36"
        />
        <Select<string>
          value={dueValue}
          onValueChange={onDueFilterChange}
          options={DUE_OPTIONS}
          aria-label="Due date filter"
          className="w-40"
        />
        <button
          type="button"
          onClick={() => { setIncludePreAcceptance(!includePreAcceptance); }}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs ${
            includePreAcceptance
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'border-dashed border-input text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="Lock" size="xs" />
          {includePreAcceptance
            ? 'Hide pre-acceptance assignments'
            : 'Show pre-acceptance assignments'}
        </button>
      </div>

      {/* Task list */}
      <div className="bg-card">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">
            Loading your tasks…
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-3">
              <Icon name="CheckCircle2" size="lg" className="text-teal-700" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No tasks assigned to you</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {includePreAcceptance
                ? "You're all caught up — no active or pre-acceptance assignments match these filters."
                : "Nothing actionable right now. Pre-acceptance assignments are hidden — toggle 'Show pre-acceptance' if you want to see what's coming."}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={`${task.classification_id}::${String(task.step.step)}`}
              task={task}
              onMutated={handleMutated}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {total > pageSize ? (
        <div className="px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {String((page - 1) * pageSize + 1)}–
            {String(Math.min(page * pageSize, total))} of {String(total)}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { setPage(Math.max(1, page - 1)); }}
              disabled={page <= 1}
              className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-40"
            >
              <Icon name="ChevronLeft" size="xs" />
            </button>
            <span className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">
              {String(page)}
            </span>
            <button
              type="button"
              onClick={() => { setPage(page + 1); }}
              disabled={!hasMore}
              className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-40"
            >
              <Icon name="ChevronRight" size="xs" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
