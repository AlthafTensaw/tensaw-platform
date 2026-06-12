# FE v4.0.0 · P1.14 — v3.x cleanup plan

**Phase:** P1.14 (deletion + import-graph fix pass against the FE repo)
**Status:** Planning doc + discovery script — executed by Vipin against the real codebase
**Owner:** Vipin (execution); Vineeth-Second (PR review + merge gate)

---

## What's in this deliverable

| File | Purpose |
|---|---|
| `v3-cleanup-discovery.sh` | Bash script that inventories v3 symbols/files still in the codebase. Read-only — no deletions. Run before each stage to see what's left. |
| `README-P1.14.md` | This document — staged deletion plan, verification gates, sample PR, rollback strategy. |

---

## Pre-flight checklist

Before starting the cleanup, confirm:

- [ ] **v4 is on staging and stable for at least 24h.** No fresh incidents in the past day.
- [ ] **Vivek's smoke pass** against v4 staging is complete and green.
- [ ] **AR-team comms** sent — the v3 URL bookmarks will redirect via P1.12, but heavy v3 users should know we're removing the old code path. Window of "one team can still rollback if needed" closes after this merge.
- [ ] **Feature flag config** is set so no env still routes to v3 by default.
- [ ] **Git working tree is clean** — start the cleanup on a fresh branch from `main`.
- [ ] **Tests are green on main** — run `npm test` + `npm run test:smoke`. If anything is red on main, fix that first; cleanup is not the place to debug regressions.
- [ ] **You have ~half a day** of focused time. Splitting the cleanup across days is fine but each stage should be a single commit so rollback is easy.

If any of these is unchecked, hold off.

---

## Deletion strategy — leaves first, trunks last

The order matters: deleting an action registry before its consumers leaves the consumers with broken imports. We work from **leaves (no one imports them) inward to trunks (registry, schemas)**.

Each stage is a separate commit. After every stage:
1. Run `tsc --noEmit` — should be green
2. Run `npm test` (vitest) — should be green
3. Run `npm run test:smoke` (SSR sanity scripts) — should be green
4. Re-run `bash v3-cleanup-discovery.sh` — counts for the symbols you just touched should drop

If any verification fails, **revert that one commit and investigate before continuing**. Don't push through.

---

## Stages

### Stage A — v3 page-level routes (entry points)

These are the components mounted by the router for `/denials/*`. After P1.12 the route hands off to `LegacyRedirect`, so these page components have no live callers.

**Likely files (verify with `grep`):**
- `src/pages/DenialsPage.tsx` (or `DenialList.tsx`, `DenialsInbox.tsx`)
- `src/pages/DenialDetailPage.tsx` (or `DenialWorkPage.tsx`)
- `src/pages/DenialQueuePage.tsx`

**What to do:**
1. In the router config (likely `src/App.tsx` or `src/routes.tsx`), replace the v3 route element with `<LegacyRedirect />`:
   ```tsx
   // before
   <Route path="/denials/*" element={<DenialsPage />} />
   // after
   <Route path="/denials/*" element={<LegacyRedirect />} />
   ```
2. Delete the v3 page files.
3. Verify nothing else imports the deleted files (`grep -rln 'DenialsPage' src/`).

**Commit message:** `chore(v3-cleanup): remove v3 page components; route to LegacyRedirect`

**Verify:**
- `tsc --noEmit` green
- Navigate to `/denials` manually → redirects to `/inbox`
- Run discovery script — `DenialsPage` / `DenialDetailPage` counts should be 0

---

### Stage B — v3 components

The component-level pieces that the v3 pages used. Now orphaned.

