/**
 * In-memory database for the v4.1 mock-server (engine-handler model).
 *
 * The heart of the change from v4.0.0: this is a LOCAL WORKLIST TABLE of
 * dispatched tasks (mirroring DMS's `analyst_worklist_task`), not an engine
 * queue. Completing a task closes its row and dispatches the next task as a
 * NEW row — the dispatch/handler loop.
 *
 * Stores:
 *   - tasks:        task_id → WorklistTask (the worklist rows)
 *   - cases:        case_id → CaseRow (case detail + running facts)
 *   - notes:        case_id → Note[]
 *   - files:        case_id → FileEntity[]
 *   - appeals:      appeal_id → Appeal
 *   - transactions: case_id → Transaction[]
 *
 * Drop-in path: src/mocks/server/db.ts
 */

import { nextDispatch, stateCodeForTask, type Dispatch } from './routing';
import type {
  WorklistTask,
  CaseDetail,
  CaseFacts,
  HandlerOutcome,
  Team,
  TaskType,
  Priority,
} from '../../actions/schemas';
import type { Note, FileEntity, Appeal, Transaction } from '../../actions/schemas-v4-tabs';

// ============================================================================
// Stores
// ============================================================================

interface CaseRow {
  case_id: string;
  state_code: string | null;
  case_facts: CaseFacts;
  detail: CaseDetail;
}

export const db = {
  tasks: new Map<string, WorklistTask>(),
  cases: new Map<string, CaseRow>(),
  notes: new Map<string, Note[]>(),
  files: new Map<string, FileEntity[]>(),
  appeals: new Map<string, Appeal>(),
  transactions: new Map<string, Transaction[]>(),

  _seq: { case: 0, task: 0, note: 0, file: 0, appeal: 0, txn: 0, audit: 0 },
};

// ============================================================================
// ID generators
// ============================================================================

export function nextCaseId(): string {
  db._seq.case += 1;
  return `C-DENIAL-${db._seq.case.toString().padStart(4, '0')}`;
}
export function nextTaskId(): string {
  db._seq.task += 1;
  return `T-${db._seq.task.toString().padStart(6, '0')}`;
}
export function nextNoteId(): string {
  db._seq.note += 1;
  return `note_${db._seq.note}`;
}
export function nextFileId(): string {
  db._seq.file += 1;
  return `file_${db._seq.file}`;
}
export function nextAppealId(): string {
  db._seq.appeal += 1;
  return `appeal_${db._seq.appeal}`;
}
export function nextTxnId(): string {
  db._seq.txn += 1;
  return `txn_${db._seq.txn}`;
}
export function nextAuditId(): string {
  db._seq.audit += 1;
  return `audit_${db._seq.audit}`;
}

export function resetDb(): void {
  db.tasks.clear();
  db.cases.clear();
  db.notes.clear();
  db.files.clear();
  db.appeals.clear();
  db.transactions.clear();
  db._seq = { case: 0, task: 0, note: 0, file: 0, appeal: 0, txn: 0, audit: 0 };
}

// ============================================================================
// Case + task creation
// ============================================================================

export interface NewCaseInput {
  detail: Omit<CaseDetail, 'created_at' | 'updated_at' | 'state_code' | 'open_task_ids' | 'case_facts'>;
  case_facts: CaseFacts;
}

/** Create a case (no task yet). */
export function createCase(input: NewCaseInput): CaseRow {
  const now = new Date().toISOString();
  const case_id = input.detail.case_id;
  const detail: CaseDetail = {
    ...input.detail,
    case_facts: input.case_facts,
    state_code: null,
    open_task_ids: [],
    created_at: now,
    updated_at: now,
  };
  const row: CaseRow = {
    case_id,
    state_code: null,
    case_facts: input.case_facts,
    detail,
  };
  db.cases.set(case_id, row);
  if (!db.notes.has(case_id)) db.notes.set(case_id, []);
  if (!db.files.has(case_id)) db.files.set(case_id, []);
  if (!db.transactions.has(case_id)) db.transactions.set(case_id, []);
  return row;
}

/**
 * Dispatch a task to the worklist — creates a new OPEN WorklistTask row and
 * links it to its case. This is the inbound "engine pushes a task to DMS" step.
 */
