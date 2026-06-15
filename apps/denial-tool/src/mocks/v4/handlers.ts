/**
 * MSW v2 handlers for the v4 mock-server.
 *
 * One handler per registered action (24 total). The handlers validate input
 * shapes against the schemas, call db functions for stateful operations,
 * and return realistic-shaped responses.
 *
 * Identity: derived from `X-Mock-User-Id` header (default user_42 = Vipin K.).
 * In production this comes from the JWT.
 *
 * Drop-in path: src/mocks/v4/handlers.ts
 *
 * Wire-up in your dev environment (typical MSW setup):
 *
 *   // src/mocks/browser.ts
 *   import { setupWorker } from 'msw/browser';
 *   import { handlersV4, seedV4 } from './v4';
 *   seedV4();
 *   export const worker = setupWorker(...handlersV4);
 *
 *   // src/main.tsx (dev only)
 *   if (import.meta.env.DEV) {
 *     const { worker } = await import('./mocks/browser');
 *     await worker.start();
 *   }
 */

import { http, HttpResponse } from 'msw';
import {
  CaseDetailSchema,
  EngineTaskSchema,
  WorklistRequestSchema,
  TasksMineRequestSchema,
  HandlerOutcomeSchema,
} from '../../actions/schemas-v4';
import {
  FileTypeSchema,
  AppealTemplateSchema,
} from '../../actions/schemas-v4-tabs';
import {
  db,
  getCase,
  getNotes,
  getFiles,
  getTransactions,
  getAppeal,
  createAppeal,
  updateAppeal,
  addNote,
  addFile,
  addTransaction,
  acceptCase,
  overrideCase,
  completeTask,
  reclassifyCase,
  queryWorklist,
  listQueuesWithCounts,
  workflowStepCount,
  workflowStepLabels,
  nextAuditId,
  nowISO,
  plusDays,
} from './db';
import { CATEGORY_TO_WORKFLOW, WORKFLOWS } from './workflows';

// ============================================================================
// Identity helpers
// ============================================================================

const DEFAULT_USER_ID = 42;
const USER_NAMES: Record<number, string> = {
  12: 'Bhavana M.',
  17: 'Renita K.',
  42: 'Vipin K.',
};

function getUser(req: Request): { user_id: number; user_name: string } {
  const idHeader = req.headers.get('X-Mock-User-Id');
  const userId = idHeader !== null ? Number(idHeader) : DEFAULT_USER_ID;
  return {
    user_id: userId,
    user_name: USER_NAMES[userId] ?? `User ${userId}`,
  };
}

function jsonError(message: string, status = 400): HttpResponse {
  return HttpResponse.json({ error: message }, { status });
}

// ============================================================================
// Reference data (built lazily on first request, after seed runs)
// ============================================================================

const CATEGORY_DEFS = [
  { code: 'medical_necessity', label: 'Medical Necessity' },
  { code: 'medical_records_missing', label: 'Medical Records Missing' },
  { code: 'modifier_missing', label: 'Modifier Missing' },
  { code: 'modifier_wrong', label: 'Modifier Wrong' },
  { code: 'auth_missing', label: 'Auth Missing' },
  { code: 'vague_denial', label: 'Vague Denial' },
  { code: 'coverage_lapsed', label: 'Coverage Lapsed' },
  { code: 'patient_not_eligible', label: 'Patient Not Eligible' },
  { code: 'clarification_other', label: 'Clarification (Other)' },
];

const CLINICS = [
  { id: 'clinic_lsat', name: 'Live Specialty Allergy Treatment', alias: 'LSAT' },
  { id: 'clinic_prim_bhm', name: 'Primrose Birmingham', alias: 'PRIM_BHM' },
  { id: 'clinic_prim_nsh', name: 'Primrose Nashville', alias: 'PRIM_NSH' },
  { id: 'clinic_tx_mcaid', name: 'Texas Medicaid Clinic', alias: 'TX Mcaid' },
];

const PROVIDERS_BY_CLINIC: Record<string, { id: string; name: string; alias: string | null }[]> = {
  clinic_lsat: [
    { id: 'prov_001', name: 'Dr. M. Patel', alias: null },
    { id: 'prov_002', name: 'Dr. R. Chen', alias: null },
  ],
  clinic_prim_bhm: [
    { id: 'prov_003', name: 'Dr. S. Williams', alias: null },
    { id: 'prov_004', name: 'Dr. J. Kumar', alias: null },
  ],
  clinic_prim_nsh: [
    { id: 'prov_005', name: 'Dr. L. Hernandez', alias: null },
  ],
  clinic_tx_mcaid: [
    { id: 'prov_006', name: 'Dr. T. Anderson', alias: null },
  ],
};

