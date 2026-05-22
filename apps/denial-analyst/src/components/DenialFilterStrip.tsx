/**
 * DenialFilterStrip — denial-tool filter row.
 *
 * PR-7 fixes:
 *   - Radix Select forbids value="" — use sentinel "__any__" for the
 *     "no filter" option, convert to undefined at the action-dispatch
 *     boundary (bug #3).
 *   - Token rewrites — text-muted-foreground, text-foreground.
 *   - 'aria-label' attribute spelling (platform expects the kebab form).
 */

import { FilterStrip } from '@tensaw/worklist';
import { Select } from '@tensaw/design-system/forms';
import { Pill } from '@tensaw/design-system/feedback';
import { Icon } from '@tensaw/design-system/primitives';
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

const ANY = '__any__'; // Radix-safe sentinel for "no filter selected"

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
  WORKLIST_FIXTURE_META.payers.map((p: string) => ({ value: p, label: p })),
);

const OWNER_OPTIONS = [{ value: ANY, label: 'Any owner' }].concat(
  WORKLIST_FIXTURE_META.recommended_owners.map((o: string) => ({ value: o, label: o })),
);

/** Convert sentinel back to undefined at the action-call boundary. */
const fromSentinel = (v: string): string | undefined =>
  v === ANY ? undefined : v;

export function DenialFilterStrip({
  filters,
  onChange,
}: DenialFilterStripProps) {
  const update = (patch: Partial<WorklistFilters>) =>
    { onChange({ ...filters, ...patch }); };

  return (
    <FilterStrip>
      <Select
        size="sm"
        value={filters.state ?? 'recommended'}
        onValueChange={(v: string) =>
          { update({ state: v as WorklistFilters['state'] }); }
        }
        options={STATE_OPTIONS}
        aria-label="State"
      />
      <Select
        size="sm"
        value={filters.primary_category ?? ANY}
        onValueChange={(v: string) =>
          { update({ primary_category: fromSentinel(v) }); }
        }
        options={CATEGORY_OPTIONS}
        aria-label="Category"
      />
      <Select
        size="sm"
        value={filters.payer_name ?? ANY}
        onValueChange={(v: string) => { update({ payer_name: fromSentinel(v) }); }}
        options={PAYER_OPTIONS}
        aria-label="Payer"
      />
      <Select
        size="sm"
        value={filters.recommended_owner ?? ANY}
        onValueChange={(v: string) =>
          { update({ recommended_owner: fromSentinel(v) }); }
        }
        options={OWNER_OPTIONS}
        aria-label="Owner"
      />
      <Select
        size="sm"
        value={filters.age_bucket ?? ANY}
        onValueChange={(v: string) => { update({ age_bucket: fromSentinel(v) }); }}
        options={AGING_OPTIONS}
        aria-label="Aging"
      />
      <Select
        size="sm"
        value={filters.priority_chip ?? ANY}
        onValueChange={(v: string) =>
          { update({
            priority_chip: fromSentinel(
              v,
            ) as WorklistFilters['priority_chip'],
          }); }
        }
        options={PRIORITY_OPTIONS}
        aria-label="Priority"
      />

      {filters.requires_human_review ? (
        <Pill
          variant="subtle"
          removable
          onRemove={() => { update({ requires_human_review: undefined }); }}
        >
          Review only
        </Pill>
      ) : (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          onClick={() => { update({ requires_human_review: true }); }}
        >
          <Icon name="Plus" size="xs" />
          Review only
        </button>
      )}
    </FilterStrip>
  );
}