**Likely files:**
- `src/components/DenialCard.tsx` ← replaced by `CaseCard.tsx` (P1.5)
- `src/components/WorkflowStepsList.tsx` ← replaced by `WorkflowProgressStrip.tsx` (P1.7)
- `src/components/DenialFiltersBar.tsx` ← replaced by `WorklistFiltersBar` (P1.6)
- `src/components/DenialActionBar.tsx` ← replaced by `OutcomeActionBar` (P1.8)
- `src/components/DenialTabs.tsx` ← replaced by `TabStrip` (P1.11)
- `src/components/DenialWorkPane.tsx` ← replaced by `WorkPane` (P1.7)
- `src/components/DenialReferencePanel.tsx` ← replaced by `ReferencePanel` (P1.11)
- Any v3-specific tab components: `DenialNotesTab.tsx`, `DenialFilesTab.tsx`, `DenialAppealTab.tsx`, etc.
- v3 task form files (if they existed pre-v4)

**Trip wire:** `ThreePaneShell.tsx` — if this is a v3 thing, your v4 shell might already use it OR you have a v4 version. Check imports carefully. If v4 uses it, **keep it**; if it's v3-only, delete.

**What to do:**
1. For each v3 component file:
   - Confirm it's not imported by any v4 file: `grep -rln 'DenialCard' src/ | grep -v v4-old-file-paths`
   - Delete the file
2. Re-run `tsc --noEmit`. Any compile error tells you that a file you thought was orphaned actually has a stray import — find it, fix it, then continue.

**Commit message:** `chore(v3-cleanup): remove v3 component layer (DenialCard, WorkflowStepsList, ...)`

**Verify:** counts in discovery script's "Stage B" section drop to 0.

---

### Stage C — v3 hooks

Hooks the v3 components used. Now orphaned after Stage B.

**Likely files:**
- `src/hooks/useDenialQuery.ts`
- `src/hooks/useDenialList.ts`
- `src/hooks/useDenialDetail.ts`
- `src/hooks/useDenialFilters.ts`
- `src/hooks/useDenialActions.ts`
- `src/hooks/useDenialUrlState.ts` ← may have been replaced by `useWorklistUrlState`

**Trip wire:** make sure `useTaskComplete`, `useActiveTab`, `useQueueState`, `useWorklistUrlState` are NOT in this delete set — they are v4.

**What to do:**
1. Delete each v3 hook file
2. `tsc --noEmit` — should be green since Stage B already removed the consumers

**Commit message:** `chore(v3-cleanup): remove v3 hooks (useDenialQuery, useDenialFilters, ...)`

**Verify:** counts in discovery script's "Stage C" section drop to 0.

---

### Stage D — v3 action registry + schemas

Now the trunks. Nothing should import from these after stages A-C.

**Likely files:**
- `src/actions/index.ts` (if it had `registerDenialActions`) — may need surgical edit if file also hosts other registrations
- `src/actions/schemas.ts` or `src/actions/schemas-v3.ts` or `src/actions/denial-schemas.ts`
- `src/actions/denial-registry.ts`
- `src/types/denial.ts`
- `src/types/classification.ts`

**Trip wire — surgical edits:** If `src/actions/index.ts` is a single file that registered BOTH `denial.*` actions (v3) AND `case.*` actions (v4), you can't just delete it. Instead:
1. Open the file
2. Remove the `registerDenialActions()` block + any v3-only imports
3. Keep the `registerCaseActions()` block + v4 imports
4. Update `main.tsx` (or wherever the bootstrap calls into this) to drop the v3 registration call

**Likely main.tsx change:**
```tsx
// before
registerDenialActions();
registerCaseActions();

// after
registerCaseActions();
```

**Schema file decision tree:**
- If `schemas.ts` was the v3 schemas and `schemas-v4.ts` is the v4 schemas: delete `schemas.ts`
- If everything was already in `schemas-v4.ts` and there's no separate v3 schema file: nothing to do

**Commit message:** `chore(v3-cleanup): remove v3 action registry + schemas (registerDenialActions, DenialSchema)`

**Verify:**
- `tsc --noEmit` green
- discovery script "Stage A" + "Stage D" sections both drop to 0
- `npm test` + `npm run test:smoke` still green
- Boot the dev server with `VITE_USE_MOCKS=true` and confirm v4 still works end-to-end

---

### Stage E — v3 mocks (MSW handlers)

