# FE v4.0.0 · P1.6 — WorklistPane

**Phase:** P1.6 (first page-level v4 component)
**Anchored on:** mockups #3 (worklist default), #4 (returned-bar), #7 (empty state)
**Status:** Code-complete; `tsc --strict` clean + 20/20 SSR smoke tests pass

---

## What's in this deliverable

6 source files + 1 smoke test. Wires `case.worklist` to a list of `<CaseCard>` instances with filters, pagination, and all the non-data states.

| File | Lines | Drop-in path |
|---|---|---|
| `WorklistPane.tsx` | 113 | `src/pages/WorklistPane.tsx` |
| `WorklistFilters.tsx` | 244 | `src/components/worklist/WorklistFilters.tsx` |
| `WorklistStates.tsx` | 169 | `src/components/worklist/WorklistStates.tsx` |
| `WorklistPagination.tsx` | 71 | `src/components/worklist/WorklistPagination.tsx` |
| `useWorklistUrlState.ts` | 138 | `src/hooks/useWorklistUrlState.ts` |
| `useQueueState.ts` | 60 | `src/hooks/useQueueState.ts` (modified — drops page/case on queue change) |
| `sanity-check-v4-worklist-pane.tsx` | 318 | `scripts/sanity-check-v4-worklist-pane.tsx` |

Total: ~1100 new lines + ~5 lines modified in useQueueState.

---

## Composition

```
┌─ <section aria-label="Worklist"> ──────────────────────────┐
│                                                            │
│  ┌─ WorklistFiltersBar ─────────────────────────────────┐  │
│  │ [Category ▾] [Clinic ▾] [Payer ▾] [Aging ▾] [Prio ▾] │  │
│  │                                          Clear filters│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ subheader ─────────────────────────────────────────┐   │
│  │ DENIAL INTAKE — PRIMROSE · 6 CASES (PAGE 1)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ scrollable card list ──────────────────────────────┐   │
│  │  <CaseCard row={…} />                                │   │
│  │  <CaseCard row={…} />                                │   │
│  │  <CaseCard row={…} />                                │   │
│  │  …                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ WorklistPagination ────────────────────────────────┐   │
│  │ Page 1 · 1–25     [← Previous] [Next →]             │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### State branches

| Condition | Renders |
|---|---|
| `queue_id` not yet resolved (queue.list loading) | `<WorklistSkeleton />` |
| `case.worklist` loading, no prior data | `<WorklistSkeleton />` |
| `case.worklist` errored, no prior data | `<WorklistError />` with Retry |
| `case.worklist` returns `rows: []`, no filters | `<WorklistEmpty hasActiveFilters={false}/>` — "All caught up" |
| `case.worklist` returns `rows: []`, filters active | `<WorklistEmpty hasActiveFilters={true}/>` — "No matching cases" + Clear button |
| `case.worklist` returns rows | Card list + subheader + pagination (if applicable) |

The middle-pane CaseDetail integration happens in P1.7 — for now `<CaseCard>` writes `?case=` to URL which P1.7 reads.

---

## URL state convention (consolidated)

```
/inbox?queue=<id>&case=<case_id>&category=<code>&clinic_id=<id>
       &primary_payer_id=<id>&aging=<bucket>&priority=<level>&page=<n>
```

All params optional. Cross-component contract:

| Param | Read by | Written by |
|---|---|---|
| `queue` | `useQueueState` | `QueueSwitcher` (P1.4) — also drops `page` and `case` |
| `case` | `CaseCard` (selection), middle pane | `CaseCard` (P1.5) |
| `category` | `useWorklistUrlState` | `WorklistFiltersBar` |
| `clinic_id` | `useWorklistUrlState` | `WorklistFiltersBar` — also clears `primary_payer_id` when nulled |
| `primary_payer_id` | `useWorklistUrlState` | `WorklistFiltersBar` (only when clinic_id set) |
| `aging` | `useWorklistUrlState` | `WorklistFiltersBar` |
| `priority` | `useWorklistUrlState` | `WorklistFiltersBar` |
| `page` | `useWorklistUrlState` | `WorklistPagination` — auto-dropped by any filter or queue change |

These rules are codified in the hooks, not the components — so any future surface that writes to URL params automatically respects them.

---

## Filter chip UX

Each chip is a button with two visual states:

**Unset:** "Category ▾" — gray border, white background
**Set:** "Category: Medical Necessity ×" — blue border, blue tint, X to clear

Click opens a dropdown panel of options. Click outside / Escape closes. Selection updates URL + closes panel.

**Cascade:** the Payer chip is disabled until a Clinic is picked (per the v4 contract — payer lookups are scoped to clinic). Tooltip shows "Pick a clinic first" when hovered.

**Clear all filters:** A subtle text link appears on the right side of the chip row when any filter is set. Click clears every filter param + `page`.

### Filter option sources

| Filter | Options from |
|---|---|
| Category | `category.list` query → category code + label |
| Clinic | `lookup.clinics` query → clinic id + (alias \|\| name) |
| Payer | `lookup.payers` query keyed by clinic_id → payer id + (alias \|\| name) |
| Aging | hardcoded 6 buckets (0-29d through 180d+) |
| Priority | hardcoded 3 values (low/normal/high) |

The dynamic-options filters share `useActionQuery` caching with anywhere else those endpoints are called — no duplicate requests.

---

## Pagination — design decision

**Chose:** page-based (Prev/Next buttons) over infinite scroll or load-more.

**Reason:** simpler with React Query's query-keyed cache (each page is its own query). Load-more requires either `useInfiniteQuery` or manual array concatenation in component state, both of which add complexity that isn't earning much here — most queues have <100 cases.

**Tradeoff:** less smooth than load-more for very long lists. Acceptable for the worklist use case where users rarely scroll past page 2.

**Visibility rule:** pagination hides entirely on page 1 when there's nothing more to load. Otherwise it shows with Prev disabled on page 1 and Next disabled when `has_more=false`.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

### SSR smoke (20 tests)

```
=== WorklistSkeleton ===                  1/1  passed
  · renders 5 animate-pulse placeholder cards with a11y label

