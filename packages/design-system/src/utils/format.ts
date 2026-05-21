/**
 * Time / duration formatters. Pure helpers, no React or platform deps.
 *
 * `formatDurationMs` is shared between `TraceTimeline` and `LLMCallInspector`
 * (both in `@tensaw/composition`); it lives here so composition can import
 * a single canonical implementation without duplicating tokenizers.
 */

/**
 * Format a duration in milliseconds as a short human-readable string.
 *
 * Tiered output:
 *   - `null` / `undefined` → `'—'` (the long em-dash, used as a "not yet
 *     completed" placeholder by callers like TraceTimeline).
 *   - `< 1000` ms → integer milliseconds, e.g. `'42ms'`.
 *   - `< 60_000` ms → seconds with one decimal, e.g. `'1.2s'`.
 *   - `>= 60_000` ms → minutes + seconds, e.g. `'1m 5s'`.
 *
 * The boundaries match the spec in the PromptQL trace components handoff
 * (§5.2). Negative durations are passed through to the same buckets as
 * positive ones; callers should not normally produce negatives but if a
 * clock skew does, the output will at least not crash.
 */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
