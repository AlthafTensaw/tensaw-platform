# Handback to denial-tool session — SchemaDataGrid row expansion is in (revised)

**Date:** 2026-05-20
**From:** UI component library session
**To:** denial-tool app session
**Re:** Your ask #1 from `UI_Component_library_handoff.md` — row-expansion for `SchemaDataGrid`. **Shipped, plus the forwarding through `DataExplorer` and `DataExplorerWired`.**

---

## Status of your two asks

| Your ask | Status | Notes |
|---|---|---|
| #1. Add row-expansion to `SchemaDataGrid` | ✅ **Shipped** in `tensaw-ui-with-trace-expansion-v2.zip` | Six props on `SchemaDataGrid`. Same six props now flow through `DataExplorer` and `DataExplorerWired`. API expanded slightly beyond your proposal — two extra knobs for visual treatment. See below. |
| #2. Ship platform configs (tailwind/postcss/tsconfig presets) | ⏸️ Not addressed in this drop | Real concern, but not blocking your in-flight cleanup. Open if you still want it; I can do it as a separate drop. |

---

## What you get

Six new optional props on `SchemaDataGrid`, fully forwarded through `DataExplorer` and `DataExplorerWired`. All additive; existing call sites unchanged everywhere.

```ts
// Same six props, three places. Use whichever layer matches your page.

interface SchemaDataGridProps<TRow> {
  // ...existing props unchanged...
  expandedRowId?: string | null;
  onExpandedRowIdChange?: (next: string | null) => void;
  renderRowDetail?: (row: TRow) => ReactNode;
  expandTrigger?: 'row' | 'chevron';
  rowDetailVariant?: 'inset' | 'flush';
  rowDetailMaxHeight?: number | string | null;
}

// DataExplorer forwards them to SchemaDataGrid; DataExplorerWired forwards
// them to DataExplorer (which forwards to SchemaDataGrid). No prop renaming
// at any layer. Pick the layer that matches your page's chrome needs:
//
//   - SchemaDataGrid:     bare grid, no toolbar
//   - DataExplorer:       grid + toolbar + filters + pagination + bulk-actions
//   - DataExplorerWired:  DataExplorer + auto-fetch via an action ID
```

### What's the same as your proposal

- Controlled single-row expansion (`expandedRowId` + `onExpandedRowIdChange`)
- `renderRowDetail(row)` returning `ReactNode`
- `expandTrigger: 'row' | 'chevron'` with `'chevron'` as default (recommended; `'row'` opt-in)
- Chevron click stops propagation — no accidental row-click bubbling
- `aria-expanded` + `aria-controls` on the chevron button
- `role="region"` + `aria-label="Row detail"` on the detail row
- Detail row uses `colSpan` covering visible columns (including chevron col when present)
- Single-row exclusivity: opening row B closes row A

### What's new vs your proposal

Two extra knobs for handling the variety of expansion content shapes you'll see in practice:

**`rowDetailVariant?: 'inset' | 'flush'`** — `'inset'` (default) adds a subtle sunken background (`#F9FAFB`) and 16px padding so a field-list reads as a panel attached to the row above. `'flush'` removes padding/background so a nested table sits edge-to-edge with the parent grid. The denial-tool's recommendation detail (Recommended Action / Audit Log / Documents) is the classic `'inset'` case; if you wanted to show line items as a nested `<table>` below the row, you'd use `'flush'`.

**`rowDetailMaxHeight?: number | string | null`** — `null` (default) lets the page grow with the content. Set a number (px) or a CSS string (`'40vh'`) and the detail gets internal scroll instead. For large multi-section details where you don't want the grid to balloon, set this. The denial-tool's detail is probably small enough you don't need it; revisit when audit logs get long.

The four content shapes mapped to settings:

| Shape | `rowDetailVariant` | `rowDetailMaxHeight` |
|---|---|---|
| One-row field detail (50–200 px) | `'inset'` (default) | `null` |
| Small embedded table (200–500 px) | `'flush'` | `null` |
| Multi-section panel (400–800 px) | `'inset'` | a number around 480 |
| Full sub-page (open-ended) | `'flush'` | `null` |

### What I rejected from the conversation

