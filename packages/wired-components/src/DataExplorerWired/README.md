# DataExplorerWired

`<DataExplorer>` wired to fetch via `useActionQuery`. Owns pagination,
sort, and search state internally — drop it into a page and it works.

## Usage

```tsx
import { DataExplorerWired } from '@tensaw/wired-components';
import type { SchemaDataGridColumn } from '@tensaw/composition/grids';

const columns: SchemaDataGridColumn<Claim>[] = [
  { id: 'id', header: 'Claim #', accessor: (r) => r.id, sortable: true },
  { id: 'patient', header: 'Patient', accessor: (r) => r.patientName },
];

<DataExplorerWired<Claim, ListClaimsRequest>
  actionId="claim.list"
  request={{ stateCode: 'OPEN' }}
  columns={columns}
  selectRows={(data) => data.rows}
  selectTotal={(data) => data.totalCount}
  initialPageSize={25}
/>
```

## Props

| Prop | Type | What it does |
| --- | --- | --- |
| `actionId` | `string` | The query-action that returns the rows |
| `request` | `Partial<ActionRequest>` | Static parts of the request (offset/limit/sort/search injected by the component) |
| `columns` | `SchemaDataGridColumn<T>[]` | Column definitions |
| `selectRows` | `(data) => T[]` | Extract the rows from the response |
| `selectTotal` | `(data) => number` | Extract the total row count |
| `initialPageSize` | `number` | `25` | Default page size |
| `initialSort` | `{ columnId, direction }` | — | Default sort |
| `searchDebounceMs` | `number` | `300` | Search debounce |

## Internal request shape

The component injects `offset`, `limit`, `sort` (as `${columnId}:${direction}`),
and `search` into the action's request. Your action schema should accept
these fields as optional or expect them.

## Accessibility

Inherits DataExplorer's accessibility (real `<table>`, sort `aria-sort`,
loading `aria-busy`).

## Related

- `<DataExplorer>` — for pre-fetched data
- `<Pagination>` — for non-table paginated lists

## Anti-patterns

- ❌ **Don't** wrap DataExplorerWired to add custom fetch logic. Define
  a different action instead.
- ❌ **Don't** mix internal pagination state with external `page` props.
  The wired component owns it.

## Row expansion (passes through to `<DataExplorer>`)

The six expansion props on `<DataExplorer>` flow through unchanged. The wired layer doesn't manage expansion state — the consumer still owns `expandedRowId` + `onExpandedRowIdChange`, exactly as on the bare `DataExplorer`.

```tsx
const [expandedId, setExpandedId] = useState<string | null>(null);

<DataExplorerWired<Recommendation, { state_code: string }>
  actionId="admin.list-recommendations"
  request={{ state_code: 'PENDING' }}
  columns={WORKLIST_COLUMNS}
  selectRows={(d) => (d as { rows: Recommendation[] }).rows}
  selectTotal={(d) => (d as { totalCount: number }).totalCount}
  expandedRowId={expandedId}
  onExpandedRowIdChange={setExpandedId}
  renderRowDetail={(row) => <RecommendationDetail row={row} />}
/>
```

This is intentional. Expansion id often needs to live in URL state (deep linking) or in a shared store (cross-component coordination), neither of which the wired component should pre-empt.

See the parent `<DataExplorer>` README and `@tensaw/composition/grids/README.md` for the full expansion prop reference and the content-shapes guidance.
