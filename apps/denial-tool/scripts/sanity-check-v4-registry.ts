/**
 * Runtime sanity check for the v4 action registry (P1.2).
 *
 * Verifies:
 *   - All 24 actions register without errors (no duplicate IDs, no schema bugs)
 *   - The invalidation matrix is consistent (every actionId in invalidatedBy
 *     references a real registered mutation)
 *   - All cache tags from §2.5 of the design contract are present
 *   - Tab data schemas (Note, File, Appeal, Transaction) parse realistic
 *     fixture payloads
 *
 * Run with: npx tsx scripts/sanity-check-v4-registry.ts
 */

import {
  registerCaseActions,
  auditInvalidationMatrix,
  MUTATION_ACTION_IDS,
  QUERY_ACTION_IDS,
  INVALIDATE,
} from '../src/actions/index-v4';
import { clearRegistry, getRegistry } from '../stubs/tensaw/actions';
import {
  NoteSchema,
  NotesResponseSchema,
  FileSchema,
  AppealSchema,
  TransactionSchema,
  CategorySchema,
  LookupItemSchema,
} from '../src/actions/schemas-v4-tabs';

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

// ============================================================================
// Registration smoke test
// ============================================================================

console.log('=== Registry registration ===');

check('registerCaseActions() runs without throwing', () => {
  clearRegistry();
  registerCaseActions();
});

check('exactly 24 actions register (14 queries + 10 mutations)', () => {
  const reg = getRegistry();
  if (reg.size !== 24) {
    throw new Error(`expected 24 actions, got ${reg.size}`);
  }
});

check('every QUERY_ACTION_IDS entry is registered as a query', () => {
  const reg = getRegistry();
  for (const id of QUERY_ACTION_IDS) {
    const def = reg.get(id);
    if (!def) throw new Error(`missing query action: ${id}`);
    if (def.kind !== 'query') {
      throw new Error(`${id} should be a query, got ${def.kind}`);
    }
  }
});

check('every MUTATION_ACTION_IDS entry is registered as a mutation', () => {
  const reg = getRegistry();
  for (const id of MUTATION_ACTION_IDS) {
    const def = reg.get(id);
    if (!def) throw new Error(`missing mutation action: ${id}`);
    if (def.kind !== 'mutation') {
      throw new Error(`${id} should be a mutation, got ${def.kind}`);
    }
  }
});

check('every registered action has a non-empty description', () => {
  const reg = getRegistry();
  for (const [id, def] of reg) {
    if (def.description.length < 10) {
      throw new Error(`${id} has too-short description: "${def.description}"`);
    }
  }
});

check('every registered action has a permission tag', () => {
  const reg = getRegistry();
  const validPerms = new Set([
    'denial.read',
    'denial.act',
    'denial.classify',
    'denial.view_cost',
  ]);
  for (const [id, def] of reg) {
    if (!validPerms.has(def.permission)) {
      throw new Error(`${id} has unknown permission: ${def.permission}`);
    }
  }
});

// ============================================================================
// Invalidation matrix consistency
// ============================================================================

console.log('\n=== Invalidation matrix ===');

check('auditInvalidationMatrix() returns no problems', () => {
  const problems = auditInvalidationMatrix();
  if (problems.length > 0) {
    throw new Error(`matrix problems:\n  ${problems.join('\n  ')}`);
  }
});

check('every documented cache tag from contract §2.5 is in the matrix', () => {
  // Per the design contract §2.5 invalidation matrix
  const documentedTags = [
    'worklist',
    'case-detail',
    'case-tasks',
    'tasks-mine',
    'queues',
    'notes',
    'files',
    'appeal-detail',
  ];
  const matrixTags = new Set(Object.keys(INVALIDATE));
  for (const tag of documentedTags) {
    if (!matrixTags.has(tag)) {
      throw new Error(`documented tag '${tag}' missing from INVALIDATE matrix`);
    }
  }
});

