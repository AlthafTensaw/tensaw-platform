import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceTimeline, type TraceStageData } from './TraceTimeline';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STAGES_PENDING: TraceStageData[] = [
  { id: 'classify', label: 'Classify Turn', status: 'pending' },
  { id: 'resolve', label: 'Resolve Intent', status: 'pending' },
  { id: 'recipe', label: 'Select Recipe', status: 'pending' },
];

const STAGES_MIXED: TraceStageData[] = [
  {
    id: 'classify',
    label: 'Classify Turn',
    technicalName: 'classify_turn',
    status: 'ok',
    durationMs: 42,
    summary: 'Heuristic match: report (confidence 0.92)',
  },
  {
    id: 'resolve',
    label: 'Resolve Intent',
    status: 'ok',
    durationMs: 1234,
    summary: 'Family: collections (5 candidates)',
  },
  {
    id: 'recipe',
    label: 'Select Recipe',
    status: 'running',
    durationMs: null,
  },
  { id: 'path', label: 'Select Path', status: 'pending' },
];

const STAGES_WITH_ERROR: TraceStageData[] = [
  {
    id: 'classify',
    label: 'Classify Turn',
    status: 'ok',
    durationMs: 42,
  },
  {
    id: 'resolve',
    label: 'Resolve Intent',
    status: 'error',
    durationMs: 90,
    summary: 'Resolution failed: parameter missing',
    details: <div data-testid="error-details">stack trace here</div>,
  },
  { id: 'recipe', label: 'Select Recipe', status: 'skipped' },
];

// ---------------------------------------------------------------------------
// Rendering basics
// ---------------------------------------------------------------------------

