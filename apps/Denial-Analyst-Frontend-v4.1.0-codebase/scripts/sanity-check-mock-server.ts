/**
 * Runtime sanity check for the v4.1 mock-server (engine-handler model).
 * Run with: npx tsx scripts/sanity-check-mock-server.ts
 */

import {
  queryWorklist,
  worklistCounts,
  completeTask,
  getCaseDetail,
  dispatchTask,
  createCase,
  resetDb,
} from '../src/mocks/server/db';
import { seedV41 } from '../src/mocks/server/seed';
import { nextDispatch } from '../src/mocks/server/routing';
import { WorklistTaskSchema, WorklistResponseSchema } from '../src/actions/schemas';

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ ${label}`);
    console.log(`    ${msg}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// ============================================================================
// Seed + shape
// ============================================================================

console.log('=== Seed + worklist shape ===');

seedV41();

check('seeds 15 OPEN worklist rows', () => {
  const page = queryWorklist({ page_size: 100 });
  assert(page.total === 15, `expected 15 rows, got ${page.total}`);
});

check('each row validates against WorklistTaskSchema (§4 nesting)', () => {
  const page = queryWorklist({ page_size: 100 });
  for (const row of page.rows) {
    WorklistTaskSchema.parse(row);
  }
});

check('worklist response validates against WorklistResponseSchema (exact total)', () => {
  const page = queryWorklist({ page_size: 100 });
  WorklistResponseSchema.parse(page);
  assert(page.has_more === false, 'all 15 fit in one page of 100');
});

check('rows carry case_context + case_facts + claim_summary', () => {
  const page = queryWorklist({ page_size: 1 });
  const row = page.rows[0];
  assert(row.case_context !== undefined, 'missing case_context');
  assert(typeof row.case_facts.is_high_dollar === 'boolean', 'missing case_facts.is_high_dollar');
  assert(typeof row.claim_summary.net_pending === 'string', 'net_pending should be a string');
});

check('no row is on a personal user_ queue', () => {
  const page = queryWorklist({ page_size: 100 });
  const personal = page.rows.filter((r) => String(r.team).startsWith('user_'));
  assert(personal.length === 0, 'no row should be on a user_<id> queue');
});

// ============================================================================
// Filters (local-table filtering, no engine)
// ============================================================================

console.log('\n=== Filters ===');

check('filter by team narrows rows', () => {
  const coding = queryWorklist({ team: 'coding', page_size: 100 });
  assert(coding.total >= 1, 'expected ≥1 coding task');
  assert(coding.rows.every((r) => r.team === 'coding'), 'all rows should be coding');
});

check('filter by task_type', () => {
  const triage = queryWorklist({ task_type: ['ANALYST_TRIAGE_DENIAL'], page_size: 100 });
  assert(triage.total === 1, `expected 1 triage seed, got ${triage.total}`);
  assert(triage.rows[0].task_type === 'ANALYST_TRIAGE_DENIAL', 'wrong task type');
});

check('filter by is_high_dollar flag', () => {
  const hd = queryWorklist({ is_high_dollar: true, page_size: 100 });
  assert(hd.total >= 1, 'expected ≥1 HD case');
  assert(hd.rows.every((r) => r.case_facts.is_high_dollar === true), 'all should be HD');
});

check('filter by clinic_id', () => {
  const c1 = queryWorklist({ clinic_id: 'clinic-001', page_size: 100 });
  assert(c1.total >= 1, 'expected ≥1 clinic-001 case');
  assert(c1.rows.every((r) => r.case_context.clinic_id === 'clinic-001'), 'clinic filter failed');
});

check('per-team counts sum to 15 open', () => {
  const counts = worklistCounts();
  const sum = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  assert(sum === 15, `expected counts to sum to 15, got ${sum}`);
});

// ============================================================================
// Dispatch loop — the engine-handler core
// ============================================================================

console.log('\n=== Dispatch loop ===');

check('completing the triage task closes it + dispatches the next', () => {
  const triage = queryWorklist({ task_type: ['ANALYST_TRIAGE_DENIAL'], page_size: 1 }).rows[0];
  const before = queryWorklist({ page_size: 100 }).total;

  const result = completeTask(triage.task_id, {
    outcome: 'SUCCESS',
    facts_to_set: { clarification_type: 'AUTHORIZATION' },
    completion_note: 'Auth path',
  });

  assert(result.closed_task.status === 'COMPLETED', 'task should be COMPLETED');
  assert(result.next_task !== null, 'a next task should be dispatched');
  // clarification_type=AUTHORIZATION routes triage → CALLER_GET_DENIAL_REASON
  assert(
    result.next_task!.task_type === 'CALLER_GET_DENIAL_REASON',
    `expected CALLER_GET_DENIAL_REASON, got ${result.next_task!.task_type}`,
  );
  assert(result.next_task!.team === 'calling', 'next task should be on the calling team');

  // Net open count unchanged (one closed, one opened)
  const after = queryWorklist({ page_size: 100 }).total;
  assert(after === before, `open count should be stable (${before} → ${after})`);
});

check('completed task no longer appears in the OPEN worklist', () => {
  const completed = [...queryWorklist({ status: ['COMPLETED'], page_size: 100 }).rows];
  assert(completed.length >= 1, 'expected ≥1 completed row');
  const open = queryWorklist({ status: ['OPEN'], page_size: 100 }).rows;
  for (const c of completed) {
    assert(!open.some((o) => o.task_id === c.task_id), 'completed task leaked into OPEN');
  }
});

