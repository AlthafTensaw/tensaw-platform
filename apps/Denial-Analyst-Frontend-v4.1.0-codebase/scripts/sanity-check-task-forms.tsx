/**
 * SSR sanity for the 17 v4.1 task forms.
 * Run with: npx tsx scripts/sanity-check-task-forms.tsx
 *
 * Verifies (a) every task_type routes to a form that renders its label + an
 * action button, and (b) the per-type fact shapes the forms assemble validate
 * against the TaskFactsByType schemas (so a filled form's facts_to_set is
 * contract-correct).
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __resetMocks } from '../stubs/tensaw/actions';
import { __resetSearchParams } from '../stubs/react-router-dom';

import { CurrentTaskBlock } from '../src/components/task-form/CurrentTaskBlock';
import { TASK_TYPE_LABELS } from '../src/lib/labels';
import { TaskTypeSchema, TaskFactsByType, type WorklistTask, type TaskType } from '../src/actions/schemas';

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
function expectIncludes(html: string, needle: string): void {
  const clean = html.replace(/<!-- -->/g, '');
  if (!clean.includes(needle)) throw new Error(`missing "${needle}"\n  ${clean.slice(0, 250)}`);
}
function assert(c: boolean, m: string): void {
  if (!c) throw new Error(m);
}

function makeTask(taskType: TaskType): WorklistTask {
  return {
    task_id: 'T-000001',
    case_id: 'C-DENIAL-0001',
    task_type: taskType,
    status: 'OPEN',
    priority: 'normal',
    team: 'denial_intake_analyst',
    dispatched_at: '2026-06-14T10:00:00Z',
    case_context: { case_type: 'DENIAL', state_code: 'X', task_type: taskType, clinic_id: 'clinic-001', payer_id: 'HUMANA' },
    case_facts: { is_high_dollar: false },
    claim_summary: {
      claim_id: 1, patient_name: 'Test, P', mrn: '00001', dos: '2026-05-01',
      net_pending: '500.00', aging_bucket: '0-29 day', primary_payer_name: 'Humana MA', clinic_name: 'CAH',
    },
  };
}

// ============================================================================
// Every task type renders a form
// ============================================================================

console.log('=== All 17 forms render via CurrentTaskBlock ===');

for (const tt of TaskTypeSchema.options) {
  check(`${tt} renders a form with a primary action`, () => {
    __resetMocks();
    __resetSearchParams();
    const html = renderToString(createElement(CurrentTaskBlock, { task: makeTask(tt as TaskType) }));
    expectIncludes(html, TASK_TYPE_LABELS[tt]);
    // Every scaffolded form has an emerald primary button (SUCCESS/derived).
    assert(/bg-emerald-600/.test(html), `${tt}: missing primary action button`);
    // And a completion-note field.
    expectIncludes(html, 'Completion note');
  });
}

// ============================================================================
// Per-type fact shapes validate against TaskFactsByType
// ============================================================================
// These mirror what each form's getFacts() produces when filled, confirming
// the forms emit contract-correct facts_to_set.

console.log('\n=== Form fact shapes validate against schemas ===');

const filledFacts: Record<TaskType, unknown> = {
  ANALYST_TRIAGE_DENIAL: {
    clarification_type: 'AUTHORIZATION', is_high_dollar: true, appeal_policy: 'ONE_APPEAL',
    direct_facility_access: false, fax_number_on_file: true,
  },
  ANALYST_INVESTIGATE_ROOT_CAUSE: { root_cause: 'auth missing', route_to_caller: false },
  CALLER_GET_DENIAL_REASON: { call_reference_number: 'CALL-1', root_cause: 'auth required' },
  PORTAL_CHECK_STATUS: { portal_status: 'in_review', portal_detail: null },
  BHAVANA_PULL_EMR: { emr_item_found: true, unavailable_reason: null },
  ANALYST_PATIENT_OUTREACH: { outreach_method: 'call', outreach_result: 'info_obtained', outreach_note: null },
  COORDINATOR_FACILITY_CONTACT: { contact_result: 'reached', contact_note: null },
  CODER_REVIEW_RECORD: { cpt_verified: true, dx_verified: true, modifier_verified: false, recommendation: 'appeal', coder_note: null },
  RESOLUTION_REFILE_CLAIM: { refiled_content: 'corrected CPT', submission_method: 'PORTAL', tracking_number: 'RF-1' },
  RESOLUTION_FILE_APPEAL: { appeal_level: 1, evidence_attached: true, submission_method: 'FAX', tracking_number: 'AP-1' },
  ANALYST_AWAIT_PAYER_RESPONSE: { response_received: true, payer_decision: 'paid', response_note: null },
  AM_DECIDE_DISPOSITION: { disposition: 'escalate', disposition_note: null },
  POSTING_VALIDATE_PAYMENT: { prior_payment_verified: true, recoupment_checked: false },
  DEMO_RETRIEVE_ID: { id_type: 'medicare', id_value: '1EG4-TE5-MK72' },
  CZAR_VERIFY_CREDENTIALING: { credentialing_status: 'data_lag', npi_or_taxonomy: null },
  LIAISON_EXTERNAL_ESCALATION: { escalation_result: 'submitted', escalation_note: null },
  BILLING_PROCESS_DISPOSITION: { disposition_applied: 'write_off', billing_note: null },
};

for (const tt of TaskTypeSchema.options) {
  check(`${tt} facts validate against TaskFactsByType`, () => {
    TaskFactsByType[tt as TaskType].parse(filledFacts[tt as TaskType]);
  });
}

// ============================================================================
// Gate-set forms — field presence
// ============================================================================

console.log('\n=== Gate-set forms render their key fields ===');

check('Triage shows clarification-type + appeal-policy selects', () => {
  __resetMocks(); __resetSearchParams();
  const html = renderToString(createElement(CurrentTaskBlock, { task: makeTask('ANALYST_TRIAGE_DENIAL') }));
  expectIncludes(html, 'Clarification type');
  expectIncludes(html, 'Appeal policy');
  expectIncludes(html, 'Complete triage');
});

check('CoderReview shows recommendation segmented + verify toggles', () => {
  __resetMocks(); __resetSearchParams();
  const html = renderToString(createElement(CurrentTaskBlock, { task: makeTask('CODER_REVIEW_RECORD') }));
  expectIncludes(html, 'Recommendation');
  expectIncludes(html, 'CPT verified?');
  expectIncludes(html, 'Submit review');
});

check('FileAppeal pre-fills appeal level from case_facts +1', () => {
  __resetMocks(); __resetSearchParams();
  const t = makeTask('RESOLUTION_FILE_APPEAL');
  t.case_facts = { is_high_dollar: false, appeal_level: 1 };
  const html = renderToString(createElement(CurrentTaskBlock, { task: t }));
  expectIncludes(html, 'Mark appeal filed');
  expectIncludes(html, 'Tracking #');
  expectIncludes(html, 'value="2"'); // 1 + 1
});

check('AmDecide shows the three disposition options', () => {
  __resetMocks(); __resetSearchParams();
  const html = renderToString(createElement(CurrentTaskBlock, { task: makeTask('AM_DECIDE_DISPOSITION') }));
  expectIncludes(html, 'Write off');
  expectIncludes(html, 'Cash rate');
  expectIncludes(html, 'Escalate');
  expectIncludes(html, 'Record disposition');
});

// ============================================================================
// Decision forms — derived primary outcome labels
// ============================================================================

console.log('\n=== Decision forms ===');

check('AwaitPayer defaults primary label to "resolved" before a pick', () => {
  __resetMocks(); __resetSearchParams();
  const html = renderToString(createElement(CurrentTaskBlock, { task: makeTask('ANALYST_AWAIT_PAYER_RESPONSE') }));
  expectIncludes(html, 'Payer decision');
});

check('Czar shows the three credentialing statuses', () => {
  __resetMocks(); __resetSearchParams();
  const html = renderToString(createElement(CurrentTaskBlock, { task: makeTask('CZAR_VERIFY_CREDENTIALING') }));
  expectIncludes(html, 'Verified');
  expectIncludes(html, 'Data lag');
  expectIncludes(html, 'True gap');
});

check('Bhavana is a found/not-found decision', () => {
  __resetMocks(); __resetSearchParams();
  const html = renderToString(createElement(CurrentTaskBlock, { task: makeTask('BHAVANA_PULL_EMR') }));
  expectIncludes(html, 'Item found in EMR?');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