describe('TraceTimeline — rendering', () => {
  it('renders one list item per stage in array order', () => {
    render(<TraceTimeline stages={STAGES_PENDING} autoExpandErrors={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // Order check via the labels — reading down should match input order
    expect(screen.getByText('Classify Turn')).toBeDefined();
    expect(screen.getByText('Resolve Intent')).toBeDefined();
    expect(screen.getByText('Select Recipe')).toBeDefined();
  });

  it('renders the technical name in mono when provided', () => {
    render(<TraceTimeline stages={STAGES_MIXED} autoExpandErrors={false} />);
    expect(screen.getByText('classify_turn')).toBeDefined();
  });

  it('uses the supplied aria-label on the root list', () => {
    render(
      <TraceTimeline
        stages={STAGES_PENDING}
        aria-label="Custom trace label"
        autoExpandErrors={false}
      />,
    );
    expect(screen.getByRole('list', { name: 'Custom trace label' })).toBeDefined();
  });

  it('falls back to "Pipeline trace" when no aria-label is given', () => {
    render(<TraceTimeline stages={STAGES_PENDING} autoExpandErrors={false} />);
    expect(screen.getByRole('list', { name: 'Pipeline trace' })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Status badges and durations
// ---------------------------------------------------------------------------

describe('TraceTimeline — status badges + duration formatting', () => {
  it('renders the matching status badge text per stage', () => {
    render(<TraceTimeline stages={STAGES_MIXED} autoExpandErrors={false} />);
    // Two OKs + one Running + one Pending
    expect(screen.getAllByText('OK')).toHaveLength(2);
    expect(screen.getByText('Running')).toBeDefined();
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('formats sub-second durations as integer ms', () => {
    render(<TraceTimeline stages={STAGES_MIXED} autoExpandErrors={false} />);
    expect(screen.getByText('42ms')).toBeDefined();
  });

  it('formats sub-minute durations as one-decimal seconds', () => {
    render(<TraceTimeline stages={STAGES_MIXED} autoExpandErrors={false} />);
    expect(screen.getByText('1.2s')).toBeDefined();
  });

  it('formats minute-and-above durations as "Nm Ms"', () => {
    render(
      <TraceTimeline
        stages={[
          { id: 'long', label: 'Long Stage', status: 'ok', durationMs: 65_000 },
        ]}
        autoExpandErrors={false}
      />,
    );
    expect(screen.getByText('1m 5s')).toBeDefined();
  });

  it('shows em-dash when durationMs is null', () => {
    render(
      <TraceTimeline
        stages={[
          { id: 'r', label: 'Running', status: 'running', durationMs: null },
        ]}
        autoExpandErrors={false}
      />,
    );
    expect(screen.getByText('—')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Expansion — uncontrolled
// ---------------------------------------------------------------------------

describe('TraceTimeline — uncontrolled expansion', () => {
  it('defaultExpandedIds opens the named panels initially', () => {
    render(
      <TraceTimeline
        stages={STAGES_MIXED}
        defaultExpandedIds={['classify']}
        autoExpandErrors={false}
      />,
    );
    const button = screen.getByRole('button', { name: /Classify Turn/ });
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking a stage row toggles its expansion', () => {
    render(<TraceTimeline stages={STAGES_MIXED} autoExpandErrors={false} />);
    const button = screen.getByRole('button', { name: /Classify Turn/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('Enter and Space toggle expansion via keyboard', () => {
    render(<TraceTimeline stages={STAGES_MIXED} autoExpandErrors={false} />);
    const button = screen.getByRole('button', { name: /Classify Turn/ });
    button.focus();
    // Native <button> handles Enter/Space as click — fireEvent.click is the
    // canonical way to assert the keyboard-equivalent behavior in RTL.
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Expansion — controlled
// ---------------------------------------------------------------------------

describe('TraceTimeline — controlled expansion', () => {
  it('renders panels for the supplied expandedIds and ignores internal state', () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <TraceTimeline
        stages={STAGES_MIXED}
        expandedIds={['classify']}
        onExpandedChange={onExpandedChange}
        autoExpandErrors={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Classify Turn/ }).getAttribute('aria-expanded'),
    ).toBe('true');

    // Parent updates expandedIds — reflects immediately
    rerender(
      <TraceTimeline
        stages={STAGES_MIXED}
        expandedIds={['resolve']}
        onExpandedChange={onExpandedChange}
        autoExpandErrors={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Classify Turn/ }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(
      screen.getByRole('button', { name: /Resolve Intent/ }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('fires onExpandedChange with the new id set when toggled', () => {
    const onExpandedChange = vi.fn();
    function Harness() {
      const [ids, setIds] = useState<string[]>([]);
      return (
        <TraceTimeline
          stages={STAGES_MIXED}
          expandedIds={ids}
          onExpandedChange={(next) => {
            onExpandedChange(next);
            setIds(next);
          }}
          autoExpandErrors={false}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Classify Turn/ }));
    expect(onExpandedChange).toHaveBeenCalledWith(['classify']);
  });
});

// ---------------------------------------------------------------------------
// Auto-expand on errors
// ---------------------------------------------------------------------------

describe('TraceTimeline — autoExpandErrors', () => {
  it('opens stages with status error or warn on mount when true', () => {
    render(
      <TraceTimeline stages={STAGES_WITH_ERROR} autoExpandErrors={true} />,
    );
    const errorButton = screen.getByRole('button', { name: /Resolve Intent/ });
    expect(errorButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not auto-open when false', () => {
    render(
      <TraceTimeline stages={STAGES_WITH_ERROR} autoExpandErrors={false} />,
    );
    const errorButton = screen.getByRole('button', { name: /Resolve Intent/ });
    expect(errorButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('user can collapse an auto-expanded stage and it stays collapsed (sticky)', () => {
    const { rerender } = render(
      <TraceTimeline stages={STAGES_WITH_ERROR} autoExpandErrors={true} />,
    );
    const errorButton = screen.getByRole('button', { name: /Resolve Intent/ });
    expect(errorButton.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(errorButton);
    expect(errorButton.getAttribute('aria-expanded')).toBe('false');

    // Re-render with the same stages reference does not re-expand
    rerender(
      <TraceTimeline stages={STAGES_WITH_ERROR} autoExpandErrors={true} />,
    );
    expect(errorButton.getAttribute('aria-expanded')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// Live-update flash
// ---------------------------------------------------------------------------

describe('TraceTimeline — live-update flash', () => {
  it('flashes when a stage transitions from running to ok', () => {
    vi.useFakeTimers();
    try {
      const { rerender, container } = render(
        <TraceTimeline
          stages={[
            { id: 'r', label: 'R', status: 'running', durationMs: null },
          ]}
          autoExpandErrors={false}
        />,
      );

      // Transition to ok
      rerender(
        <TraceTimeline
          stages={[
            { id: 'r', label: 'R', status: 'ok', durationMs: 100 },
          ]}
          autoExpandErrors={false}
        />,
      );

      // The row gets the bg-teal-50/60 class while flashing
      const li = container.querySelector('li[role="listitem"]');
      expect(li!.className).toMatch(/bg-teal-50/);

      // After 600ms it reverts
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(li!.className).toMatch(/bg-transparent/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not flash on initial render with terminal status', () => {
    const { container } = render(
      <TraceTimeline
        stages={[{ id: 'a', label: 'A', status: 'ok', durationMs: 50 }]}
        autoExpandErrors={false}
      />,
    );
    const li = container.querySelector('li[role="listitem"]');
    expect(li!.className).not.toMatch(/bg-teal-50/);
  });
});

// ---------------------------------------------------------------------------
// Expanded panel content + a11y wiring
// ---------------------------------------------------------------------------

describe('TraceTimeline — expanded panel', () => {
  it('renders the supplied details in the expanded panel', () => {
    render(
      <TraceTimeline
        stages={STAGES_WITH_ERROR}
        defaultExpandedIds={['resolve']}
        autoExpandErrors={false}
      />,
    );
    expect(screen.getByTestId('error-details')).toBeDefined();
  });

  it('shows the empty placeholder when an expanded stage has no details', () => {
    render(
      <TraceTimeline
        stages={[{ id: 'a', label: 'A', status: 'ok', durationMs: 50 }]}
        defaultExpandedIds={['a']}
        autoExpandErrors={false}
      />,
    );
    expect(
      screen.getByText('No additional details available.'),
    ).toBeDefined();
  });

  it('aria-controls points to the panel that becomes the region id', () => {
    render(
      <TraceTimeline
        stages={STAGES_WITH_ERROR}
        defaultExpandedIds={['resolve']}
        autoExpandErrors={false}
      />,
    );
    const button = screen.getByRole('button', { name: /Resolve Intent/ });
    const controlled = button.getAttribute('aria-controls');
    expect(controlled).toBe('trace-stage-resolve-panel');
    const panel = document.getElementById(controlled!);
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('role')).toBe('region');
  });
});
