# FE v4.0.0 · P1.3 — Mock-server scaffold

**Phase:** P1.3 (third code deliverable of the v4 rewrite)
**Companion to:** `FE-v4.0.0-design-contract.md` §8 build order
**Status:** Code-complete; `tsc --strict` clean + 25/25 end-to-end smoke tests pass

---

## What's in this deliverable

Mock-server backed by MSW v2 + an in-memory store + a workflow engine simulator. Lets FE develop the full accept → complete cycle without staging BE.

| File | Lines | Purpose |
|---|---|---|
| `src/mocks/v4/workflows.ts` | 145 | 4 workflow defs (8 task types covered) + helpers |
| `src/mocks/v4/db.ts` | 470 | In-memory store + CRUD + state transitions |
| `src/mocks/v4/seed.ts` | 320 | 15 hand-crafted cases across all 4 statuses |
| `src/mocks/v4/handlers.ts` | 470 | 24 MSW handlers + 2 health probes |
| `src/mocks/v4/index.ts` | 14 | Barrel export |
| `scripts/sanity-check-v4-mock-server.ts` | 320 | End-to-end smoke test |

Total: ~1740 lines added; 0 lines modified in existing files.

### The 4 workflows (covering 8 task types)

```
medical_necessity_resolution:  intake_triage → resolution_action → awaiting_payer_check → am_review → posting_apply
coding_review_branch:          intake_triage → coding_review → coding_feedback_review → resolution_action → awaiting_payer_check → posting_apply
payer_call_resolution:         intake_triage → payer_call → resolution_action → awaiting_payer_check
portal_first_resolution:       intake_triage → portal_status_check → resolution_action → awaiting_payer_check → posting_apply
```

`coding_feedback_review` step is special: its `queue_id` is `user_<originator>` — the simulator resolves this at runtime to `user_${case.originated_by_user_id}`, modeling the team-handoff return pattern (needs_my_review).

The 3 task types not covered (`bank_rec_match`, `high_dollar_oversight` sidecar variants) are sidecar/late-stage flows; mock can add them in a later phase if needed.

### The 15 seed cases

