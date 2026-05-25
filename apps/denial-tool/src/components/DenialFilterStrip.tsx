/**
 * DenialFilterStrip — denial-tool filter row.
 *
 * v2.0.3:
 *   - Props now match the actual useWorklistFilters API: setFilter (single-key
 *     setter), clearAll, filters typed as WorklistFilters
 *   - Select onValueChange (Radix), no `compact` prop
 *   - Sentinel "__any__" instead of "" (Radix forbids empty value)
 *   - Lucide PascalCase icon names via platform <Icon>
 *   - "+ Needs human review" label per May 22 analyst feedback
 */

import { FilterStrip } from '@tensaw/worklist';
import { Select } from '@tensaw/design-system/forms';
import { Icon } from '@tensaw/design-system/primitives';
import {
  CATEGORY_VALUES,
  PriorityChipEnum,
  ClassificationStateEnum,
  WORKLIST_FIXTURE_META,
} from '@tensaw/mock-server';
import type { WorklistFilters } from '../hooks/useWorklistFilters';

interface DenialFilterStripProps {
  filters: WorklistFilters;
  setFilter: <K extends keyof WorklistFilters>(key: K, value: WorklistFilters[K]) => void;
  clearAll: () => void;
}

const ANY = '__any__';

const STATE_OPTIONS = ClassificationStateEnum.options.map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

const CATEGORY_OPTIONS = [{ value: ANY, label: 'Any category' }].concat(
  CATEGORY_VALUES.map((v) => ({ value: v, label: v })),
);

const PRIORITY_OPTIONS = [{ value: ANY, label: 'Any priority' }].concat(
  PriorityChipEnum.options.map((v) => ({ value: v, label: v })),
);

const AGING_OPTIONS = [
  { value: ANY, label: 'Any aging' },
  { value: '0-29 day', label: '0–29 days' },
  { value: '30-59 day', label: '30–59 days' },
  { value: '60-89 day', label: '60–89 days' },
  { value: '90-119 day', label: '90–119 days' },
  { value: '120-179 day', label: '120–179 days' },
  { value: '180+ day', label: '180+ days' },
];

const PAYER_OPTIONS = [{ value: ANY, label: 'Any payer' }].concat(
  WORKLIST_FIXTURE_META.payers.map((p) => ({ value: p, label: p })),
);

const OWNER_OPTIONS = [{ value: ANY, label: 'Any owner' }].concat(
  WORKLIST_FIXTURE_META.recommended_owners.map((o) => ({ value: o, label: o })),
);

const fromSentinel = (v: string): string | undefined =>
  v === ANY ? undefined : v;

export function DenialFilterStrip({
  filters,
  setFilter,
}: DenialFilterStripProps): JSX.Element {
  return (
    <FilterStrip>
      <Select<string>
        value={filters.state ?? 'recommended'}
        onValueChange={(v) => { setFilter('state', v as WorklistFilters['state']); }}
        options={STATE_OPTIONS}
        aria-label="State"
        className="w-36"
      />
      <Select<string>
        value={filters.primary_category ?? ANY}
        onValueChange={(v) => { setFilter('primary_category', fromSentinel(v)); }}
        options={CATEGORY_OPTIONS}
        aria-label="Category"
        className="w-44"
      />
      <Select<string>
        value={filters.payer_name ?? ANY}
        onValueChange={(v) => { setFilter('payer_name', fromSentinel(v)); }}
        options={PAYER_OPTIONS}
        aria-label="Payer"
        className="w-44"
      />
      <Select<string>
        value={filters.recommended_owner ?? ANY}
        onValueChange={(v) => { setFilter('recommended_owner', fromSentinel(v)); }}
        options={OWNER_OPTIONS}
        aria-label="Owner"
        className="w-40"
      />
      <Select<string>
        value={filters.age_bucket ?? ANY}
        onValueChange={(v) => { setFilter('age_bucket', fromSentinel(v)); }}
        options={AGING_OPTIONS}
        aria-label="Aging"
        className="w-36"
      />
      <Select<string>
        value={filters.priority_chip ?? ANY}
        onValueChange={(v) => { setFilter('priority_chip', fromSentinel(v) as WorklistFilters['priority_chip']); }}
        options={PRIORITY_OPTIONS}
        aria-label="Priority"
        className="w-36"
      />

      {filters.requires_human_review ? (
        <button
          type="button"
          className="h-9 px-3 text-sm inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 text-teal-800 font-medium hover:bg-teal-100/80 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-shrink-0 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50 dark:hover:bg-teal-950/60"
          onClick={() => { setFilter('requires_human_review', undefined); }}
          aria-label="Remove Needs human review filter"
        >
          <span>Needs human review</span>
          <Icon name="X" size="xs" className="text-teal-600 dark:text-teal-400 hover:text-teal-950 dark:hover:text-teal-100" />
        </button>
      ) : (
        <button
          type="button"
          className="h-9 px-3 text-sm inline-flex items-center gap-1.5 rounded-md border border-dashed border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-shrink-0"
          onClick={() => { setFilter('requires_human_review', true); }}
        >
          <Icon name="Plus" size="sm" className="text-muted-foreground/80" />
          <span>Needs human review</span>
        </button>
      )}
    </FilterStrip>
  );
}
