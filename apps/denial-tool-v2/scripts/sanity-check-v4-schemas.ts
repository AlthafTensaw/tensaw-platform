/**
 * Runtime sanity check for schemas-v4.ts.
 * NOT a test suite — just verifies each schema parses a realistic payload.
 * Run with: npx tsx scripts/sanity-check-v4-schemas.ts
 */

import {
  CaseSchema,
  CaseStatusSchema,
  EngineTaskSchema,
  QueueSchema,
  WorklistRowSchema,
  WorklistResponseSchema,
  WorklistRequestSchema,
  CaseDetailSchema,
  TasksMineRequestSchema,
  HandlerOutcomeSchema,
  TaskFactsByType,
  isCaseProposed,
  isCaseInFlight,
  isReviewTask,
  type Case,
  type EngineTask,
  type TaskFacts,
} from '../src/actions/schemas-v4';

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

// Realistic fixtures
const sampleCase: Case = {
  case_id: 'case_8af3c1',
  case_status: 'proposed',
  originated_by_user_id: null,
  originated_by_user_name: null,
  originated_at: null,
  is_high_dollar: false,
  high_dollar_shim_case_id: null,
  workflow_name: null,
  engine_state_code: null,
  claim_id: 300138,
  patient_name: 'Henderson, Joel',
  mrn: '72834',
  dos: '2026-02-24',
  net_pending: 230.0,
  recommended_category: 'medical_necessity',
  recommended_confidence: 0.92,
  recommended_reasoning: 'CO-50 plus prior pattern of medical-necessity denials.',
  classified_at: '2026-06-11T09:00:00Z',
  tool_version: 'phase1-0.1.0',
  primary_payer_name: 'Humana Gold Plus',
  primary_payer_alias: 'Humana GP',
  clinic_name: 'Live Specialty Allergy Treatment',
  clinic_alias: 'LSAT',
  aging_bucket: '90-119d',
  created_at: '2026-06-11T08:00:00Z',
  updated_at: '2026-06-11T09:00:00Z',
};

const sampleTask: EngineTask = {
  task_id: 'eng_t_4f8a1b',
  case_id: 'case_8af3c1',
  task_type: 'intake_triage',
  state_code: 'OPEN',
  queue_id: 'denial_intake_analyst_primrose',
  priority_code: 'normal',
  opened_at: '2026-06-11T09:00:00Z',
  due_at: '2026-06-13T17:00:00Z',
  intent_key: 'intake_triage:case_8af3c1',
  handler_key: null,
  attempt_count: 0,
};

console.log('=== CaseSchema ===');
check('parses a proposed case', () => CaseSchema.parse(sampleCase));
check('rejects unknown case_status', () => {
  const bad = { ...sampleCase, case_status: 'whatever' as 'proposed' };
  const r = CaseSchema.safeParse(bad);
  if (r.success) throw new Error('should have failed');
});
check('accepts accepted/overridden/completed status', () => {
  CaseSchema.parse({ ...sampleCase, case_status: 'accepted' });
  CaseSchema.parse({ ...sampleCase, case_status: 'overridden' });
  CaseSchema.parse({ ...sampleCase, case_status: 'completed' });
});

console.log('\n=== EngineTaskSchema ===');
check('parses an open intake_triage task', () => EngineTaskSchema.parse(sampleTask));
check('parses all 11 task types', () => {
  for (const tt of [
    'intake_triage', 'portal_status_check', 'payer_call',
    'coding_review', 'coding_feedback_review', 'resolution_action',
    'awaiting_payer_check', 'am_review', 'posting_apply',
    'bank_rec_match', 'high_dollar_oversight',
  ] as const) {
    EngineTaskSchema.parse({ ...sampleTask, task_type: tt });
  }
});
check('parses a personal-queue task (user_42)', () => {
  EngineTaskSchema.parse({ ...sampleTask, queue_id: 'user_42' });
});

console.log('\n=== QueueSchema ===');
check('parses a team queue', () => {
  QueueSchema.parse({
    queue_id: 'denial_intake_analyst_primrose',
    queue_label: 'Denial Intake — Primrose',
    queue_type: 'team',
    is_default_for_caller: true,
    pending_count: 47,
  });
});
check('parses a personal queue', () => {
  QueueSchema.parse({
    queue_id: 'user_42',
    queue_label: 'My personal queue',
    queue_type: 'personal',
    is_default_for_caller: false,
    pending_count: 3,
  });
});

console.log('\n=== WorklistRow + Response ===');
check('parses a row with current_task populated', () => {
  WorklistRowSchema.parse({ case: sampleCase, current_task: sampleTask });
});
check('parses a row with null current_task (completed case)', () => {
  WorklistRowSchema.parse({
    case: { ...sampleCase, case_status: 'completed' },
    current_task: null,
  });
});
check('parses a full worklist response', () => {
  WorklistResponseSchema.parse({
    rows: [{ case: sampleCase, current_task: sampleTask }],
    page: 1,
    page_size: 50,
    has_more: true,
  });
});

