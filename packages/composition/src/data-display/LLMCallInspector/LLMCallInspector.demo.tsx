/**
 * LLMCallInspector — living-documentation demo.
 *
 * Shows every meaningful state with realistic data matching the PromptQL
 * backend's per-stage `llm_call` slot (see PATCH_README.md §"Sample
 * `GET /runs/{id}/trace` response"):
 *
 *   "llm_call": {
 *     "model": "gpt-4o-mini",
 *     "provider": "openai",
 *     "status": "ok" | "failed" | "fallback",
 *     "duration_ms": 387,
 *     "prompt_tokens": 1247 | null,
 *     "completion_tokens": 87 | null,
 *     "request": "...",
 *     "response": "...",
 *     "error": null | "..."
 *   }
 *
 * The component's prop shape is a 1:1 mapping (with field-name camelCase
 * differences: `duration_ms` → `durationMs`, `prompt_tokens` →
 * `promptTokens`, etc.).
 *
 * Drop into any page (no provider required) to see the demo render.
 */

import { LLMCallInspector } from './LLMCallInspector';

// ---------------------------------------------------------------------------
// Sample LLM calls — realistic PromptQL pipeline payloads
// ---------------------------------------------------------------------------

/** Verbatim prompt template used by `select_recipe` (truncated for readability). */
const SELECT_RECIPE_PROMPT = `You are a recipe selector for the PromptQL pipeline. Given the user's prompt and a list of candidate recipes, return the best match as JSON.

User prompt: "Show collections by month for client 99001 from January 2026 to March 2026"

Candidates:
- collections_by_month — Monthly collections summary
- payments_by_month — Payments grouped by month
- collections_aging — Aging breakdown of receivables
- denial_reasons — Top denial reasons

Return: {"recipe_key": <string>, "confidence": <number 0..1>, "reasoning": <string>}`;

const SELECT_RECIPE_RESPONSE = JSON.stringify(
  {
    recipe_key: 'collections_by_month',
    confidence: 0.91,
    reasoning:
      'User explicitly asks for collections grouped by month — direct match to the collections_by_month recipe. The date range fits the monthly grain.',
  },
  null,
  2,
);

/**
 * A long extract-and-resolve prompt — 4000+ characters, exercises the
 * CodeBlock's max-height scroll inside the Accordion section.
 */
const LONG_PROMPT = (() => {
  const lines: string[] = [
    'You are an entity resolver for the PromptQL pipeline. Resolve every entity mentioned in the user prompt against the catalog and return JSON.',
    '',
    'User prompt: "Show collections by month for ABC Cardiology in Q1 2026, broken down by payer, excluding voided claims and write-offs, only for Dr. Aligeti and Dr. Schwartz at the Plano and Frisco locations"',
    '',
    'Entity catalog (subset):',
  ];
  for (let i = 0; i < 80; i += 1) {
    lines.push(
      `  - clinic_${i.toString().padStart(4, '0')}: ${i % 4 === 0 ? 'Cardiology' : i % 4 === 1 ? 'Orthopedics' : i % 4 === 2 ? 'Internal Medicine' : 'Family Practice'} #${i}`,
    );
  }
  lines.push('');
  lines.push('Return JSON: {"resolved": [{"entity_type", "value", "raw_text"}], "unresolved": [string], "date_range": {"from", "to"}}');
  return lines.join('\n');
})();

