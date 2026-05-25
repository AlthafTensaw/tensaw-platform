/**
 * StepStatusSegment — 3-state segmented status control.
 *
 * v2.0.4 wiring strategy (per backend handoff §5):
 *   - Pending → Complete: wired today via POST /steps/{n}/complete (v1.5.x)
 *   - Complete → Pending: disabled until v1.8.0's PUT /steps/{n}/status ships
 *   - In progress segment: rendered but disabled until v1.8.0
 *
 * Tooltip on the disabled In-progress segment explains the gating honestly
 * so analysts don't think it's a bug. When v1.8.0 lands (v2.0.5 patch), the
 * `useUnifiedStatusEndpoint` flag flips and all three transitions go through
 * the unified PUT.
 */

import { Tooltip } from '@tensaw/design-system/overlays';
import { Icon } from '@tensaw/design-system/primitives';
import type { StepStatus } from '../actions/schemas';

interface StepStatusSegmentProps {
  value: StepStatus;
  onChange: (next: StepStatus) => void;
  /**
   * When false (v2.0.4 default), Pending→In-progress and Complete→Pending
   * are disabled with explanatory tooltips. Flip to true in v2.0.5 once
   * backend v1.8.0 ships.
   */
  useUnifiedStatusEndpoint?: boolean;
  /** Set when the previous step isn't complete yet (D-19 sequential gate). */
  blockedBySequentialGate?: boolean;
  disabled?: boolean;
}

interface Segment {
  value: StepStatus;
  label: string;
}

const SEGMENTS: Segment[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete', label: 'Complete' },
];

export function StepStatusSegment({
  value,
  onChange,
  useUnifiedStatusEndpoint = false,
  blockedBySequentialGate = false,
  disabled,
}: StepStatusSegmentProps): JSX.Element {
  const isDisabledTransition = (target: StepStatus): boolean => {
    if (disabled ?? false) return true;
    if (useUnifiedStatusEndpoint) return false;
    // v2.0.4 (no unified endpoint yet) — only Pending → Complete works
    if (target === 'in_progress') return true;
    if (target === 'complete' && blockedBySequentialGate) return true;
    if (value === 'complete' && target !== 'complete') return true;
    return false;
  };

  const transitionTooltip = (target: StepStatus): string | null => {
    if (!useUnifiedStatusEndpoint && target === 'in_progress') {
      return 'In-progress arrives in v1.8.0 (~1 session ETA). Pending and Complete are wired today.';
    }
    if (
      !useUnifiedStatusEndpoint &&
      value === 'complete' &&
      target !== 'complete'
    ) {
      return 'Reopening a completed step arrives in v1.8.0.';
    }
    if (target === 'complete' && blockedBySequentialGate) {
      return 'Complete the previous step first (sequential workflow).';
    }
    return null;
  };

  return (
    <div
      role="radiogroup"
      aria-label="Step status"
      className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {SEGMENTS.map((seg) => {
        const active = value === seg.value;
        const dis = isDisabledTransition(seg.value);
        const tip = transitionTooltip(seg.value);

        const cls = active
          ? seg.value === 'complete'
            ? 'bg-primary text-primary-foreground'
            : seg.value === 'in_progress'
              ? 'bg-blue-600 text-white'
              : 'bg-background text-foreground'
          : 'text-muted-foreground';

        const btn = (
          <button
            key={seg.value}
            role="radio"
            type="button"
            aria-checked={active}
            disabled={dis && !active}
            onClick={() => {
              if (!dis) onChange(seg.value);
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
          >
            {seg.value === 'complete' && active ? (
              <Icon name="Check" size="xs" />
            ) : null}
            {seg.label}
          </button>
        );

        return tip !== null ? (
          <Tooltip key={seg.value} content={tip}>
            <span>{btn}</span>
          </Tooltip>
        ) : (
          btn
        );
      })}
    </div>
  );
}
