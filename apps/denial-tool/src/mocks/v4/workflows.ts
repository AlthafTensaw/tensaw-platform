/**
 * Mock workflow definitions for the v4 engine simulator.
 *
 * In production, workflows are stored in the engine service. In the mock,
 * they're simple ordered arrays of task definitions that the simulator
 * walks through linearly on task.complete with outcome=SUCCESS.
 *
 * Coverage:
 *   - 4 workflows exercising 8 of the 11 task types
 *   - high_dollar_oversight, bank_rec_match: sidecar/late-stage; spawned
 *     conditionally, not via these linear workflows
 *   - portal_status_check: featured in portal_first_resolution
 *
 * Drop-in path: src/mocks/v4/workflows.ts
 */

import type { TaskType } from '../../actions/schemas-v4';

export interface TaskDef {
  task_type: TaskType;
  queue_id: string;
  // How many SLA-days before this task's due_at
  sla_days: number;
}

export interface WorkflowDef {
  name: string;
  step_labels: string[]; // shown in WorkflowProgressStrip + WorkflowPreview
  steps: TaskDef[];
}

/**
 * Workflow registry — keyed by workflow_name.
 *
 * Each workflow's first task is opened on accept/override. On task.complete
 * with outcome=SUCCESS, the simulator opens the next step. After the last
 * step completes, case_status → completed.
 */
export const WORKFLOWS: Record<string, WorkflowDef> = {
  // Standard medical necessity appeal — records pull + appeal letter
  medical_necessity_resolution: {
    name: 'medical_necessity_resolution',
    step_labels: [
      'Intake triage',
      'Resolution',
      'Awaiting payer',
      'AM review',
      'Posting',
    ],
    steps: [
      { task_type: 'intake_triage', queue_id: 'denial_intake_analyst_primrose', sla_days: 2 },
      { task_type: 'resolution_action', queue_id: 'resolution_primrose', sla_days: 3 },
      { task_type: 'awaiting_payer_check', queue_id: 'resolution_primrose', sla_days: 30 },
      { task_type: 'am_review', queue_id: 'am_review_primrose', sla_days: 2 },
      { task_type: 'posting_apply', queue_id: 'posting_primrose', sla_days: 1 },
    ],
  },

  // Coding partner branch — coding verifies CPT, originator reviews feedback
  coding_review_branch: {
    name: 'coding_review_branch',
    step_labels: [
      'Intake triage',
      'Coding review',
      'Feedback review',
      'Resolution',
      'Awaiting payer',
      'Posting',
    ],
    steps: [
      { task_type: 'intake_triage', queue_id: 'denial_intake_analyst_primrose', sla_days: 2 },
      { task_type: 'coding_review', queue_id: 'coding_primrose', sla_days: 3 },
      // The next step routes BACK to originator's personal queue. The simulator
      // overrides queue_id to `user_${originated_by_user_id}` at runtime — the
      // team-handoff return pattern.
      { task_type: 'coding_feedback_review', queue_id: 'user_<originator>', sla_days: 1 },
      { task_type: 'resolution_action', queue_id: 'resolution_primrose', sla_days: 3 },
      { task_type: 'awaiting_payer_check', queue_id: 'resolution_primrose', sla_days: 30 },
      { task_type: 'posting_apply', queue_id: 'posting_primrose', sla_days: 1 },
    ],
  },

  // Direct payer call workflow — vague denials, auth missing
  payer_call_resolution: {
    name: 'payer_call_resolution',
    step_labels: [
      'Intake triage',
      'Payer call',
      'Resolution',
      'Awaiting payer',
    ],
    steps: [
      { task_type: 'intake_triage', queue_id: 'denial_intake_analyst_primrose', sla_days: 2 },
      { task_type: 'payer_call', queue_id: 'denial_intake_analyst_primrose', sla_days: 3 },
      { task_type: 'resolution_action', queue_id: 'resolution_primrose', sla_days: 3 },
      { task_type: 'awaiting_payer_check', queue_id: 'resolution_primrose', sla_days: 30 },
    ],
  },

  // Portal-first workflow — check payer portal before deciding next step
  portal_first_resolution: {
    name: 'portal_first_resolution',
    step_labels: [
      'Intake triage',
      'Portal check',
      'Resolution',
      'Awaiting payer',
      'Posting',
    ],
    steps: [
      { task_type: 'intake_triage', queue_id: 'denial_intake_analyst_primrose', sla_days: 2 },
      { task_type: 'portal_status_check', queue_id: 'denial_intake_analyst_primrose', sla_days: 2 },
      { task_type: 'resolution_action', queue_id: 'resolution_primrose', sla_days: 3 },
      { task_type: 'awaiting_payer_check', queue_id: 'resolution_primrose', sla_days: 30 },
      { task_type: 'posting_apply', queue_id: 'posting_primrose', sla_days: 1 },
    ],
  },
};

/**
 * Category → workflow_name mapping. When a case is accepted, the simulator
 * looks up the workflow by the case's recommended_category (or override_category).
 */
export const CATEGORY_TO_WORKFLOW: Record<string, string> = {
  medical_necessity: 'medical_necessity_resolution',
  medical_records_missing: 'medical_necessity_resolution',
  modifier_missing: 'coding_review_branch',
  modifier_wrong: 'coding_review_branch',
  auth_missing: 'payer_call_resolution',
  vague_denial: 'payer_call_resolution',
  coverage_lapsed: 'portal_first_resolution',
  patient_not_eligible: 'portal_first_resolution',
  clarification_other: 'portal_first_resolution',
};

/**
 * Get the next task def in a workflow. Returns null if the workflow is
 * complete (last step done).
 */
export function getNextTaskDef(
  workflowName: string,
  currentStepIndex: number,
): { def: TaskDef; nextIndex: number } | null {
  const wf = WORKFLOWS[workflowName];
  if (!wf) return null;
  const nextIndex = currentStepIndex + 1;
  if (nextIndex >= wf.steps.length) return null;
  return { def: wf.steps[nextIndex]!, nextIndex };
}

/**
 * Get the first task def — used when a case is accepted/overridden.
 */
export function getFirstTaskDef(workflowName: string): TaskDef | null {
  const wf = WORKFLOWS[workflowName];
  if (!wf) return null;
  return wf.steps[0] ?? null;
}

/**
 * Build engine_state_code from workflow + step index. Used by the simulator
 * to set case.engine_state_code so the UI's progress strip knows where we are.
 */
export function engineStateCode(workflowName: string, stepIndex: number): string {
  const wf = WORKFLOWS[workflowName];
  if (!wf || stepIndex >= wf.steps.length) return 'COMPLETED';
  const taskType = wf.steps[stepIndex]!.task_type;
  return `${taskType.toUpperCase()}_OPEN`;
}
