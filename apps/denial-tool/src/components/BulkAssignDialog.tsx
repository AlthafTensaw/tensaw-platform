/**
 * BulkAssignDialog — the v2.3 bulk-assign UI.
 *
 * Two modes:
 *   - 'workflow':   assign every unfinished step of ONE classification to one user (Flow A)
 *   - 'cross-rows': assign step N across MULTIPLE classifications to one user (Flows B/C)
 *
 * Both modes build a BulkAssignmentRequest entries array and fire one POST
 * /v1/assignments/bulk call. Atomic — any validation failure rolls back the
 * whole batch and surfaces the offending entry index.
 *
 * Mixed-category handling (cross-rows mode): when target rows have different
 * primary_category values, show a non-blocking warning callout explaining
 * that step N means different things in each category. Per v2.3 design
 * decision: warn, don't block.
 */

import { useState } from 'react';
import { useActionMutation } from '@tensaw/actions';
import { Dialog } from '@tensaw/design-system/overlays';
import { Select, DatePicker } from '@tensaw/design-system/forms';
import { Button, Icon } from '@tensaw/design-system/primitives';
import { Alert } from '@tensaw/design-system/feedback';
import type {
  BulkAssignmentRequest,
  BulkAssignmentResponse,
  StepPriority,
  WorkflowStep,
} from '../actions/schemas';
import { AssigneePicker } from './AssigneePicker';
import { PriorityPicker } from './PriorityPicker';

export interface BulkAssignTarget {
  classification_id: string;
  primary_category: string;
  workflow_steps: WorkflowStep[];
}

export type BulkAssignMode = 'workflow' | 'cross-rows';

interface BulkAssignDialogProps {
  open: boolean;
  onClose: () => void;
  mode: BulkAssignMode;
  /** Targets to assign. workflow mode = 1 entry; cross-rows = many. */
  targets: readonly BulkAssignTarget[];
  /** Cross-rows mode only: which step number to assign. Workflow mode ignores. */
  initialStepNumber?: number;
  onSuccess: (response: BulkAssignmentResponse) => void;
}

