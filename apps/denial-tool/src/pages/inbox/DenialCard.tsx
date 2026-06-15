/**
 * DenialCard — single denial entry in the left-pane list.
 *
 * 4-line layout per v3.0.3 mockup:
 *   Line 1: Patient (Lastname, F) · MRN · DOS · $ net (right-aligned)
 *   Line 2: Clinic alias · Payer alias · Aging
 *   Line 3: Next task — current pending workflow step (with category color dot)
 *           OR "All steps complete" when state=accepted and all steps done
 *   Line 4: State pill · Assignee · Urgency badge
 *
 * Selection highlights:
 *   - isSelected: primary border-left + white bg (active in middle/right panes)
 *   - isMultiSelected: checkbox is checked
 *   - showCheckbox: checkbox visible (multi-select mode active)
 */

import { useMemo } from 'react';
import type { WorklistRow, WorkflowStep } from '../../actions/schemas';
import {
  formatDate,
  formatMoneyShort,
  formatPatientName,
  displayEntity,
} from '../../lib/formatters';
import { useCategoryColor } from './CategoryContext';

interface DenialCardProps {
  row: WorklistRow;
  isSelected: boolean;
  isMultiSelected: boolean;
  showCheckbox: boolean;
  onClick: (e: React.MouseEvent) => void;
  onCheckboxToggle: () => void;
}

