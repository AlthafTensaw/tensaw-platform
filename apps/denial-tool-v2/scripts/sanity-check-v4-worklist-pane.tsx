/**
 * SSR smoke for P1.6 WorklistPane + supporting components.
 *
 * Run with: npx tsx scripts/sanity-check-v4-worklist-pane.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks } from '../stubs/tensaw/actions';

import { WorklistPane } from '../src/pages/WorklistPane';
import { WorklistFiltersBar } from '../src/components/worklist/WorklistFilters';
import {
  WorklistSkeleton,
  WorklistEmpty,
  WorklistError,
} from '../src/components/worklist/WorklistStates';
import { WorklistPagination } from '../src/components/worklist/WorklistPagination';

import type { WorklistRow, Queue } from '../src/actions/schemas-v4';

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
  // React SSR splits text + interpolations with <!-- --> comments. Strip them
  // so assertions read the rendered prose, not the React internals.
  const clean = html.replace(/<!-- -->/g, '');
  if (!clean.includes(needle)) {
    throw new Error(`HTML did not include "${needle}"\n  full: ${clean.slice(0, 600)}`);
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

const queues: Queue[] = [
  { queue_id: 'denial_intake_analyst_primrose', queue_label: 'Denial Intake — Primrose', queue_type: 'team', is_default_for_caller: true, pending_count: 6 },
  { queue_id: 'coding_primrose', queue_label: 'Coding partner — Primrose', queue_type: 'team', is_default_for_caller: false, pending_count: 1 },
  { queue_id: 'user_42', queue_label: 'My personal queue', queue_type: 'personal', is_default_for_caller: false, pending_count: 3 },
];

const categories = [
  { code: 'medical_necessity', label: 'Medical Necessity', workflow_name: 'medical_necessity_resolution', workflow_step_count: 5 },
  { code: 'auth_missing', label: 'Auth Missing', workflow_name: 'payer_call_resolution', workflow_step_count: 4 },
  { code: 'modifier_missing', label: 'Modifier Missing', workflow_name: 'coding_review_branch', workflow_step_count: 6 },
];

const clinics = [
  { id: 'clinic_lsat', name: 'Live Specialty Allergy Treatment', alias: 'LSAT' },
  { id: 'clinic_prim_bhm', name: 'Primrose Birmingham', alias: 'PRIM_BHM' },
];

const payers = [
  { id: 'payer_humana_gp', name: 'Humana Gold Plus', alias: 'Humana GP' },
  { id: 'payer_aetna_bh', name: 'Aetna Better Health', alias: 'Aetna BH' },
];

function buildRow(idx: number): WorklistRow {
  return {
    case: {
      case_id: `case_${String(idx).padStart(6, '0')}`,
      case_status: 'proposed',
      originated_by_user_id: null,
      originated_by_user_name: null,
      originated_at: null,
      is_high_dollar: false,
      high_dollar_shim_case_id: null,
      workflow_name: null,
      engine_state_code: null,
      claim_id: 300000 + idx,
      patient_name: `Patient ${idx}`,
      mrn: String(70000 + idx),
      dos: '2026-02-24',
      net_pending: 230 + idx * 10,
      recommended_category: 'medical_necessity',
      recommended_confidence: 0.92,
      recommended_reasoning: '...',
      classified_at: '2026-06-12T10:00:00Z',
      tool_version: 'phase1-0.1.0',
      primary_payer_name: 'Humana Gold Plus',
      primary_payer_alias: 'Humana GP',
      clinic_name: 'LSAT',
      clinic_alias: 'LSAT',
      aging_bucket: '90-119d',
      created_at: '2026-06-12T10:00:00Z',
      updated_at: '2026-06-12T10:00:00Z',
    },
    current_task: null,
  };
}

function setupStandardMocks(rows: WorklistRow[] = [], hasMore = false): void {
  __resetMocks();
  __setQueryMock('queue.list', { queues });
  __setQueryMock('category.list', { categories });
  __setQueryMock('lookup.clinics', { items: clinics });
  __setQueryMock('lookup.payers', { items: payers });
  __setQueryMock('case.worklist', {
    rows,
    page: 1,
    page_size: 25,
    has_more: hasMore,
  });
}

// ============================================================================
// Subcomponent tests
// ============================================================================

console.log('=== WorklistSkeleton ===');

check('renders 5 placeholder cards with animate-pulse', () => {
  const html = renderToString(createElement(WorklistSkeleton));
  expectIncludes(html, 'aria-label="Loading cases"');
  expectIncludes(html, 'animate-pulse');
  // Count the skeleton cards by counting the .animate-pulse occurrences
  const matches = html.match(/animate-pulse/g) ?? [];
  if (matches.length !== 5) {
    throw new Error(`expected 5 skeleton cards, got ${matches.length}`);
  }
});

console.log('\n=== WorklistEmpty ===');

check('default empty (no filters) shows "All caught up"', () => {
  const html = renderToString(createElement(WorklistEmpty, {
    hasActiveFilters: false,
    queueLabel: 'Denial Intake',
  }));
  expectIncludes(html, 'All caught up');
  expectIncludes(html, 'Denial Intake');
  expectExcludes(html, 'Clear filters');
});

check('filtered empty shows "No matching cases" + Clear button', () => {
  let cleared = false;
  const html = renderToString(createElement(WorklistEmpty, {
    hasActiveFilters: true,
    onClearFilters: () => { cleared = true; },
    queueLabel: 'Denial Intake',
  }));
  expectIncludes(html, 'No matching cases');
  expectIncludes(html, 'Clear filters');
  void cleared; // suppress unused
});

console.log('\n=== WorklistError ===');

check('error renders message + Retry button', () => {
  const html = renderToString(createElement(WorklistError, {
    message: 'Network unreachable',
    onRetry: () => {},
  }));
  expectIncludes(html, 'Couldn&#x27;t load the worklist');
  expectIncludes(html, 'Network unreachable');
  expectIncludes(html, '>Retry<');
  expectIncludes(html, 'role="alert"');
});

console.log('\n=== WorklistPagination ===');

check('hides entirely on page 1 with no more', () => {
  const html = renderToString(createElement(WorklistPagination, {
    page: 1, pageSize: 25, rowCount: 6, hasMore: false, onPageChange: () => {},
  }));
  if (html.length > 0 && html !== '<!-- -->') {
    throw new Error(`expected null render, got: ${html}`);
  }
});

check('shows on page 1 when has_more=true', () => {
  const html = renderToString(createElement(WorklistPagination, {
    page: 1, pageSize: 25, rowCount: 25, hasMore: true, onPageChange: () => {},
  }));
  expectIncludes(html, 'Page 1');
  expectIncludes(html, '1–25');
  expectIncludes(html, 'Next');
});

check('Previous disabled on page 1', () => {
  const html = renderToString(createElement(WorklistPagination, {
    page: 1, pageSize: 25, rowCount: 25, hasMore: true, onPageChange: () => {},
  }));
  // The disabled button has disabled="" attribute in SSR
  expectIncludes(html, 'disabled=""');
});

check('shows on page 2 even when no more', () => {
  const html = renderToString(createElement(WorklistPagination, {
    page: 2, pageSize: 25, rowCount: 3, hasMore: false, onPageChange: () => {},
  }));
  expectIncludes(html, 'Page 2');
  expectIncludes(html, '26–28');
});

console.log('\n=== WorklistFiltersBar ===');

check('renders all 5 filter chips', () => {
  setupStandardMocks();
  const html = renderToString(createElement(WorklistFiltersBar));
  expectIncludes(html, 'data-filter-key="category"');
  expectIncludes(html, 'data-filter-key="clinic_id"');
  expectIncludes(html, 'data-filter-key="primary_payer_id"');
  expectIncludes(html, 'data-filter-key="aging_bucket"');
  expectIncludes(html, 'data-filter-key="priority"');
});

check('Payer chip is disabled until clinic is picked', () => {
  setupStandardMocks();
  const html = renderToString(createElement(WorklistFiltersBar));
  // Find the payer button — it should be the only disabled chip initially
  expectIncludes(html, 'aria-label="Filter by Payer"');
  // The disabled chip has title="Pick a clinic first"
  expectIncludes(html, 'title="Pick a clinic first"');
});

check('Clear filters link hidden when no filters active', () => {
  setupStandardMocks();
  const html = renderToString(createElement(WorklistFiltersBar));
  expectExcludes(html, '>Clear filters<');
});

// ============================================================================
// WorklistPane composition
// ============================================================================

console.log('\n=== WorklistPane — initial load ===');

check('shows skeleton when queue.list and worklist still loading', () => {
  __resetMocks();
  // Only queue.list mocked → worklist is still "loading" (mock returns undefined)
  __setQueryMock('queue.list', { queues });
  __setQueryMock('category.list', { categories });
  __setQueryMock('lookup.clinics', { items: clinics });
  __setQueryMock('lookup.payers', { items: payers });
  const html = renderToString(createElement(WorklistPane));
  expectIncludes(html, 'aria-label="Loading cases"');
  expectIncludes(html, 'animate-pulse');
});

console.log('\n=== WorklistPane — populated state ===');

check('renders cards when worklist returns rows', () => {
  setupStandardMocks([buildRow(1), buildRow(2), buildRow(3)]);
  const html = renderToString(createElement(WorklistPane));
  expectIncludes(html, 'Patient 1');
  expectIncludes(html, 'Patient 2');
  expectIncludes(html, 'Patient 3');
});

check('renders the result count subheader', () => {
  setupStandardMocks([buildRow(1), buildRow(2)]);
  const html = renderToString(createElement(WorklistPane));
  expectIncludes(html, 'Denial Intake — Primrose');
  expectIncludes(html, '2');
  expectIncludes(html, 'cases');
});

check('singular "case" for count of 1', () => {
  setupStandardMocks([buildRow(1)]);
  const html = renderToString(createElement(WorklistPane));
  // Look for "1 case" (singular) not "1 cases"
  expectIncludes(html, '>1<');
  // The subheader uses ">1<\n  case" pattern — singular branch hits
  expectExcludes(html, '1 cases');
});

check('hides pagination when only one page', () => {
  setupStandardMocks([buildRow(1), buildRow(2)], false);
  const html = renderToString(createElement(WorklistPane));
  expectExcludes(html, '>← Previous<');
  expectExcludes(html, '>Next →<');
});

check('shows pagination when has_more=true', () => {
  setupStandardMocks(
    Array.from({ length: 25 }, (_, i) => buildRow(i + 1)),
    true,
  );
  const html = renderToString(createElement(WorklistPane));
  expectIncludes(html, '← Previous');
  expectIncludes(html, 'Next →');
  expectIncludes(html, 'Page 1');
});

console.log('\n=== WorklistPane — empty state ===');

check('shows empty state when worklist returns no rows and no filters', () => {
  setupStandardMocks([]);
  const html = renderToString(createElement(WorklistPane));
  expectIncludes(html, 'All caught up');
  expectExcludes(html, 'Clear filters');
});

console.log('\n=== WorklistPane — sectioning + a11y ===');

check('top-level section has aria-label="Worklist"', () => {
  setupStandardMocks([buildRow(1)]);
  const html = renderToString(createElement(WorklistPane));
  expectIncludes(html, 'aria-label="Worklist"');
});

check('uses flex column layout for full-height pane', () => {
  setupStandardMocks([buildRow(1)]);
  const html = renderToString(createElement(WorklistPane));
  expectIncludes(html, 'flex h-full flex-col');
  expectIncludes(html, 'overflow-y-auto'); // scrollable card area
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
