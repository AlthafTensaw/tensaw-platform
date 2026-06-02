# Denial Analyst Tool — Frontend v3.0.2

**Status:** Code-complete · awaits dev integration & smoke test
**Previous:** v3.0.1
**Companion BE:** v2.0.1 (shipped)
**Trigger:** Vivek's integration report `Denial Analyst Tool (Internal) - Frontend.docx` (2026-05-25 through 2026-05-29)

---

## What changed from v3.0.1

Seven bug fixes addressing items Vivek flagged during local integration. All fixes are in our codebase — Vivek's branch is a reproduction reference, not the source of truth.

### Bug fixes

| # | Item | Files touched |
|---|---|---|
| A | **Avatar prop mismatch** — replaced platform `<Avatar initials="...">` with an inline div + deterministic background color (same pattern as `DenialCard`'s `AssigneeAvatar`). Removes the design-system Avatar API coupling for this single use site. | `AppLayout.tsx` |
| B | **Tailwind utilities not compiling** — added `tailwind.config.js` and `postcss.config.js` at the app root, plus `@tailwind base / components / utilities` directives in `denial-tool.css`. Config extends `@tensaw/design-system/tailwind-preset` so the platform palette is available. | `tailwind.config.js` (new), `postcss.config.js` (new), `src/denial-tool.css` |
| C | **Radix Select empty-string values in TasksMinePage** — replaced `''` option values with `'all'` sentinel; updated change handlers + value derivation to map between the sentinel and the empty filter state. Added `derivedDueValue()` helper so the Select reflects the right option when filters come from localStorage on page load. | `src/pages/tasks/TasksMinePage.tsx` |
| D | **Assignment changes don't refresh My Tasks** — added React Query invalidation on `denial.list-tasks-mine` after every assignment-changing mutation: per-step assign, per-step clear, due-date change, priority change, bulk assign. Newly assigned tasks now appear on My Tasks without manual refresh. | `src/components/WorkflowStepsList.tsx`, `src/components/BulkAssignDialog.tsx` |
| E | **SignInPage inline styles + undeclared CSS vars** — rewrote with Tailwind utility classes; dropped all `style={...}` objects and the `--tw-color-*` references that weren't in the design-system token set. Also tightened the `signIn` selector typing: the runtime AuthUser uses `userId` (not `id`) and `fullName` (not `name`); v2.x relied on `unknown` typing that hid the mismatch from tsc. Default redirect after sign-in updated from `/worklist` to `/inbox` to match v3.0 routing. | `src/pages/sign-in/SignInPage.tsx` |
| F | **My Tasks badge thrash** — added `freshFor: 30_000` to the badge query and a stable `BADGE_REQUEST` reference so AppLayout re-mounts and cross-page navigation reuse the cached value. Badge is allowed up to 30s staleness — perfectly fine for a glanceable counter. Real-time-accurate count needs a dedicated BE endpoint; tracked for v3.1. | `AppLayout.tsx` |
| G | **Drop search entirely** — removed the search box from `LeftListPane`. Removed `searchQuery` state + client-side filtering from `DenialInboxPage`. Search was a v3.0 client-side-only feature; product decision to drop. If we want real search later, it's a server-side endpoint addition. | `src/pages/inbox/LeftListPane.tsx`, `src/pages/inbox/DenialInboxPage.tsx` |

### Carried from the v3.0.1 → v3.0.2 transition

These were already fixed in the previous patch document but ship in this bundle for completeness:

- AppLayout anchor tags → NavLink (Vivek 2026-05-25 #3 + 2026-05-29)
- `useCategories` stable empty request via `EMPTY_REQUEST` constant (Vivek 2026-05-29)
- `useWorklistFilters` `user.id` → `user.userId` (Vivek 2026-05-29)
- Dead v2.x components removed: `RowDetailPanel.tsx`, `DenialBulkActionBar.tsx`, `DenialFilterStrip.tsx`, `DenialHistoryStrip.tsx` — auto-resolves the bad `@tensaw/design-system/rcm/privacy` import (Vivek 2026-05-25 #1)

### Things intentionally NOT changed

Per the previous response doc:

- **Filter chips owner / priority** — v3.0 product decision to simplify the chip set to State / Category / Payer / Clinic / Aging / Assigned-to / $ Range (7 chips). If we want to restore Owner and Priority, that's a product call.
- **Filter chips hardcoded options** — known v3.0 limitation; v3.1 work to wire dynamic options via BE list endpoints.
- **Billing team UX feedback (2026-05-26)** — needs repros with specific claim IDs before fixing. Don't attempt blind fixes.

---

## Integration steps

1. **Drop in app source.** Copy everything under `src/` into your `apps/denial-tool/src/` (overwrites + new tests).
2. **Drop in config files at app root.** Copy `tailwind.config.js` and `postcss.config.js` to `apps/denial-tool/`.
3. **Drop in mock-server patches.** Copy `mock-server-patches/*` into `packages/mock-server/src/{schemas,fixtures/denial,handlers}/` (unchanged from v3.0.1).
4. **Delete dead-code files from your branch** if upgrading from v3.0.1:
   ```bash
   rm src/components/RowDetailPanel.tsx
   rm src/components/DenialBulkActionBar.tsx
   rm src/components/DenialFilterStrip.tsx
   rm src/components/DenialHistoryStrip.tsx
   rm src/pages/inbox/categoryColor.ts  # superseded in v3.0.1 already
   ```
5. **Verify Tailwind preset exists** at `packages/design-system/tailwind-preset.js`. If it doesn't, your `tailwind.config.js` line `presets: [require('@tensaw/design-system/tailwind-preset')]` will fail at build. Either:
   - Add the preset (talk to design-system team), OR
   - Replace `presets: [...]` with a direct theme block inline (Tailwind config is plain JS)
6. **Restart dev server.** `npm install` (no new deps, but make sure Tailwind + Autoprefixer are installed at workspace level), then `npm run dev`.

---

## Verification — Vivek's items checklist

After integration, walk through Vivek's report items to verify each is resolved:

### 2026-05-25 items

- ✅ #1 PrivacyField bad import — gone (file deleted)
- ✅ #2 Radix Select empty values — `'all'` sentinel applied
- ✅ #3 Navbar session reset — NavLink replaces `<a>`
- ✅ #4 Tailwind not compiling — config files + CSS directives shipped
- ✅ #5 SignInPage inline styles — converted to Tailwind utilities
- ✅ #6 Undeclared CSS vars — removed

### 2026-05-27 items

- ❌ Search not working — **search dropped** (per product decision)
- ⚠️ Filter "payer, owner, aging, priority" not working — **Owner + Priority not in v3.0 chip set** by design. Payer + Aging use hardcoded options that may not match real data. v3.1 work to wire dynamic options.
- ⚠️ Filters hardcoded — known v3.0 limitation, v3.1 work

### 2026-05-29 items

- ✅ Avatar `initials` — inline div replaces platform Avatar
- ✅ Tasks badge full API call — `freshFor: 30_000` reduces refetch frequency
- ✅ SignInPage loose typing — `AuthUser` interface declared, selector typed
- ✅ TasksMinePage assignment refresh — React Query invalidation added
- ✅ `useWorklistFilters` user.id → user.userId — fixed
- ✅ NavLink fix already applied (Vivek's branch)
- ✅ `useCategories` repeated API calls — `EMPTY_REQUEST` constant applied

### 2026-05-26 billing team items

These need product/design discussion + specific claim IDs to reproduce. Not fixed blindly:

- "Filter by clinic + provider + facility" — clinic chip exists; provider/facility need product call
- "Assigned claim not showing in My Tasks" — **resolved by Fix D** above (assignment invalidation)
- "Dashboard indicator for already-analyzed claims" — UX gap, needs design
- "Payer not displaying on the claim" — needs claim-ID repro to debug
- "Denial description mismatch" — needs repro

---

## tsc / test status

I was unable to run `tsc --noEmit` or `vitest` in this session (workspace deps unavailable in the clean room). Sanity checks done:

- ✅ Brace-balance check on all 9 changed files — all balanced
- ✅ Imports inspected for correctness
- ✅ Behavioral changes traced manually against existing tests (which I did not modify)

**Recommend running tsc + tests as the first thing after integration.** If anything fails, the error is likely a one-line typo I introduced; ping me with the message and it's a quick fix.

---

## Known issues / risk register

1. **AuthUser shape assumption** — `SignInPage` declares a local `AuthUser` interface (`userId`, `email`, `fullName`, `roles`, `permissions`). If the runtime exports its own type with different fields, the call may still type-check (selector uses our local interface) but the runtime might store/read different keys. If `useWorklistFilters` still reads `userId` as `undefined`, the runtime stores under a different key — surface and we'll align.
2. **Tailwind preset path** — `@tensaw/design-system/tailwind-preset` is the conventional name; if the package exports something differently (e.g. `@tensaw/design-system/tailwind`), update the `tailwind.config.js` `presets` line.
3. **Bulk assign mode** — invalidation is wired after `fireBulk` success in BulkAssignDialog. If there's a path through bulk-assign that doesn't call `fireBulk` (e.g. one-step assign), it bypasses the invalidation. Worth a visual check on the bulk-assign UX in dev.
4. **TasksMinePage `derivedDueValue`** — heuristic-based reverse lookup (matches week ≈ 5–10 day range, month ≈ 25–35 day range). Edge cases at boundaries may show `'all'` when one of week/month was set. Cosmetic only; the actual filter state is correct.

---

## Versioning

This is **v3.0.2** — semver patch. All changes:
- Additive (Tailwind config files)
- Behavior fixes (no API change)
- Internal refactors (Avatar inline, SignInPage Tailwind)
- One product-decision removal (search)

Companion BE remains **v2.0.1** — no BE changes needed for this FE patch.

---

## What's next

1. Vivek integrates v3.0.2 → runs tsc + tests
2. If green: smoke against staging
3. If issues: he reports back with specific symptoms; we fix in v3.0.3
4. After clean staging smoke: ship FE v3.0.2 + BE v2.0.1 to production

v3.1 backlog remains: TasksMinePage in 3-pane shape, real filter option sourcing from BE, Owner + Priority chip restoration (if product wants), file upload picker UI, BE count endpoint for badge, Team page.
