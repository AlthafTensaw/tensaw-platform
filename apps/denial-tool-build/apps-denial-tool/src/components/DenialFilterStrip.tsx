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
  type WorklistRequest,
} from '../actions/schemas';
import { WORKLIST_FIXTURE_META } from '@tensaw/mock-server/fixtures/denial';

interface DenialFilterStripProps {
  filters: WorklistRequest;
  onChange: (next: WorklistRequest) => void;
}

const STATE_OPTIONS = ClassificationStateEnum.options.map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

const CATEGORY_OPTIONS = [{ value: '', label: 'Any category' }].concat(
  CATEGORY_VALUES.map((v) => ({ value: v, label: v })),
);

const PRIORITY_OPTIONS = [{ value: '', label: 'Any priority' }].concat(
  PriorityChipEnum.options.map((v) => ({ value: v, label: v })),
);

const AGING_OPTIONS = [
  { value: '', label: 'Any aging' },
  { value: '0-29 day', label: '0–29 days' },
  { value: '30-59 day', label: '30–59 days' },
  { value: '60-89 day', label: '60–89 days' },
  { value: '90-119 day', label: '90–119 days' },
  { value: '120-179 day', label: '120–179 days' },
  { value: '180+ day', label: '180+ days' },
];

const PAYER_OPTIONS = [{ value: '', label: 'Any payer' }].concat(
  WORKLIST_FIXTURE_META.payers.map((p) => ({ value: p, label: p })),
);

const OWNER_OPTIONS = [{ value: '', label: 'Any owner' }].concat(
  WORKLIST_FIXTURE_META.owners.map((o) => ({ value: o, label: o })),
);

export function DenialFilterStrip({
  filters,
  onChange,
}: DenialFilterStripProps) {
  const update = (patch: Partial<WorklistRequest>) =>
    onChange({ ...filters, ...patch });

  return (
    <FilterStrip>
      <Select
        compact
        value={filters.state ?? 'recommended'}
        onChange={(v) =>
          update({ state: v as WorklistRequest['state'] })
        }
        options={STATE_OPTIONS}
        ariaLabel="State"
      />
      <Select
        compact
        value={filters.primary_category ?? ''}
        onChange={(v) =>
          update({ primary_category: v || undefined })
        }
        options={CATEGORY_OPTIONS}
        ariaLabel="Category"
      />
      <Select
        compact
        value={filters.payer_name ?? ''}
        onChange={(v) => update({ payer_name: v || undefined })}
        options={PAYER_OPTIONS}
        ariaLabel="Payer"
      />
      <Select
        compact
        value={filters.recommended_owner ?? ''}
        onChange={(v) =>
          update({ recommended_owner: v || undefined })
        }
        options={OWNER_OPTIONS}
        ariaLabel="Owner"
      />
      <Select
        compact
        value={filters.age_bucket ?? ''}
        onChange={(v) => update({ age_bucket: v || undefined })}
        options={AGING_OPTIONS}
        ariaLabel="Aging"
      />
      <Select
        compact
        value={filters.priority_chip ?? ''}
        onChange={(v) =>
          update({
            priority_chip: (v ||
              undefined) as WorklistRequest['priority_chip'],
          })
        }
        options={PRIORITY_OPTIONS}
        ariaLabel="Priority"
      />

      {filters.requires_human_review ? (
        <Pill
          variant="subtle"
          tone="amber"
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
          className="text-xs text-secondary hover:text-primary"
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
