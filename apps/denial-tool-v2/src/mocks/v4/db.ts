/**
 * In-memory database for the v4 mock-server.
 *
 * Stores:
 *   - cases:        case_id → CaseDetail (full shape with engine snapshot)
 *   - tasks:        task_id → EngineTask
 *   - notes:        case_id → Note[]
 *   - files:        case_id → FileEntity[]
 *   - appeals:      appeal_id → Appeal
 *   - transactions: case_id → Transaction[]
 *   - queues:       queue_id → Queue (with derived pending_count)
 *
 * State-transition helpers:
 *   - acceptCase / overrideCase: create first task, set originated_by
 *   - completeTask: advance to next task per workflow + outcome
 *   - reclassifyCase: re-roll the LLM recommendation (mock: noop)
 *
 * Drop-in path: src/mocks/v4/db.ts
 */

import {
  WORKFLOWS,
  CATEGORY_TO_WORKFLOW,
  getFirstTaskDef,
  getNextTaskDef,
  engineStateCode,
} from './workflows';
import type {
  Case,
  CaseDetail,
  EngineTask,
  Queue,
  HandlerOutcome,
} from '../../actions/schemas-v4';
import type {
  Note,
  FileEntity,
  Appeal,
  Transaction,
} from '../../actions/schemas-v4-tabs';

// ============================================================================
// Stores
// ============================================================================

interface CaseRow extends CaseDetail {
  // Internal: which workflow step the case is currently on (0-indexed)
  _workflow_step_index: number;
}

export const db = {
  cases: new Map<string, CaseRow>(),
  tasks: new Map<string, EngineTask>(),
  notes: new Map<string, Note[]>(),
  files: new Map<string, FileEntity[]>(),
  appeals: new Map<string, Appeal>(),
  transactions: new Map<string, Transaction[]>(),

  // Sequence counters for ID generation
  _seq: {
    case: 0,
    task: 0,
    note: 0,
    file: 0,
    appeal: 0,
    txn: 0,
    audit: 0,
  },
};

// ============================================================================
// ID generators (predictable, debuggable)
// ============================================================================

export function nextCaseId(): string {
  db._seq.case += 1;
  return `case_${db._seq.case.toString().padStart(6, '0')}`;
}

export function nextTaskId(): string {
  db._seq.task += 1;
  return `eng_t_${db._seq.task.toString().padStart(6, '0')}`;
}

function nextNoteId(): string {
  db._seq.note += 1;
  return `note_${db._seq.note.toString().padStart(6, '0')}`;
}

function nextFileId(): string {
  db._seq.file += 1;
  return `file_${db._seq.file.toString().padStart(6, '0')}`;
}

function nextAppealId(): string {
  db._seq.appeal += 1;
  return `appeal_${db._seq.appeal.toString().padStart(6, '0')}`;
}

function nextTxnId(): string {
  db._seq.txn += 1;
  return `txn_${db._seq.txn.toString().padStart(6, '0')}`;
}

export function nextAuditId(): string {
  db._seq.audit += 1;
  return `audit_${db._seq.audit.toString().padStart(6, '0')}`;
}

// ============================================================================
// Date / time helpers
// ============================================================================

export function nowISO(): string {
  return new Date().toISOString();
}

export function plusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// ============================================================================
// CRUD
// ============================================================================

export function insertCase(row: CaseRow): void {
  db.cases.set(row.case_id, row);
  // Initialize empty per-case collections
  if (!db.notes.has(row.case_id)) db.notes.set(row.case_id, []);
  if (!db.files.has(row.case_id)) db.files.set(row.case_id, []);
  if (!db.transactions.has(row.case_id)) db.transactions.set(row.case_id, []);
}

export function getCase(caseId: string): CaseRow | undefined {
  return db.cases.get(caseId);
}

export function insertTask(task: EngineTask): void {
  db.tasks.set(task.task_id, task);
  // Add to case's engine_tasks_open
  const c = db.cases.get(task.case_id);
  if (c) c.engine_tasks_open.push(task);
}

export function getTask(taskId: string): EngineTask | undefined {
  return db.tasks.get(taskId);
}

export function addNote(note: Omit<Note, 'note_id' | 'created_at'>): Note {
  const full: Note = {
    ...note,
    note_id: nextNoteId(),
    created_at: nowISO(),
  };
  const arr = db.notes.get(note.case_id) ?? [];
  arr.push(full);
  db.notes.set(note.case_id, arr);
  return full;
}

