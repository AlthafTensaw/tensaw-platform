import { render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeBlock } from './CodeBlock';

// ---------------------------------------------------------------------------
// Clipboard mock — installed once per test that needs it.
//
// jsdom doesn't provide a working `navigator.clipboard.writeText` out of the
// box. We define a writable mock on each test that needs it and assert
// against the spy.
// ---------------------------------------------------------------------------

function installClipboardMock(impl?: (text: string) => Promise<void>) {
  const writeText = vi.fn(impl ?? (() => Promise.resolve()));
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('CodeBlock — rendering', () => {
  it('renders content as text, not HTML', () => {
    render(<CodeBlock>{'<script>alert(1)</script>'}</CodeBlock>);
    // The literal `<script>` tag should be in text content, not rendered.
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText(/<script>/)).toBeDefined();
  });

  it('applies maxHeight as an inline style on the <pre>', () => {
    const { container } = render(
      <CodeBlock maxHeight={200}>{'one\ntwo\nthree'}</CodeBlock>,
    );
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.style.maxHeight).toBe('200px');
  });

  it('accepts a string maxHeight verbatim', () => {
    const { container } = render(
      <CodeBlock maxHeight="40vh">{'x'}</CodeBlock>,
    );
    expect(container.querySelector('pre')!.style.maxHeight).toBe('40vh');
  });

  it('the <pre> is keyboard-focusable for arrow-key scroll', () => {
    const { container } = render(<CodeBlock>{'long content'}</CodeBlock>);
    const pre = container.querySelector('pre');
    expect(pre!.tabIndex).toBe(0);
  });

  it('sets a region role with a default aria-label derived from language', () => {
    render(<CodeBlock language="sql">{'SELECT 1'}</CodeBlock>);
    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-label')).toBe('SQL code block');
  });

  it('respects an aria-label override', () => {
    render(
      <CodeBlock aria-label="Generated SQL for collections recipe">
        {'SELECT 1'}
      </CodeBlock>,
    );
    expect(
      screen.getByRole('region', {
        name: 'Generated SQL for collections recipe',
      }),
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('CodeBlock — empty content', () => {
  it('renders the (empty) placeholder for an empty string', () => {
    render(<CodeBlock>{''}</CodeBlock>);
    expect(screen.getByText('(empty)')).toBeDefined();
  });

  it('renders the (empty) placeholder for whitespace-only content', () => {
    render(<CodeBlock>{'   \n\t  '}</CodeBlock>);
    expect(screen.getByText('(empty)')).toBeDefined();
  });

  it('hides the copy button when content is empty', () => {
    render(<CodeBlock>{''}</CodeBlock>);
    expect(screen.queryByLabelText('Copy code')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

describe('CodeBlock — copy button', () => {
  it('copies the children string via navigator.clipboard.writeText', async () => {
    const writeText = installClipboardMock();
    render(<CodeBlock>{'hello world'}</CodeBlock>);

    fireEvent.click(screen.getByLabelText('Copy code'));

    // Wait one microtask so the async writeText resolves
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('hello world');
  });

  it('reverts the success state after 1500ms', async () => {
    vi.useFakeTimers();
    try {
      installClipboardMock();
      render(<CodeBlock>{'x'}</CodeBlock>);

      fireEvent.click(screen.getByLabelText('Copy code'));

      // Drain the awaited writeText promise in fake-timer mode
      await act(async () => {
        await Promise.resolve();
      });

      // Just after the click — success state visible
      expect(screen.getByLabelText('Copied')).toBeDefined();

      // Advance past the 1500ms reset
      act(() => {
        vi.advanceTimersByTime(1600);
      });

      expect(screen.getByLabelText('Copy code')).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not throw and does not persist success state when clipboard write fails', async () => {
    installClipboardMock(() => Promise.reject(new Error('denied')));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* swallow */
    });
    render(<CodeBlock>{'x'}</CodeBlock>);

    fireEvent.click(screen.getByLabelText('Copy code'));

    // Drain the rejection
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByLabelText('Copied')).toBeNull();
    expect(screen.getByLabelText('Copy code')).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('hides the copy button when showCopyButton=false', () => {
    render(<CodeBlock showCopyButton={false}>{'x'}</CodeBlock>);
    expect(screen.queryByLabelText('Copy code')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Line numbers
// ---------------------------------------------------------------------------

describe('CodeBlock — line numbers', () => {
  it('renders one number per line when showLineNumbers=true', () => {
    const { container } = render(
      <CodeBlock showLineNumbers>{'a\nb\nc\nd'}</CodeBlock>,
    );
    // Gutter is aria-hidden; query by text since the digits are rendered
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('4');
  });

  it('hides the gutter from screen readers (aria-hidden)', () => {
    const { container } = render(
      <CodeBlock showLineNumbers>{'a\nb'}</CodeBlock>,
    );
    const gutter = container.querySelector('[aria-hidden="true"]');
    expect(gutter).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Highlighting — smoke tests, not full grammar coverage
// ---------------------------------------------------------------------------

describe('CodeBlock — highlighting', () => {
  it('wraps SQL keywords in styled spans', () => {
    const { container } = render(
      <CodeBlock language="sql">{'SELECT a FROM t WHERE b = 1'}</CodeBlock>,
    );
    // Find the SELECT span (teal-700, font-semibold)
    const spans = Array.from(container.querySelectorAll('span'));
    const select = spans.find((s) => s.textContent === 'SELECT');
    expect(select).toBeDefined();
    expect(select!.className).toContain('text-teal-700');
  });

  it('treats JSON keys differently from string values', () => {
    const json = '{"foo": "bar"}';
    const { container } = render(
      <CodeBlock language="json">{json}</CodeBlock>,
    );
    const spans = Array.from(container.querySelectorAll('span'));
    const fooSpan = spans.find((s) => s.textContent === '"foo"');
    const barSpan = spans.find((s) => s.textContent === '"bar"');
    expect(fooSpan).toBeDefined();
    expect(barSpan).toBeDefined();
    expect(fooSpan!.className).toContain('slate-700'); // key class
    expect(barSpan!.className).toContain('emerald-700'); // string class
  });

  it('does not crash on malformed SQL (unclosed string + unclosed comment)', () => {
    expect(() =>
      render(
        <CodeBlock language="sql">
          {"SELECT * FROM t WHERE name = 'unclosed /* also unclosed"}
        </CodeBlock>,
      ),
    ).not.toThrow();
  });
});
