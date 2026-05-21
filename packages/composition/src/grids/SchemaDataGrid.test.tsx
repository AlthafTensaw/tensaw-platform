import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SchemaDataGrid, type SchemaDataGridColumn } from './SchemaDataGrid';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface DenialRow {
  id: string;
  patient: string;
  payer: string;
  amount: number;
}

const COLUMNS: SchemaDataGridColumn<DenialRow>[] = [
  { id: 'patient', header: 'Patient', accessorKey: 'patient' },
  { id: 'payer', header: 'Payer', accessorKey: 'payer' },
  {
    id: 'amount',
    header: 'Amount',
    accessor: (r) => r.amount,
    align: 'right',
  },
];

const ROWS: DenialRow[] = [
  { id: 'rec-1', patient: 'Anderson, J.', payer: 'Aetna', amount: 125 },
  { id: 'rec-2', patient: 'Brown, K.', payer: 'BCBS', amount: 240 },
  { id: 'rec-3', patient: 'Chen, L.', payer: 'United', amount: 88 },
];

// ---------------------------------------------------------------------------
// Baseline (no expansion — confirms no regression)
// ---------------------------------------------------------------------------

describe('SchemaDataGrid — baseline (no expansion props)', () => {
  it('renders rows, no chevron column, no detail rows', () => {
    render(<SchemaDataGrid rows={ROWS} columns={COLUMNS} />);
    expect(screen.getByText('Anderson, J.')).toBeDefined();
    expect(screen.getByText('Brown, K.')).toBeDefined();
    expect(screen.queryByLabelText('Expand row')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Row detail' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chevron-triggered expansion
// ---------------------------------------------------------------------------

describe('SchemaDataGrid — chevron trigger', () => {
  it('renders a chevron column when expansion is enabled (default trigger)', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId={null}
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    // One chevron button per row
    expect(screen.getAllByLabelText('Expand row')).toHaveLength(3);
  });

  it('shows the detail row when expandedRowId matches a row', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-2"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={(r) => (
          <div data-testid="detail">Detail for {r.patient}</div>
        )}
      />,
    );
    expect(screen.getByTestId('detail').textContent).toBe(
      'Detail for Brown, K.',
    );
    expect(screen.getByRole('region', { name: 'Row detail' })).toBeDefined();
  });

  it('does NOT render a detail row when expandedRowId is null', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId={null}
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div data-testid="detail">x</div>}
      />,
    );
    expect(screen.queryByTestId('detail')).toBeNull();
  });

  it('does NOT render a detail row when expandedRowId refers to a missing row', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="nope"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div data-testid="detail">x</div>}
      />,
    );
    expect(screen.queryByTestId('detail')).toBeNull();
  });

  it('clicking the chevron fires onExpandedRowIdChange with that row id', () => {
    const onChange = vi.fn();
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId={null}
        onExpandedRowIdChange={onChange}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    const chevrons = screen.getAllByLabelText('Expand row');
    fireEvent.click(chevrons[1]!); // rec-2
    expect(onChange).toHaveBeenCalledWith('rec-2');
  });

  it('clicking the chevron of the already-expanded row fires null (collapse)', () => {
    const onChange = vi.fn();
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-2"
        onExpandedRowIdChange={onChange}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    // When expanded, the matching row's button is labeled "Collapse row"
    fireEvent.click(screen.getByLabelText('Collapse row'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('chevron click does not propagate to row click handler', () => {
    const onRowClick = vi.fn();
    const onExpand = vi.fn();
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId={null}
        onExpandedRowIdChange={onExpand}
        renderRowDetail={() => <div>detail</div>}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getAllByLabelText('Expand row')[0]!);
    expect(onExpand).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('aria-expanded reflects the open state per row', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-2"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    const expandButtons = screen.getAllByLabelText('Expand row');
    expect(expandButtons).toHaveLength(2); // rec-1, rec-3
    expandButtons.forEach((b) => {
      expect(b.getAttribute('aria-expanded')).toBe('false');
    });
    const collapseButton = screen.getByLabelText('Collapse row');
    expect(collapseButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('aria-controls points to a region with the same id', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-2"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    const button = screen.getByLabelText('Collapse row');
    const controls = button.getAttribute('aria-controls');
    expect(controls).toBe('schema-grid-detail-rec-2');
    const region = document.getElementById(controls!);
    expect(region).not.toBeNull();
    expect(region!.getAttribute('role')).toBe('region');
  });
});

// ---------------------------------------------------------------------------
// Row-triggered expansion
// ---------------------------------------------------------------------------

describe('SchemaDataGrid — row trigger', () => {
  it('no chevron column when expandTrigger="row"', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId={null}
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
        expandTrigger="row"
      />,
    );
    expect(screen.queryByLabelText('Expand row')).toBeNull();
  });

  it('clicking the row toggles expansion', () => {
    const onChange = vi.fn();
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId={null}
        onExpandedRowIdChange={onChange}
        renderRowDetail={() => <div>detail</div>}
        expandTrigger="row"
      />,
    );
    fireEvent.click(screen.getByText('Brown, K.'));
    expect(onChange).toHaveBeenCalledWith('rec-2');
  });

  it('row click fires both onRowClick and toggle (consumer composes)', () => {
    const onRowClick = vi.fn();
    const onExpand = vi.fn();
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId={null}
        onExpandedRowIdChange={onExpand}
        renderRowDetail={() => <div>detail</div>}
        expandTrigger="row"
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText('Anderson, J.'));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
    expect(onExpand).toHaveBeenCalledWith('rec-1');
  });
});

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

