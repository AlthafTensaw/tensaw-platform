/**
 * Seed data for the v4 mock-server.
 *
 * 15 cases across all 4 case_status values:
 *   - 6 proposed (intake worklist)
 *   - 5 accepted with open tasks on various queues
 *   - 1 overridden
 *   - 0 completed (any case can be completed by walking through the workflow)
 *   - 3 with coding_feedback_review tasks on user_42 (needs_my_review)
 *
 * Plus reference data: 9 categories, ~5 clinics with cascade lookups, etc.
 *
 * Drop-in path: src/mocks/v4/seed.ts
 */

import {
  db,
  insertCase,
  insertTask,
  nextCaseId,
  nextTaskId,
  nowISO,
  plusDays,
} from './db';
import { CATEGORY_TO_WORKFLOW, engineStateCode, WORKFLOWS } from './workflows';
import type { TaskType } from '../../actions/schemas-v4';

// ============================================================================
// Helpers for seed construction
// ============================================================================

interface ProposedCaseSpec {
  patient_name: string;
  mrn: string;
  dos: string;
  net_pending: number;
  clinic_name: string;
  clinic_alias: string;
  primary_payer_name: string;
  primary_payer_alias: string;
  aging_bucket: string;
  recommended_category: string;
  recommended_confidence: number;
  recommended_reasoning: string;
}

function buildProposedCase(spec: ProposedCaseSpec): void {
  const caseId = nextCaseId();
  const now = nowISO();
  const isHD = spec.net_pending >= 750;
  insertCase({
    case_id: caseId,
    case_status: 'proposed',
    originated_by_user_id: null,
    originated_by_user_name: null,
    originated_at: null,
    is_high_dollar: isHD,
    high_dollar_shim_case_id: null,
    workflow_name: null,
    engine_state_code: null,
    _workflow_step_index: -1,
    claim_id: 300000 + db._seq.case,
    patient_name: spec.patient_name,
    mrn: spec.mrn,
    dos: spec.dos,
    net_pending: spec.net_pending,
    recommended_category: spec.recommended_category,
    recommended_confidence: spec.recommended_confidence,
    recommended_reasoning: spec.recommended_reasoning,
    classified_at: now,
    tool_version: 'phase1-0.1.0',
    primary_payer_name: spec.primary_payer_name,
    primary_payer_alias: spec.primary_payer_alias,
    clinic_name: spec.clinic_name,
    clinic_alias: spec.clinic_alias,
    aging_bucket: spec.aging_bucket,
    created_at: now,
    updated_at: now,

    // CaseDetail extras
    engine_tasks_open: [],
    engine_tasks_recent: [],
    facility_name: null,
    facility_id: null,
    provider_name: null,
    icd_codes: [],
    payer_id: `payer_${spec.primary_payer_alias.toLowerCase().replace(/\s+/g, '_')}`,
    payer_alias: spec.primary_payer_alias,
    billed: spec.net_pending + 20,
    paid_primary: 0,
    paid_secondary: 0,
    paid_tertiary: 0,
    paid_patient: 20,
    pending_primary: spec.net_pending,
    pending_secondary: 0,
    pending_tertiary: 0,
  });
}

interface AcceptedCaseSpec extends ProposedCaseSpec {
  originated_by_user_id: number;
  originated_by_user_name: string;
  current_task_step_index: number; // 0 = first task, 1 = second task, etc.
  current_task_queue_id_override?: string; // for user_42 routing
}

