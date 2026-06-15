/**
 * Denial Analyst Tool — Action Registry v4.0.0
 * ────────────────────────────────────────────────────────────────────────────
 *
 * v4 action registry entries against denial-management-service v1.1.0.
 *
 * Drop-in path: src/actions/index-v4.ts
 *
 * Integration: call `registerCaseActions()` from main.tsx (alongside the
 * existing v3 `registerDenialActions()` during transition). Once all v3
 * components are rewritten to use v4 actions, delete the v3 register call
 * and the v3 index.ts file.
 *
 * Conventions:
 *   - actionId format: <domain>.<verb>   e.g. 'case.worklist', 'task.complete'
 *   - Cache invalidation declared in `invalidatedBy` arrays — never in
 *     per-component code (v3.0.3 lesson; see v3.0.3 readme item #9-10).
 *   - Mutation request schemas defined inline because they're specific to
 *     each action site.
 *   - Permissions use the v3 tag set unchanged (coarse roles per Q#2 answer):
 *       denial.read         — ANALYST + MANAGER + ADMIN
 *       denial.act          — ANALYST + MANAGER + ADMIN
 *       denial.classify     — MANAGER + ADMIN (Re-classify button)
 *       denial.view_cost    — MANAGER + ADMIN (Cost page)
 *
 * Endpoints NOT in this registry:
 *   - GET /api/v1/cases/legacy/{old_id}      — 301 redirect; handled by router
 *   - GET /api/v1/files/{file_id}/download   — binary stream; use URL directly
 *   - GET /api/v1/files/{file_id}/preview    — binary stream; use URL directly
 *   - GET /api/v1/cases/{id}/appeal/{id}/render-pdf — binary PDF; URL only
 *   These 4 endpoints are documented in README-P1.2.md but not action-dispatched.
 *
 * Total in this registry: 24 actions (14 read + 10 write).
 */

import { z } from 'zod';
import { defineAction } from '@tensaw/actions';

// v4 domain schemas (P1.1)
import {
  CaseSchema,
  CaseDetailSchema,
  EngineTaskSchema,
  QueueSchema,
  HandlerOutcomeSchema,
  WorklistRequestSchema,
  WorklistResponseSchema,
  TasksMineRequestSchema,
  TasksMineResponseSchema,
} from './schemas-v4';

// v4 tab schemas (P1.2)
import {
  NoteSchema,
  NotesResponseSchema,
  NoteSourceSchema,
  FileSchema,
  FilesResponseSchema,
  FileTypeSchema,
  AppealSchema,
  AppealTemplateSchema,
  TransactionsResponseSchema,
  CategoriesResponseSchema,
  LookupResponseSchema,
} from './schemas-v4-tabs';

// ============================================================================
// Cache invalidation matrix (single source of truth)
// ────────────────────────────────────────────────────────────────────────────
// Each cache tag lists the mutation actionIds that should invalidate it.
// Keeping this as a const before the registry calls makes the matrix easy
// to audit at a glance.
// ============================================================================

const INVALIDATE = {
  worklist: [
    'case.accept',
    'case.override',
    'case.reclassify',
    'task.complete',
    'case.signal',
  ],
  'case-detail': [
    'case.accept',
    'case.override',
    'case.reclassify',
    'task.complete',
    'case.signal',
    'case.appeal.save',
  ],
  'case-tasks': [
    'case.accept',
    'task.complete',
    'case.signal',
  ],
  'tasks-mine': [
    'case.accept',
    'case.override',
    'task.complete',
    'case.signal',
  ],
  queues: [
    'case.accept',
    'task.complete',
    'case.signal',
  ],
  notes: [
    'case.note.add',
    'case.accept',     // accept emits a classifier note
    'case.override',   // override emits a classifier note
    'task.complete',   // engine emits per-task system notes
    'case.signal',
    'case.appeal.generate', // appeal generation emits an appeal note
    'case.appeal.save',
  ],
  files: [
    'case.file.upload',
  ],
  'appeal-detail': [
    'case.appeal.generate',
    'case.appeal.save',
  ],
  // No invalidation for reference data (categories, lookups, transactions)
} as const;

// ============================================================================
// registerCaseActions — call from main.tsx
// ============================================================================

