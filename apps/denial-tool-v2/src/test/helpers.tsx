/**
 * Test helpers — shared fixtures + mock setup.
 *
 * Provides the standard CaseDetail fixture all tests use, plus a setupMocks()
 * helper that configures the action stubs with sensible defaults. Tests can
 * override any mock by calling __setQueryMock / __setMutationMock again.
 */

import { __setQueryMock, __setMutationMock } from '../../stubs/tensaw/actions';
import type { CaseDetail, EngineTask, Queue, TaskType } from '../actions/schemas-v4';

// ============================================================================
// Standard fixtures
// ============================================================================

export const baseCase: CaseDetail = {
  case_id: 'case_000001',
  case_status: 'proposed',
  originated_by_user_id: null,
  originated_by_user_name: null,
  originated_at: null,
  is_high_dollar: false,
  high_dollar_shim_case_id: null,
  workflow_name: null,
  engine_state_code: null,
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

export const queues: Queue[] = [
  {
    queue_id: 'denial_intake_analyst_primrose',
    queue_label: 'Denial Intake — Primrose',
    queue_type: 'team',
    is_default_for_caller: true,
    pending_count: 6,
  },
  {
    queue_id: 'coding_primrose',
    queue_label: 'Coding partner — Primrose',
    queue_type: 'team',
    is_default_for_caller: false,
    pending_count: 1,
  },
  {
    queue_id: 'user_42',
    queue_label: 'My personal queue',
    queue_type: 'personal',
    is_default_for_caller: false,
    pending_count: 3,
  },
];

export const categories = [
  {
    code: 'medical_necessity',
    label: 'Medical Necessity',
    workflow_name: 'medical_necessity_resolution',
    workflow_step_count: 5,
    workflow_step_labels: ['Intake', 'Resolution', 'Awaiting', 'AM review', 'Posting'],
  },
  {
    code: 'auth_missing',
    label: 'Auth Missing',
    workflow_name: 'payer_call_resolution',
    workflow_step_count: 4,
    workflow_step_labels: ['Intake', 'Payer call', 'Resolution', 'Awaiting'],
  },
  {
    code: 'modifier_missing',
    label: 'Modifier Missing',
    workflow_name: 'coding_review_branch',
    workflow_step_count: 6,
    workflow_step_labels: ['Intake', 'Coding', 'Feedback', 'Resolution', 'Awaiting', 'Posting'],
  },
];

export const clinics = [
  { id: 'clinic_lsat', name: 'LSAT Birmingham', alias: 'LSAT' },
  { id: 'clinic_prim_bhm', name: 'Primrose Birmingham', alias: 'PRIM_BHM' },
];

export const payers = [
  { id: 'payer_humana_gp', name: 'Humana Gold Plus', alias: 'Humana GP' },
  { id: 'payer_aetna_bh', name: 'Aetna Better Health', alias: 'Aetna BH' },
];

export function makeTask(taskType: TaskType, overrides: Partial<EngineTask> = {}): EngineTask {
  return {
    task_id: `eng_t_${taskType}`,
    case_id: 'case_000001',
    task_type: taskType,
    state_code: 'OPEN',
    queue_id: 'denial_intake_analyst_primrose',
    priority_code: 'normal',
    opened_at: '2026-06-12T10:00:00Z',
    due_at: '2026-06-14T10:00:00Z',
    intent_key: `${taskType}:case_000001`,
    handler_key: null,
    attempt_count: 0,
    ...overrides,
  };
}

// ============================================================================
// Mock setup helpers
// ============================================================================

/**
 * Configures the standard set of mocks needed by most tests:
 * queue.list, category.list, lookup.clinics, lookup.payers, case.detail,
 * case.worklist, and tab-related endpoints with empty defaults.
 *
 * Individual tests override what they need.
 */
export function setupStandardMocks(opts: {
  caseDetail?: CaseDetail;
  worklistRows?: Array<{ case: CaseDetail; current_task: EngineTask | null }>;
} = {}): void {
  const c = opts.caseDetail ?? baseCase;
  __setQueryMock('queue.list', { queues });
  __setQueryMock('category.list', { categories });
  __setQueryMock('lookup.clinics', { items: clinics });
  __setQueryMock('lookup.payers', { items: payers });
  __setQueryMock('case.detail', c);
  __setQueryMock('case.worklist', {
    rows: opts.worklistRows ?? [],
    page: 1,
    page_size: 25,
    has_more: false,
  });
  __setQueryMock('case.notes', { notes: [] });
  __setQueryMock('case.files', { files: [] });
  __setQueryMock('case.transactions', { transactions: [] });
  // case.appeal.get returns null when no appeal exists
  // Cast via unknown since the action's response type is Appeal (not Appeal | null
  // in the strict registry); runtime accepts null fine
  __setQueryMock(
    'case.appeal.get',
    null as unknown as Parameters<typeof __setQueryMock<'case.appeal.get'>>[1],
  );

  // Default mutation mocks — capture-call tests will override
  __setMutationMock('case.accept', async () => ({
    case: { ...c, case_status: 'accepted' },
    next_task: null,
  }));
  __setMutationMock('case.override', async () => ({
    case: { ...c, case_status: 'overridden' },
    next_task: null,
  }));
  __setMutationMock('task.complete', async () => ({
    case: c,
    next_task: null,
  }));
}
