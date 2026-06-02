/**
 * v3.0 display formatters.
 *
 * Centralizes the formatting decisions from the mockup iterations:
 *   - Dates: mm/dd/yy
 *   - Patient names: "Lastname, F" (lastname max 10 chars + first initial)
 *   - Entity aliases: prefer BE alias, fallback to truncated name, max 10
 *   - Financials short (no decimals) for dense card displays
 *   - Financials full (2 decimals) for line-item drilldowns
 *
 * Imported by left-pane card, work-pane banner, all tab content.
 */

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * formatDate — ISO 8601 or date string → "mm/dd/yy".
 * Returns "—" for null/invalid input. Display-only; never use for sorting.
 */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // pass through if not parseable
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/**
 * formatDateTime — "mm/dd/yy HH:mm" for notes timestamps etc.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const date = formatDate(value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Name formatting
// ---------------------------------------------------------------------------

const MAX_LASTNAME_CHARS = 10;

/**
 * formatPatientName — accepts "Lastname, Firstname" or "Firstname Lastname"
 * and returns "Lastname, F" with lastname truncated to 10 chars.
 *
 * Defensive — if input is malformed (single token, empty), returns "—" or
 * the input clipped.
 */
export function formatPatientName(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const trimmed = value.trim();

  // "Lastname, Firstname [Middle...]"
  if (trimmed.includes(',')) {
    const [last, rest] = trimmed.split(',');
    const lastClipped = (last ?? '').trim().slice(0, MAX_LASTNAME_CHARS);
    const firstInitial = (rest ?? '').trim().charAt(0).toUpperCase();
    return firstInitial !== '' ? `${lastClipped}, ${firstInitial}` : lastClipped;
  }

  // "Firstname [Middle...] Lastname"
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) return tokens[0]!.slice(0, MAX_LASTNAME_CHARS);
  const last = tokens[tokens.length - 1]!;
  const first = tokens[0]!;
  return `${last.slice(0, MAX_LASTNAME_CHARS)}, ${first.charAt(0).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Entity alias (payer / clinic / facility)
// ---------------------------------------------------------------------------

const MAX_ALIAS_CHARS = 10;

/**
 * displayEntity — given an entity with name + optional alias, return what
 * to render in dense screens. Prefers alias; falls back to truncated name.
 * Truncates defensively if BE-provided alias exceeds the limit (bug guard).
 */
export function displayEntity(
  entity:
    | { name?: string | null; alias?: string | null }
    | string
    | null
    | undefined,
): string {
  if (entity === null || entity === undefined) return '—';
  if (typeof entity === 'string') return truncate(entity, MAX_ALIAS_CHARS);
  const candidate = entity.alias ?? entity.name ?? '';
  return truncate(candidate, MAX_ALIAS_CHARS);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Money formatting
// ---------------------------------------------------------------------------

/**
 * formatMoneyShort — "$1,354" (rounded, no decimals) for dense displays.
 * Accepts decimal-string or number. Returns "$0" for zero, "—" for null.
 */
export function formatMoneyShort(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '—';
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString()}`;
}

/**
 * formatMoneyFull — "$1,353.93" (2 decimals) for line-item drilldowns
 * and transaction logs.
 */
export function formatMoneyFull(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '—';
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * formatMoneySigned — "+$1,353.93" or "−$65.00" for transaction amounts.
 * Uses minus sign U+2212 not hyphen for typographic correctness.
 */
export function formatMoneySigned(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '—';
  if (n === 0) return '$0';
  const sign = n < 0 ? '\u2212' : '+';
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// File size formatting
// ---------------------------------------------------------------------------

/**
 * formatFileSize — "2.4 MB" / "312 KB" / "84 B".
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
