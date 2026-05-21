import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LLMCallInspector } from './LLMCallInspector';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

describe('LLMCallInspector — header', () => {
  it('renders model, provider badge, status badge, and duration', () => {
    render(
      <LLMCallInspector
        model="gpt-4o-mini"
        provider="openai"
        durationMs={412}
        status="ok"
        request="prompt"
        response="answer"
      />,
    );
    expect(screen.getByText('gpt-4o-mini')).toBeDefined();
    expect(screen.getByText('openai')).toBeDefined();
    expect(screen.getByText('OK')).toBeDefined();
    expect(screen.getByText('412ms')).toBeDefined();
  });

  it('renders token counts in "prompt → completion" format when both present', () => {
    render(
      <LLMCallInspector
        model="gpt-4o-mini"
        provider="openai"
        durationMs={412}
        promptTokens={1247}
        completionTokens={87}
        status="ok"
        request="prompt"
        response="answer"
      />,
    );
    expect(screen.getByText('1.2k → 87')).toBeDefined();
  });

  it('renders prompt-only token count as "Nk in"', () => {
    render(
      <LLMCallInspector
        model="gpt-4o-mini"
        provider="openai"
        durationMs={412}
        promptTokens={500}
        status="ok"
        request="prompt"
        response="answer"
      />,
    );
    expect(screen.getByText('500 in')).toBeDefined();
  });

  it('omits the token summary when no token counts are supplied', () => {
    render(
      <LLMCallInspector
        model="gpt-4o-mini"
        provider="openai"
        durationMs={412}
        status="ok"
        request="prompt"
        response="answer"
      />,
    );
    // No element should contain the arrow
    expect(screen.queryByText(/→/)).toBeNull();
    // No "in" / "out" suffix either
    expect(screen.queryByText(/\d+ in/)).toBeNull();
    expect(screen.queryByText(/\d+ out/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

describe('LLMCallInspector — status badge labels', () => {
  it.each([
    ['ok', 'OK'] as const,
    ['fallback', 'Fallback'] as const,
    ['failed', 'Failed'] as const,
  ])('renders %s status as "%s"', (status, label) => {
    render(
      <LLMCallInspector
        model="m"
        provider="openai"
        durationMs={1}
        status={status}
        request="r"
        response="r"
        error="some error"
      />,
    );
    expect(screen.getByText(label)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Alert banner
// ---------------------------------------------------------------------------

describe('LLMCallInspector — alert banner', () => {
  it('shows the error alert when status is fallback', () => {
    render(
      <LLMCallInspector
        model="m"
        provider="openai"
        durationMs={1}
        status="fallback"
        request="r"
        response="r"
        error="Primary timed out; succeeded on backup."
      />,
    );
    expect(
      screen.getByText('Primary timed out; succeeded on backup.'),
    ).toBeDefined();
  });

  it('shows the error alert when status is failed', () => {
    render(
      <LLMCallInspector
        model="m"
        provider="openai"
        durationMs={1}
        status="failed"
        request="r"
        response="r"
        error="Connection refused"
      />,
    );
    expect(screen.getByText('Connection refused')).toBeDefined();
  });

  it('falls back to a generic message when error text is missing on a non-ok status', () => {
    render(
      <LLMCallInspector
        model="m"
        provider="openai"
        durationMs={1}
        status="failed"
        request="r"
        response="r"
      />,
    );
    expect(
      screen.getByText('LLM call failed; no error detail captured.'),
    ).toBeDefined();
  });

  it('does not render the alert banner on status ok', () => {
    render(
      <LLMCallInspector
        model="m"
        provider="openai"
        durationMs={1}
        status="ok"
        request="r"
        response="r"
        error="this should not appear"
      />,
    );
    expect(screen.queryByText('this should not appear')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

describe('LLMCallInspector — sections', () => {
  it('renders Request and Response section headers', () => {
    render(
      <LLMCallInspector
        model="m"
        provider="openai"
        durationMs={1}
        status="ok"
        request="some prompt text"
        response='{"ok": true}'
        responseLanguage="json"
      />,
    );
    expect(screen.getByText('Request')).toBeDefined();
    expect(screen.getByText('Response')).toBeDefined();
  });

  it('renders the empty-content placeholder for an empty response', () => {
    render(
      <LLMCallInspector
        model="m"
        provider="openai"
        durationMs={1}
        status="ok"
        request="prompt"
        response=""
        defaultOpen={{ response: true }}
      />,
    );
    expect(screen.getByText('No content')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('LLMCallInspector — accessibility', () => {
  it('exposes role=article with aria-label including model and status', () => {
    render(
      <LLMCallInspector
        model="gpt-4o-mini"
        provider="openai"
        durationMs={1}
        status="fallback"
        request="r"
        response="r"
        error="x"
      />,
    );
    const article = screen.getByRole('article');
    expect(article.getAttribute('aria-label')).toBe(
      'LLM call to gpt-4o-mini (fallback)',
    );
  });
});
