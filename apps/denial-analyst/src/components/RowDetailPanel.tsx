/**
 * RowDetailPanel — orchestrates claim header + 3 regions + action bar.
 *
 * PR-7 fixes:
 *   - Snake_case all dispatcher requests: { claim_id }, { classification_id }
 *     to match the action registry's path-param substitution (bugs #11 + #14).
 *   - useMemo on the two query request objects to keep React Query keys
 *     stable across renders (bug #6 — infinite fetch loop).
 *   - ActionButton requests now carry classification_id at the top level so
 *     the dispatcher's path-substitution finds it (bug #14).
 *   - Token rewrites: bg-card → bg-card on the claim header / action bar
 *     (bug #12), text-muted-foreground → text-muted-foreground throughout (bug #9),
 *     border-border → border-border, bg-muted/50 → bg-muted/50.
 */

import { useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { Button } from '@tensaw/design-system/primitives';
import { ActionButton } from '@tensaw/wired-components';
import { Badge } from '@tensaw/design-system/feedback';
import { usePermissions } from '../auth/permissions';
import type {
  ClaimDetail,
  DenialEvent,
  StateTransitionResponse,
  WorklistRow,
} from '../actions/schemas';
import { ClaimDetailHeader } from './ClaimDetailHeader';
import { DenialEventsList } from './DenialEventsList';
import { WorkflowStepsList } from './WorkflowStepsList';
import { OverrideModal } from './OverrideModal';

interface RowDetailPanelProps {
  row: WorklistRow;
  onMutated: () => void;
}

export function RowDetailPanel({ row, onMutated }: RowDetailPanelProps) {
  const { has } = usePermissions();
  const canAct = has('denial.act');
  const canReclassify = has('denial.classify_claim');
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { classification, claim } = row;
  const classificationId = classification.classification_id;
  const claimId = claim.claim_id;
  const state = classification.state;

  // PR-7: useMemo on request objects so React Query keys are stable.
  // Without this, the inline object literal makes RQ think the key
  // changed on every render → infinite refetch (bug #6).
  const claimDetailRequest = useMemo(
    () => ({ claim_id: claimId }),
    [claimId],
  );
  const denialEventsRequest = useMemo(
    () => ({ claim_id: claimId }),
    [claimId],
  );

  const { data: claimDetail, isLoading: detailLoading } = useActionQuery<ClaimDetail>(
    'denial.claim-detail',
    claimDetailRequest
  );

  const { data: eventsData, isLoading: eventsLoading } = useActionQuery<DenialEvent[]>(
    'denial.denial-events',
    denialEventsRequest
  );

  const isWorkedOutsideTool =
    claim.current_status_label !== null &&
    claim.current_status_label !== 'Denied';

  return (
    <div className="bg-muted/50">
      <ClaimDetailHeader
        detail={claimDetail}
        loading={detailLoading}
        classificationId={classificationId}
      />

      {/* Region 1 + 2 side by side */}
      <div className="grid grid-cols-2 border-b border-border">
        <div className="p-4 border-r border-border">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Classification reasoning
          </div>
          <div className="text-sm leading-relaxed mb-2 text-foreground">
            {classification.reasoning_summary}
          </div>
          <div className="flex gap-2 items-center text-xs text-muted-foreground">
            {classification.rule_id ? (
              <Badge variant="info" size="sm">
                <code className="font-mono text-xs">
                  {classification.rule_id}
                </code>
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                LLM-classified
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <span
                className={[
                  'w-1.5 h-1.5 rounded-full inline-block',
                  classification.confidence === 'high'
                    ? 'bg-teal-600'
                    : classification.confidence === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-red-500',
                ].join(' ')}
              />
              {classification.confidence} confidence
            </span>
          </div>
        </div>

        <div className="p-4">
          <DenialEventsList
            events={eventsData}
            loading={eventsLoading}
            classificationId={classificationId}
          />
        </div>
      </div>

      {/* Region 3 — workflow steps */}
      <div className="p-4 border-b border-border">
        <WorkflowStepsList
          classification={classification}
          canAct={canAct}
          onStepCompleted={() => { onMutated(); }}
          onAutoComplete={() => { onMutated(); }}
        />
      </div>

      {/* State-aware action bar — bg-card, not bg-card */}
      <div className="px-4 py-3 bg-card flex gap-2 items-center">
        {state === 'recommended' && canAct ? (
          isWorkedOutsideTool ? (
            <ActionButton<
              { classification_id: string; reason: string },
              StateTransitionResponse
            >
              actionId="denial.override"
              request={{
                classification_id: classificationId,
                reason: 'worked_outside_tool',
              }}
              variant="primary"
              toastOnSuccess="Recorded as worked outside tool"
              onSuccess={onMutated}
            >
              Mark as worked outside tool
            </ActionButton>
          ) : (
            <ActionButton<{ classification_id: string }, StateTransitionResponse>
              actionId="denial.accept"
              request={{ classification_id: classificationId }}
              variant="primary"
              toastOnSuccess="Accepted"
              onSuccess={onMutated}
            >
              Accept
            </ActionButton>
          )
        ) : null}

        {state === 'recommended' && canAct ? (
          <Button variant="ghost" onClick={() => { setOverrideOpen(true); }}>
            Override…
          </Button>
        ) : null}

        {(state === 'accepted' || state === 'overridden') && canAct ? (
          <ActionButton<{ classification_id: string }, StateTransitionResponse>
            actionId="denial.complete"
            request={{ classification_id: classificationId }}
            variant="primary"
            toastOnSuccess="Marked complete"
            onSuccess={onMutated}
          >
            Complete
          </ActionButton>
        ) : null}

        {canReclassify && state !== 'completed' ? (
          <ActionButton<{ claim_id: number }>
            actionId="denial.classify-claim"
            request={{ claim_id: claimId }}
            variant="ghost"
            toastOnSuccess="Re-classified"
            onSuccess={onMutated}
          >
            Re-classify
          </ActionButton>
        ) : null}

        {state === 'completed' ? (
          <span className="text-sm text-muted-foreground">
            Completed · classification finalized
          </span>
        ) : null}

        <span className="ml-auto text-xs text-muted-foreground/70">
          Classified {new Date(classification.classified_at).toLocaleString()}{' '}
          · tool {classification.tool_version}
        </span>
      </div>

      <OverrideModal
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        classification={classification}
        onSuccess={onMutated}
      />
    </div>
  );
}
