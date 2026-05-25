/**
 * useTasksMine — single hook for the My Tasks page.
 *
 * Wraps `useActionQuery<'denial.list-tasks-mine'>` with filter + page state
 * managed locally. Filters are sent server-side so pagination + sort stay
 * correct across pages.
 *
 * Identity is JWT-derived server-side (v1.8.1 — no user_id param). In
 * mock-server dev mode, the X-Mock-User-Id header is set on the dispatcher
 * to pin which user the demo represents.
 */

import { useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import type {
  StepPriority,
  StepStatus,
  TasksMineResponse,
} from '../actions/schemas';

export interface TasksMineFilters {
  status: StepStatus[];        // default: ['pending', 'in_progress']
  priority: StepPriority[];    // default: [] (any)
  due_before: string | null;
  due_after: string | null;
  primary_category: string | null;
}

export const DEFAULT_TASKS_FILTERS: TasksMineFilters = {
  status: ['pending', 'in_progress'],
  priority: [],
  due_before: null,
  due_after: null,
  primary_category: null,
};

interface UseTasksMineResult {
  tasks: TasksMineResponse['tasks'];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  refetch: () => void;
  filters: TasksMineFilters;
  setFilter: <K extends keyof TasksMineFilters>(
    key: K,
    value: TasksMineFilters[K],
  ) => void;
  setPage: (next: number) => void;
  includePreAcceptance: boolean;
  setIncludePreAcceptance: (next: boolean) => void;
}

const PAGE_SIZE = 50;

export function useTasksMine(): UseTasksMineResult {
  const [filters, setFilters] = useState<TasksMineFilters>(DEFAULT_TASKS_FILTERS);
  const [page, setPage] = useState(1);
  const [includePreAcceptance, setIncludePreAcceptance] = useState(false);

  const request = useMemo(
    () => ({
      status: filters.status,
      priority: filters.priority,
      due_before: filters.due_before ?? undefined,
      due_after: filters.due_after ?? undefined,
      primary_category: filters.primary_category ?? undefined,
      include_pre_acceptance: includePreAcceptance,
      page,
      page_size: PAGE_SIZE,
    }),
    [filters, page, includePreAcceptance],
  );

  const { data, isLoading, refetch } = useActionQuery<TasksMineResponse>(
    'denial.list-tasks-mine',
    request,
  );

  const setFilter = <K extends keyof TasksMineFilters>(
    key: K,
    value: TasksMineFilters[K],
  ): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // any filter change resets to page 1
  };

  return {
    tasks: data?.tasks ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.page_size ?? PAGE_SIZE,
    hasMore: data?.has_more ?? false,
    isLoading,
    refetch: () => { refetch(); },
    filters,
    setFilter,
    setPage,
    includePreAcceptance,
    setIncludePreAcceptance,
  };
}
