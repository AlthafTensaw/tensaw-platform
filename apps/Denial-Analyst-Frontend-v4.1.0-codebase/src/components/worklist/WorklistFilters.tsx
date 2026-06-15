/**
 * WorklistFilters (v4.1) — filter chip row for the engine-handler worklist.
 *
 * Chips: Task type (first-class), Clinic, Payer (cascade-gated), Aging,
 * Priority, + a High-dollar toggle. Category chip dropped (not a worklist
 * filter in v4.1).
 *
 * Self-contained FilterChip (intentionally not shared with the v4.0.0 filters
 * file, which is deleted in R12).
 *
 * Drop-in path: src/components/worklist/WorklistFilters.tsx
 */

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { useWorklistUrlState } from '../../hooks/useWorklistUrlState';
import { TaskTypeSchema, type TaskType, type Priority } from '../../actions/schemas';
import { TASK_TYPE_LABELS } from '../../lib/labels';

const AGING_BUCKETS = ['0-29 day', '30-59 day', '60-89 day', '90-119 day', '120-179 day', '180+ day'];
const PRIORITIES: Priority[] = ['high', 'normal', 'low'];

function priorityLabel(p: Priority): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function WorklistFiltersBar(): React.ReactElement {
  const { filters, hasAnyFilter, setFilter, toggleHighDollar, clearAllFilters } = useWorklistUrlState();

  const { data: clinicData } = useActionQuery('lookup.clinics', {});
  const { data: payerData } = useActionQuery(
    'lookup.payers',
    filters.clinic_id !== null ? { clinic_id: filters.clinic_id } : {},
  );

  const taskTypeOptions = (TaskTypeSchema.options as readonly TaskType[]).map((tt) => ({
    value: tt,
    label: TASK_TYPE_LABELS[tt],
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <FilterChip
        filterKey="task_type"
        label="Task"
        value={filters.task_type}
        valueLabel={filters.task_type !== null ? TASK_TYPE_LABELS[filters.task_type] : null}
        options={taskTypeOptions}
        onPick={(v) => setFilter('task_type', v as TaskType | null)}
      />
      <FilterChip
        filterKey="clinic_id"
        label="Clinic"
        value={filters.clinic_id}
        valueLabel={clinicData?.items.find((c) => c.id === filters.clinic_id)?.name ?? null}
        options={(clinicData?.items ?? []).map((c) => ({ value: c.id, label: c.alias ?? c.name }))}
        onPick={(v) => setFilter('clinic_id', v)}
      />
      <FilterChip
        filterKey="primary_payer_id"
        label="Payer"
        value={filters.primary_payer_id}
        valueLabel={payerData?.items.find((p) => p.id === filters.primary_payer_id)?.name ?? null}
        options={(payerData?.items ?? []).map((p) => ({ value: p.id, label: p.alias ?? p.name }))}
        onPick={(v) => setFilter('primary_payer_id', v)}
        disabled={filters.clinic_id === null}
        disabledHint="Pick a clinic first"
      />
      <FilterChip
        filterKey="aging_bucket"
        label="Aging"
        value={filters.aging_bucket}
        valueLabel={filters.aging_bucket}
        options={AGING_BUCKETS.map((b) => ({ value: b, label: b }))}
        onPick={(v) => setFilter('aging_bucket', v)}
      />
      <FilterChip
        filterKey="priority"
        label="Priority"
        value={filters.priority}
        valueLabel={filters.priority !== null ? priorityLabel(filters.priority) : null}
        options={PRIORITIES.map((p) => ({ value: p, label: priorityLabel(p) }))}
        onPick={(v) => setFilter('priority', v as Priority | null)}
      />

      {/* High-dollar toggle (flag, not a dropdown) */}
      <button
        type="button"
        aria-pressed={filters.is_high_dollar}
        data-filter-key="is_high_dollar"
        onClick={toggleHighDollar}
        className={`
          inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
          text-[11.5px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500
          ${filters.is_high_dollar
            ? 'border-amber-300 bg-amber-100 text-amber-900'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}
        `}
      >
        High-dollar
        {filters.is_high_dollar && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleHighDollar();
            }}
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] text-amber-800 hover:bg-amber-200"
            aria-label="Clear high-dollar filter"
          >
            ×
          </span>
        )}
      </button>

      {hasAnyFilter && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="
            ml-auto rounded px-2 py-1 text-[11px] font-medium text-slate-600
            hover:bg-slate-100 hover:text-slate-900
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ============================================================================
// FilterChip — self-contained dropdown chip
// ============================================================================

interface FilterChipProps {
  filterKey: string;
  label: string;
  value: string | null;
  valueLabel: string | null;
  options: Array<{ value: string; label: string }>;
  onPick: (value: string | null) => void;
  disabled?: boolean;
  disabledHint?: string;
}

function FilterChip({
  filterKey,
  label,
  value,
  valueLabel,
  options,
  onPick,
  disabled = false,
  disabledHint,
}: FilterChipProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent): void {
      if (rootRef.current === null) return;
      if (!rootRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  const handleKey = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  const isActive = value !== null;
  const triggerLabel = isActive && valueLabel !== null ? `${label}: ${valueLabel}` : label;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by ${label}`}
        data-filter-key={filterKey}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={handleKey}
        className={`
          inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
          text-[11.5px] font-medium
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:cursor-not-allowed disabled:opacity-50
          ${isActive
            ? 'border-blue-300 bg-blue-50 text-blue-900'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}
        `}
      >
        <span>{triggerLabel}</span>
        {isActive ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onPick(null);
            }}
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] text-blue-700 hover:bg-blue-200"
            aria-label={`Clear ${label} filter`}
          >
            ×
          </span>
        ) : (
          <ChevronIcon open={isOpen} />
        )}
      </button>

      {isOpen && !disabled && options.length > 0 && (
        <div
          role="listbox"
          aria-label={`${label} options`}
          className="
            absolute left-0 top-full z-30 mt-1 w-60
            overflow-hidden rounded-lg border border-slate-200 bg-white
            shadow-lg ring-1 ring-black/5
          "
        >
          <div className="max-h-64 overflow-auto py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onPick(opt.value);
                  setIsOpen(false);
                }}
                className={`
                  block w-full px-3 py-1.5 text-left text-[12px]
                  hover:bg-slate-100 focus:bg-slate-100 focus:outline-none
                  ${opt.value === value ? 'bg-blue-50 font-medium text-blue-900' : 'text-slate-700'}
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && !disabled && options.length === 0 && (
        <div
          role="status"
          className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] text-slate-500 shadow-lg"
        >
          No options available
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg
      width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
