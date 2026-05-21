import type { Meta, StoryObj } from '@storybook/react';

import { LLMCallInspector } from './LLMCallInspector';

const meta = {
  title: 'Data Display/LLMCallInspector',
  component: LLMCallInspector,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof LLMCallInspector>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Fixtures (canonical PromptQL recipe-selection prompt + response)
// ---------------------------------------------------------------------------

const RECIPE_PROMPT = `You are a recipe selector for the PromptQL pipeline. Given the user's prompt and a list of candidate recipes, return the best match as JSON.

User prompt: "Show me collections by month for ABC Cardiology last quarter"

Candidates:
- collections_by_month — Monthly collections summary
- collections_by_payer — Collections grouped by payer
- collections_aging — Aging breakdown of receivables
- denial_reasons — Top denial reasons

Return: {"recipe_key": <string>, "confidence": <number 0..1>, "reasoning": <string>}`;

const RECIPE_RESPONSE = JSON.stringify(
  {
    recipe_key: 'collections_by_month',
    confidence: 0.93,
    reasoning:
      'The prompt explicitly requests "collections by month" which matches the recipe name and description directly. The "last quarter" time scope fits the monthly grain.',
  },
  null,
  2,
);

const LONG_PROMPT = (() => {
  const lines: string[] = [
    'You are a parameter resolver for the PromptQL pipeline. Resolve every parameter referenced in the user prompt against the entity catalog and return JSON.',
    '',
    'User prompt: "Show me collections by month for ABC Cardiology in Q1 2026, broken down by payer, excluding voided claims and write-offs"',
    '',
    'Entity catalog:',
  ];
  for (let i = 0; i < 60; i += 1) {
    lines.push(`  - clinic_${i.toString().padStart(3, '0')}: Clinic ${i}`);
  }
  lines.push('', 'Return: {"params": [...], "unresolved": [...], "ambiguities": [...]}');
  return lines.join('\n');
})();

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 412,
    promptTokens: 1247,
    completionTokens: 87,
    status: 'ok',
    request: RECIPE_PROMPT,
    response: RECIPE_RESPONSE,
    responseLanguage: 'json',
  },
};

export const WithoutTokens: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 312,
    status: 'ok',
    request: RECIPE_PROMPT,
    response: RECIPE_RESPONSE,
    responseLanguage: 'json',
  },
};

export const Fallback: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 2103,
    promptTokens: 1247,
    completionTokens: 87,
    status: 'fallback',
    error:
      'Primary LLM (OpenAI) timed out after 2000ms. Succeeded on Gemini backup.',
    request: RECIPE_PROMPT,
    response: RECIPE_RESPONSE,
    responseLanguage: 'json',
  },
};

export const Failed: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 5000,
    status: 'failed',
    error:
      'All LLM providers exhausted. OpenAI: timeout. Anthropic: 429 rate limit. Gemini: connection refused.',
    request: RECIPE_PROMPT,
    response: '',
  },
};

export const LongPrompt: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 487,
    promptTokens: 4123,
    completionTokens: 156,
    status: 'ok',
    request: LONG_PROMPT,
    response: '{"params": [], "unresolved": ["clinic"], "ambiguities": []}',
    responseLanguage: 'json',
    defaultOpen: { request: true },
  },
};

export const JSONResponse: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 198,
    promptTokens: 234,
    completionTokens: 41,
    status: 'ok',
    request: 'Return the structured intent as JSON.',
    response: JSON.stringify(
      {
        intent_family: 'collections',
        confidence: 0.88,
        candidates: ['collections_by_month', 'collections_by_payer'],
      },
      null,
      2,
    ),
    responseLanguage: 'json',
    defaultOpen: { response: true },
  },
};

export const TextResponse: Story = {
  args: {
    model: 'claude-3-5-sonnet',
    provider: 'anthropic',
    durationMs: 612,
    promptTokens: 1100,
    completionTokens: 240,
    status: 'ok',
    request:
      'Summarize the meaning of "collections by month" in plain English.',
    response:
      'Collections by month is a summary that groups payments received during each calendar month. The grain is the calendar month; the value is the sum of payment_posted_amount for each month in the range. Voided claims and write-offs are typically excluded by default.',
    responseLanguage: 'text',
    defaultOpen: { response: true },
  },
};

export const EmptyContent: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 50,
    status: 'ok',
    request: '',
    response: '',
    defaultOpen: { request: true, response: true },
  },
};

export const DefaultOpen: Story = {
  args: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    durationMs: 412,
    promptTokens: 1247,
    completionTokens: 87,
    status: 'ok',
    request: RECIPE_PROMPT,
    response: RECIPE_RESPONSE,
    responseLanguage: 'json',
    defaultOpen: { request: true, response: true },
  },
};
