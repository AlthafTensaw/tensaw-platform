# FE v4.0.0 · P1.2 — Action Registry

**Phase:** P1.2 (second code deliverable of the v4 rewrite)
**Companion to:** `FE-v4.0.0-design-contract.md` §2 (Action registry)
**Status:** Code-complete; verified `tsc --strict` clean + 26/26 runtime checks pass

---

## What's in this deliverable

Two new TypeScript files. Both additive — P1.1 files untouched.

| File | Lines | Drop-in path |
|---|---|---|
| `schemas-v4-tabs.ts` | 197 | `src/actions/schemas-v4-tabs.ts` |
| `index-v4.ts` | 419 | `src/actions/index-v4.ts` |

Plus an updated sanity-check script (`sanity-check-v4-registry.ts`, 290 lines).

### `schemas-v4-tabs.ts` — Tab data schemas

Schemas the design contract §1 didn't cover because they're tab-specific:

- `NoteSchema` + `NoteSourceSchema` (`analyst | system | classifier | appeal`)
- `FileSchema` + `FileTypeSchema` (6 types)
- `AppealSchema` + `AppealTemplateSchema` + `AppealStatusSchema`
- `TransactionSchema` + `TransactionTypeSchema` + `PayerSourceSchema`
- `CategorySchema` (denial categories with workflow mapping — powers WorkflowPreview)
- `LookupItemSchema` (shared shape across the 4 cascade lookup endpoints)

Plus matching `*ResponseSchema` wrappers for each.

These are in a separate file from P1.1's `schemas-v4.ts` to keep the P1.1 ship untouched. If you'd rather consolidate later, easy to merge.

### `index-v4.ts` — Action registry

`registerCaseActions()` function that registers all 24 actions:

**14 queries:**
- `case.worklist`, `case.detail`, `case.tasks` (case lifecycle)
- `task.mine`, `queue.list` (personal queue + queue switcher)
- `case.notes`, `case.files`, `case.transactions`, `case.appeal.get` (tab data)
- `category.list`, `lookup.clinics`, `lookup.providers`, `lookup.payers`, `lookup.facilities` (reference data)

**10 mutations:**
- `case.accept`, `case.override`, `case.reclassify` (case state transitions)
- `task.complete`, `case.signal` (task lifecycle)
- `case.note.add`, `case.file.upload` (content mutations)
- `case.appeal.generate`, `case.appeal.save` (appeal lifecycle)
- `case.reveal-phi` (audit-only)

**Additionally exported:**
- `INVALIDATE` — the cache invalidation matrix as a const (single source of truth)
- `MUTATION_ACTION_IDS`, `QUERY_ACTION_IDS` — typed const arrays
- `MutationActionId`, `QueryActionId` — derived union types
- `auditInvalidationMatrix()` — runtime consistency check; returns problems array

---

## 4 endpoints NOT in the registry (intentional)

The design contract §2.2 lists 18 read actions; this registry has 14. The other 4 are intentionally handled outside the action-dispatch system because they don't fit the JSON request/response model:

| Endpoint | How to use instead |
|---|---|
| `GET /api/v1/cases/legacy/{old_id}` | React Router route handler. The browser follows the 301 to the new `/cases/{case_id}` URL automatically. No action dispatch needed. |
| `GET /api/v1/files/{file_id}/download` | `<a href="..." download>` for browser-save (attachment disposition). |
| `GET /api/v1/files/{file_id}/preview` | `<iframe src="...">` for inline preview (inline disposition). |
| `GET /api/v1/cases/{id}/appeal/{id}/render-pdf` | `window.open(url)` or `<a href="..." target="_blank">` to download the PDF. |

A small `urls-v4.ts` helper could be a nice-to-have in P1.X to centralize URL-building for these — flag if you want it.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

Both `schemas-v4-tabs.ts` and `index-v4.ts` compile under `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. Zero errors.

### Runtime sanity (26 cases)

```
=== Registry registration ===          6/6  passed
  · registerCaseActions() runs without throwing
  · exactly 24 actions register (14 queries + 10 mutations)
  · every QUERY_ACTION_IDS / MUTATION_ACTION_IDS entry registered correctly
  · every action has a non-empty description
  · every action uses a known permission tag

=== Invalidation matrix ===           4/4  passed
  · auditInvalidationMatrix() returns no problems
  · every documented cache tag from contract §2.5 present
  · every query cache tag is known
  · every invalidatedBy reference targets a real mutation

