/**
 * Denial Analyst Tool — Schemas v4.0.0
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Domain type definitions (Zod schemas) for the new denial-management-service
 * v1.1.0 backend. Companion to: FE-v4.0.0-design-contract.md (§1 Domain types).
 *
 * Drop-in path: src/actions/schemas-v4.ts
 *
 * During the v3 → v4 transition both schema files coexist:
 *   - src/actions/schemas.ts     (v3.x — Classification, ClassificationStep, …)
 *   - src/actions/schemas-v4.ts  (this file — Case, EngineTask, …)
 *
 * Action registry entries in src/actions/index.ts can import from either.
 * v3 entries get removed once their v4 equivalents are wired through.
 *
 * Key conceptual shifts from v3.x:
 *   - `Classification` → `Case`
 *   - `classification_id` → `case_id`
 *   - `assignee_user_id` per step → `originated_by_user_id` on case +
 *      `queue_id` on task (different semantics: no per-user assignment)
 *   - `WorkflowStep[]` array → derived from `engine_tasks_open` +
 *      `workflow_name` + `engine_state_code` (engine drives this)
 *   - `denial.*` action IDs → `case.*` / `task.*` / `queue.*`
 */

import { z } from 'zod';

// ============================================================================
// §1.1 — Case status + Case
// ============================================================================

/**
 * The lifecycle states a Case moves through.
 *
 *   proposed   — LLM classified; awaiting analyst accept/override
 *   accepted   — Analyst accepted LLM recommendation; engine workflow running
 *   overridden — Analyst overrode the LLM; engine workflow running with new category
 *   completed  — Engine workflow finished
 */
