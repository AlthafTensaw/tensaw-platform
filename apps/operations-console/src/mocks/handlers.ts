/**
 * MSW handlers for the Operations Console Phase A endpoints.
 *
 * Six endpoints:
 *   1. GET /v1/admin/cases             — paginated case listing
 *   2. GET /v1/admin/recent-activity   — cross-case timeline
 *   3. GET /v1/admin/stuck-cases       — stuck cases dashboard
 *   4. GET /v1/cases/{case_id}         — case detail snapshot
 *   5. GET /v1/cases/{case_id}/history — case history timeline
 *   6. GET /v1/health/scheduler        — scheduler health KPI
 *
 * Handlers return shapes that match what the real backend actually
 * returns per `Phase_A_Handback.md` deviations:
 *
 *   - `groups` is `{value: count}` flat map (NULL bucket = literal "<null>")
 *   - `trigger_type` accepts POLL, SIGNAL, MANUAL_ADVANCE, RECLAIM, CONSOLE_RETRY, CONSOLE_CLOSE
 *   - Phase A leaves recent-activity actor fields (`actor_subject`,
 *     `actor_email`, `console_action_type`, `reason`) null EXCEPT for
 *     the one demo CONSOLE_RETRY entry (visual reference for Phase B)
 *   - Closed cases keep their `state_code`; `closed_at IS NOT NULL` is
 *     the indicator. The `include_closed` query param controls whether
 *     they're in the list.
 *
 * The handler registers against a base URL passed in at build time
 * (mirrors `buildARHandlers(baseUrl)` in `@tensaw/mock-server`).
 */

import { http, HttpResponse } from 'msw';
import { buildErrorEnvelope, buildSuccessEnvelope } from '@tensaw/runtime';
import {
  getMockState,
  resetMockState,
  FIXTURE_NOW_ISO,
} from './fixtures/cases';
import type {
  AdminCaseRow,
  PaginatedAdminCasesResponse,
  RecentActivityResponse,
  StuckCasesResponse,
  CaseHistoryResponse,
  CaseDetailResponse,
  SchedulerHealth,
} from '../actions/schemas';

/** Reset all in-memory mock state. Called by vitest.setup.ts afterEach. */
export function resetMockAdminState(): void {
  resetMockState();
}

// ---- Envelope helpers -----------------------------------------------------

/**
 * Thin local adapters over `@tensaw/runtime`'s envelope builders. Existing
 * call sites use:
 *   - `envelope(data)` — returns the plain ApiSuccess envelope (callers wrap
 *     with HttpResponse.json themselves).
 *   - `errorEnvelope(code, message, status)` — returns a fully-formed
 *     HttpResponse with status set, used as a return value.
 */
const envelope = buildSuccessEnvelope;

function errorEnvelope(code: string, message: string, status: number) {
  return HttpResponse.json(buildErrorEnvelope(code, message), { status });
}

// ---- Helpers --------------------------------------------------------------

function readNumberParam(
  url: URL,
  key: string,
  defaultValue: number,
): number {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === '') return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

function parseIsoDuration(spec: string | null): number {
  // Minimal parser for PT15M, PT1H, P7D, etc.
  if (!spec) return 15 * 60_000;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(spec);
  if (!m) return 15 * 60_000;
  const [, d, h, mins, s] = m;
  let ms = 0;
  if (d) ms += Number(d) * 86_400_000;
  if (h) ms += Number(h) * 3_600_000;
  if (mins) ms += Number(mins) * 60_000;
  if (s) ms += Number(s) * 1000;
  return ms || 15 * 60_000;
}

function applyClinicScopeFilter(
  rows: AdminCaseRow[],
  clinicIdsParam: string | null,
): AdminCaseRow[] {
  if (!clinicIdsParam) return rows;
  const allowed = new Set(clinicIdsParam.split(',').map((s) => s.trim()));
  return rows.filter((r) => r.clinic_id !== null && allowed.has(r.clinic_id));
}

// ---- Handlers builder -----------------------------------------------------

