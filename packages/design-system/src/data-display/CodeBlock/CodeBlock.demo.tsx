/**
 * CodeBlock — living-documentation demo.
 *
 * Drop into any page (no provider required) to see every meaningful state
 * of the component side-by-side. This is the prop contract reference for
 * downstream wiring sessions; the data here is realistic, not lorem ipsum,
 * and is the same shape the PromptQL pipeline produces.
 *
 * Run this in an app by importing the default export:
 *
 *   import CodeBlockDemo from '@tensaw/design-system/data-display/CodeBlock/CodeBlock.demo';
 *   <CodeBlockDemo />
 *
 * Not a test file; not consumed by Vitest. Storybook stories ship separately
 * in `CodeBlock.stories.tsx`. The demo is one page, scrollable.
 */

import { CodeBlock } from './CodeBlock';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

/** A short SQL recipe — the kind of snippet `sql_generation` typically produces. */
const SHORT_SQL = `SELECT
  DATE_FORMAT(payment_posted_date, '%Y-%m') AS month,
  SUM(payment_amount) AS total_collections,
  COUNT(DISTINCT claim_id) AS claim_count
FROM fact_payments
WHERE clinic_id = :client_id
  AND payment_posted_date BETWEEN :from_date AND :to_date
GROUP BY DATE_FORMAT(payment_posted_date, '%Y-%m')
ORDER BY month ASC`;

/**
 * A long generated SQL — a 60-line CTE-based recipe like
 * `collections_by_month_v2`. Exercises vertical scrolling at the
 * default `maxHeight={320}`.
 */
const LONG_SQL = `WITH base_payments AS (
  SELECT
    p.payment_id,
    p.claim_id,
    p.payment_posted_date,
    p.payment_amount,
    p.payment_type,
    p.payer_id,
    c.clinic_id,
    c.encounter_date,
    c.rendering_provider_id,
    c.service_location_id
  FROM fact_payments p
  INNER JOIN fact_claims c ON p.claim_id = c.claim_id
  WHERE c.clinic_id = :client_id
    AND p.payment_posted_date BETWEEN :from_date AND :to_date
    AND p.is_voided = 0
    AND p.payment_type IN ('insurance', 'patient', 'adjustment')
),
month_buckets AS (
  SELECT
    DATE_FORMAT(payment_posted_date, '%Y-%m') AS month,
    payment_amount,
    payment_type,
    payer_id,
    rendering_provider_id
  FROM base_payments
),
monthly_summary AS (
  SELECT
    month,
    SUM(CASE WHEN payment_type = 'insurance' THEN payment_amount ELSE 0 END) AS ins_collections,
    SUM(CASE WHEN payment_type = 'patient'   THEN payment_amount ELSE 0 END) AS pt_collections,
    SUM(CASE WHEN payment_type = 'adjustment' THEN payment_amount ELSE 0 END) AS adj_amount,
    SUM(payment_amount) AS total_collections,
    COUNT(DISTINCT payer_id) AS unique_payers,
    COUNT(DISTINCT rendering_provider_id) AS unique_providers
  FROM month_buckets
  GROUP BY month
),
prior_period AS (
  SELECT
    DATE_FORMAT(DATE_SUB(payment_posted_date, INTERVAL 1 YEAR), '%Y-%m') AS month,
    SUM(payment_amount) AS prior_year_collections
  FROM base_payments
  GROUP BY DATE_FORMAT(DATE_SUB(payment_posted_date, INTERVAL 1 YEAR), '%Y-%m')
)
SELECT
  s.month,
  s.ins_collections,
  s.pt_collections,
  s.adj_amount,
  s.total_collections,
  s.unique_payers,
  s.unique_providers,
  p.prior_year_collections,
  CASE
    WHEN p.prior_year_collections IS NULL OR p.prior_year_collections = 0 THEN NULL
    ELSE ROUND((s.total_collections - p.prior_year_collections) * 100.0 / p.prior_year_collections, 1)
  END AS yoy_pct_change
FROM monthly_summary s
LEFT JOIN prior_period p ON s.month = p.month
ORDER BY s.month ASC
LIMIT 100`;

/**
 * A JSON envelope — the kind of `output` field a compiler stage produces,
 * here for `select_recipe`. Real shape from the PromptQL backend.
 */
const SAMPLE_JSON = JSON.stringify(
  {
    selected_recipe_key: 'collections_by_month',
    recipe_version: 2,
    confidence: 0.91,
    top_candidates: [
      { recipe_key: 'collections_by_month', version: 2, score: 0.84 },
      { recipe_key: 'payments_by_month', version: 1, score: 0.72 },
      { recipe_key: 'collections_aging', version: 1, score: 0.41 },
    ],
    needs_clarification: false,
    embedding_similarity: 0.84,
    llm_confidence: 0.91,
  },
  null,
  2,
);

/**
 * Deliberately malformed SQL — unclosed string + unclosed block comment.
 * Tests that the tokenizer degrades gracefully (no crash, unmatched
 * regions render as plain text).
 */
const MALFORMED_SQL = `SELECT * FROM claims
WHERE patient_name = 'Last, Patient
/* this comment block was never closed
AND clinic_id = :client_id`;

