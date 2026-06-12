/**
 * P1.7 interaction tests — OverrideDialog modal flow.
 *
 * Pattern test for the custom dialog used in ProposedView. If this works,
 * similar dialogs elsewhere follow the same model.
 *
 * Verifies:
 *   - Submit button gates on category selection
 *   - Submit fires case.override with right payload
 *   - Escape closes via the onClose callback
 *   - Backdrop click closes
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { OverrideDialog } from '../src/components/work-pane/OverrideDialog';
import { __setMutationMock } from '../stubs/tensaw/actions';
import { setupStandardMocks, baseCase } from '../src/test/helpers';

describe('OverrideDialog — interactions', () => {
  beforeEach(() => {
    setupStandardMocks();
  });

  it('renders title + lists categories excluding the recommended one', () => {
    const onClose = vi.fn();
    render(
      <OverrideDialog
        caseId={baseCase.case_id}
        recommendedCategory="medical_necessity"
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('heading', { name: /override classification/i })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Recommended category appears in context text but NOT as a dropdown option
    const select = screen.getByLabelText(/override to/i);
    expect(select.querySelectorAll('option')).toHaveLength(3); // placeholder + 2 non-recommended

    // Other categories ARE options
    expect(screen.getByRole('option', { name: 'Auth Missing' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Modifier Missing' })).toBeInTheDocument();
  });

  it('Submit is disabled until a category is picked', async () => {
    const user = userEvent.setup();
    render(
      <OverrideDialog
        caseId={baseCase.case_id}
        recommendedCategory="medical_necessity"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /submit override/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/override to/i), 'auth_missing');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit override/i })).not.toBeDisabled();
    });
  });

  it('Submit fires case.override with the picked category + reasoning', async () => {
    const overrideSpy = vi.fn().mockResolvedValue({
      case: { ...baseCase, case_status: 'overridden' },
      next_task: null,
    });
    __setMutationMock('case.override', overrideSpy);

    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <OverrideDialog
        caseId={baseCase.case_id}
        recommendedCategory="medical_necessity"
        onClose={onClose}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/override to/i), 'auth_missing');
    await user.type(
      screen.getByLabelText(/reasoning/i),
      'Auth was actually required for this procedure.',
    );
    await user.click(screen.getByRole('button', { name: /submit override/i }));

    await waitFor(() => {
      expect(overrideSpy).toHaveBeenCalled();
    });

    const call = overrideSpy.mock.calls[0][0];
    expect(call.case_id).toBe(baseCase.case_id);
    expect(call.override_category).toBe('auth_missing');
    expect(call.override_reasoning).toBe('Auth was actually required for this procedure.');

    // Dialog should close after success
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('Cancel button calls onClose without submitting', async () => {
    const onClose = vi.fn();
    const overrideSpy = vi.fn();
    __setMutationMock('case.override', overrideSpy);

    const user = userEvent.setup();
    render(
      <OverrideDialog
        caseId={baseCase.case_id}
        recommendedCategory="medical_necessity"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onClose).toHaveBeenCalled();
    expect(overrideSpy).not.toHaveBeenCalled();
  });

  it('Escape key calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <OverrideDialog
        caseId={baseCase.case_id}
        recommendedCategory="medical_necessity"
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop calls onClose; clicking inside does not', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <OverrideDialog
        caseId={baseCase.case_id}
        recommendedCategory="medical_necessity"
        onClose={onClose}
      />,
    );

    // Click the dialog container itself (which is the backdrop)
    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();

    // Click inside the dialog content — onClose should NOT be called
    await user.click(screen.getByRole('heading', { name: /override classification/i }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
