/**
 * SSR smoke for P1.11 — reference panel + 5 tabs.
 *
 * Run with: npx tsx scripts/sanity-check-v4-reference-panel.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks, __setMutationMock } from '../stubs/tensaw/actions';

import { ReferencePanel } from '../src/pages/ReferencePanel';
import { TabStrip } from '../src/components/reference-panel/TabStrip';
import { AnalysisTab } from '../src/components/reference-panel/AnalysisTab';
import { PaymentsTab } from '../src/components/reference-panel/PaymentsTab';
import { NotesTab } from '../src/components/reference-panel/NotesTab';
import { FilesTab } from '../src/components/reference-panel/FilesTab';
import { AppealTab } from '../src/components/reference-panel/AppealTab';

import type { CaseDetail } from '../src/actions/schemas-v4';
import type { Note, FileEntity, Transaction, Appeal } from '../src/actions/schemas-v4-tabs';

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
  recommended_reasoning: 'CO-50 on 99214 plus prior pattern.',
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
  icd_codes: ['J45.20'],
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

function setupMocks(opts: {
  notes?: Note[];
  files?: FileEntity[];
  transactions?: Transaction[];
  appeal?: Appeal | null;
} = {}): void {
  __resetMocks();
  __setQueryMock('case.detail', baseCase);
  __setQueryMock('case.notes', { notes: opts.notes ?? [] });
  __setQueryMock('case.files', { files: opts.files ?? [] });
  __setQueryMock('case.transactions', { transactions: opts.transactions ?? [] });
  // case.appeal.get returns the Appeal directly or null
  if (opts.appeal !== undefined) {
    __setQueryMock('case.appeal.get', opts.appeal as Appeal);
  } else {
    // null is also a valid response (no appeal yet); cast away strictness
    __setQueryMock('case.appeal.get', null as unknown as Appeal);
  }
  __setMutationMock('case.note.add', async () => ({ note_id: 'n_new', case_id: baseCase.case_id, body: '', source: 'analyst', author_user_id: 42, author_user_name: 'Vipin K.', created_at: new Date().toISOString() } as Note));
  __setMutationMock('case.file.upload', async () => ({ file_id: 'f_new', case_id: baseCase.case_id, file_name: '', file_type: 'medical_record', size_bytes: 0, mime_type: '', uploaded_by_user_id: 42, uploaded_by_user_name: 'Vipin K.', uploaded_at: new Date().toISOString() } as FileEntity));
  __setMutationMock('case.appeal.generate', async () => ({ appeal_id: 'a_new', case_id: baseCase.case_id, template: 'medical_necessity', status: 'draft', body: 'Generated body', generated_at: new Date().toISOString(), generated_by_model: 'gpt-4o', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Appeal));
  __setMutationMock('case.appeal.save', async () => ({ appeal_id: 'a_existing', case_id: baseCase.case_id, template: 'medical_necessity', status: 'draft', body: '', generated_at: null, generated_by_model: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Appeal));
}

// ============================================================================
// TabStrip
// ============================================================================

console.log('=== TabStrip ===');

check('renders all 5 tabs', () => {
  const html = renderToString(createElement(TabStrip, {
    activeTab: 'analysis',
    onTabChange: () => {},
  }));
  expectIncludes(html, 'role="tablist"');
  expectIncludes(html, '>Analysis<');
  expectIncludes(html, '>Payments<');
  expectIncludes(html, '>Notes<');
  expectIncludes(html, '>Files<');
  expectIncludes(html, '>Appeal<');
});

check('active tab has aria-selected=true; others false', () => {
  const html = renderToString(createElement(TabStrip, {
    activeTab: 'notes',
    onTabChange: () => {},
  }));
  expectIncludes(html, 'aria-selected="true"');
  const selectedCount = (html.match(/aria-selected="true"/g) ?? []).length;
  if (selectedCount !== 1) throw new Error(`expected 1 selected tab, got ${selectedCount}`);
});

check('count badges show on notes/files when > 0', () => {
  const html = renderToString(createElement(TabStrip, {
    activeTab: 'analysis',
    onTabChange: () => {},
    notesCount: 7,
    filesCount: 3,
  }));
  expectIncludes(html, '>7<');
  expectIncludes(html, '>3<');
});

check('appeal dot badge shows when hasAppealDraft=true', () => {
  const html = renderToString(createElement(TabStrip, {
    activeTab: 'analysis',
    onTabChange: () => {},
    hasAppealDraft: true,
  }));
  expectIncludes(html, 'aria-label="• appeal"');
});

check('count badges hidden when zero/undefined', () => {
  const html = renderToString(createElement(TabStrip, {
    activeTab: 'analysis',
    onTabChange: () => {},
    notesCount: 0,
  }));
  // Should not show "0" badge
  // (the only digit-style content should be inside the tab buttons themselves,
  // and the badge has aria-label= for accessibility)
  expectExcludes(html, 'aria-label="0 notes"');
});

// ============================================================================
// AnalysisTab
// ============================================================================

console.log('\n=== AnalysisTab ===');

check('shows LLM recommendation block with category + confidence', () => {
  const html = renderToString(createElement(AnalysisTab, { case: baseCase }));
  expectIncludes(html, 'LLM classification');
  expectIncludes(html, 'Medical Necessity');
  expectIncludes(html, '92%');
});

check('shows reasoning text', () => {
  const html = renderToString(createElement(AnalysisTab, { case: baseCase }));
  expectIncludes(html, 'CO-50 on 99214');
});

check('shows workflow block when workflow_name is set', () => {
  const html = renderToString(createElement(AnalysisTab, { case: baseCase }));
  expectIncludes(html, 'Workflow');
  expectIncludes(html, 'medical_necessity_resolution');
});

check('shows acceptance metadata for accepted cases', () => {
  const html = renderToString(createElement(AnalysisTab, { case: baseCase }));
  expectIncludes(html, 'Acceptance');
  expectIncludes(html, 'Vipin K.');
});

// ============================================================================
// PaymentsTab
// ============================================================================

console.log('\n=== PaymentsTab ===');

check('empty state when no transactions', () => {
  setupMocks({ transactions: [] });
  const html = renderToString(createElement(PaymentsTab, { case: baseCase }));
  expectIncludes(html, 'No transactions yet');
});

check('renders transactions with type-coded badges + payer source', () => {
  setupMocks({
    transactions: [
      {
        transaction_id: 't1', claim_id: 300138, case_id: 'case_000001',
        transaction_type: 'payment', payer_source: 'primary',
        amount: 50, transaction_date: '2026-06-01',
        carc_code: null, rarc_code: null, remit_reason_text: null,
      },
      {
        transaction_id: 't2', claim_id: 300138, case_id: 'case_000001',
        transaction_type: 'denial', payer_source: 'primary',
        amount: 0, transaction_date: '2026-06-02',
        carc_code: 'CO-50', rarc_code: 'M127', remit_reason_text: 'Medical necessity not established',
      },
    ],
  });
  const html = renderToString(createElement(PaymentsTab, { case: baseCase }));
  expectIncludes(html, '>Payment<');
  expectIncludes(html, '>Denial<');
  expectIncludes(html, '1°');
  expectIncludes(html, 'CARC CO-50');
  expectIncludes(html, 'RARC M127');
  expectIncludes(html, 'Medical necessity not established');
});

check('shows summary tiles with net received', () => {
  setupMocks({
    transactions: [
      {
        transaction_id: 't1', claim_id: 300138, case_id: 'case_000001',
        transaction_type: 'payment', payer_source: 'primary',
        amount: 75, transaction_date: '2026-06-01',
        carc_code: null, rarc_code: null, remit_reason_text: null,
      },
    ],
  });
  const html = renderToString(createElement(PaymentsTab, { case: baseCase }));
  expectIncludes(html, '>Payments<');
  expectIncludes(html, '>Net received<');
  expectIncludes(html, '$75');
});

// ============================================================================
// NotesTab
// ============================================================================

console.log('\n=== NotesTab ===');

check('empty state with prompt to add first note', () => {
  setupMocks({ notes: [] });
  const html = renderToString(createElement(NotesTab, { case: baseCase }));
  expectIncludes(html, 'No notes yet');
});

check('renders notes with source-coded badges', () => {
  setupMocks({
    notes: [
      {
        note_id: 'n1', case_id: 'case_000001',
        body: 'Records pulled from EMR.',
        source: 'analyst',
        author_user_id: 42, author_user_name: 'Vipin K.',
        created_at: '2026-06-12T10:00:00Z',
      },
      {
        note_id: 'n2', case_id: 'case_000001',
        body: 'Case accepted, workflow started.',
        source: 'system',
        author_user_id: null, author_user_name: null,
        created_at: '2026-06-10T09:00:00Z',
      },
    ],
  });
  const html = renderToString(createElement(NotesTab, { case: baseCase }));
  expectIncludes(html, 'Records pulled from EMR');
  expectIncludes(html, 'Case accepted');
  expectIncludes(html, '>Note<');
  expectIncludes(html, '>System<');
  expectIncludes(html, 'Vipin K.');
});

check('add-note form has textarea + Add button', () => {
  setupMocks();
  const html = renderToString(createElement(NotesTab, { case: baseCase }));
  expectIncludes(html, 'Add a note');
  expectIncludes(html, 'placeholder="Visible to anyone on the case');
  expectIncludes(html, '>Add note<');
});

check('Add button disabled initially (empty body)', () => {
  setupMocks();
  const html = renderToString(createElement(NotesTab, { case: baseCase }));
  expectIncludes(html, 'disabled=""');
});

// ============================================================================
// FilesTab
// ============================================================================

console.log('\n=== FilesTab ===');

check('empty state with prompt to upload', () => {
  setupMocks({ files: [] });
  const html = renderToString(createElement(FilesTab, { case: baseCase }));
  expectIncludes(html, 'No files attached yet');
});

check('renders files grouped by type with size + uploader', () => {
  setupMocks({
    files: [
      {
        file_id: 'f1', case_id: 'case_000001',
        file_name: 'medical_record_henderson.pdf',
        file_type: 'medical_record',
        size_bytes: 102400, mime_type: 'application/pdf',
        uploaded_by_user_id: 42, uploaded_by_user_name: 'Vipin K.',
        uploaded_at: '2026-06-11T15:30:00Z',
      },
      {
        file_id: 'f2', case_id: 'case_000001',
        file_name: 'denial_letter.pdf',
        file_type: 'denial_letter',
        size_bytes: 51200, mime_type: 'application/pdf',
        uploaded_by_user_id: null, uploaded_by_user_name: null,
        uploaded_at: '2026-06-10T08:00:00Z',
      },
    ],
  });
  const html = renderToString(createElement(FilesTab, { case: baseCase }));
  expectIncludes(html, 'medical_record_henderson.pdf');
  expectIncludes(html, 'denial_letter.pdf');
  expectIncludes(html, 'Medical record (1)');
  expectIncludes(html, 'Denial letter (1)');
  expectIncludes(html, '100.0 KB');
  expectIncludes(html, 'Vipin K.');
});

check('upload picker has file type select + Choose file + Upload', () => {
  setupMocks();
  const html = renderToString(createElement(FilesTab, { case: baseCase }));
  expectIncludes(html, 'Upload file');
  expectIncludes(html, 'aria-label="File type"');
  expectIncludes(html, 'Choose file');
  expectIncludes(html, '>Upload<');
});

check('Upload button disabled initially (no file selected)', () => {
  setupMocks();
  const html = renderToString(createElement(FilesTab, { case: baseCase }));
  expectIncludes(html, 'No file selected');
  expectIncludes(html, 'disabled=""');
});

// ============================================================================
// AppealTab
// ============================================================================

console.log('\n=== AppealTab ===');

check('shows Generate view when no appeal exists', () => {
  setupMocks({ appeal: null });
  const html = renderToString(createElement(AppealTab, { case: baseCase }));
  expectIncludes(html, 'Generate appeal letter');
  expectIncludes(html, '10-30 seconds');
  expectIncludes(html, '>Generate appeal<');
});

check('Generate view has all 4 template options', () => {
  setupMocks({ appeal: null });
  const html = renderToString(createElement(AppealTab, { case: baseCase }));
  expectIncludes(html, 'Medical necessity');
  expectIncludes(html, 'Prior authorization');
  expectIncludes(html, 'Timely filing');
  expectIncludes(html, 'Coding correction');
});

check('shows Edit view with textarea when draft exists', () => {
  setupMocks({
    appeal: {
      appeal_id: 'a1', case_id: 'case_000001',
      template: 'medical_necessity', status: 'draft',
      body: 'Dear Humana Gold Plus,\n\nThis is an appeal for...',
      generated_at: '2026-06-12T11:00:00Z',
      generated_by_model: 'gpt-4o-2024-08-06',
      created_at: '2026-06-12T11:00:00Z',
      updated_at: '2026-06-12T11:00:00Z',
    },
  });
  const html = renderToString(createElement(AppealTab, { case: baseCase }));
  expectIncludes(html, 'aria-label="Appeal letter body"');
  expectIncludes(html, '>Draft<');
  expectIncludes(html, 'gpt-4o-2024-08-06');
  expectIncludes(html, '>Regenerate<');
  expectIncludes(html, '>Finalize<');
});

check('finalized appeal shows Mark submitted button, no Finalize', () => {
  setupMocks({
    appeal: {
      appeal_id: 'a1', case_id: 'case_000001',
      template: 'medical_necessity', status: 'finalized',
      body: 'Final letter',
      generated_at: '2026-06-12T11:00:00Z',
      generated_by_model: 'gpt-4o',
      created_at: '2026-06-12T11:00:00Z',
      updated_at: '2026-06-12T12:00:00Z',
    },
  });
  const html = renderToString(createElement(AppealTab, { case: baseCase }));
  expectIncludes(html, '>Finalized<');
  expectIncludes(html, 'Mark submitted');
  expectExcludes(html, '>Finalize<');
  expectExcludes(html, '>Regenerate<');
});

check('submitted appeal shows read-only message', () => {
  setupMocks({
    appeal: {
      appeal_id: 'a1', case_id: 'case_000001',
      template: 'medical_necessity', status: 'submitted',
      body: 'Submitted letter',
      generated_at: '2026-06-12T11:00:00Z',
      generated_by_model: 'gpt-4o',
      created_at: '2026-06-12T11:00:00Z',
      updated_at: '2026-06-12T13:00:00Z',
    },
  });
  const html = renderToString(createElement(AppealTab, { case: baseCase }));
  expectIncludes(html, '>Submitted<');
  expectIncludes(html, 'Submitted. Track payer response');
  expectExcludes(html, 'Mark submitted');
  expectExcludes(html, '>Finalize<');
});

// ============================================================================
// ReferencePanel — top-level composition
// ============================================================================

console.log('\n=== ReferencePanel ===');

check('renders empty state when no ?case= in URL', () => {
  setupMocks();
  // No URL params set → selectedCaseId=null
  const html = renderToString(createElement(ReferencePanel));
  expectIncludes(html, 'aria-label="Reference panel"');
  expectIncludes(html, 'Reference panel');
  // Description from empty state
  expectIncludes(html, 'Analysis, payments, notes, files');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
