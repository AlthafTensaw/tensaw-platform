/**
 * TraceTimeline — vertical pipeline trace.
 *
 * Renders a list of pipeline stages as a top-to-bottom timeline. Each row
 * shows a status icon, label, optional technicalName (mono), summary, and
 * an expandable details panel. Designed for *observed execution* (compiler
 * pipelines, build trace, AI-agent reasoning), not user-driven progression
 * — for that, use design-system's `Stepper`.
 *
 * The component is presentational: it takes the array of stages and
 * controlled or uncontrolled expansion state. State updates flow through
 * the parent (live-update polling, reducer, etc.); we don't fetch.
 *
 * Visual relationship to `TimelineEntry` (in @tensaw/visualization):
 * borrowed the rail+dot proportions but built fresh because TimelineEntry
 * is for audit logs (tone, timestamps, no lifecycle states) and our
 * concerns differ — running, skipped, expand/collapse, live transitions.
 *
 * Architecture:
 *   - Modern Tailwind+shadcn pattern (DataExplorer-style), not the older
 *     inline-style + --tw-color-* legacy.
 *   - Status state machine matches the spec exactly (pending/running/ok/
 *     warn/error/skipped).
 *   - Controlled vs uncontrolled expansion follows React's standard idiom:
 *     if `expandedIds` is provided, the parent owns state; otherwise the
 *     component manages internally with `defaultExpandedIds`.
 *   - Auto-expand is sticky: once a stage is expanded (auto or manual), the
 *     user can collapse it. We don't fight them.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  XCircle,
} from 'lucide-react';

import { cn, formatDurationMs } from '@tensaw/design-system';
import { Badge, Spinner } from '@tensaw/design-system';

export type TraceStageStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'warn'
  | 'error'
  | 'skipped';

export interface TraceStageData {
  /** Stable identifier; required for keyed rendering and expansion control. */
  id: string;
  /** Human-readable label, e.g. "Classify Turn". */
  label: string;
  /** Optional technical name, rendered in mono next to the label. */
  technicalName?: string;
  status: TraceStageStatus;
  /** Duration in milliseconds. Null = not yet completed. */
  durationMs?: number | null;
  /** One-line takeaway. */
  summary?: string;
  /** Expanded panel content. */
  details?: ReactNode;
  /** Optional ISO timestamps for tooltip display (consumer's responsibility). */
  startedAt?: string;
  completedAt?: string | null;
}

export interface TraceTimelineProps {
  /** Ordered list of stages. Render order matches array order. */
  stages: TraceStageData[];
  /** Controlled expansion: array of stage ids that should be expanded. */
  expandedIds?: string[];
  /** Uncontrolled initial expansion. Ignored if expandedIds is provided. */
  defaultExpandedIds?: string[];
  /** Called when expansion changes. Always fired; parent decides whether to apply. */
  onExpandedChange?: (ids: string[]) => void;
  /** Auto-expand stages with status 'error' or 'warn' on first render. Default: true. */
  autoExpandErrors?: boolean;
  /** Pulse the running-stage circle. Default: true. */
  animateRunning?: boolean;
  /** Class merge support. */
  className?: string;
  /** Aria label for the list. Default: "Pipeline trace". */
  'aria-label'?: string;
}

// ---------------------------------------------------------------------------
// Status-to-visuals mapping
// ---------------------------------------------------------------------------

interface StatusVisuals {
  /** Tailwind classes for the dot circle. */
  dot: string;
  /** Tailwind classes for the icon inside the dot (color, size). */
  icon: string;
  /** The Lucide icon component, or null for the running case (we render a Spinner). */
  Glyph: typeof CheckCircle2 | null;
  /** Badge variant — must match what we extended Badge with. */
  badgeVariant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  /** Visible badge text. */
  badgeText: string;
  /** Summary line color. */
  summaryColor: string;
}

