/**
 * CodeBlock — render a fixed string as code with optional syntax
 * highlighting, copy-to-clipboard, max-height scroll, and line numbers.
 *
 * Designed for diagnostic snippets (SQL, JSON envelopes, prompts/responses).
 * For inline code inside paragraphs, use a raw `<code>` element. For very
 * large dumps (>2000 lines), CodeBlock is not virtualized — a different
 * component would be required.
 *
 * Highlighting is done by tiny in-tree tokenizers (`CodeBlock.highlight.ts`);
 * we do not depend on Prism, Shiki, or highlight.js. The output is "good
 * enough for diagnostics".
 *
 * Density: respects `[data-density="compact"]` on an ancestor by reducing
 * padding. All other styling resolves through shadcn-style CSS variables —
 * no hardcoded hex values.
 */
import {
  forwardRef,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '../../utils/cn';
import { IconButton } from '../../primitives/IconButton';
import { Tooltip } from '../../overlays/Tooltip';
import { tokenize, type Token } from './CodeBlock.highlight';

export type CodeBlockLanguage = 'sql' | 'json' | 'text';

export interface CodeBlockProps {
  /** The code content, as a single string. Newlines preserved verbatim. */
  children: string;
  /** Determines syntax highlighting. Default: 'text'. */
  language?: CodeBlockLanguage;
  /** Show the copy-to-clipboard button in the top-right. Default: true. */
  showCopyButton?: boolean;
  /** Show line numbers in the gutter. Default: false. */
  showLineNumbers?: boolean;
  /** Max height before vertical scroll engages. Number = px, string = any CSS. Default: 320. */
  maxHeight?: number | string;
  /** Soft-wrap long lines instead of horizontal scroll. Default: false. */
  wrap?: boolean;
  /** Optional aria-label override for screen readers. */
  'aria-label'?: string;
  /** Class merge support. */
  className?: string;
}

const COPY_RESET_MS = 1500;

const LANGUAGE_LABEL: Record<CodeBlockLanguage, string> = {
  sql: 'SQL',
  json: 'JSON',
  text: 'Text',
};

export const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(
  function CodeBlock(
    {
      children,
      language = 'text',
      showCopyButton = true,
      showLineNumbers = false,
      maxHeight = 320,
      wrap = false,
      'aria-label': ariaLabel,
      className,
    },
    ref,
  ) {
    const [justCopied, setJustCopied] = useState(false);
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const liveRegionId = useId();

    const isEmpty = children.trim().length === 0;

    const computedAriaLabel =
      ariaLabel ?? `${LANGUAGE_LABEL[language]} code block`;

    // Tokenize once per (language, source) pair. Highlighting is pure, so
    // memoizing on input identity is sufficient.
    const tokens: Token[] = useMemo(
      () => (isEmpty ? [] : tokenize(language, children)),
      [language, children, isEmpty],
    );

    // Line-number gutter — counted from the source string, not the tokens,
    // so wrapping doesn't bump the line count.
    const lineCount = useMemo(
      () => (children.length === 0 ? 0 : children.split('\n').length),
      [children],
    );

    const handleCopy = useCallback(async () => {
      // Defensive — clipboard API may be unavailable in insecure contexts or
      // denied by permission. Don't throw; log + revert immediately.
      try {
        // `Navigator.clipboard` is typed as required in the TS lib but is
        // genuinely optional at runtime (insecure contexts, older browsers,
        // denied permission). Cast through `unknown` to defeat the
        // non-nullable type and guard explicitly.
        const clip = (navigator as unknown as { clipboard?: Clipboard })
          .clipboard;
        if (!clip) {
          throw new Error('Clipboard API unavailable');
        }
        await clip.writeText(children);
        setJustCopied(true);
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = setTimeout(() => {
          setJustCopied(false);
          resetTimeoutRef.current = null;
        }, COPY_RESET_MS);
      } catch (err) {
        console.warn('[CodeBlock] copy failed:', err);
        setJustCopied(false);
      }
    }, [children]);

    const inlineMaxHeight: CSSProperties = {
      maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
    };

    return (
      <figure
        ref={ref}
        role="region"
        aria-label={computedAriaLabel}
        className={cn(
          'relative overflow-hidden rounded-lg border border-border bg-muted',
          'data-[density=compact]:rounded-md',
          className,
        )}
      >
        {/*
          Visually-hidden live region for the screen-reader copy
          announcement. We toggle it via the `justCopied` flag.
        */}
        <span
          id={liveRegionId}
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {justCopied ? 'Copied' : ''}
        </span>

        {showCopyButton && !isEmpty && (
          <div className="absolute right-2 top-2 z-10">
            <Tooltip content={justCopied ? 'Copied!' : 'Copy code'}>
              <IconButton
                variant="ghost"
                aria-label={justCopied ? 'Copied' : 'Copy code'}
                onClick={() => {
                  void handleCopy();
                }}
                icon={
                  justCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
              />
            </Tooltip>
          </div>
        )}

        <pre
          tabIndex={0}
          className={cn(
            'overflow-auto px-4 py-3 text-[13px] leading-relaxed text-foreground',
            'font-mono',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            // Compact density — reduce padding when an ancestor has it set
            'data-[density=compact]:px-3 data-[density=compact]:py-2',
            wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
            // Reserve right padding for the copy button when it's visible
            showCopyButton && !isEmpty ? 'pr-12' : '',
          )}
          style={inlineMaxHeight}
        >
          {isEmpty ? (
            <span className="italic text-muted-foreground">(empty)</span>
          ) : showLineNumbers ? (
            <LineNumberedCode tokens={tokens} lineCount={lineCount} />
          ) : (
            <code>
              {tokens.map((tok, idx) =>
                tok.className ? (
                  <span key={idx} className={tok.className}>
                    {tok.text}
                  </span>
                ) : (
                  <span key={idx}>{tok.text}</span>
                ),
              )}
            </code>
          )}
        </pre>
      </figure>
    );
  },
);
CodeBlock.displayName = 'CodeBlock';

// ---------------------------------------------------------------------------
// Line-numbered render path
// ---------------------------------------------------------------------------

/**
 * Renders the tokenized code with a left gutter of line numbers.
 *
 * Strategy: re-walk the tokens, splitting at `\n`. Each line emits its
 * tokens in order. The gutter is a separate column with `select-none` and
 * `aria-hidden="true"` so it doesn't pollute screen-reader output.
 */
function LineNumberedCode({
  tokens,
  lineCount,
}: {
  tokens: Token[];
  lineCount: number;
}) {
  // Split the token stream into per-line arrays. A token containing `\n`
  // gets split; the boundary line is closed and a new one started.
  const lines: Token[][] = [[]];
  for (const tok of tokens) {
    const parts = tok.text.split('\n');
    parts.forEach((part, i) => {
      if (part.length > 0) {
        const tail = lines[lines.length - 1];
        if (tail) tail.push({ text: part, className: tok.className });
      }
      if (i < parts.length - 1) {
        lines.push([]);
      }
    });
  }

  // Width of the gutter — derived from the line count so the digits fit
  // without horizontal jitter.
  const gutterWidthCh = String(lineCount).length;

  return (
    <div className="flex">
      <div
        aria-hidden="true"
        className="select-none border-r border-border pr-3 text-muted-foreground"
        style={{ minWidth: `${gutterWidthCh}ch` }}
      >
        {lines.map((_, i) => (
          <div key={i} className="text-right">
            {i + 1}
          </div>
        ))}
      </div>
      <code className="block flex-1 pl-3">
        {lines.map((line, i) => (
          <div key={i}>
            {line.length === 0 ? (
              <span> </span>
            ) : (
              line.map((tok, j) =>
                tok.className ? (
                  <span key={j} className={tok.className}>
                    {tok.text}
                  </span>
                ) : (
                  <span key={j}>{tok.text}</span>
                ),
              )
            )}
          </div>
        ))}
      </code>
    </div>
  );
}