export function registerCaseActions(): void {
  // ========================================================================
  // READ ACTIONS (queries)
  // ========================================================================

  // ──────────────────────────────────────────────────────────────────────
  // Section A: Case lifecycle queries (most-frequent reads)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.worklist',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/worklist',
    permission: 'denial.read',
    description:
      "Paginated worklist of cases + current_task join, scoped to a queue. queue_id required. Returns WorklistRow[]. has_more is approximate when filters are active (workflow-lib limitation, fix queued for BE v1.2.0).",
    request: WorklistRequestSchema,
    response: WorklistResponseSchema,
    cache: {
      tag: 'worklist',
      invalidatedBy: INVALIDATE.worklist,
    },
  });

  defineAction({
    actionId: 'case.detail',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}',
    permission: 'denial.read',
    description:
      "Fat case detail: Case + engine snapshot (open + recent tasks) + full claim context (facility, provider, ICDs) + financial breakdown. PHI-bearing; rendered cleartext per v3 product decision.",
    request: z.object({
      case_id: z.string(),
    }),
    response: CaseDetailSchema,
    cache: {
      tag: 'case-detail',
      invalidatedBy: INVALIDATE['case-detail'],
    },
  });

  defineAction({
    actionId: 'case.tasks',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}/tasks',
    permission: 'denial.read',
    description:
      "All tasks on a case (open + recently closed). Read-through to engine. Used by WorkflowProgressStrip + 'What happens next' preview.",
    request: z.object({
      case_id: z.string(),
    }),
    response: z.object({
      tasks: z.array(EngineTaskSchema),
    }),
    cache: {
      tag: 'case-tasks',
      invalidatedBy: INVALIDATE['case-tasks'],
    },
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section B: Personal queue + queue list
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'task.mine',
    kind: 'query',
    endpoint: 'GET /api/v1/tasks/mine',
    permission: 'denial.read',
    description:
      "Per-user task list. Identity derived server-side from JWT (no user_id param). Returns WorklistRow[] shape (case + current_task) so CaseCard reuses across surfaces. Powers the needs_my_review red badge + the My Tasks page.",
    request: TasksMineRequestSchema,
    response: TasksMineResponseSchema,
    cache: {
      tag: 'tasks-mine',
      invalidatedBy: INVALIDATE['tasks-mine'],
    },
  });

  defineAction({
    actionId: 'queue.list',
    kind: 'query',
    endpoint: 'GET /api/v1/queues',
    permission: 'denial.read',
    description:
      "Queues the caller can view. Powers QueueSwitcher dropdown. Exactly one entry has is_default_for_caller=true (the user's role default). BE handles the role→queue visibility map.",
    request: z.object({}),
    response: z.object({
      queues: z.array(QueueSchema),
    }),
    cache: {
      tag: 'queues',
      invalidatedBy: INVALIDATE.queues,
    },
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section C: Tab content queries (Notes, Files, Transactions, Appeal)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.notes',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}/notes',
    permission: 'denial.read',
    description:
      "Notes attached to a case. Includes auto-emitted notes from engine state transitions (source=system|classifier|appeal). FE renders these visually distinct from analyst-typed notes (source=analyst).",
    request: z.object({
      case_id: z.string(),
    }),
    response: NotesResponseSchema,
    cache: {
      tag: 'notes',
      invalidatedBy: INVALIDATE.notes,
    },
  });

  defineAction({
    actionId: 'case.files',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}/files',
    permission: 'denial.read',
    description:
      "Files attached to a case. Each file has file_type (medical_record | operative_note | eob | ...). Use file_id with /download or /preview URLs (not action-dispatched — see P1.2 README).",
    request: z.object({
      case_id: z.string(),
    }),
    response: FilesResponseSchema,
    cache: {
      tag: 'files',
      invalidatedBy: INVALIDATE.files,
    },
  });

  defineAction({
    actionId: 'case.transactions',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}/transactions',
    permission: 'denial.read',
    description:
      "Payments tab data. DMS proxies from rcm-data-access (per Q#1 answer — DMS handles the join + auth). Returns transactions with CARC/RARC codes on denial entries, dollar amounts, transaction_date.",
    request: z.object({
      case_id: z.string(),
    }),
    response: TransactionsResponseSchema,
    cache: {
      tag: 'transactions',
      invalidatedBy: [], // vendor data; only changes via vendor sync (not FE-driven)
    },
  });

  defineAction({
    actionId: 'case.appeal.get',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}/appeal',
    permission: 'denial.read',
    description:
      "Get a single appeal draft for the Appeal tab editor. body is rich-text (markdown or HTML; TBD at component layer). Use /render-pdf URL (not action-dispatched) to get the PDF.",
    request: z.object({
      case_id: z.string(),
    }),
    response: AppealSchema,
    cache: {
      tag: 'appeal-detail',
      invalidatedBy: INVALIDATE['appeal-detail'],
    },
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section D: Reference data (cached aggressively; no FE invalidation)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'category.list',
    kind: 'query',
    endpoint: 'GET /api/v1/categories',
    permission: 'denial.read',
    description:
      "Denial category list with workflow mappings. Powers Override dialog dropdown + WorkflowPreview block in mockup #8 (uses workflow_step_labels to render dashed-circle preview).",
    request: z.object({}),
    response: CategoriesResponseSchema,
    cache: {
      tag: 'categories',
      invalidatedBy: [], // reference data; no FE-driven invalidation
    },
  });

  defineAction({
    actionId: 'lookup.clinics',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics',
    permission: 'denial.read',
    description:
      "Clinic list (root of the cascade). DMS proxies primrose-lookups-service. Used by worklist Clinic filter chip + Override dialog.",
    request: z.object({}),
    response: LookupResponseSchema,
    cache: {
      tag: 'lookup-clinics',
      invalidatedBy: [],
    },
  });

  defineAction({
    actionId: 'lookup.providers',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics/{clinic_id}/providers',
    permission: 'denial.read',
    description:
      "Providers for a clinic (cascade level 2). Pass-through to primrose-lookups-service.",
    request: z.object({
      clinic_id: z.string(),
    }),
    response: LookupResponseSchema,
    cache: {
      tag: 'lookup-providers',
      invalidatedBy: [],
    },
  });

  defineAction({
    actionId: 'lookup.payers',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics/{clinic_id}/payers',
    permission: 'denial.read',
    description:
      "Payers for a clinic (cascade level 2). Used by worklist Payer filter chip after clinic selection.",
    request: z.object({
      clinic_id: z.string(),
    }),
    response: LookupResponseSchema,
    cache: {
      tag: 'lookup-payers',
      invalidatedBy: [],
    },
  });

  defineAction({
    actionId: 'lookup.facilities',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics/{clinic_id}/facilities',
    permission: 'denial.read',
    description:
      "Facilities for a clinic (cascade level 2). Used by case-detail banner facility lookup.",
    request: z.object({
      clinic_id: z.string(),
    }),
    response: LookupResponseSchema,
    cache: {
      tag: 'lookup-facilities',
      invalidatedBy: [],
    },
  });

  // ========================================================================
  // WRITE ACTIONS (mutations)
  // ========================================================================

  // ──────────────────────────────────────────────────────────────────────
  // Section E: Case state transitions
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.accept',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/accept',
    permission: 'denial.act',
    description:
      "Accept the LLM recommendation. Sets originated_by_user_id to caller. Engine spins up the workflow for the recommended category and opens the first task. Returns updated CaseDetail + first opened task (or null if workflow has no human tasks).",
    request: z.object({
      case_id: z.string(),
    }),
    response: z.object({
      case: CaseDetailSchema,
      next_task: EngineTaskSchema.nullable(),
    }),
  });

  defineAction({
    actionId: 'case.override',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/override',
    permission: 'denial.act',
    description:
      "Override the LLM recommendation. Analyst supplies their chosen category + (optional) reasoning. Sets originated_by_user_id. Engine spins up the workflow for the OVERRIDDEN category.",
    request: z.object({
      case_id: z.string(),
      override_category: z.string(),
      override_reasoning: z.string().optional(),
    }),
    response: z.object({
      case: CaseDetailSchema,
      next_task: EngineTaskSchema.nullable(),
    }),
  });

  defineAction({
    actionId: 'case.reclassify',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/classify',
    permission: 'denial.classify',
    description:
      "Re-run the LLM classifier. Manager-only by default. Less common; used when new denial events arrived on a case. Returns updated Case with new recommended_* fields. Does NOT open new tasks (case stays in proposed state).",
    request: z.object({
      case_id: z.string(),
    }),
    response: CaseSchema,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section F: Task lifecycle
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'task.complete',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/tasks/{task_id}/complete',
    permission: 'denial.act',
    description:
      "Report task completion with outcome + facts. facts_to_set shape varies by task.task_type — validated client-side against TaskFactsByType[task.task_type] before send. Engine advances state and opens the next task (or completes the case). Returns updated CaseDetail + next_task (null if workflow complete).",
    request: z.object({
      case_id: z.string(),
      task_id: z.string(),
      outcome: HandlerOutcomeSchema,
      // Validated per task_type at the form layer; shape is open here because
      // the schema can't know which task_type at registry-definition time.
      facts_to_set: z.record(z.unknown()),
      completion_note: z.string().optional(),
    }),
    response: z.object({
      case: CaseDetailSchema,
      next_task: EngineTaskSchema.nullable(),
    }),
  });

  defineAction({
    actionId: 'case.signal',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/signal',
    permission: 'denial.act',
    description:
      "Send an external event into the engine. Rare; mostly for manual re-triggers (e.g. 'I just learned the payer responded — re-evaluate'). signal_type is engine-defined; signal_payload is opaque.",
    request: z.object({
      case_id: z.string(),
      signal_type: z.string(),
      signal_payload: z.record(z.unknown()).optional(),
    }),
    response: CaseDetailSchema,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section G: Content mutations (notes + files)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.note.add',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/notes',
    permission: 'denial.act',
    description:
      "Add an analyst-typed note to a case. source defaults to 'analyst' if not specified. System/classifier/appeal sources are emitted automatically by BE — FE should NOT send those source values.",
    request: z.object({
      case_id: z.string(),
      body: z.string().min(1),
      // Only 'analyst' is valid for FE-sent notes; included for symmetry but
      // BE will reject other sources from FE.
      source: NoteSourceSchema.optional(),
    }),
    response: NoteSchema,
  });

  defineAction({
    actionId: 'case.file.upload',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/files',
    permission: 'denial.act',
    description:
      "Upload a file to a case. Multipart request. Requires Idempotency-Key header (any UUID; FE debounces 5s to dedupe accidental double-submits). file_data is the actual binary — sent as multipart not JSON, so this request schema is partially symbolic.",
    request: z.object({
      case_id: z.string(),
      file_type: FileTypeSchema,
      // Symbolic — actual upload is multipart. Use a separate uploader helper
      // that builds FormData; pass the metadata fields here for type-checking.
      file_name: z.string(),
      idempotency_key: z.string().uuid(),
    }),
    response: FileSchema,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section H: Appeal lifecycle
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.appeal.generate',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/appeal/generate',
    permission: 'denial.act',
    description:
      "LLM-generate an appeal draft from a template. Returns the new Appeal in draft status. May take 10-30s for OpenAI primary; fallback to Gemini if primary fails.",
    request: z.object({
      case_id: z.string(),
      template: AppealTemplateSchema,
    }),
    response: AppealSchema,
  });

  defineAction({
    actionId: 'case.appeal.save',
    kind: 'mutation',
    endpoint: 'PUT /api/v1/cases/{case_id}/appeal/{appeal_id}',
    permission: 'denial.act',
    description:
      "Save edits to an appeal draft. body is the full rich-text content (no patch semantics). status transitions: draft → finalized → submitted (only forward; BE enforces).",
    request: z.object({
      case_id: z.string(),
      appeal_id: z.string(),
      body: z.string(),
      status: z.enum(['draft', 'finalized', 'submitted']).optional(),
    }),
    response: AppealSchema,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section I: Audit (PHI reveal)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.reveal-phi',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/reveal-phi',
    permission: 'denial.read',
    description:
      "Audit a PHI reveal click. Does NOT gate — the field is already visible (v3 product decision: cleartext PHI in internal tool). This is purely an audit-log emit. Send field_revealed identifying what was clicked.",
    request: z.object({
      case_id: z.string(),
      field_revealed: z.string(),
      reason: z.string().optional(),
    }),
    response: z.object({
      audit_id: z.string(),
      recorded_at: z.string().datetime(),
    }),
  });
}

