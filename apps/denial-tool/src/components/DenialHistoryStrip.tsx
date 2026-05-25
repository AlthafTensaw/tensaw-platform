/**
 * DenialHistoryStrip — surfaces prior denials on a re-denied claim.
 *
 * Lazy-fetched: only mounts when the RowDetailPanel renders, i.e. when
 * the analyst expands a worklist row. The fetch fires once per claim_id;
 * collapsing and re-expanding reuses React Query's cache.
 *
 * Hidden when count < 2 (the common case — most claims have one denial event).
 *
 * Wire shape per v1.8.1 OpenAPI:
 *   GET /v1/claims/{claim_id}/denial-events → DenialEvent[]
 * Sort: occurred_at ASC, event_id ASC (chronological, oldest first).
 * Last array element is the current denial.
 *
 * PHI per BE handoff §"PHI handling":
 *   - Codes (CO-109, M127, ...): not PHI. Always visible.
 *   - reason_text: PHI. Wrapped in <PrivacyField>.
 *   - Collapsed strip only shows the code, never reason_text.
 */

import { useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { Icon } from '@tensaw/design-system/primitives';
import { PrivacyField } from '@tensaw/design-system/rcm';
import { usePermissions } from '../auth/permissions';
import type { DenialEvent } from '../actions/schemas';

interface DenialHistoryStripProps {
  claimId: number;
  classificationId: string;
  onRevealAudit?: (eventId: number, codeIndex: number) => void;
}

function ordinalSuffix(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${String(n)}th`;
  const lastOne = n % 10;
  if (lastOne === 1) return `${String(n)}st`;
  if (lastOne === 2) return `${String(n)}nd`;
  if (lastOne === 3) return `${String(n)}rd`;
  return `${String(n)}th`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1] ?? '???'} ${String(d)}, ${String(y)}`;
}

function maskReasonText(s: string): string {
  if (s.length === 0) return '';
  return '•'.repeat(Math.min(s.length, 24));
}

export function DenialHistoryStrip({
  claimId,
  classificationId,
  onRevealAudit,
}: DenialHistoryStripProps): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);
  const { has } = usePermissions();
  const canReveal = has('denial.act');

  // Lazy-fetched on mount; cached by React Query keyed on claim_id.
  // Errors silently hide the strip (per BE handoff §"Errors":
  // 404 → claim doesn't exist; 503 → mock mode no source).
  const { data, error } = useActionQuery<DenialEvent[]>(
    'denial.denial-events',
    { claim_id: claimId },
  );

  if (error !== null || !data) return null;
  if (data.length < 2) return null;

  const count = data.length;
  const currentDenial = data[count - 1];
  const previousDenial = data[count - 2];
  if (!currentDenial || !previousDenial) return null;

  const headlineCode =
    previousDenial.carc_codes[0]?.code
    ?? previousDenial.rarc_codes[0]?.code
    ?? '—';
  const moreCount = count - 2;

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => { setIsExpanded(true); }}
        className="w-full mx-0 my-2 bg-amber-50 border border-amber-200 border-l-[3px] border-l-amber-500 rounded-md hover:bg-amber-100 transition-colors text-left"
        aria-expanded={false}
        aria-label={`${ordinalSuffix(count)} denial for this claim. Show history.`}
      >
        <div className="flex items-center gap-2 px-3 py-2 text-amber-900 text-xs">
          <Icon name="AlertTriangle" size="xs" className="text-amber-600 flex-shrink-0" />
          <span className="font-semibold">{ordinalSuffix(count)} denial</span>
          <span className="text-amber-700/50">·</span>
          <span>prior on {formatDate(previousDenial.occurred_at)}</span>
          <span className="font-mono font-semibold px-1.5 py-0.5 bg-amber-500/20 rounded text-[11px]">
            {headlineCode}
          </span>
          {moreCount > 0 ? (
            <span className="text-amber-700/85 text-[11.5px]">
              (+{String(moreCount)} more)
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1 text-amber-700 text-[11px]">
            Show history
            <Icon name="ChevronDown" size="xs" />
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className="w-full mx-0 my-2 bg-white border border-amber-200 rounded-md"
      role="region"
      aria-label="Denial history"
    >
      <div className="flex items-center gap-2 px-3 py-2 text-amber-900 text-xs border-b border-amber-200">
        <Icon name="AlertTriangle" size="xs" className="text-amber-600 flex-shrink-0" />
        <span className="font-semibold">
          Denial history · {String(count)} events
        </span>
        <button
          type="button"
          onClick={() => { setIsExpanded(false); }}
          className="ml-auto inline-flex items-center gap-1 text-amber-700 text-[11px] hover:underline"
        >
          Hide
          <Icon name="ChevronUp" size="xs" />
        </button>
      </div>

      <div className="px-3 py-2 flex flex-col gap-2">
        {data.map((event, idx) => {
          const isCurrent = idx === count - 1;
          return (
            <div
              key={event.event_id}
              className={
                isCurrent
                  ? 'grid grid-cols-[120px_1fr_auto] gap-3 p-2.5 bg-teal-50 border-l-[3px] border-teal-600 rounded items-start'
                  : 'grid grid-cols-[120px_1fr_auto] gap-3 p-2.5 bg-muted rounded items-start'
              }
            >
              <div className="text-xs font-medium text-foreground">
                {formatDate(event.occurred_at)}
                {event.procedure_code ? (
                  <span className="block font-mono text-[10.5px] text-muted-foreground mt-0.5">
                    CPT {event.procedure_code}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {event.carc_codes.map((c, ci) => (
                  <span
                    key={`carc-${String(event.event_id)}-${String(ci)}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-100 text-rose-900 text-[11.5px]"
                  >
                    <span className="font-mono font-semibold text-[10.5px]">{c.code}</span>
                    <PrivacyField
                      value={c.reason_text}
                      maskFn={maskReasonText}
                      fieldKey="denial_reason_text"
                      recordType="denial_event"
                      recordId={String(event.event_id)}
                      canReveal={canReveal}
                      onReveal={() => {
                        onRevealAudit?.(event.event_id, ci);
                      }}
                      render={({ displayValue, isRevealed, toggleReveal }) => (
                        <>
                          <span className={isRevealed ? '' : 'font-mono'}>
                            {displayValue}
                          </span>
                          {canReveal ? (
                            <button
                              type="button"
                              onClick={toggleReveal}
                              className="inline-flex items-center text-rose-700 hover:text-rose-900"
                              aria-label={isRevealed ? 'Hide reason' : 'Reveal reason'}
                            >
                              <Icon name={isRevealed ? 'EyeOff' : 'Eye'} size="xs" />
                            </button>
                          ) : null}
                        </>
                      )}
                    />
                  </span>
                ))}
                {event.rarc_codes.map((c, ci) => (
                  <span
                    key={`rarc-${String(event.event_id)}-${String(ci)}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[11.5px]"
                  >
                    <span className="font-mono font-semibold text-[10.5px]">{c.code}</span>
                    <PrivacyField
                      value={c.reason_text}
                      maskFn={maskReasonText}
                      fieldKey="denial_reason_text"
                      recordType="denial_event"
                      recordId={String(event.event_id)}
                      canReveal={canReveal}
                      onReveal={() => {
                        onRevealAudit?.(event.event_id, ci);
                      }}
                      render={({ displayValue, isRevealed, toggleReveal }) => (
                        <>
                          <span className={isRevealed ? '' : 'font-mono'}>
                            {displayValue}
                          </span>
                          {canReveal ? (
                            <button
                              type="button"
                              onClick={toggleReveal}
                              className="inline-flex items-center text-blue-700 hover:text-blue-900"
                              aria-label={isRevealed ? 'Hide reason' : 'Reveal reason'}
                            >
                              <Icon name={isRevealed ? 'EyeOff' : 'Eye'} size="xs" />
                            </button>
                          ) : null}
                        </>
                      )}
                    />
                  </span>
                ))}
              </div>

              <div>
                {isCurrent ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-semibold uppercase tracking-wide">
                    Current
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {/* classificationId reserved for reveal-phi audit dispatch when wired */}
      <span className="sr-only">classification {classificationId}</span>
    </div>
  );
}
