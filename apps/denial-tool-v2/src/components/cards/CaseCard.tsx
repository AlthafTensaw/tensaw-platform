/**
 * CaseCard — 4-line worklist card.
 *
 * Anchored on mockup #3 (worklist default) and mockup #4 (returned-bar variant).
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ ← Returned by {prev_team} · {date}                          │   (only on needs_my_review)
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ Patient, Name   MRN                                  $1,234 │   Line 1
 *   │ DOS · clinic · payer · aging                                │   Line 2
 *   │ ● task hint                                  queue_chip     │   Line 3
 *   │ [State] [👤 originator] [HD] [⏰ Overdue 3d]                │   Line 4
 *   └─────────────────────────────────────────────────────────────┘
 *
 * The whole card is a Link to /inbox?queue=<current>&case=<case_id>. Selected
 * state is driven by `?case=` matching this row's case_id.
 *
 * Drop-in path: src/components/cards/CaseCard.tsx
 */

import { Link, useSearchParams } from 'react-router-dom';
import type { WorklistRow } from '../../actions/schemas-v4';
import {
  formatCurrency,
  formatDateShort,
  deriveUrgency,
  initialsForName,
  type UrgencyState,
} from '../../utils/formatters';
import {
  taskHint,
  categoryColor,
  statePillStyle,
  agingBucketTone,
} from '../../lib/labels';
import { QueueRoutingChip } from './QueueRoutingChip';

export interface CaseCardProps {
  row: WorklistRow;
  /** Override the "now" reference for urgency calc — used in tests. */
  now?: Date;
}

export function CaseCard({ row, now }: CaseCardProps): React.ReactElement {
  const { case: c, current_task } = row;
  const [searchParams] = useSearchParams();
  const selectedCaseId = searchParams.get('case');
  const isSelected = selectedCaseId === c.case_id;

  // Returned-to-you bar visible when:
  //   - current_task is a coding_feedback_review (returned from coding partner)
  //   - the task is on a personal queue (user_<id>)
  // We check both because cards in the main worklist also show this task type
  // but only the personal-queue view should treat it as a "return".
  const isReturnedToReviewer =
    current_task !== null &&
    current_task.task_type === 'coding_feedback_review' &&
    current_task.queue_id.startsWith('user_');

  // Build the link target — preserve queue context if present in URL
  const currentQueue = searchParams.get('queue');
  const linkParams = new URLSearchParams();
  if (currentQueue !== null) linkParams.set('queue', currentQueue);
  linkParams.set('case', c.case_id);
  const linkTo = `/inbox?${linkParams.toString()}`;

  // Urgency for line 4
  const urgency: UrgencyState | null =
    current_task !== null
      ? deriveUrgency(current_task.due_at, now)
      : null;

  // Category for the cat-dot — overridden cases show OVERRIDE category if
  // we had it, but the v4 schema only carries recommended_category on Case.
  // Override category lives on CaseDetail; for the worklist row we render
  // recommended_category in all cases.
  const dotColor = categoryColor(c.recommended_category);

  // State pill style
  const pillStyle = statePillStyle(c.case_status);

  // Aging tone
  const agingTone = agingBucketTone(c.aging_bucket);
  const agingClass =
    agingTone === 'severe' ? 'text-red-600' :
    agingTone === 'warning' ? 'text-amber-700' :
    'text-slate-500';

  return (
    <Link
      to={linkTo}
      aria-current={isSelected ? 'page' : undefined}
      aria-label={`${c.patient_name ?? 'Unknown patient'} — ${formatCurrency(c.net_pending)} — ${pillStyle.label}`}
      className={`
        block rounded-md border bg-white px-3 py-2.5
        transition-colors hover:bg-slate-50
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${isSelected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}
      `}
    >
      {isReturnedToReviewer && current_task !== null && (
        <ReturnedToYouBar
          /* For richer text ("Returned by Coding (Bhavana M.)") the BE would
           * need to extend WorklistRow with previous_task_completion data.
           * For now we show the task's open date as the return date. */
          returnedAt={current_task.opened_at}
        />
      )}

      {/* Line 1 — patient/money */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-slate-900">
            {c.patient_name ?? 'Unknown patient'}
          </span>
          <span className="text-[11px] text-slate-500">{c.mrn}</span>
        </div>
        <span className="text-[13px] font-semibold tabular-nums text-slate-900">
          {formatCurrency(c.net_pending)}
        </span>
      </div>

      {/* Line 2 — DOS · clinic · payer · aging (dot-separated) */}
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>{formatDateShort(c.dos)}</span>
        <Dot />
        <span className="truncate">{c.clinic_alias ?? c.clinic_name ?? '—'}</span>
        <Dot />
        <span className="truncate">{c.primary_payer_alias ?? c.primary_payer_name ?? '—'}</span>
        <Dot />
        <span className={`${agingClass} font-medium tabular-nums`}>
          {c.aging_bucket ?? '—'}
        </span>
      </div>

      {/* Line 3 — cat-dot + task hint + queue chip */}
      <div className="mt-1.5 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: dotColor }}
        />
        <span className="truncate text-[11.5px] text-slate-700">
          {current_task !== null
            ? taskHint(current_task.task_type)
            : 'Intake triage — confirm category'}
        </span>
        {current_task !== null && (
          <QueueRoutingChip queueId={current_task.queue_id} />
        )}
      </div>

      {/* Line 4 — state pill, originator, HD, urgency */}
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={`
            inline-flex items-center rounded px-1.5 py-0.5
            text-[10px] font-semibold uppercase tracking-wide
            ${pillStyle.bgClass} ${pillStyle.textClass}
          `}
        >
          {pillStyle.label}
        </span>
        <OriginatorBadge
          userId={c.originated_by_user_id}
          userName={c.originated_by_user_name}
        />
        {c.is_high_dollar && <HDBadge />}
        {urgency !== null && <UrgencyChip urgency={urgency} />}
      </div>
    </Link>
  );
}

// ============================================================================
// Subcomponents — kept in this file because each is small and card-specific
// ============================================================================

function Dot(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-300"
    />
  );
}

