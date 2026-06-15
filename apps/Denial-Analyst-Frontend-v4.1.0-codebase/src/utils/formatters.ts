/**
 * Formatting utilities — currency, dates, percentages.
 *
 * Pure functions, no external deps. The FE team may already have their own;
 * if so, swap these imports. Kept here for self-containment.
 *
 * Drop-in path: src/utils/formatters.ts
 */

/** Format a dollar amount: 1354 → "$1,354" (no decimals for whole dollars,
 *  with decimals if the amount has fractional cents). */
export function formatCurrency(amount: number): string {
  const hasFractional = amount % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasFractional ? 2 : 0,
    maximumFractionDigits: hasFractional ? 2 : 0,
  }).format(amount);
}

/** Format a YYYY-MM-DD date string to "MM/DD/YY" (compact for card line 2). */
export function formatDateShort(iso: string): string {
  // Accept both YYYY-MM-DD and full ISO datetime; parse only the date part
  const datePart = iso.includes('T') ? iso.slice(0, 10) : iso;
  const parts = datePart.split('-');
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  if (year === undefined || month === undefined || day === undefined) return iso;
  return `${month}/${day}/${year.slice(2)}`;
}

/** Format a confidence decimal: 0.92 → "92%". Rounds to nearest integer. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export type UrgencyTone = 'normal' | 'today' | 'overdue';

export interface UrgencyState {
  label: string;
  tone: UrgencyTone;
}

/**
 * Derive urgency from a due_at ISO timestamp relative to `now`.
 * Returns null for due dates more than 7 days out (no badge needed), and
 * also null when no due_at is provided.
 *
 * Examples (now = 2026-06-12):
 *   due_at = 2026-06-04 → { label: "Overdue 8d", tone: "overdue" }
 *   due_at = 2026-06-12 → { label: "Today", tone: "today" }
 *   due_at = 2026-06-15 → { label: "Due 3d", tone: "normal" }
 *   due_at = 2026-07-20 → null
 *   due_at = null       → null
 */
export function deriveUrgency(dueIso: string | null, now: Date = new Date()): UrgencyState | null {
  if (dueIso === null) return null;
  const due = new Date(dueIso);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / msPerDay);

  if (diffDays < 0) {
    return { label: `Overdue ${Math.abs(diffDays)}d`, tone: 'overdue' };
  }
  // Same-day check — within the next 24 hours and same calendar day
  if (diffDays === 0) {
    return { label: 'Today', tone: 'today' };
  }
  if (diffDays <= 7) {
    return { label: `Due ${diffDays}d`, tone: 'normal' };
  }
  return null;
}

/**
 * Initials for a person name: "Renita K." → "RK", "Vipin Kumar" → "VK".
 * Strips honorifics, takes first letter of first + last name parts.
 * Falls back to "??" for empty input.
 */
export function initialsForName(name: string): string {
  const cleaned = name.trim().replace(/\.$/, '');
  if (cleaned.length === 0) return '??';
  const parts = cleaned.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return (first + last).toUpperCase();
}
