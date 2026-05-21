# DataExplorer

A presentational data table with sorting, pagination, search, and
selection. Lives in `@tensaw/composition` because it composes design-system
primitives with a schema-driven grid.

For self-fetching tables tied to a registered action, use
`<DataExplorerWired>` from `@tensaw/wired-components`.

## Usage

```tsx
import { DataExplorer } from '@tensaw/composition/data-display';

<DataExplorer<Claim>
  rows={claims}
  total={totalCount}
  columns={[
    { id: 'id', header: 'Claim #', accessor: (r) => r.id, sortable: true },
    { id: 'patient', header: 'Patient', accessor: (r) => r.patientName },
    { id: 'status', header: 'Status', cell: (r) => <Badge>{r.status}</Badge> },
  ]}
  page={page}
  pageSize={25}
  sort={{ columnId: 'id', direction: 'asc' }}
  search={searchQuery}
  loading={isLoading}
  empty={<EmptyState title="No claims" />}
  onPageChange={setPage}
  onSortChange={setSort}
  onSearchChange={setSearchQuery}
/>
```

## Props

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `rows` | `T[]` | **required** | Visible rows for current page |
| `total` | `number` | **required** | Total rows across all pages |
| `columns` | `Column<T>[]` | **required** | Schema-driven column definitions |
| `page` / `pageSize` | `number` | — | Pagination state |
| `sort` | `{ columnId, direction }` | — | Current sort |
| `search` | `string` | — | Current search query (debounced upstream) |
| `selection` | `Selection<T>` | — | Row selection state (when multi-select) |
| `loading` | `boolean` | `false` | Renders Skeleton rows |
| `empty` | `ReactNode` | — | Rendered when `rows` is empty and not loading |
| `onPageChange` / `onSortChange` / `onSearchChange` / `onSelectionChange` | callbacks | — | State change handlers |

Column shape: `{ id, header, accessor?, cell?, sortable?, width? }`. If
both `accessor` and `cell` are provided, `cell` wins for rendering and
`accessor` is used for sorting.

## Accessibility

- Renders a real `<table>` with proper header/row semantics
- Sort buttons announce current direction via `aria-sort`
- Selection checkboxes have descriptive labels
- Loading state announces via `aria-busy="true"`

## Related

- `<DataExplorerWired>` — auto-fetches via an action
- `<Pagination>` — standalone pagination
- `<SchemaDataGrid>` — schema-driven grid that DataExplorer composes

## Anti-patterns

- ❌ **Don't** wire data fetching inside DataExplorer. Pass `rows`,
  `total`, `loading`, `error` from the parent (or use Wired).
- ❌ **Don't** make every column sortable. Sort only on columns where the
  comparison is meaningful.

## Row expansion (forwarded to `<SchemaDataGrid>`)

DataExplorer forwards six expansion props to its inner `SchemaDataGrid`. The semantics are unchanged from the grid level — DataExplorer adds no behavior on top, it only gives you the toolbar + filters + bulk-actions + pagination chrome around the grid.

| Prop | Default | Purpose |
|---|---|---|
| `expandedRowId` | — | Controlled id of the open row. `null` means no row open. |
| `onExpandedRowIdChange` | — | Parent applies the toggle. |
| `renderRowDetail` | — | Returns `ReactNode` for the detail panel. Required when expansion is enabled. |
| `expandTrigger` | `'chevron'` | `'chevron'` adds a trailing column with a chevron button. `'row'` makes the whole row clickable. |
| `rowDetailVariant` | `'inset'` | Visual framing. `'inset'` = subtle background + 16px padding. `'flush'` = edge-to-edge. |
| `rowDetailMaxHeight` | `null` | Optional internal-scroll cap. Number → px; string → any CSS height. |

```tsx
<DataExplorer<Row>
  rows={rows}
  columns={COLUMNS}
  totalRows={total}
  pageIndex={pageIndex}
  pageSize={25}
  onPageChange={setPageIndex}
  // toolbar chrome works normally...
  searchValue={search}
  onSearchChange={setSearch}
  selectionMode="multi"
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}
  // ...and add expansion:
  expandedRowId={expandedId}
  onExpandedRowIdChange={setExpandedId}
  renderRowDetail={(row) => <RecommendationDetail row={row} />}
/>
```

See `@tensaw/composition/grids/README.md` for the "Content shapes" table that maps each common detail shape (field grid, nested table, multi-section panel, full sub-page) to the right `rowDetailVariant` + `rowDetailMaxHeight` choice.