- **Header-slot / footer-slot props** for the expansion. `renderRowDetail` returning `ReactNode` already lets you put a header and footer in your own output. Adding named slots would split one API into three.
- **Multi-row expansion.** Single is the right v1 for every consumer you named (denial-tool, claims search, auth worklist, patient search). Adding multi later is non-breaking.
- **Esc-to-collapse** keyboard shortcut. Nice-to-have you flagged as non-blocking. Deferred; chevron handles Enter/Space natively, which is the keyboard story callers need today.

---

## Picking the right layer for your migration

Three options. Your denial-tool `WorklistPage.tsx` should likely use **`DataExplorer`** — it gives you the toolbar chrome (search, density, column visibility) you almost certainly want around a worklist, while staying state-controlled so you can keep filters in URL state.

| Use… | When |
|---|---|
| `SchemaDataGrid` | Bare grid, no toolbar. You're rendering inside a custom container. |
| `DataExplorer` | Standard worklist chrome (search, filters, density, bulk-actions, pagination), state controlled by you. **Recommended for the denial-tool migration.** |
| `DataExplorerWired` | Same chrome as `DataExplorer` but the component manages its own pagination/sort/search/density and auto-fetches via `actionId`. Use when you don't need URL-synced filters and one action endpoint covers the whole worklist. |

Expansion works identically on all three.

### Recommended migration (using `DataExplorer`)

```tsx
import { useState } from 'react';
import { DataExplorer } from '@tensaw/composition/data-display';

const [expandedId, setExpandedId] = useState<string | null>(null);

<DataExplorer<Recommendation>
  rows={recommendations}
  columns={WORKLIST_COLUMNS}
  totalRows={total}
  getRowId={(r) => r.recommendation_id}

  // pagination — already controlled in your existing page
  pageIndex={pageIndex}
  pageSize={pageSize}
  onPageChange={setPageIndex}

  // selection — already wired in your existing page
  selectionMode="multi"
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}

  // search + filters — already wired
  searchValue={search}
  onSearchChange={setSearch}
  filters={<YourFilterChips />}
  bulkActions={<YourBulkActionsRow selectedIds={selectedIds} />}

  // NEW — row expansion
  expandedRowId={expandedId}
  onExpandedRowIdChange={setExpandedId}
  renderRowDetail={(row) => <RecommendationDetail row={row} />}
  // expandTrigger defaults to 'chevron' — what you want with checkboxes
  // rowDetailVariant defaults to 'inset' — what you want for the
  //   Recommended Action / Audit Log / Documents shape
/>
```

Your `RecommendationGrid` (251 LOC) goes away entirely. `WORKLIST_COLUMNS` should already be close to `SchemaDataGridColumn<Recommendation>[]` shape; a small type swap if anything.

### Things to watch during migration

- **`getRowId` is critical with UUIDs.** Pass it explicitly. The grid falls back to `row.id` field or array index, neither of which matches your `recommendation_id`-keyed state.
- **`renderRowDetail` runs only when a row is expanded.** Lazy-loading detail data on expand: just call your fetcher inside `renderRowDetail` (or pass `expandedRowId` to a parent hook). No "lazy" prop required.
- **Variant choice.** If your `RecommendationDetail` already has its own card/section borders, use `rowDetailVariant="flush"` so you don't get a double frame. If it's plain content, stick with the default `'inset'`.
- **Selection + chevron coexist cleanly.** Chevron click does not toggle selection; row click does (and also fires any existing `onRowClick`).

---

## Quality gates from this drop

| Gate | Result |
|---|---|
| `pnpm install` (fresh clone) | ✅ clean |
| `pnpm typecheck` | ✅ clean |
| `pnpm test` (all packages) | ✅ **1,100 passing** (1,067 baseline + 22 SchemaDataGrid + 7 DataExplorer + 4 DataExplorerWired) |
| `pnpm --filter @tensaw/composition lint` | ✅ clean |
| `pnpm --filter @tensaw/wired-components lint` | ✅ clean |
| `pnpm --filter @tensaw/design-system lint` | ✅ clean |
| `pnpm --filter @tensaw/app-patient lint` | ✅ clean |
| `pnpm --filter @tensaw/app-operations-console lint` | ✅ clean |
| `pnpm build` (workspace) | ✅ all dist artifacts |
| Patient `vite build` | ✅ **781.37 kB / 233.83 kB gz** — unchanged from prior expansion drop (prop forwarding adds no runtime code) |
| Operations-console `vite build` | ✅ clean (4939 modules) |
| `grep -i redux pnpm-lock.yaml` | ✅ 0 matches |

