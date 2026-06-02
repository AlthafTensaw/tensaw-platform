/**
 * WorkflowStepsList — per-step assignment + status row.
 *
 * v2.0.4 expansion:
 *   - Each step row now exposes 4 inline controls:
 *       Assignee · Due date · Priority · Status
 *   - Replaces the v2.0.3 single-checkbox-complete UX with the v1.7.2 wire.
 *   - Pending → Complete uses POST /steps/{n}/complete (existing v1.5.x).
 *   - All other assignment edits go through PUT /steps/{n}/assignment.
 *   - In-progress segment + Complete→Pending reopen disabled until backend
 *     v1.8.0 ships PUT /steps/{n}/status (v2.0.5 patch flips the flag).
 *   - Header shows "X of Y done · Z in progress" if any in-progress steps.
 *
 * Permission: canAct (denial.act). Read-only viewers see read-only controls
 * with the existing tooltips.
 */

import { useState } from 'react';
import { useActionMutation } from '@tensaw/actions';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@tensaw/design-system/primitives';
import { Alert } from '@tensaw/design-system/feedback';
import { Tooltip } from '@tensaw/design-system/overlays';
import type {
  Classification,
  StepAssignmentResponse,
  StepCompletionResponse,
  StepPriority,
  StepStatus,
  WorkflowStep,
} from '../actions/schemas';
import { AssigneePicker } from './AssigneePicker';
import { BulkAssignDialog } from './BulkAssignDialog';
import { DueDatePicker } from './DueDatePicker';
import { PriorityPicker } from './PriorityPicker';
import { StepStatusSegment } from './StepStatusSegment';

interface WorkflowStepsListProps {
  classification: Classification;
  canAct: boolean;
  onStepCompleted: (resp: StepCompletionResponse) => void;
  onAutoComplete: () => void;
  onAssignmentChanged: (resp: StepAssignmentResponse) => void;
  /** Flip to true in v2.0.5 once backend v1.8.0 ships PUT /steps/{n}/status. */
  useUnifiedStatusEndpoint?: boolean;
}

function deriveStatus(step: WorkflowStep): StepStatus {
  if (step.status) return step.status;
  if (step.completed_at) return 'complete';
  return 'pending';
}

function derivePriority(step: WorkflowStep): StepPriority {
  if (step.priority) return step.priority;
  if (step.sla_days <= 1) return 'high';
  if (step.sla_days <= 14) return 'normal';
  return 'low';
}