export function dispatchTask(
  case_id: string,
  dispatch: Dispatch,
  opts: { priority?: Priority } = {},
): WorklistTask {
  const caseRow = db.cases.get(case_id);
  if (caseRow === undefined) throw new Error(`dispatchTask: unknown case ${case_id}`);

  const task_id = nextTaskId();
  const now = new Date().toISOString();
  const d = caseRow.detail;

  const row: WorklistTask = {
    task_id,
    case_id,
    task_type: dispatch.task_type,
    status: 'OPEN',
    priority: opts.priority ?? 'normal',
    team: dispatch.team,
    dispatched_at: now,
    case_context: {
      case_type: 'DENIAL',
      state_code: stateCodeForTask(dispatch.task_type),
      task_type: dispatch.task_type,
      clinic_id: d.clinic_id,
      payer_id: d.primary_payer_id,
    },
    case_facts: { ...caseRow.case_facts },
    claim_summary: {
      claim_id: d.claim_id,
      patient_name: d.patient_name,
      mrn: d.mrn,
      dos: d.dos,
      net_pending: d.net_pending,
      aging_bucket: d.aging_bucket,
      primary_payer_name: d.primary_payer_name,
      clinic_name: d.clinic_name,
    },
  };

  db.tasks.set(task_id, row);
  caseRow.state_code = row.case_context.state_code;
  caseRow.detail.state_code = row.case_context.state_code;
  caseRow.detail.open_task_ids = [...caseRow.detail.open_task_ids, task_id];
  return row;
}

// ============================================================================
// Task completion — the dispatch/handler loop
// ============================================================================

export interface CompleteInput {
  outcome: HandlerOutcome;
  facts_to_set: Record<string, unknown>;
  completion_note?: string;
}

export interface CompleteResult {
  closed_task: WorklistTask;
  next_task: WorklistTask | null;
  case_resolved: boolean;
}

/**
 * Complete a task. Closes the row, merges facts into the case, emits a system
 * note, and dispatches the next task (or resolves the case). Mirrors DMS
 * reporting the outcome to the engine + the engine's next dispatch.
 */
export function completeTask(task_id: string, input: CompleteInput): CompleteResult {
  const row = db.tasks.get(task_id);
  if (row === undefined) throw new Error(`completeTask: unknown task ${task_id}`);
  if (row.status !== 'OPEN') throw new Error(`completeTask: task ${task_id} is not OPEN`);

  const caseRow = db.cases.get(row.case_id);
  if (caseRow === undefined) throw new Error(`completeTask: unknown case ${row.case_id}`);

  // Close the row
  row.status = 'COMPLETED';
  caseRow.detail.open_task_ids = caseRow.detail.open_task_ids.filter((id) => id !== task_id);

  // Merge facts forward onto the case
  caseRow.case_facts = { ...caseRow.case_facts, ...(input.facts_to_set as Partial<CaseFacts>) };
  caseRow.detail.case_facts = caseRow.case_facts;
  caseRow.detail.updated_at = new Date().toISOString();

  // Emit a system note for the transition
  addNote(row.case_id, {
    body: `Task ${row.task_type} completed (${input.outcome}).${
      input.completion_note ? ` Note: ${input.completion_note}` : ''
    }`,
    source: 'system',
    author_user_id: null,
    author_user_name: null,
  });

  // Compute + dispatch the next task
  const next = nextDispatch(row.task_type, input.outcome, caseRow.case_facts as Record<string, unknown>);
  if (next === null) {
    caseRow.state_code = 'RESOLVED';
    caseRow.detail.state_code = 'RESOLVED';
    addNote(row.case_id, {
      body: 'Case resolved — no further tasks.',
      source: 'system',
      author_user_id: null,
      author_user_name: null,
    });
    return { closed_task: row, next_task: null, case_resolved: true };
  }

  const nextRow = dispatchTask(row.case_id, next, { priority: row.priority });
  return { closed_task: row, next_task: nextRow, case_resolved: false };
}

// ============================================================================
// Worklist query (filters the LOCAL table — no engine call)
// ============================================================================

export interface WorklistFilters {
  team?: Team;
  task_type?: TaskType[];
  status?: ('OPEN' | 'PARKED' | 'COMPLETED')[];
  priority?: Priority;
  clinic_id?: string;
  primary_payer_id?: string;
  aging_bucket?: string;
  is_high_dollar?: boolean;
  page?: number;
  page_size?: number;
}