=== Tab data schemas ===              11/11 passed
  · NoteSchema parses analyst + system notes
  · FileSchema parses medical record; rejects unknown file_type
  · AppealSchema parses draft + finalized variants
  · TransactionSchema parses denial + payment transactions
  · CategorySchema parses with workflow step labels
  · LookupItemSchema with and without alias

=== Spot-check action shapes ===      5/5  passed
  · case.worklist has 5 invalidators (the documented set)
  · task.complete is permission denial.act
  · case.reclassify is permission denial.classify (manager-only)
  · queue.list invalidates on case.accept, task.complete, case.signal
  · case.transactions has no FE-driven invalidation (vendor data)

26 passed · 0 failed
```

---

## How v3.0.3's invalidation lesson got applied

v3.0.3 fix #9/#10 (frontend team's recommendation): declare cache invalidation centrally in the action registry's `invalidatedBy` arrays — never in per-component `queryClient.invalidateQueries` calls.

v4 implements this from day one. The `INVALIDATE` const at the top of `index-v4.ts` is the single source of truth. Every query declares its `invalidatedBy` by reading from this const. The matrix is auditable at a glance:

```ts
const INVALIDATE = {
  worklist:        ['case.accept', 'case.override', 'case.reclassify', 'task.complete', 'case.signal'],
  'case-detail':   ['case.accept', 'case.override', 'case.reclassify', 'task.complete', 'case.signal', 'case.appeal.save'],
  // ...
} as const;
```

If a new mutation gets added later, the developer updates this matrix; the audit function catches typos at module load time.

---

## Integration steps

1. Drop both files into `apps/denial-tool/src/actions/`
2. Update `main.tsx` to also call `registerCaseActions()` alongside the existing `registerDenialActions()`:
   ```ts
   import { registerDenialActions } from './actions';
   import { registerCaseActions } from './actions/index-v4';

   registerDenialActions();   // v3 — remove once migration completes
   registerCaseActions();     // v4
   ```
3. `npm run build` should succeed (no other v4 consumers yet — P1.3+ wires them)
4. Optionally drop `sanity-check-v4-registry.ts` under `apps/denial-tool/scripts/` and add to package.json:
   ```json
   "sanity-check-v4": "tsx scripts/sanity-check-v4-schemas.ts && tsx scripts/sanity-check-v4-registry.ts"
   ```

After v4 migration completes (P1.14 in contract §8):
- Delete the call to `registerDenialActions()` from `main.tsx`
- Delete the v3 `src/actions/index.ts`
- Delete the v3 `src/actions/schemas.ts`

---

## Two small additions beyond the design contract

1. **`auditInvalidationMatrix()` self-audit function** — runtime consistency check that every actionId referenced in `INVALIDATE` actually exists as a registered mutation. Catches typos in the matrix at module-load time. Negligible cost; high value if someone adds a new mutation and mistypes the ID in the matrix.

2. **Typed const arrays (`MUTATION_ACTION_IDS`, `QUERY_ACTION_IDS`)** with derived union types — gives components compile-time correctness when referencing action IDs (e.g., `useActionQuery<TQ extends QueryActionId>(actionId: TQ)`). Not strictly required by the contract but unlocks better DX for the components in later P1 phases.

Both are reversible — easy to drop if you'd rather a leaner deliverable.

---

## One contract deviation worth flagging

The design contract said "Action registry entries in `src/actions/index.ts`". This deliverable creates a NEW file `src/actions/index-v4.ts` instead of modifying the existing `index.ts`. Reasons:

- Keeps the P1.X deliverables additive and reviewable in isolation
- Trivial deletion path when v4 migration completes (drop the file, drop the import)
- Avoids re-shipping a modified `index.ts` (which I don't have in this session's context anyway)

If you'd rather have a single `index.ts` with both v3 and v4 sections delimited by comments, easy to merge — just paste the contents of `registerCaseActions()` into the existing file.

---

## What comes next (P1.3)

Per the design contract §8, next is **mock-server scaffold for v4 endpoints**. This lets FE develop without waiting on BE staging — same model as the v3 mock-server we already have.

Concretely: handlers for each of the 24 actions returning realistic shaped data, seed data for ~50 cases across various states, queue list returning the user's role-default + personal queue.

Say "start P1.3" and I'll ship it.

---

## Files in this deliverable

- `schemas-v4-tabs.ts` (197 lines) — tab data schemas
- `index-v4.ts` (419 lines) — registry + invalidation matrix + audit helpers
- `sanity-check-v4-registry.ts` (290 lines) — verification harness (optional)

Total: 906 lines added; 0 lines modified in existing files.