export function buildAdminHandlers(baseUrl: string) {
  const u = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;

  return [
    // ---- 1. GET /v1/admin/cases ------------------------------------------
    http.get(u('/v1/admin/cases'), ({ request }) => {
      const url = new URL(request.url);
      const stateCode = url.searchParams.get('state_code');
      const caseType = url.searchParams.get('case_type');
      const clinicIds = url.searchParams.get('clinic_ids');
      const payerId = url.searchParams.get('payer_id');
      const ownerUserId = url.searchParams.get('owner_user_id');
      const includeClosed = url.searchParams.get('include_closed') === 'true';
      const offset = readNumberParam(url, 'offset', 0);
      const limit = readNumberParam(url, 'limit', 50);
      const sort = url.searchParams.get('sort') ?? 'age_desc';
      const groupBy = url.searchParams.get('group_by');

      const { adminRows } = getMockState();
      let rows = [...adminRows];

      // Closed-case gate (BRD: closed cases keep state_code; closed_at IS NOT NULL is the indicator)
      if (!includeClosed) {
        rows = rows.filter((r) => r.closed_at === null);
      }

      if (stateCode) rows = rows.filter((r) => r.state_code === stateCode);
      if (caseType) rows = rows.filter((r) => r.case_type === caseType);
      if (payerId) rows = rows.filter((r) => r.payer_id === payerId);
      if (ownerUserId) rows = rows.filter((r) => r.owner_user_id === ownerUserId);
      rows = applyClinicScopeFilter(rows, clinicIds);

      // Sort
      switch (sort) {
        case 'age_asc':
          rows.sort((a, b) => (a.opened_at ?? '').localeCompare(b.opened_at ?? ''));
          break;
        case 'last_activity_desc':
          rows.sort((a, b) =>
            (b.state_updated_at ?? '').localeCompare(a.state_updated_at ?? ''),
          );
          break;
        case 'case_id_asc':
          rows.sort((a, b) => a.case_id.localeCompare(b.case_id));
          break;
        case 'age_desc':
        default:
          rows.sort((a, b) => (a.opened_at ?? '').localeCompare(b.opened_at ?? ''));
          break;
      }

      const total = rows.length;
      const page = rows.slice(offset, offset + limit);

      let groups: Record<string, number> | null = null;
      if (groupBy) {
        const acc: Record<string, number> = {};
        for (const r of rows) {
          const key =
            groupBy === 'state_code'
              ? r.state_code
              : groupBy === 'case_type'
                ? r.case_type
                : groupBy === 'clinic_id'
                  ? r.clinic_id ?? '<null>'
                  : groupBy === 'payer_id'
                    ? r.payer_id ?? '<null>'
                    : '<null>';
          acc[key] = (acc[key] ?? 0) + 1;
        }
        groups = acc;
      }

      const body: PaginatedAdminCasesResponse = {
        items: page,
        total,
        offset,
        limit,
        ...(groups ? { groups } : {}),
      };
      return HttpResponse.json(envelope(body));
    }),

    // ---- 2. GET /v1/admin/recent-activity --------------------------------
    http.get(u('/v1/admin/recent-activity'), ({ request }) => {
      const url = new URL(request.url);
      const sinceSpec = url.searchParams.get('since');
      const since = parseIsoDuration(sinceSpec);
      const stateFrom = url.searchParams.get('state_code_from');
      const stateTo = url.searchParams.get('state_code_to');
      const triggerType = url.searchParams.get('trigger_type');
      const caseType = url.searchParams.get('case_type');
      const clinicIds = url.searchParams.get('clinic_ids');
      const offset = readNumberParam(url, 'offset', 0);
      const limit = readNumberParam(url, 'limit', 100);

      const { recentActivity } = getMockState();
      const cutoffMs = Date.parse(FIXTURE_NOW_ISO) - since;
      let rows = recentActivity.filter(
        (r) => r.occurred_at !== null && Date.parse(r.occurred_at) >= cutoffMs,
      );

      if (stateFrom) rows = rows.filter((r) => r.state_code_from === stateFrom);
      if (stateTo) rows = rows.filter((r) => r.state_code_to === stateTo);
      if (triggerType) rows = rows.filter((r) => r.trigger_type === triggerType);
      if (caseType) rows = rows.filter((r) => r.case_type === caseType);
      if (clinicIds) {
        const allowed = new Set(clinicIds.split(',').map((s) => s.trim()));
        rows = rows.filter((r) => r.clinic_id !== null && allowed.has(r.clinic_id));
      }

      const total = rows.length;
      const page = rows.slice(offset, offset + limit);

      const body: RecentActivityResponse = {
        items: page,
        total,
        offset,
        limit,
        since: new Date(cutoffMs).toISOString(),
      };
      return HttpResponse.json(envelope(body));
    }),

    // ---- 3. GET /v1/admin/stuck-cases ------------------------------------
    http.get(u('/v1/admin/stuck-cases'), ({ request }) => {
      const url = new URL(request.url);
      const offset = readNumberParam(url, 'offset', 0);
      const limit = readNumberParam(url, 'limit', 50);

      const { stuckRows } = getMockState();
      const total = stuckRows.length;
      const page = stuckRows.slice(offset, offset + limit);

      const body: StuckCasesResponse = {
        items: page,
        total,
        offset,
        limit,
      };
      return HttpResponse.json(envelope(body));
    }),

    // ---- 4. GET /v1/cases/{case_id} --------------------------------------
    http.get(u('/v1/cases/:caseId'), ({ params }) => {
      const caseId = params.caseId as string;
      const { caseDetails } = getMockState();
      const detail = caseDetails.get(caseId);
      if (!detail) {
        return errorEnvelope('NOT_FOUND', `Case ${caseId} not found`, 404);
      }
      const body: CaseDetailResponse = detail;
      return HttpResponse.json(envelope(body));
    }),

    // ---- 5. GET /v1/cases/{case_id}/history ------------------------------
    http.get(u('/v1/cases/:caseId/history'), ({ params, request }) => {
      const caseId = params.caseId as string;
      const url = new URL(request.url);
      const offset = readNumberParam(url, 'offset', 0);
      const limit = readNumberParam(url, 'limit', 50);

      const { caseHistories } = getMockState();
      const rows = caseHistories.get(caseId) ?? [];
      const total = rows.length;
      const page = rows.slice(offset, offset + limit);

      const body: CaseHistoryResponse = {
        items: page,
        total,
        offset,
        limit,
      };
      return HttpResponse.json(envelope(body));
    }),

    // ---- 6. GET /v1/health/scheduler -------------------------------------
    http.get(u('/v1/health/scheduler'), () => {
      const body: SchedulerHealth = {
        last_poll_at: FIXTURE_NOW_ISO,
        polling_lag_seconds: 4,
        active_lease_count: 7,
        version: '0.1.2',
        status: 'healthy',
      };
      return HttpResponse.json(envelope(body));
    }),
  ];
}
