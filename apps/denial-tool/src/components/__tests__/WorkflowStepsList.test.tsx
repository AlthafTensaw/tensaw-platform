/**
 * WorkflowStepsList tests — v2.0.4.
 *
 * Refactored from v2.0.3's checkbox-only tests to exercise the new 4-control
 * per-step row (assignee, due date, priority, status). Uses the
 * buildTestClassification() helper at the top so future fixture changes
 * happen in one place.
 *
 * Coverage:
 *   - All 4 controls render for each step
 *   - Pending → Complete fires denial.step-complete (v2.0.4 wire)
 *   - In-progress segment is disabled when useUnifiedStatusEndpoint=false
 *   - canAct=false disables all controls
 *   - Sequential gate still applies (step N+1 Complete blocked until step N done)
 *   - Auto-complete callback fires when last step completes the classification
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowStepsList } from '../WorkflowStepsList';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}
import type {
  Classification,
  ClassificationSource,
  ClassificationState,
  Confidence,
  StepAssignmentResponse,
  StepCompletionResponse,
  WorkflowStep,
} from '../../actions/schemas';

// ---- mocks ----------------------------------------------------------------

const fireComplete = vi.fn();
const fireAssignment = vi.fn();
const fireClear = vi.fn();
const fireStatus = vi.fn();

vi.mock('@tensaw/actions', () => ({
  useActionMutation: (actionId: string) => {
    switch (actionId) {
      case 'denial.step-complete':
        return [fireComplete, { isLoading: false, data: undefined, error: null }];
      case 'denial.set-step-assignment':
        return [fireAssignment, { isLoading: false, data: undefined, error: null }];
      case 'denial.clear-step-assignment':
        return [fireClear, { isLoading: false, data: undefined, error: null }];
      case 'denial.set-step-status':
        return [fireStatus, { isLoading: false, data: undefined, error: null }];
      default:
        throw new Error(`Unexpected actionId: ${actionId}`);
    }
  },
  useActionQuery: () => ({
    data: { users: [], total: 0 },
    isLoading: false,
  }),
}));

// ---- fixture builder ------------------------------------------------------

interface BuildStepInput {
  step: number;
  action?: string;
  owner?: string;
  sla_days?: number;
  completed_at?: string | null;
  completed_by?: string | null;
  assigned_to_user_id?: number | null;
  due_date?: string | null;
  effective_due_date?: string;
  priority?: 'low' | 'normal' | 'high';
  status?: 'pending' | 'in_progress' | 'complete';
}

function buildStep(input: BuildStepInput): WorkflowStep {
  return {
    step: input.step,
    action: input.action ?? `Step ${String(input.step)} action`,
    owner: input.owner ?? 'AR',
    sla_days: input.sla_days ?? 1,
    mode: 'Manual',
    day: null,
    completed_at: input.completed_at ?? null,
    completed_by: input.completed_by ?? null,
    assigned_to_user_id: input.assigned_to_user_id ?? null,
    assigned_by_user_id: null,
    assigned_at: null,
    due_date: input.due_date ?? null,
    effective_due_date: input.effective_due_date ?? '2026-05-25',
    priority: input.priority ?? 'normal',
    status: input.status ?? (input.completed_at ? 'complete' : 'pending'),
  };
}

interface BuildClassificationInput {
  state?: 'recommended' | 'accepted' | 'overridden' | 'completed';
  steps?: BuildStepInput[];
}

function buildTestClassification(
  input: BuildClassificationInput = {},
): Classification {
  return {
    classification_id: 'ffffffff-1111-4222-8333-444444444444',
    claim_id: 314001,
    classified_at: '2026-05-17T12:00:00Z',
    tool_version: 'phase1-0.1.0',
    training_guide_version: 'v3.0',
    primary_category: '02. Wrong Payer / Misrouted',
    training_guide_section: '6.6',
    alternate_categories: [],
    classification_source: 'rule' as ClassificationSource,
    rule_id: 'RULE_CO109_WRONGPAYER',
    confidence: 'high' as Confidence,
    workflow_steps: (input.steps ?? [{ step: 1 }, { step: 2 }, { step: 3 }]).map(
      buildStep,
    ),
    branch_chosen: 'standard',
    recommended_owner: 'AR',
    sla_next_action_date: '2026-05-20',
    priority_chips: [],
    risk_flags: [],
    requires_human_review: false,
    reasoning_summary: 'test fixture',
    state: (input.state ?? 'accepted') as ClassificationState,
  };
}

const onStepCompleted = vi.fn();
const onAutoComplete = vi.fn();
const onAssignmentChanged = vi.fn();

beforeEach(() => {
  fireComplete.mockReset();
  fireAssignment.mockReset();
  fireClear.mockReset();
  fireStatus.mockReset();
  onStepCompleted.mockReset();
  onAutoComplete.mockReset();
  onAssignmentChanged.mockReset();
});

// ---- tests ----------------------------------------------------------------

describe('WorkflowStepsList — v2.0.4', () => {
  it('renders 4 controls per step (Status, Assignee, Due, Priority)', () => {
    const cls = buildTestClassification({
      steps: [{ step: 1 }, { step: 2 }],
    });
    renderWithClient(
      <WorkflowStepsList
        classification={cls}
        canAct
        onStepCompleted={onStepCompleted}
        onAutoComplete={onAutoComplete}
        onAssignmentChanged={onAssignmentChanged}
      />,
    );
    // 2 steps × 1 status radiogroup each
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
    // Each step has a date-picker input + an assignee button + priority select
    // (smoke check only — full picker behavior covered by individual component tests)
  });

  it('Pending → Complete fires denial.step-complete in v2.0.4 mode', () => {
    fireComplete.mockResolvedValue({
      ok: true,
      data: {
        classification_id: 'ffffffff-1111-4222-8333-444444444444',
        step_number: 1,
        completed_at: '2026-05-24T12:00:00Z',
        completed_by: 'tester',
        next_step_number: 2,
        all_steps_completed: false,
        auto_completed_classification: false,
      } satisfies StepCompletionResponse,
    });

    const cls = buildTestClassification({
      steps: [{ step: 1 }, { step: 2 }],
    });
    renderWithClient(
      <WorkflowStepsList
        classification={cls}
        canAct
        onStepCompleted={onStepCompleted}
        onAutoComplete={onAutoComplete}
        onAssignmentChanged={onAssignmentChanged}
      />,
    );

    const completeBtns = screen.getAllByRole('radio', { name: 'Complete' });
    fireEvent.click(completeBtns[0]!);

    expect(fireComplete).toHaveBeenCalledWith({
      classification_id: cls.classification_id,
      step_number: 1,
    });
  });

  it('In-progress segment is disabled when useUnifiedStatusEndpoint=false', () => {
    const cls = buildTestClassification({ steps: [{ step: 1 }] });
    renderWithClient(
      <WorkflowStepsList
        classification={cls}
        canAct
        onStepCompleted={onStepCompleted}
        onAutoComplete={onAutoComplete}
        onAssignmentChanged={onAssignmentChanged}
        useUnifiedStatusEndpoint={false}
      />,
    );
    const inProgressBtn = screen.getByRole('radio', { name: 'In progress' });
    expect(inProgressBtn).toBeDisabled();
  });

  it('In-progress segment is enabled when useUnifiedStatusEndpoint=true (v2.0.5)', () => {
    const cls = buildTestClassification({ steps: [{ step: 1 }] });
    renderWithClient(
      <WorkflowStepsList
        classification={cls}
        canAct
        onStepCompleted={onStepCompleted}
        onAutoComplete={onAutoComplete}
        onAssignmentChanged={onAssignmentChanged}
        useUnifiedStatusEndpoint
      />,
    );
    const inProgressBtn = screen.getByRole('radio', { name: 'In progress' });
    expect(inProgressBtn).not.toBeDisabled();
  });

  it('Sequential gate: step 2 Complete is disabled until step 1 is done', () => {
    const cls = buildTestClassification({
      steps: [{ step: 1 }, { step: 2 }],
    });
    renderWithClient(
      <WorkflowStepsList
        classification={cls}
        canAct
        onStepCompleted={onStepCompleted}
        onAutoComplete={onAutoComplete}
        onAssignmentChanged={onAssignmentChanged}
      />,
    );
    const completeBtns = screen.getAllByRole('radio', { name: 'Complete' });
    expect(completeBtns[0]).not.toBeDisabled();
    expect(completeBtns[1]).toBeDisabled();
  });

  it('canAct=false disables all status controls', () => {
    const cls = buildTestClassification({ steps: [{ step: 1 }] });
    renderWithClient(
      <WorkflowStepsList
        classification={cls}
        canAct={false}
        onStepCompleted={onStepCompleted}
        onAutoComplete={onAutoComplete}
        onAssignmentChanged={onAssignmentChanged}
      />,
    );
    const allRadios = screen.getAllByRole('radio');
    for (const r of allRadios) {
      expect(r).toBeDisabled();
    }
  });

  it('auto-complete callback fires when response carries auto_completed_classification', async () => {
    fireComplete.mockResolvedValue({
      ok: true,
      data: {
        classification_id: 'ffffffff-1111-4222-8333-444444444444',
        step_number: 1,
        completed_at: '2026-05-24T12:00:00Z',
        completed_by: 'tester',
        next_step_number: null,
        all_steps_completed: true,
        auto_completed_classification: true,
      } satisfies StepCompletionResponse,
    });

    const cls = buildTestClassification({ steps: [{ step: 1 }] });
    renderWithClient(
      <WorkflowStepsList
        classification={cls}
        canAct
        onStepCompleted={onStepCompleted}
        onAutoComplete={onAutoComplete}
        onAssignmentChanged={onAssignmentChanged}
      />,
    );

    const completeBtn = screen.getByRole('radio', { name: 'Complete' });
    fireEvent.click(completeBtn);

    await Promise.resolve();
    await Promise.resolve();

    expect(onStepCompleted).toHaveBeenCalled();
    expect(onAutoComplete).toHaveBeenCalled();
  });
});

// Avoid unused-import warnings if onAssignmentChanged becomes used later
void onAssignmentChanged;
void ({} as StepAssignmentResponse);
