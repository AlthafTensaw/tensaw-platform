/**
 * CompletedView — shown when case_status='completed'.
 *
 * Workflow strip with all steps marked complete, summary metadata, and
 * (optionally) the most recent system note describing the resolution.
 *
 * Drop-in path: src/components/work-pane/CompletedView.tsx
 */

import { useActionQuery } from '@tensaw/actions';
import type { CaseDetail } from '../../actions/schemas-v4';
import type { CategoriesResponse } from '../../actions/schemas-v4-tabs';
import { WorkflowProgressStrip } from './WorkflowProgressStrip';

export interface CompletedViewProps {
  case: CaseDetail;
}

export function CompletedView({ case: c }: CompletedViewProps): React.ReactElement {
  const { data: catData } = useActionQuery<CategoriesResponse>('category.list', {});
  const workflowDef = catData?.categories?.find(
    (cat) => cat.workflow_name === c.workflow_name,
  );
  const workflowSteps = workflowDef?.workflow_step_labels ?? [];

  // For a completed workflow, "currentIndex" sits past the last step — every
  // step shows as completed.
  const currentIndex = workflowSteps.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div
          role="status"
          className="
            flex items-center gap-3 rounded-lg border border-emerald-200
            bg-emerald-50 px-4 py-3
          "
        >
          <CheckmarkIcon />
          <div className="flex-1">
            <div className="text-sm font-semibold text-emerald-900">
              Case completed
            </div>
            <div className="mt-0.5 text-[12px] text-emerald-800">
              Updated{' '}
              {new Date(c.updated_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        {workflowSteps.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Workflow ({c.workflow_name})
            </h3>
            <WorkflowProgressStrip
              steps={workflowSteps}
              mode="progress"
              currentIndex={currentIndex}
            />
          </section>
        )}

        {/* Recent task summary */}
        {c.engine_tasks_recent.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Recent tasks
            </h3>
            <ul className="space-y-1 text-[12px] text-slate-700">
              {c.engine_tasks_recent.slice(0, 5).map((t) => (
                <li key={t.task_id} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-emerald-600">✓</span>
                  <span>{t.task_type.replace(/_/g, ' ')}</span>
                  <span className="ml-auto text-[10.5px] text-slate-500">
                    {new Date(t.opened_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function CheckmarkIcon(): React.ReactElement {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="flex-shrink-0">
      <circle cx="14" cy="14" r="11" fill="#10b981" />
      <path d="M9 14l3.5 3.5L19 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
