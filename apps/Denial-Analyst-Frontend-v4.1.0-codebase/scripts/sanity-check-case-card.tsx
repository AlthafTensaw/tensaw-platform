/**
 * SSR sanity for CaseCard (worklist-task-row card).
 * Run with: npx tsx scripts/sanity-check-case-card.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setSearchParams, __resetSearchParams } from '../stubs/react-router-dom';
import { CaseCard } from '../src/components/cards/CaseCard';
import { TASK_TYPE_LABELS } from '../src/lib/labels';
import type { WorklistTask, TaskType, Priority } from '../src/actions/schemas';

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

function makeTask(overrides: Partial<WorklistTask> = {}): WorklistTask {
  return {
    task_id: 'T-000001',
    case_id: 'C-DENIAL-0001',
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
      payer_id: 'HUMANA',
    },
    case_facts: { is_high_dollar: false },
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
    ...overrides,
  };
}

console.log('=== CaseCard v41 — core render ===');

check('task_type label is the prominent headline', () => {
  __resetSearchParams();
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectIncludes(html, TASK_TYPE_LABELS.ANALYST_TRIAGE_DENIAL); // 'Triage denial'
});

check('renders claim_summary fields (patient, mrn, dos, payer, aging)', () => {
  __resetSearchParams();
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectIncludes(html, 'Henderson, Joel');
  expectIncludes(html, '72834');
  expectIncludes(html, 'Humana MA');
  expectIncludes(html, '0-29 day');
});

check('formats net_pending STRING as currency', () => {
  __resetSearchParams();
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectIncludes(html, '$840'); // "840.00" → $840
});

check('renders the team chip', () => {
  __resetSearchParams();
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectIncludes(html, 'Denial Intake');
});

console.log('\n=== HD flag + priority ===');

check('HD badge shows when is_high_dollar=true', () => {
  __resetSearchParams();
  const html = renderToString(
    createElement(CaseCard, { task: makeTask({ case_facts: { is_high_dollar: true } }) }),
  );
  expectIncludes(html, '>HD<');
});

check('HD badge hidden when is_high_dollar=false', () => {
  __resetSearchParams();
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectExcludes(html, '>HD<');
});

check('priority badge shows for high, hidden for normal', () => {
  __resetSearchParams();
  const high = renderToString(createElement(CaseCard, { task: makeTask({ priority: 'high' as Priority }) }));
  expectIncludes(high, 'high');
  const normal = renderToString(createElement(CaseCard, { task: makeTask() }));
  // 'normal' priority is intentionally not badged
  expectExcludes(normal, '>normal<');
});

console.log('\n=== Dead v4.0.0 elements are gone ===');

check('no returned-to-you bar', () => {
  __resetSearchParams();
  const html = renderToString(
    createElement(CaseCard, { task: makeTask({ task_type: 'CODER_REVIEW_RECORD' }) }),
  );
  expectExcludes(html, 'Returned to you');
});

check('no originator/assignee badge, no Unassigned', () => {
  __resetSearchParams();
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectExcludes(html, 'Unassigned');
});

check('no case_status pill (Proposed/Accepted/Completed)', () => {
  __resetSearchParams();
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectExcludes(html, 'Proposed');
  expectExcludes(html, 'Accepted');
  expectExcludes(html, 'Overridden');
});

console.log('\n=== Selection + linking ===');

check('links to ?case= preserving ?queue=', () => {
  __resetSearchParams();
  __setSearchParams({ queue: 'coding' });
  const html = renderToString(
    createElement(CaseCard, { task: makeTask({ case_id: 'C-DENIAL-0009' }) }),
  );
  expectIncludes(html, 'queue=coding');
  expectIncludes(html, 'case=C-DENIAL-0009');
});

check('selected state when ?case= matches', () => {
  __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  const html = renderToString(createElement(CaseCard, { task: makeTask() }));
  expectIncludes(html, 'aria-current="page"');
});

console.log('\n=== Renders across representative task types ===');

const SAMPLE_TYPES: TaskType[] = [
  'CODER_REVIEW_RECORD',
  'RESOLUTION_FILE_APPEAL',
  'AM_DECIDE_DISPOSITION',
  'BHAVANA_PULL_EMR',
  'CZAR_VERIFY_CREDENTIALING',
];
for (const tt of SAMPLE_TYPES) {
  check(`renders ${tt}`, () => {
    __resetSearchParams();
    const html = renderToString(createElement(CaseCard, { task: makeTask({ task_type: tt }) }));
    expectIncludes(html, TASK_TYPE_LABELS[tt]);
  });
}

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
