# grids

`SchemaDataGrid` — schema-driven TanStack-backed data grid. Used by every worklist, search-list, and tabular-section widget across the platform.

This README covers the row-expansion feature added in the post-PromptQL revision. For the base grid features (column show/hide, sort, selection, density, sticky header), see the top-of-file JSDoc in `SchemaDataGrid.tsx`.

## Row expansion

Single-row controlled expansion. Opening row B closes row A. The grid does not mutate expansion state internally — the parent owns `expandedRowId` and applies changes via `onExpandedRowIdChange`.

### Minimal example

```tsx
import { useState } from 'react';
import { SchemaDataGrid } from '@tensaw/composition/grids';

const [openId, setOpenId] = useState<string | null>(null);

<SchemaDataGrid
  rows={recommendations}
  columns={COLUMNS}
  getRowId={(r) => r.recommendation_id}
  expandedRowId={openId}
  onExpandedRowIdChange={setOpenId}
  renderRowDetail={(row) => <RecommendationDetail row={row} />}
/>
```

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `expandedRowId` | `string \| null` | — | The currently-expanded row's id. `null` means no row expanded. Must come from `getRowId(row)`. |
| `onExpandedRowIdChange` | `(next: string \| null) => void` | — | Fires when the user toggles. Parent must apply the change for the UI to update. |
| `renderRowDetail` | `(row: TRow) => ReactNode` | — | Required when expansion is enabled. Called once per render with the row whose id matches `expandedRowId`. Return any ReactNode. |
| `expandTrigger` | `'row' \| 'chevron'` | `'chevron'` | `'chevron'` adds a trailing column with a chevron button. `'row'` makes the whole row clickable. |
| `rowDetailVariant` | `'inset' \| 'flush'` | `'inset'` | Visual framing of the detail row. See "Content shapes" below. |
| `rowDetailMaxHeight` | `number \| string \| null` | `null` | Caps the detail's height with internal scroll. `number` → px. `string` → any CSS height. `null` → no cap. |

Expansion is enabled only when `renderRowDetail` is provided. Pass `expandedRowId={null}` unconditionally if you want to leave the feature off; without `renderRowDetail`, nothing happens.

### Content shapes — when to use each variant

The grid frames the detail row but doesn't dictate its content. Four common shapes, with the right knobs for each:

| Shape | `rowDetailVariant` | `rowDetailMaxHeight` | Typical content |
|---|---|---|---|
| **One-row field detail** (50–200 px) | `'inset'` (default) | `null` | `ReadOnlyFieldGrid`, plain `<dl>`, key-value list |
| **Small embedded table** (200–500 px) | `'flush'` | `null` | Nested `SchemaDataGrid`, plain `<table>` |
| **Multi-section panel** (400–800 px) | `'inset'` | `480` (or similar) | Tabbed content, recommendation + audit + docs |
| **Full sub-page** (open-ended) | `'flush'` | `null` | Charts, dashboards, anything the viewport should hold |

The grid can't infer which shape you're rendering — pick the variant intentionally. `inset` is the right default; switch to `flush` when the inner content has its own visual boundary (its own table, its own card).

### Conventions

**Nested `SchemaDataGrid` works.** TanStack instances are independent. The one thing to watch: if both grids use sticky headers, they fight for the same scroll boundary. Opt the inner grid out of sticky headers, or wrap the inner grid in a non-scrolling container.

**Lazy-load on expand — no API change needed.** Because `renderRowDetail` only runs when a row is actually expanded, you can fire a fetcher inside it (or pass `row.id` to a parent-level hook keyed on `expandedRowId`). No "lazy" prop required.

**Stable detail key.** The detail `<tr>` uses `schema-grid-detail-${rowId}` as its DOM id and React key. The id is also `aria-controls`'d from the chevron button. Don't rely on the stable id for anything beyond debugging — treat it as internal.

**Density coordination.** Setting `density="compact"` on the parent grid does NOT propagate to your `renderRowDetail` output. The grid keeps the detail content rendered as you wrote it. If you want compact density to apply, wrap your detail in `<div data-density="compact">`.

### Accessibility

- The chevron button has `aria-expanded={isExpanded}`, `aria-controls={detailRowId}`, and a per-state `aria-label` ("Expand row" / "Collapse row").
- The detail `<tr>` has `role="region"` and `aria-label="Row detail"`.
- The chevron is a real `<button>`; Enter and Space toggle natively. Click events do not bubble to the parent row, so chevron toggling never accidentally triggers selection or `onRowClick`.

### When NOT to use row expansion

- **Comparison of two rows side-by-side.** Single-row expansion can't show two details at once. Use a dedicated comparison view or a split-pane layout.
- **Permanent inline detail.** If every row should always show its detail, the right pattern is a different column schema (or a card-list widget, not a grid).
- **Heavy fetcher + many rows.** If expanding a row pulls 500 KB of data and your users will expand 20 in a session, an inline detail panel makes the page feel heavy. Consider a side drawer / right rail instead.

## Anti-patterns

- ❌ **Don't try multi-row expansion** by tracking multiple ids in your own state and applying them sequentially. The grid is single-row by contract; the UX rationale (focused inspection) doesn't generalize. Multi-row may land as a separate API later.
- ❌ **Don't use `expandTrigger="row"` on a grid with selection** — you'd be asking the user to select and expand from the same click, which is confusing. Use `'chevron'`.
- ❌ **Don't put interactive controls in the trailing column** of a grid that uses chevron expansion; the chevron lives there. If you need both, restructure your columns.
- ❌ **Don't render an unbounded large detail without `rowDetailMaxHeight`.** A 3,000-px detail makes the grid feel broken when expanded. Either cap it, or use `'flush'` and let the page itself scroll.
