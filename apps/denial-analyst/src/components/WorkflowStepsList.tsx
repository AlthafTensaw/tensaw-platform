/**
 * WorkflowStepsList — per-step checkboxes with sequential UX.
 *
 * PR-7 fixes:
 *   - Step-complete mutation request: { classification_id, step_number }
 *     (snake_case top-level so the dispatcher substitutes both into
 *     POST /v1/classifications/{classification_id}/steps/{step_number}/complete).
 *     Bug #14 / #11.
 *   - Platform Icon component with Lucide PascalCase names (Check,
 *     ArrowRight) instead of Tabler kebab-case via raw <i>.
 *   - Token rewrites (text-muted-foreground → text-muted-foreground, etc.).
 */

import { useState } from 'react';
import { Checkbox } from '@tensaw/design-system/primitives';
import { Icon } from '@tensaw/design-system/primitives';
import { Tooltip } from '@tensaw/design-system/overlays';
import { Alert } from '@tensaw/design-system/feedback';
import { useActionMutation } from '@tensaw/actions';
import type {
  Classification,
  StepCompletionResponse,
  WorkflowStep,
  ClassificationState,
} from '../actions/schemas';
import { usePermissions } from '../auth/permissions';
import { friendlyErrorMessage } from '../lib/problem';

interface WorkflowStepsListProps {
  classification?: Classification;
  canAct?: boolean;
  onStepCompleted?: (resp: StepCompletionResponse) => void;
  onAutoComplete?: () => void;

  // Test-only props
  classificationId?: string;
  state?: ClassificationState;
  steps?: WorkflowStep[];
}

function formatRelative(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WorkflowStepsList({
  classification,
  canAct: canActProp,
  onStepCompleted,
  onAutoComplete,
  classificationId: classificationIdProp,
  state: stateProp,
  steps: stepsProp,
}: WorkflowStepsListProps) {
  const { has } = usePermissions();
  const steps = stepsProp ?? classification?.workflow_steps ?? [];
  const classificationId = classificationIdProp ?? classification?.classification_id ?? '';
  const state = stateProp ?? classification?.state ?? 'recommended';
  const recommendedOwner = classification?.recommended_owner ?? '';
  const canAct = canActProp ?? has('denial.act');

  const [errorBanner, setErrorBanner] = useState<{ step: number; message: string } | null>(null);

  // PR-7: flat snake_case request shape so the dispatcher substitutes
  // both classification_id and step_number into the URL template.
  const [fireStep, { isLoading: stepLoading }] = useActionMutation<
    { classification_id: string; step_number: number; notes?: string },
    StepCompletionResponse
  >('denial.step-complete');

  const handleCheck = (step: WorkflowStep) => {
    if (!canAct || step.completed_at) return;
    setErrorBanner(null);
    fireStep({
      classification_id: classificationId,
      step_number: step.step,
    })
      .then((resp) => {
        if (resp.ok) {
          onStepCompleted?.(resp.data);
          if (resp.data.auto_completed_classification) onAutoComplete?.();
        } else {
          setErrorBanner({
            step: step.step,
            message: resp.error.message || 'Action failed',
          });
        }
      })
      .catch((err: unknown) => {
        setErrorBanner({
          step: step.step,
          message: friendlyErrorMessage(err),
        });
      });
  };

  if (steps.length === 0) {
    return (
      <Alert variant="info">
        No workflow steps defined for this category yet.
      </Alert>
    );
  }

  const firstIncomplete = steps.find((s) => !s.completed_at);
  const allComplete = steps.length > 0 && steps.every((s) => s.completed_at);
  const hintForState =
    state === 'completed'
      ? 'Already completed.'
      : state === 'recommended'
        ? allComplete
          ? 'All steps marked done. Accept or override the classification to record completion.'
          : 'Accept or override the recommendation before marking steps complete.'
        : !canAct
          ? 'Read-only — your role does not allow workflow actions.'
          : null;

  return (
    <div className="flex flex-col gap-2">
      {errorBanner && (
        <Alert
          variant="error"
          title={`Step ${errorBanner.step} failed`}
          dismissible
          onDismiss={() => { setErrorBanner(null); }}
        >
          {errorBanner.message}
        </Alert>
      )}
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Recommended action plan ·{' '}
          {steps.filter((s) => s.completed_at).length} of {steps.length} done
        </span>
        <span className="text-xs text-muted-foreground">
          Owner: {recommendedOwner} · SLA{' '}
          <span className="text-amber-600">{steps[0]?.sla_days ?? 0}d</span>
        </span>
      </div>

      {steps.map((step) => {
        const isDone = !!step.completed_at;
        const isNext = !isDone && step === firstIncomplete;
        const isClickable = canAct && isNext && !stepLoading && state !== 'recommended';

        const row = (
          <div
            key={step.step}
            className={[
              'flex items-start gap-2.5 px-3 py-2 rounded-md',
              isDone
                ? 'bg-muted opacity-70'
                : isNext
                  ? 'bg-teal-50 border-l-4 border-teal-700'
                  : 'bg-card border border-border opacity-60',
            ].join(' ')}
          >
            <Checkbox
              checked={isDone}
              disabled={!isClickable}
              onCheckedChange={() => { handleCheck(step); }}
              aria-label={`Mark step ${step.step} complete: ${step.action}`}
            />
            <div className="flex-1 text-sm">
              <div
                className={
                  isDone
                    ? 'line-through text-muted-foreground'
                    : 'font-medium text-foreground'
                }
              >
                {step.action}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                {isDone ? (
                  <>
                    <Icon name="Check" size="xs" className="text-teal-700" />
                    {step.completed_by ?? 'someone'} ·{' '}
                    {step.completed_at
                      ? formatRelative(step.completed_at)
                      : ''}
                  </>
                ) : (
                  <>
                    {isNext ? (
                      <>
                        <Icon name="ArrowRight" size="xs" /> Next action ·
                      </>
                    ) : null}
                    {step.owner} · {step.sla_days} day SLA
                  </>
                )}
              </div>
            </div>
          </div>
        );

        return isClickable ? (
          row
        ) : (
          <Tooltip
            key={step.step}
            content={
              isDone
                ? 'Completed'
                : !canAct
                  ? 'Read-only'
                  : 'Complete earlier steps first'
            }
          >
            {row}
          </Tooltip>
        );
      })}

      {hintForState ? (
        <Alert variant="info" className="mt-1">
          {hintForState}
        </Alert>
      ) : null}
    </div>
  );
}
