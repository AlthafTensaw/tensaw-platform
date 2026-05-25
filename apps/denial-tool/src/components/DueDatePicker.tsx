/**
 * DueDatePicker — explicit per-step due-date override.
 *
 * Backend keeps two date fields per step assignment:
 *   - due_date           : explicit override (null when not set)
 *   - effective_due_date : server-computed (due_date if set, else
 *                          classified_at + sla_days). Always present.
 *
 * Per backend handoff: always RENDER effective_due_date. Pass due_date
 * up on edits — null clears the override and lets backend recompute.
 *
 * "Today" / "Overdue" pills are computed client-side from
 * effective_due_date vs. today's local date.
 */

import { useMemo } from 'react';
import { DatePicker } from '@tensaw/design-system/forms';

interface DueDatePickerProps {
  effectiveDueDate: string | null; // null when step has no assignment row
  dueDateOverride: string | null;  // null = no explicit override
  onChange: (newDate: string | null) => void;
  completed: boolean;             // suppresses Today/Overdue urgency if already done
  disabled?: boolean;
}

function parseISODate(iso: string): Date {
  // Local-midnight parse to avoid TZ shift on display
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${dd}`;
}

function urgencyTone(
  effectiveISO: string,
  completed: boolean,
): 'overdue' | 'today' | 'normal' {
  if (completed) return 'normal';
  const today = toISODate(new Date());
  if (effectiveISO < today) return 'overdue';
  if (effectiveISO === today) return 'today';
  return 'normal';
}

export function DueDatePicker({
  effectiveDueDate,
  dueDateOverride,
  onChange,
  completed,
  disabled,
}: DueDatePickerProps): JSX.Element {
  const value = useMemo(
    () => (effectiveDueDate ? parseISODate(effectiveDueDate) : null),
    [effectiveDueDate],
  );

  const tone = effectiveDueDate
    ? urgencyTone(effectiveDueDate, completed)
    : 'normal';
  const isOverride = dueDateOverride !== null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <DatePicker
        value={value}
        onValueChange={(d) => {
          onChange(d ? toISODate(d) : null);
        }}
        format="MMM d"
        disabled={disabled ?? false}
        aria-label="Due date"
      />
      {tone === 'overdue' ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
          Overdue
        </span>
      ) : tone === 'today' ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Today
        </span>
      ) : null}
      {isOverride ? (
        <button
          type="button"
          onClick={() => { onChange(null); }}
          disabled={disabled ?? false}
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          title="Clear override; revert to SLA-derived due date"
        >
          reset
        </button>
      ) : null}
    </div>
  );
}
