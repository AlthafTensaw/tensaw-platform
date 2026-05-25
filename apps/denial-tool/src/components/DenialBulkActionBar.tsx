/**
 * DenialBulkActionBar — Bulk-assign, Accept-all, CSV export over selected rows.
 *
 * v2.3: added "Bulk assign…" button that opens BulkAssignDialog in cross-rows mode.
 *
 * v2.0.3 fixes (still apply):
 *   - BulkActionBar prop names: selectedCount, onClearSelection, countLabel
 *   - toastOnSuccess: static string
 *   - GateResult shape uses `reason`
 */

import { useState } from 'react';
import { BulkActionBar } from '@tensaw/worklist';
import { Button, Icon } from '@tensaw/design-system/primitives';
import { Tooltip } from '@tensaw/design-system/overlays';
import { ActionButton } from '@tensaw/wired-components';
import type { BulkAcceptResponse, WorklistRow } from '../actions/schemas';
import { BulkAssignDialog, type BulkAssignTarget } from './BulkAssignDialog';
import { evaluateD19Gate } from './d19Gate';

interface DenialBulkActionBarProps {
  selectedRows: WorklistRow[];
  offPageSelectedCount: number;
  totalSelectedCount: number;
  onClear: () => void;
  onMutated: () => void;
}

export function DenialBulkActionBar({
  selectedRows,
  offPageSelectedCount,
  totalSelectedCount,
  onClear,
  onMutated,
}: DenialBulkActionBarProps): JSX.Element {
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const gate = evaluateD19Gate(selectedRows);
  const ids = selectedRows.map((r) => r.classification.classification_id);

  const handleExport = (): void => {
    const params = new URLSearchParams({
      purpose: 'worklist_review',
      format: 'csv',
    });
    window.location.href = `/api/v1/claims/worklist/export?${params.toString()}`;
  };

  // Build BulkAssignTargets from the selected worklist rows
  const assignTargets: BulkAssignTarget[] = selectedRows.map((r) => ({
    classification_id: r.classification.classification_id,
    primary_category: r.classification.primary_category,
    workflow_steps: r.classification.workflow_steps,
  }));

  const countLabel = offPageSelectedCount > 0
    ? `${String(totalSelectedCount)} selected (${String(selectedRows.length)} on this page)`
    : `${String(totalSelectedCount)} selected`;

  return (
    <>
      <BulkActionBar
        selectedCount={totalSelectedCount}
        onClearSelection={onClear}
        countLabel={countLabel}
      >
        <Button
          variant="primary"
          onClick={() => { setBulkAssignOpen(true); }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon name="UserPlus" size="xs" />
            Bulk assign…
          </span>
        </Button>

        {gate.ok ? (
          <ActionButton<{ classification_ids: string[] }, BulkAcceptResponse>
            actionId="denial.bulk-accept"
            request={{ classification_ids: ids }}
            variant="ghost"
            toastOnSuccess="Accepted"
            onSuccess={() => {
              onClear();
              onMutated();
            }}
          >
            Accept all ({String(selectedRows.length)})
          </ActionButton>
        ) : (
          <Tooltip content={gate.reason}>
            <Button variant="ghost" disabled>
              Accept all ({String(selectedRows.length)})
            </Button>
          </Tooltip>
        )}

        <Button variant="ghost" onClick={handleExport}>
          Export CSV
        </Button>
      </BulkActionBar>

      {bulkAssignOpen ? (
        <BulkAssignDialog
          open={bulkAssignOpen}
          onClose={() => { setBulkAssignOpen(false); }}
          mode="cross-rows"
          targets={assignTargets}
          initialStepNumber={1}
          onSuccess={() => {
            onClear();
            onMutated();
          }}
        />
      ) : null}
    </>
  );
}
