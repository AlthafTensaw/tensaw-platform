/**
 * DenialFilterStrip — denial-tool filter row.
 *
 * PR-6: composes the platform <FilterStrip> from @tensaw/worklist
 * with denial-specific filter chips. Each chip wraps a small Select
 * from @tensaw/design-system/forms (single-select; the backend's
 * worklist filters take scalar params, not arrays).
 *
 * The local-storage persistence + URL-state hydration sit one layer
 * up in useWorklistFilters. This component is purely presentational.
 */

import { FilterStrip } from '@tensaw/worklist';
import { Select } from '@tensaw/design-system/forms';
import { Pill } from '@tensaw/design-system/feedback';
import {
  CATEGORY_VALUES,
  PriorityChipEnum,
  ClassificationStateEnum,
} from '../actions/schemas';
import type { WorklistFilters } from '../hooks/useWorklistFilters';
import { WORKLIST_FIXTURE_META } from '@tensaw/mock-server';

interface DenialFilterStripProps {
  filters: WorklistFilters;
  onChange: (next: WorklistFilters) => void;
}

const STATE_OPTIONS = ClassificationStateEnum.options.map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

const CATEGORY_OPTIONS = [{ value: '_all_', label: 'Any category' }].concat(
  CATEGORY_VALUES.map((v) => ({ value: v, label: v })),
);

const PRIORITY_OPTIONS = [{ value: '_all_', label: 'Any priority' }].concat(
  PriorityChipEnum.options.map((v) => ({ value: v, label: v })),
);

const AGING_OPTIONS = [
  { value: '_all_', label: 'Any aging' },
  { value: '0-29 day', label: '0–29 days' },
  { value: '30-59 day', label: '30–59 days' },
  { value: '60-89 day', label: '60–89 days' },
  { value: '90-119 day', label: '90–119 days' },
  { value: '120-179 day', label: '120–179 days' },
  { value: '180+ day', label: '180+ days' },
];

const PAYER_OPTIONS = [{ value: '_all_', label: 'Any payer' }].concat(
  WORKLIST_FIXTURE_META.payers.map((p: string) => ({ value: p, label: p })),
);

const OWNER_OPTIONS = [{ value: '_all_', label: 'Any owner' }].concat(
  WORKLIST_FIXTURE_META.recommended_owners.map((o: string) => ({ value: o, label: o })),
);

export function DenialFilterStrip({
  filters,
  onChange,
}: DenialFilterStripProps) {
  const update = (patch: Partial<WorklistFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <FilterStrip>
      <Select
        value={filters.state ?? 'recommended'}
        onValueChange={(v: string) =>
          update({ state: v as WorklistFilters['state'] })
        }
        options={STATE_OPTIONS}
        aria-label="State"
        className="w-44 bg-transparent"
      />
      <Select
        value={filters.primary_category ?? '_all_'}
        onValueChange={(v: string) =>
          update({ primary_category: v === '_all_' ? undefined : v })
        }
        options={CATEGORY_OPTIONS}
        aria-label="Category"
        className="w-56 bg-transparent"
      />
      <Select
        value={filters.payer_name ?? '_all_'}
        onValueChange={(v: string) => update({ payer_name: v === '_all_' ? undefined : v })}
        options={PAYER_OPTIONS}
        aria-label="Payer"
        className="w-44 bg-transparent"
      />
      <Select
        value={filters.recommended_owner ?? '_all_'}
        onValueChange={(v: string) =>
          update({ recommended_owner: v === '_all_' ? undefined : v })
        }
        options={OWNER_OPTIONS}
        aria-label="Owner"
        className="w-44 bg-transparent"
      />
      <Select
        value={filters.age_bucket ?? '_all_'}
        onValueChange={(v: string) => update({ age_bucket: v === '_all_' ? undefined : v })}
        options={AGING_OPTIONS}
        aria-label="Aging"
        className="w-40 bg-transparent"
      />
      <Select
        value={filters.priority_chip ?? '_all_'}
        onValueChange={(v: string) =>
          update({
            priority_chip: (v === '_all_' ? undefined : v) as WorklistFilters['priority_chip'],
          })
        }
        options={PRIORITY_OPTIONS}
        aria-label="Priority"
        className="w-44 bg-transparent"
      />

      {filters.requires_human_review ? (
        <Pill
          variant="subtle"
          removable
          onRemove={() =>
            update({ requires_human_review: undefined })
          }
        >
          Review only
        </Pill>
      ) : (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground px-2"
          onClick={() =>
            update({ requires_human_review: true })
          }
        >
          + Review only
        </button>
      )}
    </FilterStrip>
  );
}
