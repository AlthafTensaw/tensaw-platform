/**
 * Runtime sanity check for schemas.ts (engine-handler model).
 * NOT a test suite — verifies each schema parses a realistic payload + the
 * task-type registry is exhaustive.
 * Run with: npx tsx scripts/sanity-check-schemas.ts
 */

import {
  TaskTypeSchema,
  TeamSchema,
  TaskStatusSchema,
  PrioritySchema,
  CaseContextSchema,
  CaseFactsSchema,
  ClaimSummarySchema,
  WorklistTaskSchema,
  WorklistRequestSchema,
  WorklistResponseSchema,
  HandlerOutcomeSchema,
  TaskCompleteRequestSchema,
  TaskFactsByType,
  CaseDetailSchema,
  TEAM_LABELS,
  TASK_TYPE_DEFAULT_TEAM,
  type WorklistTask,
  type TaskType,
  type Team,
} from '../src/actions/schemas';

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
// Fixtures
// ============================================================================

// The §4 sample row, verbatim shape
const sampleRow: WorklistTask = {
  task_id: '01HG7K9R',
  case_id: 'C-DENIAL-1234',
  task_type: 'ANALYST_TRIAGE_DENIAL',
  status: 'OPEN',
  priority: 'normal',
  team: 'denial_intake_analyst',
  dispatched_at: '2026-06-14T10:00:00Z',
  case_context: {
    case_type: 'DENIAL',
    state_code: 'TRIAGE',
    task_type: 'ANALYST_TRIAGE_DENIAL',
    clinic_id: 'clinic-001',
    payer_id: 'AETNA',
  },
  case_facts: {
    is_high_dollar: true,
    clarification_type: 'AUTHORIZATION',
    appeal_policy: 'ONE_APPEAL',
  },
  claim_summary: {
    claim_id: 300138,
    patient_name: 'Henderson, Joel',
    mrn: '72834',
    dos: '2026-05-03',
    net_pending: '840.00',
    aging_bucket: '0-29 day',
    primary_payer_name: 'Humana MA',
    clinic_name: 'Cardiology Associates of Houston',
  },
};

// ============================================================================
// Enums
// ============================================================================

console.log('=== Enums ===');

check('TaskTypeSchema has exactly 17 human task types', () => {
  assert(TaskTypeSchema.options.length === 17, `expected 17, got ${TaskTypeSchema.options.length}`);
});

check('FAX_FACILITY_BATCH is NOT a task type (automated, never in worklist)', () => {
  assert(
    !(TaskTypeSchema.options as string[]).includes('FAX_FACILITY_BATCH'),
    'FAX_FACILITY_BATCH should not be in the FE task-type enum',
  );
});

check('TeamSchema covers the named team queues', () => {
  assert(TeamSchema.options.includes('denial_intake_analyst'), 'missing denial_intake_analyst');
  assert(TeamSchema.options.includes('emr_support'), 'missing emr_support (Bhavana)');
  assert(TeamSchema.options.includes('coding'), 'missing coding');
});

check('No personal queue concept (team enum has no user_ entries)', () => {
  const hasPersonal = (TeamSchema.options as string[]).some((t) => t.startsWith('user_'));
  assert(!hasPersonal, 'team enum should not contain personal user_<id> queues');
});

check('TaskStatusSchema = OPEN | PARKED | COMPLETED', () => {
  assert(TaskStatusSchema.options.length === 3, 'expected 3 statuses');
  assert(TaskStatusSchema.safeParse('OPEN').success, 'OPEN should parse');
});

check('PrioritySchema = high | normal | low', () => {
  assert(PrioritySchema.options.length === 3, 'expected 3 priorities');
});

// ============================================================================
// Row sub-shapes
// ============================================================================

console.log('\n=== Row sub-shapes ===');

check('CaseContextSchema parses + tolerates extra fields (passthrough)', () => {
  const r = CaseContextSchema.parse({
    ...sampleRow.case_context,
    some_future_field: 'x',
  });
  assert((r as Record<string, unknown>).some_future_field === 'x', 'passthrough should keep unknown keys');
});