**Likely files:**
- `src/mocks/handlers.ts` — may be mixed v3+v4; surgical edit
- `src/mocks/denial-handlers.ts` — pure v3, safe delete
- `src/mocks/db.ts` — may be mixed
- `src/mocks/seed.ts` — may be mixed
- `src/mocks/index.ts` — surgical edit to drop v3 imports

**Heuristic for mixed-content files:** the discovery script flags files where both `case.worklist`/`case_id` AND `denial.worklist`/`DenialCard` appear. Open these manually and:
- Delete handlers for `denial.*` actions
- Delete v3 seed data
- Keep v4 handlers + v4 seed

If you wrote new v4 MSW handlers in P1.3 (which we did), those probably live in `src/mocks/v4/` or similar. The v3 handlers should be in `src/mocks/` root or `src/mocks/v3/`. Use that path distinction as the deletion line.

**Commit message:** `chore(v3-cleanup): remove v3 MSW handlers + mock seed data`

**Verify:**
- `npm test` (interactive suite) still green
- `npm run test:smoke` still green
- Dev server still boots with mocks

---

### Stage F — v3 routes + LegacyRedirect verification

This stage is mostly verification — Stage A already changed the route to LegacyRedirect. Confirm:

- [ ] Router config has `<Route path="/denials/*" element={<LegacyRedirect />} />` (or however your router expresses catch-all)
- [ ] No `/denials/...` paths are referenced as literal strings in v4 components (search: `'/denials'`, `"/denials"`)
- [ ] If any v4 component HAS to reference the old path (e.g. an explainer banner about the move), use a constant rather than a string literal

**Discovery script's "Stage F" output** flags raw v3 path literals. They should all be inside `LegacyRedirect.tsx` or comments.

---

### Stage G — v3 tests

If you had v3-only tests (jest, vitest, or otherwise), they should be deleted alongside the components they tested.

**Likely files:**
- `tests/DenialCard.test.tsx`
- `tests/useDenialQuery.test.ts`
- `src/__tests__/denial-*.test.tsx`
- Any old SSR sanity scripts: `scripts/sanity-check-v3-*.tsx`

**Trip wire:** don't delete `scripts/sanity-check-v4-*.tsx` — those are P1's smoke suite. Don't delete `tests/*.test.tsx` for the v4 components (legacy-redirect, worklist-filters, intake-triage-form, override-dialog, reference-panel-tabs, notes-tab).

**Commit message:** `chore(v3-cleanup): remove v3 test files`

---

### Stage H — npm dependencies

Some packages may have been used ONLY by v3 code. Once Stages A-G are done, check if any deps now have zero imports in `src/`:

```bash
# For each dep listed in package.json:
DEP="some-package"
grep -rln "from ['\"]$DEP" src/ | wc -l
```

If a dep has 0 imports, remove it:
```bash
npm uninstall some-package
```

The discovery script flags a few common candidates (`@tanstack/react-table`, `react-dropzone`, some `@radix-ui/*` if v4 went custom). **Always verify with grep before removing** — a 0-import count can mean "still used via re-export" if you have weird patterns.

**Commit message:** `chore(v3-cleanup): drop unused npm deps`

---

## Verification gates (run between every stage)

```bash
# 1. TypeScript strict
npx tsc --noEmit

# 2. Interactive tests
npm test
# or: npx vitest run

# 3. SSR smoke
npm run test:smoke
# or: for s in scripts/sanity-check-v4-*.tsx; do npx tsx "$s"; done

# 4. Dev server boots cleanly with mocks
VITE_USE_MOCKS=true npm run dev
# Manually navigate /inbox + accept a case + walk a workflow

# 5. Re-run discovery
bash v3-cleanup-discovery.sh
```

Green on all 5 → proceed to next stage. Red on any → revert the last commit, investigate.

---

## Sample PR description