export function getNotes(caseId: string): Note[] {
  return db.notes.get(caseId) ?? [];
}

export function addFile(file: Omit<FileEntity, 'file_id' | 'uploaded_at'>): FileEntity {
  const full: FileEntity = {
    ...file,
    file_id: nextFileId(),
    uploaded_at: nowISO(),
  };
  const arr = db.files.get(file.case_id) ?? [];
  arr.push(full);
  db.files.set(file.case_id, arr);
  return full;
}

export function getFiles(caseId: string): FileEntity[] {
  return db.files.get(caseId) ?? [];
}

export function createAppeal(
  partial: Omit<Appeal, 'appeal_id' | 'created_at' | 'updated_at'>,
): Appeal {
  const now = nowISO();
  const appeal: Appeal = {
    ...partial,
    appeal_id: nextAppealId(),
    created_at: now,
    updated_at: now,
  };
  db.appeals.set(appeal.appeal_id, appeal);
  return appeal;
}

export function getAppeal(appealId: string): Appeal | undefined {
  return db.appeals.get(appealId);
}

export function updateAppeal(appealId: string, body: string, status?: Appeal['status']): Appeal | null {
  const existing = db.appeals.get(appealId);
  if (!existing) return null;
  const updated: Appeal = {
    ...existing,
    body,
    status: status ?? existing.status,
    updated_at: nowISO(),
  };
  db.appeals.set(appealId, updated);
  return updated;
}

export function addTransaction(txn: Omit<Transaction, 'transaction_id'>): Transaction {
  const full: Transaction = { ...txn, transaction_id: nextTxnId() };
  const arr = db.transactions.get(txn.case_id) ?? [];
  arr.push(full);
  db.transactions.set(txn.case_id, arr);
  return full;
}

export function getTransactions(caseId: string): Transaction[] {
  return db.transactions.get(caseId) ?? [];
}

// ============================================================================
// State-transition logic (the engine simulator)
// ============================================================================

/**
 * Accept a case. Sets case_status=accepted, originated_by=userId, spins up
 * the workflow and opens the first task. Emits a classifier note.
 *
 * Returns updated case + first task (or null if workflow has no human tasks).
 */
export function acceptCase(
  caseId: string,
  userId: number,
  userName: string,
): { ok: true; case: CaseRow; next_task: EngineTask | null } | { ok: false; error: string } {
  const c = db.cases.get(caseId);
  if (!c) return { ok: false, error: 'case not found' };
  if (c.case_status !== 'proposed') {
    return { ok: false, error: `cannot accept from state ${c.case_status}` };
  }

  const category = c.recommended_category;
  if (!category) return { ok: false, error: 'no recommended_category to accept' };
  const workflowName = CATEGORY_TO_WORKFLOW[category];
  if (!workflowName) return { ok: false, error: `no workflow for category ${category}` };

  // Mutate the case
  c.case_status = 'accepted';
  c.originated_by_user_id = userId;
  c.originated_by_user_name = userName;
  c.originated_at = nowISO();
  c.workflow_name = workflowName;
  c.engine_state_code = engineStateCode(workflowName, 0);
  c._workflow_step_index = 0;
  c.updated_at = nowISO();

  // Open the first task
  const firstStep = getFirstTaskDef(workflowName);
  let nextTask: EngineTask | null = null;
  if (firstStep) {
    nextTask = {
      task_id: nextTaskId(),
      case_id: caseId,
      task_type: firstStep.task_type,
      state_code: 'OPEN',
      queue_id: firstStep.queue_id,
      priority_code: 'normal',
      opened_at: nowISO(),
      due_at: plusDays(firstStep.sla_days),
      intent_key: `${firstStep.task_type}:${caseId}`,
      handler_key: null,
      attempt_count: 0,
    };
    insertTask(nextTask);
  }

  // Auto-emit classifier note
  addNote({
    case_id: caseId,
    body: `Analyst ${userName} accepted: LLM recommended \`${category}\` with confidence ${c.recommended_confidence ?? '?'}. Workflow ${workflowName} started.`,
    source: 'classifier',
    author_user_id: null,
    author_user_name: null,
  });

  return { ok: true, case: c, next_task: nextTask };
}

/**
 * Override a case. Similar to acceptCase but with override_category instead
 * of the LLM's recommended_category.
 */
