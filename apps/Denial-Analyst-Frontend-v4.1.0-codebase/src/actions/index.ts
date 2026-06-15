/**
 * Denial Analyst Tool — Action Registry v4.1 (engine-handler model)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * v4.1 action registry against the CORRECTED denial-management-service model
 * (handoff: FE-v4_0_0-handoff-CORRECTED.md). DMS is a handler the workflow
 * engine pushes to; the FE reads DMS's local worklist table and POSTs task
 * outcomes. The FE never calls the engine.
 *
 * Drop-in path: src/actions/index.ts
 *
 * Coexistence during the R-phase rework:
 *   - src/actions/index-v4.ts   (v4.0.0 — case.worklist/case.accept/task.complete…)
 *   - src/actions/index.ts  (this file — worklist.list/worklist.complete…)
 * Components are repointed during their R-phase; index-v4.ts is deleted in R12.
 * Only ONE register fn should run in any given build — main.tsx calls
 * `registerWorklistActions()` (this file) for v4.1.
 *
 * Changes from the v4.0.0 registry (24 → 19 actions):
 *   DROPPED (7) — engine-coupled / personal-queue / accept-override:
 *     case.tasks, task.mine, queue.list, case.accept, case.override,
 *     case.reclassify, case.signal
 *   RENAMED (2):
 *     case.worklist → worklist.list   (now reads DMS-local table, not engine)
 *     task.complete → worklist.complete
 *   ADDED (2):
 *     worklist.task    (single dispatched-task detail)
 *     worklist.counts  (per-team counts for the switcher badges — WIRING TODO)
 *   UNCHANGED:
 *     case.detail, case.notes, case.files, case.transactions, case.appeal.get,
 *     category.list, lookup.{clinics,providers,payers,facilities},
 *     case.note.add, case.file.upload, case.appeal.generate, case.appeal.save,
 *     case.reveal-phi
 *
 * WIRING TODO (handoff §3, §11): the DMS engine-integration layer is being
 * rebuilt. Endpoint PATHS below are the target per the handoff; reconcile
 * against the regenerated OpenAPI when it lands. Lines that depend on an
 * unpublished shape carry `// WIRING TODO`.
 *
 * Permissions (coarse roles, unchanged from v4.0.0):
 *   denial.read      — ANALYST + MANAGER + ADMIN
 *   denial.act       — ANALYST + MANAGER + ADMIN
 *   denial.view_cost — MANAGER + ADMIN (Payments/cost gating)
 *   (denial.classify is retired — the Re-classify action is gone.)
 *
 * Endpoints NOT in this registry (binary streams / redirects — URL only):
 *   GET /api/v1/files/{file_id}/download
 *   GET /api/v1/files/{file_id}/preview
 *   GET /api/v1/cases/{id}/appeal/{appeal_id}/render-pdf
 *
 * Total in this registry: 19 actions (13 read + 6 write).
 */

import { z } from 'zod';
import { defineAction } from '@tensaw/actions';

// v4.1 domain schemas (R1)
import {
  WorklistTaskSchema,
  WorklistRequestSchema,
  WorklistResponseSchema,
  TaskCompleteRequestSchema,
  CaseDetailSchema,
  TeamSchema,
} from './schemas';

// Tab schemas — UNCHANGED from v4.0.0 (handoff §8). Notes/files/appeals/
// transactions/categories/lookups all carry over.
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
// Each cache tag lists the mutation actionIds that invalidate it. The big
// shift from v4.0.0: completing a task (`worklist.complete`) is the engine
// driver — it closes the current row and the engine dispatches the next, so it
// invalidates the worklist, its counts, the case detail, and notes (the engine
// emits per-transition system notes).
// ============================================================================

