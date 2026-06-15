/**
 * v4.1 test helpers (engine-handler model).
 *
 * Parallel to src/test/helpers.tsx (v4.0.0). Provides a WorklistTask fixture +
 * a mock setup that wires worklist.complete (spy-able) and the reference data
 * the forms touch. v4 helpers stay until R12.
 *
 * Drop-in path: src/test/helpers.tsx
 */

import { __setQueryMock, __setMutationMock } from '../../stubs/tensaw/actions';
import type { WorklistTask, TaskType, CaseDetail } from '../actions/schemas';

export function makeTask(taskType: TaskType, overrides: Partial<WorklistTask> = {}): WorklistTask {
  return {
    task_id: `T-${taskType}`,
    case_id: 'C-DENIAL-0001',
    task_type: taskType,
    status: 'OPEN',
    priority: 'normal',
    team: 'denial_intake_analyst',
    dispatched_at: '2026-06-14T10:00:00Z',
    case_context: {
      case_type: 'DENIAL',
      state_code: 'X',
      task_type: taskType,
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
      clinic_name: 'CAH',
    },
    ...overrides,
  };
}

export const baseDetail: CaseDetail = {
  case_id: 'C-DENIAL-0001',
  state_code: 'TRIAGE',
  open_task_ids: ['T-ANALYST_TRIAGE_DENIAL'],
  case_facts: { is_high_dollar: false },
  recommended_category: 'medical_necessity',
  recommended_confidence: 0.92,
  recommended_reasoning: 'CO-50 on 99214 plus prior pattern.',
  classified_at: '2026-06-12T10:00:00Z',
  tool_version: 'phase1-0.1.0',
  claim_id: 300138,
  patient_name: 'Henderson, Joel',
  mrn: '72834',
  dos: '2026-05-03',
  facility_name: 'CAH Main',
  facility_id: 'fac-1',
  provider_name: 'Dr. M. Patel',
  icd_codes: ['J45.20'],
  primary_payer_name: 'Humana MA',
  primary_payer_id: 'HUMANA',
  clinic_name: 'CAH',
  clinic_id: 'clinic-001',
  aging_bucket: '0-29 day',
  billed: '1200.00',
  net_pending: '840.00',
  paid_primary: '360.00',
  paid_secondary: '0.00',
  paid_tertiary: '0.00',
  paid_patient: '0.00',
  pending_primary: '840.00',
  pending_secondary: '0.00',
  pending_tertiary: '0.00',
  created_at: '2026-06-12T10:00:00Z',
  updated_at: '2026-06-12T10:00:00Z',
};

/** Wire the standard v41 mocks. Tests override what they need. */
export function setupV41Mocks(): void {
  __setQueryMock('lookup.clinics', { items: [{ id: 'clinic-001', name: 'CAH', alias: 'CAH' }] } as never);
  __setQueryMock('lookup.payers', { items: [{ id: 'HUMANA', name: 'Humana MA', alias: 'Humana' }] } as never);
  __setQueryMock('worklist.counts', { counts: { denial_intake_analyst: 6 } });
  __setMutationMock('worklist.complete', async () => makeTask('ANALYST_TRIAGE_DENIAL', { status: 'COMPLETED' }));
}
