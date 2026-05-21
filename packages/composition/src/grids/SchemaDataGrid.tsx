/**
 * SchemaDataGrid.
 *
 * TanStack Table wrapped to render from a typed column schema. Used by every
 * worklist, search-list, and tabular-section widget. Built-in features:
 *
 *   - Column show/hide
 *   - Sort by single column (asc/desc/clear)
 *   - Row selection (single or multi)
 *   - Density (comfortable / compact)
 *   - Sticky header
 *   - Empty state when rows.length === 0
 *
 * Column schema lets each column declare:
 *   - id, header, accessorKey
 *   - cell renderer (any ReactNode — e.g. <MoneyCell>, <StatusCell>)
 *   - width, minWidth, align
 *   - sortable
 *   - hidden by default
 *
 * Pagination is left to the caller — pass already-paginated rows. (Real
 * worklists use server-side pagination; client paging belongs in a separate
 * widget.)
 */

import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { EmptyState } from '../states';

export interface SchemaDataGridColumn<TRow> {
  id: string;
  header: string;
  /** Function to extract the cell's primitive value from a row. */
  accessorKey?: keyof TRow & string;
  accessor?: (row: TRow) => unknown;
  /** Custom cell renderer. Receives the row + computed value. */
  cell?: (ctx: { row: TRow; value: unknown }) => ReactNode;
  width?: number | string;
  minWidth?: number;
  /**
   * Hard cap on column width. Long values truncate with `…` and the cell sets
   * a `title` attribute so hover shows the full text. Without this, a single
   * long value (e.g. "Elite Cardiovascular Specialists") could expand the
   * column past the width every other row needs.
   */
  maxWidth?: number;
  /**
   * Truncation mode for long text. Default `'tail'` when `maxWidth` is set,
   * `'none'` otherwise.
   */
  truncate?: 'tail' | 'none';
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Hidden by default; user can show via column-toggle UI. */
  defaultHidden?: boolean;
  /**
   * Always-visible. Column-visibility menus must keep this checked and
   * disabled. Use for identity columns (DOS, Patient) that no operator
   * should hide.
   */
  required?: boolean;
}

/**
 * Sort state — used when the grid runs in controlled-sort mode. Pass
 * `sort` and `onSortChange` together; the grid will not re-sort the rows
 * itself (the rows arrive pre-sorted from the server).
 */
export interface GridSortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface SchemaDataGridProps<TRow> {
  rows: TRow[];
  columns: SchemaDataGridColumn<TRow>[];
  /** Function returning a stable id for each row. Default: 'id' field. */
  getRowId?: (row: TRow, index: number) => string;
  /** Selection mode. */
  selectionMode?: 'none' | 'single' | 'multi';
  /** Controlled selection. */
  selection?: Record<string, boolean>;
  onSelectionChange?: (selection: Record<string, boolean>) => void;
  /** Density. */
  density?: 'comfortable' | 'compact';
  /** Empty state title/body. */
  emptyTitle?: string;
  emptyBody?: string;
  /** Click handler for the whole row. */
  onRowClick?: (row: TRow) => void;
  /**
   * Controlled sort. When provided, the grid does NOT sort rows internally —
   * the parent receives sort changes (typically forwarding to a server-side
   * `?sort=...` query) and supplies pre-sorted rows.
   *
   * Leave undefined for client-side default sort.
   */
  sort?: GridSortState | null;
  onSortChange?: (next: GridSortState | null) => void;
  /**
   * Controlled column visibility. When provided, the grid reads visibility
   * from this map and writes changes via `onColumnVisibilityChange`. The
   * parent typically persists this to the user-preferences slice.
   */
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (next: Record<string, boolean>) => void;

  // -- Row expansion (single-row, controlled) -------------------------------