export interface WorklistPage {
  rows: WorklistTask[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export function queryWorklist(filters: WorklistFilters): WorklistPage {
  const status = filters.status ?? ['OPEN'];
  let rows = [...db.tasks.values()].filter((t) => status.includes(t.status));

  if (filters.team !== undefined) rows = rows.filter((t) => t.team === filters.team);
  if (filters.task_type !== undefined && filters.task_type.length > 0) {
    rows = rows.filter((t) => filters.task_type!.includes(t.task_type));
  }
  if (filters.priority !== undefined) rows = rows.filter((t) => t.priority === filters.priority);
  if (filters.clinic_id !== undefined) rows = rows.filter((t) => t.case_context.clinic_id === filters.clinic_id);
  if (filters.primary_payer_id !== undefined) rows = rows.filter((t) => t.case_context.payer_id === filters.primary_payer_id);
  if (filters.aging_bucket !== undefined) rows = rows.filter((t) => t.claim_summary.aging_bucket === filters.aging_bucket);
  if (filters.is_high_dollar !== undefined) rows = rows.filter((t) => t.case_facts.is_high_dollar === filters.is_high_dollar);

  // Newest dispatch first
  rows.sort((a, b) => b.dispatched_at.localeCompare(a.dispatched_at));

  const total = rows.length;
  const page = filters.page ?? 1;
  const page_size = filters.page_size ?? 50;
  const start = (page - 1) * page_size;
  const pageRows = rows.slice(start, start + page_size);

  return {
    rows: pageRows,
    page,
    page_size,
    total,
    has_more: start + page_size < total,
  };
}

/** Per-team open counts for the switcher badges. */
export function worklistCounts(): Partial<Record<Team, number>> {
  const counts: Partial<Record<Team, number>> = {};
  for (const t of db.tasks.values()) {
    if (t.status !== 'OPEN') continue;
    counts[t.team] = (counts[t.team] ?? 0) + 1;
  }
  return counts;
}

// ============================================================================
// Getters
// ============================================================================

export function getTask(task_id: string): WorklistTask | undefined {
  return db.tasks.get(task_id);
}
export function getCaseDetail(case_id: string): CaseDetail | undefined {
  return db.cases.get(case_id)?.detail;
}
export function getNotes(case_id: string): Note[] {
  return db.notes.get(case_id) ?? [];
}
export function getFiles(case_id: string): FileEntity[] {
  return db.files.get(case_id) ?? [];
}
export function getTransactions(case_id: string): Transaction[] {
  return db.transactions.get(case_id) ?? [];
}
export function getAppeal(appeal_id: string): Appeal | undefined {
  return db.appeals.get(appeal_id);
}

// ============================================================================
// Mutations on tab data
// ============================================================================

export function addNote(
  case_id: string,
  note: Omit<Note, 'note_id' | 'case_id' | 'created_at'>,
): Note {
  const full: Note = {
    note_id: nextNoteId(),
    case_id,
    created_at: new Date().toISOString(),
    ...note,
  };
  const list = db.notes.get(case_id) ?? [];
  list.push(full);
  db.notes.set(case_id, list);
  return full;
}

export function addFile(
  case_id: string,
  file: Omit<FileEntity, 'file_id' | 'case_id' | 'uploaded_at'>,
): FileEntity {
  const full: FileEntity = {
    file_id: nextFileId(),
    case_id,
    uploaded_at: new Date().toISOString(),
    ...file,
  };
  const list = db.files.get(case_id) ?? [];
  list.push(full);
  db.files.set(case_id, list);
  return full;
}

export function addTransaction(
  case_id: string,
  txn: Omit<Transaction, 'transaction_id' | 'case_id'>,
): Transaction {
  const full: Transaction = {
    transaction_id: nextTxnId(),
    case_id,
    ...txn,
  };
  const list = db.transactions.get(case_id) ?? [];
  list.push(full);
  db.transactions.set(case_id, list);
  return full;
}

export function createAppeal(
  case_id: string,
  template: Appeal['template'],
  body: string,
): Appeal {
  const now = new Date().toISOString();
  const appeal: Appeal = {
    appeal_id: nextAppealId(),
    case_id,
    template,
    status: 'draft',
    body,
    generated_at: now,
    generated_by_model: 'gpt-4o-2024-08-06',
    created_at: now,
    updated_at: now,
  };
  db.appeals.set(appeal.appeal_id, appeal);
  return appeal;
}

export function updateAppeal(
  appeal_id: string,
  patch: Partial<Pick<Appeal, 'body' | 'status'>>,
): Appeal {
  const appeal = db.appeals.get(appeal_id);
  if (appeal === undefined) throw new Error(`updateAppeal: unknown appeal ${appeal_id}`);
  const updated: Appeal = {
    ...appeal,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  db.appeals.set(appeal_id, updated);
  return updated;
}
