/**
 * ProposedView — shown when case_status='proposed'.
 *
 * Per mockup #8. Renders:
 *   - LlmRecommendationCard — prominent block with recommended category,
 *     confidence percentage, and reasoning
 *   - WorkflowProgressStrip in preview mode — dashed circles showing what
 *     would happen if Accept were clicked
 *   - Action bar at bottom: [Accept] [Override...] [Re-classify]
 *
 * Drop-in path: src/components/work-pane/ProposedView.tsx
 */

import { useState, useCallback } from 'react';
import { useActionQuery, useActionMutation } from '@tensaw/actions';
import type { CaseDetail } from '../../actions/schemas-v4';
import type { CategoriesResponse } from '../../actions/schemas-v4-tabs';
import {
  categoryLabel,
  categoryColor,
} from '../../lib/labels';
import { formatConfidence } from '../../utils/formatters';
import { WorkflowProgressStrip } from './WorkflowProgressStrip';
import { OverrideDialog } from './OverrideDialog';

export interface ProposedViewProps {
  case: CaseDetail;
  /** Whether the caller has the denial.classify permission (Re-classify button). */
  canReclassify?: boolean;
}

export function ProposedView({
  case: c,
  canReclassify = false,
}: ProposedViewProps): React.ReactElement {
  const { data: catData } = useActionQuery<CategoriesResponse>('category.list', {});
  const [fireAccept, { isLoading: acceptPending, error: acceptError }] =
    useActionMutation('case.accept');
  const [fireReclassify, { isLoading: reclassifyPending }] =
    useActionMutation('case.reclassify');

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Look up workflow step labels for the preview
  const recommendedCategoryDef =
    catData?.categories?.find((c2) => c2.code === c.recommended_category) ?? null;
  const workflowSteps =
    recommendedCategoryDef?.workflow_step_labels ?? [];
  const workflowName = recommendedCategoryDef?.workflow_name;

  const handleAccept = useCallback(async () => {
    setActionError(null);
    try {
      await fireAccept({ case_id: c.case_id });
      // case.detail query invalidates automatically; pane re-renders
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Accept failed');
    }
  }, [c.case_id, fireAccept]);

  const handleReclassify = useCallback(async () => {
    setActionError(null);
    try {
      await fireReclassify({ case_id: c.case_id });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Re-classify failed');
    }
  }, [c.case_id, fireReclassify]);

  const displayError = actionError ?? acceptError?.message ?? null;
  const dotColor = categoryColor(c.recommended_category);
  const isPending = acceptPending || reclassifyPending;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* LLM Recommendation Card */}
        <section
          aria-labelledby="rec-heading"
          className="
            rounded-lg border border-blue-200 bg-blue-50/40 p-4
          "
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3
              id="rec-heading"
              className="text-[11px] font-semibold uppercase tracking-wider text-blue-700"
            >
              LLM recommendation
            </h3>
            <span className="text-[10.5px] text-slate-500">
              {c.classified_at !== null && (
                <>
                  Classified{' '}
                  {new Date(c.classified_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </>
              )}
            </span>
          </div>

          <div className="flex items-baseline gap-3 mb-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
              style={{ background: dotColor }}
            />
            <span className="text-lg font-semibold text-slate-900">
              {categoryLabel(c.recommended_category)}
            </span>
            {c.recommended_confidence !== null && (
              <span className="text-[12px] font-medium text-blue-800">
                {formatConfidence(c.recommended_confidence)} confidence
              </span>
            )}
          </div>

          {c.recommended_reasoning !== null && (
            <p className="text-[12.5px] leading-relaxed text-slate-700">
              {c.recommended_reasoning}
            </p>
          )}

          <div className="mt-3 text-[10.5px] text-slate-500">
            Tool version: <span className="font-mono">{c.tool_version}</span>
          </div>
        </section>

        {/* Workflow preview */}
        {workflowSteps.length > 0 && (
          <section aria-labelledby="preview-heading" className="rounded-lg border border-slate-200 bg-white p-4">
            <h3
              id="preview-heading"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600"
            >
              Recommended workflow
            </h3>
            <p className="mb-2 text-[11.5px] text-slate-500">
              If accepted, the engine starts the{' '}
              <span className="font-mono">{workflowName}</span> workflow.
              These steps will run:
            </p>
            <WorkflowProgressStrip steps={workflowSteps} mode="preview" />
          </section>
        )}

        {/* Error display */}
        {displayError !== null && (
          <div
            role="alert"
            className="
              rounded border border-red-200 bg-red-50 px-3 py-2
              text-[12px] text-red-800
            "
          >
            {displayError}
          </div>
        )}
      </div>

      {/* Sticky action bar at bottom */}
      <div className="
        flex items-center gap-2 border-t border-slate-200 bg-white px-6 py-3
      ">
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending || c.recommended_category === null}
          className="
            inline-flex items-center gap-1.5 rounded-md
            bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white
            hover:bg-emerald-700
            focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <CheckIcon />
          {acceptPending ? 'Accepting…' : 'Accept recommendation'}
        </button>

        <button
          type="button"
          onClick={() => setOverrideOpen(true)}
          disabled={isPending}
          className="
            inline-flex items-center gap-1.5 rounded-md
            border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700
            hover:bg-slate-50
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <ArrowIcon />
          Override…
        </button>

        {canReclassify && (
          <button
            type="button"
            onClick={handleReclassify}
            disabled={isPending}
            title="Re-run the LLM classifier (manager-only)"
            className="
              ml-auto inline-flex items-center gap-1
              rounded px-2.5 py-1.5 text-[12px] font-medium text-slate-600
              hover:bg-slate-100 hover:text-slate-900
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            <RefreshIcon />
            {reclassifyPending ? 'Re-classifying…' : 'Re-classify'}
          </button>
        )}
      </div>

      {overrideOpen && (
        <OverrideDialog
          caseId={c.case_id}
          recommendedCategory={c.recommended_category}
          onClose={() => setOverrideOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Inline icons
// ============================================================================

function CheckIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M11.5 4.5A5 5 0 1 0 12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.5 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
