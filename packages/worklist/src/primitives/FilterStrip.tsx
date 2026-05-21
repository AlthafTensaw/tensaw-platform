/**
 * FilterStrip.
 *
 * Horizontal chip strip that lives below the page header on a search-list
 * page. Hosts filter chips (multi-select, single-select, date range) and
 * provides a "Clear all" affordance.
 *
 * Layout-only: it does not own filter state. The parent page composes the
 * filter chips and passes them as children. This keeps the strip reusable
 * across worklists with different filter sets.
 */

import type { CSSProperties, ReactNode } from 'react';

export interface FilterStripProps {
  children: ReactNode;
  /** Number of currently-active filters. Shown as a small pill next to the label. */
  activeCount?: number;
  /** Called when the user clicks "Clear all". Hidden when activeCount is 0 or undefined. */
  onClearAll?: () => void;
  /** Optional label to the left of the chips. Defaults to "Filters". */
  label?: string;
}

export function FilterStrip({
  children,
  activeCount,
  onClearAll,
  label = 'Filters',
}: FilterStripProps) {
  const showClear = onClearAll && (activeCount ?? 0) > 0;
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 bg-muted/30 border-b border-border flex-wrap" role="region" aria-label="Filters">
      <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mr-1">
        <span>{label}</span>
        {activeCount !== undefined && activeCount > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-semibold">{activeCount}</span>
        ) : null}
      </div>
      <div className="inline-flex items-center gap-2 flex-1 flex-wrap">{children}</div>
      {showClear ? (
        <button type="button" className="text-teal-700 text-xs px-2 py-1 hover:underline" onClick={onClearAll}>
          Clear all
        </button>
      ) : null}
    </div>
  );
}