const PAYERS_BY_CLINIC: Record<string, { id: string; name: string; alias: string | null }[]> = {
  clinic_lsat: [
    { id: 'payer_humana_gp', name: 'Humana Gold Plus', alias: 'Humana GP' },
    { id: 'payer_aetna_bh', name: 'Aetna Better Health', alias: 'Aetna BH' },
    { id: 'payer_tricare_w', name: 'TriCare West', alias: 'TriCare W' },
  ],
  clinic_prim_bhm: [
    { id: 'payer_cigna_hs', name: 'Cigna HealthSpring', alias: 'Cigna HS' },
    { id: 'payer_bcbs_tx', name: 'BCBS Texas', alias: 'BCBS-TX' },
  ],
  clinic_prim_nsh: [
    { id: 'payer_uhc', name: 'United Healthcare', alias: 'UHC' },
    { id: 'payer_humana_gp', name: 'Humana Gold Plus', alias: 'Humana GP' },
  ],
  clinic_tx_mcaid: [
    { id: 'payer_tx_mcaid', name: 'Texas Medicaid', alias: 'TX Mcaid' },
  ],
};

const FACILITIES_BY_CLINIC: Record<string, { id: string; name: string; alias: string | null }[]> = {
  clinic_lsat: [{ id: 'fac_lsat_op', name: 'LSAT Outpatient', alias: null }],
  clinic_prim_bhm: [{ id: 'fac_prim_bhm_op', name: 'Primrose Birmingham OP', alias: null }],
  clinic_prim_nsh: [{ id: 'fac_prim_nsh_op', name: 'Primrose Nashville OP', alias: null }],
  clinic_tx_mcaid: [{ id: 'fac_tx_mcaid', name: 'Texas Medicaid Clinic', alias: null }],
};

// ============================================================================
// Handlers
// ============================================================================