const INVALIDATE = {
  worklist: [
    'worklist.complete',
  ],
  'worklist-counts': [
    'worklist.complete',
  ],
  'case-detail': [
    'worklist.complete',
    'case.note.add',
    'case.appeal.generate',
    'case.appeal.save',
  ],
  notes: [
    'case.note.add',
    'worklist.complete', // engine emits per-task system/transition notes
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
  // No FE invalidation for reference data (categories, lookups) or vendor data
  // (transactions — changes only via vendor sync).
} as const;

// ============================================================================
// registerWorklistActions — call from main.tsx (v4.1)
// ============================================================================

export function registerWorklistActions(): void {
  // ========================================================================
  // READ ACTIONS (queries)
  // ========================================================================

  // ──────────────────────────────────────────────────────────────────────
  // Section A: Worklist (DMS-local table — NOT an engine query)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'worklist.list',
    kind: 'query',
    endpoint: 'GET /api/v1/worklist', // WIRING TODO: confirm path on OpenAPI regen
    permission: 'denial.read',
    description:
      "The analyst worklist — reads DMS's local analyst_worklist_task table (one row per dispatched task). Filter by team, task_type, status, priority, clinic, payer, aging, is_high_dollar. DB-backed pagination (exact total). The engine is NOT involved in this read.",
    request: WorklistRequestSchema,
    response: WorklistResponseSchema,
    cache: {
      tag: 'worklist',
      invalidatedBy: INVALIDATE.worklist,
    },
  });

  defineAction({
    actionId: 'worklist.task',
    kind: 'query',
    endpoint: 'GET /api/v1/worklist/{task_id}', // WIRING TODO: confirm path
    permission: 'denial.read',
    description:
      "A single dispatched task (the worklist row + everything the engine dispatched with it: case_context, case_facts, claim_summary). The row IS the current task — there is no separate engine snapshot fetch.",
    request: z.object({
      task_id: z.string(),
    }),
    response: WorklistTaskSchema,
    cache: {
      tag: 'worklist',
      invalidatedBy: INVALIDATE.worklist,
    },
  });

  defineAction({
    actionId: 'worklist.counts',
    kind: 'query',
    // WIRING TODO: this endpoint is NOT specified in the handoff. Added to keep
    // the QueueSwitcher's per-team count badges (a v4.0.0 affordance). Confirm
    // or drop when the OpenAPI lands; if dropped, the switcher renders without
    // counts.
    endpoint: 'GET /api/v1/worklist/counts',
    permission: 'denial.read',
    description:
      "Per-team open-task counts for the QueueSwitcher badges. Keys are Team enum values; values are open-row counts. WIRING TODO — not in the handoff; confirm with BE.",
    request: z.object({}),
    response: z.object({
      counts: z.record(TeamSchema, z.number().int()),
    }),
    cache: {
      tag: 'worklist-counts',
      invalidatedBy: INVALIDATE['worklist-counts'],
    },
  });

  defineAction({
    actionId: 'case.detail', // endpoint unchanged; ID suffixed for v4/v41 coexistence, collapsed in R12
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}',
    permission: 'denial.read',
    description:
      "Case detail — DMS merges its row + claim context from rcm-data-access + an optional engine snapshot, server-side. No case_status lifecycle; open_task_ids tells the FE what's currently dispatched. PHI-bearing; rendered cleartext per product decision.",
    request: z.object({
      case_id: z.string(),
    }),
    response: CaseDetailSchema,
    cache: {
      tag: 'case-detail',
      invalidatedBy: INVALIDATE['case-detail'],
    },
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section B: Tab reads (notes / files / transactions / appeal) — UNCHANGED
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
      "Files attached to a case. Each file has file_type (medical_record | operative_note | eob | ...). Use file_id with /download or /preview URLs (not action-dispatched).",
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
      "Payments tab data. OPEN QUESTION (revision spec F-4): whether DMS proxies these per-case or the FE calls rcm-data-access directly is unresolved. Registered against the DMS-proxy assumption; revisit before scoping Payments.",
    request: z.object({
      case_id: z.string(),
    }),
    response: TransactionsResponseSchema,
    cache: {
      tag: 'transactions',
      invalidatedBy: [], // vendor data; only changes via vendor sync
    },
  });

  defineAction({
    actionId: 'case.appeal.get',
    kind: 'query',
    endpoint: 'GET /api/v1/cases/{case_id}/appeal/{appeal_id}',
    permission: 'denial.read',
    description:
      "Get a single appeal draft for the Appeal tab editor. body is rich-text. Use /render-pdf URL (not action-dispatched) for the PDF.",
    request: z.object({
      case_id: z.string(),
      appeal_id: z.string(),
    }),
    response: AppealSchema,
    cache: {
      tag: 'appeal-detail',
      invalidatedBy: INVALIDATE['appeal-detail'],
    },
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section C: Reference data (cached aggressively; no FE invalidation)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'category.list',
    kind: 'query',
    endpoint: 'GET /api/v1/categories',
    permission: 'denial.read',
    description:
      "Denial category list. In v4.1 there is no Override dialog or fixed workflow preview; categories may feed triage clarification options or a filter. The workflow_step_labels field (if present) is no longer consumed by the FE.",
    request: z.object({}),
    response: CategoriesResponseSchema,
    cache: {
      tag: 'categories',
      invalidatedBy: [],
    },
  });

  defineAction({
    actionId: 'lookup.clinics',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics',
    permission: 'denial.read',
    description: 'Clinic lookup (cascade root). DMS proxies rcm-data-access.',
    request: z.object({}),
    response: LookupResponseSchema,
    cache: { tag: 'lookup-clinics', invalidatedBy: [] },
  });

  defineAction({
    actionId: 'lookup.providers',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics/{clinic_id}/providers',
    permission: 'denial.read',
    description: 'Provider lookup, scoped to a clinic (cascade).',
    request: z.object({ clinic_id: z.string() }),
    response: LookupResponseSchema,
    cache: { tag: 'lookup-providers', invalidatedBy: [] },
  });

  defineAction({
    actionId: 'lookup.payers',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics/{clinic_id}/payers',
    permission: 'denial.read',
    description: 'Payer lookup, scoped to a clinic (cascade — gates the payer filter chip).',
    request: z.object({ clinic_id: z.string() }),
    response: LookupResponseSchema,
    cache: { tag: 'lookup-payers', invalidatedBy: [] },
  });

  defineAction({
    actionId: 'lookup.facilities',
    kind: 'query',
    endpoint: 'GET /api/v1/lookups/clinics/{clinic_id}/facilities',
    permission: 'denial.read',
    description: 'Facility lookup, scoped to a clinic (cascade).',
    request: z.object({ clinic_id: z.string() }),
    response: LookupResponseSchema,
    cache: { tag: 'lookup-facilities', invalidatedBy: [] },
  });

  // ========================================================================
  // WRITE ACTIONS (mutations)
  // ========================================================================

  // ──────────────────────────────────────────────────────────────────────
  // Section D: Task completion (the engine driver)
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'worklist.complete',
    kind: 'mutation',
    endpoint: 'POST /api/v1/worklist/{task_id}/complete', // WIRING TODO: confirm path
    permission: 'denial.act',
    description:
      "Analyst finished the task. DMS reports the outcome to the engine and closes the row; the engine advances the case and dispatches the next task (a new worklist row, possibly another team's queue). Body: { outcome, facts_to_set, completion_note }.",
    request: z.object({
      task_id: z.string(),
      // The completion body. facts_to_set is validated per-task-type in the
      // form component against TaskFactsByType before this fires.
      outcome: TaskCompleteRequestSchema.shape.outcome,
      facts_to_set: TaskCompleteRequestSchema.shape.facts_to_set,
      completion_note: TaskCompleteRequestSchema.shape.completion_note,
    }),
    // WIRING TODO: exact response shape unspecified. Modeled as the closed row
    // (status=COMPLETED). The next task arrives via worklist invalidation, not
    // in this response.
    response: WorklistTaskSchema,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section E: Notes / Files — UNCHANGED from v4.0.0
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.note.add',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/notes',
    permission: 'denial.act',
    description:
      "Add an analyst-typed note. source defaults to 'analyst'. System/classifier/appeal sources are emitted automatically by BE — FE must NOT send those.",
    request: z.object({
      case_id: z.string(),
      body: z.string().min(1),
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
      "Upload a file. Multipart request; requires Idempotency-Key header. file_data is binary (multipart, not JSON) so this request schema is partially symbolic — a separate uploader helper builds the FormData. (App-shell multipart wiring TODO carries over from v4.0.0.)",
    request: z.object({
      case_id: z.string(),
      file_type: FileTypeSchema,
      file_name: z.string(),
      idempotency_key: z.string().uuid(),
    }),
    response: FileSchema,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section F: Appeal lifecycle — UNCHANGED
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.appeal.generate',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/appeal/generate',
    permission: 'denial.act',
    description:
      "LLM-generate an appeal draft from a template. Returns the new Appeal in draft status. 10-30s for OpenAI primary; Gemini fallback.",
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
      "Save edits to an appeal draft. body is full rich-text (no patch semantics). status transitions draft → finalized → submitted (forward only; BE enforces).",
    request: z.object({
      case_id: z.string(),
      appeal_id: z.string(),
      body: z.string(),
      status: z.enum(['draft', 'finalized', 'submitted']).optional(),
    }),
    response: AppealSchema,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section G: Audit (PHI reveal) — UNCHANGED
  // ──────────────────────────────────────────────────────────────────────

  defineAction({
    actionId: 'case.reveal-phi',
    kind: 'mutation',
    endpoint: 'POST /api/v1/cases/{case_id}/reveal-phi',
    permission: 'denial.act',
    description:
      "Logs a PHI-reveal audit event. Does NOT gate display (PHI is cleartext per product decision) — this is the accountability record only.",
    request: z.object({
      case_id: z.string(),
      field: z.string(),
    }),
    response: z.object({
      logged: z.boolean(),
    }),
  });
}

// Re-export the invalidation matrix for the SSR sanity script + tests.
export { INVALIDATE };
