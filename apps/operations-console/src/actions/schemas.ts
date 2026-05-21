/**
 * Zod schemas for Phase A action responses.
 *
 * Each schema mirrors the backend's Pydantic response model from
 * `tensaw-workflow-runtime` v0.1.2:
 *   - AdminCaseRow + PaginatedAdminCasesResponse → admin_models.py
 *   - RecentActivityRow + RecentActivityResponse → admin_models.py
 *   - StuckCaseResponse + PaginatedStuckCasesResponse → admin_models.py
 *   - CaseSnapshotResponse → models.py (CaseResponse + tasks + facts)
 *   - StepHistoryResponse + PaginatedHistoryResponse → models.py
 *   - SchedulerHealth — no Pydantic counterpart yet; shape derived from
 *     OPERATIONS_GUIDE for v0.1.2 (see "Backend integration notes" below)
 *
 * Backend deviations the MSW must mirror (per Phase_A_Handback.md):
 *   1. `trigger_type` accepts the actual v0.1.0 schema values:
 *      POLL, SIGNAL, MANUAL_ADVANCE, RECLAIM (plus v0.1.2 additions
 *      CONSOLE_RETRY, CONSOLE_CLOSE) — NOT the spec §3.2 list which
 *      conflates outcomes.
 *   2. Phase A leaves actor_subject/actor_email/console_action_type/reason
 *      as null on every recent-activity row. Wire fields are present;
 *      Phase B (v0.1.2) would populate them.
 *   3. Closed cases keep their `state_code` — `closed_at IS NOT NULL` is
 *      the indicator. Schemas reflect this.
 *
 * All schemas use `.passthrough()` only where backend explicitly uses
 * `extra='ignore'` and we want forward-compat. Default: strict-ish.
 */

import { z } from 'zod';

// ---- Enums + literals -----------------------------------------------------

/**
 * Case state codes used by the demo workflow (denial-v1).
 * The backend doesn't constrain this to an enum (workflows are
 * tenant-defined), so we accept any string and the UI uses these as
 * the canonical demo set for dropdowns.
 */
export const DEMO_STATE_CODES = [
  'NEW_DENIAL',
  'GATHER_FACESHEET',
  'DRAFTING_APPEAL',
  'APPEAL_REVIEW',
  'APPEAL_PENDING',
  'ESCALATED',
  'CLOSED',
] as const;
export type DemoStateCode = (typeof DEMO_STATE_CODES)[number];

/** Demo case types. */
export const DEMO_CASE_TYPES = ['DENIAL', 'PRIOR_AUTH', 'APPEAL'] as const;
export type DemoCaseType = (typeof DEMO_CASE_TYPES)[number];

/**
 * Trigger types accepted by the recent-activity endpoint (per
 * backend handback deviation #1). These are the actual v0.1.0
 * schema values plus v0.1.2 additions.
 */
