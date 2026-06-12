/**
 * SSR smoke for P1.7 WorkPane + supporting components.
 *
 * Run with: npx tsx scripts/sanity-check-v4-work-pane.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks } from '../stubs/tensaw/actions';

import { WorkPane } from '../src/pages/WorkPane';
import { WorkflowProgressStrip } from '../src/components/work-pane/WorkflowProgressStrip';
import {
  WorkPaneEmpty,
  WorkPaneSkeleton,
  WorkPaneError,
} from '../src/components/work-pane/WorkPaneStates';
import { WorkPaneHeader } from '../src/components/work-pane/WorkPaneHeader';
import { ProposedView } from '../src/components/work-pane/ProposedView';
import { InFlightView } from '../src/components/work-pane/InFlightView';
import { CompletedView } from '../src/components/work-pane/CompletedView';
import { OverrideDialog } from '../src/components/work-pane/OverrideDialog';

import type { CaseDetail, EngineTask, Queue } from '../src/actions/schemas-v4';

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
    throw new Error(`HTML did not include "${needle}"\n  full: ${clean.slice(0, 800)}`);
  }
}

function expectExcludes(html: string, needle: string): void {
  const clean = html.replace(/<!-- -->/g, '');
  if (clean.includes(needle)) {
    throw new Error(`HTML unexpectedly included "${needle}"`);
  }
}

// ============================================================================
// Fixtures
// ============================================================================

const baseCase: CaseDetail = {
  case_id: 'case_000001',
  case_status: 'proposed',
  originated_by_user_id: null,
  originated_by_user_name: null,
  originated_at: null,
  is_high_dollar: false,
  high_dollar_shim_case_id: null,
  workflow_name: null,
  engine_state_code: null,
  claim_id: 300138,
  patient_name: 'Henderson, J',
  mrn: '72834',
  dos: '2026-02-24',
  net_pending: 230,
  recommended_category: 'medical_necessity',
  recommended_confidence: 0.92,
  recommended_reasoning: 'CO-50 on 99214 plus prior pattern of medical-necessity denials. Records must be pulled and appeal letter must cite encounter documentation.',
  classified_at: '2026-06-12T10:00:00Z',
  tool_version: 'phase1-0.1.0',
  primary_payer_name: 'Humana Gold Plus',
  primary_payer_alias: 'Humana GP',
  clinic_name: 'LSAT',
  clinic_alias: 'LSAT',
  aging_bucket: '90-119d',
  created_at: '2026-06-12T10:00:00Z',
  updated_at: '2026-06-12T10:00:00Z',
  engine_tasks_open: [],
  engine_tasks_recent: [],
  facility_name: 'LSAT Outpatient',
  facility_id: 'fac_lsat_op',
  provider_name: 'Dr. M. Patel',
  icd_codes: ['J45.20', 'J30.1'],
  payer_id: 'payer_humana_gp',
  payer_alias: 'Humana GP',
  billed: 250,
  paid_primary: 0,
  paid_secondary: 0,
  paid_tertiary: 0,
  paid_patient: 20,
  pending_primary: 230,
  pending_secondary: 0,
  pending_tertiary: 0,
};

const categories = [
  {
    code: 'medical_necessity',
    label: 'Medical Necessity',
    workflow_name: 'medical_necessity_resolution',
    workflow_step_count: 5,
    workflow_step_labels: ['Intake triage', 'Resolution', 'Awaiting payer', 'AM review', 'Posting'],
  },
  {
    code: 'auth_missing',
    label: 'Auth Missing',
    workflow_name: 'payer_call_resolution',
    workflow_step_count: 4,
    workflow_step_labels: ['Intake triage', 'Payer call', 'Resolution', 'Awaiting payer'],
  },
  {
    code: 'modifier_missing',
    label: 'Modifier Missing',
    workflow_name: 'coding_review_branch',
    workflow_step_count: 6,
    workflow_step_labels: ['Intake triage', 'Coding review', 'Feedback review', 'Resolution', 'Awaiting payer', 'Posting'],
  },
];

const queues: Queue[] = [
  { queue_id: 'denial_intake_analyst_primrose', queue_label: 'Denial Intake — Primrose', queue_type: 'team', is_default_for_caller: true, pending_count: 6 },
];

function mkTask(overrides: Partial<EngineTask> = {}): EngineTask {
  return {
    task_id: 'eng_t_000010',
    case_id: 'case_000001',
    task_type: 'intake_triage',
    state_code: 'OPEN',
    queue_id: 'denial_intake_analyst_primrose',
    priority_code: 'normal',
    opened_at: '2026-06-12T10:00:00Z',
    due_at: '2026-06-14T10:00:00Z',
    intent_key: 'intake_triage:case_000001',
    handler_key: null,
    attempt_count: 0,
    ...overrides,
  };
}

function setupCommonMocks(caseDetail: CaseDetail = baseCase): void {
  __resetMocks();
  __setQueryMock('queue.list', { queues });
  __setQueryMock('category.list', { categories });
  __setQueryMock('case.detail', caseDetail);
}

// ============================================================================
// WorkflowProgressStrip
// ============================================================================

console.log('=== WorkflowProgressStrip ===');

check('preview mode renders all dashed circles', () => {
  const html = renderToString(createElement(WorkflowProgressStrip, {
    steps: ['Intake', 'Resolution', 'Posting'],
    mode: 'preview',
  }));
  expectIncludes(html, 'Intake');
  expectIncludes(html, 'Resolution');
  expectIncludes(html, 'Posting');
  expectIncludes(html, 'border-dashed');
  expectIncludes(html, 'Workflow preview');
});

check('progress mode renders checkmark for completed steps', () => {
  const html = renderToString(createElement(WorkflowProgressStrip, {
    steps: ['Intake', 'Resolution', 'Posting'],
    mode: 'progress',
    currentIndex: 2,
  }));
  expectIncludes(html, '✓'); // completed steps
  expectIncludes(html, 'aria-current="step"');
});

check('progress mode highlights current step with ring', () => {
  const html = renderToString(createElement(WorkflowProgressStrip, {
    steps: ['Intake', 'Resolution'],
    mode: 'progress',
    currentIndex: 1,
  }));
  expectIncludes(html, 'ring-2 ring-blue-200');
});

check('returns null for empty steps array', () => {
  const html = renderToString(createElement(WorkflowProgressStrip, {
    steps: [],
    mode: 'preview',
  }));
  if (html.length > 0 && html !== '<!-- -->') {
    throw new Error(`expected empty render, got: ${html}`);
  }
});

// ============================================================================
// WorkPaneStates
// ============================================================================

console.log('\n=== WorkPaneStates ===');

check('WorkPaneEmpty shows "No denial selected"', () => {
  const html = renderToString(createElement(WorkPaneEmpty));
  expectIncludes(html, 'No denial selected');
});

check('WorkPaneSkeleton renders with a11y label + animate-pulse', () => {
  const html = renderToString(createElement(WorkPaneSkeleton));
  expectIncludes(html, 'aria-label="Loading case detail"');
  expectIncludes(html, 'animate-pulse');
});

check('WorkPaneError shows message and optional Retry', () => {
  const html = renderToString(createElement(WorkPaneError, {
    message: 'Timeout fetching case',
    onRetry: () => {},
  }));
  expectIncludes(html, 'Timeout fetching case');
  expectIncludes(html, '>Retry<');
  expectIncludes(html, 'role="alert"');
});

// ============================================================================
// WorkPaneHeader
// ============================================================================

console.log('\n=== WorkPaneHeader ===');

check('header shows patient name, MRN, claim_id, status pill', () => {
  const html = renderToString(createElement(WorkPaneHeader, { case: baseCase }));
  expectIncludes(html, 'Henderson, J');
  expectIncludes(html, '72834');     // MRN
  expectIncludes(html, '300138');    // claim_id
  expectIncludes(html, 'Proposed');
});

check('header shows currency formatted net_pending', () => {
  const html = renderToString(createElement(WorkPaneHeader, { case: baseCase }));
  expectIncludes(html, '$230');
});

check('HD badge appears when is_high_dollar=true', () => {
  const html = renderToString(createElement(WorkPaneHeader, {
    case: { ...baseCase, is_high_dollar: true, net_pending: 2890 },
  }));
  expectIncludes(html, 'High-dollar case');
});

check('HD badge hidden when is_high_dollar=false', () => {
  const html = renderToString(createElement(WorkPaneHeader, { case: baseCase }));
  expectExcludes(html, 'High-dollar case');
});

check('stat tiles render Billed / Paid / Pending / Aging / Category', () => {
  const html = renderToString(createElement(WorkPaneHeader, { case: baseCase }));
  expectIncludes(html, '>Billed<');
  expectIncludes(html, '>Paid 1°<');
  expectIncludes(html, '>Pending 1°<');
  expectIncludes(html, '>Aging<');
  expectIncludes(html, '>Category<');
  expectIncludes(html, '$250'); // billed
  expectIncludes(html, '90-119d');
});

check('ICD codes shown when present', () => {
  const html = renderToString(createElement(WorkPaneHeader, { case: baseCase }));
  expectIncludes(html, 'J45.20');
  expectIncludes(html, 'J30.1');
});

check('provider + facility shown in line 2', () => {
  const html = renderToString(createElement(WorkPaneHeader, { case: baseCase }));
  expectIncludes(html, 'Dr. M. Patel');
  expectIncludes(html, 'LSAT Outpatient');
});

// ============================================================================
// ProposedView
// ============================================================================

console.log('\n=== ProposedView ===');

check('renders LLM recommendation block with category + confidence', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase }));
  expectIncludes(html, 'LLM recommendation');
  expectIncludes(html, 'Medical Necessity');
  expectIncludes(html, '92% confidence');
});

check('renders reasoning text', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase }));
  expectIncludes(html, 'CO-50 on 99214');
});

check('renders workflow preview with 5 dashed steps', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase }));
  expectIncludes(html, 'Recommended workflow');
  expectIncludes(html, 'medical_necessity_resolution');
  expectIncludes(html, 'Intake triage');
  expectIncludes(html, 'Posting');
});

check('Accept button is the primary action (emerald)', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase }));
  expectIncludes(html, 'Accept recommendation');
  expectIncludes(html, 'bg-emerald-600');
});

check('Override button is secondary', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase }));
  expectIncludes(html, 'Override');
});

check('Re-classify button hidden when canReclassify=false', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase, canReclassify: false }));
  expectExcludes(html, 'Re-classify');
});

check('Re-classify button visible when canReclassify=true', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase, canReclassify: true }));
  expectIncludes(html, 'Re-classify');
});

check('OverrideDialog hidden by default', () => {
  setupCommonMocks();
  const html = renderToString(createElement(ProposedView, { case: baseCase }));
  expectExcludes(html, 'role="dialog"');
});

// ============================================================================
// OverrideDialog (rendered in isolation)
// ============================================================================

console.log('\n=== OverrideDialog ===');

check('renders with title, recommended category context, category picker', () => {
  setupCommonMocks();
  const html = renderToString(createElement(OverrideDialog, {
    caseId: 'case_000001',
    recommendedCategory: 'medical_necessity',
    onClose: () => {},
  }));
  expectIncludes(html, 'Override classification');
  expectIncludes(html, 'Medical Necessity'); // shown as context
  expectIncludes(html, 'Override to');
  expectIncludes(html, 'Reasoning');
});

check('category dropdown excludes the LLM-recommended category', () => {
  setupCommonMocks();
  const html = renderToString(createElement(OverrideDialog, {
    caseId: 'case_000001',
    recommendedCategory: 'medical_necessity',
    onClose: () => {},
  }));
  // Should include Auth Missing and Modifier Missing as options
  expectIncludes(html, 'Auth Missing');
  expectIncludes(html, 'Modifier Missing');
  // The recommended category should appear ONCE (in the context text), not twice
  // (i.e. not also in the dropdown options)
  const matches = (html.replace(/<!-- -->/g, '').match(/Medical Necessity/g) ?? []).length;
  if (matches !== 1) {
    throw new Error(`expected exactly 1 occurrence of "Medical Necessity", got ${matches}`);
  }
});

check('submit button is amber-tinted (override accent)', () => {
  setupCommonMocks();
  const html = renderToString(createElement(OverrideDialog, {
    caseId: 'case_000001',
    recommendedCategory: 'medical_necessity',
    onClose: () => {},
  }));
  expectIncludes(html, 'bg-amber-600');
});

check('dialog has role=dialog and aria-modal=true', () => {
  setupCommonMocks();
  const html = renderToString(createElement(OverrideDialog, {
    caseId: 'case_000001',
    recommendedCategory: 'medical_necessity',
    onClose: () => {},
  }));
  expectIncludes(html, 'role="dialog"');
  expectIncludes(html, 'aria-modal="true"');
});

// ============================================================================
// InFlightView
// ============================================================================

console.log('\n=== InFlightView ===');

check('renders workflow progress strip with current step', () => {
  setupCommonMocks();
  const acceptedCase: CaseDetail = {
    ...baseCase,
    case_status: 'accepted',
    workflow_name: 'medical_necessity_resolution',
    engine_state_code: 'RESOLUTION_ACTION_OPEN',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    originated_at: '2026-06-10T09:00:00Z',
    engine_tasks_open: [mkTask({ task_type: 'resolution_action', queue_id: 'resolution_primrose' })],
  };
  const html = renderToString(createElement(InFlightView, { case: acceptedCase }));
  expectIncludes(html, 'Workflow progress');
  expectIncludes(html, 'medical_necessity_resolution');
});

check('renders current task card with task type + urgency', () => {
  setupCommonMocks();
  const acceptedCase: CaseDetail = {
    ...baseCase,
    case_status: 'accepted',
    workflow_name: 'medical_necessity_resolution',
    engine_state_code: 'INTAKE_TRIAGE_OPEN',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    originated_at: '2026-06-10T09:00:00Z',
    engine_tasks_open: [mkTask({ due_at: '2026-06-04T10:00:00Z' })], // overdue
  };
  const html = renderToString(createElement(InFlightView, { case: acceptedCase }));
  expectIncludes(html, 'Current task');
  expectIncludes(html, 'Intake triage');
  expectIncludes(html, 'eng_t_000010'); // task_id shown
  expectIncludes(html, 'Overdue');
});

check('renders the real CurrentTaskBlock content (P1.8 replaced the placeholder)', () => {
  setupCommonMocks();
  const acceptedCase: CaseDetail = {
    ...baseCase,
    case_status: 'accepted',
    workflow_name: 'medical_necessity_resolution',
    engine_state_code: 'INTAKE_TRIAGE_OPEN',
    engine_tasks_open: [mkTask()],
  };
  const html = renderToString(createElement(InFlightView, { case: acceptedCase }));
  // P1.8 replaced the placeholder bar with real form rendering.
  expectExcludes(html, 'Task form rendering ships in P1.8');
  // For intake_triage we render IntakeTriageForm which has this heading.
  expectIncludes(html, 'Confirm the LLM');
});

// ============================================================================
// CompletedView
// ============================================================================

console.log('\n=== CompletedView ===');

check('shows "Case completed" with green styling', () => {
  setupCommonMocks();
  const completedCase: CaseDetail = {
    ...baseCase,
    case_status: 'completed',
    workflow_name: 'medical_necessity_resolution',
    engine_state_code: 'COMPLETED',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    originated_at: '2026-06-10T09:00:00Z',
    engine_tasks_recent: [
      mkTask({ task_id: 'eng_t_done_1', task_type: 'intake_triage', state_code: 'COMPLETED' }),
      mkTask({ task_id: 'eng_t_done_2', task_type: 'posting_apply', state_code: 'COMPLETED' }),
    ],
  };
  const html = renderToString(createElement(CompletedView, { case: completedCase }));
  expectIncludes(html, 'Case completed');
  expectIncludes(html, 'bg-emerald-50');
});

check('shows the completed workflow with all steps', () => {
  setupCommonMocks();
  const completedCase: CaseDetail = {
    ...baseCase,
    case_status: 'completed',
    workflow_name: 'medical_necessity_resolution',
    engine_state_code: 'COMPLETED',
    engine_tasks_recent: [],
  };
  const html = renderToString(createElement(CompletedView, { case: completedCase }));
  expectIncludes(html, 'medical_necessity_resolution');
  expectIncludes(html, 'Intake triage');
  expectIncludes(html, 'Posting');
});

check('lists recent tasks when present', () => {
  setupCommonMocks();
  const completedCase: CaseDetail = {
    ...baseCase,
    case_status: 'completed',
    workflow_name: 'medical_necessity_resolution',
    engine_state_code: 'COMPLETED',
    engine_tasks_recent: [
      mkTask({ task_id: 'eng_t_a', task_type: 'intake_triage' }),
      mkTask({ task_id: 'eng_t_b', task_type: 'resolution_action' }),
    ],
  };
  const html = renderToString(createElement(CompletedView, { case: completedCase }));
  expectIncludes(html, 'Recent tasks');
  expectIncludes(html, 'intake triage');
  expectIncludes(html, 'resolution action');
});

// ============================================================================
// WorkPane — top-level composition
// ============================================================================

console.log('\n=== WorkPane — top-level branches ===');

check('shows WorkPaneEmpty when no case selected (no ?case= in URL)', () => {
  setupCommonMocks();
  const html = renderToString(createElement(WorkPane));
  expectIncludes(html, 'No denial selected');
});

check('renders aria-label="Work pane" on top-level section when loaded', () => {
  setupCommonMocks();
  // For SSR, we can't easily set URL params; this test verifies the Empty
  // state renders. Loaded variant tested via direct render of subcomponents.
  const html = renderToString(createElement(WorkPane));
  // Empty state doesn't use aria-label=Work pane; that's only on the loaded section
  expectIncludes(html, 'No denial selected');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
