/**
 * Runtime sanity check for index.ts (engine-handler action registry).
 * Run with: npx tsx scripts/sanity-check-registry.ts
 */

import {
  defineAction as _defineAction,
  getRegistry,
  clearRegistry,
  type ActionDefinition,
} from '../stubs/tensaw/actions';
import { registerWorklistActions, INVALIDATE } from '../src/actions/index';

void _defineAction; // (imported to mirror the real module surface)

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

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Register fresh
clearRegistry();
registerWorklistActions();
const reg = getRegistry();
const ids = [...reg.keys()].sort();
const byId = (id: string): ActionDefinition | undefined => reg.get(id);

// ============================================================================
// Counts + composition
// ============================================================================

console.log('=== Registry composition ===');

check('registers exactly 19 actions (13 read + 6 write)', () => {
  assert(reg.size === 19, `expected 19, got ${reg.size}: ${ids.join(', ')}`);
  const reads = ids.filter((id) => byId(id)!.kind === 'query');
  const writes = ids.filter((id) => byId(id)!.kind === 'mutation');
  assert(reads.length === 13, `expected 13 reads, got ${reads.length}`);
  assert(writes.length === 6, `expected 6 writes, got ${writes.length}`);
});

// ============================================================================
// The four reversals — dropped actions must be absent
// ============================================================================

console.log('\n=== Dropped actions (the reversals) ===');

const DROPPED = [
  'case.worklist', // → renamed worklist.list
  'case.tasks', // engine read-through; FE no longer reads engine
  'task.mine', // no personal queue
  'queue.list', // queues are the Team enum now, not a dynamic engine list
  'case.accept', // no accept-to-start-workflow
  'case.override', // override → triage form field
  'case.reclassify', // no FE re-run-LLM action
  'case.signal', // FE no longer signals the engine
  'task.complete', // → renamed worklist.complete
];

for (const id of DROPPED) {
  check(`${id} is NOT registered`, () => {
    assert(!reg.has(id), `${id} should have been dropped/renamed in v4.1`);
  });
}

// ============================================================================
// Renames + adds present
// ============================================================================

console.log('\n=== Renames + adds ===');

check('worklist.list reads /api/v1/worklist (DMS-local, not engine)', () => {
  const a = byId('worklist.list');
  assert(a !== undefined, 'worklist.list missing');
  assert(a!.kind === 'query', 'should be a query');
  assert(a!.endpoint.includes('/api/v1/worklist'), `unexpected endpoint: ${a!.endpoint}`);
});

check('worklist.task is registered (single dispatched-task detail)', () => {
  const a = byId('worklist.task');
  assert(a !== undefined && a.kind === 'query', 'worklist.task missing or wrong kind');
  assert(a!.endpoint.includes('{task_id}'), 'should be task-scoped');
});

check('worklist.counts is registered (switcher badges; WIRING TODO)', () => {
  const a = byId('worklist.counts');
  assert(a !== undefined && a.kind === 'query', 'worklist.counts missing or wrong kind');
});

check('worklist.complete is the completion mutation', () => {
  const a = byId('worklist.complete');
  assert(a !== undefined && a.kind === 'mutation', 'worklist.complete missing or wrong kind');
  assert(
    a!.endpoint.includes('/complete') && a!.endpoint.includes('{task_id}'),
    `unexpected endpoint: ${a!.endpoint}`,
  );
});

check('case.detail is a query at /api/v1/cases/{case_id}', () => {
  const a = byId('case.detail');
  assert(a !== undefined && a.kind === 'query', 'case.detail missing or wrong kind');
  assert(a!.endpoint.includes('/api/v1/cases/{case_id}'), `unexpected endpoint: ${a!.endpoint}`);
});

// ============================================================================
// Unchanged surfaces still present
// ============================================================================

console.log('\n=== Unchanged surfaces ===');

const UNCHANGED = [
  'case.notes',
  'case.files',
  'case.transactions',
  'case.appeal.get',
  'category.list',
  'lookup.clinics',
  'lookup.providers',
  'lookup.payers',
  'lookup.facilities',
  'case.note.add',
  'case.file.upload',
  'case.appeal.generate',
  'case.appeal.save',
  'case.reveal-phi',
];

for (const id of UNCHANGED) {
  check(`${id} carried over unchanged`, () => {
    assert(reg.has(id), `${id} should still be registered`);
  });
}

// ============================================================================
// INVALIDATE matrix — worklist.complete is the engine driver
// ============================================================================

console.log('\n=== INVALIDATE matrix ===');

check('worklist tag invalidated by worklist.complete', () => {
  assert(
    (INVALIDATE.worklist as readonly string[]).includes('worklist.complete'),
    'completing a task should invalidate the worklist',
  );
});

check('worklist-counts invalidated by worklist.complete', () => {
  assert(
    (INVALIDATE['worklist-counts'] as readonly string[]).includes('worklist.complete'),
    'counts should refresh after completion',
  );
});

check('case-detail invalidated by worklist.complete + note.add + appeal.*', () => {
  const inv = INVALIDATE['case-detail'] as readonly string[];
  assert(inv.includes('worklist.complete'), 'missing worklist.complete');
  assert(inv.includes('case.note.add'), 'missing case.note.add');
  assert(inv.includes('case.appeal.save'), 'missing case.appeal.save');
});

check('notes invalidated by worklist.complete (engine emits transition notes)', () => {
  assert(
    (INVALIDATE.notes as readonly string[]).includes('worklist.complete'),
    'notes should refresh on task completion (system/transition notes)',
  );
});

check('no INVALIDATE entry references a dropped action', () => {
  const droppedSet = new Set(DROPPED);
  for (const [tag, actions] of Object.entries(INVALIDATE)) {
    for (const a of actions as readonly string[]) {
      assert(!droppedSet.has(a), `INVALIDATE.${tag} references dropped action ${a}`);
    }
  }
});

check('every INVALIDATE-referenced action is a registered mutation', () => {
  for (const [tag, actions] of Object.entries(INVALIDATE)) {
    for (const a of actions as readonly string[]) {
      const def = byId(a);
      assert(def !== undefined, `INVALIDATE.${tag} references unregistered ${a}`);
      assert(def!.kind === 'mutation', `INVALIDATE.${tag} references non-mutation ${a}`);
    }
  }
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