export function DenialCard({
  row,
  isSelected,
  isMultiSelected,
  showCheckbox,
  onClick,
  onCheckboxToggle,
}: DenialCardProps): JSX.Element {
  const { claim, classification } = row;
  const colorFor = useCategoryColor();

  // v2.0.1 (F1): patient_name + mrn now live on ClaimSummary directly.
  // Defensive fallback to '—' if BE response somehow omits them (e.g.
  // unresolvable patient identity).
  const patientName = formatPatientName((claim as any).patient_name ?? null);
  const mrn = (claim as any).mrn ?? '—';

  const dos = formatDate(claim.dos);
  const net = formatMoneyShort(claim.net_pending);

  // v2.0.0 (Ask 6): proper alias + name fields. displayEntity prefers alias,
  // falls back to truncated name. The legacy `clinic` field still carries
  // the alias for back-compat — we read clinic_alias/clinic_name first and
  // only fall back to `clinic` (as alias) if both are absent.
  const clinicAlias = displayEntity({
    alias: (claim as any).clinic_alias ?? claim.clinic,
    name: (claim as any).clinic_name,
  });
  const payerAlias = displayEntity({
    alias: (claim as any).primary_payer_alias,
    name: claim.primary_payer_name,
  });

  const aging = compactAging(claim.aging_bucket);
  const categoryColor = colorFor(classification.primary_category);

  const { nextTaskText, allComplete } = useMemo(
    () => deriveNextTask(classification.workflow_steps, classification.state),
    [classification.workflow_steps, classification.state],
  );

  const assignee = pickPrimaryAssignee(classification.workflow_steps);
  const urgency = pickUrgency(classification.workflow_steps);

  const stateLabel =
    classification.state.charAt(0).toUpperCase() +
    classification.state.slice(1);
  const statePillClass = STATE_PILL_CLASS[classification.state];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      className={[
        'cursor-pointer border-b border-border px-3.5 py-2.5',
        'border-l-[3px] transition-colors',
        isSelected
          ? 'border-l-primary bg-background'
          : 'border-l-transparent bg-muted/30 hover:bg-muted',
      ].join(' ')}
    >
      {/* Line 1: Patient · MRN · DOS · $ */}
      <div className="mb-1 flex items-baseline gap-2 text-[12.5px]">
        {showCheckbox ? (
          <CheckboxMini
            checked={isMultiSelected}
            onToggle={(e) => {
              e.stopPropagation();
              onCheckboxToggle();
            }}
          />
        ) : null}
        <span className="font-semibold">{patientName}</span>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {mrn}
        </span>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {dos}
        </span>
        <span className="ml-auto font-mono text-[12px] font-semibold tabular-nums">
          {net}
        </span>
      </div>

      {/* Line 2: Clinic · Payer · Aging */}
      <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <span>{clinicAlias}</span>
        <span className="text-border">·</span>
        <span>{payerAlias}</span>
        <span className="text-border">·</span>
        <span>{aging}</span>
      </div>

      {/* Line 3: Next task or all-complete */}
      <div
        className={[
          'mb-1.5 flex items-center gap-1.5 text-[12px]',
          allComplete ? 'italic text-muted-foreground' : '',
        ].join(' ')}
      >
        {allComplete ? (
          <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg
              width="7"
              height="7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        ) : (
          <span
            className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: categoryColor }}
          />
        )}
        <span className="flex-1 truncate">{nextTaskText}</span>
      </div>

      {/* Line 4: State · Assignee · Urgency */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span
          className={[
            'inline-flex items-center rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide',
            statePillClass,
          ].join(' ')}
        >
          {stateLabel}
        </span>
        {assignee !== null ? (
          <span className="inline-flex items-center gap-1 text-[10.5px]">
            <AssigneeAvatar name={assignee} />
            {assignee}
          </span>
        ) : (
          <span className="text-[10.5px]">Unassigned</span>
        )}
        {urgency !== null ? (
          <span
            className={[
              'rounded-full px-1.5 py-px text-[9.5px] font-semibold',
              urgency.kind === 'overdue'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-100 text-amber-800',
            ].join(' ')}
          >
            {urgency.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers (component-local; consider lifting to /lib if reused)
// ---------------------------------------------------------------------------

function compactAging(bucket: string | null): string {
  if (bucket === null) return '—';
  // "120-179 day" → "120-179d"
  return bucket.replace(/\s*day$/, 'd');
}

interface NextTaskInfo {
  nextTaskText: string;
  allComplete: boolean;
}

interface UrgencyInfo {
  kind: 'overdue' | 'today';
  label: string;
}

function deriveNextTask(
  steps: WorkflowStep[] | null | undefined,
  state: string,
): NextTaskInfo {
  void state; // referenced for parity with potential future state-aware logic
  if (steps === null || steps === undefined || steps.length === 0) {
    return { nextTaskText: 'No workflow steps', allComplete: false };
  }
  const firstIncomplete = steps.find(
    (s) => s.completed_at === null || s.completed_at === undefined,
  );
  if (firstIncomplete === undefined) {
    return { nextTaskText: 'All steps complete', allComplete: true };
  }
  return {
    nextTaskText: firstIncomplete.action,
    allComplete: false,
  };
}

function pickPrimaryAssignee(
  steps: WorkflowStep[] | null | undefined,
): string | null {
  if (steps === null || steps === undefined) return null;
  const firstIncomplete = steps.find(
    (s) => s.completed_at === null || s.completed_at === undefined,
  );
  if (firstIncomplete === undefined) return null;
  // v2.0.0 (Ask 14): assignee_name denormalized onto WorkflowStep server-side.
  return (firstIncomplete as any).assignee_name ?? null;
}

function pickUrgency(
  steps: WorkflowStep[] | null | undefined,
): UrgencyInfo | null {
  if (steps === null || steps === undefined) return null;
  const firstIncomplete = steps.find(
    (s) => s.completed_at === null || s.completed_at === undefined,
  );
  if (firstIncomplete === undefined) return null;
  const dueDateStr = firstIncomplete.effective_due_date;
  if (dueDateStr === null || dueDateStr === undefined) return null;
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return { kind: 'overdue', label: `Overdue ${-diffDays}d` };
  if (diffDays === 0) return { kind: 'today', label: 'Today' };
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckboxMini({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: (e: React.MouseEvent) => void;
}): JSX.Element {
  return (
    <span
      onClick={onToggle}
      className={[
        'mr-1.5 inline-flex h-3.5 w-3.5 flex-shrink-0 cursor-pointer items-center justify-center rounded-sm border-[1.5px]',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/40',
      ].join(' ')}
      role="checkbox"
      aria-checked={checked}
    >
      {checked ? (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : null}
    </span>
  );
}

function AssigneeAvatar({ name }: { name: string }): JSX.Element {
  // Derive 2-char initials + a deterministic color from name hash.
  const initials = name
    .split(/[\s,.]+/)
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    '#b45309',
    '#1e40af',
    '#5b21b6',
    '#15803d',
    '#be185d',
    '#9f1239',
    '#0d9488',
  ];
  const bg = colors[hash % colors.length]!;
  return (
    <span
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7.5px] font-bold text-white"
      style={{ backgroundColor: bg }}
    >
      {initials}
    </span>
  );
}

const STATE_PILL_CLASS: Record<string, string> = {
  recommended: 'bg-primary/10 text-primary',
  accepted: 'bg-blue-100 text-blue-900',
  overridden: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
};
