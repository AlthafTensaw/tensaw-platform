/**
 * P1.8 interaction tests — IntakeTriageForm submission flow.
 *
 * Pattern test for all P1.10 forms. If this works, the same pattern works for
 * CodingReviewForm, ResolutionActionForm, etc.
 *
 * Verifies:
 *   - Category pre-fills from LLM recommendation
 *   - SUCCESS button is disabled until route is picked
 *   - Picking a route enables SUCCESS
 *   - Clicking SUCCESS fires task.complete with the right facts payload
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IntakeTriageForm } from '../src/components/task-form/IntakeTriageForm';
import { __setMutationMock } from '../stubs/tensaw/actions';
import { baseCase, makeTask, setupStandardMocks } from '../src/test/helpers';

describe('IntakeTriageForm — interactions', () => {
  beforeEach(() => {
    setupStandardMocks();
  });

  it('renders with the LLM-recommended category pre-filled', () => {
    render(<IntakeTriageForm case={baseCase} task={makeTask('intake_triage')} />);
    expect(screen.getByLabelText(/category/i)).toHaveValue('medical_necessity');
  });

  it('SUCCESS button is disabled until a route is picked', async () => {
    const user = userEvent.setup();
    render(<IntakeTriageForm case={baseCase} task={makeTask('intake_triage')} />);

    expect(screen.getByRole('button', { name: /complete triage/i })).toBeDisabled();

    // Pick a route in the grid
    await user.click(screen.getByRole('radio', { name: /^Resolution Records on hand/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /complete triage/i })).not.toBeDisabled();
    });
  });

  it('clicking "Complete triage" fires task.complete with the right facts', async () => {
    const taskCompleteSpy = vi.fn().mockResolvedValue({ case: baseCase, next_task: null });
    __setMutationMock('task.complete', taskCompleteSpy);

    const user = userEvent.setup();
    render(<IntakeTriageForm case={baseCase} task={makeTask('intake_triage')} />);

    // Pick a route
    await user.click(screen.getByRole('radio', { name: /^Resolution Records on hand/i }));
    // Click submit
    await user.click(screen.getByRole('button', { name: /complete triage/i }));

    await waitFor(() => {
      expect(taskCompleteSpy).toHaveBeenCalled();
    });

    // Verify the call payload — should have outcome=SUCCESS and proper facts
    const call = taskCompleteSpy.mock.calls[0][0];
    expect(call.case_id).toBe('case_000001');
    expect(call.task_id).toBe('eng_t_intake_triage');
    expect(call.outcome).toBe('SUCCESS');
    expect(call.facts_to_set).toMatchObject({
      triage_category: 'medical_necessity',
      priority: 'normal',
      triage_route: 'resolution',
    });
  });

  it('"Needs more info" submits with outcome=NEEDS_INFO', async () => {
    const taskCompleteSpy = vi.fn().mockResolvedValue({ case: baseCase, next_task: null });
    __setMutationMock('task.complete', taskCompleteSpy);

    const user = userEvent.setup();
    render(<IntakeTriageForm case={baseCase} task={makeTask('intake_triage')} />);

    // Pick a route + submit via NEEDS_INFO path
    await user.click(screen.getByRole('radio', { name: /^Resolution Records on hand/i }));
    await user.click(screen.getByRole('button', { name: /needs more info/i }));

    await waitFor(() => {
      expect(taskCompleteSpy).toHaveBeenCalled();
    });
    expect(taskCompleteSpy.mock.calls[0][0].outcome).toBe('NEEDS_INFO');
  });

  it('changing priority via the segmented control updates the facts payload', async () => {
    const taskCompleteSpy = vi.fn().mockResolvedValue({ case: baseCase, next_task: null });
    __setMutationMock('task.complete', taskCompleteSpy);

    const user = userEvent.setup();
    render(<IntakeTriageForm case={baseCase} task={makeTask('intake_triage')} />);

    // Switch priority to High
    await user.click(screen.getByRole('radio', { name: /^high$/i }));
    // Pick route
    await user.click(screen.getByRole('radio', { name: /^Resolution Records on hand/i }));
    // Submit
    await user.click(screen.getByRole('button', { name: /complete triage/i }));

    await waitFor(() => {
      expect(taskCompleteSpy).toHaveBeenCalled();
    });
    expect(taskCompleteSpy.mock.calls[0][0].facts_to_set.priority).toBe('high');
  });
});
