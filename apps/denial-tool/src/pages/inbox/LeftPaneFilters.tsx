/**
 * LeftPaneFilters — compact filter chip row for the left pane.
 *
 * 7 chips matching the v3.0.1 mockup:
 *   - State (default: Recommended)
 *   - Category
 *   - Payer
 *   - Clinic       ← new in v3.0
 *   - Aging
 *   - Assigned to  ← new in v3.0 (needs BE Ask 7)
 *   - $ pending    ← new in v3.0 (needs BE Ask 7)
 *
 * Each chip is a dropdown trigger. Click → opens a small popover with
 * options. For mockup MVP we use native <select>; v3.1 can swap to
 * a richer popover.
 *
 * Active chip styling: primary-soft bg, shows selected value.
 * Inactive: white bg, shows just the dimension name.
 */

import { useMemo } from 'react';
import type { WorklistFilters } from '../../hooks/useWorklistFilters';
import {
  CATEGORY_VALUES,
  ClassificationStateEnum,
} from '../../actions/schemas';

interface LeftPaneFiltersProps {
  filters: WorklistFilters;
  setFilter: <K extends keyof WorklistFilters>(
    key: K,
    value: WorklistFilters[K],
  ) => void;
}

const STATE_OPTIONS = ClassificationStateEnum.options.map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

const AGING_OPTIONS = [
  { value: '0-29 day', label: '0–29d' },
  { value: '30-59 day', label: '30–59d' },
  { value: '60-89 day', label: '60–89d' },
  { value: '90-119 day', label: '90–119d' },
  { value: '120-179 day', label: '120–179d' },
  { value: '180+ day', label: '180+d' },
];

const AMOUNT_OPTIONS = [
  { value: '0', label: '< $250' },
  { value: '250', label: '$250–500' },
  { value: '500', label: '$500–1k' },
  { value: '1000', label: '$1k+' },
];

export function LeftPaneFilters({
  filters,
  setFilter,
}: LeftPaneFiltersProps): JSX.Element {
  const categoryOptions = useMemo(
    () => CATEGORY_VALUES.map((v) => ({ value: v, label: v })),
    [],
  );

  return (
    <div className="flex flex-wrap gap-1">
      <Chip
        active={filters.state !== undefined && filters.state !== 'recommended'}
        label={
          filters.state !== undefined
            ? `State: ${capitalize(filters.state)}`
            : 'State'
        }
      >
        <select
          value={filters.state ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilter(
              'state',
              v === ''
                ? undefined
                : (v as WorklistFilters['state']),
            );
          }}
          className="ChipNativeSelect"
        >
          <option value="">Any state</option>
          {STATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Chip>

      <Chip
        active={filters.primary_category !== undefined}
        label={
          filters.primary_category !== undefined
            ? truncateChipLabel(filters.primary_category)
            : 'Category'
        }
      >
        <select
          value={filters.primary_category ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilter('primary_category', v === '' ? undefined : v);
          }}
          className="ChipNativeSelect"
        >
          <option value="">Any category</option>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Chip>

      <Chip
        active={filters.payer_name !== undefined}
        label={filters.payer_name ?? 'Payer'}
      >
        <select
          value={filters.payer_name ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilter('payer_name', v === '' ? undefined : v);
          }}
          className="ChipNativeSelect"
        >
          <option value="">Any payer</option>
          <option value="Humana">Humana</option>
          <option value="BCBS of Texas">BCBS-TX</option>
          <option value="UHC Medicare">UHC Mcare</option>
          <option value="Cigna">Cigna</option>
          <option value="Texas Medicaid">TX Mcaid</option>
        </select>
      </Chip>

      {/* Clinic — new in v3.0 */}
      <Chip
        active={
          (filters as unknown as { clinic_id?: number | undefined })
            .clinic_id !== undefined
        }
        label="Clinic"
      >
        <select
          onChange={(e) => {
            const v = e.target.value;
            (
              setFilter as unknown as (
                k: string,
                v: number | undefined,
              ) => void
            )('clinic_id', v === '' ? undefined : Number(v));
          }}
          className="ChipNativeSelect"
        >
          <option value="">Any clinic</option>
          <option value="1">Beats Card</option>
          <option value="2">Mercy Onc</option>
          <option value="3">Plano Card</option>
        </select>
      </Chip>

      <Chip
        active={filters.age_bucket !== undefined}
        label={
          filters.age_bucket !== undefined
            ? AGING_OPTIONS.find((o) => o.value === filters.age_bucket)
                ?.label ?? 'Aging'
            : 'Aging'
        }
      >
        <select
          value={filters.age_bucket ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilter('age_bucket', v === '' ? undefined : v);
          }}
          className="ChipNativeSelect"
        >
          <option value="">Any aging</option>
          {AGING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Chip>

      {/* Assigned to — new in v3.0 */}
      <Chip
        active={
          (filters as unknown as { assigned_to_user_id?: number })
            .assigned_to_user_id !== undefined
        }
        label="Assigned"
      >
        <select
          onChange={(e) => {
            const v = e.target.value;
            (
              setFilter as unknown as (
                k: string,
                v: number | undefined,
              ) => void
            )('assigned_to_user_id', v === '' ? undefined : Number(v));
          }}
          className="ChipNativeSelect"
        >
          <option value="">Any assignee</option>
          <option value="101">Vipin K.</option>
          <option value="102">Bhavana R.</option>
          <option value="103">Aniket S.</option>
          <option value="104">Renita M.</option>
        </select>
      </Chip>

      {/* $ pending — new in v3.0 */}
      <Chip
        active={
          (filters as unknown as { min_net_pending?: string })
            .min_net_pending !== undefined
        }
        label="$ Range"
      >
        <select
          onChange={(e) => {
            const v = e.target.value;
            (
              setFilter as unknown as (
                k: string,
                v: string | undefined,
              ) => void
            )('min_net_pending', v === '' ? undefined : v);
          }}
          className="ChipNativeSelect"
        >
          <option value="">Any amount</option>
          {AMOUNT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Chip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip wrapper component
// ---------------------------------------------------------------------------

function Chip({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label
      className={[
        'relative inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px]',
        active
          ? 'bg-primary/15 font-medium text-primary-foreground/90'
          : 'border border-border bg-background text-foreground',
      ].join(' ')}
      style={
        active
          ? { color: '#134e4a', backgroundColor: '#ccfbf1' }
          : undefined
      }
    >
      {label}
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {/* Native select overlaid invisibly for click handling */}
      <span className="absolute inset-0 opacity-0">{children}</span>
    </label>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncateChipLabel(s: string): string {
  // Categories can be long ("Vague Denial / Need Payer Call"); chip stays compact.
  if (s.length <= 16) return s;
  return `${s.slice(0, 15)}…`;
}
