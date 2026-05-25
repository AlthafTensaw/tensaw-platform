/**
 * Denial Tool — in-memory state for MSW handlers (PR-5).
 *
 * PR-5 additions:
 *   - completeStep(): marks a workflow step done by patching its
 *     `completed_at` + `completed_by` fields. Idempotent — re-marking
 *     a completed step returns the original timestamp.
 *   - Auto-transition: when completeStep finishes the last step AND
 *     the classification is in `accepted` or `overridden`, the
 *     classification state auto-advances to `completed`.
 */

import type {
  Classification,
  WorkflowStep,
  WorklistRow,
} from '../schemas/denial';
import { WORKLIST_ROWS } from '../fixtures/denial/recommendations';

let rows: WorklistRow[] = WORKLIST_ROWS.map(cloneRow);

interface OverrideAuditEntry {
  classification_id: string;
  previous_state: Classification['state'];
  new_state: Classification['state'];
  transitioned_at: string;
  transitioned_by_sub: string;
  reason?: string;
  notes?: string;
  corrected_category?: string;
  corrected_branch?: string;
}

interface RevealPhiAuditEntry {
  audit_event_id: string;
  classification_id: string;
  field_path: string;
  purpose: string;
  notes?: string;
  recorded_at: string;
  user_sub: string;
}

let stateAudit: OverrideAuditEntry[] = [];
let revealAudit: RevealPhiAuditEntry[] = [];

