/**
 * Lightweight tokenizers for `<CodeBlock>`.
 *
 * Two languages are supported in-tree: `sql` and `json`. Plain `text`
 * skips highlighting entirely (the component renders the whole string in
 * one span). The tokenizers are intentionally tiny — the design system
 * has zero highlight deps (no Prism, no Shiki, no highlight.js). We
 * accept that the output is "good enough for diagnostics", not full
 * grammar-correct highlighting.
 *
 * Both functions are defensive: any region that doesn't match a known
 * pattern falls through as plain text. Malformed input (unclosed string,
 * unclosed comment) won't crash; the unmatched run is rendered verbatim
 * with no className. Tests in `CodeBlock.test.tsx` lock that in.
 */

export interface Token {
  /** Text fragment to render. Newlines preserved verbatim. */
  text: string;
  /**
   * Tailwind class string for the surrounding `<span>`, or `null` for
   * unstyled text (the component renders unstyled tokens in a span with
   * no className so React keys stay simple).
   */
  className: string | null;
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SQL_KEYWORDS = new Set<string>([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'AS',
  'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES', 'SET',
  'CREATE', 'TABLE', 'INDEX',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'WITH', 'DISTINCT', 'BETWEEN', 'LIKE', 'EXISTS', 'CAST',
  'DATE_FORMAT', 'DATE_TRUNC', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX',
]);

const SQL_KEYWORD_CLASS = 'text-teal-700 font-semibold';
const SQL_STRING_CLASS = 'text-emerald-700';
const SQL_NUMBER_CLASS = 'text-amber-700';
const SQL_COMMENT_CLASS = 'text-muted-foreground italic';
const SQL_PLACEHOLDER_CLASS = 'text-purple-700 font-medium';

/**
 * Tokenize a SQL string into a flat sequence of {text, className} segments.
 *
 * Order of recognition (longest-prefix wins at each cursor position):
 *   1. Block comment (`/&#42; ... &#42;/`)
 *   2. Line comment (`-- ... \n`)
 *   3. Single-quoted string
 *   4. Numeric literal
 *   5. Placeholder `:name` or `?`
 *   6. Identifier — matched against the keyword set; non-keywords pass
 *      through as plain text
 *   7. Anything else — single character of plain text
 */
export function tokenizeSql(input: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = input.length;

  // Buffer for runs of plain text — flushed as a single token to keep
  // the React tree shallow.
  let plain = '';
  const flushPlain = () => {
    if (plain.length > 0) {
      out.push({ text: plain, className: null });
      plain = '';
    }
  };

  while (i < n) {
    const ch = input[i];

    // Block comment
    if (ch === '/' && input[i + 1] === '*') {
      flushPlain();
      const end = input.indexOf('*/', i + 2);
      if (end === -1) {
        // Unclosed — consume to end as comment
        out.push({ text: input.slice(i), className: SQL_COMMENT_CLASS });
        i = n;
      } else {
        out.push({ text: input.slice(i, end + 2), className: SQL_COMMENT_CLASS });
        i = end + 2;
      }
      continue;
    }

    // Line comment
    if (ch === '-' && input[i + 1] === '-') {
      flushPlain();
      const end = input.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out.push({ text: input.slice(i, stop), className: SQL_COMMENT_CLASS });
      i = stop;
      continue;
    }

    // Single-quoted string (SQL escape: `''`)
    if (ch === "'") {
      flushPlain();
      let j = i + 1;
      while (j < n) {
        if (input[j] === "'" && input[j + 1] === "'") {
          j += 2; // escaped quote inside the string
          continue;
        }
        if (input[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      out.push({ text: input.slice(i, j), className: SQL_STRING_CLASS });
      i = j;
      continue;
    }

    // Number — integer or decimal, must start at a digit (never inside an identifier)
    if (ch !== undefined && /[0-9]/.test(ch)) {
      const prev = i > 0 ? input[i - 1] : ' ';
      // Only treat as number if previous char is not part of an identifier
      if (prev === undefined || !/[A-Za-z_]/.test(prev)) {
        flushPlain();
        let j = i;
        while (j < n) {
          const cc = input[j];
          if (cc !== undefined && /[0-9.]/.test(cc)) {
            j += 1;
          } else {
            break;
          }
        }
        out.push({ text: input.slice(i, j), className: SQL_NUMBER_CLASS });
        i = j;
        continue;
      }
    }

    // Placeholder `:name`
    if (ch === ':') {
      const nx = input[i + 1];
      if (nx !== undefined && /[A-Za-z_]/.test(nx)) {
        flushPlain();
        let j = i + 1;
        while (j < n) {
          const cc = input[j];
          if (cc === undefined || !/[A-Za-z0-9_]/.test(cc)) break;
          j += 1;
        }
        out.push({ text: input.slice(i, j), className: SQL_PLACEHOLDER_CLASS });
        i = j;
        continue;
      }
    }

    // Placeholder `?`
    if (ch === '?') {
      flushPlain();
      out.push({ text: '?', className: SQL_PLACEHOLDER_CLASS });
      i += 1;
      continue;
    }

    // Identifier (keyword candidate)
    if (ch !== undefined && /[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n) {
        const cc = input[j];
        if (cc === undefined || !/[A-Za-z0-9_]/.test(cc)) break;
        j += 1;
      }
      const word = input.slice(i, j);
      if (SQL_KEYWORDS.has(word.toUpperCase())) {
        flushPlain();
        out.push({ text: word, className: SQL_KEYWORD_CLASS });
      } else {
        plain += word;
      }
      i = j;
      continue;
    }

    // Plain character
    plain += ch ?? '';
    i += 1;
  }

  flushPlain();
  return out;
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

const JSON_KEY_CLASS = 'text-slate-700 font-semibold';
const JSON_STRING_CLASS = 'text-emerald-700';
const JSON_NUMBER_CLASS = 'text-amber-700';
const JSON_LITERAL_CLASS = 'text-muted-foreground font-medium';
const JSON_PUNCT_CLASS = 'text-foreground';

/**
 * Tokenize a JSON string into a flat sequence of {text, className} segments.
 *
 * Distinguishes keys from values by lookahead: a quoted string immediately
 * followed (after optional whitespace) by `:` is treated as a key. Anything
 * else stays a string.
 *
 * Defensive: malformed JSON renders the recognized portion correctly and
 * the rest as plain text. We do not attempt to "fix" or validate.
 */
export function tokenizeJson(input: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = input.length;

  let plain = '';
  const flushPlain = () => {
    if (plain.length > 0) {
      out.push({ text: plain, className: null });
      plain = '';
    }
  };

  while (i < n) {
    const ch = input[i];

    // Quoted string (key or value)
    if (ch === '"') {
      flushPlain();
      let j = i + 1;
      while (j < n) {
        if (input[j] === '\\' && j + 1 < n) {
          j += 2;
          continue;
        }
        if (input[j] === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      // Lookahead: skip whitespace, check for `:`
      let k = j;
      while (k < n) {
        const cc = input[k];
        if (cc === undefined || !/\s/.test(cc)) break;
        k += 1;
      }
      const isKey = input[k] === ':';
      out.push({
        text: input.slice(i, j),
        className: isKey ? JSON_KEY_CLASS : JSON_STRING_CLASS,
      });
      i = j;
      continue;
    }

    // Number — integer / decimal / scientific
    if (ch !== undefined && /[-0-9]/.test(ch)) {
      const prev = i > 0 ? input[i - 1] : ' ';
      const next = input[i + 1];
      // Only at the start of a number — don't gobble - inside identifiers
      if (
        ch === '-'
          ? next !== undefined && /[0-9]/.test(next)
          : prev === undefined || !/[A-Za-z_]/.test(prev)
      ) {
        flushPlain();
        let j = i + (ch === '-' ? 1 : 0);
        // integer part
        while (j < n) {
          const cc = input[j];
          if (cc === undefined || !/[0-9]/.test(cc)) break;
          j += 1;
        }
        // optional fraction
        if (input[j] === '.') {
          j += 1;
          while (j < n) {
            const cc = input[j];
            if (cc === undefined || !/[0-9]/.test(cc)) break;
            j += 1;
          }
        }
        // optional exponent
        if (input[j] === 'e' || input[j] === 'E') {
          j += 1;
          if (input[j] === '+' || input[j] === '-') j += 1;
          while (j < n) {
            const cc = input[j];
            if (cc === undefined || !/[0-9]/.test(cc)) break;
            j += 1;
          }
        }
        out.push({ text: input.slice(i, j), className: JSON_NUMBER_CLASS });
        i = j;
        continue;
      }
    }

    // Literal: true / false / null
    if (ch === 't' || ch === 'f' || ch === 'n') {
      const remaining = input.slice(i);
      let lit: string | null = null;
      if (remaining.startsWith('true')) lit = 'true';
      else if (remaining.startsWith('false')) lit = 'false';
      else if (remaining.startsWith('null')) lit = 'null';
      if (lit) {
        flushPlain();
        out.push({ text: lit, className: JSON_LITERAL_CLASS });
        i += lit.length;
        continue;
      }
    }

    // Punctuation
    if (ch !== undefined && /[{}[\]:,]/.test(ch)) {
      flushPlain();
      out.push({ text: ch, className: JSON_PUNCT_CLASS });
      i += 1;
      continue;
    }

    plain += ch ?? '';
    i += 1;
  }

  flushPlain();
  return out;
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

export function tokenize(language: 'sql' | 'json' | 'text', input: string): Token[] {
  if (language === 'sql') return tokenizeSql(input);
  if (language === 'json') return tokenizeJson(input);
  return [{ text: input, className: null }];
}