  /**
   * Controlled id of the currently-expanded row. When set, the grid renders
   * a full-width detail `<tr>` immediately below the matching row containing
   * the output of `renderRowDetail(row)`. Pass `null` for "no row expanded".
   *
   * Single-row expansion only — opening row B closes row A. Multi-row
   * expansion is intentionally deferred (see README).
   *
   * Has no effect unless `renderRowDetail` is also provided.
   */
  expandedRowId?: string | null;
  /**
   * Notified when the user toggles expansion (chevron click, row click for
   * 'row' trigger, or programmatic `null` reset). The parent must apply the
   * change — the grid does not mutate expansion state internally.
   */
  onExpandedRowIdChange?: (next: string | null) => void;
  /**
   * Render fn for the expansion content. Called once per render with the
   * row whose id matches `expandedRowId`. If no row matches (id stale,
   * filter removed it, etc.), no detail row renders.
   *
   * Return any ReactNode — a field grid, a nested SchemaDataGrid, a tabbed
   * panel, etc. The grid wraps the output per `rowDetailVariant` and
   * optionally caps its height per `rowDetailMaxHeight`.
   */
  renderRowDetail?: (row: TRow) => ReactNode;
  /**
   * Where to put the click target that toggles expansion.
   *
   *   'chevron' (default) — adds a trailing column with a chevron button.
   *                          Only the chevron toggles. Recommended when the
   *                          row has interactive cells (checkboxes, links,
   *                          clickable badges) that would otherwise compete.
   *   'row'              — clicking anywhere in the row toggles expansion,
   *                          in addition to any existing onRowClick /
   *                          selection behavior. Use only when the row has
   *                          no other click affordances.
   *
   * Has no effect unless `renderRowDetail` is also provided.
   */
  expandTrigger?: 'row' | 'chevron';
  /**
   * Visual framing of the expansion `<tr>`.
   *
   *   'inset' (default) — padding (16px) + subtle muted background so the
   *                        detail reads as a panel attached to the row above.
   *                        Best for field grids, tabbed panels, forms.
   *   'flush'           — no padding, no background; the detail content sits
   *                        edge-to-edge with the parent grid. Best for nested
   *                        tables and full-bleed widgets.
   */
  rowDetailVariant?: 'inset' | 'flush';
  /**
   * Maximum height of the expansion's rendered content. When exceeded, the
   * expansion gets an internal scroll rather than growing the page.
   *
   * Pass a number (px) or any CSS height string (e.g. `'40vh'`). Pass `null`
   * (or omit) to disable — the page itself handles overflow, which is the
   * right choice for very large detail content that wants the full viewport.
   *
   * Default: `null` (no internal max height).
   */
  rowDetailMaxHeight?: number | string | null;
}