console.log('\n=== WorklistRequest ===');
check('parses minimal request (just queue_id)', () => {
  const r = WorklistRequestSchema.parse({ queue_id: 'denial_intake_analyst_primrose' });
  if (r.page !== 1 || r.page_size !== 50) throw new Error('defaults wrong');
});
check('parses needs_my_review shorthand', () => {
  WorklistRequestSchema.parse({
    queue_id: 'user_42',
    needs_my_review: true,
    case_status: ['accepted', 'overridden'],
    priority: 'high',
    net_pending_min: 750,
  });
});

console.log('\n=== Task fact schemas (all 11) ===');
check('intake_triage facts parse + reject bad route', () => {
  const facts: TaskFacts<'intake_triage'> = {
    triage_category: 'medical_necessity',
    priority: 'normal',
    triage_route: 'resolution',
  };
  TaskFactsByType.intake_triage.parse(facts);
  const bad = { ...facts, triage_route: 'nonsense' };
  const r = TaskFactsByType.intake_triage.safeParse(bad);
  if (r.success) throw new Error('should reject bad route');
});
check('coding_review facts parse', () => {
  TaskFactsByType.coding_review.parse({
    cpt_corrected: true,
    modifier_changed: false,
    dx_adequate: true,
    recommendation: 'proceed',
  });
});
check('payer_call facts parse', () => {
  TaskFactsByType.payer_call.parse({
    call_reference_number: 'REF-12345',
    payer_status: 'pending_adjudication',
    callback_required: false,
  });
});
check('all other 8 fact schemas parse minimal valid payloads', () => {
  TaskFactsByType.portal_status_check.parse({
    portal_status: 'pending', reference_number: null, screenshot_attached: false,
  });
  TaskFactsByType.resolution_action.parse({
    action_type: 'appeal', submitted_at: '2026-06-11T17:00:00Z', confirmation_number: null,
  });
  TaskFactsByType.coding_feedback_review.parse({ selected_action: 'proceed' });
  TaskFactsByType.awaiting_payer_check.parse({ response_received: false, response_details: null });
  TaskFactsByType.am_review.parse({ final_decision: 'approve', escalation_note: null });
  TaskFactsByType.posting_apply.parse({ posting_confirmed: true });
  TaskFactsByType.bank_rec_match.parse({ match_confirmed: true });
  TaskFactsByType.high_dollar_oversight.parse({
    reviewed_at: '2026-06-11T17:00:00Z', oversight_note: null,
  });
});

console.log('\n=== CaseDetail ===');
check('parses a full CaseDetail (Case + engine + claim + financial)', () => {
  CaseDetailSchema.parse({
    ...sampleCase,
    case_status: 'accepted',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    originated_at: '2026-06-11T09:30:00Z',
    workflow_name: 'medical_necessity_resolution',
    engine_state_code: 'INTAKE_TRIAGE_OPEN',
    engine_tasks_open: [sampleTask],
    engine_tasks_recent: [],
    facility_name: 'LSAT Outpatient',
    facility_id: 'fac_34',
    provider_name: 'Dr. M. Patel',
    icd_codes: ['J45.20', 'J30.1'],
    payer_id: 'pay_humana_gp',
    payer_alias: 'Humana GP',
    billed: 250.0,
    paid_primary: 0.0,
    paid_secondary: 0.0,
    paid_tertiary: 0.0,
    paid_patient: 20.0,
    pending_primary: 230.0,
    pending_secondary: 0.0,
    pending_tertiary: 0.0,
  });
});

console.log('\n=== TasksMineRequest ===');
check('parses minimal request', () => {
  const r = TasksMineRequestSchema.parse({});
  if (r.page !== 1) throw new Error('defaults wrong');
});

console.log('\n=== HandlerOutcome ===');
check('accepts SUCCESS / NEEDS_INFO / FAIL_FATAL', () => {
  HandlerOutcomeSchema.parse('SUCCESS');
  HandlerOutcomeSchema.parse('NEEDS_INFO');
  HandlerOutcomeSchema.parse('FAIL_FATAL');
});
check('rejects internal-only outcomes (NEEDS_HUMAN, etc.)', () => {
  const r = HandlerOutcomeSchema.safeParse('NEEDS_HUMAN');
  if (r.success) throw new Error('should reject');
});

console.log('\n=== Type guards ===');
check('isCaseProposed / InFlight / Completed', () => {
  if (!isCaseProposed({ case_status: 'proposed' })) throw new Error('1');
  if (isCaseProposed({ case_status: 'accepted' })) throw new Error('2');
  if (!isCaseInFlight({ case_status: 'accepted' })) throw new Error('3');
  if (!isCaseInFlight({ case_status: 'overridden' })) throw new Error('4');
  if (isCaseInFlight({ case_status: 'completed' })) throw new Error('5');
});
check('isReviewTask matches user_* queues', () => {
  if (!isReviewTask({ queue_id: 'user_42' })) throw new Error('1');
  if (isReviewTask({ queue_id: 'denial_intake_analyst_primrose' })) throw new Error('2');
});

console.log('\n=== CaseStatusSchema enum coverage ===');
check('CaseStatusSchema accepts all 4 documented values', () => {
  for (const s of ['proposed', 'accepted', 'overridden', 'completed']) {
    CaseStatusSchema.parse(s);
  }
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
