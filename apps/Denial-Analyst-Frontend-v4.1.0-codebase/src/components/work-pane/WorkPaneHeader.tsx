/**
 * WorkPaneHeader (v4.1) — case context header for the work area.
 *
 * Shows claim identity + financial tiles + the current engine state_code +
 * the HD flag. Drops the v4.0.0 case_status pill (no lifecycle in the
 * engine-handler model — a case's position is its state_code + open tasks).
 *
 * Drop-in path: src/components/work-pane/WorkPaneHeader.tsx
 */

import type { CaseDetail } from '../../actions/schemas';
import { formatCurrencyStr } from '../../lib/labels';
import { formatDateShort } from '../../utils/formatters';

export interface WorkPaneHeaderProps {
  detail: CaseDetail;
}

export function WorkPaneHeader({ detail }: WorkPaneHeaderProps): React.ReactElement {
  const isHD = detail.case_facts.is_high_dollar === true;

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[16px] font-semibold text-slate-900">
              {detail.patient_name ?? 'Unknown patient'}
            </h2>
            {isHD && <HDBadge />}
            {detail.state_code !== null && <StateBadge state={detail.state_code} />}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] tabular-nums text-slate-500">
            MRN {detail.mrn}
            {' · '}DOS {formatDateShort(detail.dos)}
            {' · '}Claim #{detail.claim_id}
            {detail.provider_name !== null && <> · {detail.provider_name}</>}
            {detail.facility_name !== null && <> · {detail.facility_name}</>}
          </div>
        </div>
        {detail.icd_codes.length > 0 && (
          <div className="flex flex-shrink-0 items-center gap-1">
            {detail.icd_codes.slice(0, 3).map((code) => (
              <span
                key={code}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-700"
              >
                {code}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Financial tiles */}
      <div className="mt-2 grid grid-cols-5 gap-2">
        <Tile label="Billed" value={formatCurrencyStr(detail.billed)} />
        <Tile label="Paid" value={formatCurrencyStr(detail.paid_primary)} tone="paid" />
        <Tile label="Pending 1°" value={formatCurrencyStr(detail.pending_primary)} />
        <Tile label="Net" value={formatCurrencyStr(detail.net_pending)} tone={isHD ? 'hd' : undefined} />
        <Tile label="Payer" value={detail.primary_payer_name ?? '—'} small />
      </div>
    </header>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

interface TileProps {
  label: string;
  value: string;
  tone?: 'paid' | 'hd';
  small?: boolean;
}

function Tile({ label, value, tone, small }: TileProps): React.ReactElement {
  const border = tone === 'hd' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50';
  const valueColor = tone === 'paid' ? 'text-emerald-700' : tone === 'hd' ? 'text-amber-800' : 'text-slate-900';
  return (
    <div className={`rounded border px-2.5 py-1.5 ${border}`}>
      <div className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`${small ? 'text-[12px] font-medium leading-tight' : 'text-[13px] font-semibold tabular-nums'} ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: string }): React.ReactElement {
  const resolved = state === 'RESOLVED';
  return (
    <span
      className={`
        inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide
        ${resolved ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}
      `}
    >
      {state}
    </span>
  );
}

function HDBadge(): React.ReactElement {
  return (
    <span
      title="High-dollar case (≥$750 pending)"
      className="inline-flex items-center rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-900"
    >
      HD
    </span>
  );
}