export function SchemaDataGrid<TRow>({
  rows,
  columns,
  getRowId,
  selectionMode = 'none',
  selection,
  onSelectionChange,
  density = 'comfortable',
  emptyTitle = 'No results',
  emptyBody,
  onRowClick,
  sort,
  onSortChange,
  columnVisibility,
  onColumnVisibilityChange,
  expandedRowId,
  onExpandedRowIdChange,
  renderRowDetail,
  expandTrigger = 'chevron',
  rowDetailVariant = 'inset',
  rowDetailMaxHeight = null,
}: SchemaDataGridProps<TRow>) {
  // Sort state. If controlled (sort + onSortChange), don't sort internally.
  const isSortControlled = sort !== undefined;
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sortingState: SortingState = isSortControlled
    ? sort === null
      ? []
      : [{ id: sort.columnId, desc: sort.direction === 'desc' }]
    : internalSorting;

  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});

  // Column visibility — controlled if both props supplied.
  const isVisibilityControlled =
    columnVisibility !== undefined && onColumnVisibilityChange !== undefined;
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(columns.filter((c) => c.defaultHidden).map((c) => [c.id, false])),
  );
  const visibilityState: VisibilityState = isVisibilityControlled
    ? columnVisibility
    : internalVisibility;

  const isSelectionControlled = selection !== undefined;
  const rowSelection = isSelectionControlled ? selection : internalSelection;

  // Expansion is fully controlled. `expandedRowId` is the source of truth;
  // we derive TanStack's `ExpandedState` from it on every render. Toggling
  // any row fires `onExpandedRowIdChange` — the parent owns the state.
  // We treat `renderRowDetail === undefined` as "expansion disabled" even
  // if `expandedRowId` is set; this lets callers pass `expandedRowId={null}`
  // unconditionally without enabling the feature.
  const expansionEnabled = renderRowDetail !== undefined;
  const expansionState: ExpandedState = useMemo(
    () =>
      expansionEnabled && expandedRowId
        ? { [expandedRowId]: true }
        : {},
    [expansionEnabled, expandedRowId],
  );

  const toggleExpanded = useCallback(
    (rowId: string) => {
      if (!expansionEnabled) return;
      onExpandedRowIdChange?.(expandedRowId === rowId ? null : rowId);
    },
    [expansionEnabled, expandedRowId, onExpandedRowIdChange],
  );

  const tanstackColumns = useMemo<ColumnDef<TRow>[]>(() => {
    return columns.map((col) => {
      const customAccessor = col.accessor;
      const keyAccessor = col.accessorKey;
      const def: ColumnDef<TRow> = {
        id: col.id,
        header: col.header,
        accessorFn: customAccessor
          ? (row: TRow) => customAccessor(row)
          : keyAccessor
            ? (row: TRow) => row[keyAccessor as keyof TRow]
            : undefined,
        cell: ({ row, getValue }) =>
          col.cell
            ? col.cell({ row: row.original, value: getValue() })
            : (getValue() as ReactNode) ?? null,
        enableSorting: col.sortable !== false,
      };
      if (col.width !== undefined) def.size = typeof col.width === 'number' ? col.width : undefined;
      if (col.minWidth !== undefined) def.minSize = col.minWidth;
      return def;
    });
  }, [columns]);

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    state: {
      sorting: sortingState,
      rowSelection,
      columnVisibility: visibilityState,
      expanded: expansionState,
    },
    enableRowSelection: selectionMode !== 'none',
    enableMultiRowSelection: selectionMode === 'multi',
    enableExpanding: expansionEnabled,
    // Single-row expansion: opening row B closes row A. We enforce this in
    // `toggleExpanded` (parent applies the change) so this is belt-and-
    // suspenders; TanStack would still allow multi if we let it.
    // When controlled, disable client-side sorting (rows arrive pre-sorted).
    manualSorting: isSortControlled,
    getRowId: getRowId
      ? (row, index) => getRowId(row, index)
      : (row, index) => {
          const r = row as unknown as Record<string, unknown>;
          return typeof r.id === 'string' || typeof r.id === 'number'
            ? String(r.id)
            : String(index);
        },
    onSortingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(sortingState) : updater;
      if (isSortControlled) {
        const first = next[0];
        if (!first) {
          onSortChange?.(null);
        } else {
          onSortChange?.({
            columnId: first.id,
            direction: first.desc ? 'desc' : 'asc',
          });
        }
      } else {
        setInternalSorting(next);
      }
    },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      if (isSelectionControlled) {
        onSelectionChange?.(next);
      } else {
        setInternalSelection(next);
      }
    },
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(visibilityState) : updater;
      if (isVisibilityControlled) {
        onColumnVisibilityChange(next);
      } else {
        setInternalVisibility(next);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  // Build column-by-id map for alignment lookup. Must run on EVERY render
  // (before any early return) — calling fewer hooks on a subsequent render
  // would violate the rules of hooks.
  const colMeta = useMemo(() => {
    const map = new Map<string, SchemaDataGridColumn<TRow>>();
    for (const c of columns) map.set(c.id, c);
    return map;
  }, [columns]);

  // Empty state takes precedence.
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  const cellPad = density === 'compact' ? '6px 10px' : '10px 14px';

  // Whether to render the trailing chevron column. Independent decision from
  // `expansionEnabled` because 'row'-triggered expansion has no chevron.
  const showChevronColumn = expansionEnabled && expandTrigger === 'chevron';

  // colSpan used by the detail row. Must cover every rendered column,
  // including the chevron column when present.
  const visibleColCount =
    table.getVisibleFlatColumns().length + (showChevronColumn ? 1 : 0);

  return (
    <div style={containerStyle}>
      <table style={tableStyle}>
        <thead style={theadStyle}>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const col = colMeta.get(header.column.id);
                const sortDir = header.column.getIsSorted();
                const align = col?.align ?? 'left';
                const headerStyle: CSSProperties = {
                  ...thStyle,
                  padding: cellPad,
                  textAlign: align,
                  cursor: header.column.getCanSort() ? 'pointer' : 'default',
                  width: col?.width,
                  minWidth: col?.minWidth,
                  maxWidth: col?.maxWidth,
                };
                return (
                  <th
                    key={header.id}
                    style={headerStyle}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sortDir === 'asc' ? <span style={sortGlyph}> ▲</span> : null}
                    {sortDir === 'desc' ? <span style={sortGlyph}> ▼</span> : null}
                  </th>
                );
              })}
              {showChevronColumn ? (
                <th
                  key="__expand_header__"
                  scope="col"
                  style={{
                    ...thStyle,
                    padding: cellPad,
                    width: 40,
                    minWidth: 40,
                  }}
                />
              ) : null}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isSelected = row.getIsSelected();
            const isExpanded = expansionEnabled && expandedRowId === row.id;
            const detailRowId = `schema-grid-detail-${row.id}`;

            const rowClickable =
              Boolean(onRowClick) ||
              selectionMode !== 'none' ||
              (expansionEnabled && expandTrigger === 'row');

            const handleRowClick = () => {
              if (onRowClick) onRowClick(row.original);
              if (selectionMode !== 'none') row.toggleSelected();
              if (expansionEnabled && expandTrigger === 'row') {
                toggleExpanded(row.id);
              }
            };

            const handleChevronClick = (
              e: ReactMouseEvent<HTMLButtonElement>,
            ) => {
              // Stop bubble so the parent <tr>'s click handler doesn't also
              // fire selection / onRowClick. The chevron is an explicit
              // expansion-only affordance.
              e.stopPropagation();
              toggleExpanded(row.id);
            };

            const handleChevronKeyDown = (
              e: ReactKeyboardEvent<HTMLButtonElement>,
            ) => {
              // Native <button> already toggles on Enter/Space, but we stop
              // propagation so the row's keyboard handlers (if any) don't
              // double-fire.
              if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
            };

            return (
              <Fragment key={row.id}>
                <tr
                  onClick={rowClickable ? handleRowClick : undefined}
                  style={{
                    ...tdRowStyle(isSelected),
                    cursor: rowClickable ? 'pointer' : 'default',
                  }}
                  aria-selected={isSelected || undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const col = colMeta.get(cell.column.id);
                    const truncate =
                      col?.truncate === 'tail' ||
                      (col?.truncate !== 'none' && col?.maxWidth !== undefined);
                    const tdInlineStyle: CSSProperties = {
                      ...tdStyle,
                      padding: cellPad,
                      textAlign: col?.align ?? 'left',
                      maxWidth: col?.maxWidth,
                    };
                    // Compute a string for the title attribute (hover tooltip).
                    // Skip if the cell is non-string (custom React node) — title
                    // wouldn't be meaningful and the renderer can set its own.
                    const value = cell.getValue();
                    const titleText =
                      truncate && (typeof value === 'string' || typeof value === 'number')
                        ? String(value)
                        : undefined;
                    const cellNode = flexRender(cell.column.columnDef.cell, cell.getContext());
                    return (
                      <td key={cell.id} style={tdInlineStyle} title={titleText}>
                        {truncate ? (
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%',
                            }}
                          >
                            {cellNode}
                          </div>
                        ) : (
                          cellNode
                        )}
                      </td>
                    );
                  })}
                  {showChevronColumn ? (
                    <td
                      style={{
                        ...tdStyle,
                        padding: cellPad,
                        textAlign: 'center',
                        width: 40,
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleChevronClick}
                        onKeyDown={handleChevronKeyDown}
                        aria-expanded={isExpanded}
                        aria-controls={detailRowId}
                        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                        style={chevronButtonStyle}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            transform: isExpanded
                              ? 'rotate(90deg)'
                              : 'rotate(0deg)',
                            transition: 'transform 120ms ease-out',
                          }}
                        >
                          ▶
                        </span>
                      </button>
                    </td>
                  ) : null}
                </tr>
                {isExpanded ? (
                  <tr
                    key={detailRowId}
                    id={detailRowId}
                    role="region"
                    aria-label="Row detail"
                    style={detailRowStyle}
                  >
                    <td
                      colSpan={visibleColCount}
                      style={detailCellStyle(rowDetailVariant)}
                    >
                      <div
                        style={detailContentStyle(
                          rowDetailVariant,
                          rowDetailMaxHeight,
                        )}
                      >
                        {renderRowDetail(row.original)}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -- Styles -------------------------------------------------------------------

const containerStyle: CSSProperties = {
  width: '100%',
  overflow: 'auto',
  border: '1px solid var(--tw-color-border-muted, #E5E7EB)',
  borderRadius: 8,
  background: 'var(--tw-color-surface-raised, #FFFFFF)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
};

const theadStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--tw-color-table-header-bg, #EBF7F6)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--tw-color-text-accent, #218D8D)',
  borderBottom: '1px solid var(--tw-color-border-muted, #E5E7EB)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const tdRowStyle = (selected: boolean): CSSProperties => ({
  background: selected ? 'var(--tw-color-brand-tint, #EBF7F6)' : 'transparent',
  borderBottom: '1px solid var(--tw-color-border-muted, #E5E7EB)',
});

