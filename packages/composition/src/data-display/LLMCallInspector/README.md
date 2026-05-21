# LLMCallInspector

Render a single LLM API call's request, response, and metadata for diagnostic inspection. Designed to live inside the expanded `details` of a `TraceTimeline` stage that made an LLM call (in PromptQL: `classify_turn`, `select_recipe`, `extract_and_resolve_entities`).

## Usage

```tsx
import { LLMCallInspector } from '@tensaw/composition/data-display';

<LLMCallInspector
  model="gpt-4o-mini"
  provider="openai"
  durationMs={412}
  promptTokens={1247}
  completionTokens={87}
  status="ok"
  request={`You are a recipe selector. Given the prompt "..." and these candidates [...], return the best match as JSON.`}
  response={`{ "recipe_key": "collections_by_month", "confidence": 0.93, "reasoning": "..." }`}
  responseLanguage="json"
/>

<LLMCallInspector
  model="gpt-4o-mini"
  provider="openai"
  durationMs={2103}
  status="fallback"
  error="Primary LLM timed out after 2s; succeeded on Gemini backup."
  request="..."
  response="..."
  responseLanguage="json"
/>
```

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `model` | `string` | (required) | Model id, e.g. `"gpt-4o-mini"`. |
| `provider` | `LLMProvider` | (required) | `"openai" \| "anthropic" \| "gemini" \| "mock" \| string`. |
| `durationMs` | `number` | (required) | Wall-clock duration of the call, in ms. Formatted via `formatDurationMs`. |
| `promptTokens` | `number` | — | Optional. |
| `completionTokens` | `number` | — | Optional. |
| `request` | `string` | (required) | The prompt sent to the model. Empty string → "No content" placeholder. |
| `response` | `string` | (required) | The raw response. |
| `responseLanguage` | `'json' \| 'text'` | `'text'` | Pass `'json'` for syntax highlighting. |
| `status` | `'ok' \| 'failed' \| 'fallback'` | (required) | `'fallback'` means primary failed, backup succeeded. |
| `error` | `string` | — | Required-in-spirit when `status !== 'ok'`. If omitted, a generic message displays. |
| `defaultOpen` | `{ request?: boolean; response?: boolean }` | both `false` | Initial accordion state. After mount, the user owns the toggle. |
| `className` | `string` | — | Class merge on the outer Card. |

## Variants

The visual treatment is one shape; the variation is in `status`:

| Status | Status badge | Alert banner |
|---|---|---|
| `ok` | `OK` (success) | none |
| `fallback` | `Fallback` (warning) | warning Alert with `error` text |
| `failed` | `Failed` (error) | error Alert with `error` text |

## Token formatting

The right cluster of the header shows duration + an optional token summary. Format depends on which token counts are present:

| Inputs | Display |
|---|---|
| Both `promptTokens` and `completionTokens` | `1.2k → 87` |
| Only `promptTokens` | `1.2k in` |
| Only `completionTokens` | `87 out` |
| Neither | nothing |

Counts under 1000 render as integers; ≥1000 render as `Nk` with one decimal.

## Accessibility

- Outer Card has `role="article"` with `aria-label={`LLM call to ${model} (${status})`}`.
- The Request and Response section headers are real `<button>` elements (rendered by Accordion); they expose `aria-expanded` and `aria-controls` to the panel.
- The optional Alert banner uses the design-system `<Alert>` which is already a11y-correct.

## PII / PHI

This component does **not** scrub PII or PHI. The caller is responsible for ensuring `request` and `response` strings are safe to render before passing them in. PromptQL's pipeline has scrubbing built into its own observability layer; for other consumers, scrub on the way in.

## Related

- **`CodeBlock`** in `@tensaw/design-system/data-display` — used internally to render `request` and `response` with optional syntax highlighting.
- **`TraceTimeline`** in `@tensaw/composition/data-display` — the natural parent. LLMCallInspector is the canonical payload for an LLM-call stage's `details`.
- **`Alert`** in `@tensaw/design-system/feedback` — used for the failure/fallback banner.
- **`Accordion`** in `@tensaw/design-system/layout` — used for the Request / Response toggles.

## Anti-patterns

- ❌ **Don't render multiple LLMCallInspectors for a retry loop.** If a node retried, render one inspector with `status: 'fallback'` and put both attempts' detail in the request/response (or extend the API in a future revision; a `History` slot or similar). One row per node.
- ❌ **Don't include PII / PHI scrubbing logic inside this component.** It assumes scrubbed inputs.
- ❌ **Don't put this component at the top of a page.** It's designed to be embedded inside another container (TraceTimeline's expanded panel, a right-rail card, etc.). Hence `shadow-none`.