describe('SchemaDataGrid — rowDetailVariant', () => {
  it('inset (default) applies the sunken background to the cell', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    const region = screen.getByRole('region', { name: 'Row detail' });
    // The styled cell is the <td> inside the detail row; the region is the
    // <tr>. Find the cell by traversing.
    const td = region.querySelector('td');
    expect(td).not.toBeNull();
    expect(td!.style.background).toMatch(/F9FAFB|var\(/);
  });

  it('flush has no background', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
        rowDetailVariant="flush"
      />,
    );
    const region = screen.getByRole('region', { name: 'Row detail' });
    const td = region.querySelector('td');
    expect(td!.style.background).toBe('transparent');
  });

  it('inset applies inner padding (16px); flush does not', () => {
    const { rerender } = render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div data-testid="d">detail</div>}
      />,
    );
    let region = screen.getByRole('region', { name: 'Row detail' });
    let contentDiv = region.querySelector('div');
    expect(contentDiv!.style.padding).toBe('16px');

    rerender(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div data-testid="d">detail</div>}
        rowDetailVariant="flush"
      />,
    );
    region = screen.getByRole('region', { name: 'Row detail' });
    contentDiv = region.querySelector('div');
    expect(contentDiv!.style.padding).toBe('0px');
  });
});

// ---------------------------------------------------------------------------
// rowDetailMaxHeight
// ---------------------------------------------------------------------------

describe('SchemaDataGrid — rowDetailMaxHeight', () => {
  it('null (default) — no max height, no overflow', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    const region = screen.getByRole('region', { name: 'Row detail' });
    const contentDiv = region.querySelector('div');
    expect(contentDiv!.style.maxHeight).toBe('');
    expect(contentDiv!.style.overflow).toBe('');
  });

  it('number — applies as px and sets overflow auto', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
        rowDetailMaxHeight={320}
      />,
    );
    const region = screen.getByRole('region', { name: 'Row detail' });
    const contentDiv = region.querySelector('div');
    expect(contentDiv!.style.maxHeight).toBe('320px');
    expect(contentDiv!.style.overflow).toBe('auto');
  });

  it('string — applied verbatim', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
        rowDetailMaxHeight="50vh"
      />,
    );
    const region = screen.getByRole('region', { name: 'Row detail' });
    const contentDiv = region.querySelector('div');
    expect(contentDiv!.style.maxHeight).toBe('50vh');
  });
});

// ---------------------------------------------------------------------------
// Single-row constraint
// ---------------------------------------------------------------------------

describe('SchemaDataGrid — single-row expansion enforcement', () => {
  it('opening row B closes row A through controlled state', () => {
    function Harness() {
      const [openId, setOpenId] = useState<string | null>('rec-1');
      return (
        <SchemaDataGrid
          rows={ROWS}
          columns={COLUMNS}
          expandedRowId={openId}
          onExpandedRowIdChange={setOpenId}
          renderRowDetail={(r) => (
            <div data-testid="detail">Detail for {r.patient}</div>
          )}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByTestId('detail').textContent).toBe(
      'Detail for Anderson, J.',
    );
    // Open rec-3
    const buttons = screen.getAllByLabelText('Expand row');
    fireEvent.click(buttons[1]!); // expand-row buttons are rec-2 and rec-3 (rec-1 is "Collapse row")
    expect(screen.getByTestId('detail').textContent).toBe(
      'Detail for Chen, L.',
    );
    // Only one detail rendered
    expect(screen.getAllByTestId('detail')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Detail row colSpan
// ---------------------------------------------------------------------------

describe('SchemaDataGrid — detail row colSpan', () => {
  it('chevron-mode: colSpan covers data columns + 1 chevron column', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
      />,
    );
    const region = screen.getByRole('region', { name: 'Row detail' });
    const td = region.querySelector('td');
    // 3 data columns + 1 chevron = 4
    expect(td!.getAttribute('colspan')).toBe('4');
  });

  it('row-mode: colSpan covers data columns only', () => {
    render(
      <SchemaDataGrid
        rows={ROWS}
        columns={COLUMNS}
        expandedRowId="rec-1"
        onExpandedRowIdChange={vi.fn()}
        renderRowDetail={() => <div>detail</div>}
        expandTrigger="row"
      />,
    );
    const region = screen.getByRole('region', { name: 'Row detail' });
    const td = region.querySelector('td');
    expect(td!.getAttribute('colspan')).toBe('3');
  });
});