function buildAcceptedCase(spec: AcceptedCaseSpec, overridden = false): void {
  const caseId = nextCaseId();
  const now = nowISO();
  const workflowName = CATEGORY_TO_WORKFLOW[spec.recommended_category];
  if (!workflowName) throw new Error(`no workflow for ${spec.recommended_category}`);
  const workflow = WORKFLOWS[workflowName]!;
  const step = workflow.steps[spec.current_task_step_index];
  if (!step) {
    throw new Error(
      `step index ${spec.current_task_step_index} out of range for ${workflowName}`,
    );
  }
  const isHD = spec.net_pending >= 750;

  insertCase({
    case_id: caseId,
    case_status: overridden ? 'overridden' : 'accepted',
    originated_by_user_id: spec.originated_by_user_id,
    originated_by_user_name: spec.originated_by_user_name,
    originated_at: now,
    is_high_dollar: isHD,
    high_dollar_shim_case_id: null,
    workflow_name: workflowName,
    engine_state_code: engineStateCode(workflowName, spec.current_task_step_index),
    _workflow_step_index: spec.current_task_step_index,
    claim_id: 300000 + db._seq.case,
    patient_name: spec.patient_name,
    mrn: spec.mrn,
    dos: spec.dos,
    net_pending: spec.net_pending,
    recommended_category: spec.recommended_category,
    recommended_confidence: spec.recommended_confidence,
    recommended_reasoning: spec.recommended_reasoning,
    classified_at: now,
    tool_version: 'phase1-0.1.0',
    primary_payer_name: spec.primary_payer_name,
    primary_payer_alias: spec.primary_payer_alias,
    clinic_name: spec.clinic_name,
    clinic_alias: spec.clinic_alias,
    aging_bucket: spec.aging_bucket,
    created_at: now,
    updated_at: now,

    engine_tasks_open: [],
    engine_tasks_recent: [],
    facility_name: spec.clinic_name + ' Outpatient',
    facility_id: `fac_${spec.clinic_alias.toLowerCase().replace(/\s+/g, '_')}`,
    provider_name: 'Dr. M. Patel',
    icd_codes: ['J45.20', 'J30.1'],
    payer_id: `payer_${spec.primary_payer_alias.toLowerCase().replace(/\s+/g, '_')}`,
    payer_alias: spec.primary_payer_alias,
    billed: spec.net_pending + 20,
    paid_primary: 0,
    paid_secondary: 0,
    paid_tertiary: 0,
    paid_patient: 20,
    pending_primary: spec.net_pending,
    pending_secondary: 0,
    pending_tertiary: 0,
  });

  // Resolve queue_id for the current task. If the workflow has the
  // user_<originator> placeholder, override with the caller-provided one
  // (typically `user_<originated_by_user_id>` for needs_my_review seeding).
  let queueId = step.queue_id;
  if (queueId === 'user_<originator>') {
    queueId =
      spec.current_task_queue_id_override ?? `user_${spec.originated_by_user_id}`;
  }

  // Open the current task
  const task = {
    task_id: nextTaskId(),
    case_id: caseId,
    task_type: step.task_type as TaskType,
    state_code: 'OPEN' as const,
    queue_id: queueId,
    priority_code: 'normal' as const,
    opened_at: now,
    due_at: plusDays(step.sla_days),
    intent_key: `${step.task_type}:${caseId}`,
    handler_key: null,
    attempt_count: 0,
  };
  insertTask(task);
}

// ============================================================================
// The seed function
// ============================================================================

