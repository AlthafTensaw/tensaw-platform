/**
 * RunClassifierNowButton — manager-only per-claim re-classify (D-18).
 *
 * PR-6: platform ActionButton from @tensaw/wired-components with the
 * permission gate inline. If the user lacks denial.classify_claim, the
 * button doesn't render at all (no disabled-state tease — the action
 * just isn't visible).
 *
 * Kept as a standalone component (rather than inlined in
 * WorkPane only — v3.0 three-pane shell) so future surfaces — e.g. an admin per-claim
 * inspector — can reuse it.
 */

import { ActionButton } from '@tensaw/wired-components';
import type { Classification } from '../actions/schemas';

interface RunClassifierNowButtonProps {
  claimId: number;
  canReclassify?: boolean;
  onClassified?: (next: Classification) => void;
}

export function RunClassifierNowButton({
  claimId,
  canReclassify,
  onClassified,
}: RunClassifierNowButtonProps) {
  if (!canReclassify) return null;

  return (
    <ActionButton<{ claim_id: number }, Classification>
      actionId="denial.classify-claim"
      request={{ claim_id: claimId }}
      variant="ghost"
      toastOnSuccess="Re-classified"
      onSuccess={onClassified}
    >
      Re-classify
    </ActionButton>
  );
}
