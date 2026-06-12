/**
 * SSR smoke for P1.10 — the 10 remaining task forms + updated CurrentTaskBlock.
 *
 * Each form has 2-3 structural tests verifying its key elements render.
 * Plus a routing test ensuring every known task_type goes to its concrete form
 * (not the GenericTaskFallback).
 *
 * Run with: npx tsx scripts/sanity-check-v4-task-forms-all.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks, __setMutationMock } from '../stubs/tensaw/actions';

import { CodingReviewForm } from '../src/components/task-form/CodingReviewForm';
import { CodingFeedbackReviewForm } from '../src/components/task-form/CodingFeedbackReviewForm';
import { PayerCallForm } from '../src/components/task-form/PayerCallForm';
import { PortalStatusCheckForm } from '../src/components/task-form/PortalStatusCheckForm';
import { ResolutionActionForm } from '../src/components/task-form/ResolutionActionForm';
import { AwaitingPayerCheckForm } from '../src/components/task-form/AwaitingPayerCheckForm';
import { AMReviewForm } from '../src/components/task-form/AMReviewForm';
import { PostingApplyForm } from '../src/components/task-form/PostingApplyForm';
import { BankRecMatchForm } from '../src/components/task-form/BankRecMatchForm';
import { HighDollarOversightForm } from '../src/components/task-form/HighDollarOversightForm';
import { CurrentTaskBlock } from '../src/components/task-form/CurrentTaskBlock';

import type { CaseDetail, EngineTask, TaskType } from '../src/actions/schemas-v4';

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
  if (!clean.includes(needle)) {
    throw new Error(`HTML did not include "${needle}"\n  full: ${clean.slice(0, 700)}`);
  }
}

function expectExcludes(html: string, needle: string): void {
  const clean = html.replace(/<!-- -->/g, '');
  if (clean.includes(needle)) {
    throw new Error(`HTML unexpectedly included "${needle}"`);
  }
}

const baseCase: CaseDetail = {
  case_id: 'case_000001',
  case_status: 'accepted',
  originated_by_user_id: 42,
  originated_by_user_name: 'Vipin K.',
  originated_at: '2026-06-10T09:00:00Z',
  is_high_dollar: true,
  high_dollar_shim_case_id: null,
  workflow_name: 'medical_necessity_resolution',
  engine_state_code: 'INTAKE_TRIAGE_OPEN',
  claim_id: 300138,
  patient_name: 'Henderson, J',
  mrn: '72834',
  dos: '2026-02-24',
  net_pending: 2890,
  recommended_category: 'medical_necessity',
  recommended_confidence: 0.92,
  recommended_reasoning: '...',
  classified_at: '2026-06-12T10:00:00Z',
  tool_version: 'phase1-0.1.0',
  primary_payer_name: 'Cigna HealthSpring',
  primary_payer_alias: 'Cigna HS',
  clinic_name: 'PRIM_BHM',
  clinic_alias: 'PRIM_BHM',
  aging_bucket: '90-119d',
  created_at: '2026-06-12T10:00:00Z',
  updated_at: '2026-06-12T10:00:00Z',
  engine_tasks_open: [],
  engine_tasks_recent: [],
  facility_name: null,
  facility_id: null,
  provider_name: null,
  icd_codes: [],
  payer_id: 'payer_cigna_hs',
  payer_alias: 'Cigna HS',
  billed: 3000,
  paid_primary: 50,
  paid_secondary: 0,
  paid_tertiary: 0,
  paid_patient: 60,
  pending_primary: 2890,
  pending_secondary: 0,
  pending_tertiary: 0,
};

function mkTask(taskType: TaskType): EngineTask {
  return {
    task_id: `eng_t_${taskType}`,
    case_id: 'case_000001',
    task_type: taskType,
    state_code: 'OPEN',
    queue_id: 'denial_intake_analyst_primrose',
    priority_code: 'normal',
    opened_at: '2026-06-12T10:00:00Z',
    due_at: '2026-06-14T10:00:00Z',
    intent_key: `${taskType}:case_000001`,
    handler_key: null,
    attempt_count: 0,
  };
}

const categories = [
  {
    code: 'medical_necessity',
    label: 'Medical Necessity',
    workflow_name: 'medical_necessity_resolution',
    workflow_step_count: 5,
    workflow_step_labels: ['Intake', 'Resolution', 'Awaiting', 'AM review', 'Posting'],
  },
];

function setupMocks(): void {
  __resetMocks();
  __setQueryMock('category.list', { categories });
  __setMutationMock('task.complete', async () => ({ case: baseCase, next_task: null }));
}

// ============================================================================
// Per-form smoke tests
// ============================================================================

console.log('=== CodingReviewForm ===');

check('renders 3 boolean toggles + recommendation segmented control', () => {
  setupMocks();
  const html = renderToString(createElement(CodingReviewForm, {
    case: baseCase, task: mkTask('coding_review'),
  }));
  expectIncludes(html, 'Coding review');
  expectIncludes(html, 'CPT corrected?');
  expectIncludes(html, 'Modifier changed?');
  expectIncludes(html, 'Dx adequate?');
  expectIncludes(html, 'Recommendation');
  expectIncludes(html, '>Proceed<');
  expectIncludes(html, '>Reject<');
  expectIncludes(html, '>Escalate<');
});

check('SUCCESS button is "Return to originator", disabled until recommendation picked', () => {
  setupMocks();
  const html = renderToString(createElement(CodingReviewForm, {
    case: baseCase, task: mkTask('coding_review'),
  }));
  expectIncludes(html, 'Return to originator');
  expectIncludes(html, 'disabled=""');
});

console.log('\n=== CodingFeedbackReviewForm ===');

check('renders 3 route options (proceed/dispute/reroute)', () => {
  setupMocks();
  const html = renderToString(createElement(CodingFeedbackReviewForm, {
    case: baseCase, task: mkTask('coding_feedback_review'),
  }));
  expectIncludes(html, 'Coding feedback review');
  expectIncludes(html, 'Proceed');
  expectIncludes(html, 'Dispute');
  expectIncludes(html, 'Re-route');
});

check('Submit decision button disabled until action picked', () => {
  setupMocks();
  const html = renderToString(createElement(CodingFeedbackReviewForm, {
    case: baseCase, task: mkTask('coding_feedback_review'),
  }));
  expectIncludes(html, 'Submit decision');
  expectIncludes(html, 'disabled=""');
});

console.log('\n=== PayerCallForm ===');

check('renders reference / status / callback fields', () => {
  setupMocks();
  const html = renderToString(createElement(PayerCallForm, {
    case: baseCase, task: mkTask('payer_call'),
  }));
  expectIncludes(html, 'Payer call');
  expectIncludes(html, 'Call reference number');
  expectIncludes(html, 'What the payer said');
  expectIncludes(html, 'Callback required?');
});

check('mentions the payer alias in the description', () => {
  setupMocks();
  const html = renderToString(createElement(PayerCallForm, {
    case: baseCase, task: mkTask('payer_call'),
  }));
  expectIncludes(html, 'Cigna HS');
});

console.log('\n=== PortalStatusCheckForm ===');

check('renders status + reference + screenshot toggle', () => {
  setupMocks();
  const html = renderToString(createElement(PortalStatusCheckForm, {
    case: baseCase, task: mkTask('portal_status_check'),
  }));
  expectIncludes(html, 'Portal status check');
  expectIncludes(html, 'Portal status');
  expectIncludes(html, 'Reference number');
  expectIncludes(html, 'Screenshot attached?');
});

check('Reference and screenshot are not required', () => {
  setupMocks();
  const html = renderToString(createElement(PortalStatusCheckForm, {
    case: baseCase, task: mkTask('portal_status_check'),
  }));
  // The optional fields don't have a required asterisk. Just check the field renders.
  expectIncludes(html, 'Optional. Portal tracking ID if shown.');
});

console.log('\n=== ResolutionActionForm ===');

check('renders 4 action types in route grid', () => {
  setupMocks();
  const html = renderToString(createElement(ResolutionActionForm, {
    case: baseCase, task: mkTask('resolution_action'),
  }));
  expectIncludes(html, 'Resolution action');
  expectIncludes(html, '>Appeal<');
  expectIncludes(html, '>Refile<');
  expectIncludes(html, 'Corrected claim');
  expectIncludes(html, 'Reconsideration');
});

check('submitted_at pre-fills with current datetime', () => {
  setupMocks();
  const html = renderToString(createElement(ResolutionActionForm, {
    case: baseCase, task: mkTask('resolution_action'),
  }));
  // Format YYYY-MM-DDTHH:MM
  if (!/value="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"/.test(html)) {
    throw new Error('submitted_at not pre-filled with datetime-local string');
  }
});

console.log('\n=== AwaitingPayerCheckForm ===');

check('renders response received toggle', () => {
  setupMocks();
  const html = renderToString(createElement(AwaitingPayerCheckForm, {
    case: baseCase, task: mkTask('awaiting_payer_check'),
  }));
  expectIncludes(html, 'Awaiting payer response');
  expectIncludes(html, 'Response received?');
  expectIncludes(html, 'Not yet');
  expectIncludes(html, 'Yes, received');
});

check('response_details textarea is hidden until response_received=yes', () => {
  setupMocks();
  const html = renderToString(createElement(AwaitingPayerCheckForm, {
    case: baseCase, task: mkTask('awaiting_payer_check'),
  }));
  // Initial state: not picked, so response_details hidden
  expectExcludes(html, 'Response details');
});

console.log('\n=== AMReviewForm ===');

check('renders 3 decision options (approve/escalate/close)', () => {
  setupMocks();
  const html = renderToString(createElement(AMReviewForm, {
    case: baseCase, task: mkTask('am_review'),
  }));
  expectIncludes(html, 'AM review');
  expectIncludes(html, 'manager sign-off');
  expectIncludes(html, '>Approve<');
  expectIncludes(html, '>Escalate<');
  expectIncludes(html, '>Close<');
});

check('escalation_note textarea hidden until escalate is picked', () => {
  setupMocks();
  const html = renderToString(createElement(AMReviewForm, {
    case: baseCase, task: mkTask('am_review'),
  }));
  expectExcludes(html, 'Escalation note');
});

console.log('\n=== PostingApplyForm ===');

check('renders simple Yes/No toggle', () => {
  setupMocks();
  const html = renderToString(createElement(PostingApplyForm, {
    case: baseCase, task: mkTask('posting_apply'),
  }));
  expectIncludes(html, '>Posting<');
  expectIncludes(html, 'Payment applied?');
  expectIncludes(html, 'Yes, applied');
});

check('SUCCESS button is "Mark posted", disabled until Yes is picked', () => {
  setupMocks();
  const html = renderToString(createElement(PostingApplyForm, {
    case: baseCase, task: mkTask('posting_apply'),
  }));
  expectIncludes(html, 'Mark posted');
  expectIncludes(html, 'disabled=""');
});

console.log('\n=== BankRecMatchForm ===');

check('renders match confirmation toggle', () => {
  setupMocks();
  const html = renderToString(createElement(BankRecMatchForm, {
    case: baseCase, task: mkTask('bank_rec_match'),
  }));
  expectIncludes(html, 'Bank reconciliation match');
  expectIncludes(html, 'Match confirmed?');
  expectIncludes(html, 'Yes, matches');
});

console.log('\n=== HighDollarOversightForm ===');

check('renders HD badge + amber accent (sidecar visual)', () => {
  setupMocks();
  const html = renderToString(createElement(HighDollarOversightForm, {
    case: baseCase, task: mkTask('high_dollar_oversight'),
  }));
  expectIncludes(html, 'High-dollar oversight');
  expectIncludes(html, 'border-amber-300');
  expectIncludes(html, '>HD<');
});

check('SUCCESS button "Sign off" is enabled even without a note', () => {
  setupMocks();
  const html = renderToString(createElement(HighDollarOversightForm, {
    case: baseCase, task: mkTask('high_dollar_oversight'),
  }));
  expectIncludes(html, 'Sign off');
  // The HD oversight SUCCESS button should NOT be disabled in initial state
  // (note is optional; canSubmit=true always). Check that there's exactly one
  // button without disabled — the SUCCESS button. (Sub-button check.)
  // The form has one button total (SUCCESS), so no "disabled=\"\"" should be present.
  expectExcludes(html, 'disabled=""');
});

console.log('\n=== CurrentTaskBlock routing — exhaustive ===');

const ALL_TASK_TYPES: TaskType[] = [
  'intake_triage',
  'coding_review',
  'coding_feedback_review',
  'payer_call',
  'portal_status_check',
  'resolution_action',
  'awaiting_payer_check',
  'am_review',
  'posting_apply',
  'bank_rec_match',
  'high_dollar_oversight',
];

// Marker strings that uniquely identify each form's rendered output
const FORM_MARKERS: Record<TaskType, string> = {
  intake_triage: 'Confirm the LLM',
  coding_review: 'CPT corrected?',
  coding_feedback_review: 'Coding feedback review',
  payer_call: 'Call reference number',
  portal_status_check: 'Portal status check',
  resolution_action: 'What did you submit?',
  awaiting_payer_check: 'Awaiting payer response',
  am_review: 'manager sign-off',
  posting_apply: 'Payment applied?',
  bank_rec_match: 'Bank reconciliation match',
  high_dollar_oversight: 'High-dollar oversight',
};

for (const t of ALL_TASK_TYPES) {
  check(`routes ${t} to its concrete form (not GenericTaskFallback)`, () => {
    setupMocks();
    const html = renderToString(createElement(CurrentTaskBlock, {
      case: baseCase, task: mkTask(t),
    }));
    expectIncludes(html, FORM_MARKERS[t]);
    // GenericTaskFallback shouldn't appear anymore — its marker is
    // "Generic task form" (per the updated CurrentTaskBlock)
    expectExcludes(html, 'Generic task form');
  });
}

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