```markdown
# chore(v3-cleanup): remove v3.x denial-tool frontend code

## Summary
Removes the v3.x frontend code that was superseded by the v4.0.0 build
(P1.1–P1.13). Net deletion: ~XXXX lines removed across YY files.

## Motivation
v4.0.0 has been on staging for [N] days with no incidents. v3 routes are
already caught by `LegacyRedirect` (P1.12), so removing the v3 code is
safe and reduces:
- Build size (dropped deps in Stage H)
- Cognitive load (no more "is this v3 or v4?")
- Maintenance surface (fewer files to update when changing shared utilities)

## Changes (by stage)

### Stage A · page-level routes
- Deleted `src/pages/DenialsPage.tsx`, `src/pages/DenialDetailPage.tsx`, ...
- Router now mounts `<LegacyRedirect />` at `/denials/*` (already shipped in P1.12)

### Stage B · component layer
- Deleted `DenialCard`, `WorkflowStepsList`, `DenialFiltersBar`,
  `DenialActionBar`, `DenialTabs`, `DenialWorkPane`, `DenialReferencePanel`,
  v3 tab components, v3 task forms

### Stage C · hooks
- Deleted `useDenialQuery`, `useDenialList`, `useDenialDetail`,
  `useDenialFilters`, `useDenialActions`

### Stage D · action registry + schemas
- Removed `registerDenialActions()` call from `main.tsx`
- Deleted `src/actions/denial-registry.ts` (or surgical edit to `src/actions/index.ts`)
- Deleted `src/actions/schemas.ts` (v3 schemas; v4 lives in `schemas-v4.ts` + `schemas-v4-tabs.ts`)

### Stage E · MSW mocks
- Surgical edits to `src/mocks/handlers.ts` to drop v3 handlers
- Deleted v3-only seed data

### Stage F · route literals
- No raw `/denials/...` string literals remain in v4 components
  (all path references go through `LegacyRedirect` or a constant)

### Stage G · tests
- Deleted v3 test files (`tests/DenialCard.test.tsx`, etc.)

### Stage H · dependencies
- Removed `@tanstack/react-table` (no imports remain)
- Removed `react-dropzone` (no imports remain)
- [...whatever the actual list is]

## Verification

- [x] `tsc --noEmit` green
- [x] `npm test` — 30/30 interactive tests pass
- [x] `npm run test:smoke` — 208/208 SSR sanity tests pass
- [x] Manual smoke on `VITE_USE_MOCKS=true`:
  - [x] /denials → /inbox redirect works
  - [x] Accept Henderson → workflow advances through all 5 steps
  - [x] Override a case → payer_call workflow starts
  - [x] All 5 reference panel tabs render
  - [x] Add note + upload file + generate appeal — all mutations fire

## Risks
- Some v3 deps may have been used via re-export rather than direct import.
  Mitigated by careful grep + watching for runtime errors in staging.
- A v3 file may have shared utilities still used by v4. Caught by `tsc --noEmit`
  during the deletion process.

## Rollback
Each stage is a separate commit. To rollback any single stage:
```
git revert <commit-sha>
```
To rollback the entire cleanup:
```
git revert <oldest-cleanup-commit>..<newest-cleanup-commit>
```
v4 features are unaffected by rollback — they live in different files.
```

---

## Rollback strategy

The cleanup PR consists of one commit per stage (A–H). If a regression surfaces in staging or production:

1. **Identify which stage caused it** by checking which symbol the error references
2. `git revert <that-stage-commit>` — brings back just that stage's deletions
3. The other stages stay reverted (so the cleanup partially holds)
4. Investigate, fix, re-apply

**Worst-case full rollback** (`git revert` the whole PR range) brings back all v3 code. v4 is unaffected because v3 and v4 files don't overlap by design — the only mixed file might be `src/actions/index.ts` if you did a surgical edit there. Keep that in mind.

**Don't squash-merge** the cleanup PR. Preserve the per-stage commits so revert granularity stays fine.

---

## Risks + trip wires

### "ThreePaneShell exists in both v3 and v4 forms"

If you find `ThreePaneShell.tsx` in `src/components/` and it's used by both v3 (deleting in Stage A) and v4 (live in production), keep it. Verify by import grep:
```bash
grep -rln "ThreePaneShell" src/
```
If only v3 references remain after Stage A, delete it. Otherwise keep.

### "Shared utilities live in a v3-named folder"

Some teams put shared util/format helpers in `src/utils/denial-utils.ts` or similar — v3-named but v4 might still import from them. Check imports before deleting:
```bash
grep -rln "from '.*denial-utils'" src/
```
If v4 imports it, rename rather than delete: `denial-utils.ts` → `case-utils.ts`, update imports.

### "MSW handlers file has interleaved v3 + v4"

The discovery script flags these as "MIXED" — surgical edit is required, not deletion. Take your time on these; copy the file to a `.backup` first if you're nervous.

### "main.tsx bootstrapping order matters"

Make sure `registerCaseActions()` is called before the React tree mounts. Removing `registerDenialActions()` is fine — but if you accidentally remove the wrong line, the v4 registry won't exist and every action call will fail at runtime. The vitest suite would catch this; staging would too. Just be deliberate.

### "v3 mockup HTML files in /mnt/project/"

The orchestrator session keeps v3.0 mockup HTML files for reference. If those are also checked into the FE repo (in `docs/` or `mockups/`), they're harmless — leave them or move to a `archive/v3/` folder. Not worth blocking the cleanup PR.

### "MSW v2 service worker setup"

If your MSW setup has a service worker file (`public/mockServiceWorker.js`), it's auto-generated and stays. The v3 vs v4 distinction is in the JS handlers, not the SW.

### "Storybook stories for v3 components"

If you have Storybook, v3 component stories should be deleted alongside the components. Storybook will throw at build time if a story imports a deleted component — catches this automatically.

---

## After P1.14 — what's left

| Phase | Status |
|---|---|
| P1.1–P1.13 | ✅ |
| **P1.14 v3.x cleanup** | ✅ once this PR merges |
| P1.15 staging integration with Vivek | next |

P1.15 is the **integration validation pass**: Vivek runs the v4 build end-to-end against staging BE, walks the 4 workflows from real cases (not just seed data), and surfaces any contract drift. Most likely outcomes:
- Smooth — ship to production
- Small contract drift on one or two task fact shapes — surgical fixes, re-ship
- Larger drift on a BE response shape — coordinate fix in the BE session, re-issue both sides

That's an orchestrator-level coordination task, not a code-shipping one. The orchestrator session will produce a checklist + status template for Vivek's runs and a triage protocol for any issues found.

After P1.15 passes, FE v4.0.0 ships to production.

---

## Quick-start for Vipin

```bash
# 1. Branch
git checkout main && git pull
git checkout -b chore/v3-cleanup

# 2. Inventory
bash v3-cleanup-discovery.sh > /tmp/v3-before.txt
cat /tmp/v3-before.txt

# 3. Pre-flight tests (should already be green on main)
npx tsc --noEmit && npm test && npm run test:smoke

# 4. Work through stages A → H, committing after each:
#    - Stage A: route to LegacyRedirect + delete page files → commit
#    - Stage B: delete v3 component files → commit
#    - ... (and so on)
#    After EVERY commit:
#      tsc --noEmit
#      npm test
#      npm run test:smoke

# 5. Final inventory — should show 0 v3 anchors
bash v3-cleanup-discovery.sh > /tmp/v3-after.txt
diff /tmp/v3-before.txt /tmp/v3-after.txt   # see what was removed

# 6. Push + open PR
git push -u origin chore/v3-cleanup
# PR title: chore(v3-cleanup): remove v3.x denial-tool frontend code
# PR body: use the sample template above
```

Estimate: 3-5 hours for the actual work (most of it verification between stages); ~1 hour to write the final PR description with concrete file counts. Don't rush — green tests between stages is how the rollback story stays clean.

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `v3-cleanup-discovery.sh` | repo root (or `scripts/`) — run from FE repo root |
| `README-P1.14.md` | reference only |
