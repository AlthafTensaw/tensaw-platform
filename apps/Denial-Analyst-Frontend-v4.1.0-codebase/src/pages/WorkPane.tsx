/**
 * WorkPane (v4.1) — middle-pane work area for the engine-handler model.
 *
 * The big rework from v4.0.0: there is NO Proposed/InFlight/Completed branching
 * and NO case_status. The model is always-active-task:
 *
 *   1. ?case=<case_id> selects a case.
 *   2. case.detail → state_code, open_task_ids, LLM rec, financials.
 *   3. The active task = open_task_ids[0]; worklist.task fetches it for its
 *      task_type (which selects the completion form).
 *   4. Render: header + current-state strip + LLM-rec context + the active
 *      task's completion form.
 *   5. If there are no open tasks, render a read-only resolved view (the case
 *      has left the worklist; reopen UX is deferred — revision fork F-5).
 *
 * "Accepting the LLM rec" no longer exists as a discrete step — it's folded
 * into completing ANALYST_TRIAGE_DENIAL.
 *
 * Drop-in path: src/pages/WorkPane.tsx
 */

import { useSearchParams } from 'react-router-dom';
import { useActionQuery } from '@tensaw/actions';
import { WorkPaneHeader } from '../components/work-pane/WorkPaneHeader';
import { CurrentStateStrip } from '../components/work-pane/CurrentStateStrip';
import { LlmRecContext } from '../components/work-pane/LlmRecContext';
import { CurrentTaskBlock } from '../components/task-form/CurrentTaskBlock';

export function WorkPane(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get('case');

  // No case selected → placeholder.
  if (caseId === null) {
    return <NoSelection />;
  }

  return <WorkPaneForCase caseId={caseId} />;
}

function WorkPaneForCase({ caseId }: { caseId: string }): React.ReactElement {
  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useActionQuery('case.detail', { case_id: caseId });

  const activeTaskId = detail?.open_task_ids[0] ?? null;

  // Fetch the active task (for its task_type → form). Skips when none open.
  const { data: activeTask } = useActionQuery(
    'worklist.task',
    activeTaskId !== null ? { task_id: activeTaskId } : {},
  );

  if (detailLoading && detail === undefined) {
    return <PaneMessage title="Loading case…" />;
  }
  if (detailError !== null && detail === undefined) {
    return (
      <PaneMessage
        title="Couldn't load case"
        body={detailError.message}
        tone="error"
        onRetry={refetchDetail}
      />
    );
  }
  if (detail === undefined) {
    return <PaneMessage title="Case not found" tone="error" />;
  }

  const hasActiveTask = activeTaskId !== null && activeTask !== undefined;

  return (
    <section aria-label="Work area" className="flex h-full flex-col overflow-hidden bg-white">
      <WorkPaneHeader detail={detail} />
      <CurrentStateStrip
        activeTaskType={activeTask?.task_type ?? null}
        activeTeam={activeTask?.team ?? null}
        stateCode={detail.state_code}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-4">
          <LlmRecContext detail={detail} />
        </div>

        {hasActiveTask ? (
          <CurrentTaskBlock task={activeTask} onCompleted={refetchDetail} />
        ) : (
          <ResolvedReadOnly />
        )}
      </div>
    </section>
  );
}

// ============================================================================
// States
// ============================================================================

function NoSelection(): React.ReactElement {
  return (
    <section
      aria-label="Work area"
      className="flex h-full items-center justify-center bg-white px-6 text-center"
    >
      <div className="max-w-xs">
        <div className="text-[13px] font-medium text-slate-700">No case selected</div>
        <p className="mt-1 text-[11.5px] text-slate-500">
          Pick a task from the worklist to start working it.
        </p>
      </div>
    </section>
  );
}

function ResolvedReadOnly(): React.ReactElement {
  return (
    <div className="px-6 py-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
        <div className="text-[13px] font-semibold text-slate-900">No active task</div>
        <p className="mt-1 text-[12px] text-slate-600">
          This case has no task dispatched to a worklist right now — it's resolved or waiting on an
          automated step. Notes and history remain available in the right pane.
        </p>
      </div>
    </div>
  );
}

interface PaneMessageProps {
  title: string;
  body?: string;
  tone?: 'error';
  onRetry?: () => void;
}

function PaneMessage({ title, body, tone, onRetry }: PaneMessageProps): React.ReactElement {
  return (
    <section
      aria-label="Work area"
      className="flex h-full items-center justify-center bg-white px-6 text-center"
    >
      <div className="max-w-xs">
        <div className={`text-[13px] font-medium ${tone === 'error' ? 'text-red-700' : 'text-slate-700'}`}>
          {title}
        </div>
        {body !== undefined && <p className="mt-1 text-[11.5px] text-slate-500">{body}</p>}
        {onRetry !== undefined && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700"
          >
            Retry
          </button>
        )}
      </div>
    </section>
  );
}