export const TRIGGER_TYPES = [
  'POLL',
  'SIGNAL',
  'MANUAL_ADVANCE',
  'RECLAIM',
  'CONSOLE_RETRY',
  'CONSOLE_CLOSE',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** Stuck-reason vocabulary from `classify_stuck_reason`. */
export const STUCK_REASONS = ['fatal_error', 'max_attempts', 'overdue'] as const;
export type StuckReason = (typeof STUCK_REASONS)[number];

/** Sort options for admin cases listing. */
export const CASE_SORT_OPTIONS = [
  'age_desc',
  'age_asc',
  'last_activity_desc',
  'case_id_asc',
] as const;
export type CaseSortOption = (typeof CASE_SORT_OPTIONS)[number];

/** Group-by options for admin cases listing. */
export const CASE_GROUP_BY_OPTIONS = [
  'state_code',
  'case_type',
  'clinic_id',
  'payer_id',
] as const;
export type CaseGroupBy = (typeof CASE_GROUP_BY_OPTIONS)[number];

// ---- Admin cases listing (GET /v1/admin/cases) ----------------------------

/**
 * Admin case row — mirrors AdminCaseRow Pydantic model.
 * One wide row per case with everything the dashboard / case list /
 * activity stream screens might need.
 */
export const AdminCaseRowSchema = z.object({
  case_id: z.string(),
  case_type: z.string(),
  workflow_name: z.string(),
  workflow_version: z.string(),
  state_code: z.string(),
  state_updated_at: z.string().datetime().nullable(),
  clinic_id: z.string().nullable(),
  payer_id: z.string().nullable(),
  owner_user_id: z.string().nullable(),
  queue_id: z.string().nullable(),
  priority_code: z.string(),
  next_action_at: z.string().datetime().nullable(),
  opened_at: z.string().datetime().nullable(),
  closed_at: z.string().datetime().nullable(),
  attempt_count: z.number().int(),
  max_attempts: z.number().int().nullable(),
  last_error_code: z.string().nullable(),
  last_error_at: z.string().datetime().nullable(),
  open_task_count: z.number().int(),
  is_stuck: z.boolean(),
  /** null when is_stuck=false; one of `fatal_error|max_attempts|overdue` otherwise. */
  stuck_reason: z.string().nullable(),
});
export type AdminCaseRow = z.infer<typeof AdminCaseRowSchema>;

export const PaginatedAdminCasesResponseSchema = z.object({
  items: z.array(AdminCaseRowSchema),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
  /**
   * Present only when the request set `group_by`. Flat
   * `{value: count}` map. The literal string `"<null>"` is the
   * server's bucket for null values (per backend handback caveat
   * "NULL bucket convention").
   */
  groups: z.record(z.string(), z.number().int()).nullable().optional(),
});
export type PaginatedAdminCasesResponse = z.infer<
  typeof PaginatedAdminCasesResponseSchema
>;

// ---- Recent activity (GET /v1/admin/recent-activity) ----------------------

/**
 * Recent activity row — mirrors RecentActivityRow Pydantic model.
 * Phase A leaves actor_subject / actor_email / console_action_type / reason
 * as null on every row (per backend handback deviation #2). Wire fields
 * are present so Phase B can populate without a schema break.
 */
export const RecentActivityRowSchema = z.object({
  history_id: z.number().int(),
  case_id: z.string(),
  case_type: z.string().nullable(),
  clinic_id: z.string().nullable(),
  occurred_at: z.string().datetime().nullable(),
  state_code_from: z.string().nullable(),
  state_code_to: z.string().nullable(),
  trigger_type: z.string(),
  trigger_outcome: z.string().nullable(),
  handler_key: z.string().nullable(),
  actor_subject: z.string().nullable(),
  actor_email: z.string().nullable(),
  console_action_type: z.string().nullable(),
  reason: z.string().nullable(),
  correlation_id: z.string().nullable(),
});
export type RecentActivityRow = z.infer<typeof RecentActivityRowSchema>;

export const RecentActivityResponseSchema = z.object({
  items: z.array(RecentActivityRowSchema),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
  /**
   * Absolute timestamp the time-window filter resolved to. Lets the
   * UI display "since 14:32 UTC" without re-parsing the duration.
   */
  since: z.string().datetime(),
});
export type RecentActivityResponse = z.infer<typeof RecentActivityResponseSchema>;

// ---- Stuck cases (GET /v1/admin/stuck-cases) ------------------------------

/**
 * Stuck case row — mirrors StuckCaseResponse Pydantic model.
 * A case is stuck when:
 *   - last_error_retryable=False (terminal failure), OR
 *   - attempt_count >= max_attempts, OR
 *   - next_action_at > 1 hour in the past on an open case.
 */
export const StuckCaseRowSchema = z.object({
  case_id: z.string(),
  case_type: z.string(),
  state_code: z.string(),
  attempt_count: z.number().int(),
  max_attempts: z.number().int().nullable(),
  last_error_code: z.string().nullable(),
  last_error_source: z.string().nullable(),
  last_error_retryable: z.boolean().nullable(),
  next_action_at: z.string().datetime().nullable(),
  opened_at: z.string().datetime().nullable(),
  /** One of `fatal_error|max_attempts|overdue`. */
  stuck_reason: z.string(),
});
export type StuckCaseRow = z.infer<typeof StuckCaseRowSchema>;

export const StuckCasesResponseSchema = z.object({
  items: z.array(StuckCaseRowSchema),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
});
export type StuckCasesResponse = z.infer<typeof StuckCasesResponseSchema>;

// ---- Case detail (GET /v1/cases/{case_id}) --------------------------------

/**
 * Case row — mirrors CaseResponse from runtime models.py. Wider than
 * AdminCaseRow because it includes the full set of fields the case
 * detail screen needs (substate, step, identifiers, etc.).
 */
export const CaseDetailCaseSchema = z.object({
  case_id: z.string(),
  case_type: z.string(),
  workflow_name: z.string(),
  workflow_version: z.string().nullable(),
  state_code: z.string(),
  substate_code: z.string().nullable(),
  step_code: z.string().nullable(),
  clinic_id: z.string().nullable(),
  facility_id: z.string().nullable(),
  provider_id: z.string().nullable(),
  payer_id: z.string().nullable(),
  patient_id: z.string().nullable(),
  claim_id: z.string().nullable(),
  priority_code: z.string().nullable(),
  queue_id: z.string().nullable(),
  owner_user_id: z.string().nullable(),
  owner_user_name: z.string().nullable(),
  next_action_at: z.string().datetime().nullable(),
  due_at: z.string().datetime().nullable(),
  opened_at: z.string().datetime().nullable(),
  closed_at: z.string().datetime().nullable(),
  attempt_count: z.number().int(),
  max_attempts: z.number().int().nullable(),
  last_error_code: z.string().nullable(),
  last_error_source: z.string().nullable(),
  last_error_retryable: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});
export type CaseDetailCase = z.infer<typeof CaseDetailCaseSchema>;

/** Open task — mirrors TaskResponse from runtime models.py. */
export const TaskSchema = z.object({
  task_id: z.string(),
  case_id: z.string(),
  task_type: z.string(),
  intent_key: z.string(),
  state_code: z.string(),
  substate_code: z.string().nullable(),
  handler_key: z.string().nullable(),
  handler_version: z.string().nullable(),
  queue_id: z.string().nullable(),
  priority_code: z.string().nullable(),
  priority_rank: z.number().int().nullable(),
  opened_at: z.string().datetime().nullable(),
  due_at: z.string().datetime().nullable(),
  closed_at: z.string().datetime().nullable(),
  next_action_at: z.string().datetime().nullable(),
  close_reason_code: z.string().nullable(),
  attempt_count: z.number().int(),
});
export type Task = z.infer<typeof TaskSchema>;

/**
 * Fact row — mirrors FactResponse from runtime models.py.
 * The four typed value columns are exposed; the UI picks the one
 * matching the declared fact type.
 */
export const FactSchema = z.object({
  fact_key: z.string(),
  fact_value_str: z.string().nullable(),
  fact_value_num: z.number().nullable(),
  fact_value_bool: z.boolean().nullable(),
  fact_value_date: z.string().datetime().nullable(),
  /** Provenance: LLM / SYSTEM / ERA / USER (per BRD §2.4 wireframe). */
  source: z.string().nullable(),
  updated_at: z.string().datetime().nullable(),
});
export type Fact = z.infer<typeof FactSchema>;

/** Case detail response — mirrors CaseSnapshotResponse. */
export const CaseDetailResponseSchema = z.object({
  case: CaseDetailCaseSchema,
  tasks: z.array(TaskSchema),
  facts: z.array(FactSchema),
});
export type CaseDetailResponse = z.infer<typeof CaseDetailResponseSchema>;

// ---- Case history (GET /v1/cases/{case_id}/history) -----------------------

/**
 * Step history row — mirrors StepHistoryResponse from runtime models.py.
 * One row per state transition / handler invocation.
 */
export const StepHistoryRowSchema = z.object({
  step_history_id: z.number().int(),
  case_id: z.string(),
  task_id: z.string().nullable(),
  correlation_id: z.string(),
  trigger_type: z.string(),
  handler_key: z.string().nullable(),
  handler_version: z.string().nullable(),
  state_before: z.string().nullable(),
  state_after: z.string().nullable(),
  outcome_code: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  started_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
});
export type StepHistoryRow = z.infer<typeof StepHistoryRowSchema>;

export const CaseHistoryResponseSchema = z.object({
  items: z.array(StepHistoryRowSchema),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
});
export type CaseHistoryResponse = z.infer<typeof CaseHistoryResponseSchema>;

// ---- Scheduler health (GET /v1/health/scheduler) --------------------------

/**
 * Scheduler health — shape derived from OPERATIONS_GUIDE.
 * No Pydantic counterpart was available in the v0.1.2 tarball at the
 * level of detail other endpoints provide; if the real backend ships
 * additional fields, the schema is forward-compatible because zod
 * by default ignores unknown keys (we don't `.strict()`).
 *
 * Frontend uses this for the Dashboard's "Polling lag" KPI card.
 */
export const SchedulerHealthSchema = z.object({
  /** Last poll timestamp (UTC ISO-8601). */
  last_poll_at: z.string().datetime().nullable(),
  /** Polling lag in seconds. The KPI threshold is configurable. */
  polling_lag_seconds: z.number().nullable(),
  /** Active leases held by handlers. */
  active_lease_count: z.number().int(),
  /** Runtime version reporting status. */
  version: z.string(),
  /** Overall status hint. */
  status: z.enum(['healthy', 'degraded', 'down']),
});
export type SchedulerHealth = z.infer<typeof SchedulerHealthSchema>;
