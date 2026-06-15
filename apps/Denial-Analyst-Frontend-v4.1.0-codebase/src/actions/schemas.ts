/**
 * Denial Analyst Tool — Schemas v4.1 (engine-handler model)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Domain types for the CORRECTED denial-management-service model, where DMS is
 * a *handler* the workflow engine pushes tasks to. Companion to:
 * FE-v4_0_0-handoff-CORRECTED.md.
 *
 * Drop-in path: src/actions/schemas.ts
 *
 * Coexistence during the v4.0.0 → v4.1 rework (R-phases):
 *   - src/actions/schemas-v4.ts   (v4.0.0 — Case/case_status/EngineTask/WorklistRow;
 *                                   built against the WRONG worklist+task model)
 *   - src/actions/schemas.ts  (this file — WorklistTask/dispatched-task model)
 *
 * Components are repointed from schemas-v4 → schemas during their R-phase.
 * schemas-v4.ts is deleted in R12 once nothing imports it.
 *
 * The four reversals from v4.0.0 (see handoff §0):
 *   1. Worklist is a DMS-LOCAL table fed by engine pushes — not an engine query.
 *      One row per dispatched task. The FE never calls the engine.
 *   2. No `user_<id>` personal queue, no `needs_my_review`, no returned-to-
 *      originator. Work flows forward team→team.
 *   3. `is_high_dollar` is a FLAG on case_facts — no HD queue, no sidecar task.
 *   4. No case_status proposed→accepted→overridden→completed lifecycle. The
 *      workflow is already running; the analyst COMPLETES the dispatched task.
 *
 * WIRING TODO (handoff §3, §11): the DMS engine-integration layer is being
 * rebuilt. Endpoint paths and exact fact shapes below are the TARGET per the
 * handoff; reconcile against the regenerated OpenAPI when it lands. Fact
 * schemas in §1.6 are derived from the §6 task-type table and carry
 * `// WIRING TODO` where the field set is inferred rather than published.
 */

import { z } from 'zod';

// ============================================================================
// §1.1 — Task type (the routing key)
// ============================================================================

/**
 * The 17 human task types the engine dispatches to the analyst worklist
 * (handoff §6). `task_type` is THE routing key — it selects the completion
 * form from the task-form registry.
 *
 * `FAX_FACILITY_BATCH` is handled by an automated batch service, never appears
 * in the analyst worklist, and is intentionally NOT in this enum — the FE
 * never renders it.
 *
 * Code-handler task types (engine-internal, self-completing) are likewise not
 * surfaced here.
 */
