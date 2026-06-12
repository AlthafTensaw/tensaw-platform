# FE v4.0.0 · P1.1 — `schemas-v4.ts`

**Phase:** P1.1 (first code deliverable of the v4 rewrite)
**Companion to:** `FE-v4.0.0-design-contract.md` §1 (Domain types)
**Status:** Code-complete; verified `tsc --strict` clean + 24/24 runtime sanity checks pass

---

## What's in this deliverable

One TypeScript file containing every domain type Zod schema for v4.0.0, plus the query request/response schemas that pair with them. Drop-in path: `src/actions/schemas-v4.ts`.

### Inventory (matches design contract §1)

| Schema / Type | Purpose | Contract ref |
|---|---|---|
| `CaseStatusSchema`, `Case` | Top-level domain object (replaces v3 `Classification`) | §1.1 |
| `TaskStateSchema`, `TaskTypeSchema`, `PriorityCodeSchema`, `EngineTaskSchema` | Engine task wire shape | §1.2 |
| `QueueTypeSchema`, `QueueSchema` | Queue routing destinations | §1.3 |
| `WorklistRowSchema`, `WorklistRequestSchema`, `WorklistResponseSchema` | `case.worklist` query shapes | §1.4 |
| `HandlerOutcomeSchema` | The 3 FE-facing task outcomes | §1.5 |
| 11 `*FactsSchema` + `TaskFactsByType` + `TaskFacts<T>` generic | Per-task-type completion form facts | §1.6 |
| `CaseDetailSchema` | `case.detail` response (rich: engine + claim + financial) | §1.7 |
| `TasksMineRequestSchema`, `TasksMineResponseSchema` | `task.mine` (personal queue) query shapes | §1.8 — added per build-order discussion |
| `isCaseProposed`, `isCaseInFlight`, `isCaseCompleted`, `isReviewTask` | Convenience type guards for state-aware UI branching | new |

The four type-guard predicates aren't in the contract spec but live alongside the schemas because they centralize the string-literal checks for `case_status` and `queue_id` patterns. The cost is tiny (15 lines); the benefit is one place to update if state names ever change.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

Compiled with `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. Zero errors.

### Runtime sanity check

A 24-case parse test against realistic fixture payloads (Henderson, J. — claim 300138, the same case shown in mockups #8 / #9):

```
=== CaseSchema ===              3/3 passed
=== EngineTaskSchema ===        3/3 passed (all 11 task_types + user_* queue)
=== QueueSchema ===             2/2 passed (team + personal)
=== WorklistRow + Response ===  3/3 passed (current_task populated + null)
=== WorklistRequest ===         2/2 passed (minimal + needs_my_review)
=== Task fact schemas ===       4/4 passed (all 11 fact shapes)
=== CaseDetail ===              1/1 passed (full join)
=== TasksMineRequest ===        1/1 passed
=== HandlerOutcome ===          2/2 passed (accepts FE outcomes + rejects internal-only)
=== Type guards ===             2/2 passed
=== CaseStatusSchema ===        1/1 passed

24 passed · 0 failed
```

The sanity-check script ships at `scripts/sanity-check-v4-schemas.ts` for re-running after any schema change. It's not a formal test suite — that comes in P1.13 — but catches Zod-definition mistakes the type system can't (wrong field names, missing required fields, enum mismatches).

---

## Two small additions beyond the contract

1. **`TasksMineRequestSchema` + `TasksMineResponseSchema`** were promoted from "implied" to "named exports" because they share filter semantics with `WorklistRequest` and the My Tasks page will lean on them. Their schemas mirror Worklist's pagination contract.

2. **Type guards (`isCaseProposed`, etc.)** — centralized string-literal checks for `case_status` and queue prefix matching. Same purpose as `WorklistRow.case_status === 'proposed'` inline, but one source of truth.

Neither changes the contract's intent. Both are nice-to-have utilities. If you'd rather not add them, easy to remove — the guards are at the bottom of the file in their own section.

---

## Integration steps

1. Drop `schemas-v4.ts` into `apps/denial-tool/src/actions/`
2. Confirm v3 `schemas.ts` is untouched (this file coexists; doesn't replace anything in P1.1)
3. `npm run build` should succeed (no other imports of `schemas-v4.ts` yet — P1.2 is when it gets used)
4. Optionally drop the sanity-check script under `apps/denial-tool/scripts/` and add `"sanity-check-v4": "tsx scripts/sanity-check-v4-schemas.ts"` to package.json

---

## What comes next (P1.2)

Per the design contract §8, the next deliverable is `src/actions/index.ts` updates — adding v4 action registry entries alongside the v3 entries:

- 18 read actions (`case.worklist`, `case.detail`, `task.mine`, `queue.list`, lookups, notes, files, transactions, appeals)
- 10 write actions (`case.accept`, `case.override`, `case.reclassify`, `task.complete`, `case.signal`, notes/files/appeals/PHI mutations)
- Cache invalidation matrix declared centrally (v3.0.3 lesson — no per-component invalidation)
- Inline mutation request shapes that reference the schemas in this file

Should be a single-file PR like this one. Tells me whether to start.

---

## Files in this deliverable

- `schemas-v4.ts` (605 lines) — the drop-in file
- `sanity-check-v4-schemas.ts` (200 lines) — the verification harness, optional but recommended to keep