export const handlersV4 = (baseUrl: string) => [

  // ──────────────────────────────────────────────────────────────────
  // case.worklist
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/cases/worklist`, ({ request }) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const parsed = WorklistRequestSchema.safeParse({
      ...params,
      // Convert string params back to right types where needed
      page: params.page !== undefined ? Number(params.page) : undefined,
      page_size: params.page_size !== undefined ? Number(params.page_size) : undefined,
      case_status: params.case_status ? params.case_status.split(',') : undefined,
      needs_my_review: params.needs_my_review === 'true' ? true : undefined,
      net_pending_min: params.net_pending_min !== undefined ? Number(params.net_pending_min) : undefined,
      net_pending_max: params.net_pending_max !== undefined ? Number(params.net_pending_max) : undefined,
    });
    if (!parsed.success) {
      return jsonError(`bad worklist request: ${parsed.error.message}`, 422);
    }
    const result = queryWorklist(parsed.data);
    return HttpResponse.json({
      rows: result.rows,
      page: parsed.data.page,
      page_size: parsed.data.page_size,
      has_more: result.has_more,
    });
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.detail
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/cases/:caseId`, ({ params }) => {
    const caseId = params.caseId as string;
    const c = getCase(caseId);
    if (!c) return jsonError('case not found', 404);
    // Strip internal _workflow_step_index before returning
    const { _workflow_step_index, ...detail } = c;
    void _workflow_step_index;
    return HttpResponse.json(CaseDetailSchema.parse(detail));
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.tasks
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/cases/:caseId/tasks`, ({ params }) => {
    const caseId = params.caseId as string;
    const c = getCase(caseId);
    if (!c) return jsonError('case not found', 404);
    return HttpResponse.json({
      tasks: [...c.engine_tasks_open, ...c.engine_tasks_recent],
    });
  }),

  // ──────────────────────────────────────────────────────────────────
  // task.mine
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/tasks/mine`, ({ request }) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const parsed = TasksMineRequestSchema.safeParse({
      ...params,
      page: params.page !== undefined ? Number(params.page) : undefined,
      page_size: params.page_size !== undefined ? Number(params.page_size) : undefined,
      priority: params.priority ? params.priority.split(',') : undefined,
      state_code: params.state_code ? params.state_code.split(',') : undefined,
    });
    if (!parsed.success) return jsonError(`bad tasks/mine request`, 422);

    const { user_id } = getUser(request);
    const personalQueueId = `user_${user_id}`;

    // Reuse queryWorklist with personal queue scope. TasksMine has list-valued
    // priority + state_code filters; the worklist query takes scalars, so we
    // pick the first value if present (good enough for the mock).
    const result = queryWorklist({
      queue_id: personalQueueId,
      priority: parsed.data.priority?.[0],
      page: parsed.data.page,
      page_size: parsed.data.page_size,
    });

    return HttpResponse.json({
      rows: result.rows,
      page: parsed.data.page,
      page_size: parsed.data.page_size,
      has_more: result.has_more,
    });
  }),

  // ──────────────────────────────────────────────────────────────────
  // queue.list
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/queues`, () => {
    return HttpResponse.json({ queues: listQueuesWithCounts() });
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.notes
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/cases/:caseId/notes`, ({ params }) => {
    const caseId = params.caseId as string;
    return HttpResponse.json({ notes: getNotes(caseId) });
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.files
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/cases/:caseId/files`, ({ params }) => {
    const caseId = params.caseId as string;
    return HttpResponse.json({ files: getFiles(caseId) });
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.transactions (DMS proxy from rcm-data-access)
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/cases/:caseId/transactions`, ({ params }) => {
    const caseId = params.caseId as string;
    const c = getCase(caseId);
    if (!c) return jsonError('case not found', 404);

    // Seed a single denial transaction on-demand if none exist (so the tab
    // shows something realistic without bloating the seed).
    let txns = getTransactions(caseId);
    if (txns.length === 0) {
      addTransaction({
        case_id: caseId,
        claim_id: c.claim_id,
        transaction_type: 'denial',
        payer_source: 'primary',
        amount: -c.net_pending,
        transaction_date: c.dos,
        carc_code: 'CO-50',
        rarc_code: null,
        remit_reason_text:
          'Service not medically necessary per payer LCD.',
      });
      txns = getTransactions(caseId);
    }
    return HttpResponse.json({ transactions: txns });
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.appeal.get
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/cases/:caseId/appeal`, ({ params }) => {
    let appeal = null;
    for (const a of db.appeals.values()) {
      if (a.case_id === params.caseId) {
        appeal = a;
        break;
      }
    }
    if (!appeal) return jsonError('appeal not found', 404);
    return HttpResponse.json(appeal);
  }),

  // ──────────────────────────────────────────────────────────────────
  // category.list
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/categories`, () => {
    const categories = CATEGORY_DEFS.map((c) => {
      const workflowName = CATEGORY_TO_WORKFLOW[c.code] ?? null;
      return {
        code: c.code,
        label: c.label,
        workflow_name: workflowName,
        workflow_step_count: workflowName !== null ? workflowStepCount(workflowName) : null,
        workflow_step_labels: workflowName !== null ? workflowStepLabels(workflowName) : undefined,
      };
    });
    return HttpResponse.json({ categories });
  }),

  // ──────────────────────────────────────────────────────────────────
  // lookup.clinics + cascades
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/api/v1/lookups/clinics`, () => {
    return HttpResponse.json({ items: CLINICS });
  }),

  http.get(`${baseUrl}/api/v1/lookups/clinics/:clinicId/providers`, ({ params }) => {
    return HttpResponse.json({
      items: PROVIDERS_BY_CLINIC[params.clinicId as string] ?? [],
    });
  }),

  http.get(`${baseUrl}/api/v1/lookups/clinics/:clinicId/payers`, ({ params }) => {
    return HttpResponse.json({
      items: PAYERS_BY_CLINIC[params.clinicId as string] ?? [],
    });
  }),

  http.get(`${baseUrl}/api/v1/lookups/clinics/:clinicId/facilities`, ({ params }) => {
    return HttpResponse.json({
      items: FACILITIES_BY_CLINIC[params.clinicId as string] ?? [],
    });
  }),

  // ────────────────────────────────────────────────────────────────────
  // MUTATIONS
  // ────────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────
  // case.accept
  // ──────────────────────────────────────────────────────────────────
  http.post(`${baseUrl}/api/v1/cases/:caseId/accept`, async ({ request, params }) => {
    const caseId = params.caseId as string;
    const { user_id, user_name } = getUser(request);
    const result = acceptCase(caseId, user_id, user_name);
    if (!result.ok) return jsonError(result.error, result.error.includes('not found') ? 404 : 409);
    const { _workflow_step_index, ...detail } = result.case;
    void _workflow_step_index;
    return HttpResponse.json({
      case: CaseDetailSchema.parse(detail),
      next_task: result.next_task !== null ? EngineTaskSchema.parse(result.next_task) : null,
    });
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.override
  // ──────────────────────────────────────────────────────────────────
  http.post(`${baseUrl}/api/v1/cases/:caseId/override`, async ({ request, params }) => {
    const caseId = params.caseId as string;
    const body = (await request.json().catch(() => null)) as {
      override_category?: string;
      override_reasoning?: string;
    } | null;
    if (body === null || !body.override_category) {
      return jsonError('override_category required', 422);
    }
    const { user_id, user_name } = getUser(request);
    const result = overrideCase(
      caseId,
      user_id,
      user_name,
      body.override_category,
      body.override_reasoning,
    );
    if (!result.ok) return jsonError(result.error, 409);
    const { _workflow_step_index, ...detail } = result.case;
    void _workflow_step_index;
    return HttpResponse.json({
      case: CaseDetailSchema.parse(detail),
      next_task: result.next_task !== null ? EngineTaskSchema.parse(result.next_task) : null,
    });
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.reclassify
  // ──────────────────────────────────────────────────────────────────
  http.post(`${baseUrl}/api/v1/cases/:caseId/classify`, ({ params }) => {
    const caseId = params.caseId as string;
    const updated = reclassifyCase(caseId);
    if (!updated) return jsonError('case not found', 404);
    const { _workflow_step_index, ...detail } = updated;
    void _workflow_step_index;
    return HttpResponse.json(detail);
  }),

  // ──────────────────────────────────────────────────────────────────
  // task.complete
  // ──────────────────────────────────────────────────────────────────
  http.post(
    `${baseUrl}/api/v1/cases/:caseId/tasks/:taskId/complete`,
    async ({ request, params }) => {
      const body = (await request.json().catch(() => null)) as {
        outcome?: string;
        facts_to_set?: Record<string, unknown>;
        completion_note?: string;
      } | null;
      if (body === null || body.outcome === undefined) {
        return jsonError('outcome required', 422);
      }
      const outcomeParse = HandlerOutcomeSchema.safeParse(body.outcome);
      if (!outcomeParse.success) {
        return jsonError(`bad outcome: ${body.outcome}`, 422);
      }
      const result = completeTask(
        params.caseId as string,
        params.taskId as string,
        outcomeParse.data,
        body.facts_to_set ?? {},
        body.completion_note,
      );
      if (!result.ok) {
        return jsonError(result.error, result.error.includes('not found') ? 404 : 409);
      }
      const { _workflow_step_index, ...detail } = result.case;
      void _workflow_step_index;
      return HttpResponse.json({
        case: CaseDetailSchema.parse(detail),
        next_task: result.next_task !== null ? EngineTaskSchema.parse(result.next_task) : null,
      });
    },
  ),

  // ──────────────────────────────────────────────────────────────────
  // case.signal
  // ──────────────────────────────────────────────────────────────────
  http.post(`${baseUrl}/api/v1/cases/:caseId/signal`, async ({ request, params }) => {
    const caseId = params.caseId as string;
    const c = getCase(caseId);
    if (!c) return jsonError('case not found', 404);
    const body = (await request.json().catch(() => null)) as {
      signal_type?: string;
    } | null;
    if (body === null || !body.signal_type) {
      return jsonError('signal_type required', 422);
    }
    // Mock: just record the signal as a system note + touch updated_at
    addNote({
      case_id: caseId,
      body: `Signal received: ${body.signal_type}`,
      source: 'system',
      author_user_id: null,
      author_user_name: null,
    });
    c.updated_at = nowISO();
    const { _workflow_step_index, ...detail } = c;
    void _workflow_step_index;
    return HttpResponse.json(detail);
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.note.add
  // ──────────────────────────────────────────────────────────────────
  http.post(`${baseUrl}/api/v1/cases/:caseId/notes`, async ({ request, params }) => {
    const caseId = params.caseId as string;
    const c = getCase(caseId);
    if (!c) return jsonError('case not found', 404);
    const body = (await request.json().catch(() => null)) as { body?: string } | null;
    if (body === null || !body.body || body.body.length === 0) {
      return jsonError('body required', 422);
    }
    const { user_id, user_name } = getUser(request);
    const note = addNote({
      case_id: caseId,
      body: body.body,
      source: 'analyst',
      author_user_id: user_id,
      author_user_name: user_name,
    });
    return HttpResponse.json(note);
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.file.upload
  // ──────────────────────────────────────────────────────────────────
  http.post(`${baseUrl}/api/v1/cases/:caseId/files`, async ({ request, params }) => {
    const caseId = params.caseId as string;
    const c = getCase(caseId);
    if (!c) return jsonError('case not found', 404);
    // Real BE uses multipart; mock accepts JSON metadata for simplicity
    const body = (await request.json().catch(() => null)) as {
      file_type?: string;
      file_name?: string;
    } | null;
    if (body === null || !body.file_type || !body.file_name) {
      return jsonError('file_type and file_name required', 422);
    }
    const ftypeParse = FileTypeSchema.safeParse(body.file_type);
    if (!ftypeParse.success) return jsonError(`bad file_type: ${body.file_type}`, 422);

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey === null) {
      return jsonError('Idempotency-Key header required', 400);
    }

    const { user_id, user_name } = getUser(request);
    const file = addFile({
      case_id: caseId,
      file_name: body.file_name,
      file_type: ftypeParse.data,
      size_bytes: 102400, // mock 100KB
      mime_type: 'application/pdf',
      uploaded_by_user_id: user_id,
      uploaded_by_user_name: user_name,
    });
    return HttpResponse.json(file);
  }),

  // ──────────────────────────────────────────────────────────────────
  // case.appeal.generate
  // ──────────────────────────────────────────────────────────────────
  http.post(
    `${baseUrl}/api/v1/cases/:caseId/appeal/generate`,
    async ({ request, params }) => {
      const caseId = params.caseId as string;
      const c = getCase(caseId);
      if (!c) return jsonError('case not found', 404);
      const body = (await request.json().catch(() => null)) as {
        template?: string;
      } | null;
      if (body === null || !body.template) {
        return jsonError('template required', 422);
      }
      const tplParse = AppealTemplateSchema.safeParse(body.template);
      if (!tplParse.success) return jsonError(`bad template: ${body.template}`, 422);

      const draftBody = `# Appeal Letter

Dear ${c.primary_payer_name ?? 'Payer'},

We are writing to formally appeal the denial of claim ${c.claim_id} for patient ${c.patient_name ?? 'Patient'}, MRN ${c.mrn}, with date of service ${c.dos}.

The claim was denied citing ${c.recommended_category}. Please find attached supporting documentation including medical records, encounter notes, and the relevant clinical justification.

[Template: ${tplParse.data}]

Sincerely,
Primrose RCM`;

      const appeal = createAppeal({
        case_id: caseId,
        template: tplParse.data,
        status: 'draft',
        body: draftBody,
        generated_at: nowISO(),
        generated_by_model: 'gpt-4-mock-stub',
      });
      addNote({
        case_id: caseId,
        body: `Appeal draft generated using template '${tplParse.data}'.`,
        source: 'appeal',
        author_user_id: null,
        author_user_name: null,
      });
      return HttpResponse.json(appeal);
    },
  ),

  // ──────────────────────────────────────────────────────────────────
  // case.appeal.save
  // ──────────────────────────────────────────────────────────────────
  http.put(
    `${baseUrl}/api/v1/cases/:caseId/appeal/:appealId`,
    async ({ request, params }) => {
      const body = (await request.json().catch(() => null)) as {
        body?: string;
        status?: 'draft' | 'finalized' | 'submitted';
      } | null;
      if (body === null || body.body === undefined) {
        return jsonError('body required', 422);
      }
      const updated = updateAppeal(
        params.appealId as string,
        body.body,
        body.status,
      );
      if (!updated) return jsonError('appeal not found', 404);
      addNote({
        case_id: params.caseId as string,
        body: `Appeal updated${body.status ? ` to status ${body.status}` : ''}.`,
        source: 'appeal',
        author_user_id: null,
        author_user_name: null,
      });
      return HttpResponse.json(updated);
    },
  ),

  // ──────────────────────────────────────────────────────────────────
  // case.reveal-phi (audit only)
  // ──────────────────────────────────────────────────────────────────
  http.post(`${baseUrl}/api/v1/cases/:caseId/reveal-phi`, async ({ request, params }) => {
    const caseId = params.caseId as string;
    const c = getCase(caseId);
    if (!c) return jsonError('case not found', 404);
    const body = (await request.json().catch(() => null)) as {
      field_revealed?: string;
    } | null;
    if (body === null || !body.field_revealed) {
      return jsonError('field_revealed required', 422);
    }
    return HttpResponse.json({
      audit_id: nextAuditId(),
      recorded_at: nowISO(),
    });
  }),

  // ──────────────────────────────────────────────────────────────────
  // Health probes (unauthenticated, root-level — match BE convention)
  // ──────────────────────────────────────────────────────────────────
  http.get(`${baseUrl}/healthz`, () => HttpResponse.json({ status: 'ok' })),
  http.get(`${baseUrl}/readyz`, () => HttpResponse.json({ status: 'ready' })),
];

// Suppress unused-warning for plusDays (kept in export for future expansion)
void plusDays;
void WORKFLOWS;
void db;
