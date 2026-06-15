/**
 * Seed data for the v4.1 mock-server.
 *
 * Creates 15 backing cases and dispatches 15 OPEN worklist-task rows spread
 * across the team queues, covering a representative slice of the 17 task types.
 * Mirrors a steady-state DMS worklist table mid-flight.
 *
 * No user_<id> rows (no personal queue). No case_status. HD cases carry the
 * is_high_dollar FLAG (no sidecar task).
 *
 * Drop-in path: src/mocks/server/seed.ts
 */

import {
  resetDb,
  createCase,
  dispatchTask,
  addNote,
  addFile,
  addTransaction,
  type NewCaseInput,
} from './db';
import type { CaseFacts, Team, TaskType, Priority } from '../../actions/schemas';
import { TASK_TYPE_DEFAULT_TEAM } from '../../actions/schemas';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

let caseCounter = 0;
function caseId(): string {
  caseCounter += 1;
  return `C-DENIAL-${caseCounter.toString().padStart(4, '0')}`;
}

interface SeedSpec {
  patient: string;
  mrn: string;
  claim_id: number;
  dos: string;
  net_pending: string;
  billed: string;
  payer_name: string;
  payer_id: string;
  clinic_name: string;
  clinic_id: string;
  aging: string;
  category: string | null;
  confidence: number | null;
  reasoning: string | null;
  facts: CaseFacts;
  task_type: TaskType;
  priority?: Priority;
}

function buildDetail(id: string, s: SeedSpec): NewCaseInput['detail'] {
  const zero = '0.00';
  return {
    case_id: id,
    recommended_category: s.category,
    recommended_confidence: s.confidence,
    recommended_reasoning: s.reasoning,
    classified_at: s.category !== null ? '2026-06-12T10:00:00Z' : null,
    tool_version: 'phase1-0.1.0',
    claim_id: s.claim_id,
    patient_name: s.patient,
    mrn: s.mrn,
    dos: s.dos,
    facility_name: `${s.clinic_name} — Main`,
    facility_id: `${s.clinic_id}-fac`,
    provider_name: 'Dr. M. Patel',
    icd_codes: ['J45.20'],
    primary_payer_name: s.payer_name,
    primary_payer_id: s.payer_id,
    clinic_name: s.clinic_name,
    clinic_id: s.clinic_id,
    aging_bucket: s.aging,
    billed: s.billed,
    net_pending: s.net_pending,
    paid_primary: zero,
    paid_secondary: zero,
    paid_tertiary: zero,
    paid_patient: zero,
    pending_primary: s.net_pending,
    pending_secondary: zero,
    pending_tertiary: zero,
  };
}

// ----------------------------------------------------------------------------
// The 15 seed specs
// ----------------------------------------------------------------------------