- **6 proposed** — Henderson/Romero/Yamamoto/Mickelson/Singh/Donovan (the intake worklist for an analyst's first login)
- **5 accepted** — Whitfield (HD, on coding_review), Okafor (portal_status_check), Cardenas (awaiting_payer_check), Olusegun (payer_call), Patel (overridden, on resolution_action)
- **3 needs_my_review** — copies of Whitfield/Okafor/Romero post-coding, on `user_42` queue with `coding_feedback_review` tasks

This gives the FE realistic data for every P0 mockup state without further setup.

---

## Engine simulator behavior

What happens when the FE calls each mutation:

### `case.accept` / `case.override`
- Sets `case_status` = `accepted` / `overridden`
- Sets `originated_by_user_id` from `X-Mock-User-Id` header (default 42 = Vipin K.)
- Looks up the workflow via `CATEGORY_TO_WORKFLOW[recommended_category]`
- Opens the first task on the workflow's first queue
- Sets `engine_state_code` to `<TASK_TYPE>_OPEN`
- Auto-emits a `classifier`-source note
- Returns updated `CaseDetail` + the newly opened `EngineTask`
- 409 if state isn't `proposed`

### `task.complete`
- Validates task is OPEN
- Marks task `COMPLETED`; moves it from `engine_tasks_open` to `engine_tasks_recent`
- Auto-emits a `system`-source note with outcome + facts
- On `SUCCESS` or `NEEDS_INFO`: advances `_workflow_step_index`, opens the next task (or completes the case if last step)
- On `FAIL_FATAL`: closes the case with `engine_state_code = 'FAILED'`
- For `coding_feedback_review` (the `user_<originator>` step): queue_id resolves to `user_${case.originated_by_user_id}`

### Queue counts
`queue.list` returns live counts derived from open tasks + (for the intake queue) proposed cases without open tasks. Counts update automatically as state transitions happen — the FE will see badge numbers shift correctly.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

### End-to-end smoke (25 tests)

```
=== Reference data ===                  5/5  passed
  · queues, categories, lookups + cascades (clinic_lsat providers/payers/facilities)

=== Worklist ===                        4/4  passed
  · default intake queue returns proposed cases
  · coding_primrose queue returns Whitfield M case (the seed coding_review task)
  · user_42 queue returns 3 needs_my_review cases
  · net_pending_min=750 filter returns only HD cases

=== task.mine (personal queue) ===      1/1  passed

=== Case detail + tab data ===          4/4  passed
  · case detail loads with right patient
  · unknown case returns 404
  · notes empty array on fresh case
  · transactions auto-seeds a denial transaction

=== Engine simulator: accept + complete cycle ===  4/4  passed
  · accept transitions to accepted + opens intake_triage on right queue
  · double-accept returns 409 (invalid state transition)
  · complete intake_triage opens resolution_action on resolution_primrose
  · walking through all 5 workflow steps marks case completed

=== Override flow ===                   1/1  passed
  · override with auth_missing routes to payer_call_resolution workflow

=== Note + File + Appeal flows ===      4/4  passed
  · POST a note (source=analyst, author populated from X-Mock-User-Id)
  · POST a file without Idempotency-Key returns 400
  · POST a file with Idempotency-Key succeeds
  · POST appeal/generate returns a draft with non-trivial body

=== Health probes ===                   2/2  passed
  · /healthz and /readyz

25 passed · 0 failed
```

The smoke test isn't a formal test suite (P1.13) — it's a runtime confidence check. Re-run after any handler change to catch regressions.

---

## Integration steps

1. Drop the `mocks/v4/` folder into `apps/denial-tool/src/`
2. Drop the sanity-check script into `apps/denial-tool/scripts/`
3. Wire MSW into the dev bootstrap. Typical setup:

   ```ts
   // src/mocks/browser.ts
   import { setupWorker } from 'msw/browser';
   import { handlersV4, seedV4 } from './v4';

   seedV4();
   export const worker = setupWorker(...handlersV4);
   ```

   ```ts
   // src/main.tsx — only in dev
   if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
     const { worker } = await import('./mocks/browser');
     await worker.start({ onUnhandledRequest: 'bypass' });
   }
   ```

4. Add to `package.json`:
   ```json
   "scripts": {
     "sanity-check-v4-mocks": "tsx scripts/sanity-check-v4-mock-server.ts"
   }
   ```

5. Set `VITE_USE_MOCKS=true` in `.env.local` for dev work against the mock.

### Note on handler path matching

Handlers use the `*` wildcard prefix (`http.get('*/api/v1/cases/worklist', ...)`). This is required for MSW v2 in Node test mode and also works correctly for the browser worker. If you'd rather strip the `*` for production browser code (relative paths work there), it's a one-line search-and-replace — but I'd leave it; the wildcard doesn't change browser behavior.

---

## What the FE can do with this mock

The full P0 user journey works end-to-end:

1. **Sign in → land on default queue.** Queue switcher dropdown populates from `queue.list`. needs_my_review badge shows count 3 (the three seed coding_feedback_review tasks on user_42).
2. **See proposed cases in worklist.** Six of them, varied categories, one HD ($945 — Yamamoto).
3. **Click Henderson case → see proposed-state work pane.** LLM recommendation visible, workflow preview shows 5 dashed circles.
4. **Click Accept.** Case status flips to accepted; workflow strip lights up step 1; intake_triage form appears with LLM-suggested category pre-filled.
5. **Fill out the form and mark complete.** Resolution_action task opens; case re-renders with step 2 highlighted.
6. **Switch to needs_my_review queue.** See three returned cases with `coding_feedback_review` tasks.
7. **Complete the feedback review.** Resolution_action opens on resolution_primrose.

Every mockup state we drew has corresponding data in this mock.

---

## Two contract-adjacent decisions

1. **Reference data is hardcoded in `handlers.ts`** rather than in seed.ts. Reason: categories, clinics, providers, payers, facilities are reference data that doesn't change during a session. Putting them in handlers keeps seed.ts focused on case data. Reversible if you'd rather centralize.

2. **`X-Mock-User-Id` header** for identity overrides instead of a more elaborate JWT mock. Reason: lightweight, debuggable (curl it manually), matches the BE handoff's hint about test fixtures. The real auth flow stays unchanged.

---

## What comes next (P1.4)

Per the design contract §8, next is **TopNav rewrite — `QueueSwitcher` + needs_my_review badge**. First UI component, anchored on:
- The QueueSwitcher dropdown shown in mockup #1
- The red My tasks badge shown in mockup #2
- Data from `queue.list` + `task.mine` (both now working in the mock)

Since P1.4 and P1.5 (CaseCard) are both small and share the worklist surface, I can bundle them into one session if you want. Say either:

- `"start P1.4"` — TopNav only
- `"start P1.4+P1.5"` — TopNav + CaseCard in one session (still reviewable but more deliverable per turn)

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `workflows.ts` | `src/mocks/v4/workflows.ts` |
| `db.ts` | `src/mocks/v4/db.ts` |
| `seed.ts` | `src/mocks/v4/seed.ts` |
| `handlers.ts` | `src/mocks/v4/handlers.ts` |
| `mocks-v4-index.ts` | `src/mocks/v4/index.ts` |
| `sanity-check-v4-mock-server.ts` | `scripts/sanity-check-v4-mock-server.ts` |
| `README-P1.3.md` | reference; not a runtime file |
