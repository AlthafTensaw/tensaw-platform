/**
 * WorkflowProgressStrip — horizontal step indicator.
 *
 * Two modes:
 *   - `preview`  : all steps dashed, no "current" marker. Used in ProposedView
 *                  to show what would happen if Accept were clicked.
 *   - `progress` : steps before `currentIndex` filled, currentIndex highlighted
 *                  with a ring, steps after dashed. Used in InFlightView.
 *
 * Step labels are passed in from the parent — for proposed views they come
 * from category.list's workflow_step_labels; for in-flight views they'd come
 * from a workflow lookup (P1.8 wires that in).
 *
 * Drop-in path: src/components/work-pane/WorkflowProgressStrip.tsx
 */

export interface WorkflowProgressStripProps {
  /** Step labels in workflow order. */
  steps: string[];
  /** Mode of presentation. */
  mode: 'preview' | 'progress';
  /** Required when mode='progress'. Zero-indexed. */
  currentIndex?: number;
}

export function WorkflowProgressStrip({
  steps,
  mode,
  currentIndex,
}: WorkflowProgressStripProps): React.ReactElement | null {
  if (steps.length === 0) return null;

  return (
    <ol
      aria-label={mode === 'preview' ? 'Workflow preview' : 'Workflow progress'}
      className="flex items-start gap-1 overflow-x-auto py-2"
    >
      {steps.map((label, idx) => {
        const status: 'completed' | 'current' | 'upcoming' | 'preview' =
          mode === 'preview' ? 'preview' :
          currentIndex !== undefined && idx < currentIndex ? 'completed' :
          currentIndex !== undefined && idx === currentIndex ? 'current' :
          'upcoming';

        const isLast = idx === steps.length - 1;

        return (
          <li
            key={`${idx}-${label}`}
            aria-current={status === 'current' ? 'step' : undefined}
            className="flex min-w-0 items-start gap-1 flex-1"
          >
            <div className="flex flex-col items-center min-w-0 flex-shrink-0 w-full">
              <StepCircle status={status} index={idx + 1} />
              <span
                className={`
                  mt-1 max-w-[8rem] text-center text-[10.5px] leading-tight truncate
                  ${status === 'completed' ? 'text-slate-600' : ''}
                  ${status === 'current' ? 'font-semibold text-blue-900' : ''}
                  ${status === 'upcoming' ? 'text-slate-500' : ''}
                  ${status === 'preview' ? 'text-slate-500' : ''}
                `}
                title={label}
              >
                {label}
              </span>
            </div>
            {!isLast && <StepConnector status={status} />}
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================================
// Step circle — different visuals per status
// ============================================================================

interface StepCircleProps {
  status: 'completed' | 'current' | 'upcoming' | 'preview';
  index: number;
}

function StepCircle({ status, index }: StepCircleProps): React.ReactElement {
  if (status === 'completed') {
    return (
      <span
        aria-hidden="true"
        className="
          inline-flex h-5 w-5 items-center justify-center rounded-full
          bg-emerald-600 text-[10px] font-bold text-white
        "
      >
        ✓
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span
        aria-hidden="true"
        className="
          inline-flex h-5 w-5 items-center justify-center rounded-full
          border-2 border-blue-600 bg-white
          text-[10px] font-bold text-blue-700
          ring-2 ring-blue-200
        "
      >
        {index}
      </span>
    );
  }
  // upcoming or preview — both render as dashed
  return (
    <span
      aria-hidden="true"
      className="
        inline-flex h-5 w-5 items-center justify-center rounded-full
        border border-dashed border-slate-400 bg-white
        text-[10px] font-medium text-slate-500
      "
    >
      {index}
    </span>
  );
}

// ============================================================================
// Step connector — line between step circles
// ============================================================================

interface StepConnectorProps {
  status: 'completed' | 'current' | 'upcoming' | 'preview';
}

function StepConnector({ status }: StepConnectorProps): React.ReactElement {
  const className =
    status === 'completed' ? 'bg-emerald-600' :
    status === 'current' ? 'bg-blue-300' :
    'border-t border-dashed border-slate-300 bg-transparent h-0 mt-2.5';

  return (
    <div
      aria-hidden="true"
      className={`
        mt-2.5 h-px flex-shrink-0 w-6
        ${className}
      `}
    />
  );
}
