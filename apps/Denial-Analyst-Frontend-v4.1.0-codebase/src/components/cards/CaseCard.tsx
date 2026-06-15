/**
 * CaseCard (v4.1) — worklist card for a dispatched task row.
 *
 * Engine-handler model: the card renders a WorklistTask (one dispatched task),
 * so the task_type is the PROMINENT headline (it's the routing key). Claim
 * context comes from the row's claim_summary.
 *
 * Dropped from v4.0.0:
 *   - Returned-to-you bar (no coding_feedback_review return / personal queue)
 *   - Originator badge (no originated_by)
 *   - case_status pill (no case_status lifecycle)
 *   - due/urgency chip (worklist row has dispatched_at, not due_at)
 *
 * Kept: the HD badge (is_high_dollar flag). Added: priority badge + team chip.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Triage denial                              [HIGH]          │  task_type + priority
 *   │ Henderson, Joel   72834                       $840         │  patient · money
 *   │ 05/03 · CAH · Humana MA · 0-29 day                         │  claim context
 *   │ [Denial Intake]  [HD]                                      │  team chip + HD
 *   └──────────────────────────────────────────────────────────┘
 *
 * Drop-in path: src/components/cards/CaseCard.tsx
 */

import { Link, useSearchParams } from 'react-router-dom';
import type { WorklistTask, Priority } from '../../actions/schemas';
import { TEAM_LABELS } from '../../actions/schemas';
import { formatDateShort } from '../../utils/formatters';
import { agingBucketTone } from '../../lib/labels';
import { TASK_TYPE_LABELS, taskHint, formatCurrencyStr } from '../../lib/labels';

export interface CaseCardProps {
  task: WorklistTask;
}

export function CaseCard({ task }: CaseCardProps): React.ReactElement {
  const [searchParams] = useSearchParams();
  const selectedCaseId = searchParams.get('case');
  const isSelected = selectedCaseId === task.case_id;

  const cs = task.claim_summary;

  // Link preserves queue context; selects this row's case.
  const currentQueue = searchParams.get('queue');
  const linkParams = new URLSearchParams();
  if (currentQueue !== null) linkParams.set('queue', currentQueue);
  linkParams.set('case', task.case_id);
  const linkTo = `/inbox?${linkParams.toString()}`;

  const agingTone = agingBucketTone(cs.aging_bucket);
  const agingClass =
    agingTone === 'severe' ? 'text-red-600' :
    agingTone === 'warning' ? 'text-amber-700' :
    'text-slate-500';

  return (
    <Link
      to={linkTo}
      aria-current={isSelected ? 'page' : undefined}
      aria-label={`${TASK_TYPE_LABELS[task.task_type]} — ${cs.patient_name ?? 'Unknown patient'} — ${formatCurrencyStr(cs.net_pending)}`}
      className={`
        block rounded-md border bg-white px-3 py-2.5
        transition-colors hover:bg-slate-50
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${isSelected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}
      `}
    >
      {/* Line 1 — task type (routing key, prominent) + priority */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-slate-900" title={taskHint(task.task_type)}>
          {TASK_TYPE_LABELS[task.task_type]}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Line 2 — patient + mrn ............ money */}
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="truncate text-[12.5px] font-medium text-slate-800">
            {cs.patient_name ?? 'Unknown patient'}
          </span>
          <span className="text-[11px] text-slate-500">{cs.mrn}</span>
        </div>
        <span className="text-[13px] font-semibold tabular-nums text-slate-900">
          {formatCurrencyStr(cs.net_pending)}
        </span>
      </div>

      {/* Line 3 — DOS · clinic · payer · aging */}
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>{formatDateShort(cs.dos)}</span>
        <Dot />
        <span className="truncate">{cs.clinic_name ?? '—'}</span>
        <Dot />
        <span className="truncate">{cs.primary_payer_name ?? '—'}</span>
        <Dot />
        <span className={`${agingClass} font-medium tabular-nums`}>{cs.aging_bucket ?? '—'}</span>
      </div>

      {/* Line 4 — team chip + HD badge */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="
          inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5
          text-[10.5px] font-medium text-slate-600
        ">
          {TEAM_LABELS[task.team]}
        </span>
        {task.case_facts.is_high_dollar && <HDBadge />}
      </div>
    </Link>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function Dot(): React.ReactElement {
  return (
    <span aria-hidden="true" className="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
  );
}

function PriorityBadge({ priority }: { priority: Priority }): React.ReactElement | null {
  // Normal priority is the common case — don't badge it (reduce noise).
  if (priority === 'normal') return null;
  const cls =
    priority === 'high'
      ? 'bg-red-100 text-red-800'
      : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${cls}`}>
      {priority}
    </span>
  );
}

function HDBadge(): React.ReactElement {
  return (
    <span
      title="High-dollar case (≥$750 pending)"
      className="
        inline-flex items-center rounded border border-amber-300 bg-amber-100
        px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-900
      "
    >
      HD
    </span>
  );
}