function cloneRow(r: WorklistRow): WorklistRow {
  return {
    claim: { ...r.claim },
    classification: {
      ...r.classification,
      workflow_steps: r.classification.workflow_steps.map((s) => ({ ...s })),
    },
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listRows(): WorklistRow[] {
  return rows;
}

export function findRow(classificationId: string): WorklistRow | null {
  return (
    rows.find((r) => r.classification.classification_id === classificationId) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Mutations — classification state
// ---------------------------------------------------------------------------

export function patchClassification(
  classificationId: string,
  patch: Partial<Classification>,
): WorklistRow | null {
  const idx = rows.findIndex(
    (r) => r.classification.classification_id === classificationId,
  );
  if (idx < 0) return null;
  const existing = rows[idx]!;
  const updated: WorklistRow = {
    ...existing,
    classification: { ...existing.classification, ...patch },
  };
  rows[idx] = updated;
  return updated;
}

// ---------------------------------------------------------------------------
// Mutations — step completion (Phase 1.5)
// ---------------------------------------------------------------------------

export interface StepCompletionOutcome {
  row: WorklistRow;
  step: WorkflowStep;
  next_step_number: number | null;
  all_steps_completed: boolean;
  auto_completed_classification: boolean;
}

/**
 * Mark step `stepNumber` complete on `classificationId`. Returns the
 * outcome including next-step pointer and any auto-transition that
 * fired. Returns null if classification or step not found.
 *
 * Idempotency: re-marking an already-completed step returns the original
 * timestamp + completed_by and does NOT update them, matching backend.
 */
export function completeStep(
  classificationId: string,
  stepNumber: number,
  completedBy: string,
): StepCompletionOutcome | null {
  const idx = rows.findIndex(
    (r) => r.classification.classification_id === classificationId,
  );
  if (idx < 0) return null;
  const row = rows[idx]!;
  const steps = row.classification.workflow_steps;
  const stepIdx = steps.findIndex((s) => s.step === stepNumber);
  if (stepIdx < 0) return null;
  const step = steps[stepIdx]!;

  let updatedStep: WorkflowStep;
  if (step.completed_at != null) {
    // Idempotent — return as-is
    updatedStep = step;
  } else {
    updatedStep = {
      ...step,
      completed_at: new Date().toISOString(),
      completed_by: completedBy,
    };
  }

  const newSteps = steps.map((s, i) => (i === stepIdx ? updatedStep : s));
  const allDone = newSteps.every((s) => s.completed_at != null);
  const nextIncomplete = newSteps.find((s) => s.completed_at == null);
  const nextStepNumber = nextIncomplete?.step ?? null;

  let newState = row.classification.state;
  let autoCompleted = false;
  if (
    allDone &&
    (row.classification.state === 'accepted' ||
      row.classification.state === 'overridden')
  ) {
    newState = 'completed';
    autoCompleted = true;
  }

  const updatedRow: WorklistRow = {
    ...row,
    classification: {
      ...row.classification,
      workflow_steps: newSteps,
      state: newState,
    },
  };
  rows[idx] = updatedRow;

  return {
    row: updatedRow,
    step: updatedStep,
    next_step_number: nextStepNumber,
    all_steps_completed: allDone,
    auto_completed_classification: autoCompleted,
  };
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export function appendAudit(entry: OverrideAuditEntry): void {
  stateAudit = [...stateAudit, entry];
}

export function listAudit(): readonly OverrideAuditEntry[] {
  return stateAudit;
}

export function appendRevealAudit(entry: RevealPhiAuditEntry): void {
  revealAudit = [...revealAudit, entry];
}

export function listRevealAudit(): readonly RevealPhiAuditEntry[] {
  return revealAudit;
}

// ---------------------------------------------------------------------------
// Reset for tests
// ---------------------------------------------------------------------------

export function resetMockDenialState(): void {
  rows = WORKLIST_ROWS.map(cloneRow);
  stateAudit = [];
  revealAudit = [];
}

// ---------------------------------------------------------------------------
// v1.7.2 + v1.8.0: step assignment + status state
// ---------------------------------------------------------------------------

import type {
  StepAssignmentRequest,
  StepAssignmentResponse,
  StepStatus,
  WorkflowStep,
} from '../schemas/denial';

interface StoredAssignment {
  classification_id: string;
  step_number: number;
  assigned_to_user_id: number | null;
  assigned_by_user_id: number | null;
  assigned_at: string | null;
  due_date: string | null;
  priority: 'low' | 'normal' | 'high';
  status: StepStatus;
}

// Map key: `${classification_id}::${step_number}`
const assignments = new Map<string, StoredAssignment>();

function keyFor(cid: string, step: number): string {
  return `${cid}::${String(step)}`;
}

function defaultPriorityForSla(slaDays: number): 'low' | 'normal' | 'high' {
  if (slaDays <= 1) return 'high';
  if (slaDays <= 14) return 'normal';
  return 'low';
}

function findStep(
  cid: string,
  stepNumber: number,
): { row: WorklistRow; step: WorkflowStep } | null {
  const row = findRow(cid);
  if (!row) return null;
  const step = row.classification.workflow_steps.find(
    (s) => s.step === stepNumber,
  );
  if (!step) return null;
  return { row, step };
}

function computeEffectiveDueDate(
  classifiedAt: string,
  slaDays: number,
  override: string | null,
): string {
  if (override) return override;
  const base = new Date(classifiedAt);
  base.setUTCDate(base.getUTCDate() + slaDays);
  return base.toISOString().slice(0, 10);
}

function buildResponse(
  cid: string,
  stepNumber: number,
  stored: StoredAssignment,
  step: WorkflowStep,
  classifiedAt: string,
): StepAssignmentResponse {
  return {
    classification_id: cid,
    step_number: stepNumber,
    assigned_to_user_id: stored.assigned_to_user_id,
    assigned_by_user_id: stored.assigned_by_user_id,
    assigned_at: stored.assigned_at,
    due_date: stored.due_date,
    effective_due_date: computeEffectiveDueDate(
      classifiedAt,
      step.sla_days,
      stored.due_date,
    ),
    priority: stored.priority,
    status: stored.status,
    // v1.6.0+: completed_at/completed_by populated from the step row when present
    completed_at: step.completed_at ?? null,
    completed_by: step.completed_by ?? null,
  };
}

export function upsertStepAssignment(
  cid: string,
  stepNumber: number,
  patch: StepAssignmentRequest,
): { response: StepAssignmentResponse; created: boolean } | null {
  const found = findStep(cid, stepNumber);
  if (!found) return null;
  const { row, step } = found;

  const k = keyFor(cid, stepNumber);
  const existing = assignments.get(k);
  const created = !existing;

  const stored: StoredAssignment = {
    classification_id: cid,
    step_number: stepNumber,
    assigned_to_user_id:
      patch.assigned_to_user_id !== undefined
        ? patch.assigned_to_user_id
        : (existing?.assigned_to_user_id ?? null),
    // assigned_by_user_id remains null in v1.7.2 dev mode (no cognito mapping)
    assigned_by_user_id: existing?.assigned_by_user_id ?? null,
    assigned_at: existing?.assigned_at ?? new Date().toISOString(),
    due_date:
      patch.due_date !== undefined
        ? patch.due_date
        : (existing?.due_date ?? null),
    priority:
      patch.priority ?? existing?.priority ?? defaultPriorityForSla(step.sla_days),
    status: patch.status ?? existing?.status ?? 'pending',
  };

  assignments.set(k, stored);

  // Mirror the assignment back onto the step object so GET /v1/claims/{cid}
  // sees the latest state.
  step.assigned_to_user_id = stored.assigned_to_user_id;
  step.assigned_by_user_id = stored.assigned_by_user_id;
  step.assigned_at = stored.assigned_at;
  step.due_date = stored.due_date;
  step.effective_due_date = computeEffectiveDueDate(
    row.classification.classified_at,
    step.sla_days,
    stored.due_date,
  );
  step.priority = stored.priority;
  step.status = stored.status;

  return {
    response: buildResponse(cid, stepNumber, stored, step, row.classification.classified_at),
    created,
  };
}

export function clearStepAssignment(cid: string, stepNumber: number): boolean {
  const k = keyFor(cid, stepNumber);
  if (!assignments.has(k)) return false;
  assignments.delete(k);
  const found = findStep(cid, stepNumber);
  if (found) {
    const { step } = found;
    step.assigned_to_user_id = null;
    step.assigned_by_user_id = null;
    step.assigned_at = null;
    step.due_date = null;
    step.priority = 'normal';
    // status preserved — clearing assignment shouldn't reopen a completed step
  }
  return true;
}

export function setStepStatus(
  cid: string,
  stepNumber: number,
  newStatus: StepStatus,
): StepAssignmentResponse | null {
  const found = findStep(cid, stepNumber);
  if (!found) return null;
  const { row, step } = found;

  const k = keyFor(cid, stepNumber);
  const existing = assignments.get(k);
  const stored: StoredAssignment = existing ?? {
    classification_id: cid,
    step_number: stepNumber,
    assigned_to_user_id: null,
    assigned_by_user_id: null,
    assigned_at: new Date().toISOString(),
    due_date: null,
    priority: defaultPriorityForSla(step.sla_days),
    status: 'pending',
  };

  stored.status = newStatus;

  // Setting status=complete also creates the completion row.
  // Setting back to pending/in_progress deletes it (reopen).
  if (newStatus === 'complete') {
    step.completed_at = step.completed_at ?? new Date().toISOString();
    step.completed_by = step.completed_by ?? 'mock-user';
  } else if (newStatus === 'pending' || newStatus === 'in_progress') {
    step.completed_at = null;
    step.completed_by = null;
  }
  step.status = newStatus;
  assignments.set(k, stored);

  return buildResponse(cid, stepNumber, stored, step, row.classification.classified_at);
}

// Augment the existing reset to clear assignment state.
// Note: we deliberately do NOT backfill effective_due_date / priority on
// every step at module load. BE returns these as null for steps without an
// assignment row (see denial-tool-service v1.9.0 row_to_classification
// converter). Backfilling here would mask FE bugs that only surface when
// hitting the real BE.
const originalReset = resetMockDenialState;
function backfillCompletedStepsOnly(): void {
  // For pre-completed steps in seed data, surface status='complete' via
  // the existing completed_at field. BE derives this in row_to_classification
  // as: status = complete if completion_row exists. Mirror that here so
  // our seed-completed steps render correctly.
  for (const row of listRows() as readonly WorklistRow[]) {
    for (const step of row.classification.workflow_steps) {
      if (step.completed_at) {
        step.status = 'complete';
      }
    }
  }
}

export function resetAndBackfill(): void {
  originalReset();
  assignments.clear();
  backfillCompletedStepsOnly();
}

// Run on module load so seed-completed steps reflect status correctly.
backfillCompletedStepsOnly();

/**
 * Seed initial demo assignments so the My Tasks page shows realistic data
 * in dev mode without anyone having to manually click around the Worklist
 * first.
 *
 * Strategy: assign step 2 ("check facility EMR") to Bhavana (user_id 12) on
 * the first ~6 Cat-04 (Medical Record Missing) classifications that are in
 * accepted/overridden state. Mix the due dates so the page demonstrates
 * overdue / today / future states.
 */
function seedDemoAssignments(): void {
  const todayMs = Date.now();
  const dayMs = 86_400_000;
  const dueOffsets = [-2, 0, 0, 3, 5, 7]; // overdue, today, today, soon, soon, future
  let bhavanaIdx = 0;
  let aniketIdx = 0;

  for (const row of listRows()) {
    if (row.classification.primary_category.startsWith('04.')) {
      const step2 = row.classification.workflow_steps.find((s) => s.step === 2);
      if (!step2) continue;
      const offset = dueOffsets[bhavanaIdx];
      if (offset === undefined) continue;
      const dueDate = new Date(todayMs + offset * dayMs).toISOString().slice(0, 10);
      step2.assigned_to_user_id = 12; // Bhavana
      step2.assigned_by_user_id = 1; // Vipin / Renita placeholder
      step2.assigned_at = new Date(todayMs - (bhavanaIdx + 1) * dayMs).toISOString();
      step2.due_date = dueDate;
      step2.effective_due_date = dueDate;
      step2.priority = bhavanaIdx === 0 ? 'high' : 'normal';
      step2.status = bhavanaIdx === 0 ? 'in_progress' : 'pending';
      bhavanaIdx += 1;
    }
    if (row.classification.primary_category.startsWith('03.') && aniketIdx < 2) {
      const step2 = row.classification.workflow_steps.find((s) => s.step === 2);
      if (!step2) continue;
      const dueDate = new Date(todayMs + (aniketIdx + 3) * dayMs).toISOString().slice(0, 10);
      step2.assigned_to_user_id = 12; // Bhavana also checks Cat 03 referral records
      step2.assigned_by_user_id = 1;
      step2.assigned_at = new Date(todayMs - 2 * dayMs).toISOString();
      step2.due_date = dueDate;
      step2.effective_due_date = dueDate;
      step2.priority = 'normal';
      step2.status = 'pending';
      aniketIdx += 1;
    }
  }
}
seedDemoAssignments();
