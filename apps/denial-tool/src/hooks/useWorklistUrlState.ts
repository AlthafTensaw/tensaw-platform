/**
 * useWorklistUrlState — single source of truth for worklist URL params.
 *
 * URL conventions:
 *   ?queue=<id>             — the active queue (read here, written by QueueSwitcher)
 *   ?case=<case_id>         — the selected case (read here, written by CaseCard)
 *   ?category=<code>        — denial category filter
 *   ?clinic_id=<id>         — clinic filter
 *   ?primary_payer_id=<id>  — payer filter (requires clinic_id)
 *   ?aging=<bucket>         — aging bucket filter
 *   ?priority=<l|n|h>       — task priority filter
 *   ?page=<n>               — page number (1-indexed)
 *
 * Mutations:
 *   - Changing any filter resets page to 1
 *   - Changing queue (in QueueSwitcher) is separate — that hook also resets page
 *
 * Drop-in path: src/hooks/useWorklistUrlState.ts
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PriorityCode } from '../actions/schemas-v4';

export interface WorklistFilters {
  category: string | null;
  clinic_id: string | null;
  primary_payer_id: string | null;
  aging_bucket: string | null;
  priority: PriorityCode | null;
}

const EMPTY_FILTERS: WorklistFilters = {
  category: null,
  clinic_id: null,
  primary_payer_id: null,
  aging_bucket: null,
  priority: null,
};

const FILTER_KEYS = [
  'category',
  'clinic_id',
  'primary_payer_id',
  'aging_bucket',
  'priority',
] as const satisfies readonly (keyof WorklistFilters)[];

export interface WorklistUrlState {
  filters: WorklistFilters;
  page: number;
  selectedCaseId: string | null;
  hasAnyFilter: boolean;
  setFilter: <K extends keyof WorklistFilters>(key: K, value: WorklistFilters[K]) => void;
  clearAllFilters: () => void;
  setPage: (page: number) => void;
}

function isValidPriority(v: string): v is PriorityCode {
  return v === 'low' || v === 'normal' || v === 'high';
}

export function useWorklistUrlState(): WorklistUrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: WorklistFilters = useMemo(() => {
    const priorityRaw = searchParams.get('priority');
    return {
      category: searchParams.get('category'),
      clinic_id: searchParams.get('clinic_id'),
      primary_payer_id: searchParams.get('primary_payer_id'),
      aging_bucket: searchParams.get('aging'),
      priority: priorityRaw !== null && isValidPriority(priorityRaw) ? priorityRaw : null,
    };
  }, [searchParams]);

  const pageRaw = searchParams.get('page');
  const page = pageRaw !== null ? Math.max(1, Number(pageRaw) || 1) : 1;
  const selectedCaseId = searchParams.get('case');

  const hasAnyFilter = FILTER_KEYS.some((k) => filters[k] !== null);

  // Build a plain object snapshot for mutation
  const snapshotParams = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    const raw = searchParams.toString();
    if (raw.length === 0) return out;
    new URLSearchParams(raw).forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }, [searchParams]);

  const setFilter = useCallback(
    <K extends keyof WorklistFilters>(key: K, value: WorklistFilters[K]) => {
      const next = snapshotParams();
      const urlKey = key === 'aging_bucket' ? 'aging' : key;
      if (value === null || value === '') {
        delete next[urlKey];
      } else {
        next[urlKey] = String(value);
      }
      // Setting a filter resets page
      delete next.page;
      // If clinic is being cleared, also clear payer (cascade dependency)
      if (key === 'clinic_id' && (value === null || value === '')) {
        delete next.primary_payer_id;
      }
      setSearchParams(next);
    },
    [snapshotParams, setSearchParams],
  );

  const clearAllFilters = useCallback(() => {
    const next = snapshotParams();
    delete next.category;
    delete next.clinic_id;
    delete next.primary_payer_id;
    delete next.aging;
    delete next.priority;
    delete next.page;
    setSearchParams(next);
  }, [snapshotParams, setSearchParams]);

  const setPage = useCallback(
    (newPage: number) => {
      const next = snapshotParams();
      if (newPage <= 1) {
        delete next.page;
      } else {
        next.page = String(newPage);
      }
      setSearchParams(next);
    },
    [snapshotParams, setSearchParams],
  );

  return {
    filters,
    page,
    selectedCaseId,
    hasAnyFilter,
    setFilter,
    clearAllFilters,
    setPage,
  };
}

/** Exported for testing — what an empty filter set looks like. */
export { EMPTY_FILTERS };