check('walk a fresh case triage → resolution end-to-end', () => {
  // Build an isolated case so the walk is deterministic
  resetDb();
  const now = '2026-06-14T10:00:00Z';
  const id = 'C-WALK-0001';
  createCase({
    detail: {
      case_id: id,
      recommended_category: 'medical_necessity',
      recommended_confidence: 0.9,
      recommended_reasoning: 'walk test',
      classified_at: now,
      tool_version: 'phase1-0.1.0',
      claim_id: 999001,
      patient_name: 'Walk, Test',
      mrn: '00001',
      dos: '2026-05-01',
      facility_name: 'F',
      facility_id: 'f',
      provider_name: 'Dr. X',
      icd_codes: ['J45.20'],
      primary_payer_name: 'Humana MA',
      primary_payer_id: 'HUMANA',
      clinic_name: 'CAH',
      clinic_id: 'clinic-001',
      aging_bucket: '0-29 day',
      billed: '1000.00',
      net_pending: '800.00',
      paid_primary: '0.00',
      paid_secondary: '0.00',
      paid_tertiary: '0.00',
      paid_patient: '0.00',
      pending_primary: '800.00',
      pending_secondary: '0.00',
      pending_tertiary: '0.00',
    },
    case_facts: { is_high_dollar: true },
  });
  dispatchTask(id, { task_type: 'ANALYST_TRIAGE_DENIAL', team: 'denial_intake_analyst' });

  // Drive the case to resolution, guarding against infinite loops
  const path: string[] = [];
  let guard = 0;
  for (;;) {
    guard += 1;
    if (guard > 12) throw new Error(`walk did not resolve in 12 steps: ${path.join(' → ')}`);
    const open = queryWorklist({ status: ['OPEN'], page_size: 10 }).rows;
    if (open.length === 0) break; // resolved
    const task = open[0];
    path.push(task.task_type);

    // Pick facts/outcome that push the medical-necessity happy path forward
    let facts: Record<string, unknown> = {};
    let outcome: 'SUCCESS' | 'NEEDS_INFO' | 'FAIL_FATAL' = 'SUCCESS';
    if (task.task_type === 'ANALYST_TRIAGE_DENIAL') facts = { clarification_type: 'MEDICAL_NECESSITY' };
    if (task.task_type === 'CODER_REVIEW_RECORD') facts = { recommendation: 'appeal' };
    if (task.task_type === 'ANALYST_AWAIT_PAYER_RESPONSE') facts = { payer_decision: 'paid' };
    if (task.task_type === 'AM_DECIDE_DISPOSITION') facts = { disposition: 'cash_rate' };
    completeTask(task.task_id, { outcome, facts_to_set: facts });
  }

  // MEDICAL_NECESSITY triage → RESOLUTION_FILE_APPEAL → AWAIT → POSTING → resolved
  assert(path[0] === 'ANALYST_TRIAGE_DENIAL', 'should start at triage');
  assert(path.includes('RESOLUTION_FILE_APPEAL'), `expected appeal step; path: ${path.join(' → ')}`);
  assert(path.includes('ANALYST_AWAIT_PAYER_RESPONSE'), 'expected await step');
  assert(path[path.length - 1] === 'POSTING_VALIDATE_PAYMENT', `expected to end at posting; path: ${path.join(' → ')}`);

  const detail = getCaseDetail(id);
  assert(detail!.state_code === 'RESOLVED', `case should be RESOLVED, got ${detail!.state_code}`);
  assert(detail!.open_task_ids.length === 0, 'no open tasks after resolution');
});

// ============================================================================
// Routing function (pure) — branch + NEEDS_INFO + FAIL_FATAL
// ============================================================================

console.log('\n=== Routing function ===');

check('NEEDS_INFO re-dispatches the same task type', () => {
  const next = nextDispatch('CODER_REVIEW_RECORD', 'NEEDS_INFO', {});
  assert(next !== null && next.task_type === 'CODER_REVIEW_RECORD', 'NEEDS_INFO should re-dispatch same');
});

check('FAIL_FATAL on await routes to AM_DECIDE_DISPOSITION', () => {
  const next = nextDispatch('ANALYST_AWAIT_PAYER_RESPONSE', 'FAIL_FATAL', {});
  assert(next !== null && next.task_type === 'AM_DECIDE_DISPOSITION', 'denied → AM');
});

check('POSTING_VALIDATE_PAYMENT SUCCESS resolves (null)', () => {
  const next = nextDispatch('POSTING_VALIDATE_PAYMENT', 'SUCCESS', {});
  assert(next === null, 'posting should resolve the case');
});

check('coder recommendation drives refile vs appeal', () => {
  const refile = nextDispatch('CODER_REVIEW_RECORD', 'SUCCESS', { recommendation: 'refile' });
  const appeal = nextDispatch('CODER_REVIEW_RECORD', 'SUCCESS', { recommendation: 'appeal' });
  assert(refile!.task_type === 'RESOLUTION_REFILE_CLAIM', 'refile path');
  assert(appeal!.task_type === 'RESOLUTION_FILE_APPEAL', 'appeal path');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
