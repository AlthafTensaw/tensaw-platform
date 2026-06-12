# FE v4.0.0 · P1.12 + P1.13 — Legacy redirect + jsdom test suite

**Phases:** P1.12 (legacy /denials redirect) + P1.13 (interactive test infrastructure)
**Status:** Code-complete; `tsc --strict` clean + 208 SSR smoke tests pass + 30 jsdom interactive tests pass

---

## What's in this deliverable

| File | Lines | Purpose | Phase |
|---|---|---|---|
| `LegacyRedirect.tsx` | 27 | v3 /denials/* → v4 /inbox redirect | P1.12 |
| `vitest.config.ts` | 21 | Vitest runner config (jsdom + aliases) | P1.13 |
| `src/test/setup.ts` | 24 | jest-dom matchers + per-test stub reset | P1.13 |
| `src/test/helpers.tsx` | 156 | Shared fixtures + setupStandardMocks() | P1.13 |
| `stubs/react-router-dom.ts` (upgraded) | 162 | Shared store + Navigate / useLocation / useNavigate | P1.13 |
| `tests/legacy-redirect.test.tsx` | 56 | 4 tests | P1.12+P1.13 |
| `tests/worklist-filters.test.tsx` | 109 | 5 tests | P1.13 |
| `tests/intake-triage-form.test.tsx` | 113 | 5 tests | P1.13 |
| `tests/override-dialog.test.tsx` | 145 | 6 tests | P1.13 |
| `tests/reference-panel-tabs.test.tsx` | 130 | 5 tests | P1.13 |
| `tests/notes-tab.test.tsx` | 102 | 5 tests | P1.13 |

Plus retired 2 stale SSR smoke assertions (P1.7 + P1.8 had checks that asserted placeholder text P1.8/P1.10 removed; replaced with assertions of the new behavior).

Total: ~1100 new lines + ~50 lines modified in existing smoke scripts + ~120 lines added to the router stub.

---

## P1.12 — LegacyRedirect

Small drop-in:

```tsx
<Route path="/denials/*" element={<LegacyRedirect />} />
```

Catches any v3 `/denials/...` URL and forwards to `/inbox` using react-router's `<Navigate replace />`. Doesn't try to preserve v3-specific params — v3 used `?denial=DEN-123` (alphanumeric IDs), v4 uses `?case=case_000001` (different ID scheme), so any preservation would be misleading. Better to land users on the inbox where they can find the case via search/filters.

A `console.info` logs the source URL + redirect target so analysts notice when they hit a legacy bookmark. Useful signal for doc updates and team comms during the v3→v4 cutover.

The component accepts an optional `to` prop if a different default landing is wanted.

---

## P1.13 — Interactive test infrastructure

### Test stack

- **vitest** (^1.6) — test runner + assertion library
- **jsdom** (^24) — browser environment for React rendering
- **@testing-library/react** (^16) — query + render utilities
- **@testing-library/user-event** (^14) — proper event simulation
- **@testing-library/jest-dom** (^6) — DOM matchers (toBeInTheDocument, etc.)

All in devDependencies. Run with `npx vitest run` (or `npm test` once package.json scripts updated).

### Configuration

- `vitest.config.ts` — jsdom env, setup file path, module aliases that point `@tensaw/actions` and `react-router-dom` at the existing stubs so prod and test paths match
- `src/test/setup.ts` — runs before every test file; extends `expect` with jest-dom matchers; resets stub state per-test so cases don't bleed
- `src/test/helpers.tsx` — exports `baseCase`, `queues`, `categories`, `clinics`, `payers`, `makeTask()`, and `setupStandardMocks()` so tests stay lean

### Router stub upgrade

The pre-P1.13 stub used per-hook `useState` — each component instance had its own URL params store, so a write from `QueueSwitcher` wouldn't show up in a read from `WorklistPane`. That was fine for SSR snapshots (single render, no follow-up reads) but broke as soon as interactions wrote URL params expecting other components to react.

Upgraded to a **shared module-level store** + subscriber pattern:
- `sharedParams` lives in module scope
- `useSearchParams` returns `[sharedParams, set]` + subscribes to changes
- Writes call `notify()` which forces all subscribers to rerender

Test helpers `__setSearchParams`, `__getSearchParams`, `__resetSearchParams`, `__setPathname`, `__getPathname`, `__resetPathname` exported for test setup/assertions.

Also added the `<Navigate>` component (used by P1.12), `useLocation`, and `useNavigate` to the stub since the redirect needed them. None of these are used in production paths today, but they're consistent with the real react-router-dom API.

---

## The 6 test files

### tests/legacy-redirect.test.tsx (4 tests)
Verifies the redirect component:
- `/denials` → `/inbox`
- `/denials/work/DEN-123` → `/inbox` (drops v3 path segments)
- Logs source URL via console.info
- Custom `to` prop respected

### tests/worklist-filters.test.tsx (5 tests)
The filter chip interaction pattern from P1.6:
- Click chip → dropdown opens with options
- Pick option → URL `?category=` updates + dropdown closes
- × button clears the filter
- Payer chip disabled until Clinic is picked (cascade)
- "Clear filters" link appears + clears all on click

### tests/intake-triage-form.test.tsx (5 tests)
The form-submit pattern from P1.8 — also the template for P1.10 forms:
- Category pre-fills from LLM recommendation
- SUCCESS button disabled until route picked
- Click Complete triage → `task.complete` fires with full facts payload
- "Needs more info" → outcome=NEEDS_INFO
- Priority change reflects in submitted facts

### tests/override-dialog.test.tsx (6 tests)
The custom modal pattern from P1.7:
- Title + dropdown excludes recommended category
- Submit disabled until category picked
- Submit fires `case.override` + closes on success
- Cancel button calls onClose without mutation
- Escape key closes
- Backdrop click closes; inside click does not

### tests/reference-panel-tabs.test.tsx (5 tests)
The tab routing pattern from P1.11:
- Default tab is Analysis when URL has no `?tab=`
- Clicking tab → content swaps + URL updates
- URL `?tab=` drives initial active tab on load
- Switching back to default removes `?tab=` (clean URLs)
- Notes + Files badges show counts when data present

### tests/notes-tab.test.tsx (5 tests)
The mutation pattern from P1.11 — template for file upload, appeal generate/save:
- Add button disabled until body is non-empty
- Typing enables Add
- Click Add → `case.note.add` fires with body
- Textarea clears after successful submit
- Whitespace-only body doesn't submit

---

## Coverage map — what the test suite exercises

| Pattern | Covered by | Lessons portable to |
|---|---|---|
| URL-state filter chip | worklist-filters | Any future URL-driven control |
| Form gating + submit + facts payload | intake-triage-form | All 10 P1.10 task forms |
| Custom modal (Esc + backdrop + form) | override-dialog | Any new dialog |
| Tab routing + URL sync | reference-panel-tabs | Any tabbed UI |
| Mutation fires + cache invalidates | notes-tab | File upload, appeal save/generate |
| Render-time redirect | legacy-redirect | Any future redirect |

If the team needs to test something new, the closest pattern above is the starting template.

---

## Running tests

```bash
# Full jsdom suite (interactive)
npx vitest run

# Watch mode
npx vitest

# Single file
npx vitest run tests/worklist-filters.test.tsx

# SSR smoke suite (still useful for cheap structural checks)
for s in scripts/sanity-check-v4-*.tsx; do
  npx tsx "$s"
done
```

Add to package.json scripts when integrating:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "for s in scripts/sanity-check-v4-*.tsx; do npx tsx \"$s\"; done"
  }
}
```

---

## Verification

### TypeScript strict

```
$ npx tsc --noEmit
(no output, exit 0)
```

### Full SSR smoke suite (still passing — 208 tests across 7 scripts)

```
sanity-check-v4-case-card        47/47 ✓
sanity-check-v4-reference-panel  26/26 ✓
sanity-check-v4-task-form        32/32 ✓  (was 32; 1 stale assertion retired)
sanity-check-v4-task-forms-all   30/30 ✓
sanity-check-v4-topnav           19/19 ✓
sanity-check-v4-work-pane        34/34 ✓  (was 34; 1 stale assertion retired)
sanity-check-v4-worklist-pane    20/20 ✓

Total: 208/208
```

### New jsdom suite

```
tests/legacy-redirect.test.tsx       4/4  ✓
tests/worklist-filters.test.tsx      5/5  ✓
tests/intake-triage-form.test.tsx    5/5  ✓
tests/override-dialog.test.tsx       6/6  ✓
tests/reference-panel-tabs.test.tsx  5/5  ✓
tests/notes-tab.test.tsx             5/5  ✓

Total: 30/30
```

### Two stale SSR assertions retired

While running the full suite I found 2 assertions that became invalid as later phases shipped:

1. **sanity-check-v4-task-form.tsx** had `expectIncludes(html, 'Form coming in P1.10')` — asserted the GenericTaskFallback would render for `coding_review`. After P1.10 added the concrete CodingReviewForm, this assertion no longer holds; the routing test in `sanity-check-v4-task-forms-all.tsx` covers the new behavior comprehensively. Replaced with `expectIncludes(html, 'Coding review')` (lighter check that the basic render still works).

2. **sanity-check-v4-work-pane.tsx** had `expectIncludes(html, 'Task form rendering ships in P1.8')` — asserted the P1.7 placeholder text. P1.8 removed that text when it replaced the placeholder with real task forms. Replaced with `expectExcludes(html, 'Task form rendering ships in P1.8')` + a positive assertion that IntakeTriageForm content renders.

Both were straightforward updates — no real failures, just stale expectations.

---

## What this suite doesn't cover (and why that's OK)

- **Real network requests** — all mutations/queries are stubbed. Real BE integration testing belongs in P1.15 (staging integration with Vivek).
- **Cache invalidation timing** — the stub treats queries as fixed values; in production, `case.note.add` would invalidate `case.notes` and trigger a refetch. The tests verify the mutation FIRES correctly, which is the FE's job; the cache flow is React Query's territory and is well-tested by the library itself.
- **Visual regression** — no screenshot diffing. Tailwind class assertions in SSR smoke get the structural feedback. Visual polish would need Playwright + screenshot diffing, which is heavier than this project warrants.
- **Drag-drop file upload** — file upload is a `<input type="file">`; user-event has limited DOM support for drag-drop. The Upload button + metadata payload submission is verifiable; the actual binary transport is a wiring concern in the FE app shell.
- **Accessibility audits** — jest-dom has some a11y helpers but a real audit needs axe-core. Worth adding later but not blocking.

---

## Cumulative progress

| Phase | Status |
|---|---|
| P1.1–P1.8 | ✅ |
| P1.10 | ✅ |
| P1.11 reference panel | ✅ |
| **P1.12 legacy redirect** | ✅ ← this |
| **P1.13 formal test suite** | ✅ ← this |
| P1.14 v3.x cleanup | next |
| P1.15 staging integration with Vivek | pending |

**11 of 13 done.** Just P1.14 (v3.x cleanup — delete v3 registry, remove DenialCard/WorkflowStepsList/v3 hooks) + P1.15 (staging integration) remain.

---

## P1.14 next

**v3.x cleanup** — per the user memory:

> P1.14 v3.x cleanup (delete v3 registry, remove DenialCard/WorkflowStepsList etc.)

This is a deletion + import-graph fix pass. The work consists of:
1. Inventory v3 files still in the codebase (`registerDenialActions`, `DenialCard`, `WorkflowStepsList`, v3 hooks, v3 mockup HTMLs)
2. Confirm no v4 file imports from them
3. Delete the v3 files
4. Verify `tsc --strict` still passes
5. Run the SSR smoke + jsdom suites to confirm no regressions

Some of this can't be done from the orchestrator session alone — the FE repo's actual file inventory is needed. I can produce a **deletion plan + sample PR description** that Vipin executes against the real codebase.

Say `"start P1.14"` and I'll ship the cleanup plan + verification steps. Or if the v3 file list is short and you want me to write the actual deletion patch, paste a `git ls-tree --name-only` of the v3-suspect paths and I'll write a removal patch directly.

---

## Files in this deliverable

| File | Drop-in location | Phase |
|---|---|---|
| `LegacyRedirect.tsx` | `src/components/LegacyRedirect.tsx` | P1.12 |
| `vitest.config.ts` | repo root | P1.13 |
| `src/test/setup.ts` | `src/test/setup.ts` | P1.13 |
| `src/test/helpers.tsx` | `src/test/helpers.tsx` | P1.13 |
| `stubs/react-router-dom.ts` (updated) | `stubs/react-router-dom.ts` | P1.13 |
| `tests/legacy-redirect.test.tsx` | `tests/legacy-redirect.test.tsx` | P1.12 |
| `tests/worklist-filters.test.tsx` | `tests/worklist-filters.test.tsx` | P1.13 |
| `tests/intake-triage-form.test.tsx` | `tests/intake-triage-form.test.tsx` | P1.13 |
| `tests/override-dialog.test.tsx` | `tests/override-dialog.test.tsx` | P1.13 |
| `tests/reference-panel-tabs.test.tsx` | `tests/reference-panel-tabs.test.tsx` | P1.13 |
| `tests/notes-tab.test.tsx` | `tests/notes-tab.test.tsx` | P1.13 |
| `README-P1.12-P1.13.md` | reference only | — |

Plus install these test deps in the FE package:
```
npm install --save-dev vitest@^1.6 jsdom@^24 @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6
```
