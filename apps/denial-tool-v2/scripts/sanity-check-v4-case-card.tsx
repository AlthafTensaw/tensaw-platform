/**
 * SSR smoke for the P1.5 CaseCard cluster.
 *
 * Renders CaseCard with various fixtures and asserts on the HTML output.
 * Covers all the visual states from mockups #3 and #4 plus the formatter
 * + label helpers.
 *
 * Run with: npx tsx scripts/sanity-check-v4-case-card.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import {
  formatCurrency,
  formatDateShort,
  formatConfidence,
  deriveUrgency,
  initialsForName,
} from '../src/utils/formatters';
import {
  taskHint,
  queueChipLabel,
  categoryColor,
  statePillStyle,
  agingBucketTone,
} from '../src/lib/labels';

import { CaseCard } from '../src/components/cards/CaseCard';
import { QueueRoutingChip } from '../src/components/cards/QueueRoutingChip';
import type { WorklistRow } from '../src/actions/schemas-v4';

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
  if (!html.includes(needle)) {
    throw new Error(`HTML did not include "${needle}"\n  full HTML: ${html.slice(0, 600)}`);
  }
}

function expectExcludes(html: string, needle: string): void {
  if (html.includes(needle)) {
    throw new Error(`HTML unexpectedly included "${needle}"`);
  }
}

// ============================================================================
// Formatters
// ============================================================================

console.log('=== Formatters ===');

check('formatCurrency: whole dollars have no decimals', () => {
  if (formatCurrency(1354) !== '$1,354') {
    throw new Error(`got ${formatCurrency(1354)}`);
  }
});

check('formatCurrency: fractional cents preserved', () => {
  if (formatCurrency(20.50) !== '$20.50') {
    throw new Error(`got ${formatCurrency(20.50)}`);
  }
});

check('formatDateShort: YYYY-MM-DD → MM/DD/YY', () => {
  if (formatDateShort('2026-02-24') !== '02/24/26') {
    throw new Error(`got ${formatDateShort('2026-02-24')}`);
  }
});

check('formatDateShort: full ISO datetime works too', () => {
  if (formatDateShort('2026-02-24T10:00:00Z') !== '02/24/26') {
    throw new Error(`got ${formatDateShort('2026-02-24T10:00:00Z')}`);
  }
});

check('formatConfidence: 0.92 → "92%"', () => {
  if (formatConfidence(0.92) !== '92%') throw new Error(`got ${formatConfidence(0.92)}`);
});

check('initialsForName: "Renita K." → "RK"', () => {
  if (initialsForName('Renita K.') !== 'RK') {
    throw new Error(`got ${initialsForName('Renita K.')}`);
  }
});

check('initialsForName: single word → first 2 chars', () => {
  if (initialsForName('Vipin') !== 'VI') {
    throw new Error(`got ${initialsForName('Vipin')}`);
  }
});

check('initialsForName: empty fallback', () => {
  if (initialsForName('') !== '??') {
    throw new Error(`got ${initialsForName('')}`);
  }
});

console.log('\n=== Urgency derivation ===');

const NOW = new Date('2026-06-12T12:00:00Z');

check('overdue 8 days', () => {
  const u = deriveUrgency('2026-06-04T12:00:00Z', NOW);
  if (u === null) throw new Error('expected non-null');
  if (u.tone !== 'overdue') throw new Error(`tone: ${u.tone}`);
  if (u.label !== 'Overdue 8d') throw new Error(`label: ${u.label}`);
});

check('same day → Today', () => {
  const u = deriveUrgency('2026-06-12T15:00:00Z', NOW);
  if (u === null) throw new Error('expected non-null');
  if (u.tone !== 'today') throw new Error(`tone: ${u.tone}`);
});

check('3 days out → Due 3d', () => {
  const u = deriveUrgency('2026-06-15T12:00:00Z', NOW);
  if (u === null) throw new Error('expected non-null');
  if (u.label !== 'Due 3d') throw new Error(`label: ${u.label}`);
});

check('30+ days out → null (no badge)', () => {
  const u = deriveUrgency('2026-07-20T12:00:00Z', NOW);
  if (u !== null) throw new Error('expected null');
});

check('null due_at → null', () => {
  const u = deriveUrgency(null, NOW);
  if (u !== null) throw new Error('expected null');
});

// ============================================================================
// Labels
// ============================================================================

console.log('\n=== Labels ===');

check('taskHint: intake_triage has full hint text', () => {
  if (taskHint('intake_triage') !== 'Intake triage — confirm category') {
    throw new Error(`got ${taskHint('intake_triage')}`);
  }
});

check('queueChipLabel: known team queue → short alias', () => {
  if (queueChipLabel('coding_primrose') !== 'coding') {
    throw new Error(`got ${queueChipLabel('coding_primrose')}`);
  }
});

check('queueChipLabel: user_<id> → "personal"', () => {
  if (queueChipLabel('user_42') !== 'personal') {
    throw new Error(`got ${queueChipLabel('user_42')}`);
  }
});

check('categoryColor: medical_necessity → red', () => {
  if (categoryColor('medical_necessity') !== '#dc2626') {
    throw new Error(`got ${categoryColor('medical_necessity')}`);
  }
});

check('categoryColor: null → gray fallback', () => {
  if (categoryColor(null) !== '#9ca3af') {
    throw new Error(`got ${categoryColor(null)}`);
  }
});

check('statePillStyle: proposed → blue', () => {
  const s = statePillStyle('proposed');
  if (s.label !== 'Proposed') throw new Error(`label: ${s.label}`);
  if (!s.bgClass.includes('blue')) throw new Error(`bg: ${s.bgClass}`);
});

check('agingBucketTone: 180d+ → severe', () => {
  if (agingBucketTone('180d+') !== 'severe') {
    throw new Error(`got ${agingBucketTone('180d+')}`);
  }
});

check('agingBucketTone: 0-29d → normal', () => {
  if (agingBucketTone('0-29d') !== 'normal') {
    throw new Error(`got ${agingBucketTone('0-29d')}`);
  }
});

// ============================================================================
// QueueRoutingChip
// ============================================================================

console.log('\n=== QueueRoutingChip ===');

check('team queue chip uses gray styling', () => {
  const html = renderToString(createElement(QueueRoutingChip, { queueId: 'coding_primrose' }));
  expectIncludes(html, 'coding');
  expectIncludes(html, 'bg-slate-100');
  expectExcludes(html, 'bg-orange-100');
});

check('personal queue chip uses orange styling', () => {
  const html = renderToString(createElement(QueueRoutingChip, { queueId: 'user_42' }));
  expectIncludes(html, 'personal');
  expectIncludes(html, 'bg-orange-100');
});

check('chip carries the full queue_id as title attribute', () => {
  const html = renderToString(createElement(QueueRoutingChip, { queueId: 'high_dollar_oversight_primrose' }));
  expectIncludes(html, 'title="high_dollar_oversight_primrose"');
});

// ============================================================================
// CaseCard — fixture builders
// ============================================================================

function proposedRow(overrides: Partial<WorklistRow['case']> = {}): WorklistRow {
  return {
    case: {
      case_id: 'case_000001',
      case_status: 'proposed',
      originated_by_user_id: null,
      originated_by_user_name: null,
      originated_at: null,
      is_high_dollar: false,
      high_dollar_shim_case_id: null,
      workflow_name: null,
      engine_state_code: null,
      claim_id: 300001,
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
      ...overrides,
    },
    current_task: null,
  };
}

function acceptedRow(taskOverrides: Partial<NonNullable<WorklistRow['current_task']>> = {}): WorklistRow {
  return {
    case: {
      case_id: 'case_000002',
      case_status: 'accepted',
      originated_by_user_id: 17,
      originated_by_user_name: 'Renita K.',
      originated_at: '2026-06-10T09:00:00Z',
      is_high_dollar: true,
      high_dollar_shim_case_id: null,
      workflow_name: 'coding_review_branch',
      engine_state_code: 'CODING_REVIEW_OPEN',
      claim_id: 300002,
      patient_name: 'Whitfield, M',
      mrn: '50184',
      dos: '2025-11-15',
      net_pending: 2890,
      recommended_category: 'modifier_missing',
      recommended_confidence: 0.91,
      recommended_reasoning: '99214 denied for missing modifier.',
      classified_at: '2026-06-10T09:00:00Z',
      tool_version: 'phase1-0.1.0',
      primary_payer_name: 'Cigna HealthSpring',
      primary_payer_alias: 'Cigna HS',
      clinic_name: 'PRIM_BHM',
      clinic_alias: 'PRIM_BHM',
      aging_bucket: '180d+',
      created_at: '2026-06-10T09:00:00Z',
      updated_at: '2026-06-10T09:00:00Z',
    },
    current_task: {
      task_id: 'eng_t_000010',
      case_id: 'case_000002',
      task_type: 'coding_review',
      state_code: 'OPEN',
      queue_id: 'coding_primrose',
      priority_code: 'normal',
      opened_at: '2026-06-10T09:00:00Z',
      due_at: '2026-06-04T09:00:00Z', // overdue at NOW
      intent_key: 'coding_review:case_000002',
      handler_key: null,
      attempt_count: 0,
      ...taskOverrides,
    },
  };
}

function returnedRow(): WorklistRow {
  return {
    ...acceptedRow(),
    current_task: {
      task_id: 'eng_t_000020',
      case_id: 'case_000002',
      task_type: 'coding_feedback_review',
      state_code: 'OPEN',
      queue_id: 'user_42',
      priority_code: 'normal',
      opened_at: '2026-06-10T12:00:00Z',
      due_at: '2026-06-11T12:00:00Z',
      intent_key: 'coding_feedback_review:case_000002',
      handler_key: null,
      attempt_count: 0,
    },
  };
}

// ============================================================================
// CaseCard rendering
// ============================================================================

console.log('\n=== CaseCard — proposed state ===');

check('proposed card shows patient, MRN, money, DOS, aliases', () => {
  const html = renderToString(createElement(CaseCard, { row: proposedRow(), now: NOW }));
  expectIncludes(html, 'Henderson, J');
  expectIncludes(html, '72834');
  expectIncludes(html, '$230');
  expectIncludes(html, '02/24/26');
  expectIncludes(html, 'LSAT');
  expectIncludes(html, 'Humana GP');
  expectIncludes(html, '90-119d');
});

check('proposed card shows "Proposed" pill', () => {
  const html = renderToString(createElement(CaseCard, { row: proposedRow(), now: NOW }));
  expectIncludes(html, 'Proposed');
  expectIncludes(html, 'bg-blue-100');
});

check('proposed card line 3 shows generic "Intake triage" hint', () => {
  const html = renderToString(createElement(CaseCard, { row: proposedRow(), now: NOW }));
  expectIncludes(html, 'Intake triage — confirm category');
});

check('proposed card shows "Unassigned" originator', () => {
  const html = renderToString(createElement(CaseCard, { row: proposedRow(), now: NOW }));
  expectIncludes(html, 'Unassigned');
});

check('proposed card link target is /inbox?case=...', () => {
  const html = renderToString(createElement(CaseCard, { row: proposedRow(), now: NOW }));
  expectIncludes(html, 'href="/inbox?case=case_000001"');
});

check('proposed card hides HD badge when is_high_dollar=false', () => {
  const html = renderToString(createElement(CaseCard, { row: proposedRow(), now: NOW }));
  expectExcludes(html, 'High-dollar case');
});

check('proposed card hides QueueRoutingChip (no current_task)', () => {
  const html = renderToString(createElement(CaseCard, { row: proposedRow(), now: NOW }));
  // chip uses font-mono; if it were there we'd see this class
  // But the state pill might use mono too — let me check for the title= attr
  expectExcludes(html, 'title="denial_intake_analyst_primrose"');
  expectExcludes(html, 'title="coding_primrose"');
});

console.log('\n=== CaseCard — accepted state (Whitfield HD overdue) ===');

check('accepted card shows accepted pill', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, 'Accepted');
  expectIncludes(html, 'bg-emerald-100');
});

check('accepted card shows HD badge', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, 'High-dollar case');
  expectIncludes(html, '>HD<');
});

check('accepted card shows originator with initials avatar', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, '>RK<');
  expectIncludes(html, 'Renita K.');
});

check('accepted card shows overdue urgency in red', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, 'Overdue');
  expectIncludes(html, 'bg-red-100');
});

check('accepted card shows coding queue routing chip', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, 'title="coding_primrose"');
  expectIncludes(html, '>coding<');
});

check('accepted card line 3 task hint reflects coding_review', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, 'Coding review — verify CPT + dx');
});

check('180d+ aging shown in severe (red) tone', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, 'text-red-600');
  expectIncludes(html, '180d+');
});

console.log('\n=== CaseCard — returned-to-you (needs_my_review) ===');

check('returned card shows the ReturnedToYouBar at top', () => {
  const html = renderToString(createElement(CaseCard, { row: returnedRow(), now: NOW }));
  expectIncludes(html, 'Returned to you for review');
  expectIncludes(html, 'from-red-50');
});

check('returned card shows personal queue chip (orange)', () => {
  const html = renderToString(createElement(CaseCard, { row: returnedRow(), now: NOW }));
  expectIncludes(html, 'bg-orange-100');
  expectIncludes(html, '>personal<');
});

check('non-returned task (coding_review on team queue) hides the bar', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectExcludes(html, 'Returned to you for review');
});

check('returned card line 3 hint = "Coding partner completed review"', () => {
  const html = renderToString(createElement(CaseCard, { row: returnedRow(), now: NOW }));
  expectIncludes(html, 'Coding partner completed review');
});

console.log('\n=== CaseCard — completed state ===');

check('completed card shows muted slate pill', () => {
  const row = proposedRow({ case_status: 'completed' });
  const html = renderToString(createElement(CaseCard, { row, now: NOW }));
  expectIncludes(html, 'Completed');
  expectIncludes(html, 'bg-slate-200');
});

console.log('\n=== CaseCard — overridden state ===');

check('overridden case shows amber pill', () => {
  const row = proposedRow({
    case_status: 'overridden',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
  });
  const html = renderToString(createElement(CaseCard, { row, now: NOW }));
  expectIncludes(html, 'Overridden');
  expectIncludes(html, 'bg-amber-100');
  expectIncludes(html, '>VK<');
});

console.log('\n=== CaseCard — edge cases ===');

check('null patient_name shows "Unknown patient" placeholder', () => {
  const row = proposedRow({ patient_name: null });
  const html = renderToString(createElement(CaseCard, { row, now: NOW }));
  expectIncludes(html, 'Unknown patient');
});

check('null aging_bucket shows em-dash', () => {
  const row = proposedRow({ aging_bucket: null });
  const html = renderToString(createElement(CaseCard, { row, now: NOW }));
  expectIncludes(html, '>—<');
});

check('a11y label includes patient name + amount + status', () => {
  const html = renderToString(createElement(CaseCard, { row: acceptedRow(), now: NOW }));
  expectIncludes(html, 'aria-label="Whitfield, M — $2,890 — Accepted"');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
