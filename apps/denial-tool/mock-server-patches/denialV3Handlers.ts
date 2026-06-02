/**
 * Denial Tool — v3.0 mock handlers (Asks 1–5, 8 from BE handoff).
 *
 * Implements:
 *   GET  /v1/claims/{id}/line-items
 *   GET  /v1/claims/{id}/transactions
 *   GET  /v1/claims/{id}/notes
 *   POST /v1/claims/{id}/notes
 *   GET  /v1/claims/{id}/files
 *   GET  /v1/claims/{id}/appeal
 *   POST /v1/claims/{id}/appeal/generate
 *   POST /v1/claims/{id}/appeal/save
 *   GET  /v1/categories
 *
 * Mock data is deterministic per claim_id so FE behavior is stable across
 * page reloads. Each call returns the same shape BE will return per the
 * handoff doc contracts.
 *
 * Appeal generate intentionally has a 2-second delay to simulate the real
 * LLM call (real BE: ~5-15s). Other endpoints respond instantly.
 */

import { http, HttpResponse } from 'msw';
import { v3MockState } from './v3State';

function u(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

export function buildDenialV3Handlers(baseUrl: string) {
  return [
    // ─── Ask 1: GET /v1/claims/{id}/line-items ───────────────────────────
    http.get(u(baseUrl, '/v1/claims/:claim_id/line-items'), ({ params }) => {
      const claimId = params.claim_id as string;
      return HttpResponse.json({
        claim_id: claimId,
        line_items: v3MockState.getLineItems(claimId),
      });
    }),

    // ─── Ask 2: GET /v1/claims/{id}/transactions ─────────────────────────
    http.get(
      u(baseUrl, '/v1/claims/:claim_id/transactions'),
      ({ params }) => {
        const claimId = params.claim_id as string;
        return HttpResponse.json({
          claim_id: claimId,
          transactions: v3MockState.getTransactions(claimId),
        });
      },
    ),

    // ─── Ask 3: GET /v1/claims/{id}/notes ────────────────────────────────
    http.get(u(baseUrl, '/v1/claims/:claim_id/notes'), ({ params }) => {
      const claimId = params.claim_id as string;
      return HttpResponse.json({
        claim_id: claimId,
        notes: v3MockState.getNotes(claimId),
      });
    }),

    // ─── Ask 3: POST /v1/claims/{id}/notes ───────────────────────────────
    http.post(
      u(baseUrl, '/v1/claims/:claim_id/notes'),
      async ({ params, request }) => {
        const claimId = params.claim_id as string;
        const body = (await request.json()) as {
          source: string;
          body: string;
        };
        const note = v3MockState.addNote(claimId, body);
        return HttpResponse.json(note, { status: 201 });
      },
    ),

    // ─── Ask 4: GET /v1/claims/{id}/files ────────────────────────────────
    http.get(u(baseUrl, '/v1/claims/:claim_id/files'), ({ params }) => {
      const claimId = params.claim_id as string;
      return HttpResponse.json({
        claim_id: claimId,
        files: v3MockState.getFiles(claimId),
      });
    }),

    // ─── Ask 5: GET /v1/claims/{id}/appeal ───────────────────────────────
    http.get(u(baseUrl, '/v1/claims/:claim_id/appeal'), ({ params }) => {
      const claimId = params.claim_id as string;
      const draft = v3MockState.getAppeal(claimId);
      return HttpResponse.json({ claim_id: claimId, draft });
    }),

    // ─── Ask 5: POST /v1/claims/{id}/appeal/generate ─────────────────────
    http.post(
      u(baseUrl, '/v1/claims/:claim_id/appeal/generate'),
      async ({ params, request }) => {
        const claimId = params.claim_id as string;
        const body = (await request.json()) as { template?: string };
        // Simulate LLM latency (~2s, real BE: 5-15s)
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const draft = v3MockState.generateAppeal(
          claimId,
          body.template ?? 'medical_necessity',
        );
        return HttpResponse.json(draft, { status: 201 });
      },
    ),

    // ─── Ask 5: POST /v1/claims/{id}/appeal/save ─────────────────────────
    http.post(
      u(baseUrl, '/v1/claims/:claim_id/appeal/save'),
      async ({ params, request }) => {
        const claimId = params.claim_id as string;
        const body = (await request.json()) as {
          appeal_id: string;
          body_html: string;
        };
        const updated = v3MockState.saveAppeal(
          claimId,
          body.appeal_id,
          body.body_html,
        );
        if (updated === null) {
          return HttpResponse.json(
            { error: 'appeal not found' },
            { status: 404 },
          );
        }
        return HttpResponse.json(updated);
      },
    ),

    // ─── Ask 8: GET /v1/categories ───────────────────────────────────────
    http.get(u(baseUrl, '/v1/categories'), () => {
      return HttpResponse.json({ categories: v3MockState.getCategories() });
    }),
  ];
}
