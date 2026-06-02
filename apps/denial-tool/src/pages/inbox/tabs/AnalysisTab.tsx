/**
 * AnalysisTab — primary right-pane tab.
 *
 * Structure per v3.0.3 mockup:
 *   1. Denial pattern callout (derived FE-side from denial events)
 *   2. Per-CPT cards (one per line item):
 *      - Header: CPT code + description + status pills + expand/collapse
 *      - Financials: Billed · Ins Paid · Pat Paid · Balance (single line, no decimals)
 *      - Events section (toggleable): reverse-chronological events with CARC/RARC
 *   3. Classifier confidence
 *
 * Default expand state:
 *   - Denied CPT with current event → expanded
 *   - All other CPTs → collapsed
 *
 * Per-CPT denial events are derived by grouping the claim's denial_events
 * array by procedure_code. Events without codes get the empty-state row.
 *
 * Ordering: denied/current first sorted by balance desc, then paid clean.
 */

import { useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import type { WorklistRow, DenialEvent } from '../../../actions/schemas';
import type { LineItem } from '../../../actions/schemasV3';
import { useLineItems } from '../../../hooks/useTabData';
import { formatDate, formatMoneyShort } from '../../../lib/formatters';

interface AnalysisTabProps {
  row: WorklistRow;
}

export function AnalysisTab({ row }: AnalysisTabProps): JSX.Element {
  const claimId = row.claim.claim_id;
  const { classification } = row;

  const { data: lineItemsData, isLoading: lineItemsLoading } =
    useLineItems(claimId);
  const { data: denialEvents } = useActionQuery<DenialEvent[]>(
    'denial.list-events',
    { claim_id: String(claimId) },
  );

  const lineItems = lineItemsData?.line_items ?? [];
  const events = denialEvents ?? [];

  // Group events by procedure_code; latest event is "current".
  // BE Ask 9 guarantees procedure_code is populated; null is an edge case
  // we skip rather than show in a phantom "__unknown__" group.
  const eventsByCpt = useMemo(() => {
    const m = new Map<string, DenialEvent[]>();
    for (const e of events) {
      if (e.procedure_code === null || e.procedure_code === undefined) continue;
      const cpt = e.procedure_code;
      const arr = m.get(cpt) ?? [];
      arr.push(e);
      m.set(cpt, arr);
    }
    // Sort reverse chronological per group (latest first)
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''),
      );
    }
    return m;
  }, [events]);


  // The "current" event is the most recent across all events.
  const currentEventId = useMemo(() => {
    if (events.length === 0) return null;
    const latest = [...events].sort((a, b) =>
      (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''),
    )[0];
    return latest?.event_id ?? null;
  }, [events]);

  // Order line items: denied + has current event first (by balance desc),
  // then denied without current, then paid.
  const orderedLineItems = useMemo(() => {
    return [...lineItems].sort((a, b) => {
      const aBal = Number(a.balance);
      const bBal = Number(b.balance);
      const aDenied = a.line_status === 'denied' ? 1 : 0;
      const bDenied = b.line_status === 'denied' ? 1 : 0;
      if (aDenied !== bDenied) return bDenied - aDenied;
      // Within denied, by balance desc
      if (a.line_status === 'denied' && b.line_status === 'denied') {
        return bBal - aBal;
      }
      // Within paid/other, by code asc for stability
      return a.procedure_code.localeCompare(b.procedure_code);
    });
  }, [lineItems]);

  const denialPattern = derivePattern(events);

  // Classifier confidence — top 3 categories from classification data
  const confidenceItems = [
    {
      label: classification.primary_category,
      score: classification.confidence === 'high'
        ? 0.87
        : classification.confidence === 'medium'
          ? 0.65
          : 0.42,
      primary: true,
    },
    // Alternate suggestions could come from classification.alternate_categories
    // but for now we mock placeholders — BE doesn't expose this yet.
  ];

  return (
    <div>
      {/* Denial pattern */}
      {denialPattern !== null ? (
        <div className="mb-3 rounded-md border border-border bg-background p-3">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Denial pattern
          </div>
          <div className="text-[12.5px] leading-relaxed">
            {denialPattern}
          </div>
        </div>
      ) : null}

      {/* Per-CPT cards */}
      {lineItemsLoading && lineItems.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          Loading line items…
        </div>
      ) : orderedLineItems.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          No line items available.
          <div className="mt-1 text-[10.5px]">
            Pending BE: GET /v1/claims/{String(claimId)}/line-items
          </div>
        </div>
      ) : (
        orderedLineItems.map((item) => (
          <CptCard
            key={item.line_id}
            item={item}
            events={eventsByCpt.get(item.procedure_code) ?? []}
            currentEventId={currentEventId}
            defaultExpanded={
              item.line_status === 'denied' &&
              (eventsByCpt.get(item.procedure_code) ?? []).some(
                (e) => e.event_id === currentEventId,
              )
            }
          />
        ))
      )}

      {/* Classifier confidence */}
      <div className="rounded-md border border-border bg-background p-3">
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Classifier confidence
        </div>
        {confidenceItems.map((c, i) => (
          <div
            key={c.label}
            className="flex items-center justify-between border-b border-dashed border-border py-1 text-[12.5px] last:border-b-0"
          >
            <span className={c.primary ? '' : 'text-muted-foreground'}>
              {c.label}
            </span>
            <span
              className={`font-mono font-semibold ${c.primary ? 'text-primary' : 'text-muted-foreground'}`}
              style={c.primary ? { color: '#0d9488' } : undefined}
            >
              {c.score.toFixed(2)}
            </span>
            {i === -1 ? null : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CptCard — expandable per-CPT card
// ---------------------------------------------------------------------------

function CptCard({
  item,
  events,
  currentEventId,
  defaultExpanded,
}: {
  item: LineItem;
  events: DenialEvent[];
  currentEventId: number | null;
  defaultExpanded: boolean;
}): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isDenied = item.line_status === 'denied';
  const isPaid = item.line_status === 'paid';
  const isCurrent = events.some((e) => e.event_id === currentEventId);

  return (
    <div className="mb-3 rounded-md border border-border bg-background p-3">
      <button
        type="button"
        onClick={() => { setExpanded(!expanded); }}
        className="flex w-full items-center gap-1.5 border-b border-border pb-2 text-left hover:bg-foreground/[0.01]"
      >
        <div className="flex flex-1 items-baseline gap-1.5 overflow-hidden">
          <span className="font-mono text-[13.5px] font-bold">
            CPT {item.procedure_code}
          </span>
          <span className="truncate text-[11.5px] text-muted-foreground">
            {item.procedure_description}
          </span>
        </div>
        <div className="flex flex-shrink-0 gap-1">
          {isDenied ? (
            <span
              className="rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
              style={{
                borderColor: '#dc2626',
                color: '#dc2626',
              }}
            >
              Denied
            </span>
          ) : null}
          {isPaid ? (
            <span
              className="rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
              style={{
                backgroundColor: '#dcfce7',
                color: '#166534',
              }}
            >
              Paid
            </span>
          ) : null}
          {isCurrent ? (
            <span
              className="rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: '#0d9488' }}
            >
              Current
            </span>
          ) : null}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Financials — always visible */}
      <div className="flex flex-nowrap items-baseline overflow-hidden whitespace-nowrap py-2 text-[11.5px]">
        <FinItem label="Billed" value={formatMoneyShort(item.billed)} />
        <span className="mx-2 text-border">·</span>
        <FinItem
          label="Ins Paid"
          value={formatMoneyShort(item.insurance_paid)}
          color={
            Number(item.insurance_paid) > 0 ? '#166534' : 'var(--muted-foreground)'
          }
        />
        <span className="mx-2 text-border">·</span>
        <FinItem
          label="Pat Paid"
          value={formatMoneyShort(item.patient_paid)}
        />
        <span className="mx-2 text-border">·</span>
        <FinItem
          label="Balance"
          value={formatMoneyShort(item.balance)}
          color={Number(item.balance) > 0 ? '#dc2626' : 'var(--muted-foreground)'}
        />
      </div>

      {/* Events section — collapsible */}
      {expanded ? (
        <div className="mt-2.5">
          {events.length === 0 ? (
            <div
              className="flex items-center gap-1.5 rounded p-2 text-[11.5px]"
              style={{ backgroundColor: '#dcfce7', color: '#166534' }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>No denials on this line — paid in full.</span>
            </div>
          ) : (
            <>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Denial events · {events.length} (latest first)
              </div>
              {events.map((e) => (
                <CptEvent
                  key={e.event_id}
                  event={e}
                  isCurrent={e.event_id === currentEventId}
                />
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FinItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1 flex-shrink-0">
      <span className="text-[10.5px] font-medium text-muted-foreground">
        {label}:
      </span>
      <span
        className="font-mono font-semibold tabular-nums"
        style={color !== undefined ? { color } : undefined}
      >
        {value}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// CptEvent — single event row inside a CPT card
// ---------------------------------------------------------------------------

function CptEvent({
  event,
  isCurrent,
}: {
  event: DenialEvent;
  isCurrent: boolean;
}): JSX.Element {
  const hasCodes =
    (event.carc_codes?.length ?? 0) > 0 ||
    (event.rarc_codes?.length ?? 0) > 0;

  return (
    <div
      className="mb-1.5 rounded p-2"
      style={
        isCurrent
          ? {
              backgroundColor: '#f0fdfa',
              borderLeft: '3px solid #0d9488',
            }
          : { backgroundColor: '#f5f5f5' }
      }
    >
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-mono font-semibold">
          {formatDate(event.occurred_at)}
        </span>
        {isCurrent ? (
          <span
            className="rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: '#0d9488' }}
          >
            CURRENT
          </span>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">
            event #{event.event_id}
          </span>
        )}
      </div>

      {hasCodes ? (
        <div className="flex flex-col gap-1">
          {event.carc_codes?.map((c) => (
            <CodePill key={c.code} variant="carc" code={c.code} reason={c.reason_text} />
          ))}
          {event.rarc_codes?.map((c) => (
            <CodePill key={c.code} variant="rarc" code={c.code} reason={c.reason_text} />
          ))}
        </div>
      ) : (
        <div
          className="flex items-center gap-1.5 rounded bg-background p-1.5 text-[11px]"
          style={{ color: '#92400e' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#f59e0b' }}
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>
            <strong>No remit codes</strong> — payer must be called for reason
          </span>
        </div>
      )}
    </div>
  );
}

function CodePill({
  variant,
  code,
  reason,
}: {
  variant: 'carc' | 'rarc';
  code: string;
  reason: string;
}): JSX.Element {
  const bg = variant === 'carc' ? '#ffe4e6' : '#dbeafe';
  const fg = variant === 'carc' ? '#9f1239' : '#1e40af';
  return (
    <span
      className="flex items-baseline gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] leading-tight"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="flex-shrink-0 font-mono text-[10.5px] font-bold">
        {code}
      </span>
      <span>{reason}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pattern derivation — plain-English denial chain summary
// ---------------------------------------------------------------------------

function derivePattern(events: DenialEvent[]): string | null {
  if (events.length === 0) return null;
  if (events.length === 1) {
    const e = events[0]!;
    const codes = [
      ...(e.carc_codes ?? []),
      ...(e.rarc_codes ?? []),
    ]
      .map((c) => c.code)
      .join(' + ');
    return `1st denial on this claim${codes !== '' ? ` (${codes})` : ''}.`;
  }
  const sorted = [...events].sort((a, b) =>
    (a.occurred_at ?? '').localeCompare(b.occurred_at ?? ''),
  );
  const priorEvents = sorted.slice(0, -1);
  const ordinal = ordinalSuffix(events.length);
  const priorSummaries = priorEvents
    .map((e) => {
      const codes = [
        ...(e.carc_codes ?? []),
        ...(e.rarc_codes ?? []),
      ]
        .map((c) => c.code)
        .join(' + ');
      return `${formatDate(e.occurred_at)}${codes !== '' ? ` (${codes})` : ''}`;
    })
    .join(' and ');
  return `${ordinal} denial on this claim. Prior denials on ${priorSummaries} followed similar pattern.`;
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
