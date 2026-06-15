/**
 * AnalysisTab (v4.1) — denial analysis for the engine-handler model.
 *
 * Content shifts from v4.0.0's classification-centric view to the case_facts
 * the workflow has accumulated (handoff §8): engine state, clarification type,
 * high-dollar flag, appeal policy/level, root cause — plus the LLM
 * recommendation as context (reused LlmRecContext).
 *
 * Drop-in path: src/components/reference-panel/AnalysisTab.tsx
 */

import type { CaseDetail } from '../../actions/schemas';
import { LlmRecContext } from '../work-pane/LlmRecContext';

export interface AnalysisTabProps {
  detail: CaseDetail;
}

export function AnalysisTab({ detail }: AnalysisTabProps): React.ReactElement {
  const f = detail.case_facts;

  const rows: Array<{ label: string; value: string }> = [];
  if (detail.state_code !== null) rows.push({ label: 'Engine state', value: detail.state_code });
  if (typeof f.clarification_type === 'string') rows.push({ label: 'Clarification', value: humanize(f.clarification_type) });
  rows.push({ label: 'High-dollar', value: f.is_high_dollar ? 'Yes (≥ $750)' : 'No' });
  if (typeof f.appeal_policy === 'string') rows.push({ label: 'Appeal policy', value: humanize(f.appeal_policy) });
  if (typeof f.appeal_level === 'number') rows.push({ label: 'Appeal level', value: String(f.appeal_level) });
  if (typeof f.root_cause === 'string') rows.push({ label: 'Root cause', value: f.root_cause });

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-3">
      <section aria-label="Case facts" className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Case facts</h3>
        <dl className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline gap-2">
              <dt className="min-w-[7rem] text-[10.5px] uppercase tracking-wider text-slate-500">{r.label}</dt>
              <dd className="text-[12.5px] text-slate-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-3">
        <LlmRecContext detail={detail} />
      </div>

      <section aria-label="Claim" className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Claim</h3>
        <dl className="space-y-1.5 text-[12.5px]">
          <Row label="Claim #" value={String(detail.claim_id)} />
          <Row label="MRN" value={detail.mrn} />
          <Row label="Payer" value={detail.primary_payer_name ?? '—'} />
          <Row label="Clinic" value={detail.clinic_name ?? '—'} />
          {detail.icd_codes.length > 0 && <Row label="Dx" value={detail.icd_codes.join(', ')} />}
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="min-w-[7rem] text-[10.5px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}

function humanize(code: string): string {
  return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
