/**
 * Worklist column cells.
 *
 * PR-6: drops custom <PriorityChip>, <AgingChip>, <CurrentStatusBadge>
 * components — each is now Pill rendered inline with the right tone.
 * ConfidenceDot stays custom (just a 6px colored dot; no platform
 * equivalent). NextActionCell advances through completed steps as
 * PR-5 already wired.
 */

import { Badge } from '@tensaw/design-system/feedback';
import type {
  Confidence,
  PriorityChip as PriorityChipValue,
  WorklistRow,
} from '../../actions/schemas';

// -- Confidence dot (custom — no platform equivalent) -----------------------

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: 'bg-teal-600',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
};

export function ConfidenceDot({ value }: { value: Confidence }) {
  return (
    <span
      className={[
        'inline-block w-2 h-2 rounded-full',
        CONFIDENCE_COLOR[value],
      ].join(' ')}
      aria-label={`${value} confidence`}
      role="img"
    />
  );
}

// -- Priority chip — Pill with per-chip tone --------------------------------

const PRIORITY_VARIANT: Record<PriorityChipValue, 'warning' | 'error' | 'neutral' | 'outline'> = {
  HIGH_DOLLAR: 'warning',
  LOW_CONFIDENCE: 'warning',
  DUP_INVESTIGATE: 'neutral',
  TF_WATCH: 'error',
  OVERRIDE_PATTERN: 'outline',
  DATA_ERROR: 'error',
};

function PriorityBadge({ value }: { value: PriorityChipValue }) {
  return (
    <Badge
      variant={PRIORITY_VARIANT[value]}
      size="sm"
      className="text-[10px] uppercase tracking-wide"
    >
      {value}
    </Badge>
  );
}

// -- Aging chip — Pill, color depends on bucket -----------------------------

function agingVariant(bucket: string | null): 'success' | 'warning' | 'error' | 'neutral' {
  if (!bucket) return 'neutral';
  if (bucket.startsWith('0-') || bucket.startsWith('30-')) return 'success';
  if (bucket.startsWith('60-') || bucket.startsWith('90-')) return 'warning';
  return 'error'; // 120+, 180+
}

export function AgingCell({ row }: { row: WorklistRow }) {
  const bucket = row.claim.aging_bucket;
  return (
    <Badge variant={agingVariant(bucket)} size="sm">
      {bucket ?? '—'}
    </Badge>
  );
}

// -- Current status badge (D-13) --------------------------------------------

function currentStatusVariant(
  label: string | null,
): 'success' | 'info' | 'warning' | 'neutral' {
  if (!label || label === 'Denied') return 'neutral';
  if (label === 'Paid' || label === 'Filed') return 'success';
  if (label === 'Clari Opened') return 'warning';
  return 'info';
}

export function CurrentStatusCell({ row }: { row: WorklistRow }) {
  const label = row.claim.current_status_label;
  if (!label || label === 'Denied') return null; // collapse the noise — Denied is implicit
  return (
    <Badge variant={currentStatusVariant(label)} size="sm">
      {label}
    </Badge>
  );
}

// -- Claim + patient cell ---------------------------------------------------

export function ClaimPatientCell({ row }: { row: WorklistRow }) {
  return (
    <div>
      <div className="font-medium text-sm">
        {row.claim.claim_id}
        {' · '}
        <span className="text-muted-foreground tracking-wider">•••••••••</span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {row.claim.primary_payer_name ?? '—'} · {row.claim.aging_bucket ?? '—'}
      </div>
    </div>
  );
}

// -- Category + chips cell --------------------------------------------------

export function CategoryCell({ row }: { row: WorklistRow }) {
  const c = row.classification;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm">
        <ConfidenceDot value={c.confidence} />
        <span>{c.primary_category}</span>
      </div>
      {c.priority_chips.length > 0 ? (
        <div className="mt-1 flex gap-1 flex-wrap">
          {c.priority_chips.map((chip) => (
            <PriorityBadge key={chip} value={chip} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// -- State pill -------------------------------------------------------------

const STATE_VARIANT = {
  recommended: 'info',
  accepted: 'success',
  overridden: 'warning',
  completed: 'neutral',
} as const;

export function StateCell({ row }: { row: WorklistRow }) {
  const state = row.classification.state;
  return (
    <Badge
      variant={STATE_VARIANT[state]}
      size="sm"
    >
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </Badge>
  );
}

// -- Next action cell (PR-5: first incomplete step) -------------------------

export function NextActionCell({ row }: { row: WorklistRow }) {
  const steps = row.classification.workflow_steps;
  const firstIncomplete = steps.find((s) => !s.completed_at);
  const allComplete = steps.length > 0 && !firstIncomplete;

  if (steps.length === 0) {
    return (
      <span className="text-muted-foreground italic text-xs">
        No action steps defined yet
      </span>
    );
  }
  if (allComplete) {
    return (
      <span className="text-teal-700 text-xs font-medium">
        ✓ All steps complete
      </span>
    );
  }
  if (!firstIncomplete) {
    return null;
  }
  return (
    <div className="text-xs">
      <div className="font-medium">{firstIncomplete.action}</div>
      <div className="text-muted-foreground mt-0.5">
        {firstIncomplete.owner} · {firstIncomplete.sla_days} day SLA
      </div>
    </div>
  );
}

// -- Net pending money cell -------------------------------------------------

export function NetPendingCell({ row }: { row: WorklistRow }) {
  const value = row.claim.net_pending;
  const parts = value.split('.');
  const intPart = parts[0] || '';
  const decPart = parts[1] || '00';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (
    <span className="tabular-nums font-medium">
      ${grouped}.{decPart.padEnd(2, '0').slice(0, 2)}
    </span>
  );
}