export function seedV4(): void {
  // Clear in case of re-seed
  db.cases.clear();
  db.tasks.clear();
  db.notes.clear();
  db.files.clear();
  db.appeals.clear();
  db.transactions.clear();
  db._seq.case = 0;
  db._seq.task = 0;
  db._seq.note = 0;
  db._seq.file = 0;
  db._seq.appeal = 0;
  db._seq.txn = 0;
  db._seq.audit = 0;

  // ────────────────────────────────────────────────────────────────────
  // Proposed cases (intake worklist)
  // ────────────────────────────────────────────────────────────────────

  buildProposedCase({
    patient_name: 'Henderson, J',
    mrn: '72834',
    dos: '2026-02-24',
    net_pending: 230,
    clinic_name: 'Live Specialty Allergy Treatment',
    clinic_alias: 'LSAT',
    primary_payer_name: 'Humana Gold Plus',
    primary_payer_alias: 'Humana GP',
    aging_bucket: '90-119d',
    recommended_category: 'medical_necessity',
    recommended_confidence: 0.92,
    recommended_reasoning:
      'CO-50 on 99214 plus prior pattern of medical-necessity denials. Records must be pulled and appeal letter must cite encounter documentation.',
  });

  buildProposedCase({
    patient_name: 'Romero, L',
    mrn: '63927',
    dos: '2026-01-29',
    net_pending: 612,
    clinic_name: 'LSAT',
    clinic_alias: 'LSAT',
    primary_payer_name: 'Aetna Better Health',
    primary_payer_alias: 'Aetna BH',
    aging_bucket: '120-179d',
    recommended_category: 'vague_denial',
    recommended_confidence: 0.71,
    recommended_reasoning:
      'No specific remit code; payer should be contacted to obtain reason.',
  });

  buildProposedCase({
    patient_name: 'Yamamoto, K',
    mrn: '34028',
    dos: '2025-12-02',
    net_pending: 945,
    clinic_name: 'Primrose Nashville',
    clinic_alias: 'PRIM_NSH',
    primary_payer_name: 'United Healthcare',
    primary_payer_alias: 'UHC',
    aging_bucket: '180d+',
    recommended_category: 'auth_missing',
    recommended_confidence: 0.86,
    recommended_reasoning:
      'CO-15 (auth required); no auth on file. Payer call needed before resubmission.',
  });

  buildProposedCase({
    patient_name: 'Mickelson, A',
    mrn: '90113',
    dos: '2026-01-30',
    net_pending: 1319,
    clinic_name: 'Texas Medicaid',
    clinic_alias: 'TX Mcaid',
    primary_payer_name: 'Texas Medicaid',
    primary_payer_alias: 'TX Mcaid',
    aging_bucket: '180d+',
    recommended_category: 'clarification_other',
    recommended_confidence: 0.62,
    recommended_reasoning:
      'Other clarification code; needs portal status check before deciding next action.',
  });

  buildProposedCase({
    patient_name: 'Singh, P',
    mrn: '47591',
    dos: '2026-02-14',
    net_pending: 405,
    clinic_name: 'Primrose Nashville',
    clinic_alias: 'PRIM_NSH',
    primary_payer_name: 'Humana Gold Plus',
    primary_payer_alias: 'Humana GP',
    aging_bucket: '60-89d',
    recommended_category: 'medical_necessity',
    recommended_confidence: 0.78,
    recommended_reasoning:
      'CO-50 on routine immunization series; appeal with vaccine schedule documentation.',
  });

  buildProposedCase({
    patient_name: 'Donovan, S',
    mrn: '58472',
    dos: '2026-02-08',
    net_pending: 1128,
    clinic_name: 'LSAT',
    clinic_alias: 'LSAT',
    primary_payer_name: 'TriCare West',
    primary_payer_alias: 'TriCare W',
    aging_bucket: '90-119d',
    recommended_category: 'medical_records_missing',
    recommended_confidence: 0.88,
    recommended_reasoning:
      'MA-130 (medical records required); pull from EMR and submit corrected claim.',
  });

  // ────────────────────────────────────────────────────────────────────
  // Accepted cases — open tasks on various queues
  // ────────────────────────────────────────────────────────────────────

  // Whitfield, M — HD case, accepted by Renita K., on coding_review (step 1 of coding_review_branch)
  buildAcceptedCase({
    patient_name: 'Whitfield, M',
    mrn: '50184',
    dos: '2025-11-15',
    net_pending: 2890,
    clinic_name: 'Primrose Birmingham',
    clinic_alias: 'PRIM_BHM',
    primary_payer_name: 'Cigna HealthSpring',
    primary_payer_alias: 'Cigna HS',
    aging_bucket: '180d+',
    recommended_category: 'modifier_missing',
    recommended_confidence: 0.91,
    recommended_reasoning:
      '99214 denied for missing modifier. Coding to verify modifier 25 applicability.',
    originated_by_user_id: 17,
    originated_by_user_name: 'Renita K.',
    current_task_step_index: 1, // coding_review
  });

  // Okafor, C — accepted by Bhavana M., on portal_status_check
  buildAcceptedCase({
    patient_name: 'Okafor, C',
    mrn: '91038',
    dos: '2026-02-03',
    net_pending: 845,
    clinic_name: 'Primrose Nashville',
    clinic_alias: 'PRIM_NSH',
    primary_payer_name: 'United Healthcare',
    primary_payer_alias: 'UHC',
    aging_bucket: '90-119d',
    recommended_category: 'clarification_other',
    recommended_confidence: 0.66,
    recommended_reasoning: 'Other clarification; check payer portal.',
    originated_by_user_id: 12,
    originated_by_user_name: 'Bhavana M.',
    current_task_step_index: 1, // portal_status_check
  });

  // Cardenas, M — accepted, on awaiting_payer_check (resolution submitted, now waiting)
  buildAcceptedCase({
    patient_name: 'Cardenas, M',
    mrn: '78256',
    dos: '2026-02-19',
    net_pending: 478,
    clinic_name: 'LSAT',
    clinic_alias: 'LSAT',
    primary_payer_name: 'Aetna Better Health',
    primary_payer_alias: 'Aetna BH',
    aging_bucket: '90-119d',
    recommended_category: 'patient_not_eligible',
    recommended_confidence: 0.74,
    recommended_reasoning:
      'CO-27 (patient ineligible at DOS). Portal check first, then resolution.',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    current_task_step_index: 3, // awaiting_payer_check in portal_first_resolution
  });

  // Olusegun, T — accepted, on payer_call (auth missing workflow)
  buildAcceptedCase({
    patient_name: 'Olusegun, T',
    mrn: '69103',
    dos: '2026-01-05',
    net_pending: 612,
    clinic_name: 'Primrose Birmingham',
    clinic_alias: 'PRIM_BHM',
    primary_payer_name: 'BCBS Texas',
    primary_payer_alias: 'BCBS-TX',
    aging_bucket: '120-179d',
    recommended_category: 'vague_denial',
    recommended_confidence: 0.69,
    recommended_reasoning: 'No remit code; call payer to obtain reason.',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    current_task_step_index: 1, // payer_call
  });

  // Patel, A — OVERRIDDEN, HD, accepted by Vipin K., on resolution_action
  buildAcceptedCase(
    {
      patient_name: 'Patel, A',
      mrn: '84512',
      dos: '2026-01-18',
      net_pending: 1354,
      clinic_name: 'Primrose Birmingham',
      clinic_alias: 'PRIM_BHM',
      primary_payer_name: 'BCBS Texas',
      primary_payer_alias: 'BCBS-TX',
      aging_bucket: '120-179d',
      recommended_category: 'auth_missing',
      recommended_confidence: 0.86,
      recommended_reasoning: 'CO-15 (auth required).',
      originated_by_user_id: 42,
      originated_by_user_name: 'Vipin K.',
      current_task_step_index: 2, // resolution_action
    },
    true, // overridden
  );

  // ────────────────────────────────────────────────────────────────────
  // needs_my_review cases — coding_feedback_review on user_42's queue
  // ────────────────────────────────────────────────────────────────────

  // Three coding_feedback_review tasks routed back to Vipin (user_42)
  buildAcceptedCase({
    patient_name: 'Whitfield, M (return)',
    mrn: '50184',
    dos: '2025-11-15',
    net_pending: 2890,
    clinic_name: 'Primrose Birmingham',
    clinic_alias: 'PRIM_BHM',
    primary_payer_name: 'Cigna HealthSpring',
    primary_payer_alias: 'Cigna HS',
    aging_bucket: '180d+',
    recommended_category: 'modifier_missing',
    recommended_confidence: 0.91,
    recommended_reasoning:
      '99214 denied for missing modifier. Coding verified: CPT correct, no modifier change needed.',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    current_task_step_index: 2, // coding_feedback_review
    current_task_queue_id_override: 'user_42',
  });

  buildAcceptedCase({
    patient_name: 'Okafor, C (return)',
    mrn: '91038',
    dos: '2026-02-03',
    net_pending: 845,
    clinic_name: 'Primrose Nashville',
    clinic_alias: 'PRIM_NSH',
    primary_payer_name: 'United Healthcare',
    primary_payer_alias: 'UHC',
    aging_bucket: '90-119d',
    recommended_category: 'modifier_wrong',
    recommended_confidence: 0.83,
    recommended_reasoning: 'Coding added modifier 25 to 99214; ready for resubmission.',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    current_task_step_index: 2, // coding_feedback_review
    current_task_queue_id_override: 'user_42',
  });

  buildAcceptedCase({
    patient_name: 'Romero, L (return)',
    mrn: '63927',
    dos: '2026-01-29',
    net_pending: 612,
    clinic_name: 'LSAT',
    clinic_alias: 'LSAT',
    primary_payer_name: 'Aetna Better Health',
    primary_payer_alias: 'Aetna BH',
    aging_bucket: '120-179d',
    recommended_category: 'modifier_missing',
    recommended_confidence: 0.79,
    recommended_reasoning:
      'Coding flagged dx insufficient; needs originating analyst review.',
    originated_by_user_id: 42,
    originated_by_user_name: 'Vipin K.',
    current_task_step_index: 2, // coding_feedback_review
    current_task_queue_id_override: 'user_42',
  });
}
