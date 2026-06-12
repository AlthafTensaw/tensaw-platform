/**
 * AnalysisTab — read-only LLM classification analysis details.
 *
 * Pulls from the case.detail data already in cache (no separate query needed).
 * Shows: recommended category, confidence, reasoning, classified_at,
 * tool_version, and any override metadata if case_status='overridden'.
 *
 * Drop-in path: src/components/reference-panel/AnalysisTab.tsx
 */

import type { CaseDetail } from '../../actions/schemas-v4';
import { categoryLabel, categoryColor } from '../../lib/labels';
import { formatConfidence } from '../../utils/formatters';

export interface AnalysisTabProps {
  case: CaseDetail;
}

export function AnalysisTab({ case: c }: AnalysisTabProps): React.ReactElement {
  const dotColor = categoryColor(c.recommended_category);

  return (
    <div className="space-y-4 px-4 py-4">
      {/* LLM Recommendation block */}
      <section
        aria-labelledby="analysis-rec-heading"
        className="rounded-lg border border-blue-200 bg-blue-50/40 p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: dotColor }}
          />
          <h3
            id="analysis-rec-heading"
            className="text-[11px] font-semibold uppercase tracking-wider text-blue-700"
          >
            LLM classification
          </h3>
        </div>

        <dl className="space-y-1.5 text-[12.5px]">
          <Row label="Recommended">
            <span className="font-medium text-slate-900">
              {categoryLabel(c.recommended_category)}
            </span>
          </Row>
          {c.recommended_confidence !== null && (
            <Row label="Confidence">
              <span className="font-medium text-blue-800 tabular-nums">
                {formatConfidence(c.recommended_confidence)}
              </span>
            </Row>
          )}
          {c.classified_at !== null && (
            <Row label="Classified at">
              <span className="text-slate-700">
                {new Date(c.classified_at).toLocaleString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </Row>
          )}
          <Row label="Tool version">
            <span className="font-mono text-[11.5px] text-slate-700">
              {c.tool_version}
            </span>
          </Row>
        </dl>

        {c.recommended_reasoning !== null && (
          <div className="mt-3 border-t border-blue-100 pt-3">
            <div className="mb-1 text-[10.5px] uppercase tracking-wider text-blue-700">
              Reasoning
            </div>
            <p className="text-[12.5px] leading-relaxed text-slate-700">
              {c.recommended_reasoning}
            </p>
          </div>
        )}
      </section>

      {/* Workflow status */}
      {c.workflow_name !== null && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Workflow
          </h3>
          <dl className="space-y-1.5 text-[12.5px]">
            <Row label="Name">
              <span className="font-mono text-[11.5px] text-slate-700">
                {c.workflow_name}
              </span>
            </Row>
            {c.engine_state_code !== null && (
              <Row label="State">
                <span className="font-mono text-[11.5px] text-slate-700">
                  {c.engine_state_code}
                </span>
              </Row>
            )}
            <Row label="Status">
              <span className="text-slate-700 capitalize">{c.case_status}</span>
            </Row>
          </dl>
        </section>
      )}

      {/* Override / acceptance metadata */}
      {(c.case_status === 'accepted' || c.case_status === 'overridden') && c.originated_by_user_name !== null && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            {c.case_status === 'overridden' ? 'Override' : 'Acceptance'}
          </h3>
          <dl className="space-y-1.5 text-[12.5px]">
            <Row label="By">
              <span className="text-slate-700">{c.originated_by_user_name}</span>
            </Row>
            {c.originated_at !== null && (
              <Row label="At">
                <span className="text-slate-700">
                  {new Date(c.originated_at).toLocaleString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </span>
              </Row>
            )}
            <p className="mt-2 text-[11.5px] text-slate-500">
              {c.case_status === 'overridden'
                ? 'See the Notes tab for the override reasoning recorded at the time of acceptance.'
                : 'Recommendation accepted; engine workflow started automatically.'}
            </p>
          </dl>
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="min-w-[6.5rem] flex-shrink-0 text-[10.5px] uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="flex-1 break-words">{children}</dd>
    </div>
  );
}
