/**
 * Presentation labels for the v4.1 engine-handler model.
 *
 * Parallel to src/lib/labels.ts (which is coupled to the v4.0.0 task types +
 * case_status). v4 labels.ts is deleted in R12.
 *
 * Drop-in path: src/lib/labels.ts
 */

import type { TaskType } from '../actions/schemas';

/** Short, human-readable label for a task type (card headline + chips). */
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  ANALYST_TRIAGE_DENIAL: 'Triage denial',
  ANALYST_INVESTIGATE_ROOT_CAUSE: 'Investigate root cause',
  CALLER_GET_DENIAL_REASON: 'Call payer — denial reason',
  PORTAL_CHECK_STATUS: 'Check portal status',
  BHAVANA_PULL_EMR: 'Pull EMR record',
  ANALYST_PATIENT_OUTREACH: 'Patient outreach',
  COORDINATOR_FACILITY_CONTACT: 'Facility contact',
  CODER_REVIEW_RECORD: 'Coding review',
  RESOLUTION_REFILE_CLAIM: 'Refile claim',
  RESOLUTION_FILE_APPEAL: 'File appeal',
  ANALYST_AWAIT_PAYER_RESPONSE: 'Await payer response',
  AM_DECIDE_DISPOSITION: 'AM disposition',
  POSTING_VALIDATE_PAYMENT: 'Validate payment',
  DEMO_RETRIEVE_ID: 'Retrieve member ID',
  CZAR_VERIFY_CREDENTIALING: 'Verify credentialing',
  LIAISON_EXTERNAL_ESCALATION: 'External escalation',
  BILLING_PROCESS_DISPOSITION: 'Process disposition',
};

/** One-line hint describing what the analyst does for this task. */
export function taskHint(taskType: TaskType): string {
  switch (taskType) {
    case 'ANALYST_TRIAGE_DENIAL':
      return 'Confirm clarification type + qualifier checks';
    case 'ANALYST_INVESTIGATE_ROOT_CAUSE':
      return 'Determine the real denial reason';
    case 'CALLER_GET_DENIAL_REASON':
      return 'Call the payer and capture the reason';
    case 'PORTAL_CHECK_STATUS':
      return 'Look up the claim status in the payer portal';
    case 'BHAVANA_PULL_EMR':
      return 'Pull the requested record from the EMR';
    case 'ANALYST_PATIENT_OUTREACH':
      return 'Reach the patient for missing info';
    case 'COORDINATOR_FACILITY_CONTACT':
      return 'Contact the facility for records/access';
    case 'CODER_REVIEW_RECORD':
      return 'Verify CPT / dx / modifiers and recommend';
    case 'RESOLUTION_REFILE_CLAIM':
      return 'Refile the corrected claim';
    case 'RESOLUTION_FILE_APPEAL':
      return 'Draft + submit the appeal';
    case 'ANALYST_AWAIT_PAYER_RESPONSE':
      return 'Record the payer response when it arrives';
    case 'AM_DECIDE_DISPOSITION':
      return 'Decide write-off / cash-rate / escalate';
    case 'POSTING_VALIDATE_PAYMENT':
      return 'Verify prior payment / recoupment';
    case 'DEMO_RETRIEVE_ID':
      return 'Retrieve the Medicare/Medicaid ID';
    case 'CZAR_VERIFY_CREDENTIALING':
      return 'Verify NPI / taxonomy / credentialing';
    case 'LIAISON_EXTERNAL_ESCALATION':
      return 'Escalate externally and capture the result';
    case 'BILLING_PROCESS_DISPOSITION':
      return 'Apply the cash-rate / write-off';
  }
}

/**
 * Format a decimal currency STRING (e.g. "840.00") for display. The v4.1
 * worklist row carries net_pending as a string (handoff §4), unlike v4.0.0's
 * number. Falls back to the raw string if it doesn't parse.
 */
export function formatCurrencyStr(decimal: string): string {
  const n = Number(decimal);
  if (Number.isNaN(n)) return decimal;
  const hasFractional = n % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasFractional ? 2 : 0,
    maximumFractionDigits: hasFractional ? 2 : 0,
  }).format(n);
}

// Aging-bucket tone. Accepts both "0-29d" and "0-29 day" style labels.
const AGING_ORDER = ['0-29', '30-59', '60-89', '90-119', '120-179', '180'];

export function agingBucketTone(bucket: string | null): 'normal' | 'warning' | 'severe' {
  if (bucket === null) return 'normal';
  const idx = AGING_ORDER.findIndex((p) => bucket.startsWith(p));
  if (idx === -1) return 'normal';
  if (idx >= 4) return 'severe';   // 120d+
  if (idx >= 2) return 'warning';  // 60-119d
  return 'normal';
}
