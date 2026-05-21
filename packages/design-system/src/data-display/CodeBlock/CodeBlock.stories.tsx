import type { Meta, StoryObj } from '@storybook/react';

import { CodeBlock } from './CodeBlock';

const meta = {
  title: 'Data Display/CodeBlock',
  component: CodeBlock,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SHORT_SQL = `SELECT month, SUM(amount) AS total_collections
FROM ledger
WHERE clinic_id = :client_id
  AND date BETWEEN :from_date AND :to_date
GROUP BY month
ORDER BY month ASC`;

const LONG_SQL = (() => {
  const lines: string[] = ['WITH base AS ('];
  for (let i = 0; i < 30; i += 1) {
    lines.push(
      `  SELECT t${i}.id, t${i}.amount, t${i}.posted_at FROM ledger t${i} WHERE t${i}.clinic_id = :client_id`,
    );
  }
  lines.push(')');
  lines.push('SELECT * FROM base ORDER BY posted_at DESC LIMIT 100');
  return lines.join('\n');
})();

const VERY_LONG_SQL = Array.from({ length: 200 }, (_, i) =>
  i === 0
    ? 'SELECT a.id, a.name, a.created_at,'
    : i === 199
      ? 'FROM accounts a WHERE a.clinic_id = :client_id ORDER BY a.created_at DESC'
      : `       a.col_${i},`,
).join('\n');

const SAMPLE_JSON = JSON.stringify(
  {
    success: true,
    data: {
      recipe_key: 'collections_by_month',
      confidence: 0.93,
      params: { client_id: 70014, date_range: '2026-Q1' },
      rows: [
        { month: '2026-01', total: 142336.5 },
        { month: '2026-02', total: 188205.0 },
        { month: '2026-03', total: 191522.75 },
      ],
      meta: { row_count: 3, latency_ms: 187, source: 'replica' },
    },
    error: null,
  },
  null,
  2,
);

const ONE_LONG_LINE =
  'SELECT a.id, a.name, a.email, a.phone, a.created_at, a.updated_at, a.last_seen_at, a.timezone, a.locale, a.preferred_provider_id, a.referral_source, a.notes FROM accounts a WHERE a.clinic_id = :client_id AND a.status = :status AND a.created_at > :since ORDER BY a.created_at DESC LIMIT 50';

const MALFORMED_SQL = `SELECT name FROM users WHERE name = 'unclosed
/* an unclosed comment that runs forever
SELECT * FROM other_table
`;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    children:
      'Plain text content. The default language is "text", which renders without highlighting.',
  },
};

export const SQL: Story = {
  args: {
    language: 'sql',
    children: SHORT_SQL,
  },
};

export const JsonStory: Story = {
  args: {
    language: 'json',
    children: SAMPLE_JSON,
  },
};

export const WithoutCopyButton: Story = {
  args: {
    language: 'sql',
    showCopyButton: false,
    children: SHORT_SQL,
  },
};

export const WithLineNumbers: Story = {
  args: {
    language: 'sql',
    showLineNumbers: true,
    children: LONG_SQL,
  },
};

export const LongContent: Story = {
  args: {
    language: 'sql',
    children: VERY_LONG_SQL,
    maxHeight: 320,
  },
};

export const WrappedLongLines: Story = {
  args: {
    language: 'sql',
    wrap: true,
    children: ONE_LONG_LINE,
  },
};

export const Empty: Story = {
  args: {
    children: '',
  },
};

export const CompactDensity: Story = {
  render: () => (
    <div data-density="compact">
      <CodeBlock language="sql">{SHORT_SQL}</CodeBlock>
    </div>
  ),
};

export const MalformedSQL: Story = {
  args: {
    language: 'sql',
    children: MALFORMED_SQL,
  },
};