/**
 * Single long line — exercises horizontal scroll vs wrap behavior.
 */
const ONE_LONG_LINE =
  `SELECT a.id, a.name, a.email, a.phone, a.created_at, a.updated_at, a.last_seen_at, a.timezone, a.locale, a.preferred_provider_id, a.referral_source, a.notes, a.tags, a.scope FROM accounts a WHERE a.clinic_id = :client_id AND a.status = :status AND a.created_at > :since ORDER BY a.created_at DESC LIMIT 50`;

// ---------------------------------------------------------------------------
// Section wrapper — keeps each variant visually grouped under a heading
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
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Demo page
// ---------------------------------------------------------------------------

export default function CodeBlockDemo() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>
        CodeBlock — demo
      </h2>
      <p
        style={{
          margin: '0 0 24px',
          fontSize: 14,
          color: 'var(--muted-foreground, #6B7280)',
        }}
      >
        Live reference for the <code>{'<CodeBlock>'}</code> component.
        Every meaningful state shown below; data is realistic PromptQL pipeline
        output.
      </p>

      <Section
        title="Short SQL with syntax highlighting"
        description="Keywords in teal-semibold, strings in emerald, numbers in amber, `:placeholders` in purple. The default `maxHeight={320}` is plenty for this fixture."
      >
        <CodeBlock language="sql">{SHORT_SQL}</CodeBlock>
      </Section>

      <Section
        title="Long SQL — exercises vertical scroll"
        description="60+ lines forces internal scroll. Focus the <pre> with Tab and use arrow keys to scroll."
      >
        <CodeBlock language="sql">{LONG_SQL}</CodeBlock>
      </Section>

      <Section
        title="Long SQL with line numbers"
        description="`showLineNumbers={true}` renders the aria-hidden gutter. Tests can count lines via the gutter, but screen readers skip it."
      >
        <CodeBlock language="sql" showLineNumbers>
          {LONG_SQL}
        </CodeBlock>
      </Section>

      <Section
        title="Single long line — wrap on"
        description="`wrap={true}` switches the <pre> to `whitespace-pre-wrap` so callers can avoid horizontal scroll. Default is horizontal scroll."
      >
        <CodeBlock language="sql" wrap>
          {ONE_LONG_LINE}
        </CodeBlock>
      </Section>

      <Section
        title="Single long line — horizontal scroll (default)"
        description="Same content, default `wrap={false}`. The <pre> scrolls horizontally."
      >
        <CodeBlock language="sql">{ONE_LONG_LINE}</CodeBlock>
      </Section>

      <Section
        title="JSON payload"
        description="Distinguishes keys (slate-semibold) from string values (emerald). Numbers in amber; true/false/null in muted. Sample is a real `select_recipe` stage output."
      >
        <CodeBlock language="json">{SAMPLE_JSON}</CodeBlock>
      </Section>

      <Section
        title="Copy-to-clipboard interaction"
        description='Click the copy button in the top-right. Icon swaps to a check and the Tooltip says "Copied!" for 1.5 seconds. Failure (no clipboard API, denied permission) logs a console warning and reverts immediately — does not throw.'
      >
        <CodeBlock language="sql">{SHORT_SQL}</CodeBlock>
      </Section>

      <Section
        title="Copy button hidden"
        description="`showCopyButton={false}` removes the affordance entirely. Useful when the content is decorative or already accessible elsewhere."
      >
        <CodeBlock language="sql" showCopyButton={false}>
          {SHORT_SQL}
        </CodeBlock>
      </Section>

      <Section
        title="Empty state"
        description='An empty or whitespace-only string renders the muted "(empty)" placeholder and hides the copy button. No special handling needed at the call site.'
      >
        <CodeBlock>{''}</CodeBlock>
      </Section>

      <Section
        title="Plain text (no highlighting)"
        description="`language='text'` (the default) skips tokenization. The whole content renders in a single span — predictable, fast, no surprises for non-code content."
      >
        <CodeBlock>
          {`Heuristic match: report (confidence 0.92)
Family: collections (5 candidates)
Matched collections_by_month at 0.93 confidence`}
        </CodeBlock>
      </Section>

      <Section
        title="Malformed SQL — graceful degradation"
        description='Unclosed string + unclosed block comment. The tokenizer treats the unmatched runs as plain text rather than crashing. Important: this is a real edge case — pipelines occasionally emit truncated SQL when an LLM hits the token limit mid-statement.'
      >
        <CodeBlock language="sql">{MALFORMED_SQL}</CodeBlock>
      </Section>

      <Section
        title="Compact density"
        description='Wrap a CodeBlock in `<div data-density="compact">` and padding tightens (px-4 py-3 → px-3 py-2). Use this in dense panels or modal bodies.'
      >
        <div data-density="compact">
          <CodeBlock language="sql">{SHORT_SQL}</CodeBlock>
        </div>
      </Section>

      <Section
        title="Custom maxHeight"
        description="Pass a number (px) or any CSS string. Shown here with `maxHeight={140}` so even a small fixture scrolls."
      >
        <CodeBlock language="sql" maxHeight={140}>
          {LONG_SQL}
        </CodeBlock>
      </Section>
    </div>
  );
}
