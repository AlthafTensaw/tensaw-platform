/**
 * SSR sanity for WorkPane (engine-handler work area).
 * Run with: npx tsx scripts/sanity-check-work-pane.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks } from '../stubs/tensaw/actions';
import { __setSearchParams, __resetSearchParams } from '../stubs/react-router-dom';

import { WorkPane } from '../src/pages/WorkPane';
import { CurrentTaskBlock } from '../src/components/task-form/CurrentTaskBlock';
import { CurrentStateStrip } from '../src/components/work-pane/CurrentStateStrip';
import { LlmRecContext } from '../src/components/work-pane/LlmRecContext';
import { TASK_TYPE_LABELS } from '../src/lib/labels';
import { TaskTypeSchema } from '../src/actions/schemas';
import type { CaseDetail, WorklistTask, TaskType } from '../src/actions/schemas';

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
  if (!clean.includes(needle)) throw new Error(`missing "${needle}"\n  ${clean.slice(0, 300)}`);
}
function expectExcludes(html: string, needle: string): void {
  const clean = html.replace(/<!-- -->/g, '');
  if (clean.includes(needle)) throw new Error(`unexpectedly included "${needle}"`);
}

function makeDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    case_id: 'C-DENIAL-0001',
    state_code: 'TRIAGE',
    open_task_ids: ['T-000001'],
    case_facts: { is_high_dollar: true },
    recommended_category: 'medical_necessity',
    recommended_confidence: 0.92,
    recommended_reasoning: 'CO-50 on 99214 plus prior pattern.',
    classified_at: '2026-06-12T10:00:00Z',
    tool_version: 'phase1-0.1.0',
    claim_id: 300138,
    patient_name: 'Henderson, Joel',
    mrn: '72834',
    dos: '2026-05-03',
    facility_name: 'CAH Main',
    facility_id: 'fac-1',
    provider_name: 'Dr. M. Patel',
    icd_codes: ['J45.20'],
    primary_payer_name: 'Humana MA',
    primary_payer_id: 'HUMANA',
    clinic_name: 'CAH',
    clinic_id: 'clinic-001',
    aging_bucket: '0-29 day',
    billed: '1200.00',
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
    ...overrides,
  };
}

function makeTask(overrides: Partial<WorklistTask> = {}): WorklistTask {
  return {
    task_id: 'T-000001',
    case_id: 'C-DENIAL-0001',
    task_type: 'ANALYST_TRIAGE_DENIAL',
    status: 'OPEN',
    priority: 'high',
    team: 'denial_intake_analyst',
    dispatched_at: '2026-06-14T10:00:00Z',
    case_context: { case_type: 'DENIAL', state_code: 'TRIAGE', task_type: 'ANALYST_TRIAGE_DENIAL', clinic_id: 'clinic-001', payer_id: 'HUMANA' },
    case_facts: { is_high_dollar: true },
    claim_summary: {
      claim_id: 300138, patient_name: 'Henderson, Joel', mrn: '72834', dos: '2026-05-03',
      net_pending: '840.00', aging_bucket: '0-29 day', primary_payer_name: 'Humana MA', clinic_name: 'CAH',
    },
    ...overrides,
  };
}

console.log('=== WorkPane v41 — states ===');

check('no-selection placeholder when ?case= absent', () => {
  __resetMocks();
  __resetSearchParams();
  const html = renderToString(createElement(WorkPane, {}));
  expectIncludes(html, 'No case selected');
});

check('renders header + claim context with a case selected', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  __setQueryMock('case.detail', makeDetail());
  __setQueryMock('worklist.task', makeTask());
  const html = renderToString(createElement(WorkPane, {}));
  expectIncludes(html, 'Henderson, Joel');
  expectIncludes(html, '72834');
  expectIncludes(html, 'Claim #300138');
  expectIncludes(html, '$840'); // net pending from decimal string
});

check('shows HD badge + state badge in the header', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  __setQueryMock('case.detail', makeDetail());
  __setQueryMock('worklist.task', makeTask());
  const html = renderToString(createElement(WorkPane, {}));
  expectIncludes(html, '>HD<');
  expectIncludes(html, '>TRIAGE<');
});

check('renders the active task completion form', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  __setQueryMock('case.detail', makeDetail());
  __setQueryMock('worklist.task', makeTask());
  const html = renderToString(createElement(WorkPane, {}));
  expectIncludes(html, TASK_TYPE_LABELS.ANALYST_TRIAGE_DENIAL);
  expectIncludes(html, 'Complete triage'); // triage form's primary label (R8)
  expectIncludes(html, 'Completion note');
});

check('renders LLM rec as CONTEXT (no Accept/Override buttons)', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  __setQueryMock('case.detail', makeDetail());
  __setQueryMock('worklist.task', makeTask());
  const html = renderToString(createElement(WorkPane, {}));
  expectIncludes(html, 'LLM recommendation');
  expectIncludes(html, 'Reference only');
  expectExcludes(html, 'Accept recommendation');
  expectExcludes(html, 'Override');
});

check('resolved read-only view when no open tasks', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  __setQueryMock('case.detail', makeDetail({ open_task_ids: [], state_code: 'RESOLVED' }));
  const html = renderToString(createElement(WorkPane, {}));
  expectIncludes(html, 'No active task');
  expectIncludes(html, 'Resolved'); // strip shows resolved
});

console.log('\n=== No v4.0.0 three-state branching ===');

check('no Proposed / Accepted / Completed view language', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  __setQueryMock('case.detail', makeDetail());
  __setQueryMock('worklist.task', makeTask());
  const html = renderToString(createElement(WorkPane, {}));
  expectExcludes(html, 'Proposed');
  expectExcludes(html, 'If accepted, the workflow is');
  expectExcludes(html, 'Re-classify');
});

console.log('\n=== CurrentStateStrip ===');

check('strip shows active task + team when active', () => {
  const html = renderToString(
    createElement(CurrentStateStrip, {
      activeTaskType: 'CODER_REVIEW_RECORD' as TaskType,
      activeTeam: 'coding',
      stateCode: 'CODING',
    }),
  );
  expectIncludes(html, TASK_TYPE_LABELS.CODER_REVIEW_RECORD);
  expectIncludes(html, 'Coding');
});

check('strip shows resolved when no active task', () => {
  const html = renderToString(
    createElement(CurrentStateStrip, { activeTaskType: null, activeTeam: null, stateCode: 'RESOLVED' }),
  );
  expectIncludes(html, 'Resolved');
});

console.log('\n=== LlmRecContext ===');

check('renders null when never classified', () => {
  const html = renderToString(
    createElement(LlmRecContext, { detail: makeDetail({ recommended_category: null }) }),
  );
  // empty render
  if (html.replace(/<!-- -->/g, '').trim().length > 0) {
    throw new Error('expected empty render for unclassified case');
  }
});

console.log('\n=== CurrentTaskBlock routes all 17 task types ===');

for (const tt of TaskTypeSchema.options) {
  check(`routes ${tt} to a form`, () => {
    __resetMocks();
    const html = renderToString(
      createElement(CurrentTaskBlock, { task: makeTask({ task_type: tt as TaskType }) }),
    );
    expectIncludes(html, TASK_TYPE_LABELS[tt]);
    // R8: each type routes to a typed form with an emerald primary action +
    // a completion note. (Form-specific labels are covered in the task-forms sanity.)
    if (!/bg-emerald-600/.test(html.replace(/<!-- -->/g, ''))) {
      throw new Error(`${tt}: missing primary action button`);
    }
    expectIncludes(html, 'Completion note');
  });
}

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
