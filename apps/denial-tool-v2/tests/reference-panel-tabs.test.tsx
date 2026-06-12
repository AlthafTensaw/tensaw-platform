/**
 * P1.11 interaction tests — ReferencePanel tab switching.
 *
 * Verifies:
 *   - Default tab is Analysis (URL has no ?tab=)
 *   - Clicking each tab updates URL ?tab= and swaps content
 *   - URL drives initial active tab on load
 *   - Notes badge count increments when notes are added
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';

import { ReferencePanel } from '../src/pages/ReferencePanel';
import {
  __setSearchParams,
  __getSearchParams,
} from '../stubs/react-router-dom';
import { setupStandardMocks } from '../src/test/helpers';
import { __setQueryMock } from '../stubs/tensaw/actions';

describe('ReferencePanel — tab switching', () => {
  beforeEach(() => {
    setupStandardMocks();
    __setSearchParams({ case: 'case_000001' });
  });

  it('defaults to Analysis tab when no ?tab= in URL', async () => {
    render(<ReferencePanel />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /analysis/i })).toHaveAttribute('aria-selected', 'true');
    });

    // Analysis tab content should be visible
    expect(screen.getByText(/LLM classification/i)).toBeInTheDocument();
  });

  it('clicking a tab swaps the active content and updates ?tab=', async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: /notes/i }));

    // URL gets ?tab=notes
    await waitFor(() => {
      expect(__getSearchParams()).toMatch(/tab=notes/);
    });

    // Notes tab content
    await waitFor(() => {
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    // Analysis content gone
    expect(screen.queryByText(/LLM classification/i)).toBeNull();
  });

  it('URL ?tab= drives initial active tab on load', async () => {
    __setSearchParams({ case: 'case_000001', tab: 'files' });

    render(<ReferencePanel />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /files/i })).toHaveAttribute('aria-selected', 'true');
    });

    // Files tab content
    expect(screen.getByText(/upload file/i)).toBeInTheDocument();
  });

  it('switching back to Analysis removes ?tab= from URL (default tab is implicit)', async () => {
    __setSearchParams({ case: 'case_000001', tab: 'notes' });
    const user = userEvent.setup();
    render(<ReferencePanel />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /notes/i })).toHaveAttribute('aria-selected', 'true');
    });

    await user.click(screen.getByRole('tab', { name: /analysis/i }));

    await waitFor(() => {
      expect(__getSearchParams()).not.toMatch(/tab=/);
    });
    // Case param preserved
    expect(__getSearchParams()).toMatch(/case=case_000001/);
  });

  it('badge counts show on Notes and Files when data is present', async () => {
    __setQueryMock('case.notes', {
      notes: [
        {
          note_id: 'n1',
          case_id: 'case_000001',
          body: 'test',
          source: 'analyst',
          author_user_id: 42,
          author_user_name: 'Vipin K.',
          created_at: '2026-06-12T10:00:00Z',
        },
        {
          note_id: 'n2',
          case_id: 'case_000001',
          body: 'second',
          source: 'analyst',
          author_user_id: 42,
          author_user_name: 'Vipin K.',
          created_at: '2026-06-12T11:00:00Z',
        },
      ],
    });
    __setQueryMock('case.files', {
      files: [
        {
          file_id: 'f1',
          case_id: 'case_000001',
          file_name: 'record.pdf',
          file_type: 'medical_record',
          size_bytes: 1024,
          mime_type: 'application/pdf',
          uploaded_by_user_id: 42,
          uploaded_by_user_name: 'Vipin K.',
          uploaded_at: '2026-06-12T10:00:00Z',
        },
      ],
    });

    render(<ReferencePanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/2 notes/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/1 files/i)).toBeInTheDocument();
  });
});
