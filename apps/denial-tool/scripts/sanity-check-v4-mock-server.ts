/**
 * End-to-end runtime smoke for the v4 mock-server.
 *
 * Sets up MSW in Node, seeds, then exercises each handler. Verifies the full
 * happy path:
 *   list queues → list worklist → fetch detail → accept → check task opened
 *   → complete task → check next task → ...
 *
 * Also validates response shapes against Zod schemas to catch any drift
 * between db.ts and what the schemas expect.
 *
 * Run with: npx tsx scripts/sanity-check-v4-mock-server.ts
 */

import { setupServer } from 'msw/node';
import { seedV4, handlersV4 } from '../src/mocks/v4';
import {
  CaseDetailSchema,
  EngineTaskSchema,
  WorklistResponseSchema,
  QueueSchema,
} from '../src/actions/schemas-v4';
import {
  NotesResponseSchema,
  AppealSchema,
  TransactionsResponseSchema,
  CategoriesResponseSchema,
  LookupResponseSchema,
} from '../src/actions/schemas-v4-tabs';

const BASE = 'http://mock.test';

const server = setupServer(...handlersV4);
server.listen({ onUnhandledRequest: 'error' });

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ ${label}`);
    console.log(`    ${msg}`);
    failed++;
  }
}

async function call(
  method: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  });
  const text = await res.text();
  const body = text.length > 0 ? JSON.parse(text) : null;
  return { status: res.status, body };
}

async function main(): Promise<void> {
  seedV4();

  console.log('=== Reference data ===');

  await check('GET /api/v1/queues returns 7 queues', async () => {
    const { status, body } = await call('GET', '/api/v1/queues');
    if (status !== 200) throw new Error(`status ${status}`);
    const b = body as { queues: unknown[] };
    if (b.queues.length !== 7) throw new Error(`expected 7 queues, got ${b.queues.length}`);
    for (const q of b.queues) QueueSchema.parse(q);
  });

  await check('exactly one queue has is_default_for_caller=true', async () => {
    const { body } = await call('GET', '/api/v1/queues');
    const queues = (body as { queues: { is_default_for_caller: boolean }[] }).queues;
    const defaults = queues.filter((q) => q.is_default_for_caller);
    if (defaults.length !== 1) throw new Error(`expected 1 default, got ${defaults.length}`);
  });

  await check('GET /api/v1/categories returns 9 categories with workflows', async () => {
    const { body } = await call('GET', '/api/v1/categories');
    const parsed = CategoriesResponseSchema.parse(body);
    if (parsed.categories.length !== 9) {
      throw new Error(`expected 9, got ${parsed.categories.length}`);
    }
    // Verify medical_necessity has 5 steps
    const mn = parsed.categories.find((c) => c.code === 'medical_necessity');
    if (mn?.workflow_step_count !== 5) {
      throw new Error('medical_necessity should have 5 steps');
    }
  });

  await check('GET /api/v1/lookups/clinics returns 4 clinics', async () => {
    const { body } = await call('GET', '/api/v1/lookups/clinics');
    const parsed = LookupResponseSchema.parse(body);
    if (parsed.items.length !== 4) throw new Error(`got ${parsed.items.length}`);
  });

  await check('cascade lookups work for clinic_lsat', async () => {
    const { body: providers } = await call('GET', '/api/v1/lookups/clinics/clinic_lsat/providers');
    const { body: payers } = await call('GET', '/api/v1/lookups/clinics/clinic_lsat/payers');
    const { body: facilities } = await call('GET', '/api/v1/lookups/clinics/clinic_lsat/facilities');
    LookupResponseSchema.parse(providers);
    LookupResponseSchema.parse(payers);
    LookupResponseSchema.parse(facilities);
  });

  console.log('\n=== Worklist ===');

  await check('GET worklist on default intake queue returns proposed cases', async () => {
    const { status, body } = await call(
      'GET',
      '/api/v1/cases/worklist?queue_id=denial_intake_analyst_primrose',
    );
    if (status !== 200) throw new Error(`status ${status}`);
    const parsed = WorklistResponseSchema.parse(body);
    if (parsed.rows.length === 0) throw new Error('expected non-empty rows');
    // All should be proposed (the seed has 6 of them)
    for (const row of parsed.rows.slice(0, 6)) {
      if (row.case.case_status !== 'proposed') {
        // Some intake-queue rows may be accepted with intake_triage tasks
        // — just ensure we got SOME proposed ones
      }
    }
    const proposedCount = parsed.rows.filter((r) => r.case.case_status === 'proposed').length;
    if (proposedCount < 5) throw new Error(`expected >=5 proposed, got ${proposedCount}`);
  });

  await check('worklist on coding_primrose returns Whitfield M case', async () => {
    const { body } = await call(
      'GET',
      '/api/v1/cases/worklist?queue_id=coding_primrose',
    );
    const parsed = WorklistResponseSchema.parse(body);
    if (parsed.rows.length !== 1) throw new Error(`got ${parsed.rows.length}`);
    if (parsed.rows[0]?.current_task?.task_type !== 'coding_review') {
      throw new Error('expected coding_review current_task');
    }
  });

  await check('worklist on user_42 returns 3 needs_my_review cases', async () => {
    const { body } = await call(
      'GET',
      '/api/v1/cases/worklist?queue_id=user_42',
    );
    const parsed = WorklistResponseSchema.parse(body);
    if (parsed.rows.length !== 3) throw new Error(`got ${parsed.rows.length}`);
    for (const r of parsed.rows) {
      if (r.current_task?.task_type !== 'coding_feedback_review') {
        throw new Error(`expected coding_feedback_review, got ${r.current_task?.task_type}`);
      }
    }
  });

  await check('worklist HD filter — net_pending_min=750 returns only HD cases', async () => {
    const { body } = await call(
      'GET',
      '/api/v1/cases/worklist?queue_id=denial_intake_analyst_primrose&net_pending_min=750',
    );
    const parsed = WorklistResponseSchema.parse(body);
    for (const r of parsed.rows) {
      if (!r.case.is_high_dollar) throw new Error('non-HD case in HD filter');
    }
  });

  console.log('\n=== task.mine (personal queue) ===');

  await check('GET /api/v1/tasks/mine for user_42 returns 3 cases', async () => {
    const { body } = await call('GET', '/api/v1/tasks/mine', {
      headers: { 'X-Mock-User-Id': '42' },
    });
    const parsed = WorklistResponseSchema.parse(body);
    if (parsed.rows.length !== 3) throw new Error(`got ${parsed.rows.length}`);
  });

  console.log('\n=== Case detail + tab data ===');

  await check('GET case detail for case_000001 (Henderson)', async () => {
    const { status, body } = await call('GET', '/api/v1/cases/case_000001');
    if (status !== 200) throw new Error(`status ${status}`);
    const parsed = CaseDetailSchema.parse(body);
    if (parsed.patient_name !== 'Henderson, J') {
      throw new Error(`expected Henderson, got ${parsed.patient_name}`);
    }
    if (parsed.case_status !== 'proposed') {
      throw new Error(`expected proposed, got ${parsed.case_status}`);
    }
  });

  await check('GET unknown case returns 404', async () => {
    const { status } = await call('GET', '/api/v1/cases/nonexistent');
    if (status !== 404) throw new Error(`expected 404, got ${status}`);
  });

  await check('GET notes returns empty array for proposed case', async () => {
    const { body } = await call('GET', '/api/v1/cases/case_000001/notes');
    const parsed = NotesResponseSchema.parse(body);
    if (parsed.notes.length !== 0) throw new Error(`expected 0 notes, got ${parsed.notes.length}`);
  });

  await check('GET transactions auto-seeds a denial transaction', async () => {
    const { body } = await call('GET', '/api/v1/cases/case_000001/transactions');
    const parsed = TransactionsResponseSchema.parse(body);
    if (parsed.transactions.length !== 1) {
      throw new Error(`expected 1 transaction, got ${parsed.transactions.length}`);
    }
    if (parsed.transactions[0]!.transaction_type !== 'denial') {
      throw new Error('expected denial transaction');
    }
  });

  console.log('\n=== Engine simulator: accept + complete cycle ===');

  await check('POST accept on Henderson case transitions to accepted + opens intake_triage', async () => {
    const { status, body } = await call('POST', '/api/v1/cases/case_000001/accept', {
      headers: { 'X-Mock-User-Id': '42' },
    });
    if (status !== 200) throw new Error(`status ${status}`);
    const b = body as { case: unknown; next_task: unknown };
    const c = CaseDetailSchema.parse(b.case);
    const t = EngineTaskSchema.parse(b.next_task);
    if (c.case_status !== 'accepted') throw new Error(`expected accepted, got ${c.case_status}`);
    if (c.originated_by_user_id !== 42) throw new Error('originated_by not set');
    if (c.workflow_name !== 'medical_necessity_resolution') {
      throw new Error(`wrong workflow: ${c.workflow_name}`);
    }
    if (t.task_type !== 'intake_triage') throw new Error(`expected intake_triage, got ${t.task_type}`);
    if (t.queue_id !== 'denial_intake_analyst_primrose') throw new Error('wrong queue');
  });

  await check('accept a second time on same case returns 409 (cannot transition)', async () => {
    const { status } = await call('POST', '/api/v1/cases/case_000001/accept');
    if (status !== 409) throw new Error(`expected 409, got ${status}`);
  });

  await check('complete intake_triage advances to resolution_action on resolution_primrose', async () => {
    // Find the open intake_triage task on case_000001
    const { body: tasksBody } = await call('GET', '/api/v1/cases/case_000001/tasks');
    const tasks = (tasksBody as { tasks: { task_id: string; task_type: string; state_code: string }[] }).tasks;
    const openTask = tasks.find((t) => t.task_type === 'intake_triage' && t.state_code === 'OPEN');
    if (!openTask) throw new Error('no open intake_triage task');

    const { status, body } = await call(
      'POST',
      `/api/v1/cases/case_000001/tasks/${openTask.task_id}/complete`,
      {
        headers: { 'X-Mock-User-Id': '42' },
        body: JSON.stringify({
          outcome: 'SUCCESS',
          facts_to_set: {
            triage_category: 'medical_necessity',
            priority: 'normal',
            triage_route: 'resolution',
          },
          completion_note: 'Records pulled, routing to Resolution.',
        }),
      },
    );
    if (status !== 200) throw new Error(`status ${status}`);
    const b = body as { case: unknown; next_task: unknown };
    const t = EngineTaskSchema.parse(b.next_task);
    if (t.task_type !== 'resolution_action') {
      throw new Error(`expected resolution_action, got ${t.task_type}`);
    }
    if (t.queue_id !== 'resolution_primrose') throw new Error('wrong queue');
  });

  await check('completing all workflow steps marks case completed', async () => {
    // case_000001 is now on step 1 (resolution_action). Walk through remaining 3 steps.
    for (let i = 0; i < 4; i++) {
      const { body: tasksBody } = await call('GET', '/api/v1/cases/case_000001/tasks');
      const tasks = (tasksBody as { tasks: { task_id: string; state_code: string }[] }).tasks;
      const openTask = tasks.find((t) => t.state_code === 'OPEN');
      if (!openTask) throw new Error(`no open task on iteration ${i}`);
      await call(
        'POST',
        `/api/v1/cases/case_000001/tasks/${openTask.task_id}/complete`,
        {
          body: JSON.stringify({ outcome: 'SUCCESS', facts_to_set: {} }),
        },
      );
    }
    const { body } = await call('GET', '/api/v1/cases/case_000001');
    const c = CaseDetailSchema.parse(body);
    if (c.case_status !== 'completed') {
      throw new Error(`expected completed, got ${c.case_status}`);
    }
    if (c.engine_state_code !== 'COMPLETED') {
      throw new Error(`expected COMPLETED, got ${c.engine_state_code}`);
    }
  });

  console.log('\n=== Override flow ===');

  await check('POST override on Romero case with auth_missing routes to payer_call workflow', async () => {
    // Romero is case_000002 in seed order — but accept of case_000001 already
    // consumed seq, so let's find a proposed case dynamically.
    const { body: wl } = await call(
      'GET',
      '/api/v1/cases/worklist?queue_id=denial_intake_analyst_primrose',
    );
    const proposed = (wl as { rows: { case: { case_id: string; case_status: string } }[] }).rows
      .find((r) => r.case.case_status === 'proposed');
    if (!proposed) throw new Error('no proposed case available');

    const { status, body } = await call(
      'POST',
      `/api/v1/cases/${proposed.case.case_id}/override`,
      {
        body: JSON.stringify({
          override_category: 'auth_missing',
          override_reasoning: 'EOB shows auth was actually required, not missing data.',
        }),
      },
    );
    if (status !== 200) throw new Error(`status ${status}`);
    const b = body as { case: unknown; next_task: unknown };
    const c = CaseDetailSchema.parse(b.case);
    const t = EngineTaskSchema.parse(b.next_task);
    if (c.case_status !== 'overridden') throw new Error(`expected overridden`);
    if (c.workflow_name !== 'payer_call_resolution') {
      throw new Error(`wrong workflow: ${c.workflow_name}`);
    }
    if (t.task_type !== 'intake_triage') throw new Error(`expected intake_triage as step 0`);
  });

  console.log('\n=== Note + File + Appeal flows ===');

  await check('POST a note on a case', async () => {
    const { status, body } = await call('POST', '/api/v1/cases/case_000001/notes', {
      body: JSON.stringify({ body: 'Talked to payer; auth was on file under different DOS.' }),
    });
    if (status !== 200) throw new Error(`status ${status}`);
    const b = body as { source: string; author_user_id: number };
    if (b.source !== 'analyst') throw new Error('expected analyst source');
    if (b.author_user_id !== 42) throw new Error('expected user 42');
  });

  await check('POST a file requires Idempotency-Key', async () => {
    const { status } = await call('POST', '/api/v1/cases/case_000001/files', {
      body: JSON.stringify({ file_type: 'medical_record', file_name: 'records.pdf' }),
    });
    if (status !== 400) throw new Error(`expected 400, got ${status}`);
  });

  await check('POST a file with Idempotency-Key succeeds', async () => {
    const { status } = await call('POST', '/api/v1/cases/case_000001/files', {
      headers: { 'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440000' },
      body: JSON.stringify({ file_type: 'medical_record', file_name: 'records.pdf' }),
    });
    if (status !== 200) throw new Error(`status ${status}`);
  });

  await check('POST generate appeal returns a draft with body', async () => {
    const { status, body } = await call(
      'POST',
      '/api/v1/cases/case_000001/appeal/generate',
      {
        body: JSON.stringify({ template: 'medical_necessity' }),
      },
    );
    if (status !== 200) throw new Error(`status ${status}`);
    const a = AppealSchema.parse(body);
    if (a.status !== 'draft') throw new Error(`expected draft, got ${a.status}`);
    if (a.body.length < 50) throw new Error('appeal body too short');
  });

  console.log('\n=== Health probes ===');

  await check('GET /healthz returns 200 ok', async () => {
    const { status, body } = await call('GET', '/healthz');
    if (status !== 200) throw new Error(`status ${status}`);
    if ((body as { status: string }).status !== 'ok') throw new Error('not ok');
  });

  await check('GET /readyz returns 200 ready', async () => {
    const { status, body } = await call('GET', '/readyz');
    if (status !== 200) throw new Error(`status ${status}`);
    if ((body as { status: string }).status !== 'ready') throw new Error('not ready');
  });

  console.log(`\n${passed} passed · ${failed} failed`);
  server.close();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  server.close();
  process.exit(1);
});
