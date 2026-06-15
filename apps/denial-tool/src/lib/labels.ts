/**
 * Display labels + visual styling for taxonomy values.
 *
 * Single source of truth for human-readable names and color tokens. All UI
 * surfaces that show a task_type, queue_id, category, etc. should pull from
 * these maps so a label change happens in one place.
 *
 * Drop-in path: src/lib/labels.ts
 */

import type { TaskType, CaseStatus, PriorityCode } from '../actions/schemas-v4';

// ============================================================================
// task_type
// ============================================================================

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  intake_triage: 'Intake triage',
  resolution_action: 'Resolution',
  awaiting_payer_check: 'Awaiting payer',
  am_review: 'AM review',
  posting_apply: 'Posting',
  coding_review: 'Coding review',
  coding_feedback_review: 'Feedback review',
  payer_call: 'Payer call',
  portal_status_check: 'Portal check',
  bank_rec_match: 'Bank rec',
  high_dollar_oversight: 'HD oversight',
};

/** Short task-type label for chips and headings. */
export function taskTypeLabel(taskType: TaskType): string {
  return TASK_TYPE_LABELS[taskType] ?? taskType;
}

/**
 * One-line task description shown on card line 3.
 * Examples:
 *   intake_triage → "Intake triage — confirm category"
 *   coding_review → "Coding review — verify CPT + dx"
 *   payer_call    → "Payer call — get denial reason"
 */
const TASK_HINTS: Record<TaskType, string> = {
  intake_triage: 'Intake triage — confirm category',
  resolution_action: 'Resolution — submit corrective action',
  awaiting_payer_check: 'Awaiting payer — check for response',
  am_review: 'AM review — sign off resolution',
  posting_apply: 'Posting — apply payment',
  coding_review: 'Coding review — verify CPT + dx',
  coding_feedback_review: 'Coding partner completed review',
  payer_call: 'Payer call — get denial reason',
  portal_status_check: 'Portal check — verify status',
  bank_rec_match: 'Bank rec — match remit to deposit',
  high_dollar_oversight: 'HD oversight — manager sign-off',
};

export function taskHint(taskType: TaskType): string {
  return TASK_HINTS[taskType] ?? taskTypeLabel(taskType);
}

// ============================================================================
// queue_id → chip label (short for the routing chip)
// ============================================================================

const QUEUE_CHIP_LABELS: Record<string, string> = {
  denial_intake_analyst_primrose: 'denial_intake',
  coding_primrose: 'coding',
  resolution_primrose: 'resolution',
  am_review_primrose: 'am_review',
  posting_primrose: 'posting',
  high_dollar_oversight_primrose: 'hd_desk',
};

/**
 * Short queue label for the routing chip. Personal queues (user_<id>) render
 * as "personal". Unknown queues fall back to the raw id.
 */
export function queueChipLabel(queueId: string): string {
  if (queueId.startsWith('user_')) return 'personal';
  return QUEUE_CHIP_LABELS[queueId] ?? queueId;
}

// ============================================================================
// category → cat-dot color
// ============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  medical_necessity: '#dc2626',         // red-600
  medical_records_missing: '#dc2626',   // red-600
  modifier_missing: '#7c3aed',          // violet-600
  modifier_wrong: '#7c3aed',            // violet-600
  auth_missing: '#1e40af',              // blue-800
  vague_denial: '#6b7280',              // gray-500
  coverage_lapsed: '#ea580c',           // orange-600
  patient_not_eligible: '#ea580c',      // orange-600
  clarification_other: '#6b7280',       // gray-500
};

const CATEGORY_LABELS: Record<string, string> = {
  medical_necessity: 'Medical Necessity',
  medical_records_missing: 'Medical Records Missing',
  modifier_missing: 'Modifier Missing',
  modifier_wrong: 'Modifier Wrong',
  auth_missing: 'Auth Missing',
  vague_denial: 'Vague Denial',
  coverage_lapsed: 'Coverage Lapsed',
  patient_not_eligible: 'Patient Not Eligible',
  clarification_other: 'Clarification (Other)',
};

/** Color used for the cat-dot on card line 3. Unknown categories get gray. */
export function categoryColor(category: string | null): string {
  if (category === null) return '#9ca3af'; // gray-400
  return CATEGORY_COLORS[category] ?? '#9ca3af';
}

export function categoryLabel(category: string | null): string {
  if (category === null) return 'Unknown';
  return CATEGORY_LABELS[category] ?? category;
}

// ============================================================================
// case_status → state-pill class + label
// ============================================================================

export interface StatePillStyle {
  label: string;
  bgClass: string;
  textClass: string;
}

const STATE_PILL_STYLES: Record<CaseStatus, StatePillStyle> = {
  proposed: { label: 'Proposed', bgClass: 'bg-blue-100', textClass: 'text-blue-800' },
  accepted: { label: 'Accepted', bgClass: 'bg-emerald-100', textClass: 'text-emerald-800' },
  overridden: { label: 'Overridden', bgClass: 'bg-amber-100', textClass: 'text-amber-800' },
  completed: { label: 'Completed', bgClass: 'bg-slate-200', textClass: 'text-slate-700' },
};

export function statePillStyle(status: CaseStatus): StatePillStyle {
  return STATE_PILL_STYLES[status];
}

// ============================================================================
// priority
// ============================================================================

const PRIORITY_LABELS: Record<PriorityCode, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

export function priorityLabel(priority: PriorityCode): string {
  return PRIORITY_LABELS[priority];
}

// ============================================================================
// aging bucket
// ============================================================================

const AGING_ORDER = ['0-29d', '30-59d', '60-89d', '90-119d', '120-179d', '180d+'];

/**
 * Tone for an aging-bucket label. More aged → warmer. Used to subtly tint
 * the aging label on card line 2.
 */
export function agingBucketTone(bucket: string | null): 'normal' | 'warning' | 'severe' {
  if (bucket === null) return 'normal';
  const idx = AGING_ORDER.indexOf(bucket);
  if (idx === -1) return 'normal';
  if (idx >= 4) return 'severe';   // 120d+
  if (idx >= 2) return 'warning';  // 60-119d
  return 'normal';
}