function parseISODate(iso: string): Date | null {
  const parts = iso.split('-').map((s) => Number.parseInt(s, 10));
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${dd}`;
}

/**
 * Across all targets, find distinct primary_category → step_action mappings
 * for a given step number. Used by the mixed-category warning.
 */
function distinctStepActions(
  targets: readonly BulkAssignTarget[],
  stepNumber: number,
): { category: string; action: string; count: number }[] {
  const map = new Map<string, { category: string; action: string; count: number }>();
  for (const t of targets) {
    const step = t.workflow_steps.find((s) => s.step === stepNumber);
    if (!step) continue;
    const key = `${t.primary_category}::${step.action}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { category: t.primary_category, action: step.action, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function BulkAssignDialog({
  open,
  onClose,
  mode,
  targets,
  initialStepNumber,
  onSuccess,
}: BulkAssignDialogProps): JSX.Element {
  const [stepNumber, setStepNumber] = useState<number>(initialStepNumber ?? 1);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [includeDueDate, setIncludeDueDate] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [includePriority, setIncludePriority] = useState(false);
  const [priority, setPriority] = useState<StepPriority>('normal');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fireBulk] = useActionMutation<
    BulkAssignmentRequest,
    BulkAssignmentResponse
  >('denial.bulk-assign');

  // ── derived state ──
  const targetCount = targets.length;
  // For cross-rows mode, distinct step numbers across all targets (1..maxN)
  const maxStepNumber = targets.reduce(
    (acc, t) => Math.max(acc, ...t.workflow_steps.map((s) => s.step)),
    1,
  );
  const stepOptions = Array.from(
    { length: maxStepNumber },
    (_, i) => ({
      value: String(i + 1),
      label: `Step ${String(i + 1).padStart(2, '0')}`,
    }),
  );

  // Mixed-category detection for the selected step
  const distinctActions = mode === 'cross-rows'
    ? distinctStepActions(targets, stepNumber)
    : [];
  const isMixedCategory = distinctActions.length > 1;

  // For workflow mode: target is one classification; collect its unfinished steps
  const workflowTarget = mode === 'workflow' ? targets[0] : null;
  const unfinishedSteps = workflowTarget
    ? workflowTarget.workflow_steps.filter((s) => !s.completed_at)
    : [];

  const handleSubmit = (): void => {
    if (assigneeId === null) {
      setError('Pick an assignee first.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    // Build entries
    const entries: BulkAssignmentRequest['assignments'] =
      mode === 'workflow' && workflowTarget
        ? unfinishedSteps.map((step) => ({
            classification_id: workflowTarget.classification_id,
            step_number: step.step,
            assigned_to_user_id: assigneeId,
            ...(includeDueDate && dueDate ? { due_date: dueDate } : {}),
            ...(includePriority ? { priority } : {}),
          }))
        : targets.map((t) => ({
            classification_id: t.classification_id,
            step_number: stepNumber,
            assigned_to_user_id: assigneeId,
            ...(includeDueDate && dueDate ? { due_date: dueDate } : {}),
            ...(includePriority ? { priority } : {}),
          }));

    fireBulk({ assignments: entries })
      .then((result) => {
        setIsSubmitting(false);
        if (result.ok) {
          onSuccess(result.data);
          onClose();
        } else {
          // Surface the BE 422 detail with entry index
          setError(result.error?.message ?? 'Bulk assignment failed.');
        }
      })
      .catch((err: unknown) => {
        setIsSubmitting(false);
        setError(err instanceof Error ? err.message : 'Bulk assignment failed.');
      });
  };

  const submitLabel =
    mode === 'workflow'
      ? `Assign ${String(unfinishedSteps.length)} step${unfinishedSteps.length === 1 ? '' : 's'}`
      : `Assign ${String(targetCount)} task${targetCount === 1 ? '' : 's'}`;

  const titleLabel =
    mode === 'workflow'
      ? `Assign all unfinished steps`
      : `Assign ${String(targetCount)} task${targetCount === 1 ? '' : 's'}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={titleLabel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={assigneeId === null || isSubmitting}
          >
            {isSubmitting ? 'Assigning…' : submitLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Step picker — only in cross-rows mode */}
        {mode === 'cross-rows' ? (
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Which step?
            </label>
            <Select<string>
              value={String(stepNumber)}
              onValueChange={(v) => { setStepNumber(Number.parseInt(v, 10)); }}
              options={stepOptions}
              aria-label="Step number"
            />
            {!isMixedCategory && distinctActions[0] ? (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                All {String(targetCount)} selected rows are{' '}
                {distinctActions[0].category} —{' '}
                <span className="italic">"{distinctActions[0].action}"</span>.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {String(unfinishedSteps.length)} unfinished step
            {unfinishedSteps.length === 1 ? '' : 's'} will be reassigned.
            Completed steps won't change.
          </p>
        )}

        {/* Assignee picker */}
        <div>
          <label className="block text-xs font-semibold mb-1.5">
            Assign to
          </label>
          <AssigneePicker
            value={assigneeId}
            onSelect={setAssigneeId}
            onClear={() => { setAssigneeId(null); }}
          />
        </div>

        {/* Optional: due date */}
        <div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={includeDueDate}
              onChange={(e) => { setIncludeDueDate(e.target.checked); }}
              className="w-3.5 h-3.5"
            />
            <span className="font-medium">Also set due date</span>
            <span className="text-muted-foreground font-normal">
              (otherwise uses each step's SLA-derived default)
            </span>
          </label>
          {includeDueDate ? (
            <div className="mt-2">
              <DatePicker
                value={dueDate ? parseISODate(dueDate) : null}
                onValueChange={(d) => { setDueDate(d ? toISODate(d) : null); }}
                format="MMM d, yyyy"
                aria-label="Due date"
              />
            </div>
          ) : null}
        </div>

        {/* Optional: priority */}
        <div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={includePriority}
              onChange={(e) => { setIncludePriority(e.target.checked); }}
              className="w-3.5 h-3.5"
            />
            <span className="font-medium">Also set priority</span>
            <span className="text-muted-foreground font-normal">
              (otherwise unchanged)
            </span>
          </label>
          {includePriority ? (
            <div className="mt-2">
              <PriorityPicker value={priority} onChange={setPriority} />
            </div>
          ) : null}
        </div>

        {/* Mixed-category warning — cross-rows mode, distinct actions > 1 */}
        {isMixedCategory ? (
          <Alert
            variant="warning"
            title="Step means different things across selected rows"
          >
            <ul className="text-xs mt-1 list-disc list-inside">
              {distinctActions.map((d) => (
                <li key={d.category}>
                  <strong>{d.category}</strong> ({String(d.count)} row
                  {d.count === 1 ? '' : 's'}): "{d.action}"
                </li>
              ))}
            </ul>
            <p className="text-xs mt-2">
              You can still proceed — the same person will be assigned
              regardless. Filter by category first if you want consistency.
            </p>
          </Alert>
        ) : null}

        {/* Error surface — BE 422 with entry index, or any other failure */}
        {error !== null ? (
          <Alert variant="error">{error}</Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