export const TaskTypeSchema = z.enum([
  'ANALYST_TRIAGE_DENIAL',
  'ANALYST_INVESTIGATE_ROOT_CAUSE',
  'CALLER_GET_DENIAL_REASON',
  'PORTAL_CHECK_STATUS',
  'BHAVANA_PULL_EMR',
  'ANALYST_PATIENT_OUTREACH',
  'COORDINATOR_FACILITY_CONTACT',
  'CODER_REVIEW_RECORD',
  'RESOLUTION_REFILE_CLAIM',
  'RESOLUTION_FILE_APPEAL',
  'ANALYST_AWAIT_PAYER_RESPONSE',
  'AM_DECIDE_DISPOSITION',
  'POSTING_VALIDATE_PAYMENT',
  'DEMO_RETRIEVE_ID',
  'CZAR_VERIFY_CREDENTIALING',
  'LIAISON_EXTERNAL_ESCALATION',
  'BILLING_PROCESS_DISPOSITION',
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

// ============================================================================
// §1.2 — Team (the queue dimension)
// ============================================================================

/**
 * The named team queues (handoff §7). A task's team is derived from its
 * task_type and carried on the worklist row. The QueueSwitcher filters the
 * DMS-local worklist table by team — there is NO engine call and NO personal
 * `user_<id>` queue.
 */
export const TeamSchema = z.enum([
  'denial_intake_analyst',
  'ar_analyst',
  'emr_support', // Bhavana
  'coding',
  'am',
  'resolution',
  'coordinator',
  'demo',
  'credentialing',
  'liaison',
  'billing',
  'portal_status',
  'calling',
]);
export type Team = z.infer<typeof TeamSchema>;

// ============================================================================
// §1.3 — Row status + priority
// ============================================================================

/**
 * Worklist-row status. The FE primarily renders OPEN rows.
 *
 *   OPEN      — dispatched, available for work (the analyst's actionable queue)
 *   PARKED    — completed with NEEDS_INFO; engine backs off and re-dispatches
 *               later. May surface in a "waiting" filter; not actionable now.
 *   COMPLETED — terminal for this row; DMS reported the outcome to the engine.
 *               The engine dispatches the next task as a NEW row.
 *
 * WIRING TODO: confirm the exact status vocabulary against the regenerated
 * OpenAPI. Handoff §2/§4 reference OPEN and COMPLETED explicitly; PARKED is
 * inferred from the NEEDS_INFO backoff described in §5.
 */
export const TaskStatusSchema = z.enum(['OPEN', 'PARKED', 'COMPLETED']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const PrioritySchema = z.enum(['high', 'normal', 'low']);
export type Priority = z.infer<typeof PrioritySchema>;

// ============================================================================
// §1.4 — The worklist-row sub-shapes (handoff §4)
// ============================================================================

/**
 * case_context — routing/state metadata the engine dispatched with the task.
 * `state_code` is the engine state (e.g. 'TRIAGE'); treat as an opaque display
 * label, not something the FE branches heavily on.
 */
export const CaseContextSchema = z
  .object({
    case_type: z.string(), // e.g. 'DENIAL'
    state_code: z.string(), // e.g. 'TRIAGE'
    task_type: TaskTypeSchema, // duplicated from the row for convenience
    clinic_id: z.string().nullable(),
    payer_id: z.string().nullable(),
  })
  .passthrough(); // tolerate additional routing fields the engine may add
export type CaseContext = z.infer<typeof CaseContextSchema>;

/**
 * case_facts — accumulated workflow state. Facts are SET by analysts via
 * `facts_to_set` on task completion and carry forward. The set grows as a case
 * moves through its workflow, so this schema names the commonly-referenced
 * facts and tolerates the rest via `.passthrough()`.
 *
 * `is_high_dollar` is the only guaranteed field (the HD flag — handoff §7).
 *
 * WIRING TODO: the value vocabularies for `clarification_type` and
 * `appeal_policy` are not enumerated in the handoff (§4 shows 'AUTHORIZATION'
 * and 'ONE_APPEAL' as examples). Typed as strings until the OpenAPI lands.
 */
export const CaseFactsSchema = z
  .object({
    is_high_dollar: z.boolean(),

    // Triage facts
    clarification_type: z.string().optional(), // e.g. 'AUTHORIZATION'
    appeal_policy: z.string().optional(), // e.g. 'ONE_APPEAL'
    direct_facility_access: z.boolean().optional(),
    fax_number_on_file: z.boolean().optional(),

    // Investigation / resolution facts
    root_cause: z.string().optional(),
    appeal_level: z.number().int().optional(),
  })
  .passthrough();
export type CaseFacts = z.infer<typeof CaseFactsSchema>;

/**
 * claim_summary — claim fields DMS merges in from rcm-data-access so the FE
 * doesn't make a second call (handoff §4).
 *
 * NOTE: `net_pending` is a decimal STRING from the BE (e.g. "840.00"), not a
 * number — formatters should parse it. (Differs from v4.0.0, which modeled it
 * as a number.)
 */
export const ClaimSummarySchema = z.object({
  claim_id: z.number().int(),
  patient_name: z.string().nullable(),
  mrn: z.string(),
  dos: z.string(), // YYYY-MM-DD
  net_pending: z.string(), // decimal string, e.g. "840.00"
  aging_bucket: z.string().nullable(),
  primary_payer_name: z.string().nullable(),
  clinic_name: z.string().nullable(),
});
export type ClaimSummary = z.infer<typeof ClaimSummarySchema>;

// ============================================================================
// §1.5 — WorklistTask (the row; replaces v4.0.0 WorklistRow)
// ============================================================================

/**
 * WorklistTask — one row in the DMS-local `analyst_worklist_task` table. Each
 * row IS a task the engine dispatched (handoff §4). This replaces v4.0.0's
 * `{ case, current_task }` WorklistRow join — there is no separate "current
 * task from engine snapshot"; the row carries everything the engine dispatched.
 */
export const WorklistTaskSchema = z.object({
  task_id: z.string(),
  case_id: z.string(),
  task_type: TaskTypeSchema,
  status: TaskStatusSchema,
  priority: PrioritySchema,
  team: TeamSchema,
  dispatched_at: z.string().datetime(),

  case_context: CaseContextSchema,
  case_facts: CaseFactsSchema,
  claim_summary: ClaimSummarySchema,
});
export type WorklistTask = z.infer<typeof WorklistTaskSchema>;

/**
 * Worklist filter values. Filters the DMS-local table (no engine call). There
 * is NO `queue_id` required field and NO `needs_my_review` (both removed with
 * the personal-queue model). `team` is the queue dimension; it defaults
 * server-side from the JWT role when omitted.
 *
 * All filters are AND-semantics.
 */
export const WorklistRequestSchema = z.object({
  team: TeamSchema.optional(),
  task_type: z.array(TaskTypeSchema).optional(),
  status: z.array(TaskStatusSchema).optional(),
  priority: PrioritySchema.optional(),

  // Claim-derived filters (cascade: clinic gates payer)
  clinic_id: z.string().optional(),
  primary_payer_id: z.string().optional(),
  aging_bucket: z.string().optional(),

  // High-dollar is a flag, surfaced as a filter (not a queue — handoff §7)
  is_high_dollar: z.boolean().optional(),

  // Pagination — DB-backed, so precise page X of Y is fine
  page: z.number().int().positive().default(1),
  page_size: z.number().int().positive().max(100).default(50),
});
export type WorklistRequest = z.infer<typeof WorklistRequestSchema>;

/**
 * Worklist response. DB-backed pagination (handoff §2) — `total` is exact,
 * unlike the v4.0.0 engine-query model where has_more was approximate.
 */
export const WorklistResponseSchema = z.object({
  rows: z.array(WorklistTaskSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  has_more: z.boolean(),
});
export type WorklistResponse = z.infer<typeof WorklistResponseSchema>;

// ============================================================================
// §1.6 — HandlerOutcome (unchanged from v4.0.0 — handoff §5 confirms)
// ============================================================================

/**
 * The three outcomes the FE sends on task completion (handoff §5).
 *
 *   SUCCESS    — work done as expected (~90% of completions). Engine opens the
 *                next task (arrives as a new row, possibly another team's queue).
 *   NEEDS_INFO — blocked pending info; task parks with backoff, re-dispatches.
 *   FAIL_FATAL — cannot proceed; closes non-retryable, surfaces for AM/ops.
 *
 * The FE does NOT send RETRY_LATER, NEEDS_HUMAN, or SUPERSEDED — those are
 * engine-internal / automation-handler outcomes.
 */
export const HandlerOutcomeSchema = z.enum([
  'SUCCESS',
  'NEEDS_INFO',
  'FAIL_FATAL',
]);
export type HandlerOutcome = z.infer<typeof HandlerOutcomeSchema>;

/**
 * Task-completion request body (handoff §3). POSTed to
 * `/api/v1/worklist/{task_id}/complete`.
 *
 * `facts_to_set` is how the analyst's decisions pass forward to the next
 * workflow step. Its shape is the per-task-type fact schema (§1.7).
 */
export const TaskCompleteRequestSchema = z.object({
  outcome: HandlerOutcomeSchema,
  facts_to_set: z.record(z.unknown()), // validated per-type in the form; see §1.7
  completion_note: z.string().optional(),
});
export type TaskCompleteRequest = z.infer<typeof TaskCompleteRequestSchema>;

// ============================================================================
// §1.7 — Task fact schemas (per task_type — handoff §6)
// ============================================================================

/**
 * Per-task-type fact schemas: what each completion form gathers and what
 * `facts_to_set` looks like. Validated client-side before submit; the engine
 * re-validates server-side against the workflow definition.
 *
 * WIRING TODO: these field sets are DERIVED from the §6 task-type table
 * descriptions, not from a published schema. Confirm against the regenerated
 * OpenAPI when it lands. Where the handoff names facts explicitly (e.g. triage
 * facts in §6), those are used verbatim; where it only describes what the form
 * "captures", the field names are a reasonable inference and marked.
 */

// --- Submission method (shared by refile + appeal) ---
export const SubmissionMethodSchema = z.enum(['PORTAL', 'FAX', 'MAIL']);
export type SubmissionMethod = z.infer<typeof SubmissionMethodSchema>;

// 1 · ANALYST_TRIAGE_DENIAL — facts named explicitly in §6
export const AnalystTriageDenialFactsSchema = z.object({
  clarification_type: z.string(), // value vocab unconfirmed — WIRING TODO
  is_high_dollar: z.boolean(),
  appeal_policy: z.string(), // e.g. ONE_APPEAL — WIRING TODO
  direct_facility_access: z.boolean(),
  fax_number_on_file: z.boolean(),
});
export type AnalystTriageDenialFacts = z.infer<typeof AnalystTriageDenialFactsSchema>;

// 2 · ANALYST_INVESTIGATE_ROOT_CAUSE
export const AnalystInvestigateRootCauseFactsSchema = z.object({
  root_cause: z.string(),
  route_to_caller: z.boolean().optional(), // §6: "or route to caller"
});
export type AnalystInvestigateRootCauseFacts = z.infer<typeof AnalystInvestigateRootCauseFactsSchema>;

// 3 · CALLER_GET_DENIAL_REASON
export const CallerGetDenialReasonFactsSchema = z.object({
  call_reference_number: z.string(),
  root_cause: z.string(),
});
export type CallerGetDenialReasonFacts = z.infer<typeof CallerGetDenialReasonFactsSchema>;

// 4 · PORTAL_CHECK_STATUS
export const PortalCheckStatusFactsSchema = z.object({
  portal_status: z.string(),
  portal_detail: z.string().nullable(),
});
export type PortalCheckStatusFacts = z.infer<typeof PortalCheckStatusFactsSchema>;

// 5 · BHAVANA_PULL_EMR — SUCCESS(found) / NEEDS_INFO(no access/not found)
export const BhavanaPullEmrFactsSchema = z.object({
  emr_item_found: z.boolean(),
  unavailable_reason: z.string().nullable(), // populated when not found / no access
});
export type BhavanaPullEmrFacts = z.infer<typeof BhavanaPullEmrFactsSchema>;

// 6 · ANALYST_PATIENT_OUTREACH
export const AnalystPatientOutreachFactsSchema = z.object({
  outreach_method: z.enum(['call', 'sms', 'letter']),
  outreach_result: z.enum(['info_obtained', 'unresponsive']),
  outreach_note: z.string().nullable(),
});
export type AnalystPatientOutreachFacts = z.infer<typeof AnalystPatientOutreachFactsSchema>;

// 7 · COORDINATOR_FACILITY_CONTACT
export const CoordinatorFacilityContactFactsSchema = z.object({
  contact_result: z.string(),
  contact_note: z.string().nullable(),
});
export type CoordinatorFacilityContactFacts = z.infer<typeof CoordinatorFacilityContactFactsSchema>;

// 8 · CODER_REVIEW_RECORD — SUCCESS(changes→refile) / SUCCESS(no change→appeal)
export const CoderReviewRecordFactsSchema = z.object({
  cpt_verified: z.boolean(),
  dx_verified: z.boolean(),
  modifier_verified: z.boolean(),
  recommendation: z.enum(['refile', 'appeal']),
  coder_note: z.string().nullable(),
});
export type CoderReviewRecordFacts = z.infer<typeof CoderReviewRecordFactsSchema>;

// 9 · RESOLUTION_REFILE_CLAIM
export const ResolutionRefileClaimFactsSchema = z.object({
  refiled_content: z.string(),
  submission_method: SubmissionMethodSchema,
  tracking_number: z.string(),
});
export type ResolutionRefileClaimFacts = z.infer<typeof ResolutionRefileClaimFactsSchema>;

// 10 · RESOLUTION_FILE_APPEAL — SUCCESS increments appeal_level
export const ResolutionFileAppealFactsSchema = z.object({
  appeal_level: z.number().int(),
  evidence_attached: z.boolean(),
  submission_method: SubmissionMethodSchema,
  tracking_number: z.string(),
});
export type ResolutionFileAppealFacts = z.infer<typeof ResolutionFileAppealFactsSchema>;

// 11 · ANALYST_AWAIT_PAYER_RESPONSE — SUCCESS(paid/overturned) / NEEDS_INFO(waiting) / FAIL_FATAL(denied/upheld)
export const AnalystAwaitPayerResponseFactsSchema = z.object({
  response_received: z.boolean(),
  payer_decision: z
    .enum(['paid', 'overturned', 'denied', 'upheld', 'still_waiting'])
    .nullable(),
  response_note: z.string().nullable(),
});
export type AnalystAwaitPayerResponseFacts = z.infer<typeof AnalystAwaitPayerResponseFactsSchema>;

// 12 · AM_DECIDE_DISPOSITION
export const AmDecideDispositionFactsSchema = z.object({
  disposition: z.enum(['write_off', 'cash_rate', 'escalate']),
  disposition_note: z.string().nullable(),
});
export type AmDecideDispositionFacts = z.infer<typeof AmDecideDispositionFactsSchema>;

// 13 · POSTING_VALIDATE_PAYMENT
export const PostingValidatePaymentFactsSchema = z.object({
  prior_payment_verified: z.boolean(),
  recoupment_checked: z.boolean(),
});
export type PostingValidatePaymentFacts = z.infer<typeof PostingValidatePaymentFactsSchema>;

// 14 · DEMO_RETRIEVE_ID
export const DemoRetrieveIdFactsSchema = z.object({
  id_type: z.enum(['medicare', 'medicaid']),
  id_value: z.string(),
});
export type DemoRetrieveIdFacts = z.infer<typeof DemoRetrieveIdFactsSchema>;

// 15 · CZAR_VERIFY_CREDENTIALING — SUCCESS(data_lag→appeal) / FAIL_FATAL(true_gap→AM)
export const CzarVerifyCredentialingFactsSchema = z.object({
  credentialing_status: z.enum(['verified', 'data_lag', 'true_gap']),
  npi_or_taxonomy: z.string().nullable(),
});
export type CzarVerifyCredentialingFacts = z.infer<typeof CzarVerifyCredentialingFactsSchema>;

// 16 · LIAISON_EXTERNAL_ESCALATION
export const LiaisonExternalEscalationFactsSchema = z.object({
  escalation_result: z.string(),
  escalation_note: z.string().nullable(),
});
export type LiaisonExternalEscalationFacts = z.infer<typeof LiaisonExternalEscalationFactsSchema>;

// 17 · BILLING_PROCESS_DISPOSITION
export const BillingProcessDispositionFactsSchema = z.object({
  disposition_applied: z.enum(['cash_rate', 'write_off']),
  billing_note: z.string().nullable(),
});
export type BillingProcessDispositionFacts = z.infer<typeof BillingProcessDispositionFactsSchema>;

/**
 * Discriminated map: task_type → fact schema. Used by the task-form registry
 * to pick the right schema for runtime validation. `as const` preserves the
 * precise per-key value type so `TaskFactsByType['ANALYST_TRIAGE_DENIAL']` is
 * the actual schema, not a generic ZodSchema.
 */
export const TaskFactsByType = {
  ANALYST_TRIAGE_DENIAL: AnalystTriageDenialFactsSchema,
  ANALYST_INVESTIGATE_ROOT_CAUSE: AnalystInvestigateRootCauseFactsSchema,
  CALLER_GET_DENIAL_REASON: CallerGetDenialReasonFactsSchema,
  PORTAL_CHECK_STATUS: PortalCheckStatusFactsSchema,
  BHAVANA_PULL_EMR: BhavanaPullEmrFactsSchema,
  ANALYST_PATIENT_OUTREACH: AnalystPatientOutreachFactsSchema,
  COORDINATOR_FACILITY_CONTACT: CoordinatorFacilityContactFactsSchema,
  CODER_REVIEW_RECORD: CoderReviewRecordFactsSchema,
  RESOLUTION_REFILE_CLAIM: ResolutionRefileClaimFactsSchema,
  RESOLUTION_FILE_APPEAL: ResolutionFileAppealFactsSchema,
  ANALYST_AWAIT_PAYER_RESPONSE: AnalystAwaitPayerResponseFactsSchema,
  AM_DECIDE_DISPOSITION: AmDecideDispositionFactsSchema,
  POSTING_VALIDATE_PAYMENT: PostingValidatePaymentFactsSchema,
  DEMO_RETRIEVE_ID: DemoRetrieveIdFactsSchema,
  CZAR_VERIFY_CREDENTIALING: CzarVerifyCredentialingFactsSchema,
  LIAISON_EXTERNAL_ESCALATION: LiaisonExternalEscalationFactsSchema,
  BILLING_PROCESS_DISPOSITION: BillingProcessDispositionFactsSchema,
} as const;

/**
 * Generic helper: `TaskFacts<'ANALYST_TRIAGE_DENIAL'>` → AnalystTriageDenialFacts.
 * Use in task-form component prop types for compile-time correctness.
 */
export type TaskFacts<T extends TaskType> = z.infer<(typeof TaskFactsByType)[T]>;

// Exhaustiveness guard: this line fails to compile if TaskFactsByType is ever
// missing a key from TaskTypeSchema (or has an extra one). Keeps the registry
// and the enum in lockstep.
const _taskFactsExhaustive: Record<TaskType, unknown> = TaskFactsByType;
void _taskFactsExhaustive;

// ============================================================================
// §1.8 — CaseDetail (richer than the worklist row; handoff §3 GET /cases/{id})
// ============================================================================

/**
 * CaseDetail — response shape of `GET /api/v1/cases/{case_id}`. DMS merges its
 * own row + claim summary from rcm-data-access + an optional engine snapshot,
 * all server-side (handoff §2, §3). The FE still calls only DMS.
 *
 * Open tasks here let the work area show sibling tasks / current state without
 * an engine call. There is NO case_status field — a case is "done" when it has
 * no open tasks, which the FE infers rather than reads from a lifecycle enum.
 */
export const CaseDetailSchema = z.object({
  case_id: z.string(),

  // Engine-merged snapshot (display-only)
  state_code: z.string().nullable(), // current engine state, e.g. 'TRIAGE'
  open_task_ids: z.array(z.string()), // tasks currently dispatched for this case

  // Accumulated workflow facts
  case_facts: CaseFactsSchema,

  // LLM classification — shown as CONTEXT in the work area (not a gate).
  // The recommendation still renders; "accepting" it is just completing the
  // triage task with the confirmed clarification_type.
  recommended_category: z.string().nullable(),
  recommended_confidence: z.number().nullable(),
  recommended_reasoning: z.string().nullable(),
  classified_at: z.string().datetime().nullable(),
  tool_version: z.string().nullable(),

  // Full claim context (joined from rcm-data-access via DMS proxy)
  claim_id: z.number().int(),
  patient_name: z.string().nullable(),
  mrn: z.string(),
  dos: z.string(),
  facility_name: z.string().nullable(),
  facility_id: z.string().nullable(),
  provider_name: z.string().nullable(),
  icd_codes: z.array(z.string()),
  primary_payer_name: z.string().nullable(),
  primary_payer_id: z.string().nullable(),
  clinic_name: z.string().nullable(),
  clinic_id: z.string().nullable(),
  aging_bucket: z.string().nullable(),

  // Financial breakdown (decimal strings — matches claim_summary convention)
  billed: z.string(),
  net_pending: z.string(),
  paid_primary: z.string(),
  paid_secondary: z.string(),
  paid_tertiary: z.string(),
  paid_patient: z.string(),
  pending_primary: z.string(),
  pending_secondary: z.string(),
  pending_tertiary: z.string(),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type CaseDetail = z.infer<typeof CaseDetailSchema>;

// ============================================================================
// §1.9 — Team labels (display helper)
// ============================================================================

/**
 * Human-readable labels for the QueueSwitcher. Single source so the switcher
 * is a config edit, not a code change, if the team set shifts (risk register).
 */
export const TEAM_LABELS: Record<Team, string> = {
  denial_intake_analyst: 'Denial Intake',
  ar_analyst: 'AR Analyst',
  emr_support: 'EMR Support',
  coding: 'Coding',
  am: 'Account Management',
  resolution: 'Resolution',
  coordinator: 'Coordinator',
  demo: 'Demographics',
  credentialing: 'Credentialing',
  liaison: 'Liaison',
  billing: 'Billing',
  portal_status: 'Portal Status',
  calling: 'Calling',
};

/**
 * Which team owns each task type (handoff §7: "Each task's team is in the
 * worklist row, derived from task_type"). The row carries `team` directly, so
 * this map is a FALLBACK / sanity reference, not the primary source.
 *
 * WIRING TODO: confirm this mapping against the workflow spec. Inferred from
 * task-type naming + the §6/§7 descriptions.
 */
export const TASK_TYPE_DEFAULT_TEAM: Record<TaskType, Team> = {
  ANALYST_TRIAGE_DENIAL: 'denial_intake_analyst',
  ANALYST_INVESTIGATE_ROOT_CAUSE: 'ar_analyst',
  CALLER_GET_DENIAL_REASON: 'calling',
  PORTAL_CHECK_STATUS: 'portal_status',
  BHAVANA_PULL_EMR: 'emr_support',
  ANALYST_PATIENT_OUTREACH: 'ar_analyst',
  COORDINATOR_FACILITY_CONTACT: 'coordinator',
  CODER_REVIEW_RECORD: 'coding',
  RESOLUTION_REFILE_CLAIM: 'resolution',
  RESOLUTION_FILE_APPEAL: 'resolution',
  ANALYST_AWAIT_PAYER_RESPONSE: 'ar_analyst',
  AM_DECIDE_DISPOSITION: 'am',
  POSTING_VALIDATE_PAYMENT: 'billing',
  DEMO_RETRIEVE_ID: 'demo',
  CZAR_VERIFY_CREDENTIALING: 'credentialing',
  LIAISON_EXTERNAL_ESCALATION: 'liaison',
  BILLING_PROCESS_DISPOSITION: 'billing',
};