All consumer apps continue to build unmodified. Zero regressions in the 1,067 prior tests.

---

## Files added / modified

| Path | Change |
|---|---|
| `packages/composition/src/grids/SchemaDataGrid.tsx` | Modified — six new props wired through TanStack's `getExpandedRowModel`, chevron column, detail row, single-row constraint |
| `packages/composition/src/grids/SchemaDataGrid.test.tsx` | New — 22 tests covering both triggers, both variants, all maxHeight modes, single-row exclusivity, a11y, colSpan |
| `packages/composition/src/grids/SchemaDataGrid.demo.tsx` | New — 6 sections with realistic denial-tool worklist fixture |
| `packages/composition/src/grids/README.md` | New — focused on expansion + content-shapes guidance |
| `packages/composition/src/data-display/DataExplorer/DataExplorer.tsx` | Modified — six new props forwarded to inner SchemaDataGrid |
| `packages/composition/src/data-display/DataExplorer/DataExplorer.test.tsx` | Modified — 7 new tests covering chevron column, detail row, click handling, variant, maxHeight |
| `packages/composition/src/data-display/DataExplorer/README.md` | Modified — appended "Row expansion (forwarded to SchemaDataGrid)" section |
| `packages/wired-components/src/DataExplorerWired/DataExplorerWired.tsx` | Modified — docstring updated to note expansion props flow through `...rest`. No code changes; `Omit` already excludes only what the wired layer manages. |
| `packages/wired-components/src/DataExplorerWired/DataExplorerWired.test.tsx` | Modified — 4 new tests covering pass-through of all expansion props |
| `packages/wired-components/src/DataExplorerWired/README.md` | Modified — appended "Row expansion (passes through to DataExplorer)" section |

No other files touched.

---

## Backward compatibility

Strictly non-breaking at every layer. All six new props are optional. If `renderRowDetail` is omitted, the grid behaves exactly as it did before — no chevron column, no expansion mechanics, no extra `<tr>`. Regression tests pass at the `SchemaDataGrid` and `DataExplorer` levels both with and without expansion props.

`tensaw-ui-with-trace-expansion-v2.zip` is a strict superset of `tensaw-ui-with-trace.zip`. You can swap one for the other across all projects with no consumer changes needed.

---

## On ask #2 (platform configs)

You're right that this is a real structural issue. I didn't ship it in this drop because:

1. Your ask #1 was the immediate blocker for the denial-tool cleanup; #2 is forward-looking.
2. The presets touch every app's build config — that's a one-shot migration deserving its own kickoff, not a tail-of-another-drop addition.
3. I'd want to read the existing `apps/operations-console` and `apps/patient` Tailwind / PostCSS configs first to understand what the preset needs to cover (hand-tuned overrides? content globs already correct? etc.) before declaring an API.

If you want this next, the right flow is: I scan the existing app configs, propose the three preset files with a concrete diff, you sign off, then I land it as `tensaw-ui-with-presets.zip` in one shot. Reply on this and I'll start.

---

## What to look for if something feels off

- The new tests live next to the source. If you're auditing whether expansion really doesn't break the no-expansion case, look at the "baseline (no expansion props)" describe block in `SchemaDataGrid.test.tsx`, the "does not render expansion mechanics when renderRowDetail is omitted" test in `DataExplorer.test.tsx`, and the existing pre-expansion DataExplorerWired tests — all of which still pass without modification.
- The demo at `packages/composition/src/grids/SchemaDataGrid.demo.tsx` is a drop-in React component. Render it in a sandbox app to see all six variants at once.
- The "Content shapes" table in `packages/composition/src/grids/README.md` is the single best reference for picking variants when you wire your own detail content.

If the API still doesn't feel right after you start using it — different toggle semantics, missing knob, different a11y expectation — flag it. The current shape was sized for your stated cases plus claims/auth/patient-search; if a real use case wants something different, the contract should grow.

Ship it.