const SEEDS: SeedSpec[] = [
  {
    patient: 'Henderson, Joel', mrn: '72834', claim_id: 300138, dos: '2026-05-03',
    net_pending: '840.00', billed: '1200.00', payer_name: 'Humana MA', payer_id: 'HUMANA',
    clinic_name: 'Cardiology Associates of Houston', clinic_id: 'clinic-001', aging: '0-29 day',
    category: 'medical_necessity', confidence: 0.92, reasoning: 'CO-50 on 99214 plus prior pattern.',
    facts: { is_high_dollar: true, clarification_type: 'AUTHORIZATION', appeal_policy: 'ONE_APPEAL' },
    task_type: 'ANALYST_TRIAGE_DENIAL', priority: 'high',
  },
  {
    patient: 'Whitfield, Asha', mrn: '81245', claim_id: 300204, dos: '2026-04-12',
    net_pending: '1420.00', billed: '1800.00', payer_name: 'Aetna Better Health', payer_id: 'AETNA',
    clinic_name: 'Primrose Birmingham', clinic_id: 'clinic-002', aging: '60-89 day',
    category: 'auth_missing', confidence: 0.87, reasoning: 'CO-197 — auth not on file.',
    facts: { is_high_dollar: true, clarification_type: 'CODING' },
    task_type: 'CODER_REVIEW_RECORD',
  },
  {
    patient: 'Ramirez, Carlos', mrn: '90112', claim_id: 300089, dos: '2025-12-05',
    net_pending: '3840.00', billed: '4200.00', payer_name: 'BCBS AL', payer_id: 'BCBS',
    clinic_name: 'Primrose Birmingham', clinic_id: 'clinic-002', aging: '180+ day',
    category: 'medical_necessity', confidence: 0.88, reasoning: 'High-dollar inpatient denial.',
    facts: { is_high_dollar: true, clarification_type: 'MEDICAL_NECESSITY', appeal_policy: 'TWO_APPEAL' },
    task_type: 'RESOLUTION_FILE_APPEAL', priority: 'high',
  },
  {
    patient: 'Park, Soo', mrn: '64778', claim_id: 300312, dos: '2026-03-18',
    net_pending: '680.00', billed: '900.00', payer_name: 'UnitedHealthcare', payer_id: 'UHC',
    clinic_name: 'LSAT Birmingham', clinic_id: 'clinic-003', aging: '60-89 day',
    category: 'modifier_missing', confidence: 0.79, reasoning: 'Modifier 25 likely needed.',
    facts: { is_high_dollar: false, clarification_type: 'CODING' },
    task_type: 'CODER_REVIEW_RECORD',
  },
  {
    patient: "O'Brien, Maeve", mrn: '55621', claim_id: 300441, dos: '2026-03-30',
    net_pending: '540.00', billed: '540.00', payer_name: 'BCBS AL', payer_id: 'BCBS',
    clinic_name: 'LSAT Birmingham', clinic_id: 'clinic-003', aging: '60-89 day',
    category: 'timely_filing', confidence: 0.83, reasoning: 'CO-29 — filing limit.',
    facts: { is_high_dollar: false, clarification_type: 'MEDICAL_NECESSITY', appeal_level: 1 },
    task_type: 'ANALYST_AWAIT_PAYER_RESPONSE',
  },
  {
    patient: 'Cho, Linda', mrn: '87123', claim_id: 300518, dos: '2026-04-22',
    net_pending: '185.00', billed: '300.00', payer_name: 'Humana MA', payer_id: 'HUMANA',
    clinic_name: 'Cardiology Associates of Houston', clinic_id: 'clinic-001', aging: '30-59 day',
    category: 'medical_necessity', confidence: 0.71, reasoning: 'Low-confidence; needs investigation.',
    facts: { is_high_dollar: false },
    task_type: 'ANALYST_INVESTIGATE_ROOT_CAUSE',
  },
  {
    patient: 'Nguyen, Tan', mrn: '33419', claim_id: 300042, dos: '2026-02-14',
    net_pending: '1820.00', billed: '2100.00', payer_name: 'Aetna Better Health', payer_id: 'AETNA',
    clinic_name: 'Primrose Birmingham', clinic_id: 'clinic-002', aging: '120-179 day',
    category: 'auth_missing', confidence: 0.9, reasoning: 'Auth required — calling payer.',
    facts: { is_high_dollar: true, clarification_type: 'AUTHORIZATION' },
    task_type: 'CALLER_GET_DENIAL_REASON',
  },
  {
    patient: 'Adeyemi, Funke', mrn: '20918', claim_id: 300655, dos: '2026-05-01',
    net_pending: '420.00', billed: '600.00', payer_name: 'UnitedHealthcare', payer_id: 'UHC',
    clinic_name: 'LSAT Birmingham', clinic_id: 'clinic-003', aging: '30-59 day',
    category: null, confidence: null, reasoning: null,
    facts: { is_high_dollar: false, clarification_type: 'EMR_NEEDED' },
    task_type: 'BHAVANA_PULL_EMR',
  },
  {
    patient: 'Torres, Mateo', mrn: '77654', claim_id: 300701, dos: '2026-04-08',
    net_pending: '95.00', billed: '150.00', payer_name: 'Medicaid TX', payer_id: 'MCDTX',
    clinic_name: 'Cardiology Associates of Houston', clinic_id: 'clinic-001', aging: '30-59 day',
    category: null, confidence: null, reasoning: null,
    facts: { is_high_dollar: false, clarification_type: 'DEMOGRAPHICS' },
    task_type: 'DEMO_RETRIEVE_ID',
  },
  {
    patient: 'Bauer, Greta', mrn: '11223', claim_id: 300777, dos: '2026-03-02',
    net_pending: '2200.00', billed: '2600.00', payer_name: 'BCBS AL', payer_id: 'BCBS',
    clinic_name: 'Primrose Birmingham', clinic_id: 'clinic-002', aging: '120-179 day',
    category: null, confidence: null, reasoning: null,
    facts: { is_high_dollar: true, clarification_type: 'CREDENTIALING' },
    task_type: 'CZAR_VERIFY_CREDENTIALING',
  },
  {
    patient: 'Silva, Joana', mrn: '44556', claim_id: 300810, dos: '2026-04-19',
    net_pending: '310.00', billed: '450.00', payer_name: 'Humana MA', payer_id: 'HUMANA',
    clinic_name: 'LSAT Birmingham', clinic_id: 'clinic-003', aging: '30-59 day',
    category: 'medical_necessity', confidence: 0.81, reasoning: 'Appeal refiled; awaiting.',
    facts: { is_high_dollar: false, appeal_level: 1 },
    task_type: 'RESOLUTION_REFILE_CLAIM',
  },
  {
    patient: 'Kowalski, Piotr', mrn: '66778', claim_id: 300833, dos: '2026-02-28',
    net_pending: '1560.00', billed: '1900.00', payer_name: 'Aetna Better Health', payer_id: 'AETNA',
    clinic_name: 'Cardiology Associates of Houston', clinic_id: 'clinic-001', aging: '120-179 day',
    category: 'medical_necessity', confidence: 0.86, reasoning: 'Denied on appeal — AM disposition.',
    facts: { is_high_dollar: true, appeal_level: 2 },
    task_type: 'AM_DECIDE_DISPOSITION',
  },
  {
    patient: 'Ferreira, Ana', mrn: '88990', claim_id: 300858, dos: '2026-05-10',
    net_pending: '275.00', billed: '400.00', payer_name: 'UnitedHealthcare', payer_id: 'UHC',
    clinic_name: 'LSAT Birmingham', clinic_id: 'clinic-003', aging: '0-29 day',
    category: null, confidence: null, reasoning: null,
    facts: { is_high_dollar: false },
    task_type: 'PORTAL_CHECK_STATUS',
  },
  {
    patient: 'Okafor, Chidi', mrn: '12131', claim_id: 300888, dos: '2026-03-25',
    net_pending: '730.00', billed: '950.00', payer_name: 'BCBS AL', payer_id: 'BCBS',
    clinic_name: 'Primrose Birmingham', clinic_id: 'clinic-002', aging: '60-89 day',
    category: null, confidence: null, reasoning: null,
    facts: { is_high_dollar: false },
    task_type: 'COORDINATOR_FACILITY_CONTACT',
  },
  {
    patient: 'Brooks, Dana', mrn: '14151', claim_id: 300901, dos: '2026-04-30',
    net_pending: '990.00', billed: '1300.00', payer_name: 'Humana MA', payer_id: 'HUMANA',
    clinic_name: 'Cardiology Associates of Houston', clinic_id: 'clinic-001', aging: '30-59 day',
    category: 'medical_necessity', confidence: 0.78, reasoning: 'Paid on appeal — posting.',
    facts: { is_high_dollar: true, appeal_level: 1 },
    task_type: 'POSTING_VALIDATE_PAYMENT',
  },
];