// ============================================================================
// Self-audit: verify the invalidation matrix is consistent
// ────────────────────────────────────────────────────────────────────────────
// Static check that every actionId referenced in INVALIDATE actually exists
// as a registered mutation. Catches typos in the matrix at module-load time.
// Exported for the sanity-check script and tests.
// ============================================================================

export const MUTATION_ACTION_IDS = [
  'case.accept',
  'case.override',
  'case.reclassify',
  'task.complete',
  'case.signal',
  'case.note.add',
  'case.file.upload',
  'case.appeal.generate',
  'case.appeal.save',
  'case.reveal-phi',
] as const;

export type MutationActionId = (typeof MUTATION_ACTION_IDS)[number];

export const QUERY_ACTION_IDS = [
  'case.worklist',
  'case.detail',
  'case.tasks',
  'task.mine',
  'queue.list',
  'case.notes',
  'case.files',
  'case.transactions',
  'case.appeal.get',
  'category.list',
  'lookup.clinics',
  'lookup.providers',
  'lookup.payers',
  'lookup.facilities',
] as const;

export type QueryActionId = (typeof QUERY_ACTION_IDS)[number];

/**
 * Audit helper: verify every actionId in the INVALIDATE matrix is a known
 * mutation. Returns an array of problems (empty if matrix is consistent).
 */
export function auditInvalidationMatrix(): string[] {
  const known = new Set<string>(MUTATION_ACTION_IDS);
  const problems: string[] = [];
  for (const [cacheTag, mutations] of Object.entries(INVALIDATE)) {
    for (const m of mutations) {
      if (!known.has(m)) {
        problems.push(
          `INVALIDATE['${cacheTag}'] references unknown mutation '${m}'`,
        );
      }
    }
  }
  return problems;
}

// Expose for tests / sanity-check
export { INVALIDATE };