check('every query with a cache tag uses a known tag', () => {
  const reg = getRegistry();
  const matrixTags = new Set(Object.keys(INVALIDATE));
  const referenceDataTags = new Set([
    'categories',
    'lookup-clinics',
    'lookup-providers',
    'lookup-payers',
    'lookup-facilities',
    'transactions', // vendor data; no FE-driven invalidation
  ]);
  for (const [id, def] of reg) {
    if (def.kind !== 'query') continue;
    const tag = def.cache?.tag;
    if (tag === undefined) {
      throw new Error(`query ${id} has no cache.tag`);
    }
    if (!matrixTags.has(tag) && !referenceDataTags.has(tag)) {
      throw new Error(`query ${id} uses unknown cache tag '${tag}'`);
    }
  }
});

check('every invalidatedBy entry on a query references a real mutation', () => {
  const reg = getRegistry();
  const mutations = new Set<string>(MUTATION_ACTION_IDS);
  for (const [id, def] of reg) {
    if (def.kind !== 'query' || !def.cache) continue;
    for (const m of def.cache.invalidatedBy) {
      if (!mutations.has(m)) {
        throw new Error(
          `query ${id} invalidatedBy references unknown mutation '${m}'`,
        );
      }
    }
  }
});

// ============================================================================
// Tab data schemas
// ============================================================================

console.log('\n=== Tab data schemas ===');

check('NoteSchema parses an analyst-typed note', () => {
  NoteSchema.parse({
    note_id: 'note_abc123',
    case_id: 'case_8af3c1',
    body: 'Records pulled from facility EMR.',
    source: 'analyst',
    author_user_id: 42,
    author_user_name: 'Vipin K.',
    created_at: '2026-06-11T10:00:00Z',
  });
});

check('NoteSchema parses a system-emitted note (null author)', () => {
  NoteSchema.parse({
    note_id: 'note_xyz789',
    case_id: 'case_8af3c1',
    body: 'Engine: workflow medical_necessity_resolution started.',
    source: 'system',
    author_user_id: null,
    author_user_name: null,
    created_at: '2026-06-11T09:30:00Z',
  });
});

check('NotesResponseSchema parses a list', () => {
  NotesResponseSchema.parse({ notes: [] });
});

check('FileSchema parses a medical record', () => {
  FileSchema.parse({
    file_id: 'file_aaa111',
    case_id: 'case_8af3c1',
    file_name: 'medical_records.pdf',
    file_type: 'medical_record',
    size_bytes: 245678,
    mime_type: 'application/pdf',
    uploaded_by_user_id: 42,
    uploaded_by_user_name: 'Vipin K.',
    uploaded_at: '2026-06-11T11:00:00Z',
  });
});

check('FileSchema rejects unknown file_type', () => {
  const r = FileSchema.safeParse({
    file_id: 'file_bad',
    case_id: 'case_8af3c1',
    file_name: 'x.pdf',
    file_type: 'unknown_type',
    size_bytes: 1,
    mime_type: 'application/pdf',
    uploaded_by_user_id: null,
    uploaded_by_user_name: null,
    uploaded_at: '2026-06-11T11:00:00Z',
  });
  if (r.success) throw new Error('should reject');
});

check('AppealSchema parses an LLM-generated draft', () => {
  AppealSchema.parse({
    appeal_id: 'appeal_def456',
    case_id: 'case_8af3c1',
    template: 'medical_necessity',
    status: 'draft',
    body: '# Appeal Letter\n\nDear Humana Gold Plus,\n\n...',
    generated_at: '2026-06-11T12:00:00Z',
    generated_by_model: 'gpt-4-turbo',
    created_at: '2026-06-11T12:00:00Z',
    updated_at: '2026-06-11T12:00:00Z',
  });
});