check('CaseFactsSchema requires is_high_dollar, tolerates the rest', () => {
  CaseFactsSchema.parse({ is_high_dollar: false });
  const bad = CaseFactsSchema.safeParse({ clarification_type: 'X' }); // missing is_high_dollar
  assert(!bad.success, 'is_high_dollar should be required');
});

check('CaseFactsSchema passthrough keeps unknown facts', () => {
  const r = CaseFactsSchema.parse({ is_high_dollar: true, novel_fact: 42 });
  assert((r as Record<string, unknown>).novel_fact === 42, 'unknown facts should survive');
});

check('ClaimSummarySchema treats net_pending as a STRING', () => {
  ClaimSummarySchema.parse(sampleRow.claim_summary);
  const bad = ClaimSummarySchema.safeParse({ ...sampleRow.claim_summary, net_pending: 840 });
  assert(!bad.success, 'net_pending must be a string, not a number');
});

// ============================================================================
// WorklistTask + request/response
// ============================================================================

console.log('\n=== WorklistTask ===');

check('WorklistTaskSchema parses the §4 sample row', () => {
  WorklistTaskSchema.parse(sampleRow);
});

check('WorklistRequestSchema has no queue_id requirement, no needs_my_review', () => {
  // team is optional (defaults server-side); empty request is valid
  WorklistRequestSchema.parse({});
  const shape = WorklistRequestSchema.shape as Record<string, unknown>;
  assert(!('queue_id' in shape), 'queue_id should not exist on the request');
  assert(!('needs_my_review' in shape), 'needs_my_review should not exist');
});

check('WorklistRequestSchema supports is_high_dollar filter + cascade fields', () => {
  WorklistRequestSchema.parse({
    team: 'coding',
    task_type: ['CODER_REVIEW_RECORD'],
    is_high_dollar: true,
    clinic_id: 'clinic-001',
    primary_payer_id: 'AETNA',
    page: 2,
  });
});

check('WorklistResponseSchema has exact total (DB-backed pagination)', () => {
  const r = WorklistResponseSchema.parse({
    rows: [sampleRow],
    page: 1,
    page_size: 50,
    total: 137,
    has_more: true,
  });
  assert(r.total === 137, 'total should be exact');
});

// ============================================================================
// Outcomes + completion
// ============================================================================

console.log('\n=== Outcomes ===');

check('HandlerOutcomeSchema = SUCCESS | NEEDS_INFO | FAIL_FATAL only', () => {
  assert(HandlerOutcomeSchema.options.length === 3, 'expected exactly 3 outcomes');
  assert(!HandlerOutcomeSchema.safeParse('RETRY_LATER').success, 'RETRY_LATER must not be FE-sendable');
  assert(!HandlerOutcomeSchema.safeParse('NEEDS_HUMAN').success, 'NEEDS_HUMAN must not be FE-sendable');
});

check('TaskCompleteRequestSchema matches the §3 body shape', () => {
  TaskCompleteRequestSchema.parse({
    outcome: 'SUCCESS',
    facts_to_set: { lcd_verified: true, appeal_method: 'PORTAL' },
    completion_note: 'Confirmed LCD; appeal package attached.',
  });
});

// ============================================================================
// Task fact schemas — all 17
// ============================================================================

console.log('\n=== Task fact schemas (17) ===');