export const CaseStatusSchema = z.enum([
  'proposed',
  'accepted',
  'overridden',
  'completed',
]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

/**
 * Case — the top-level domain object in v4.0.0. Replaces v3.x `Classification`.
 *
 * This is the worklist-density shape (denormalized claim + lookup labels for
 * single-fetch row rendering). For the richer detail-view shape, see
 * `CaseDetailSchema` below.
 */
export const CaseSchema = z.object({
  // Identity
  case_id: z.string(),
  case_status: CaseStatusSchema,

  // Provenance — who first accepted or overrode this case
  originated_by_user_id: z.number().int().nullable(),
  originated_by_user_name: z.string().nullable(), // joined for display
  originated_at: z.string().datetime().nullable(),

  // High-dollar oversight flag (triggered when net_pending >= $750)
  is_high_dollar: z.boolean(),
  high_dollar_shim_case_id: z.string().nullable(),

  // Live engine snapshot (workflow name + state code)
  workflow_name: z.string().nullable(),
  engine_state_code: z.string().nullable(),

  // Claim data (denormalized from rcm-data-access for worklist density)
  claim_id: z.number().int(),
  patient_name: z.string().nullable(),
  mrn: z.string(),
  dos: z.string(), // YYYY-MM-DD

  // Financial
  net_pending: z.number(), // dollars; HD threshold ref: 750.00

  // Classification — LLM proposal (locked once case_status leaves 'proposed')
  recommended_category: z.string().nullable(),
  recommended_confidence: z.number().nullable(),
  recommended_reasoning: z.string().nullable(),
  classified_at: z.string().datetime().nullable(),
  tool_version: z.string().nullable(),

  // Lookup labels (joined server-side for worklist density)
  primary_payer_name: z.string().nullable(),
  primary_payer_alias: z.string().nullable(),
  clinic_name: z.string().nullable(),
  clinic_alias: z.string().nullable(),
  aging_bucket: z.string().nullable(),

  // Timestamps
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Case = z.infer<typeof CaseSchema>;

// ============================================================================
// §1.2 — EngineTask + TaskType + TaskState + PriorityCode
// ============================================================================

/**
 * Engine task lifecycle states. From the workflow engine's perspective.
 *
 *   OPEN      — available for work
 *   CLAIMED   — a worker has picked it up (rare; mostly a transient state)
 *   COMPLETED — terminal; worker reported a HandlerOutcome
 *   CANCELLED — terminal; task was cancelled (typically by engine, not FE)
 *   FAILED    — terminal; handler reported FAIL_FATAL
 */
export const TaskStateSchema = z.enum([
  'OPEN',
  'CLAIMED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]);
export type TaskState = z.infer<typeof TaskStateSchema>;

/**
 * The 11 task types the engine emits for human workers. `task_type` is the
 * field that drives FE rendering — pick a form component from
 * `taskFormRegistry[task.task_type]`.
 *
 * Internal code-handler task types (e.g. notify_billing, archive_case) are
 * never surfaced to FE — they execute server-side and complete themselves.
 */
export const TaskTypeSchema = z.enum([
  'intake_triage',
  'portal_status_check',
  'payer_call',
  'coding_review',
  'coding_feedback_review',
  'resolution_action',
  'awaiting_payer_check',
  'am_review',
  'posting_apply',
  'bank_rec_match',
  'high_dollar_oversight',
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Task priority codes — also serve as case-level priority (set during triage).
 */
export const PriorityCodeSchema = z.enum(['high', 'normal', 'low']);
export type PriorityCode = z.infer<typeof PriorityCodeSchema>;

/**
 * EngineTask — the wire shape from the workflow engine. Replaces v3.x
 * `WorkflowStep`. Note that there's no `assigned_to_user_id` — tasks belong
 * to queues, not users.
 */
export const EngineTaskSchema = z.object({
  task_id: z.string(),
  case_id: z.string(),
  task_type: TaskTypeSchema,
  state_code: TaskStateSchema,

  // Queue routing — replaces v3's per-user assignment. Examples:
  //   'denial_intake_analyst_primrose' — team queue
  //   'user_42'                         — personal queue
  queue_id: z.string(),

  priority_code: PriorityCodeSchema,
  opened_at: z.string().datetime(),
  due_at: z.string().datetime().nullable(),

  // Engine internals — do NOT surface to UI directly.
  // intent_key is a hash for deduplication; handler_key is null for human
  // tasks, populated for code handlers.
  intent_key: z.string(),
  handler_key: z.string().nullable(),
  attempt_count: z.number().int(),
});
export type EngineTask = z.infer<typeof EngineTaskSchema>;

// ============================================================================
// §1.3 — Queue
// ============================================================================

export const QueueTypeSchema = z.enum(['team', 'personal']);
export type QueueType = z.infer<typeof QueueTypeSchema>;

/**
 * Queue — a routing destination for tasks. Powers the QueueSwitcher dropdown.
 *
 * Every worker has at minimum:
 *   - One team queue (their role-default)        — queue_type: 'team'
 *   - One personal queue (`user_<their_id>`)     — queue_type: 'personal'
 *
 * MANAGER / ADMIN roles see additional team queues marked with team_lead tag
 * (derived FE-side from JWT roles, not on the Queue shape itself).
 */
export const QueueSchema = z.object({
  queue_id: z.string(),
  queue_label: z.string(), // human-readable: 'Denial Intake — Primrose'
  queue_type: QueueTypeSchema,
  is_default_for_caller: z.boolean(),
  pending_count: z.number().int(),
});
export type Queue = z.infer<typeof QueueSchema>;

// ============================================================================
// §1.4 — WorklistRow (the {case, current_task} join shape)
// ============================================================================

/**
 * WorklistRow — the row shape returned by `case.worklist`. The engine joins
 * the most-relevant open task for the active queue context with each Case,
 * so the FE doesn't have to make N+1 task fetches.
 *
 * `current_task` may be null when no task is currently open in the viewed
 * queue (rare; typically only for completed cases shown in completed-state
 * filter).
 */
export const WorklistRowSchema = z.object({
  case: CaseSchema,
  current_task: EngineTaskSchema.nullable(),
});
export type WorklistRow = z.infer<typeof WorklistRowSchema>;

/**
 * Worklist filter values. `queue_id` is required — there's no "all cases"
 * default in v4. `needs_my_review=true` is shorthand for `queue_id=user_<me>`.
 *
 * Other filters are AND-semantics: a case must match all provided filters.
 */
export const WorklistRequestSchema = z.object({
  queue_id: z.string(),
  needs_my_review: z.boolean().optional(),

  // Filter chips (6 in v4; Owner chip removed)
  case_status: z.array(CaseStatusSchema).optional(),
  category: z.string().optional(),
  primary_payer_id: z.string().optional(),
  clinic_id: z.string().optional(),
  aging_bucket: z.string().optional(),
  priority: PriorityCodeSchema.optional(),
  net_pending_min: z.number().optional(),
  net_pending_max: z.number().optional(),

  // Pagination
  page: z.number().int().positive().default(1),
  page_size: z.number().int().positive().max(100).default(50),
});
export type WorklistRequest = z.infer<typeof WorklistRequestSchema>;

/**
 * Worklist response. `has_more` is approximate when filters are active — a
 * workflow-lib limitation called out in the BE handoff. Treat as "fetch
 * more if user paginates" not "render Page X of Y" — the UI should show
 * "Showing 1-50, more available" style.
 */
export const WorklistResponseSchema = z.object({
  rows: z.array(WorklistRowSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  has_more: z.boolean(),
});
export type WorklistResponse = z.infer<typeof WorklistResponseSchema>;

// ============================================================================
// §1.5 — HandlerOutcome
// ============================================================================

/**
 * HandlerOutcome — what a worker reports on task completion.
 *
 * Only these three outcomes are FE-driven. The engine has internal outcomes
 * (NEEDS_HUMAN, RETRY_LATER, SUPERSEDED) used by code handlers — FE never
 * sends those, and shouldn't render them either.
 *
 *   SUCCESS    — Worker completed the task as expected (most common)
 *   NEEDS_INFO — Work blocked pending info; engine creates an info-gathering
 *                follow-up task; case stays alive
 *   FAIL_FATAL — Work cannot proceed; case escalates or closes (rare)
 */
export const HandlerOutcomeSchema = z.enum([
  'SUCCESS',
  'NEEDS_INFO',
  'FAIL_FATAL',
]);
export type HandlerOutcome = z.infer<typeof HandlerOutcomeSchema>;

// ============================================================================
// §1.6 — Task fact schemas (per task_type)
// ============================================================================

/**
 * Per-task-type fact schemas. Each defines what the completion form gathers
 * and what `facts_to_set` looks like in the POST `/complete` payload.
 *
 * These are validated client-side (in the form component) before submit; the
 * engine validates them again server-side against the workflow definition.
 *
 * Discriminated by `task.task_type` — see `TaskFactsByType` below.
 */

export const IntakeTriageFactsSchema = z.object({
  triage_category: z.string(),
  priority: PriorityCodeSchema,
  triage_route: z.enum([
    'resolution',
    'coding_partner',
    'direct_appeal',
    'other',
  ]),
});
export type IntakeTriageFacts = z.infer<typeof IntakeTriageFactsSchema>;

export const CodingReviewFactsSchema = z.object({
  cpt_corrected: z.boolean(),
  modifier_changed: z.boolean(),
  dx_adequate: z.boolean(),
  recommendation: z.enum(['proceed', 'reject', 'escalate']),
});
export type CodingReviewFacts = z.infer<typeof CodingReviewFactsSchema>;

export const PayerCallFactsSchema = z.object({
  call_reference_number: z.string(),
  payer_status: z.string(),
  callback_required: z.boolean(),
});
export type PayerCallFacts = z.infer<typeof PayerCallFactsSchema>;

export const PortalStatusCheckFactsSchema = z.object({
  portal_status: z.string(),
  reference_number: z.string().nullable(),
  screenshot_attached: z.boolean(),
});
export type PortalStatusCheckFacts = z.infer<typeof PortalStatusCheckFactsSchema>;

export const ResolutionActionFactsSchema = z.object({
  action_type: z.enum([
    'appeal',
    'refile',
    'corrected_claim',
    'reconsideration',
  ]),
  submitted_at: z.string().datetime(),
  confirmation_number: z.string().nullable(),
});
export type ResolutionActionFacts = z.infer<typeof ResolutionActionFactsSchema>;

export const CodingFeedbackReviewFactsSchema = z.object({
  selected_action: z.enum(['proceed', 'dispute', 'reroute']),
});
export type CodingFeedbackReviewFacts = z.infer<
  typeof CodingFeedbackReviewFactsSchema
>;

export const AwaitingPayerCheckFactsSchema = z.object({
  response_received: z.boolean(),
  response_details: z.string().nullable(),
});
export type AwaitingPayerCheckFacts = z.infer<
  typeof AwaitingPayerCheckFactsSchema
>;

export const AMReviewFactsSchema = z.object({
  final_decision: z.enum(['approve', 'escalate', 'close']),
  escalation_note: z.string().nullable(),
});
export type AMReviewFacts = z.infer<typeof AMReviewFactsSchema>;

export const PostingApplyFactsSchema = z.object({
  posting_confirmed: z.boolean(),
});
export type PostingApplyFacts = z.infer<typeof PostingApplyFactsSchema>;

export const BankRecMatchFactsSchema = z.object({
  match_confirmed: z.boolean(),
});
export type BankRecMatchFacts = z.infer<typeof BankRecMatchFactsSchema>;

export const HighDollarOversightFactsSchema = z.object({
  reviewed_at: z.string().datetime(),
  oversight_note: z.string().nullable(),
});
export type HighDollarOversightFacts = z.infer<
  typeof HighDollarOversightFactsSchema
>;

/**
 * Discriminated map: task_type → fact schema. Use this in the task form
 * registry to pick the right schema for runtime validation.
 *
 * The `as const` is important — it lets TypeScript infer the value type
 * precisely so `TaskFactsByType['intake_triage']` is the actual
 * `IntakeTriageFactsSchema` type, not a generic ZodSchema.
 */
export const TaskFactsByType = {
  intake_triage: IntakeTriageFactsSchema,
  coding_review: CodingReviewFactsSchema,
  payer_call: PayerCallFactsSchema,
  portal_status_check: PortalStatusCheckFactsSchema,
  resolution_action: ResolutionActionFactsSchema,
  coding_feedback_review: CodingFeedbackReviewFactsSchema,
  awaiting_payer_check: AwaitingPayerCheckFactsSchema,
  am_review: AMReviewFactsSchema,
  posting_apply: PostingApplyFactsSchema,
  bank_rec_match: BankRecMatchFactsSchema,
  high_dollar_oversight: HighDollarOversightFactsSchema,
} as const;

/**
 * Generic helper: `TaskFacts<'intake_triage'>` → `IntakeTriageFacts`.
 * Use this in task form component prop types for compile-time correctness:
 *
 *   interface IntakeTriageFormProps {
 *     task: EngineTask;
 *     onSubmit: (facts: TaskFacts<'intake_triage'>) => void;
 *   }
 */
export type TaskFacts<T extends TaskType> = z.infer<(typeof TaskFactsByType)[T]>;

// ============================================================================
// §1.7 — CaseDetail (richer than the worklist's Case shape)
// ============================================================================

/**
 * CaseDetail — the response shape of `case.detail`. Extends the worklist's
 * Case shape with:
 *   - Live engine snapshot (open tasks + recent completed tasks for context)
 *   - Full claim context (facility, provider, ICDs — joined from
 *     rcm-data-access via DMS proxy)
 *   - Full financial breakdown (4 paid buckets + 3 pending buckets)
 *
 * Use this for the work-pane middle surface. Use the worklist `Case` shape
 * for left-pane cards (lighter payload).
 */
export const CaseDetailSchema = CaseSchema.extend({
  // Live engine snapshot
  engine_tasks_open: z.array(EngineTaskSchema),
  engine_tasks_recent: z.array(EngineTaskSchema), // last 5 completed for context

  // Full claim context (joined from rcm-data-access via DMS proxy)
  facility_name: z.string().nullable(),
  facility_id: z.string().nullable(),
  provider_name: z.string().nullable(),
  icd_codes: z.array(z.string()),
  payer_id: z.string().nullable(),
  payer_alias: z.string().nullable(),

  // Financial breakdown (dollars)
  billed: z.number(),
  paid_primary: z.number(),
  paid_secondary: z.number(),
  paid_tertiary: z.number(),
  paid_patient: z.number(),
  pending_primary: z.number(),
  pending_secondary: z.number(),
  pending_tertiary: z.number(),
});
export type CaseDetail = z.infer<typeof CaseDetailSchema>;

// ============================================================================
// §1.8 — MyTasks request + response (the user's personal queue view)
// ============================================================================

/**
 * `task.mine` request — filters the user's personal queue task list.
 *
 * Identity is derived server-side from JWT, not passed here. Returns
 * `WorklistRow` shape (same as the worklist endpoint) for component reuse —
 * the CaseCard component renders both surfaces.
 */
export const TasksMineRequestSchema = z.object({
  // Status filter (default: just OPEN; admins can request all)
  state_code: z.array(TaskStateSchema).optional(),

  // Priority + due-date filters
  priority: z.array(PriorityCodeSchema).optional(),
  due_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),

  // Category filter (from underlying case)
  primary_category: z.string().optional(),

  // Include cases the engine returned to user_<me> as the originator
  // (the team-handoff return pattern). Default true — this is the main
  // surface needs_my_review serves.
  include_pre_acceptance: z.boolean().optional(),
  include_completed: z.boolean().optional(),

  // Pagination
  page: z.number().int().positive().default(1),
  page_size: z.number().int().positive().max(100).default(50),
});
export type TasksMineRequest = z.infer<typeof TasksMineRequestSchema>;

export const TasksMineResponseSchema = z.object({
  rows: z.array(WorklistRowSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  has_more: z.boolean(),
});
export type TasksMineResponse = z.infer<typeof TasksMineResponseSchema>;

// ============================================================================
// Convenience: type guards for state-aware UI branching
// ============================================================================

/**
 * Helper predicates used by WorkPane to pick the right body branch.
 * Centralized here so the string literals stay in sync with CaseStatusSchema.
 */
export function isCaseProposed(c: Pick<Case, 'case_status'>): boolean {
  return c.case_status === 'proposed';
}

export function isCaseInFlight(c: Pick<Case, 'case_status'>): boolean {
  return c.case_status === 'accepted' || c.case_status === 'overridden';
}

export function isCaseCompleted(c: Pick<Case, 'case_status'>): boolean {
  return c.case_status === 'completed';
}

/**
 * Whether a task is a "needs review" task routed back to the originator.
 * True for any task on a `user_*` queue (the personal-queue routing).
 */
export function isReviewTask(t: Pick<EngineTask, 'queue_id'>): boolean {
  return t.queue_id.startsWith('user_');
}
