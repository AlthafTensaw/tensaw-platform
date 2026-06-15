/**
 * R10 interaction tests — v4.1 reference panel + worklist.
 *
 * Covers the surfaces the engine-handler model changed, replacing the v4
 * reference-panel-tabs + worklist-filters tests (removed in R12):
 *   - ReferencePanel: Analysis (case_facts) default + tab switching
 *   - WorklistPane:    task-row cards + high-dollar filter toggle
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';

import { ReferencePanel } from '../src/pages/ReferencePanel';
import { WorklistPane } from '../src/pages/WorklistPane';
import { __setSearchParams, __getSearchParams, __resetSearchParams } from '../stubs/react-router-dom';
import { __setQueryMock } from '../stubs/tensaw/actions';
import { setupV41Mocks, baseDetail, makeTask } from '../src/test/helpers';

describe('ReferencePanel — tabs', () => {
  beforeEach(() => {
    setupV41Mocks();
    __setQueryMock('case.detail', {
      ...baseDetail,
      state_code: 'CODING',
      case_facts: { is_high_dollar: true, clarification_type: 'CODING', appeal_policy: 'ONE_APPEAL' },
    });
    __setQueryMock('case.notes', { notes: [] } as never);
    __setQueryMock('case.files', { files: [] } as never);
    __setQueryMock('case.appeal.get', null as never);
    __setSearchParams({ case: 'C-DENIAL-0001' });
  });

  it('defaults to the Analysis tab and shows case_facts', async () => {
    render(<ReferencePanel />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /analysis/i })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByText(/case facts/i)).toBeInTheDocument();
    expect(screen.getByText(/engine state/i)).toBeInTheDocument();
  });

  it('clicking Notes swaps content and sets ?tab=notes', async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />);

    await waitFor(() => expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /notes/i }));

    await waitFor(() => expect(__getSearchParams()).toMatch(/tab=notes/));
    // case-facts (analysis) content is gone
    await waitFor(() => expect(screen.queryByText(/engine state/i)).toBeNull());
  });
});

describe('WorklistPane — list + filters', () => {
  beforeEach(() => {
    setupV41Mocks();
    __resetSearchParams();
    __setQueryMock('worklist.list', {
      rows: [
        makeTask('ANALYST_TRIAGE_DENIAL', { task_id: 'T1' }),
        makeTask('CODER_REVIEW_RECORD', { task_id: 'T2', team: 'coding' }),
      ],
      page: 1,
      page_size: 25,
      total: 2,
      has_more: false,
    });
  });

  it('renders task-row cards', async () => {
    render(<WorklistPane />);
    await waitFor(() => expect(screen.getByText(/triage denial/i)).toBeInTheDocument());
    expect(screen.getByText(/coding review/i)).toBeInTheDocument();
  });

  it('high-dollar toggle sets ?hd=1', async () => {
    const user = userEvent.setup();
    render(<WorklistPane />);

    const toggle = await screen.findByRole('button', { name: /high-dollar/i });
    await user.click(toggle);

    await waitFor(() => expect(__getSearchParams()).toMatch(/hd=1/));
  });
});
