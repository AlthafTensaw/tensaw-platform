/**
 * SSR sanity for AnalysisTab + ReferencePanel.
 * Run with: npx tsx scripts/sanity-check-reference-panel.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks } from '../stubs/tensaw/actions';
import { __setSearchParams, __resetSearchParams } from '../stubs/react-router-dom';

import { AnalysisTab } from '../src/components/reference-panel/AnalysisTab';
import { ReferencePanel } from '../src/pages/ReferencePanel';
import type { CaseDetail } from '../src/actions/schemas';

let passed = 0, failed = 0;
function check(label: string, fn: () => void): void {
  try { fn(); console.log(`  ✓ ${label}`); passed++; }
  catch (err) { console.log(`  ✗ ${label}`); console.log(`    ${err instanceof Error ? err.message : String(err)}`); failed++; }
}
function inc(html: string, n: string): void {
  if (!html.replace(/<!-- -->/g, '').includes(n)) throw new Error(`missing "${n}"`);
}
function exc(html: string, n: string): void {
  if (html.replace(/<!-- -->/g, '').includes(n)) throw new Error(`unexpected "${n}"`);
}

function detail(o: Partial<CaseDetail> = {}): CaseDetail {
  return {
    case_id: 'C-DENIAL-0001', state_code: 'CODING', open_task_ids: ['T1'],
    case_facts: { is_high_dollar: true, clarification_type: 'CODING', appeal_policy: 'ONE_APPEAL', root_cause: 'modifier missing', appeal_level: 1 },
    recommended_category: 'coding_error', recommended_confidence: 0.81, recommended_reasoning: 'CO-4 modifier.',
    classified_at: '2026-06-12T10:00:00Z', tool_version: 'p1', claim_id: 300138, patient_name: 'Henderson, Joel',
    mrn: '72834', dos: '2026-05-03', facility_name: 'CAH', facility_id: 'f1', provider_name: 'Dr. P', icd_codes: ['J45.20'],
    primary_payer_name: 'Humana MA', primary_payer_id: 'HUMANA', clinic_name: 'CAH', clinic_id: 'c1', aging_bucket: '0-29 day',
    billed: '1200.00', net_pending: '840.00', paid_primary: '360.00', paid_secondary: '0.00', paid_tertiary: '0.00',
    paid_patient: '0.00', pending_primary: '840.00', pending_secondary: '0.00', pending_tertiary: '0.00',
    created_at: '2026-06-12T10:00:00Z', updated_at: '2026-06-12T10:00:00Z', ...o,
  };
}

function seedPanel(d: CaseDetail): void {
  __setQueryMock('case.detail', d);
  __setQueryMock('case.notes', { notes: [] } as never);
  __setQueryMock('case.files', { files: [] } as never);
  __setQueryMock('case.appeal.get', null as never);
}

console.log('=== AnalysisTab v41 ===');

check('renders case_facts rows', () => {
  const html = renderToString(createElement(AnalysisTab, { detail: detail() }));
  inc(html, 'Case facts');
  inc(html, 'Engine state');
  inc(html, 'CODING');
  inc(html, 'Clarification');
  inc(html, 'High-dollar');
  inc(html, 'Appeal policy');
  inc(html, 'modifier missing'); // root cause
});

check('renders the LLM rec as context', () => {
  const html = renderToString(createElement(AnalysisTab, { detail: detail() }));
  inc(html, 'LLM recommendation');
  inc(html, 'coding_error');
});

check('renders the claim section', () => {
  const html = renderToString(createElement(AnalysisTab, { detail: detail() }));
  inc(html, 'Claim');
  inc(html, '300138');
  inc(html, 'Humana MA');
});

check('high-dollar shows No when flag false', () => {
  const html = renderToString(createElement(AnalysisTab, { detail: detail({ case_facts: { is_high_dollar: false } }) }));
  inc(html, 'High-dollar');
  inc(html, 'No');
});

console.log('\n=== ReferencePanel v41 ===');

check('empty state when no ?case=', () => {
  __resetMocks(); __resetSearchParams();
  const html = renderToString(createElement(ReferencePanel, {}));
  inc(html, 'Reference panel');
  inc(html, 'will appear here');
});

check('renders Analysis tab by default with a case selected', () => {
  __resetMocks(); __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  seedPanel(detail());
  const html = renderToString(createElement(ReferencePanel, {}));
  inc(html, 'Case facts');
  inc(html, 'Engine state');
});

check('?tab=notes switches to the Notes tab', () => {
  __resetMocks(); __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001', tab: 'notes' });
  seedPanel(detail());
  const html = renderToString(createElement(ReferencePanel, {}));
  // Notes tab content (not analysis case-facts)
  exc(html, 'Engine state');
});

check('renders the tab strip', () => {
  __resetMocks(); __resetSearchParams();
  __setSearchParams({ case: 'C-DENIAL-0001' });
  seedPanel(detail());
  const html = renderToString(createElement(ReferencePanel, {}));
  inc(html, 'role="tablist"');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
