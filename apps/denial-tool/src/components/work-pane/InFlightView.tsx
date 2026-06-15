/**
 * InFlightView — shown when case_status is 'accepted' or 'overridden'.
 *
 * P1.8 update: replaces the P1.7 placeholder with real CurrentTaskBlock
 * rendering. The workflow progress strip at top still shows the case's
 * position in its workflow; CurrentTaskBlock below shows the form for the
 * open task with outcome-coded action bar.
 *
 * Drop-in path: src/components/work-pane/InFlightView.tsx
 */

import { useActionQuery } from '@tensaw/actions';
import type { CaseDetail } from '../../actions/schemas-v4';
import type { CategoriesResponse } from '../../actions/schemas-v4-tabs';
import { taskTypeLabel } from '../../lib/labels';
import { WorkflowProgressStrip } from './WorkflowProgressStrip';
import { CurrentTaskBlock } from '../task-form/CurrentTaskBlock';

export interface InFlightViewProps {
  case: CaseDetail;
}

export function InFlightView({ case: c }: InFlightViewProps): React.ReactElement {
  const { data: catData } = useActionQuery<CategoriesResponse>('category.list', {});
  const workflowDef = catData?.categories?.find(
    (cat) => cat.workflow_name === c.workflow_name,
  );
  const workflowSteps = workflowDef?.workflow_step_labels ?? [];

  const currentTask = c.engine_tasks_open[0] ?? null;
  const currentIndex = currentTask !== null
    ? workflowSteps.findIndex((label) =>
        label.toLowerCase().replace(/[^a-z]/g, '') ===
        taskTypeLabel(currentTask.task_type).toLowerCase().replace(/[^a-z]/g, ''),
      )
    : -1;

  return (
    <div className="flex h-full flex-col">
      {/* Workflow progress strip — context at top */}
      {workflowSteps.length > 0 && (
        <section
          aria-labelledby="progress-heading"
          className="border-b border-slate-200 bg-slate-50 px-6 py-3"
        >
          <h3
            id="progress-heading"
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Workflow progress
            <span className="ml-2 font-mono normal-case text-slate-400">
              {c.workflow_name}
            </span>
          </h3>
          <WorkflowProgressStrip
            steps={workflowSteps}
            mode="progress"
            currentIndex={Math.max(currentIndex, 0)}
          />
        </section>
      )}

      {/* Current task block — the form */}
      <div className="flex-1 overflow-hidden">
        {currentTask !== null ? (
          <CurrentTaskBlock case={c} task={currentTask} />
        ) : (
          <NoOpenTasksView />
        )}
      </div>
    </div>
  );
}

function NoOpenTasksView(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12">
      <div className="
        max-w-md rounded-lg border border-slate-200 bg-slate-50 px-4 py-6
        text-center text-[12.5px] text-slate-600
      ">
        <p className="font-medium text-slate-800">No open tasks on this case.</p>
        <p className="mt-1 text-slate-500">
          The workflow may have completed or be waiting on an external signal
          (e.g. a payer response). Check the Notes tab for system events.
        </p>
      </div>
    </div>
  );
}
