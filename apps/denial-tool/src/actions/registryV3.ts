/**
 * Denial Tool — v3.0 action registry.
 *
 * 9 new actions for the right-pane tab data:
 *
 *   QUERIES
 *     denial.list-line-items     GET  /v1/claims/{id}/line-items     (Ask 1)
 *     denial.list-transactions   GET  /v1/claims/{id}/transactions   (Ask 2)
 *     denial.list-notes          GET  /v1/claims/{id}/notes          (Ask 3)
 *     denial.list-files          GET  /v1/claims/{id}/files          (Ask 4)
 *     denial.get-appeal          GET  /v1/claims/{id}/appeal         (Ask 5)
 *     denial.list-categories     GET  /v1/categories                 (Ask 8)
 *
 *   MUTATIONS
 *     denial.create-note         POST /v1/claims/{id}/notes          (Ask 3)
 *     denial.generate-appeal     POST /v1/claims/{id}/appeal/generate (Ask 5)
 *     denial.save-appeal         POST /v1/claims/{id}/appeal/save     (Ask 5)
 *
 * Permission: all under denial.read (queries) or denial.act (mutations).
 *
 * Cache invalidation:
 *   create-note → invalidate list-notes for that claim
 *   generate-appeal → invalidate get-appeal for that claim
 *   save-appeal → invalidate get-appeal for that claim
 *
 * Note: list-line-items + list-transactions + list-files have no mutations
 * that invalidate them in v3.0 (read-only views; file upload comes in v3.1).
 */

import { z } from 'zod';
import { defineAction } from '@tensaw/actions';

import {
  LineItemListResponseSchema,
  TransactionListResponseSchema,
  NoteListResponseSchema,
  NoteSchema,
  NoteCreateRequestSchema,
  FileListResponseSchema,
  AppealResponseSchema,
  AppealDraftSchema,
  AppealGenerateRequestSchema,
  AppealSaveRequestSchema,
  CategoryListResponseSchema,
} from './schemasV3';

const ClaimIdRequest = z.object({
  claim_id: z.union([z.string(), z.number().int()]),
});

export function registerDenialV3Actions(): void {
  // ─── Queries ─────────────────────────────────────────────────────────

  defineAction({
    actionId: 'denial.list-line-items',
    kind: 'query',
    endpoint: 'GET /v1/claims/{claim_id}/line-items',
    permission: 'denial.read',
    description:
      'Per-CPT financial line items (billed, allowed, contractual_adjustment, coinsurance, deductible, insurance_paid, patient_paid, balance, line_status). Backs Analysis tab CPT cards and Payments tab grid.',
    request: ClaimIdRequest,
    response: LineItemListResponseSchema,
    cache: { tag: 'line-items', invalidatedBy: [] },
  });

  defineAction({
    actionId: 'denial.list-transactions',
    kind: 'query',
    endpoint: 'GET /v1/claims/{claim_id}/transactions',
    permission: 'denial.read',
    description:
      'Chronological financial transactions on the claim (charges, payments, adjustments, denials). Backs Payments tab transaction log.',
    request: ClaimIdRequest,
    response: TransactionListResponseSchema,
    cache: { tag: 'transactions', invalidatedBy: [] },
  });

  defineAction({
    actionId: 'denial.list-notes',
    kind: 'query',
    endpoint: 'GET /v1/claims/{claim_id}/notes',
    permission: 'denial.read',
    description:
      'Allofactor notes on the claim — internal analyst notes, payer-call summaries, system-generated entries.',
    request: ClaimIdRequest,
    response: NoteListResponseSchema,
    cache: {
      tag: 'notes',
      invalidatedBy: ['denial.create-note'],
    },
  });

  defineAction({
    actionId: 'denial.list-files',
    kind: 'query',
    endpoint: 'GET /v1/claims/{claim_id}/files',
    permission: 'denial.read',
    description:
      'Files attached to the claim — EOBs, medical records, outbound faxes, appeal drafts, supporting clinical docs.',
    request: ClaimIdRequest,
    response: FileListResponseSchema,
    cache: { tag: 'files', invalidatedBy: [] },
  });

  defineAction({
    actionId: 'denial.get-appeal',
    kind: 'query',
    endpoint: 'GET /v1/claims/{claim_id}/appeal',
    permission: 'denial.read',
    description:
      'Current appeal draft for this claim, or null if no draft has been generated.',
    request: ClaimIdRequest,
    response: AppealResponseSchema,
    cache: {
      tag: 'appeal',
      invalidatedBy: ['denial.generate-appeal', 'denial.save-appeal'],
    },
  });

  defineAction({
    actionId: 'denial.list-categories',
    kind: 'query',
    endpoint: 'GET /v1/categories',
    permission: 'denial.read',
    description:
      'Canonical category taxonomy (33 categories). Cached infinitely — single fetch at app boot.',
    request: z.object({}),
    response: CategoryListResponseSchema,
    cache: { tag: 'categories', invalidatedBy: [] },
  });

  // ─── Mutations ────────────────────────────────────────────────────────

  defineAction({
    actionId: 'denial.create-note',
    kind: 'mutation',
    endpoint: 'POST /v1/claims/{claim_id}/notes',
    permission: 'denial.act',
    description:
      "Create a note on a claim. Source is 'internal' or 'payer_call'; system/allofactor/appeal sources are BE-generated only.",
    request: NoteCreateRequestSchema.extend({
      claim_id: z.union([z.string(), z.number().int()]),
    }),
    response: NoteSchema,
  });

  defineAction({
    actionId: 'denial.generate-appeal',
    kind: 'mutation',
    endpoint: 'POST /v1/claims/{claim_id}/appeal/generate',
    permission: 'denial.act',
    description:
      'Kick off AI-assisted appeal letter generation. BE calls configured LLM provider (OpenAI primary, Gemini fallback) with claim context. Returns the generated draft. Synchronous — takes 5-15 seconds.',
    request: AppealGenerateRequestSchema.extend({
      claim_id: z.union([z.string(), z.number().int()]),
    }),
    response: AppealDraftSchema,
  });

  defineAction({
    actionId: 'denial.save-appeal',
    kind: 'mutation',
    endpoint: 'POST /v1/claims/{claim_id}/appeal/save',
    permission: 'denial.act',
    description:
      'Persist analyst-edited appeal draft body. BE sanitizes HTML server-side before storage.',
    request: AppealSaveRequestSchema.extend({
      claim_id: z.union([z.string(), z.number().int()]),
    }),
    response: AppealDraftSchema,
  });
}
