/**
 * MSW v2 handlers for the v4.1 mock-server (engine-handler model).
 *
 * One handler per v4.1 action (19). Worklist reads filter the DMS-local table;
 * `worklist.complete` runs the dispatch/handler loop (close row → dispatch
 * next). The engine is never contacted.
 *
 * Identity: `X-Mock-User-Id` header (default user_42 = Vipin K.).
 *
 * Drop-in path: src/mocks/server/handlers.ts
 *
 * Wire-up (typical MSW setup):
 *   import { setupWorker } from 'msw/browser';
 *   import { handlersV41, seedV41 } from './v41';
 *   seedV41();
 *   export const worker = setupWorker(...handlersV41);
 */

import { http, HttpResponse } from 'msw';
import {
  WorklistRequestSchema,
  TaskCompleteRequestSchema,
} from '../../actions/schemas';
import { FileTypeSchema, AppealTemplateSchema } from '../../actions/schemas-v4-tabs';
import {
  queryWorklist,
  worklistCounts,
  getTask,
  getCaseDetail,
  getNotes,
  getFiles,
  getTransactions,
  getAppeal,
  completeTask,
  addNote,
  addFile,
  createAppeal,
  updateAppeal,
  nextAuditId,
  type WorklistFilters,
} from './db';

const DEFAULT_USER_ID = 42;
const DEFAULT_USER_NAME = 'Vipin K.';

function userFrom(request: Request): { id: number; name: string } {
  const header = request.headers.get('X-Mock-User-Id');
  if (header === null) return { id: DEFAULT_USER_ID, name: DEFAULT_USER_NAME };
  const id = Number(header.replace('user_', ''));
  return { id: Number.isNaN(id) ? DEFAULT_USER_ID : id, name: `User ${id}` };
}

function parseWorklistQuery(url: URL): WorklistFilters {
  const q = url.searchParams;
  const arr = (key: string): string[] | undefined => {
    const v = q.getAll(key);
    return v.length > 0 ? v : undefined;
  };
  const raw = {
    team: q.get('team') ?? undefined,
    task_type: arr('task_type'),
    status: arr('status'),
    priority: q.get('priority') ?? undefined,
    clinic_id: q.get('clinic_id') ?? undefined,
    primary_payer_id: q.get('primary_payer_id') ?? undefined,
    aging_bucket: q.get('aging_bucket') ?? undefined,
    is_high_dollar: q.has('is_high_dollar') ? q.get('is_high_dollar') === 'true' : undefined,
    page: q.has('page') ? Number(q.get('page')) : undefined,
    page_size: q.has('page_size') ? Number(q.get('page_size')) : undefined,
  };
  // Validate against the request schema where it overlaps (defaults applied).
  const parsed = WorklistRequestSchema.partial().safeParse({
    ...raw,
    page: raw.page,
    page_size: raw.page_size,
  });
  // Fall back to the raw shape if optional-only parse is fine; the db query is
  // tolerant either way.
  void parsed;
  return raw as WorklistFilters;
}

