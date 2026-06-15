/**
 * CurrentStateStrip (v4.1) — the reduced workflow indicator (revision fork F-3).
 *
 * v4.0.0 had a WorkflowProgressStrip rendering a fixed N-step workflow preview.
 * The engine-handler model has no fixed workflow to preview — the engine routes
 * dynamically team→team — so this collapses to a single CURRENT-STATE indicator:
 * what task is active, on which team, at what engine state. No step count, no
 * future-step prediction.
 *
 * Drop-in path: src/components/work-pane/CurrentStateStrip.tsx
 */

import type { TaskType, Team } from '../../actions/schemas';
import { TEAM_LABELS } from '../../actions/schemas';
import { TASK_TYPE_LABELS } from '../../lib/labels';

export interface CurrentStateStripProps {
  /** Active task type (null when the case has no open task). */
  activeTaskType: TaskType | null;
  /** Team the active task is dispatched to. */
  activeTeam: Team | null;
  /** Engine state code (display-only). */
  stateCode: string | null;
}

export function CurrentStateStrip({
  activeTaskType,
  activeTeam,
  stateCode,
}: CurrentStateStripProps): React.ReactElement {
  const resolved = stateCode === 'RESOLVED' || activeTaskType === null;

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-6 py-2">
      <span className="text-[10.5px] uppercase tracking-wider text-slate-500">Current</span>
      {resolved ? (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
          <DotIcon className="text-emerald-500" />
          Resolved — no active task
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-[12px]">
          <DotIcon className="text-blue-500" />
          <span className="font-medium text-slate-900">
            {activeTaskType !== null ? TASK_TYPE_LABELS[activeTaskType] : '—'}
          </span>
          {activeTeam !== null && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10.5px] text-slate-600">
              {TEAM_LABELS[activeTeam]}
            </span>
          )}
          {stateCode !== null && (
            <span className="font-mono text-[10.5px] text-slate-400">{stateCode}</span>
          )}
        </span>
      )}
    </div>
  );
}

function DotIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className={className}>
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  );
}
