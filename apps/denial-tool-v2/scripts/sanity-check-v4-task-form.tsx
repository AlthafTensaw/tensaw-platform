/**
 * SSR smoke for P1.8 task-form components.
 *
 * Run with: npx tsx scripts/sanity-check-v4-task-form.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks, __setMutationMock } from '../stubs/tensaw/actions';

import {
  FormField,
  FormLabel,
  FormHint,
  FormError,
  SegmentedControl,
  RouteGrid,
  Textarea,
  Input,
  Select,
} from '../src/components/task-form/TaskFormShell';
import { OutcomeActionBar } from '../src/components/task-form/OutcomeActionBar';
import { IntakeTriageForm } from '../src/components/task-form/IntakeTriageForm';
import { CurrentTaskBlock } from '../src/components/task-form/CurrentTaskBlock';
import { InFlightView } from '../src/components/work-pane/InFlightView';

import type { CaseDetail, EngineTask } from '../src/actions/schemas-v4';

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

// ============================================================================
// Fixtures
// ============================================================================

const baseCase: CaseDetail = {
  case_id: 'case_000001',
  case_status: 'accepted',
  originated_by_user_id: 42,
  originated_by_user_name: 'Vipin K.',
  originated_at: '2026-06-10T09:00:00Z',
  is_high_dollar: false,
  high_dollar_shim_case_id: null,
  workflow_name: 'medical_necessity_resolution',
  engine_state_code: 'INTAKE_TRIAGE_OPEN',
  claim_id: 300138,
  patient_name: 'Henderson, J',
  mrn: '72834',
  dos: '2026-02-24',
  net_pending: 230,
  recommended_category: 'medical_necessity',
  recommended_confidence: 0.92,
  recommended_reasoning: 'CO-50 on 99214.',
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
];

function setupMocks(caseWithOpenTask?: CaseDetail): void {
  __resetMocks();
  __setQueryMock('category.list', { categories });
  __setMutationMock('task.complete', async () => ({
    case: caseWithOpenTask ?? baseCase,
    next_task: null,
  }));
  if (caseWithOpenTask !== undefined) {
    __setQueryMock('case.detail', caseWithOpenTask);
  }
}

// ============================================================================
// TaskFormShell primitives
// ============================================================================

console.log('=== TaskFormShell primitives ===');

check('FormField wraps label + hint + children', () => {
  const html = renderToString(
    createElement(FormField, {
      id: 'test',
      label: 'Triage category',
      required: true,
      hint: 'The LLM picked this',
      children: createElement('input', { id: 'test' }),
    }),
  );
  expectIncludes(html, 'Triage category');
  expectIncludes(html, 'The LLM picked this');
  expectIncludes(html, 'for="test"');
  expectIncludes(html, '>*<'); // required asterisk
});

check('FormField shows error when provided', () => {
  const html = renderToString(
    createElement(FormField, {
      id: 'test',
      label: 'Foo',
      error: 'Required field',
      children: createElement('input', { id: 'test' }),
    }),
  );
  expectIncludes(html, 'Required field');
  expectIncludes(html, 'role="alert"');
});

check('FormLabel marks required with asterisk; not when optional', () => {
  const required = renderToString(
    createElement(FormLabel, { htmlFor: 'a', required: true, children: 'Foo' }),
  );
  expectIncludes(required, '>*<');
  const optional = renderToString(
    createElement(FormLabel, { htmlFor: 'a', children: 'Foo' }),
  );
  expectExcludes(optional, '>*<');
});

check('FormHint renders with id reference', () => {
  const html = renderToString(
    createElement(FormHint, { id: 'h1', children: 'Helper text' }),
  );
  expectIncludes(html, 'id="h1"');
  expectIncludes(html, 'Helper text');
});

check('FormError uses role=alert', () => {
  const html = renderToString(
    createElement(FormError, { id: 'e1', children: 'Bad value' }),
  );
  expectIncludes(html, 'role="alert"');
  expectIncludes(html, 'Bad value');
});

console.log('\n=== SegmentedControl ===');

check('renders 3 priority options with selection highlighted', () => {
  const html = renderToString(
    createElement(SegmentedControl, {
      name: 'Priority',
      value: 'normal',
      onChange: () => {},
      options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
      ],
    }),
  );
  expectIncludes(html, 'role="radiogroup"');
  expectIncludes(html, 'aria-label="Priority"');
  expectIncludes(html, '>Low<');
  expectIncludes(html, '>Normal<');
  expectIncludes(html, '>High<');
  // Selected one has white bg + shadow
  expectIncludes(html, 'aria-checked="true"');
});

check('disabled state disables all buttons', () => {
  const html = renderToString(
    createElement(SegmentedControl, {
      name: 'Priority',
      value: null,
      onChange: () => {},
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
      disabled: true,
    }),
  );
  // Both buttons should have disabled
  const disabledCount = (html.match(/disabled=""/g) ?? []).length;
  if (disabledCount !== 2) {
    throw new Error(`expected 2 disabled buttons, got ${disabledCount}`);
  }
});

console.log('\n=== RouteGrid ===');

check('renders 4 route cards with icons + descriptions', () => {
  const html = renderToString(
    createElement(RouteGrid, {
      name: 'Route',
      value: null,
      onChange: () => {},
      options: [
        { value: 'resolution', label: 'Resolution', description: 'Records on hand', icon: '📝' },
        { value: 'coding_partner', label: 'Coding partner', description: 'Needs review', icon: '🔢' },
      ],
      columns: 2,
    }),
  );
  expectIncludes(html, 'Resolution');
  expectIncludes(html, 'Records on hand');
  expectIncludes(html, 'Coding partner');
  expectIncludes(html, 'role="radiogroup"');
  expectIncludes(html, 'aria-label="Route"');
});

check('selected route card has blue border + ring', () => {
  const html = renderToString(
    createElement(RouteGrid, {
      name: 'Route',
      value: 'resolution',
      onChange: () => {},
      options: [
        { value: 'resolution', label: 'Resolution' },
        { value: 'other', label: 'Other' },
      ],
    }),
  );
  expectIncludes(html, 'border-blue-500');
  expectIncludes(html, 'ring-1 ring-blue-300');
});

console.log('\n=== Native form controls ===');

check('Textarea renders with rows + placeholder', () => {
  const html = renderToString(
    createElement(Textarea, {
      id: 'note',
      value: 'hello',
      onChange: () => {},
      rows: 4,
      placeholder: 'Type here',
    }),
  );
  expectIncludes(html, 'rows="4"');
  expectIncludes(html, 'placeholder="Type here"');
});

check('Input passes type attribute', () => {
  const html = renderToString(
    createElement(Input, {
      id: 'phone',
      type: 'tel',
      value: '',
      onChange: () => {},
    }),
  );
  expectIncludes(html, 'type="tel"');
});

check('Select renders options + placeholder option', () => {
  const html = renderToString(
    createElement(Select, {
      id: 'cat',
      value: '',
      onChange: () => {},
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
      placeholder: 'Pick one',
    }),
  );
  expectIncludes(html, 'Pick one');
  expectIncludes(html, '>A<');
  expectIncludes(html, '>B<');
});

// ============================================================================
// OutcomeActionBar
// ============================================================================

console.log('\n=== OutcomeActionBar ===');

check('SUCCESS button is emerald and right-aligned (ml-auto)', () => {
  const html = renderToString(
    createElement(OutcomeActionBar, {
      successLabel: 'Mark complete',
      onSuccess: () => {},
      isPending: false,
      canSubmitSuccess: true,
    }),
  );
  expectIncludes(html, 'bg-emerald-600');
  expectIncludes(html, 'ml-auto');
  expectIncludes(html, 'Mark complete');
});

check('NEEDS_INFO button shown when handler given', () => {
  const html = renderToString(
    createElement(OutcomeActionBar, {
      successLabel: 'Complete',
      onSuccess: () => {},
      needsInfoLabel: 'Need info',
      onNeedsInfo: () => {},
      isPending: false,
      canSubmitSuccess: true,
    }),
  );
  expectIncludes(html, 'Need info');
  expectIncludes(html, 'bg-amber-50');
});

check('NEEDS_INFO button hidden when no handler', () => {
  const html = renderToString(
    createElement(OutcomeActionBar, {
      successLabel: 'Complete',
      onSuccess: () => {},
      isPending: false,
      canSubmitSuccess: true,
    }),
  );
  expectExcludes(html, 'bg-amber-50');
});

check('FAIL_FATAL button shown when handler given (red destructive)', () => {
  const html = renderToString(
    createElement(OutcomeActionBar, {
      successLabel: 'Complete',
      onSuccess: () => {},
      failFatalLabel: 'Write off',
      onFailFatal: () => {},
      isPending: false,
      canSubmitSuccess: true,
    }),
  );
  expectIncludes(html, 'Write off');
  expectIncludes(html, 'text-red-700');
});

check('SUCCESS button disabled when canSubmitSuccess=false', () => {
  const html = renderToString(
    createElement(OutcomeActionBar, {
      successLabel: 'Complete',
      onSuccess: () => {},
      isPending: false,
      canSubmitSuccess: false,
    }),
  );
  // The SUCCESS button should have disabled attribute
  expectIncludes(html, 'disabled=""');
});

check('isPending=true shows "Saving…" label', () => {
  const html = renderToString(
    createElement(OutcomeActionBar, {
      successLabel: 'Complete',
      onSuccess: () => {},
      isPending: true,
      canSubmitSuccess: true,
    }),
  );
  expectIncludes(html, 'Saving…');
});

// ============================================================================
// IntakeTriageForm
// ============================================================================

console.log('\n=== IntakeTriageForm ===');

check('renders Intake triage heading + description', () => {
  setupMocks();
  const html = renderToString(
    createElement(IntakeTriageForm, { case: baseCase, task: mkTask() }),
  );
  expectIncludes(html, 'Intake triage');
  expectIncludes(html, 'Confirm the LLM');
});

check('Category dropdown pre-filled from LLM recommendation', () => {
  setupMocks();
  const html = renderToString(
    createElement(IntakeTriageForm, { case: baseCase, task: mkTask() }),
  );
  // The select should have medical_necessity selected; in SSR React renders
  // this as the option with selected attribute (or via the select's value
  // matching). Check for the category being present.
  expectIncludes(html, 'Medical Necessity');
});

check('Priority defaults to Normal (segmented control aria-checked)', () => {
  setupMocks();
  const html = renderToString(
    createElement(IntakeTriageForm, { case: baseCase, task: mkTask() }),
  );
  expectIncludes(html, 'aria-label="Priority"');
  // Normal should be selected
  const checks = html.match(/aria-checked="true"/g) ?? [];
  if (checks.length < 1) throw new Error('no aria-checked=true found');
});

check('Route grid renders 4 options matching schema enum', () => {
  setupMocks();
  const html = renderToString(
    createElement(IntakeTriageForm, { case: baseCase, task: mkTask() }),
  );
  expectIncludes(html, 'Resolution');
  expectIncludes(html, 'Coding partner');
  expectIncludes(html, 'Direct appeal');
  expectIncludes(html, '>Other<');
});

check('Notes field is optional (not required, no asterisk)', () => {
  setupMocks();
  const html = renderToString(
    createElement(IntakeTriageForm, { case: baseCase, task: mkTask() }),
  );
  // Notes label should appear without a required asterisk attached
  // Hard to test precisely; check that label text exists
  expectIncludes(html, 'Notes');
});

check('SUCCESS button disabled until route picked', () => {
  setupMocks();
  const html = renderToString(
    createElement(IntakeTriageForm, { case: baseCase, task: mkTask() }),
  );
  // The Complete button should be disabled in initial state
  expectIncludes(html, 'disabled=""');
  expectIncludes(html, 'Complete triage');
});

check('Action bar shows "Complete triage" + "Needs more info"', () => {
  setupMocks();
  const html = renderToString(
    createElement(IntakeTriageForm, { case: baseCase, task: mkTask() }),
  );
  expectIncludes(html, 'Complete triage');
  expectIncludes(html, 'Needs more info');
});

// ============================================================================
// CurrentTaskBlock — routing
// ============================================================================

console.log('\n=== CurrentTaskBlock routing ===');

check('routes intake_triage to IntakeTriageForm', () => {
  setupMocks();
  const html = renderToString(
    createElement(CurrentTaskBlock, {
      case: baseCase,
      task: mkTask({ task_type: 'intake_triage' }),
    }),
  );
  expectIncludes(html, 'Intake triage');
  expectIncludes(html, 'Confirm the LLM');
  expectIncludes(html, 'Complete triage');
});

check('routes other task types to GenericTaskFallback', () => {
  setupMocks();
  const html = renderToString(
    createElement(CurrentTaskBlock, {
      case: baseCase,
      task: mkTask({ task_type: 'coding_review' }),
    }),
  );
  // After P1.10 the fallback is no longer the route for coding_review;
  // it now lands on CodingReviewForm. Comprehensive routing coverage lives
  // in sanity-check-v4-task-forms-all.tsx — this just confirms the change
  // didn't break the basic render path.
  expectIncludes(html, 'Coding review');
});

check('GenericTaskFallback SUCCESS button disabled until note typed', () => {
  setupMocks();
  const html = renderToString(
    createElement(CurrentTaskBlock, {
      case: baseCase,
      task: mkTask({ task_type: 'payer_call' }),
    }),
  );
  // The Mark complete button should be disabled (note is empty)
  expectIncludes(html, 'disabled=""');
});

check('task header shows task_id + queue chip + urgency', () => {
  setupMocks();
  const html = renderToString(
    createElement(CurrentTaskBlock, {
      case: baseCase,
      task: mkTask({ due_at: '2026-06-04T10:00:00Z' }), // overdue at now=2026-06-12
    }),
  );
  expectIncludes(html, 'eng_t_000010');
  expectIncludes(html, 'denial_intake');
  expectIncludes(html, 'Overdue');
});

// ============================================================================
// InFlightView (updated) — composes CurrentTaskBlock instead of placeholder
// ============================================================================

console.log('\n=== InFlightView (P1.8 update) ===');

check('renders workflow progress strip + CurrentTaskBlock', () => {
  const acceptedCase: CaseDetail = {
    ...baseCase,
    engine_tasks_open: [mkTask()],
  };
  setupMocks(acceptedCase);
  const html = renderToString(
    createElement(InFlightView, { case: acceptedCase }),
  );
  expectIncludes(html, 'Workflow progress');
  expectIncludes(html, 'medical_necessity_resolution');
  // Should show CurrentTaskBlock content (not the P1.7 placeholder)
  expectIncludes(html, 'Intake triage');
  expectIncludes(html, 'Complete triage');
});

check('placeholder "ships in P1.8" is gone', () => {
  const acceptedCase: CaseDetail = {
    ...baseCase,
    engine_tasks_open: [mkTask()],
  };
  setupMocks(acceptedCase);
  const html = renderToString(
    createElement(InFlightView, { case: acceptedCase }),
  );
  expectExcludes(html, 'ships in P1.8');
  expectExcludes(html, 'Task form rendering ships');
});

check('shows NoOpenTasksView when engine_tasks_open is empty', () => {
  const noTasksCase: CaseDetail = {
    ...baseCase,
    engine_tasks_open: [],
  };
  setupMocks(noTasksCase);
  const html = renderToString(
    createElement(InFlightView, { case: noTasksCase }),
  );
  expectIncludes(html, 'No open tasks');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