export const handlersV41 = [
  // ──────────────────────────────────────────────────────────────────────
  // Worklist (DMS-local table)
  // ──────────────────────────────────────────────────────────────────────

  http.get('*/api/v1/worklist', ({ request }) => {
    const url = new URL(request.url);
    const filters = parseWorklistQuery(url);
    const page = queryWorklist(filters);
    return HttpResponse.json(page);
  }),

  http.get('*/api/v1/worklist/counts', () => {
    return HttpResponse.json({ counts: worklistCounts() });
  }),

  http.get('*/api/v1/worklist/:taskId', ({ params }) => {
    const task = getTask(String(params.taskId));
    if (task === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(task);
  }),

  http.post('*/api/v1/worklist/:taskId/complete', async ({ request, params }) => {
    const body = await request.json().catch(() => ({}));
    const parsed = TaskCompleteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'invalid_body', detail: parsed.error.issues },
        { status: 422 },
      );
    }
    try {
      const result = completeTask(String(params.taskId), parsed.data);
      // Response: the closed row (next task arrives via worklist invalidation).
      return HttpResponse.json(result.closed_task);
    } catch (err) {
      return HttpResponse.json(
        { error: 'complete_failed', detail: err instanceof Error ? err.message : String(err) },
        { status: 409 },
      );
    }
  }),

  // ──────────────────────────────────────────────────────────────────────
  // Case detail (DMS-merged)
  // ──────────────────────────────────────────────────────────────────────

  http.get('*/api/v1/cases/:caseId', ({ params }) => {
    const detail = getCaseDetail(String(params.caseId));
    if (detail === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(detail);
  }),

  // ──────────────────────────────────────────────────────────────────────
  // Tab reads (unchanged surfaces)
  // ──────────────────────────────────────────────────────────────────────

  http.get('*/api/v1/cases/:caseId/notes', ({ params }) => {
    return HttpResponse.json({ notes: getNotes(String(params.caseId)) });
  }),

  http.get('*/api/v1/cases/:caseId/files', ({ params }) => {
    return HttpResponse.json({ files: getFiles(String(params.caseId)) });
  }),

  http.get('*/api/v1/cases/:caseId/transactions', ({ params }) => {
    return HttpResponse.json({ transactions: getTransactions(String(params.caseId)) });
  }),

  http.get('*/api/v1/cases/:caseId/appeal/:appealId', ({ params }) => {
    const appeal = getAppeal(String(params.appealId));
    if (appeal === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(appeal);
  }),

  // ──────────────────────────────────────────────────────────────────────
  // Reference data
  // ──────────────────────────────────────────────────────────────────────

  http.get('*/api/v1/categories', () => {
    return HttpResponse.json({
      categories: [
        { code: 'medical_necessity', label: 'Medical Necessity' },
        { code: 'auth_missing', label: 'Auth Missing' },
        { code: 'modifier_missing', label: 'Modifier Missing' },
        { code: 'timely_filing', label: 'Timely Filing' },
        { code: 'coordination_of_benefits', label: 'Coordination of Benefits' },
      ],
    });
  }),

  http.get('*/api/v1/lookups/clinics', () => {
    return HttpResponse.json({
      items: [
        { id: 'clinic-001', name: 'Cardiology Associates of Houston', alias: 'CAH' },
        { id: 'clinic-002', name: 'Primrose Birmingham', alias: 'PRIM_BHM' },
        { id: 'clinic-003', name: 'LSAT Birmingham', alias: 'LSAT' },
      ],
    });
  }),

  http.get('*/api/v1/lookups/clinics/:clinicId/providers', () => {
    return HttpResponse.json({ items: [{ id: 'prov-1', name: 'Dr. M. Patel', alias: 'MP' }] });
  }),

  http.get('*/api/v1/lookups/clinics/:clinicId/payers', () => {
    return HttpResponse.json({
      items: [
        { id: 'HUMANA', name: 'Humana MA', alias: 'Humana' },
        { id: 'AETNA', name: 'Aetna Better Health', alias: 'Aetna BH' },
        { id: 'BCBS', name: 'BCBS AL', alias: 'BCBS' },
        { id: 'UHC', name: 'UnitedHealthcare', alias: 'UHC' },
      ],
    });
  }),

  http.get('*/api/v1/lookups/clinics/:clinicId/facilities', () => {
    return HttpResponse.json({ items: [{ id: 'fac-1', name: 'Main Campus', alias: 'MAIN' }] });
  }),

  // ──────────────────────────────────────────────────────────────────────
  // Mutations
  // ──────────────────────────────────────────────────────────────────────

  http.post('*/api/v1/cases/:caseId/notes', async ({ request, params }) => {
    const user = userFrom(request);
    const body = (await request.json().catch(() => ({}))) as { body?: string };
    if (body.body === undefined || body.body.trim() === '') {
      return HttpResponse.json({ error: 'body_required' }, { status: 422 });
    }
    const note = addNote(String(params.caseId), {
      body: body.body,
      source: 'analyst',
      author_user_id: user.id,
      author_user_name: user.name,
    });
    return HttpResponse.json(note, { status: 201 });
  }),

  http.post('*/api/v1/cases/:caseId/files', async ({ request, params }) => {
    const user = userFrom(request);
    // Multipart in production; in the mock we accept JSON metadata.
    const meta = (await request.json().catch(() => ({}))) as {
      file_type?: string;
      file_name?: string;
    };
    const ft = FileTypeSchema.safeParse(meta.file_type);
    if (!ft.success) {
      return HttpResponse.json({ error: 'invalid_file_type' }, { status: 422 });
    }
    const file = addFile(String(params.caseId), {
      file_name: meta.file_name ?? 'upload.pdf',
      file_type: ft.data,
      size_bytes: 51200,
      mime_type: 'application/pdf',
      uploaded_by_user_id: user.id,
      uploaded_by_user_name: user.name,
    });
    return HttpResponse.json(file, { status: 201 });
  }),

  http.post('*/api/v1/cases/:caseId/appeal/generate', async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { template?: string };
    const tpl = AppealTemplateSchema.safeParse(body.template);
    if (!tpl.success) {
      return HttpResponse.json({ error: 'invalid_template' }, { status: 422 });
    }
    const appeal = createAppeal(
      String(params.caseId),
      tpl.data,
      'Re: Appeal of denial\n\nTo Whom It May Concern,\n\n[LLM-generated draft body]\n',
    );
    return HttpResponse.json(appeal, { status: 201 });
  }),

  http.put('*/api/v1/cases/:caseId/appeal/:appealId', async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as {
      body?: string;
      status?: 'draft' | 'finalized' | 'submitted';
    };
    try {
      const appeal = updateAppeal(String(params.appealId), {
        body: body.body,
        status: body.status,
      });
      return HttpResponse.json(appeal);
    } catch {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
  }),

  http.post('*/api/v1/cases/:caseId/reveal-phi', async () => {
    return HttpResponse.json({ logged: true, audit_id: nextAuditId() });
  }),

  // ──────────────────────────────────────────────────────────────────────
  // Health
  // ──────────────────────────────────────────────────────────────────────

  http.get('*/healthz', () => HttpResponse.json({ status: 'ok' })),
  http.get('*/readyz', () => HttpResponse.json({ status: 'ready' })),
];