check('AppealSchema parses a finalized appeal', () => {
  AppealSchema.parse({
    appeal_id: 'appeal_def456',
    case_id: 'case_8af3c1',
    template: 'medical_necessity',
    status: 'finalized',
    body: '...',
    generated_at: '2026-06-11T12:00:00Z',
    generated_by_model: 'gpt-4-turbo',
    created_at: '2026-06-11T12:00:00Z',
    updated_at: '2026-06-11T15:00:00Z',
  });
});

check('TransactionSchema parses a denial transaction', () => {
  TransactionSchema.parse({
    transaction_id: 'txn_ghi789',
    claim_id: 300138,
    case_id: 'case_8af3c1',
    transaction_type: 'denial',
    payer_source: 'primary',
    amount: -250.0,
    transaction_date: '2026-02-28',
    carc_code: 'CO-50',
    rarc_code: null,
    remit_reason_text: 'Service not medically necessary.',
  });
});

check('TransactionSchema parses a payment transaction', () => {
  TransactionSchema.parse({
    transaction_id: 'txn_jkl012',
    claim_id: 300138,
    case_id: 'case_8af3c1',
    transaction_type: 'payment',
    payer_source: 'patient',
    amount: 20.0,
    transaction_date: '2026-03-15',
    carc_code: null,
    rarc_code: null,
    remit_reason_text: null,
  });
});

check('CategorySchema parses a category with workflow mapping', () => {
  CategorySchema.parse({
    code: 'medical_necessity',
    label: 'Medical Necessity',
    workflow_name: 'medical_necessity_resolution',
    workflow_step_count: 5,
    workflow_step_labels: [
      'Intake triage',
      'Pull records',
      'Generate appeal',
      'Submit appeal',
      'Await payer',
    ],
  });
});

check('LookupItemSchema parses with and without alias', () => {
  LookupItemSchema.parse({
    id: 'clinic_lsat',
    name: 'Live Specialty Allergy Treatment',
    alias: 'LSAT',
  });
  LookupItemSchema.parse({
    id: 'clinic_xyz',
    name: 'Some Clinic',
    alias: null,
  });
});

// ============================================================================
// Spot-check specific action shapes (the high-value ones)
// ============================================================================

console.log('\n=== Spot-check action shapes ===');

check("'case.worklist' has worklist cache tag with all 5 invalidators", () => {
  const reg = getRegistry();
  const def = reg.get('case.worklist');
  if (!def?.cache) throw new Error('no cache config');
  if (def.cache.tag !== 'worklist') throw new Error('wrong tag');
  if (def.cache.invalidatedBy.length !== 5) {
    throw new Error(
      `expected 5 invalidators, got ${def.cache.invalidatedBy.length}`,
    );
  }
});

check("'task.complete' is permission denial.act", () => {
  const reg = getRegistry();
  const def = reg.get('task.complete');
  if (def?.permission !== 'denial.act') {
    throw new Error(`wrong permission: ${def?.permission}`);
  }
});

check("'case.reclassify' is permission denial.classify (manager-only)", () => {
  const reg = getRegistry();
  const def = reg.get('case.reclassify');
  if (def?.permission !== 'denial.classify') {
    throw new Error(`wrong permission: ${def?.permission}`);
  }
});

check("'queue.list' invalidates on case.accept, task.complete, case.signal", () => {
  const reg = getRegistry();
  const def = reg.get('queue.list');
  if (!def?.cache) throw new Error('no cache config');
  const expected = new Set(['case.accept', 'task.complete', 'case.signal']);
  const actual = new Set(def.cache.invalidatedBy);
  if (actual.size !== expected.size) {
    throw new Error(
      `expected ${expected.size} invalidators, got ${actual.size}`,
    );
  }
  for (const e of expected) {
    if (!actual.has(e)) throw new Error(`missing invalidator: ${e}`);
  }
});

check("'case.transactions' has no FE-driven invalidation", () => {
  const reg = getRegistry();
  const def = reg.get('case.transactions');
  if (!def?.cache) throw new Error('no cache config');
  if (def.cache.invalidatedBy.length !== 0) {
    throw new Error('transactions should not be FE-invalidated');
  }
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
