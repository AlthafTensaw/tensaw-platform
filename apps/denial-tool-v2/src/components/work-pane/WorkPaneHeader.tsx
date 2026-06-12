/**
 * WorkPaneHeader — claim banner shown across all WorkPane state branches.
 *
 * Per the design contract, this header is persistent: proposed, in-flight,
 * and completed views all show the same banner above their content.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ Patient, J · MRN 72834 · Claim 300138       [Proposed] [HD]  $230.00 │
 *   │ DOS 02/24/26 · LSAT · Dr. M. Patel · Humana GP                       │
 *   │ ┌─────────┬─────────┬─────────┬─────────┬─────────┐                  │
 *   │ │ Billed  │ Paid 1° │ Pending │ Aging   │ Cat     │                  │
 *   │ │ $250    │ $20     │ $230    │ 90-119d │ med_nec │                  │
 *   │ └─────────┴─────────┴─────────┴─────────┴─────────┘                  │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Drop-in path: src/components/work-pane/WorkPaneHeader.tsx
 */

import type { CaseDetail } from '../../actions/schemas-v4';
import {
  formatCurrency,
  formatDateShort,
} from '../../utils/formatters';
import {
  statePillStyle,
  categoryLabel,
  categoryColor,
  agingBucketTone,
} from '../../lib/labels';

export interface WorkPaneHeaderProps {
  case: CaseDetail;
}

export function WorkPaneHeader({ case: c }: WorkPaneHeaderProps): React.ReactElement {
  const pillStyle = statePillStyle(c.case_status);
  const agingTone = agingBucketTone(c.aging_bucket);
  const dotColor = categoryColor(c.recommended_category);

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      {/* Line 1 — patient identity + pills + $ */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
          <h2 className="truncate text-lg font-semibold text-slate-900">
            {c.patient_name ?? 'Unknown patient'}
          </h2>
          <span className="text-[12px] text-slate-500">
            MRN <span className="font-mono">{c.mrn}</span>
          </span>
          <span className="text-[12px] text-slate-500">
            Claim <span className="font-mono">{c.claim_id}</span>
          </span>
          <span
            className={`
              inline-flex items-center rounded px-2 py-0.5
              text-[10.5px] font-semibold uppercase tracking-wide
              ${pillStyle.bgClass} ${pillStyle.textClass}
            `}
          >
            {pillStyle.label}
          </span>
          {c.is_high_dollar && (
            <span
              title="High-dollar case (≥$750 pending)"
              className="
                inline-flex items-center rounded border border-amber-300 bg-amber-100
                px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-900
              "
            >
              HD
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums text-slate-900">
            {formatCurrency(c.net_pending)}
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
            pending
          </div>
        </div>
      </div>

      {/* Line 2 — DOS, clinic, provider, payer */}
      <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-600 flex-wrap">
        <span>DOS <span className="font-medium">{formatDateShort(c.dos)}</span></span>
        <Dot />
        <span>{c.clinic_alias ?? c.clinic_name ?? '—'}</span>
        {c.provider_name !== null && (
          <>
            <Dot />
            <span>{c.provider_name}</span>
          </>
        )}
        <Dot />
        <span>{c.primary_payer_alias ?? c.primary_payer_name ?? '—'}</span>
        {c.facility_name !== null && (
          <>
            <Dot />
            <span className="text-slate-500">{c.facility_name}</span>
          </>
        )}
      </div>

      {/* Stat tile row */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        <StatTile label="Billed" value={formatCurrency(c.billed)} />
        <StatTile label="Paid 1°" value={formatCurrency(c.paid_primary)} />
        <StatTile label="Pending 1°" value={formatCurrency(c.pending_primary)} accent />
        <StatTile
          label="Aging"
          value={c.aging_bucket ?? '—'}
          tone={agingTone === 'severe' ? 'red' : agingTone === 'warning' ? 'amber' : 'normal'}
        />
        <StatTile
          label="Category"
          value={categoryLabel(c.recommended_category)}
          icon={<CategoryDot color={dotColor} />}
        />
      </div>

      {/* ICD codes row — only if present */}
      {c.icd_codes.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="uppercase tracking-wider">ICD</span>
          {c.icd_codes.map((code) => (
            <span
              key={code}
              className="
                inline-flex items-center rounded border border-slate-200
                bg-slate-50 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-700
              "
            >
              {code}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function Dot(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-300"
    />
  );
}

interface StatTileProps {
  label: string;
  value: string;
  tone?: 'normal' | 'red' | 'amber';
  accent?: boolean;
  icon?: React.ReactNode;
}

function StatTile({ label, value, tone = 'normal', accent = false, icon }: StatTileProps): React.ReactElement {
  const valueClass =
    tone === 'red' ? 'text-red-700' :
    tone === 'amber' ? 'text-amber-800' :
    accent ? 'text-slate-900 font-semibold' :
    'text-slate-800';

  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 flex items-center gap-1 text-[12px] tabular-nums ${valueClass}`}>
        {icon}
        <span className="truncate" title={value}>{value}</span>
      </div>
    </div>
  );
}

function CategoryDot({ color }: { color: string }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}