// ----------------------------------------------------------------------------
// seedV41 — populate the db
// ----------------------------------------------------------------------------

export function seedV41(): void {
  resetDb();
  caseCounter = 0;

  for (const s of SEEDS) {
    const id = caseId();
    createCase({ detail: buildDetail(id, s), case_facts: s.facts });

    // Dispatch the seed's open task to its default team
    const team: Team = TASK_TYPE_DEFAULT_TEAM[s.task_type];
    dispatchTask(id, { task_type: s.task_type, team }, { priority: s.priority });

    // A couple of context notes per case
    addNote(id, {
      body: `Case classified · category=${s.category ?? 'unclassified'}${
        s.confidence !== null ? ` · confidence=${s.confidence}` : ''
      }`,
      source: 'system',
      author_user_id: null,
      author_user_name: null,
    });

    // Seed a denial transaction so the Payments tab has data
    addTransaction(id, {
      claim_id: s.claim_id,
      transaction_type: 'denial',
      payer_source: 'primary',
      amount: 0,
      transaction_date: s.dos,
      carc_code: 'CO-50',
      rarc_code: 'M127',
      remit_reason_text: 'Medical necessity not established',
    });
  }

  // A medical-record file on the first case, for the Files tab
  addFile('C-DENIAL-0001', {
    file_name: 'medical_record_henderson.pdf',
    file_type: 'medical_record',
    size_bytes: 102400,
    mime_type: 'application/pdf',
    uploaded_by_user_id: 42,
    uploaded_by_user_name: 'Vipin K.',
  });
}
