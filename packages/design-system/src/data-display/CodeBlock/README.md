# CodeBlock

Render a fixed string as code — SQL, JSON, or plain text — with optional syntax highlighting, a copy-to-clipboard button, controlled max height with internal scroll, and optional line numbers. Designed for diagnostic snippets the user will read and possibly copy: generated SQL, response envelopes, prompts, model outputs.

## Usage

```tsx
import { CodeBlock } from '@tensaw/design-system';

<CodeBlock language="sql">
  {`SELECT month, SUM(amount) AS total_collections
FROM ledger
WHERE clinic_id = :client_id
GROUP BY month
ORDER BY month ASC`}
</CodeBlock>

<CodeBlock language="json" maxHeight={200}>
  {JSON.stringify(envelope, null, 2)}
</CodeBlock>
```

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | `string` | (required) | Source content. Newlines preserved verbatim. |
| `language` | `'sql' \| 'json' \| 'text'` | `'text'` | Selects the in-tree tokenizer. `'text'` skips highlighting. |
| `showCopyButton` | `boolean` | `true` | Top-right copy button. Hidden automatically when content is empty. |
| `showLineNumbers` | `boolean` | `false` | Renders a `aria-hidden` gutter of line numbers. |
| `maxHeight` | `number \| string` | `320` | Number → px. String → any CSS height (e.g. `"40vh"`). |
| `wrap` | `boolean` | `false` | When `true`, long lines wrap; otherwise horizontal scroll. |
| `aria-label` | `string` | derived from language | Override the region's accessible name. |
| `className` | `string` | — | Class merge support on the outer `<figure>`. |

## Variants

The visual treatment doesn't vary; only the highlighter does. The three languages each get distinct token coloring:

- **SQL** — keywords (teal), strings (emerald), numbers (amber), comments (italic muted), placeholders (`:name` / `?` in purple).
- **JSON** — keys distinguished from string values; numbers (amber), `true`/`false`/`null` (muted), punctuation (foreground).
- **Text** — no highlighting; the content is rendered in a single span.

The tokenizers are written by hand in `CodeBlock.highlight.ts`; we deliberately avoid Prism, Shiki, and highlight.js to keep the bundle small. Output is "good enough for diagnostics", not full grammar-correct highlighting. Malformed input never crashes — unrecognized regions fall through as plain text.

## Accessibility

- Outer element is `<figure role="region">` with a computed or supplied `aria-label`.
- The `<pre>` is keyboard-focusable (`tabIndex={0}`) so users can scroll it with arrow keys.
- The copy button has `aria-label="Copy code"` (`"Copied"` while showing the success state). A visually-hidden `aria-live="polite"` status node announces "Copied" after a successful copy.
- Line numbers have `aria-hidden="true"` so screen readers don't enumerate every digit.
- Color combinations meet WCAG AA contrast at 13px regular over the muted background.

## Density

Respects `[data-density="compact"]` on an ancestor by tightening padding (12px → 8px). All other styling resolves through shadcn-style CSS variables.

## Related

- **`Pagination`** — sibling under `data-display/`. Different shape (page-number nav vs. code rendering); listed here for navigation.
- **`Tooltip`** — used internally for the "Copy code" / "Copied!" hover hint.
- **`IconButton`** — used internally for the copy button.

## Anti-patterns

- ❌ **Don't render large code blocks (>2000 lines) without virtualization.** CodeBlock is for diagnostic snippets. For raw dumps, a different component is needed (none exists yet).
- ❌ **Don't use CodeBlock for inline code inside paragraphs.** Use a raw `<code>` element.
- ❌ **Don't `dangerouslySetInnerHTML` the children.** Everything must go through React text rendering. The component does not sanitize HTML; it renders the string literally as text.
- ❌ **Don't pass markup-like content expecting it to render.** `<script>alert(1)</script>` shows up as the literal string.
