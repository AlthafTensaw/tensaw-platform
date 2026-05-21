/**
 * LLMCallInspector — inspect a single LLM API call.
 *
 * Renders the request, response, and metadata (model, provider, duration,
 * tokens, status) for diagnostic inspection. Used inside the expanded
 * `details` of a TraceTimeline stage that made an LLM call (in PromptQL:
 * `classify_turn`, `select_recipe`, `extract_and_resolve_entities`).
 *
 * Pure presentation. No fetching, no state beyond the section toggles
 * (which Accordion owns). PII/PHI scrubbing is the caller's
 * responsibility — by the time strings reach this component, they should
 * already be safe to render.
 *
 * Visual:
 *   - Outer Card (no shadow, sits inside another container)
 *   - Header: model + provider Badge (neutral) + status Badge + right-cluster duration & tokens
 *   - Optional Alert banner when status != 'ok' and error is provided
 *   - Request and Response sections, each Accordion-collapsible
 *
 * The Accordion uses `type="multiple"` so each section toggles
 * independently. `defaultOpen.{request,response}` controls initial state;
 * after that, the user owns it via the chevron toggles.
 */
import { forwardRef } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CodeBlock,
  cn,
  formatDurationMs,
} from '@tensaw/design-system';

export type LLMCallStatus = 'ok' | 'failed' | 'fallback';
/**
 * Provider name. The known values (`openai`/`anthropic`/`gemini`/`mock`) are
 * preserved as IntelliSense hints; the `string` fallback keeps the API open
 * for future providers without a type churn. TS collapses the union to
 * `string` at compile time but consumers still see the suggestions.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'mock' | string;

export interface LLMCallInspectorProps {
  /** Model id, e.g. "gpt-4o-mini". */
  model: string;
  /** Provider name. */
  provider: LLMProvider;
  /** Wall-clock duration of the call, in ms. */
  durationMs: number;
  /** Optional token counts. */
  promptTokens?: number;
  completionTokens?: number;
  /** The prompt sent to the model. Rendered as plain text in a CodeBlock. */
  request: string;
  /** The raw response from the model. */
  response: string;
  /** Whether the response is JSON (enables JSON highlighting). Default: 'text'. */
  responseLanguage?: 'json' | 'text';
  /** Outcome. 'fallback' means primary failed and backup succeeded. */
  status: LLMCallStatus;
  /** When status='failed' or 'fallback', the error from the failed attempt. */
  error?: string;
  /** Default-expanded sections. Default: all collapsed. */
  defaultOpen?: { request?: boolean; response?: boolean };
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  LLMCallStatus,
  { variant: 'success' | 'warning' | 'error'; text: string }
> = {
  ok: { variant: 'success', text: 'OK' },
  fallback: { variant: 'warning', text: 'Fallback' },
  failed: { variant: 'error', text: 'Failed' },
};

const GENERIC_FAILURE_MESSAGE = 'LLM call failed; no error detail captured.';

/**
 * Format a token count compactly. Examples: 87 → "87"; 1247 → "1.2k";
 * 12340 → "12.3k". Used for the prompt → completion display in the
 * header.
 */
function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000).toFixed(1)}k`;
}

function renderTokenSummary(
  promptTokens: number | undefined,
  completionTokens: number | undefined,
): string | null {
  if (promptTokens !== undefined && completionTokens !== undefined) {
    return `${formatTokens(promptTokens)} → ${formatTokens(completionTokens)}`;
  }
  if (promptTokens !== undefined) {
    return `${formatTokens(promptTokens)} in`;
  }
  if (completionTokens !== undefined) {
    return `${formatTokens(completionTokens)} out`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LLMCallInspector = forwardRef<HTMLDivElement, LLMCallInspectorProps>(
  function LLMCallInspector(
    {
      model,
      provider,
      durationMs,
      promptTokens,
      completionTokens,
      request,
      response,
      responseLanguage = 'text',
      status,
      error,
      defaultOpen,
      className,
    },
    ref,
  ) {
    const statusBadge = STATUS_BADGE[status];
    const tokenSummary = renderTokenSummary(promptTokens, completionTokens);
    const showAlert = status !== 'ok';
    const alertVariant = status === 'failed' ? 'error' : 'warning';
    const alertMessage = error ?? GENERIC_FAILURE_MESSAGE;

    // Determine which Accordion items start open. Default: both collapsed.
    const initiallyOpen: string[] = [];
    if (defaultOpen?.request) initiallyOpen.push('request');
    if (defaultOpen?.response) initiallyOpen.push('response');

    return (
      <Card
        ref={ref}
        role="article"
        aria-label={`LLM call to ${model} (${status})`}
        className={cn('shadow-none', className)}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {model}
            </span>
            <Badge variant="neutral" size="sm">
              {provider}
            </Badge>
            <Badge variant={statusBadge.variant} size="sm">
              {statusBadge.text}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">{formatDurationMs(durationMs)}</span>
            {tokenSummary ? (
              <span className="tabular-nums">{tokenSummary}</span>
            ) : null}
          </div>
        </CardHeader>

        {showAlert ? (
          <div className="px-4">
            <Alert variant={alertVariant}>{alertMessage}</Alert>
          </div>
        ) : null}

        <CardContent className="space-y-4 px-4 py-4">
          <Accordion type="multiple" defaultValue={initiallyOpen}>
            <AccordionItem value="request">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Request
              </AccordionTrigger>
              <AccordionContent>
                <SectionBody body={request} language="text" emptyLabel="No content" />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="response">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Response
              </AccordionTrigger>
              <AccordionContent>
                <SectionBody
                  body={response}
                  language={responseLanguage}
                  emptyLabel="No content"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    );
  },
);
LLMCallInspector.displayName = 'LLMCallInspector';

// ---------------------------------------------------------------------------
// Section body — CodeBlock or empty placeholder
// ---------------------------------------------------------------------------

function SectionBody({
  body,
  language,
  emptyLabel,
}: {
  body: string;
  language: 'text' | 'json';
  emptyLabel: string;
}) {
  if (body.trim().length === 0) {
    return (
      <p className="px-1 py-2 text-sm italic text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return <CodeBlock language={language}>{body}</CodeBlock>;
}
