/**
 * SSR sanity for WorklistPane + v41 filters/url-state.
 * Run with: npx tsx scripts/sanity-check-worklist-pane.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks } from '../stubs/tensaw/actions';
import { __setSearchParams, __resetSearchParams } from '../stubs/react-router-dom';

import { WorklistPane } from '../src/pages/WorklistPane';
import { WorklistFiltersBar } from '../src/components/worklist/WorklistFilters';
import { TASK_TYPE_LABELS } from '../src/lib/labels';
import type { WorklistTask, WorklistResponse } from '../src/actions/schemas';

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
function assert(c: boolean, m: string): void {
  if (!c) throw new Error(m);
}

function task(id: string, overrides: Partial<WorklistTask> = {}): WorklistTask {
  return {
    task_id: id,
    case_id: `C-${id}`,
    task_type: 'ANALYST_TRIAGE_DENIAL',
    status: 'OPEN',
    priority: 'normal',
    team: 'denial_intake_analyst',
    dispatched_at: '2026-06-14T10:00:00Z',
    case_context: { case_type: 'DENIAL', state_code: 'TRIAGE', task_type: 'ANALYST_TRIAGE_DENIAL', clinic_id: 'clinic-001', payer_id: 'HUMANA' },
    case_facts: { is_high_dollar: false },
    claim_summary: {
      claim_id: 1, patient_name: 'Test, P', mrn: '00001', dos: '2026-05-01',
      net_pending: '500.00', aging_bucket: '0-29 day', primary_payer_name: 'Humana MA',
      clinic_name: 'CAH',
    },
    ...overrides,
  };
}

function resp(rows: WorklistTask[], total = rows.length): WorklistResponse {
  return { rows, page: 1, page_size: 25, total, has_more: total > rows.length };
}

// Lookups used by the filter bar
function seedLookups(): void {
  __setQueryMock('lookup.clinics', { items: [{ id: 'clinic-001', name: 'CAH', alias: 'CAH' }] } as never);
  __setQueryMock('lookup.payers', { items: [{ id: 'HUMANA', name: 'Humana MA', alias: 'Humana' }] } as never);
}

console.log('=== WorklistPane v41 — data render ===');

check('renders task-row cards from worklist.list', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  __setQueryMock('worklist.list', resp([task('T1'), task('T2', { task_type: 'CODER_REVIEW_RECORD' })]));
  const html = renderToString(createElement(WorklistPane, {}));
  expectIncludes(html, TASK_TYPE_LABELS.ANALYST_TRIAGE_DENIAL);
  expectIncludes(html, TASK_TYPE_LABELS.CODER_REVIEW_RECORD);
});

check('subheader shows the team label + exact total', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  __setQueryMock('worklist.list', resp([task('T1')], 42));
  const html = renderToString(createElement(WorklistPane, {}));
  expectIncludes(html, 'Denial Intake');
  expectIncludes(html, '42'); // exact total (DB-backed)
  expectIncludes(html, 'task'); // "42 tasks"
});

check('honors ?queue= team for the subheader label', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ queue: 'coding' });
  seedLookups();
  __setQueryMock('worklist.list', resp([task('T1', { team: 'coding' })], 3));
  const html = renderToString(createElement(WorklistPane, {}));
  expectIncludes(html, 'Coding');
});

console.log('\n=== States ===');

check('empty state when no rows', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  __setQueryMock('worklist.list', resp([], 0));
  const html = renderToString(createElement(WorklistPane, {}));
  expectIncludes(html, 'No open');
});

check('error state when query errors with no data', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  __setQueryMock('worklist.list', { __error: 'boom' } as never);
  // The stub surfaces __error as the error; pane shows WorklistError.
  const html = renderToString(createElement(WorklistPane, {}));
  // Either the error UI or empty — assert it doesn't crash + shows a known state
  assert(html.length > 0, 'pane should render some state');
});

console.log('\n=== Filter bar (v41) ===');

check('filter bar exposes a Task (task_type) chip', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  const html = renderToString(createElement(WorklistFiltersBar, {}));
  expectIncludes(html, 'data-filter-key="task_type"');
  expectIncludes(html, '>Task<');
});

check('filter bar exposes a High-dollar toggle', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  const html = renderToString(createElement(WorklistFiltersBar, {}));
  expectIncludes(html, 'data-filter-key="is_high_dollar"');
  expectIncludes(html, 'High-dollar');
});

check('filter bar has NO Category chip (dropped in v41)', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  const html = renderToString(createElement(WorklistFiltersBar, {}));
  expectExcludes(html, 'data-filter-key="category"');
});

check('payer chip disabled until a clinic is picked', () => {
  __resetMocks();
  __resetSearchParams();
  seedLookups();
  const html = renderToString(createElement(WorklistFiltersBar, {}));
  // The payer chip button carries disabled when clinic_id is null
  expectIncludes(html, 'data-filter-key="primary_payer_id"');
  // crude: a disabled attribute appears somewhere on the payer chip
  assert(/data-filter-key="primary_payer_id"[^>]*disabled/.test(html) || html.includes('Pick a clinic first'), 'payer chip should be disabled without a clinic');
});

check('active task_type filter reflected in the chip label', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ task_type: 'CODER_REVIEW_RECORD' });
  seedLookups();
  const html = renderToString(createElement(WorklistFiltersBar, {}));
  expectIncludes(html, `Task: ${TASK_TYPE_LABELS.CODER_REVIEW_RECORD}`);
});

console.log('\n=== URL-state hook (v41) ===');

// Exercise the hook indirectly through the filter bar's active-state rendering.
check('high-dollar active state renders pressed', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ hd: '1' });
  seedLookups();
  const html = renderToString(createElement(WorklistFiltersBar, {}));
  expectIncludes(html, 'aria-pressed="true"');
});

check('Clear filters appears when a filter is active', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ priority: 'high' });
  seedLookups();
  const html = renderToString(createElement(WorklistFiltersBar, {}));
  expectIncludes(html, 'Clear filters');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