const factSamples: Record<TaskType, unknown> = {
  ANALYST_TRIAGE_DENIAL: {
    clarification_type: 'AUTHORIZATION',
    is_high_dollar: true,
    appeal_policy: 'ONE_APPEAL',
    direct_facility_access: false,
    fax_number_on_file: true,
  },
  ANALYST_INVESTIGATE_ROOT_CAUSE: { root_cause: 'auth not on file', route_to_caller: false },
  CALLER_GET_DENIAL_REASON: { call_reference_number: 'CALL-887234', root_cause: 'auth required' },
  PORTAL_CHECK_STATUS: { portal_status: 'in_review', portal_detail: null },
  BHAVANA_PULL_EMR: { emr_item_found: true, unavailable_reason: null },
  ANALYST_PATIENT_OUTREACH: { outreach_method: 'call', outreach_result: 'info_obtained', outreach_note: null },
  COORDINATOR_FACILITY_CONTACT: { contact_result: 'reached', contact_note: null },
  CODER_REVIEW_RECORD: {
    cpt_verified: true, dx_verified: true, modifier_verified: false,
    recommendation: 'appeal', coder_note: null,
  },
  RESOLUTION_REFILE_CLAIM: { refiled_content: 'corrected CPT', submission_method: 'PORTAL', tracking_number: 'RF-001' },
  RESOLUTION_FILE_APPEAL: { appeal_level: 1, evidence_attached: true, submission_method: 'FAX', tracking_number: 'AP-001' },
  ANALYST_AWAIT_PAYER_RESPONSE: { response_received: true, payer_decision: 'paid', response_note: null },
  AM_DECIDE_DISPOSITION: { disposition: 'escalate', disposition_note: null },
  POSTING_VALIDATE_PAYMENT: { prior_payment_verified: true, recoupment_checked: false },
  DEMO_RETRIEVE_ID: { id_type: 'medicare', id_value: '1EG4-TE5-MK72' },
  CZAR_VERIFY_CREDENTIALING: { credentialing_status: 'data_lag', npi_or_taxonomy: '1234567890' },
  LIAISON_EXTERNAL_ESCALATION: { escalation_result: 'submitted', escalation_note: null },
  BILLING_PROCESS_DISPOSITION: { disposition_applied: 'write_off', billing_note: null },
};

for (const taskType of TaskTypeSchema.options) {
  check(`${taskType} fact schema parses`, () => {
    const schema = TaskFactsByType[taskType];
    schema.parse(factSamples[taskType]);
  });
}

check('TaskFactsByType is exhaustive over TaskTypeSchema', () => {
  const registryKeys = Object.keys(TaskFactsByType).sort();
  const enumKeys = [...TaskTypeSchema.options].sort();
  assert(
    JSON.stringify(registryKeys) === JSON.stringify(enumKeys),
    `registry/enum mismatch:\n  registry: ${registryKeys.join(',')}\n  enum:     ${enumKeys.join(',')}`,
  );
});

// ============================================================================
// CaseDetail
// ============================================================================

console.log('\n=== CaseDetail ===');

check('CaseDetailSchema parses + has NO case_status field', () => {
  const detail = {
    case_id: 'C-DENIAL-1234',
    state_code: 'TRIAGE',
    open_task_ids: ['01HG7K9R'],
    case_facts: { is_high_dollar: true },
    recommended_category: 'medical_necessity',
    recommended_confidence: 0.92,
    recommended_reasoning: 'CO-50 pattern',
    classified_at: '2026-06-12T10:00:00Z',
    tool_version: 'phase1-0.1.0',
    claim_id: 300138,
    patient_name: 'Henderson, Joel',
    mrn: '72834',
    dos: '2026-05-03',
    facility_name: 'CAH',
    facility_id: 'fac-1',
    provider_name: 'Dr. Patel',
    icd_codes: ['J45.20'],
    primary_payer_name: 'Humana MA',
    primary_payer_id: 'HUM',
    clinic_name: 'CAH',
    clinic_id: 'clinic-001',
    aging_bucket: '0-29 day',
    billed: '4200.00',
    net_pending: '840.00',
    paid_primary: '360.00',
    paid_secondary: '0.00',
    paid_tertiary: '0.00',
    paid_patient: '0.00',
    pending_primary: '840.00',
    pending_secondary: '0.00',
    pending_tertiary: '0.00',
    created_at: '2026-06-12T10:00:00Z',
    updated_at: '2026-06-12T10:00:00Z',
  };
  const parsed = CaseDetailSchema.parse(detail);
  assert(!('case_status' in parsed), 'CaseDetail must not carry a case_status lifecycle field');
});

// ============================================================================
// Label / team maps
// ============================================================================

console.log('\n=== Maps ===');

check('TEAM_LABELS covers every Team', () => {
  for (const team of TeamSchema.options) {
    assert(typeof TEAM_LABELS[team as Team] === 'string', `missing label for ${team}`);
  }
});

check('TASK_TYPE_DEFAULT_TEAM covers every TaskType + maps to a valid Team', () => {
  for (const tt of TaskTypeSchema.options) {
    const team = TASK_TYPE_DEFAULT_TEAM[tt as TaskType];
    assert(TeamSchema.safeParse(team).success, `${tt} maps to invalid team ${team}`);
  }
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
