/**
 * LlmRecContext (v4.1) — the LLM recommendation shown as CONTEXT, not a gate.
 *
 * v4.0.0 rendered the recommendation inside a ProposedView with Accept/Override
 * buttons that STARTED a workflow. In the engine-handler model the workflow is
 * already running and the analyst completes the dispatched task — so the
 * recommendation is reference material shown alongside the active task's form,
 * with no accept/override affordance.
 *
 * Renders null when the case was never classified.
 *
 * Drop-in path: src/components/work-pane/LlmRecContext.tsx
 */

import type { CaseDetail } from '../../actions/schemas';

export interface LlmRecContextProps {
  detail: CaseDetail;
}

export function LlmRecContext({ detail }: LlmRecContextProps): React.ReactElement | null {
  if (detail.recommended_category === null) return null;

  const pct =
    detail.recommended_confidence !== null
      ? `${Math.round(detail.recommended_confidence * 100)}%`
      : null;

  return (
    <section
      aria-label="LLM recommendation"
      className="rounded-lg border border-blue-200 bg-blue-50/40 p-3"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden="true" />
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-blue-700">
          LLM recommendation · context
        </span>
        {pct !== null && (
          <span className="ml-auto font-mono text-[11px] text-blue-800">{pct}</span>
        )}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-slate-900">
        {detail.recommended_category}
      </div>
      {detail.recommended_reasoning !== null && (
        <p className="mt-1.5 border-t border-blue-100 pt-2 text-[12px] leading-relaxed text-slate-700">
          {detail.recommended_reasoning}
        </p>
      )}
      <p className="mt-1.5 text-[10.5px] italic text-slate-500">
        Reference only — complete the active task below to advance the case.
      </p>
    </section>
  );
}