const STATUS_VISUALS: Record<TraceStageStatus, StatusVisuals> = {
  pending: {
    dot: 'border border-muted-foreground/30 bg-background',
    icon: '',
    Glyph: null,
    badgeVariant: 'neutral',
    badgeText: 'Pending',
    summaryColor: 'text-muted-foreground',
  },
  running: {
    dot: 'border border-teal-600 bg-teal-50',
    icon: 'text-teal-700',
    Glyph: null, // Spinner rendered separately
    badgeVariant: 'info',
    badgeText: 'Running',
    summaryColor: 'italic text-muted-foreground',
  },
  ok: {
    dot: 'bg-teal-600 border border-teal-600',
    icon: 'text-white',
    Glyph: CheckCircle2,
    badgeVariant: 'success',
    badgeText: 'OK',
    summaryColor: 'text-muted-foreground',
  },
  warn: {
    dot: 'bg-amber-500 border border-amber-500',
    icon: 'text-white',
    Glyph: AlertTriangle,
    badgeVariant: 'warning',
    badgeText: 'Warn',
    summaryColor: 'text-amber-700',
  },
  error: {
    dot: 'bg-red-600 border border-red-600',
    icon: 'text-white',
    Glyph: XCircle,
    badgeVariant: 'error',
    badgeText: 'Error',
    summaryColor: 'text-red-700',
  },
  skipped: {
    dot: 'border border-dashed border-muted-foreground/40 bg-background',
    icon: 'text-muted-foreground',
    Glyph: MinusCircle,
    badgeVariant: 'neutral',
    badgeText: 'Skipped',
    summaryColor: 'text-muted-foreground',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TraceTimeline = forwardRef<HTMLOListElement, TraceTimelineProps>(
  function TraceTimeline(
    {
      stages,
      expandedIds,
      defaultExpandedIds,
      onExpandedChange,
      autoExpandErrors = true,
      animateRunning = true,
      className,
      'aria-label': ariaLabel = 'Pipeline trace',
    },
    ref,
  ) {
    const isControlled = expandedIds !== undefined;

    // Internal expansion state for uncontrolled mode. Initialized once on
    // mount from defaultExpandedIds + auto-expanded errors. Sticky: once
    // expanded, manual collapse wins.
    const [internalExpanded, setInternalExpanded] = useState<Set<string>>(
      () => {
        const init = new Set<string>(defaultExpandedIds ?? []);
        if (autoExpandErrors) {
          for (const s of stages) {
            if (s.status === 'error' || s.status === 'warn') init.add(s.id);
          }
        }
        return init;
      },
    );

    // Track stages that have already been auto-expanded so we don't keep
    // re-expanding them after the user collapses. Sticky-but-not-aggressive.
    const autoExpandedRef = useRef<Set<string>>(new Set(internalExpanded));

    // When `stages` reference changes, see if any newly-error/warn stages
    // need auto-expanding (uncontrolled mode only — the controlled parent
    // is responsible for this in their reducer).
    useEffect(() => {
      if (isControlled || !autoExpandErrors) return;
      let changed = false;
      const next = new Set(internalExpanded);
      for (const s of stages) {
        if (
          (s.status === 'error' || s.status === 'warn') &&
          !autoExpandedRef.current.has(s.id)
        ) {
          autoExpandedRef.current.add(s.id);
          if (!next.has(s.id)) {
            next.add(s.id);
            changed = true;
          }
        }
      }
      if (changed) {
        setInternalExpanded(next);
        onExpandedChange?.([...next]);
      }
      // We deliberately omit `internalExpanded` from deps — we react to
      // stages reference changes only, not to our own state updates.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stages, autoExpandErrors, isControlled]);

    const expandedSet = useMemo(
      () => (isControlled ? new Set(expandedIds) : internalExpanded),
      [isControlled, expandedIds, internalExpanded],
    );

    const toggle = useCallback(
      (id: string) => {
        const next = new Set(expandedSet);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        const arr = [...next];
        if (isControlled) {
          onExpandedChange?.(arr);
        } else {
          setInternalExpanded(next);
          onExpandedChange?.(arr);
        }
      },
      [expandedSet, isControlled, onExpandedChange],
    );

    return (
      <ol
        ref={ref}
        role="list"
        aria-label={ariaLabel}
        className={cn('flex flex-col gap-4', className)}
      >
        {stages.map((stage, idx) => (
          <Stage
            key={stage.id}
            stage={stage}
            isExpanded={expandedSet.has(stage.id)}
            isLast={idx === stages.length - 1}
            animateRunning={animateRunning}
            onToggle={toggle}
          />
        ))}
      </ol>
    );
  },
);
TraceTimeline.displayName = 'TraceTimeline';

// ---------------------------------------------------------------------------
// Stage — single row
// ---------------------------------------------------------------------------

interface StageProps {
  stage: TraceStageData;
  isExpanded: boolean;
  isLast: boolean;
  animateRunning: boolean;
  onToggle: (id: string) => void;
}

function Stage({
  stage,
  isExpanded,
  isLast,
  animateRunning,
  onToggle,
}: StageProps) {
  const visuals = STATUS_VISUALS[stage.status];
  const panelId = `trace-stage-${stage.id}-panel`;
  const buttonId = `trace-stage-${stage.id}-button`;

  // -- Live-update flash: when a stage transitions from `running` to a
  // -- terminal status, briefly highlight the row. Implemented by
  // -- watching `stage.status` against the previous render's value.
  const prevStatusRef = useRef(stage.status);
  const [isFlashing, setIsFlashing] = useState(false);
  const [announcement, setAnnouncement] = useState<string>('');

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (
      prev === 'running' &&
      (stage.status === 'ok' ||
        stage.status === 'warn' ||
        stage.status === 'error')
    ) {
      setIsFlashing(true);
      setAnnouncement(
        `${stage.label}: ${stage.status} in ${formatDurationMs(stage.durationMs ?? null)}`,
      );
      const t = setTimeout(() => {
        setIsFlashing(false);
        setAnnouncement('');
      }, 600);
      prevStatusRef.current = stage.status;
      return () => {
        clearTimeout(t);
      };
    }
    prevStatusRef.current = stage.status;
    return undefined;
  }, [stage.status, stage.label, stage.durationMs]);

  return (
    <li
      role="listitem"
      className={cn(
        'flex gap-3 rounded-md transition-colors duration-500',
        isFlashing ? 'bg-teal-50/60' : 'bg-transparent',
      )}
    >
      {/* SR-only flash announcement */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {/* Status rail — fixed 32px wide, rail line + dot */}
      <div className="relative w-8 shrink-0" aria-hidden="true">
        {/* The rail line — drawn from below the dot down to the next row */}
        {!isLast && (
          <span className="absolute left-1/2 top-7 -translate-x-1/2 block h-[calc(100%-1.5rem)] w-[2px] bg-border" />
        )}
        {/* The dot */}
        <span
          className={cn(
            'relative z-10 flex h-6 w-6 items-center justify-center rounded-full',
            visuals.dot,
            stage.status === 'running' && animateRunning ? 'animate-pulse' : '',
          )}
        >
          {stage.status === 'running' ? (
            <Spinner size="xs" className="text-teal-700" />
          ) : visuals.Glyph ? (
            <visuals.Glyph className={cn('h-3.5 w-3.5', visuals.icon)} />
          ) : null}
        </span>
      </div>

      {/* Main content — flex column */}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          id={buttonId}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={() => {
            onToggle(stage.id);
          }}
          className="flex w-full items-start justify-between gap-3 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {stage.label}
            </span>
            {stage.technicalName ? (
              <span className="truncate font-mono text-xs text-muted-foreground">
                {stage.technicalName}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={visuals.badgeVariant} size="sm">
              {visuals.badgeText}
            </Badge>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDurationMs(stage.durationMs ?? null)}
            </span>
          </div>
        </button>

        {stage.summary ? (
          <p className={cn('mt-1 text-sm', visuals.summaryColor)}>
            {stage.summary}
          </p>
        ) : null}

        {isExpanded ? (
          <div
            id={panelId}
            role="region"
            aria-label={`${stage.label} details`}
            className="mt-2 rounded-md border border-border bg-muted/30 px-4 py-3"
          >
            {stage.details ?? (
              <p className="text-sm italic text-muted-foreground">
                No additional details available.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}
