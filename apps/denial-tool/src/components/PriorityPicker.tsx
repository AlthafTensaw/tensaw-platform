/**
 * PriorityPicker — per-step priority dropdown.
 *
 * Backend wire values: 'low' | 'normal' | 'high'.
 * Display labels: TitleCase of the wire value (Low / Normal / High).
 * Per backend handoff §4: no display→wire mapping table — the wire
 * value IS the display value, just cased. Same terminology in picker,
 * audit log, and API responses keeps the analyst experience consistent.
 *
 * Pill colors per backend handoff table:
 *   High   → red    (#fee2e2 / #991b1b)
 *   Normal → amber  (#fef3c7 / #92400e)
 *   Low    → slate  (#f1f5f9 / #475569)
 */

import { Select } from '@tensaw/design-system/forms';
import type { StepPriority } from '../actions/schemas';

interface PriorityPickerProps {
  value: StepPriority;
  onChange: (next: StepPriority) => void;
  disabled?: boolean;
}

const OPTIONS: { value: StepPriority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export function PriorityPillClass(priority: StepPriority): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'normal':
      return 'bg-amber-100 text-amber-800';
    case 'low':
      return 'bg-slate-100 text-slate-700';
  }
}

export function PriorityLabel({
  value,
}: {
  value: StepPriority;
}): JSX.Element {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${PriorityPillClass(value)}`}
    >
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}

export function PriorityPicker({
  value,
  onChange,
  disabled,
}: PriorityPickerProps): JSX.Element {
  return (
    <Select<StepPriority>
      value={value}
      onValueChange={onChange}
      options={OPTIONS}
      disabled={disabled ?? false}
      aria-label="Priority"
    />
  );
}