export function overrideCase(
  caseId: string,
  userId: number,
  userName: string,
  overrideCategory: string,
  reasoning: string | undefined,
): { ok: true; case: CaseRow; next_task: EngineTask | null } | { ok: false; error: string } {
  const c = db.cases.get(caseId);
  if (!c) return { ok: false, error: 'case not found' };
  if (c.case_status !== 'proposed') {
    return { ok: false, error: `cannot override from state ${c.case_status}` };
  }

  const workflowName = CATEGORY_TO_WORKFLOW[overrideCategory];
  if (!workflowName) {
    return { ok: false, error: `no workflow for override_category ${overrideCategory}` };
  }

  // Mutate the case — note we keep recommended_* for audit/comparison but
  // the workflow follows the overridden category
  c.case_status = 'overridden';
  c.originated_by_user_id = userId;
  c.originated_by_user_name = userName;
  c.originated_at = nowISO();
  c.workflow_name = workflowName;
  c.engine_state_code = engineStateCode(workflowName, 0);
  c._workflow_step_index = 0;
  c.updated_at = nowISO();

  const firstStep = getFirstTaskDef(workflowName);
  let nextTask: EngineTask | null = null;
  if (firstStep) {
    nextTask = {
      task_id: nextTaskId(),
      case_id: caseId,
      task_type: firstStep.task_type,
      state_code: 'OPEN',
      queue_id: firstStep.queue_id,
      priority_code: 'normal',
      opened_at: nowISO(),
      due_at: plusDays(firstStep.sla_days),
      intent_key: `${firstStep.task_type}:${caseId}`,
      handler_key: null,
      attempt_count: 0,
    };
    insertTask(nextTask);
  }

  addNote({
    case_id: caseId,
    body: `Analyst ${userName} overrode to \`${overrideCategory}\`${reasoning ? `: ${reasoning}` : ''}. Workflow ${workflowName} started.`,
    source: 'classifier',
    author_user_id: null,
    author_user_name: null,
  });

  return { ok: true, case: c, next_task: nextTask };
}

/**
 * Complete a task with an outcome + facts. Engine advances state and opens
 * next task (or completes the case if last step).
 */
export function completeTask(
  caseId: string,
  taskId: string,
  outcome: HandlerOutcome,
  factsToSet: Record<string, unknown>,
  completionNote: string | undefined,
): { ok: true; case: CaseRow; next_task: EngineTask | null } | { ok: false; error: string } {
  const c = db.cases.get(caseId);
  if (!c) return { ok: false, error: 'case not found' };

  const task = db.tasks.get(taskId);
  if (!task) return { ok: false, error: 'task not found' };
  if (task.case_id !== caseId) return { ok: false, error: 'task does not belong to case' };
  if (task.state_code !== 'OPEN') {
    return { ok: false, error: `cannot complete task in state ${task.state_code}` };
  }

  // Mark task completed; move to recent
  task.state_code = 'COMPLETED';
  c.engine_tasks_open = c.engine_tasks_open.filter((t) => t.task_id !== taskId);
  c.engine_tasks_recent = [task, ...c.engine_tasks_recent].slice(0, 5);

  // Auto-emit system note for the completion
  addNote({
    case_id: caseId,
    body: `${task.task_type} task completed: ${outcome}${completionNote ? ` — ${completionNote}` : ''}. facts=${JSON.stringify(factsToSet)}`,
    source: 'system',
    author_user_id: null,
    author_user_name: null,
  });

  // FAIL_FATAL → close the case
  if (outcome === 'FAIL_FATAL') {
    c.case_status = 'completed';
    c.engine_state_code = 'FAILED';
    c.updated_at = nowISO();
    return { ok: true, case: c, next_task: null };
  }

  // SUCCESS or NEEDS_INFO → advance workflow
  // (For the mock, NEEDS_INFO behaves like SUCCESS but the engine would
  // typically spawn an info-gathering branch; we simplify.)
  if (!c.workflow_name) {
    return { ok: false, error: 'case has no workflow_name' };
  }
  const next = getNextTaskDef(c.workflow_name, c._workflow_step_index);
  if (!next) {
    // Workflow done
    c.case_status = 'completed';
    c.engine_state_code = 'COMPLETED';
    c.updated_at = nowISO();
    return { ok: true, case: c, next_task: null };
  }

  // Build next task. Resolve queue_id placeholder for team-handoff return.
  let queueId = next.def.queue_id;
  if (queueId === 'user_<originator>') {
    if (c.originated_by_user_id === null) {
      return { ok: false, error: 'cannot route to originator: originated_by_user_id is null' };
    }
    queueId = `user_${c.originated_by_user_id}`;
  }

  const nextTask: EngineTask = {
    task_id: nextTaskId(),
    case_id: caseId,
    task_type: next.def.task_type,
    state_code: 'OPEN',
    queue_id: queueId,
    priority_code: 'normal',
    opened_at: nowISO(),
    due_at: plusDays(next.def.sla_days),
    intent_key: `${next.def.task_type}:${caseId}`,
    handler_key: null,
    attempt_count: 0,
  };
  insertTask(nextTask);

  c._workflow_step_index = next.nextIndex;
  c.engine_state_code = engineStateCode(c.workflow_name, next.nextIndex);
  c.updated_at = nowISO();

  return { ok: true, case: c, next_task: nextTask };
}

