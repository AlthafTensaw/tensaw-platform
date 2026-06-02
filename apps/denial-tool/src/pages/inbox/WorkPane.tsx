/**
 * WorkPane — middle pane of the v3.0 3-pane shell.
 *
 * Layout:
 *   - Dark teal identifier banner (Patient · MRN · DOS · clinic · facility)
 *   - 4-col stats row (Payer · Net Pending · Aging · Status)
 *   - Classification section (category + confidence + reasoning text)
 *   - Workflow steps (reuses v2.x WorkflowStepsList component)
 *   - Action bar (Accept · Override · Re-classify)
 *
 * Reused from v2.x:
 *   - WorkflowStepsList (all per-step controls inside)
 *   - OverrideModal (opens from Override button)
 *   - RunClassifierNowButton (Re-classify)
 *   - Permission gate via usePermissions
 */

import { useState } from 'react';
import { useActionMutation, useActionQuery } from '@tensaw/actions';
import type {
  WorklistRow,
  ClaimDetail,
  StateTransitionResponse,
} from '../../actions/schemas';
import { WorkflowStepsList } from '../../components/WorkflowStepsList';
import { OverrideModal } from '../../components/OverrideModal';
import { RunClassifierNowButton } from '../../components/RunClassifierNowButton';
import { usePermissions } from '../../auth/permissions';
import {
  formatDate,
  formatMoneyFull,
  formatPatientName,
  displayEntity,
} from '../../lib/formatters';
import { useCategoryColor } from './CategoryContext';

interface WorkPaneProps {
  row: WorklistRow;
  onMutated: () => void;
}

export function WorkPane({ row, onMutated }: WorkPaneProps): JSX.Element {
  const { has } = usePermissions();
  const canAct = has('denial.act');
  const colorFor = useCategoryColor();
  const [overrideOpen, setOverrideOpen] = useState(false);

  const claimId = row.claim.claim_id;
  const { classification } = row;

  // ClaimDetail is the source of truth for patient identifier + facility +
  // full financial breakdown. It's PHI-bearing but we display in cleartext
  // (v3.0 internal-tool decision).
  const { data: detail } = useActionQuery<ClaimDetail>(
    'denial.claim-detail',
    { claim_id: claimId },
  );

  const [isAccepting, setIsAccepting] = useState(false);
  const [fireAccept] = useActionMutation<
    { classification_id: string },
    StateTransitionResponse
  >('denial.accept');

  const handleAccept = (): void => {
    if (!canAct || isAccepting) return;
    setIsAccepting(true);
    void fireAccept({
      classification_id: classification.classification_id,
    }).then((result) => {
      setIsAccepting(false);
      if (result.ok) {
        onMutated();
      }
    });
  };

  // Banner display values
  const patientName = formatPatientName(detail?.patient_name ?? null);
  const mrn = detail?.mrn ?? '—';
  const dos = formatDate(detail?.dos ?? row.claim.dos);
  const clinicDisplay = displayEntity({
    alias: detail?.clinic_alias ?? null,
    name: detail?.clinic_name ?? row.claim.clinic,
  });
  const facilityDisplay =
    detail?.facility_name !== null && detail?.facility_name !== undefined
      ? `Facility #${detail.facility_id ?? '—'}`
      : '—';

  const payerDisplay = displayEntity({
    name: detail?.primary_payer_name ?? row.claim.primary_payer_name,
  });
  const netPending = formatMoneyFull(
    detail?.net_pending ?? row.claim.net_pending,
  );
  const aging = detail?.aging_bucket ?? row.claim.aging_bucket ?? '—';
  const status = detail?.current_status_label ?? 'Denied';

  // Classification block
  const catColor = colorFor(classification.primary_category);
  const confidence = classification.confidence;
  const confLabel =
    confidence === 'high'
      ? 'High confidence'
      : confidence === 'medium'
        ? 'Medium confidence'
        : 'Low confidence';
  const sourceLabel =
    classification.classification_source === 'rule' ? 'Rule' : 'LLM';

  return (
    <div className="flex flex-col overflow-y-auto bg-background">
      {/* Identifier banner */}
      <div
        className="px-6 pb-3.5 pt-4 text-white"
        style={{ backgroundColor: '#134e4a' }}
      >
        <div className="mb-1 text-[19px] font-bold">{patientName}</div>
        <div className="font-mono text-[13px] text-white/85 tabular-nums">
          MRN {mrn}
          <span className="mx-1.5 text-white/35">·</span>
          DOS {dos}
          <span className="mx-1.5 text-white/35">·</span>
          {clinicDisplay}
          <span className="mx-1.5 text-white/35">·</span>
          {facilityDisplay}
        </div>
        <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-wide text-white/45">
          claim {claimId}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 border-b border-border bg-muted/40 px-6 py-3">
        <StatTile label="Payer" value={payerDisplay} />
        <StatTile label="Net Pending" value={netPending} mono />
        <StatTile label="Aging" value={aging} />
        <StatTile label="Status" value={status} />
      </div>

      {/* Classification */}
      <section className="border-b border-border px-6 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Classification
          </span>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold"
              style={{ color: '#134e4a' }}
            >
              ● {confLabel}
            </span>
            <span className="text-[10.5px] text-muted-foreground">
              {sourceLabel} · {classification.tool_version ?? '—'}
            </span>
          </div>
        </div>
        <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: catColor }}
          />
          {classification.primary_category}
        </div>
        <div
          className="rounded border-l-[3px] p-3 text-[13px] leading-relaxed"
          style={{
            borderLeftColor: '#0d9488',
            backgroundColor: '#f0fdfa',
          }}
        >
          {classification.reasoning_summary ??
            'No reasoning available for this classification.'}
        </div>
      </section>

      {/* Workflow steps — reuse v2.x component */}
      <section className="border-b border-border px-6 py-4">
        <WorkflowStepsList
          classification={classification}
          canAct={canAct}
          onStepCompleted={() => { onMutated(); }}
          onAutoComplete={onMutated}
          onAssignmentChanged={() => { onMutated(); }}
        />
      </section>

      {/* Action bar */}
      <div className="mt-auto flex items-center gap-2 border-t border-border bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={handleAccept}
          disabled={!canAct || isAccepting || classification.state !== 'recommended'}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {isAccepting ? 'Accepting…' : 'Accept recommendation'}
        </button>
        <button
          type="button"
          onClick={() => { setOverrideOpen(true); }}
          disabled={!canAct}
          className="rounded-md border border-border bg-background px-3.5 py-1.5 text-[13px] font-medium hover:bg-muted disabled:opacity-50"
        >
          Override…
        </button>
        <RunClassifierNowButton
          claimId={Number(claimId)}
          onClassified={onMutated}
        />
        <span className="ml-auto text-[11px] text-muted-foreground">
          Classified {formatDate(classification.classified_at)} ·{' '}
          {classification.tool_version ?? '—'}
        </span>
      </div>

      {overrideOpen ? (
        <OverrideModal
          classification={classification}
          open={overrideOpen}
          onOpenChange={(open) => { setOverrideOpen(open); }}
          onSuccess={() => {
            setOverrideOpen(false);
            onMutated();
          }}
        />
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="mb-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={[
          'text-[13.5px] font-semibold',
          mono ? 'font-mono tabular-nums' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
