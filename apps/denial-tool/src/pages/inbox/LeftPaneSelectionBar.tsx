/**
 * LeftPaneSelectionBar — floats at the top of the left list when
 * multi-select is active.
 *
 * Reuses v2.3 BulkAssignDialog in 'cross-rows' mode for "Reassign to…".
 * Maps WorklistRow[] → BulkAssignTarget[].
 */

import { useMemo, useState } from 'react';
import type { WorklistRow } from '../../actions/schemas';
import {
  BulkAssignDialog,
  type BulkAssignTarget,
} from '../../components/BulkAssignDialog';

interface LeftPaneSelectionBarProps {
  selectedRows: WorklistRow[];
  totalSelectedCount: number;
  onClear: () => void;
  onMutated: () => void;
}

export function LeftPaneSelectionBar({
  selectedRows,
  totalSelectedCount,
  onClear,
  onMutated,
}: LeftPaneSelectionBarProps): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);
  const offPageCount = totalSelectedCount - selectedRows.length;

  const targets = useMemo<BulkAssignTarget[]>(
    () =>
      selectedRows.map((r) => ({
        classification_id: r.classification.classification_id,
        primary_category: r.classification.primary_category,
        workflow_steps: r.classification.workflow_steps,
      })),
    [selectedRows],
  );

  return (
    <>
      <div
        className="flex items-center gap-2 border-b border-border px-3.5 py-2 text-[12px] text-white"
        style={{ backgroundColor: '#0d9488' }}
      >
        <span className="font-semibold">{totalSelectedCount}</span>
        <span>selected</span>
        {offPageCount > 0 ? (
          <span className="opacity-80">({offPageCount} off-page)</span>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] opacity-80 hover:opacity-100"
        >
          · clear
        </button>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => { setDialogOpen(true); }}
            className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: '#134e4a' }}
          >
            Reassign to…
          </button>
        </div>
      </div>

      {dialogOpen ? (
        <BulkAssignDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); }}
          mode="cross-rows"
          targets={targets}
          onSuccess={() => {
            setDialogOpen(false);
            onMutated();
            onClear();
          }}
        />
      ) : null}
    </>
  );
}