/**
 * Re-run the LLM classifier. Mock: just touches updated_at; in real life
 * the LLM might return a different category/confidence.
 */
export function reclassifyCase(caseId: string): CaseRow | null {
  const c = db.cases.get(caseId);
  if (!c) return null;
  c.classified_at = nowISO();
  c.updated_at = nowISO();
  return c;
}

// ============================================================================
// Worklist query helper
// ============================================================================

export interface WorklistQuery {
  queue_id: string;
  case_status?: string[];
  category?: string;
  primary_payer_id?: string;
  clinic_id?: string;
  aging_bucket?: string;
  priority?: string;
  net_pending_min?: number;
  net_pending_max?: number;
  page: number;
  page_size: number;
}

/**
 * Filter + paginate cases for the worklist endpoint. Joins each case with
 * its current_task (the most-relevant open task on the queried queue, or any
 * open task if the case has multiple).
 */
export function queryWorklist(
  q: WorklistQuery,
): { rows: Array<{ case: Case; current_task: EngineTask | null }>; has_more: boolean } {
  // Find all open tasks on the queue
  const tasksOnQueue: EngineTask[] = [];
  for (const t of db.tasks.values()) {
    if (t.queue_id === q.queue_id && t.state_code === 'OPEN') {
      tasksOnQueue.push(t);
    }
  }

  // Group by case_id
  const taskByCase = new Map<string, EngineTask>();
  for (const t of tasksOnQueue) {
    // If multiple, take the most recently opened (could be more sophisticated)
    const existing = taskByCase.get(t.case_id);
    if (!existing || t.opened_at > existing.opened_at) {
      taskByCase.set(t.case_id, t);
    }
  }

  // Get the cases
  let rows: Array<{ case: Case; current_task: EngineTask | null }> = [];
  for (const [caseId, task] of taskByCase) {
    const c = db.cases.get(caseId);
    if (!c) continue;

    // Apply filters
    if (q.case_status && q.case_status.length > 0 && !q.case_status.includes(c.case_status)) continue;
    if (q.category && c.recommended_category !== q.category) continue;
    if (q.aging_bucket && c.aging_bucket !== q.aging_bucket) continue;
    if (q.priority && task.priority_code !== q.priority) continue;
    if (q.net_pending_min !== undefined && c.net_pending < q.net_pending_min) continue;
    if (q.net_pending_max !== undefined && c.net_pending > q.net_pending_max) continue;

    rows.push({ case: stripCaseDetailExtras(c), current_task: task });
  }

  // Also include proposed cases (no open tasks yet, but in the queue's "scope")
  // For simplicity: if the queue is denial_intake_analyst_*, include all
  // proposed cases.
  if (q.queue_id.startsWith('denial_intake_analyst_')) {
    for (const c of db.cases.values()) {
      if (c.case_status !== 'proposed') continue;
      if (taskByCase.has(c.case_id)) continue;
      if (q.case_status && q.case_status.length > 0 && !q.case_status.includes(c.case_status)) continue;
      if (q.category && c.recommended_category !== q.category) continue;
      if (q.aging_bucket && c.aging_bucket !== q.aging_bucket) continue;
      if (q.net_pending_min !== undefined && c.net_pending < q.net_pending_min) continue;
      if (q.net_pending_max !== undefined && c.net_pending > q.net_pending_max) continue;
      rows.push({ case: stripCaseDetailExtras(c), current_task: null });
    }
  }

  // Sort: HD first, then by updated_at desc
  rows.sort((a, b) => {
    if (a.case.is_high_dollar !== b.case.is_high_dollar) {
      return a.case.is_high_dollar ? -1 : 1;
    }
    return b.case.updated_at.localeCompare(a.case.updated_at);
  });

  // Paginate
  const start = (q.page - 1) * q.page_size;
  const end = start + q.page_size;
  const paged = rows.slice(start, end);
  const hasMore = end < rows.length;

  return { rows: paged, has_more: hasMore };
}