interface ReturnedToYouBarProps {
  returnedAt: string;
}

function ReturnedToYouBar({ returnedAt }: ReturnedToYouBarProps): React.ReactElement {
  return (
    <div
      role="status"
      className="
        -mx-3 -mt-2.5 mb-2 flex items-center gap-2 border-b border-red-200
        bg-gradient-to-r from-red-50 to-transparent px-3 py-1
        text-[11px] text-red-800
      "
    >
      <span aria-hidden="true" className="text-[11px]">←</span>
      <span>
        Returned to you for review · {formatDateShort(returnedAt)}
      </span>
    </div>
  );
}

interface OriginatorBadgeProps {
  userId: number | null;
  userName: string | null;
}

function OriginatorBadge({ userId, userName }: OriginatorBadgeProps): React.ReactElement {
  if (userId === null || userName === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-500">
        <span
          aria-hidden="true"
          className="
            inline-flex h-4 w-4 items-center justify-center
            rounded-full bg-slate-200 text-[9px] text-slate-500
          "
        >
          —
        </span>
        Unassigned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-600">
      <span
        aria-hidden="true"
        className="
          inline-flex h-4 w-4 items-center justify-center
          rounded-full bg-blue-700 text-[9px] font-semibold text-white
        "
      >
        {initialsForName(userName)}
      </span>
      {userName}
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

interface UrgencyChipProps {
  urgency: UrgencyState;
}

function UrgencyChip({ urgency }: UrgencyChipProps): React.ReactElement {
  const toneClass =
    urgency.tone === 'overdue' ? 'bg-red-100 text-red-800' :
    urgency.tone === 'today' ? 'bg-amber-100 text-amber-800' :
    'bg-slate-100 text-slate-700';

  return (
    <span
      className={`
        ml-auto inline-flex items-center rounded px-1.5 py-0.5
        text-[10px] font-semibold ${toneClass}
      `}
    >
      {urgency.label}
    </span>
  );
}
