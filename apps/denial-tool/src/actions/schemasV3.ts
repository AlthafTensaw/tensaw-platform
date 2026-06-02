/**
 * Denial Tool v3.0 — new wire schemas for three-pane UI.
 *
 * Companion to schemas.ts (which re-exports from @tensaw/mock-server).
 * These cover the v3.0 endpoint shapes BE will implement per the
 * Backend-v2.0.0 handoff doc:
 *
 *   - Ask 1: GET /v1/claims/{id}/line-items     → LineItemListSchema
 *   - Ask 2: GET /v1/claims/{id}/transactions   → TransactionListSchema
 *   - Ask 3: GET/POST /v1/claims/{id}/notes     → NoteListSchema + NoteCreateRequest
 *   - Ask 4: GET/POST /v1/claims/{id}/files     → FileListSchema + FileUploadResponse
 *   - Ask 5: GET/POST /v1/claims/{id}/appeal    → AppealDraftSchema + AppealGenerateRequest
 *   - Ask 8: GET /v1/categories                 → CategoryListSchema
 *
 * Money: continues PR-4 convention of decimal-as-string.
 * Dates: ISO 8601 strings; mm/dd/yy formatting is FE-side via formatDate().
 *
 * Until BE ships, these power the mock-server handlers so FE can build
 * against the real contract shape.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Reuse the decimal pattern from the existing schemas
// ---------------------------------------------------------------------------

const DecimalString = z
  .string()
  .regex(/^(?!^[-+.]*$)[+-]?0*\d*\.?\d*$/);

// ===========================================================================
// Ask 1 — Line items (per-CPT financial breakdown)
// ===========================================================================

export const LineStatusEnum = z.enum([
  'denied',
  'paid',
  'partial',
  'pending',
  'void',
  'adjusted',
]);
export type LineStatus = z.infer<typeof LineStatusEnum>;

export const LineItemSchema = z.object({
  line_id: z.string(),
  procedure_code: z.string(),
  procedure_description: z.string(),
  modifiers: z.array(z.string()).default([]),
  billed: DecimalString,
  allowed: DecimalString,
  contractual_adjustment: DecimalString,
  coinsurance: DecimalString,
  deductible: DecimalString,
  insurance_paid: DecimalString,
  patient_paid: DecimalString,
  balance: DecimalString,
  line_status: LineStatusEnum,
  service_date: z.string().nullable(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const LineItemListResponseSchema = z.object({
  claim_id: z.union([z.number().int(), z.string()]),
  line_items: z.array(LineItemSchema),
});
export type LineItemListResponse = z.infer<typeof LineItemListResponseSchema>;

// ===========================================================================
// Ask 2 — Transactions log
// ===========================================================================

export const TransactionTypeEnum = z.enum([
  'charge',
  'payment',
  'adjustment',
  'denial',
  'refund',
]);
export type TransactionType = z.infer<typeof TransactionTypeEnum>;

export const TransactionPartyEnum = z.enum([
  'primary',
  'secondary',
  'patient',
  'system',
]);
export type TransactionParty = z.infer<typeof TransactionPartyEnum>;

export const TransactionModeEnum = z.enum(['card', 'check', 'eft', 'cash']);
export type TransactionMode = z.infer<typeof TransactionModeEnum>;

export const TransactionSchema = z.object({
  transaction_id: z.string(),
  posted_at: z.string(),
  type: TransactionTypeEnum,
  party: TransactionPartyEnum,
  mode: TransactionModeEnum.nullable(),
  amount: DecimalString, // signed: + for charges, - for credits
  reference: z.string().nullable(),
  procedure_code: z.string().nullable(),
  description: z.string().nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const TransactionListResponseSchema = z.object({
  claim_id: z.union([z.number().int(), z.string()]),
  transactions: z.array(TransactionSchema),
});
export type TransactionListResponse = z.infer<
  typeof TransactionListResponseSchema
>;

// ===========================================================================
// Ask 3 — Notes
// ===========================================================================

export const NoteSourceEnum = z.enum([
  'internal',
  'payer_call',
  'allofactor',
  'appeal',
  'system',
]);
export type NoteSource = z.infer<typeof NoteSourceEnum>;

export const NoteSchema = z.object({
  note_id: z.string(),
  created_at: z.string(),
  author_user_id: z.number().int().nullable(),
  author_name: z.string(),
  source: NoteSourceEnum,
  body: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

export const NoteListResponseSchema = z.object({
  claim_id: z.union([z.number().int(), z.string()]),
  notes: z.array(NoteSchema),
});
export type NoteListResponse = z.infer<typeof NoteListResponseSchema>;

// Analyst-creatable sources only (system/allofactor/appeal are BE-generated).
export const NoteCreateRequestSchema = z.object({
  source: z.enum(['internal', 'payer_call']),
  body: z.string().min(1).max(5000),
});
export type NoteCreateRequest = z.infer<typeof NoteCreateRequestSchema>;

// ===========================================================================
// Ask 4 — Files
// ===========================================================================

export const FileTypeEnum = z.enum([
  'eob',
  'medical_record',
  'outbound_fax',
  'appeal_draft',
  'clinical',
  'other',
]);
export type FileType = z.infer<typeof FileTypeEnum>;

export const FileMetaSchema = z.object({
  file_id: z.string(),
  filename: z.string(),
  file_type: FileTypeEnum,
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  uploaded_at: z.string(),
  uploaded_by_user_id: z.number().int().nullable(),
  uploaded_by_name: z.string(),
});
export type FileMeta = z.infer<typeof FileMetaSchema>;

export const FileListResponseSchema = z.object({
  claim_id: z.union([z.number().int(), z.string()]),
  files: z.array(FileMetaSchema),
});
export type FileListResponse = z.infer<typeof FileListResponseSchema>;

// ===========================================================================
// Ask 5 — Appeal (LLM-assisted)
// ===========================================================================

export const AppealTemplateEnum = z.enum([
  'medical_necessity',
  // v3.1+: 'documentation', 'coding_dispute', 'timely_filing', 'cob'
]);
export type AppealTemplate = z.infer<typeof AppealTemplateEnum>;

export const AppealContextUsedSchema = z.object({
  has_claim_metadata: z.boolean(),
  has_denial_codes: z.boolean(),
  prior_events_count: z.number().int().nonnegative(),
  notes_count: z.number().int().nonnegative(),
  files_count: z.number().int().nonnegative(),
});
export type AppealContextUsed = z.infer<typeof AppealContextUsedSchema>;

export const AppealDraftSchema = z.object({
  appeal_id: z.string(),
  template: AppealTemplateEnum,
  body_html: z.string(),
  generated_at: z.string(),
  generated_by_user_id: z.number().int(),
  ai_model_used: z.string(), // e.g. "gpt-4o-mini", "gemini-2.0-flash"
  context_used: AppealContextUsedSchema,
  saved_at: z.string().nullable(),
  sent_at: z.string().nullable(),
});
export type AppealDraft = z.infer<typeof AppealDraftSchema>;

export const AppealResponseSchema = z.object({
  claim_id: z.union([z.number().int(), z.string()]),
  draft: AppealDraftSchema.nullable(),
});
export type AppealResponse = z.infer<typeof AppealResponseSchema>;

export const AppealGenerateRequestSchema = z.object({
  template: AppealTemplateEnum.default('medical_necessity'),
});
export type AppealGenerateRequest = z.infer<typeof AppealGenerateRequestSchema>;

export const AppealSaveRequestSchema = z.object({
  appeal_id: z.string(),
  body_html: z.string().min(1),
});
export type AppealSaveRequest = z.infer<typeof AppealSaveRequestSchema>;

// ===========================================================================
// Ask 8 — Categories endpoint
// ===========================================================================

export const CategorySchema = z.object({
  value: z.number().int().min(1).max(99),
  label: z.string(),
  slug: z.string(),
  ordinal: z.number().int(),
  color_hint: z.string().nullable(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CategoryListResponseSchema = z.object({
  categories: z.array(CategorySchema),
});
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;

// ===========================================================================
// Ask 7 — WorklistRequest filter expansions (additive)
// ===========================================================================
//
// FE-side: extend the existing WorklistFilters with three new optional fields.
// The base WorklistRequestSchema in @tensaw/mock-server stays unchanged for
// now; once BE adds these fields, we'll widen the upstream schema. For now
// the mock-server handler ignores unknown filter fields gracefully.

export interface WorklistFiltersV3 {
  assigned_to_user_id: number | undefined;
  min_net_pending: string | undefined; // decimal as string
  max_net_pending: string | undefined;
  clinic_id: number | undefined;
}