/**
 * Strip the internal _workflow_step_index field + the engine_tasks_*
 * arrays from a CaseRow to produce a worklist-shape Case (matches schemas-v4).
 */
function stripCaseDetailExtras(c: CaseRow): Case {
  const {
    _workflow_step_index,
    engine_tasks_open,
    engine_tasks_recent,
    facility_name,
    facility_id,
    provider_name,
    icd_codes,
    payer_id,
    payer_alias,
    billed,
    paid_primary,
    paid_secondary,
    paid_tertiary,
    paid_patient,
    pending_primary,
    pending_secondary,
    pending_tertiary,
    ...worklistCase
  } = c;
  // Suppress unused-var warnings (intentional destructure to extract subset)
  void _workflow_step_index;
  void engine_tasks_open;
  void engine_tasks_recent;
  void facility_name;
  void facility_id;
  void provider_name;
  void icd_codes;
  void payer_id;
  void payer_alias;
  void billed;
  void paid_primary;
  void paid_secondary;
  void paid_tertiary;
  void paid_patient;
  void pending_primary;
  void pending_secondary;
  void pending_tertiary;
  return worklistCase;
}

// ============================================================================
// Queue list helper — derives pending_count from current state
// ============================================================================

export const QUEUE_DEFS: Queue[] = [
  {
    queue_id: 'denial_intake_analyst_primrose',
    queue_label: 'Denial Intake — Primrose',
    queue_type: 'team',
    is_default_for_caller: true,
    pending_count: 0,
  },
  {
    queue_id: 'user_42',
    queue_label: 'My personal queue',
    queue_type: 'personal',
    is_default_for_caller: false,
    pending_count: 0,
  },
  {
    queue_id: 'coding_primrose',
    queue_label: 'Coding partner — Primrose',
    queue_type: 'team',
    is_default_for_caller: false,
    pending_count: 0,
  },
  {
    queue_id: 'resolution_primrose',
    queue_label: 'Resolution — Primrose',
    queue_type: 'team',
    is_default_for_caller: false,
    pending_count: 0,
  },
  {
    queue_id: 'am_review_primrose',
    queue_label: 'AM Review — Primrose',
    queue_type: 'team',
    is_default_for_caller: false,
    pending_count: 0,
  },
  {
    queue_id: 'posting_primrose',
    queue_label: 'Posting — Primrose',
    queue_type: 'team',
    is_default_for_caller: false,
    pending_count: 0,
  },
  {
    queue_id: 'high_dollar_oversight_primrose',
    queue_label: 'High-Dollar Desk — Primrose',
    queue_type: 'team',
    is_default_for_caller: false,
    pending_count: 0,
  },
];

export function listQueuesWithCounts(): Queue[] {
  return QUEUE_DEFS.map((q) => {
    let count = 0;
    for (const t of db.tasks.values()) {
      if (t.queue_id === q.queue_id && t.state_code === 'OPEN') count += 1;
    }
    // For the intake queue, also count proposed cases (no task yet but in scope)
    if (q.queue_id.startsWith('denial_intake_analyst_')) {
      for (const c of db.cases.values()) {
        if (c.case_status === 'proposed') {
          let hasOpenTask = false;
          for (const t of db.tasks.values()) {
            if (t.case_id === c.case_id && t.queue_id === q.queue_id && t.state_code === 'OPEN') {
              hasOpenTask = true;
              break;
            }
          }
          if (!hasOpenTask) count += 1;
        }
      }
    }
    return { ...q, pending_count: count };
  });
}

/**
 * Workflow_step_count helper for category list responses.
 */
export function workflowStepCount(workflowName: string): number {
  return WORKFLOWS[workflowName]?.steps.length ?? 0;
}

export function workflowStepLabels(workflowName: string): string[] {
  return WORKFLOWS[workflowName]?.step_labels ?? [];
}