export function WorkflowStepsList({
  classification,
  canAct,
  onStepCompleted,
  onAutoComplete,
  onAssignmentChanged,
  useUnifiedStatusEndpoint = false,
}: WorkflowStepsListProps): JSX.Element {
  const [bulkOpen, setBulkOpen] = useState(false);
  const queryClient = useQueryClient();
  const steps = classification.workflow_steps;
  const firstIncomplete = steps.find((s) => !s.completed_at);
  const allComplete = steps.length > 0 && !firstIncomplete;
  const inProgressCount = steps.filter(
    (s) => deriveStatus(s) === 'in_progress',
  ).length;
  const doneCount = steps.filter((s) => s.completed_at !== null && s.completed_at !== undefined).length;

  // v3.0.2 fix (Vivek 2026-05-29 + billing team 2026-05-26): invalidate the
  // tasks-mine query after any assignment-changing mutation. Without this,
  // analysts viewing My Tasks while assignments change elsewhere had to
  // manually refresh to see updates. React Query treats the actionId as
  // a key prefix so this invalidates all variants regardless of request
  // params.
  const invalidateTasksMine = (): void => {
    void queryClient.invalidateQueries({
      queryKey: ['denial.list-tasks-mine'],
    });
  };

  const [fireComplete] = useActionMutation<
    { classification_id: string; step_number: number },
    StepCompletionResponse
  >('denial.step-complete');
  const [fireAssignment] = useActionMutation<
    {
      classification_id: string;
      step_number: number;
      assigned_to_user_id: number | null;
      due_date: string | null;
      priority: StepPriority;
    },
    StepAssignmentResponse
  >('denial.set-step-assignment');
  const [fireClear] = useActionMutation<
    { classification_id: string; step_number: number },
    null
  >('denial.clear-step-assignment');
  const [fireStatus] = useActionMutation<
    { classification_id: string; step_number: number; status: StepStatus },
    StepAssignmentResponse
  >('denial.set-step-status');

  const handleStatusChange = (step: WorkflowStep, next: StepStatus): void => {
    if (!canAct) return;

    // v2.0.4 path: Pending → Complete via POST /complete (the only wired transition)
    if (!useUnifiedStatusEndpoint && next === 'complete') {
      fireComplete({
        classification_id: classification.classification_id,
        step_number: step.step,
      })
        .then((result) => {
          if (!result.ok) return;
          onStepCompleted(result.data);
          if (result.data.auto_completed_classification) onAutoComplete();
        })
        .catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('step-complete dispatch failed', err);
        });
      return;
    }

    // v2.0.5 path (v1.8.0 backend): unified PUT /steps/{n}/status
    if (useUnifiedStatusEndpoint) {
      fireStatus({
        classification_id: classification.classification_id,
        step_number: step.step,
        status: next,
      })
        .then((result) => {
          if (!result.ok) return;
          onAssignmentChanged(result.data);
        })
        .catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('status dispatch failed', err);
        });
    }
  };

  const handleAssigneeSelect = (
    step: WorkflowStep,
    userId: number,
  ): void => {
    fireAssignment({
      classification_id: classification.classification_id,
      step_number: step.step,
      assigned_to_user_id: userId,
      due_date: step.due_date ?? null,
      priority: derivePriority(step),
    })
      .then((result) => {
        if (result.ok) { onAssignmentChanged(result.data); invalidateTasksMine(); }
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('assignment dispatch failed', err);
      });
  };

  const handleAssigneeClear = (step: WorkflowStep): void => {
    fireClear({
      classification_id: classification.classification_id,
      step_number: step.step,
    })
      .then((result) => {
        if (result.ok) invalidateTasksMine();
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('clear-assignment dispatch failed', err);
      });
  };

  const handleDueDateChange = (
    step: WorkflowStep,
    newDate: string | null,
  ): void => {
    fireAssignment({
      classification_id: classification.classification_id,
      step_number: step.step,
      assigned_to_user_id: step.assigned_to_user_id ?? null,
      due_date: newDate,
      priority: derivePriority(step),
    })
      .then((result) => {
        if (result.ok) { onAssignmentChanged(result.data); invalidateTasksMine(); }
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('due-date dispatch failed', err);
      });
  };

  const handlePriorityChange = (
    step: WorkflowStep,
    next: StepPriority,
  ): void => {
    fireAssignment({
      classification_id: classification.classification_id,
      step_number: step.step,
      assigned_to_user_id: step.assigned_to_user_id ?? null,
      due_date: step.due_date ?? null,
      priority: next,
    })
      .then((result) => {
        if (result.ok) { onAssignmentChanged(result.data); invalidateTasksMine(); }
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('priority dispatch failed', err);
      });
  };

  const hintForState =
    classification.state === 'recommended'
      ? 'Accept or override the recommendation before marking steps complete.'
      : allComplete
        ? null
        : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended action plan ·{' '}
          <span className="text-foreground">
            {doneCount} of {steps.length} done
          </span>
          {inProgressCount > 0 ? (
            <>
              {' · '}
              <span className="text-blue-700">{inProgressCount} in progress</span>
            </>
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          {canAct && steps.some((s) => !s.completed_at) ? (
            <button
              type="button"
              onClick={() => { setBulkOpen(true); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border rounded-md text-xs font-medium hover:bg-teal-50 hover:border-teal-600 hover:text-teal-900"
            >
              <Icon name="UserPlus" size="xs" />
              Assign all steps to…
            </button>
          ) : null}
          <span className="text-muted-foreground">
            Owner: {classification.workflow_steps[0]?.owner ?? '—'}
          </span>
        </div>
      </div>

      {bulkOpen ? (
        <BulkAssignDialog
          open={bulkOpen}
          onClose={() => { setBulkOpen(false); }}
          mode="workflow"
          targets={[
            {
              classification_id: classification.classification_id,
              primary_category: classification.primary_category,
              workflow_steps: classification.workflow_steps,
            },
          ]}
          onSuccess={() => {
            onAssignmentChanged({} as never); // refetch only — body unused here
          }}
        />
      ) : null}

      {steps.map((step, idx) => {
        const status = deriveStatus(step);
        const isDone = status === 'complete';
        const previousDone =
          idx === 0 ||
          (steps[idx - 1]?.completed_at !== null &&
            steps[idx - 1]?.completed_at !== undefined);
        const isNext = !isDone && previousDone;
        const blockedBySequentialGate = !isDone && !previousDone;

        const stepCls = isDone
          ? 'bg-muted/60'
          : isNext
            ? 'bg-teal-50 border-l-4 border-primary'
            : 'bg-card border border-border opacity-75';

        return (
          <div
            key={step.step}
            className={`rounded-md p-3 ${stepCls}`}
          >
            <div className="flex items-start gap-2">
              <div className="font-mono text-[11px] font-semibold text-muted-foreground w-6 mt-0.5">
                {String(step.step).padStart(2, '0')}.
              </div>
              <div className="flex-1 text-sm">
                <div
                  className={
                    isDone
                      ? 'line-through text-muted-foreground'
                      : 'font-medium text-foreground'
                  }
                >
                  {step.action}
                </div>
                {isNext ? (
                  <div className="text-xs text-primary-foreground/0 mt-0.5 inline-flex items-center gap-1 text-teal-700 font-medium">
                    <Icon name="ArrowRight" size="xs" /> Next action
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </span>
                <StepStatusSegment
                  value={status}
                  onChange={(next) => { handleStatusChange(step, next); }}
                  useUnifiedStatusEndpoint={useUnifiedStatusEndpoint}
                  blockedBySequentialGate={blockedBySequentialGate}
                  disabled={!canAct}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Assignee
                </span>
                <AssigneePicker
                  value={step.assigned_to_user_id ?? null}
                  onSelect={(uid) => { handleAssigneeSelect(step, uid); }}
                  onClear={() => { handleAssigneeClear(step); }}
                  disabled={!canAct}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Due
                </span>
                <DueDatePicker
                  effectiveDueDate={step.effective_due_date ?? null}
                  dueDateOverride={step.due_date ?? null}
                  onChange={(d) => { handleDueDateChange(step, d); }}
                  completed={isDone}
                  disabled={!canAct}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Priority
                </span>
                <PriorityPicker
                  value={derivePriority(step)}
                  onChange={(next) => { handlePriorityChange(step, next); }}
                  disabled={!canAct}
                />
              </div>
            </div>
          </div>
        );
      })}

      {hintForState ? (
        <Alert variant="info" className="mt-1">
          {hintForState}
        </Alert>
      ) : null}

      {!useUnifiedStatusEndpoint ? (
        <Tooltip content="v1.8.0 ETA ~1 session; v2.0.5 patch will swap to unified PUT /status">
          <div className="text-[10px] text-muted-foreground italic mt-1">
            In-progress + step reopen pending backend v1.8.0
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}
