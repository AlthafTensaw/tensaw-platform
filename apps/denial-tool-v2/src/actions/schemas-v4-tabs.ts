/**
 * Denial Analyst Tool — Tab Schemas v4.0.0
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Schemas for tab data that wasn't covered by design contract §1.
 * Includes: Note, File, Appeal, Transaction.
 *
 * Drop-in path: src/actions/schemas-v4-tabs.ts
 *
 * Coexists with schemas-v4.ts (which covers Case, EngineTask, Queue, etc.).
 * Split into a separate file so the P1.1 schemas-v4.ts ship is untouched.
 *
 * Imported by:
 *   - src/actions/index-v4.ts (action registry)
 *   - Tab components in later P1 phases
 */

import { z } from 'zod';

// ============================================================================
// Notes
// ============================================================================

/**
 * Note source — tells the FE how to style the note (auto-emitted notes from
 * system/classifier/appeal are visually muted; analyst notes are primary).
 *
 *   analyst    — typed by a worker
 *   system     — auto-emitted by engine on state transitions
 *   classifier — auto-emitted on accept/override with LLM reasoning
 *   appeal     — auto-emitted when an appeal is generated/saved
 */
export const NoteSourceSchema = z.enum([
  'analyst',
  'system',
  'classifier',
  'appeal',
]);
export type NoteSource = z.infer<typeof NoteSourceSchema>;

export const NoteSchema = z.object({
  note_id: z.string(),
  case_id: z.string(),
  body: z.string(),
  source: NoteSourceSchema,

  // Author (null for system-emitted notes)
  author_user_id: z.number().int().nullable(),
  author_user_name: z.string().nullable(),

  created_at: z.string().datetime(),
});
export type Note = z.infer<typeof NoteSchema>;

export const NotesResponseSchema = z.object({
  notes: z.array(NoteSchema),
});
export type NotesResponse = z.infer<typeof NotesResponseSchema>;

// ============================================================================
// Files
// ============================================================================

/**
 * File type — drives the dropdown in the file picker UI.
 */
export const FileTypeSchema = z.enum([
  'medical_record',
  'operative_note',
  'eob',
  'denial_letter',
  'appeal_draft',
  'other',
]);
export type FileType = z.infer<typeof FileTypeSchema>;

export const FileSchema = z.object({
  file_id: z.string(),
  case_id: z.string(),
  file_name: z.string(),
  file_type: FileTypeSchema,
  size_bytes: z.number().int(),
  mime_type: z.string(),

  uploaded_by_user_id: z.number().int().nullable(),
  uploaded_by_user_name: z.string().nullable(),
  uploaded_at: z.string().datetime(),
});
export type FileEntity = z.infer<typeof FileSchema>;

export const FilesResponseSchema = z.object({
  files: z.array(FileSchema),
});
export type FilesResponse = z.infer<typeof FilesResponseSchema>;

// ============================================================================
// Appeals
// ============================================================================

/**
 * Appeal template — picked at generation time, drives the LLM prompt.
 */
export const AppealTemplateSchema = z.enum([
  'medical_necessity',
  'prior_auth',
  'timely_filing',
  'coding_correction',
]);
export type AppealTemplate = z.infer<typeof AppealTemplateSchema>;

/**
 * Appeal lifecycle:
 *   draft     — analyst can still edit
 *   finalized — locked; ready to submit (becomes appeal_draft file via render-pdf)
 *   submitted — submitted to payer (terminal)
 */
export const AppealStatusSchema = z.enum([
  'draft',
  'finalized',
  'submitted',
]);
export type AppealStatus = z.infer<typeof AppealStatusSchema>;

export const AppealSchema = z.object({
  appeal_id: z.string(),
  case_id: z.string(),
  template: AppealTemplateSchema,
  status: AppealStatusSchema,

  // Rich-text body (markdown or HTML — TBD at component layer)
  body: z.string(),

  // LLM generation metadata (null if hand-authored — rare)
  generated_at: z.string().datetime().nullable(),
  generated_by_model: z.string().nullable(),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Appeal = z.infer<typeof AppealSchema>;

// ============================================================================
// Transactions (Payments tab data — DMS proxies from rcm-data-access)
// ============================================================================

/**
 * Transaction types — drives the visual grouping in the Payments tab.
 */
export const TransactionTypeSchema = z.enum([
  'payment',
  'adjustment',
  'denial',
  'refund',
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

/**
 * Payer source — which insurance bucket paid/denied this transaction.
 */
export const PayerSourceSchema = z.enum([
  'primary',
  'secondary',
  'tertiary',
  'patient',
]);
export type PayerSource = z.infer<typeof PayerSourceSchema>;

export const TransactionSchema = z.object({
  transaction_id: z.string(),
  claim_id: z.number().int(),
  case_id: z.string(),

  transaction_type: TransactionTypeSchema,
  payer_source: PayerSourceSchema,

  amount: z.number(), // dollars; negative for refunds/adjustments
  transaction_date: z.string(), // YYYY-MM-DD

  // CARC/RARC codes for denial transactions (null otherwise)
  carc_code: z.string().nullable(),
  rarc_code: z.string().nullable(),

  // Free-text remit reason
  remit_reason_text: z.string().nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const TransactionsResponseSchema = z.object({
  transactions: z.array(TransactionSchema),
});
export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>;

// ============================================================================
// Reference data (categories + lookups)
// ============================================================================

/**
 * Category — denial categories with their associated workflow definition.
 * Powers the Override dialog dropdown + WorkflowPreview block in mockup #8.
 */
export const CategorySchema = z.object({
  code: z.string(),
  label: z.string(),

  // The engine workflow that runs when a case is accepted in this category
  workflow_name: z.string().nullable(),
  workflow_step_count: z.number().int().nullable(),
  workflow_step_labels: z.array(z.string()).optional(), // for the preview strip
});
export type Category = z.infer<typeof CategorySchema>;

export const CategoriesResponseSchema = z.object({
  categories: z.array(CategorySchema),
});
export type CategoriesResponse = z.infer<typeof CategoriesResponseSchema>;

/**
 * Lookup item shape — shared across clinics / providers / payers / facilities.
 * The cascade endpoints all return this shape with different filter scopes.
 */
export const LookupItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.string().nullable(),
});
export type LookupItem = z.infer<typeof LookupItemSchema>;

export const LookupResponseSchema = z.object({
  items: z.array(LookupItemSchema),
});
export type LookupResponse = z.infer<typeof LookupResponseSchema>;