=== WorklistEmpty ===                     2/2  passed
  · default ("All caught up", no Clear button)
  · filtered ("No matching cases" + Clear button)

=== WorklistError ===                     1/1  passed
  · message + Retry button + role=alert

=== WorklistPagination ===                4/4  passed
  · hides entirely on page=1 + no more
  · shows when has_more=true
  · Previous disabled on page 1
  · shows on page 2 even when no more

=== WorklistFiltersBar ===                3/3  passed
  · all 5 chips render with data-filter-key attributes
  · Payer chip disabled with "Pick a clinic first" tooltip
  · Clear filters link hidden when no filters active

=== WorklistPane composition ===          9/9  passed
  · skeleton during initial load
  · cards render when rows returned
  · subheader shows queue label + count
  · singular "case" vs plural "cases"
  · pagination hidden for single page
  · pagination shown with has_more
  · empty state when rows=[] and no filters
  · top-level section has aria-label="Worklist"
  · flex-h-full layout for scrollable card area

20 passed · 0 failed
```

### What SSR can't cover (deferred to P1.13)

- Filter chip dropdown open/close interaction
- URL updates after a filter selection
- Pagination button click triggers query refetch
- Empty state Clear-filters button actually clears
- Hover/focus visual states

These need jsdom + @testing-library/react. The components are structured for those tests (clear prop boundaries, hooks isolated, no internal side effects beyond URL writes).

---

## Integration steps

1. Drop the 5 new files + the updated `useQueueState.ts` into the paths above
2. In your router, mount `<WorklistPane />` as the left pane of the inbox route:
   ```tsx
   import { WorklistPane } from './pages/WorklistPane';

   <Route path="/inbox" element={
     <ThreePaneShell
       left={<WorklistPane />}
       middle={<WorkPaneStub />}   // P1.7
       right={<ReferencePanelStub />} // P1.11
     />
   } />
   ```
3. Start dev server with `VITE_USE_MOCKS=true` (from P1.3). Should see:
   - 6 proposed cases on default queue
   - Filter chips populated from `category.list` + `lookup.clinics`
   - Picking a clinic enables the Payer chip
   - Picking a category narrows results
   - "Clear filters" link appears, clicks reset all filters + URL

---

## What's NOT in P1.6 (intentional scope cuts)

- **3-pane shell composition** — that's a separate task; P1.6 ships only the left pane
- **Type-to-search inside filter dropdowns** — filters with >20 options would benefit but current lookup endpoints return small sets
- **Multiselect filters** — e.g., picking 2 categories at once. Current contract supports it (`case_status` is a string array in the schema) but UI isn't wired
- **Saved filter presets** — "My HD queue", "Manager dashboard" — out of scope
- **Sort controls** — the worklist sorts HD-first then by updated_at desc; not user-configurable yet
- **Bulk actions on selected cards** — checkboxes + "Reclassify all"; not in the v4 P1 scope per memory

All flagged for follow-up if desired.

---

## What comes next (P1.7)

Per the design contract §8: **WorkPane state-aware rewrite** — the middle pane that shows when a case is selected (`?case=<id>` in URL). Big component because it branches on `case_status`:

- **Proposed** → LLM recommendation block + Accept/Override action bar + WorkflowPreview
- **Accepted/Overridden in-flight** → CurrentTaskBlock + workflow progress strip + task form
- **Completed** → summary view

Anchored on mockups #8 (proposed) and #9 (accepted in-flight with intake_triage form embedded).

This is the largest single component in the v4 build. Likely takes a full session even bundled with the dependent components (WorkflowProgressStrip, CurrentTaskBlock, TaskFormShell — those are P1.8 but coupled).

Say `"start P1.7"` and I'll ship the WorkPane. Or `"start P1.7+P1.8"` if you want to bundle the workflow strip components into the same turn (they share the same surface; doable in one session but ~1500 lines).

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `WorklistPane.tsx` | `src/pages/WorklistPane.tsx` |
| `WorklistFilters.tsx` | `src/components/worklist/WorklistFilters.tsx` |
| `WorklistStates.tsx` | `src/components/worklist/WorklistStates.tsx` |
| `WorklistPagination.tsx` | `src/components/worklist/WorklistPagination.tsx` |
| `useWorklistUrlState.ts` | `src/hooks/useWorklistUrlState.ts` |
| `useQueueState.ts` (updated) | `src/hooks/useQueueState.ts` |
| `sanity-check-v4-worklist-pane.tsx` | `scripts/sanity-check-v4-worklist-pane.tsx` |
| `README-P1.6.md` | reference only |
