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
import { useAuthStore, getTokenProvider, config } from '@tensaw/runtime';
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

  const handleExport = async (): Promise<void> => {
    try {
      const params = new URLSearchParams({
        purpose: 'worklist_review',
        format: 'csv',
      });
      
      const token = await getTokenProvider().getAccessToken();
      const clinicId = useAuthStore.getState().clinicId;
      
      const headers = new Headers();
      headers.set('X-Correlation-Id', `c-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`);
      headers.set('X-Request-Id', `r-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`);
      headers.set('X-Build-Version', config.app.buildVersion);
      headers.set('X-App-Id', config.app.id);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (clinicId !== null) {
        headers.set('X-Clinic-Id', String(clinicId));
      }
      if (config.api.baseUrl.includes('ngrok')) {
        headers.set('ngrok-skip-browser-warning', 'true');
      }

      const response = await fetch(`${config.api.baseUrl}/v1/claims/worklist/export?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'worklist_export.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
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