const LONG_PROMPT_RESPONSE = JSON.stringify(
  {
    resolved: [
      { entity_type: 'client', value: 70014, raw_text: 'ABC Cardiology' },
      { entity_type: 'provider', value: 'Aligeti, V MD', raw_text: 'Dr. Aligeti' },
      { entity_type: 'provider', value: 'Schwartz, Brian MD', raw_text: 'Dr. Schwartz' },
      { entity_type: 'location', value: 'plano_office', raw_text: 'Plano' },
      { entity_type: 'location', value: 'bsw_frisco', raw_text: 'Frisco' },
    ],
    unresolved: [],
    date_range: { from: '2026-01-01', to: '2026-03-31' },
    date_basis_hint: 'payment_posted_date',
  },
  null,
  2,
);

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 13,
            color: 'var(--muted-foreground, #6B7280)',
          }}
        >
          {description}
        </p>
      )}
      <div
        style={{
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Demo page
// ---------------------------------------------------------------------------

export default function LLMCallInspectorDemo() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>
        LLMCallInspector — demo
      </h2>
      <p
        style={{
          margin: '0 0 24px',
          fontSize: 14,
          color: 'var(--muted-foreground, #6B7280)',
        }}
      >
        Live reference for <code>{'<LLMCallInspector>'}</code>. Each section
        shows a different LLM-call outcome from the PromptQL pipeline's{' '}
        <code>llm_call</code> stage slot. Wrapper boxes simulate the
        component sitting inside another container — the Card has{' '}
        <code>shadow-none</code> by design.
      </p>

      <Section
        title="1. Successful call with token counts"
        description='status="ok", both prompt_tokens and completion_tokens present. Header right cluster shows duration + "1.2k → 87". No alert banner. Sections start collapsed; click to expand.'
      >
        <LLMCallInspector
          model="gpt-4o-mini"
          provider="openai"
          durationMs={387}
          promptTokens={1247}
          completionTokens={87}
          status="ok"
          request={SELECT_RECIPE_PROMPT}
          response={SELECT_RECIPE_RESPONSE}
          responseLanguage="json"
        />
      </Section>

      <Section
        title="2. Successful call — default open"
        description="Same call, but `defaultOpen={{request: true, response: true}}` so both sections render expanded on mount. Useful when the inspector is the focus of the page (e.g. drill-in modal)."
      >
        <LLMCallInspector
          model="gpt-4o-mini"
          provider="openai"
          durationMs={387}
          promptTokens={1247}
          completionTokens={87}
          status="ok"
          request={SELECT_RECIPE_PROMPT}
          response={SELECT_RECIPE_RESPONSE}
          responseLanguage="json"
          defaultOpen={{ request: true, response: true }}
        />
      </Section>

      <Section
        title="3. Fallback — primary failed, backup succeeded"
        description='status="fallback". Primary OpenAI timed out, the pipeline successfully retried against Gemini. Warning Alert visible above sections. Status badge: "Fallback" (warning variant).'
      >
        <LLMCallInspector
          model="gemini-1.5-pro"
          provider="gemini"
          durationMs={2103}
          promptTokens={1247}
          completionTokens={87}
          status="fallback"
          error="Primary LLM (OpenAI gpt-4o-mini) timed out after 2000ms. Succeeded on Gemini backup."
          request={SELECT_RECIPE_PROMPT}
          response={SELECT_RECIPE_RESPONSE}
          responseLanguage="json"
        />
      </Section>

      <Section
        title="4. Failed — all providers exhausted"
        description='status="failed". Error Alert visible. response is empty (no answer was produced). The empty CodeBlock in the Response section will render the muted "(empty)" placeholder; LLMCallInspector wraps that as "No content" inside the section.'
      >
        <LLMCallInspector
          model="gpt-4o-mini"
          provider="openai"
          durationMs={5000}
          promptTokens={1247}
          status="failed"
          error="All LLM providers exhausted. OpenAI: timeout after 2000ms. Anthropic: 429 rate limit. Gemini: connection refused."
          request={SELECT_RECIPE_PROMPT}
          response=""
        />
      </Section>

      <Section
        title="5. Failed — no error text captured"
        description='status="failed" with no `error` prop supplied. Component falls back to a generic message: "LLM call failed; no error detail captured." Real pipelines should always provide error text; this is the defensive default.'
      >
        <LLMCallInspector
          model="gpt-4o-mini"
          provider="openai"
          durationMs={5000}
          status="failed"
          request={SELECT_RECIPE_PROMPT}
          response=""
        />
      </Section>

      <Section
        title="6. Successful call — null token counts"
        description="Some providers don't return token counts (older Anthropic responses, mock adapters in tests). The right cluster shows duration only; no token summary."
      >
        <LLMCallInspector
          model="claude-3-haiku"
          provider="anthropic"
          durationMs={234}
          status="ok"
          request="Classify the user's intent."
          response='{"intent": "report"}'
          responseLanguage="json"
        />
      </Section>

      <Section
        title="7. Successful call — prompt tokens only"
        description='Some calls have a meaningful prompt count but no completion (e.g. classification calls that return a single token). Right cluster shows "1.2k in".'
      >
        <LLMCallInspector
          model="gpt-4o-mini"
          provider="openai"
          durationMs={120}
          promptTokens={1200}
          status="ok"
          request="Classify: report | question | analysis"
          response="report"
          responseLanguage="text"
        />
      </Section>

      <Section
        title="8. Very long request / response (4000+ chars)"
        description="Each section's CodeBlock has its own internal scroll (default maxHeight=320). The Accordion still toggles independently; long content does not bloat the card height."
      >
        <LLMCallInspector
          model="gpt-4o"
          provider="openai"
          durationMs={1842}
          promptTokens={4123}
          completionTokens={234}
          status="ok"
          request={LONG_PROMPT}
          response={LONG_PROMPT_RESPONSE}
          responseLanguage="json"
          defaultOpen={{ request: true, response: true }}
        />
      </Section>

      <Section
        title="9. Plain-text response"
        description='responseLanguage="text" (the default) — no JSON highlighting. Use for natural-language responses (explanations, summaries).'
      >
        <LLMCallInspector
          model="claude-3-5-sonnet"
          provider="anthropic"
          durationMs={612}
          promptTokens={1100}
          completionTokens={240}
          status="ok"
          request='Summarize the meaning of "collections by month" in plain English.'
          response="Collections by month is a summary that groups payments received during each calendar month. The grain is the calendar month; the value is the sum of payment_posted_amount for each month in the range. Voided claims and write-offs are typically excluded by default."
          responseLanguage="text"
          defaultOpen={{ response: true }}
        />
      </Section>

      <Section
        title="10. Empty content"
        description='Both request and response are empty strings. Each section renders the muted "No content" placeholder. This is rare in practice but the component does not crash.'
      >
        <LLMCallInspector
          model="mock"
          provider="mock"
          durationMs={1}
          status="ok"
          request=""
          response=""
          defaultOpen={{ request: true, response: true }}
        />
      </Section>
    </div>
  );
}
