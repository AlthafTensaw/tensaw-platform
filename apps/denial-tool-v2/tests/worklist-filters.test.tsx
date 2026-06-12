/**
 * P1.6 interaction tests — WorklistFiltersBar.
 *
 * Exercises the click-driven filter chip behavior that SSR snapshots can't reach:
 *   - Open dropdown by clicking the chip
 *   - Pick an option → URL param updates + dropdown closes
 *   - Clear filter via the × button
 *   - Click outside closes the dropdown
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';

import { WorklistFiltersBar } from '../src/components/worklist/WorklistFilters';
import { __getSearchParams } from '../stubs/react-router-dom';
import { setupStandardMocks } from '../src/test/helpers';

describe('WorklistFiltersBar — interactions', () => {
  beforeEach(() => {
    setupStandardMocks();
  });

  it('opens the Category dropdown when the chip is clicked', async () => {
    const user = userEvent.setup();
    render(<WorklistFiltersBar />);

    // Initially the dropdown options aren't visible
    expect(screen.queryByRole('listbox', { name: /category options/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /filter by category/i }));

    // Now the listbox should appear with category options
    expect(screen.getByRole('listbox', { name: /category options/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medical Necessity' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Auth Missing' })).toBeInTheDocument();
  });

  it('picking an option writes the filter to URL state and closes the dropdown', async () => {
    const user = userEvent.setup();
    render(<WorklistFiltersBar />);

    await user.click(screen.getByRole('button', { name: /filter by category/i }));
    await user.click(screen.getByRole('option', { name: 'Auth Missing' }));

    // URL should now have ?category=auth_missing
    await waitFor(() => {
      expect(__getSearchParams()).toMatch(/category=auth_missing/);
    });

    // Dropdown closed
    expect(screen.queryByRole('listbox', { name: /category options/i })).toBeNull();

    // The chip now shows the picked value
    expect(
      screen.getByRole('button', { name: /filter by category/i }),
    ).toHaveTextContent('Category: Auth Missing');
  });

  it('the × button clears the filter', async () => {
    const user = userEvent.setup();
    render(<WorklistFiltersBar />);

    // Apply a filter first
    await user.click(screen.getByRole('button', { name: /filter by category/i }));
    await user.click(screen.getByRole('option', { name: 'Auth Missing' }));
    await waitFor(() => {
      expect(__getSearchParams()).toMatch(/category=auth_missing/);
    });

    // Click the × inside the active chip
    await user.click(screen.getByLabelText(/clear category filter/i));

    // Filter is gone from URL
    await waitFor(() => {
      expect(__getSearchParams()).not.toMatch(/category=/);
    });
  });

  it('the Payer chip is disabled until a Clinic is picked', async () => {
    const user = userEvent.setup();
    render(<WorklistFiltersBar />);

    expect(screen.getByRole('button', { name: /filter by payer/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /filter by clinic/i }));
    await user.click(screen.getByRole('option', { name: 'LSAT' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter by payer/i })).not.toBeDisabled();
    });
  });

  it('"Clear filters" link appears when any filter is set and clears all on click', async () => {
    const user = userEvent.setup();
    render(<WorklistFiltersBar />);

    expect(screen.queryByRole('button', { name: /^clear filters$/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /filter by category/i }));
    await user.click(screen.getByRole('option', { name: 'Auth Missing' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^clear filters$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^clear filters$/i }));

    await waitFor(() => {
      expect(__getSearchParams()).toBe('');
    });
  });
});