const tdStyle: CSSProperties = {
  color: 'var(--tw-color-text-primary, #1F2937)',
};

const sortGlyph: CSSProperties = {
  fontSize: 9,
  color: 'var(--tw-color-text-muted, #6B7280)',
};

const chevronButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  color: 'var(--tw-color-text-muted, #6B7280)',
  fontSize: 10,
  lineHeight: 1,
  borderRadius: 4,
};

const detailRowStyle: CSSProperties = {
  // No bottom border on the detail row itself — the parent row already
  // has one. The detail's own bottom border (separating it from the next
  // data row) is applied to the inner cell.
  borderBottom: '1px solid var(--tw-color-border-muted, #E5E7EB)',
};

const detailCellStyle = (variant: 'inset' | 'flush'): CSSProperties => ({
  // Padding lives in the inner content div (so 'flush' can have zero
  // padding without the cell collapsing). Cell-level styling is just the
  // background for 'inset'.
  padding: 0,
  background:
    variant === 'inset'
      ? 'var(--tw-color-surface-sunken, #F9FAFB)'
      : 'transparent',
});

const detailContentStyle = (
  variant: 'inset' | 'flush',
  maxHeight: number | string | null,
): CSSProperties => {
  const style: CSSProperties = {
    padding: variant === 'inset' ? 16 : 0,
  };
  if (maxHeight !== null) {
    style.maxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;
    style.overflow = 'auto';
  }
  return style;
};
