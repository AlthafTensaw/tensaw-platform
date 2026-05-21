/**
 * Operations Console — actions registry (Phase A).
 *
 * Defines every action the operations console can dispatch. Mirrors
 * the patient app's `registerARActions` pattern at
 * `apps/patient/src/pages/ar-mgmt/actions.ts`.
 *
 * Phase A is read-only: 6 query actions, no mutations. Phase B will
 * add 4 mutations (admin.retry-case, admin.close-case, admin.advance-case,
 * admin.reassign-owner) — declarations are NOT included here.
 *
 * Permission strings are mapped to roles in `src/auth/permissions.ts`.
 * Phase A actions all require `console.read` which spans all read-capable
 * roles per frontend tech spec §4.5.
 *
 * Cache invalidation: queries are tagged so Phase B mutations can
 * invalidate without us having to revisit each query declaration. The
 * `invalidatedBy` lists reference Phase B action ids — these resolve
 * to no-ops in Phase A because the actions aren't registered yet
 * (registry treats unknown ids as "never invalidate"), and become
 * active automatically when Phase B registers them.
 *
 * Register at app boot:
 *   import { registerOperationsConsoleActions } from './actions';
 *   registerOperationsConsoleActions();
 */

import { z } from 'zod';
import { defineAction } from '@tensaw/actions';

import {
  CaseDetailResponseSchema,
  CaseHistoryResponseSchema,
  CASE_GROUP_BY_OPTIONS,
  CASE_SORT_OPTIONS,
  PaginatedAdminCasesResponseSchema,
  RecentActivityResponseSchema,
  SchedulerHealthSchema,
  StuckCasesResponseSchema,
} from './schemas';

/**
 * Register all Operations Console Phase A actions. Called once from
 * `bootstrap.ts`. Idempotent on the registry side (defineAction throws
 * on duplicate id, which is the right behavior for a single-app boot path).
 */
export function registerOperationsConsoleActions(): void {
  // ---- Admin cases listing (Dashboard, Case List, Activity Stream) -----

  defineAction({
    actionId: 'admin.list-cases',
    kind: 'query',
    endpoint: 'GET /v1/admin/cases',
    permission: 'console.read',
    description:
      'List cases with filters, sort, pagination, optional grouping. ' +
      'Powers the Case List screen and the Dashboard "by state" chart.',
    request: z.object({
      state_code: z.string().optional(),
      case_type: z.string().optional(),
      /** Comma-separated; server enforces user's clinic scope. */
      clinic_ids: z.string().optional(),
      payer_id: z.string().optional(),
      owner_user_id: z.string().optional(),
      created_at_gte: z.string().datetime().optional(),
      created_at_lte: z.string().datetime().optional(),
      include_closed: z.boolean().optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(0).max(200).optional(),
      sort: z.enum(CASE_SORT_OPTIONS).optional(),
      group_by: z.enum(CASE_GROUP_BY_OPTIONS).optional(),
    }),
    response: PaginatedAdminCasesResponseSchema,
    cache: {
      tag: 'admin-cases',
      // Phase B mutations invalidate this. Until they register, these
      // ids resolve to no-ops in the dispatcher.
      invalidatedBy: [
        'admin.retry-case',
        'admin.close-case',
        'admin.advance-case',
        'admin.reassign-owner',
      ],
    },
  });

  // ---- Recent activity (Dashboard panel + Activity Stream) -------------

  defineAction({
    actionId: 'admin.recent-activity',
    kind: 'query',
    endpoint: 'GET /v1/admin/recent-activity',
    permission: 'console.read',
    description: 'Cross-case timeline of recent state transitions.',
    request: z.object({
      /** ISO-8601 duration. Default PT15M, max P7D server-side. */
      since: z.string().regex(/^P/).optional(),
      state_code_from: z.string().optional(),
      state_code_to: z.string().optional(),
      /**
       * Per backend Phase A handback deviation #1, accepts the actual
       * v0.1.0 schema values: POLL, SIGNAL, MANUAL_ADVANCE, RECLAIM
       * (plus v0.1.2 additions CONSOLE_RETRY, CONSOLE_CLOSE).
       */
      trigger_type: z.string().optional(),
      case_type: z.string().optional(),
      clinic_ids: z.string().optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }),
    response: RecentActivityResponseSchema,
    cache: {
      tag: 'recent-activity',
      invalidatedBy: [
        'admin.retry-case',
        'admin.close-case',
        'admin.advance-case',
        'admin.reassign-owner',
      ],
    },
  });

  // ---- Stuck cases (Stuck Cases screen + Dashboard KPI) ----------------

  defineAction({
    actionId: 'admin.stuck-cases',
    kind: 'query',
    endpoint: 'GET /v1/admin/stuck-cases',
    permission: 'console.read',
    description:
      'Cases needing human attention (overdue, max-attempts, fatal error). ' +
      'Powers the Stuck Cases screen + the Dashboard\'s stuck-count KPI.',
    // NOTE: This schema uses `.default(...)` for `offset` and `limit` — Phase A
    // had stripped the defaults to work around the cache-key parity bug
    // (see Frontend_Phase_A_Handback.md, Issue #1). With the platform fix
    // applied (useActionQuery pre-validates the request), `.default(...)` is
    // safe to use again. The dashboard widget calls this with `{}` and gets
    // the defaults applied; the stuck-cases page passes a `limit` and the
    // default `offset: 0` fills in.
    request: z.object({
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(500).default(50),
    }),
    response: StuckCasesResponseSchema,
    cache: {
      tag: 'stuck-cases',
      invalidatedBy: [
        'admin.retry-case',
        'admin.close-case',
        'admin.advance-case',
      ],
    },
  });

  // ---- Case detail (Case Detail screen) --------------------------------

  defineAction({
    actionId: 'admin.case-detail',
    kind: 'query',
    endpoint: 'GET /v1/cases/{case_id}',
    permission: 'console.read',
    description: 'Single case snapshot — case + open tasks + facts.',
    request: z.object({ case_id: z.string() }),
    response: CaseDetailResponseSchema,
    cache: {
      tag: 'case-detail',
      invalidatedBy: [
        'admin.retry-case',
        'admin.close-case',
        'admin.advance-case',
        'admin.reassign-owner',
      ],
    },
  });

  // ---- Case history (Case Detail screen) -------------------------------

  defineAction({
    actionId: 'admin.case-history',
    kind: 'query',
    endpoint: 'GET /v1/cases/{case_id}/history',
    permission: 'console.read',
    description: 'Step history for a case (the timeline section).',
    request: z.object({
      case_id: z.string(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    response: CaseHistoryResponseSchema,
    cache: {
      tag: 'case-history',
      invalidatedBy: [
        'admin.retry-case',
        'admin.close-case',
        'admin.advance-case',
      ],
    },
  });

  // ---- Scheduler health (Dashboard "Polling lag" KPI) ------------------

  defineAction({
    actionId: 'admin.health-scheduler',
    kind: 'query',
    endpoint: 'GET /v1/health/scheduler',
    permission: 'console.read',
    description: 'Scheduler health — polling lag, active leases, version.',
    request: z.object({}),
    response: SchedulerHealthSchema,
    cache: { tag: 'health-scheduler' },
  });
}
