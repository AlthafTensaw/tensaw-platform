/**
 * useWorklistUrlState (v4.1) — worklist URL params for the engine-handler model.
 *
 * Filter changes from v4.0.0:
 *   - DROPPED `category` (the LLM category lives on case detail, not on the
 *     dispatched-task worklist row).
 *   - ADDED `task_type` (first-class — it's the routing key, handoff §4/§7).
 *   - ADDED `is_high_dollar` (flag toggle — HD is a flag, not a queue, §7).
 *   - Kept clinic/payer cascade + aging + priority.
 *
 * URL conventions:
 *   ?queue=<team>           — active team queue (read by useTeamQueue)
 *   ?case=<case_id>         — selected case
 *   ?task_type=<TYPE>       — task type filter (single-select chip)
 *   ?clinic_id=<id>         — clinic filter
 *   ?primary_payer_id=<id>  — payer filter (requires clinic_id)
 *   ?aging=<bucket>         — aging bucket filter
 *   ?priority=<l|n|h>       — priority filter
 *   ?hd=1                   — high-dollar-only toggle
 *   ?page=<n>               — page (1-indexed)
 *
 * Drop-in path: src/hooks/useWorklistUrlState.ts
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TaskTypeSchema, type TaskType, type Priority } from '../actions/schemas';

export interface WorklistFiltersV41 {
  task_type: TaskType | null;
  clinic_id: string | null;
  primary_payer_id: string | null;
  aging_bucket: string | null;
  priority: Priority | null;
  is_high_dollar: boolean;
}

const FILTER_KEYS = [
  'task_type',
  'clinic_id',
  'primary_payer_id',
  'aging_bucket',
  'priority',
  'is_high_dollar',
] as const satisfies readonly (keyof WorklistFiltersV41)[];

export interface WorklistUrlStateV41 {
  filters: WorklistFiltersV41;
  page: number;
  selectedCaseId: string | null;
  hasAnyFilter: boolean;
  setFilter: <K extends keyof WorklistFiltersV41>(key: K, value: WorklistFiltersV41[K]) => void;
  toggleHighDollar: () => void;
  clearAllFilters: () => void;
  setPage: (page: number) => void;
}

function isValidPriority(v: string): v is Priority {
  return v === 'low' || v === 'normal' || v === 'high';
}

export function useWorklistUrlState(): WorklistUrlStateV41 {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: WorklistFiltersV41 = useMemo(() => {
    const taskTypeRaw = searchParams.get('task_type');
    const taskTypeParsed = taskTypeRaw !== null ? TaskTypeSchema.safeParse(taskTypeRaw) : null;
    const priorityRaw = searchParams.get('priority');
    return {
      task_type: taskTypeParsed?.success ? taskTypeParsed.data : null,
      clinic_id: searchParams.get('clinic_id'),
      primary_payer_id: searchParams.get('primary_payer_id'),
      aging_bucket: searchParams.get('aging'),
      priority: priorityRaw !== null && isValidPriority(priorityRaw) ? priorityRaw : null,
      is_high_dollar: searchParams.get('hd') === '1',
    };
  }, [searchParams]);

  const pageRaw = searchParams.get('page');
  const page = pageRaw !== null ? Math.max(1, Number(pageRaw) || 1) : 1;
  const selectedCaseId = searchParams.get('case');

  const hasAnyFilter = FILTER_KEYS.some((k) => {
    const v = filters[k];
    return k === 'is_high_dollar' ? v === true : v !== null;
  });

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
    <K extends keyof WorklistFiltersV41>(key: K, value: WorklistFiltersV41[K]) => {
      const next = snapshotParams();
      const urlKey = key === 'aging_bucket' ? 'aging' : key === 'is_high_dollar' ? 'hd' : key;

      if (key === 'is_high_dollar') {
        if (value === true) next.hd = '1';
        else delete next.hd;
      } else if (value === null || value === '') {
        delete next[urlKey];
      } else {
        next[urlKey] = String(value);
      }

      // Setting any filter resets page
      delete next.page;
      // Cascade: clearing clinic clears payer
      if (key === 'clinic_id' && (value === null || value === '')) {
        delete next.primary_payer_id;
      }
      setSearchParams(next);
    },
    [snapshotParams, setSearchParams],
  );

  const toggleHighDollar = useCallback(() => {
    const next = snapshotParams();
    if (next.hd === '1') delete next.hd;
    else next.hd = '1';
    delete next.page;
    setSearchParams(next);
  }, [snapshotParams, setSearchParams]);

  const clearAllFilters = useCallback(() => {
    const next = snapshotParams();
    for (const k of ['task_type', 'clinic_id', 'primary_payer_id', 'aging', 'priority', 'hd', 'page']) {
      delete next[k];
    }
    setSearchParams(next);
  }, [snapshotParams, setSearchParams]);

  const setPage = useCallback(
    (newPage: number) => {
      const next = snapshotParams();
      if (newPage <= 1) delete next.page;
      else next.page = String(newPage);
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
    toggleHighDollar,
    clearAllFilters,
    setPage,
  };
}
