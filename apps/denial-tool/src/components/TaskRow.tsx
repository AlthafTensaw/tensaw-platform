/**
 * TaskRow — single task in the My Tasks list.
 *
 * Renders one assigned step. No PHI per BE's deliberate v1.7.2 decision:
 * identifier is claim_id + payer + aging + category. If Bhavana needs the
 * patient name to call the facility, she clicks "Open claim" and goes
 * through the existing PrivacyField + reveal-phi flow.
 *
 * Status segment is the same component as the row-detail panel — same
 * mutations wire, same v2.0.4-vs-v2.0.5 disabling.
 */

import { useNavigate } from 'react-router-dom';
import { useActionMutation } from '@tensaw/actions';
import { Icon } from '@tensaw/design-system/primitives';
import { Tooltip } from '@tensaw/design-system/overlays';
import type {
  StepAssignmentResponse,
  StepCompletionResponse,
  StepStatus,
  TaskRow as TaskRowType,
} from '../actions/schemas';
import { StepStatusSegment } from './StepStatusSegment';
import { useUserDirectory, avatarColorFor, displayNameFor } from '../hooks/useUserDirectory';

interface TaskRowProps {
  task: TaskRowType;
  onMutated: () => void;
  useUnifiedStatusEndpoint?: boolean;
}

function urgencyLabel(task: TaskRowType, today: string): {
  text: string;
  cls: string;
} {
  const eff = task.step.effective_due_date;
  if (eff === null || eff === undefined) {
    return { text: 'No due date', cls: 'soon' };
  }
  if (task.is_overdue || eff < today) {
    const days = daysBetween(eff, today);
    return { text: `Overdue ${String(days)}d`, cls: 'overdue' };
  }
  if (eff === today) return { text: 'Due today', cls: 'today' };
  const days = daysBetween(today, eff);
  if (days <= 7) return { text: `in ${String(days)}d`, cls: 'soon' };
  return { text: eff, cls: 'soon' };
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.abs(Math.round((b - a) / 86_400_000));
}

function relativeAssigned(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - Date.parse(iso);
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${String(days)}d ago`;
  return `${String(Math.floor(days / 7))}w ago`;
}

export function TaskRow({
  task,
  onMutated,
  useUnifiedStatusEndpoint = false,
}: TaskRowProps): JSX.Element {
  const navigate = useNavigate();
  const { lookup } = useUserDirectory();
  const assigner = lookup(task.step.assigned_by_user_id);
  const today = new Date().toISOString().slice(0, 10);
  const urgency = urgencyLabel(task, today);

  const [fireComplete] = useActionMutation<
    { classification_id: string; step_number: number },
    StepCompletionResponse
  >('denial.step-complete');
  const [fireStatus] = useActionMutation<
    { classification_id: string; step_number: number; status: StepStatus },
    StepAssignmentResponse
  >('denial.set-step-status');

  const stepStatus: StepStatus =
    task.step.status ?? (task.step.completed_at ? 'complete' : 'pending');

  const isBlockedOnAcceptance = task.state === 'recommended';

  const handleStatusChange = (next: StepStatus): void => {
    if (isBlockedOnAcceptance) return;
    if (!useUnifiedStatusEndpoint && next === 'complete') {
      fireComplete({
        classification_id: task.classification_id,
        step_number: task.step.step,
      })
        .then((result) => {
          if (result.ok) onMutated();
        })
        .catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('step-complete dispatch failed', err);
        });
      return;
    }
    if (useUnifiedStatusEndpoint) {
      fireStatus({
        classification_id: task.classification_id,
        step_number: task.step.step,
        status: next,
      })
        .then((result) => {
          if (result.ok) onMutated();
        })
        .catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('status dispatch failed', err);
        });
    }
  };

  const handleOpenClaim = (): void => {
    navigate(`/worklist?expand=${task.classification_id}`);
  };

  return (
    <div
      className={`grid grid-cols-[12px_1fr_280px_240px_28px] gap-4 px-6 py-3.5 border-b border-border items-start ${
        isBlockedOnAcceptance ? 'bg-muted/50 opacity-85' : 'hover:bg-muted/30'
      }`}
    >
      {/* leading priority bar */}
      <div
        className={`w-1 self-stretch rounded ${
          isBlockedOnAcceptance
            ? 'bg-border'
            : task.step.priority === 'high'
              ? 'bg-destructive'
              : task.step.priority === 'low'
                ? 'bg-slate-400'
                : 'bg-amber-500'
        }`}
        aria-hidden
      />

      {/* primary content */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {isBlockedOnAcceptance ? (
            <Tooltip content="The parent classification hasn't been accepted yet — task isn't actionable">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                <Icon name="Lock" size="xs" />
                Awaiting acceptance
              </span>
            </Tooltip>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                urgency.cls === 'overdue'
                  ? 'bg-red-100 text-red-800'
                  : urgency.cls === 'today'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
              }`}
            >
              {urgency.text}
            </span>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Step {String(task.step.step).padStart(2, '0')} · {task.step.owner}
          </span>
        </div>
        <div className="text-sm font-medium leading-snug">{task.step.action}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          {assigner ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-flex items-center justify-center rounded-full text-white text-[7.5px] font-bold w-3.5 h-3.5"
                style={{ background: avatarColorFor(assigner.user_id) }}
                aria-hidden
              >
                {assigner.initials}
              </span>
              {displayNameFor(assigner)}
              <span className="text-muted-foreground/50">·</span>
            </span>
          ) : null}
          <span>assigned {relativeAssigned(task.step.assigned_at)}</span>
        </div>
      </div>

      {/* claim context — no PHI per BE decision */}
      <div className="flex flex-col gap-1 text-xs">
        <div className="font-mono font-medium text-foreground">
          Claim {String(task.claim_id)}
        </div>
        <div className="text-muted-foreground">
          {task.claim.primary_payer_name} · {task.claim.aging_bucket}
        </div>
        <div className="text-muted-foreground">{task.primary_category}</div>
        <div className="font-mono font-medium text-foreground tabular-nums">
          ${task.claim.net_pending}
        </div>
      </div>

      {/* status + open-claim link */}
      <div className="flex flex-col gap-1 items-start">
        <StepStatusSegment
          value={stepStatus}
          onChange={handleStatusChange}
          useUnifiedStatusEndpoint={useUnifiedStatusEndpoint}
          disabled={isBlockedOnAcceptance}
        />
        <button
          type="button"
          onClick={handleOpenClaim}
          className="inline-flex items-center gap-1 text-[11px] text-teal-700 hover:underline"
        >
          Open claim
          <Icon name="ArrowUpRight" size="xs" />
        </button>
      </div>

      {/* right-side chevron */}
      <div className="flex items-center justify-center text-muted-foreground">
        <Icon name="ChevronRight" size="sm" />
      </div>
    </div>
  );
}
