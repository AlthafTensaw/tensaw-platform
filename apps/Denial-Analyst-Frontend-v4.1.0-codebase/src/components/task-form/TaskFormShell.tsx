/**
 * TaskFormShell — form primitives for task forms.
 *
 * Composable parts used by IntakeTriageForm and the other 10 task forms
 * (P1.10). All are controlled components — caller owns state.
 *
 * Exports:
 *   - FormField:        label + hint + error wrapper
 *   - FormLabel:        accessible label
 *   - FormHint:         helper text below input
 *   - FormError:        validation error text
 *   - SegmentedControl: pill-style picker for small enum sets (priority, etc.)
 *   - RouteGrid:        card-style picker for routing choices (intake_triage's route)
 *   - Textarea, Input, Select: styled native form controls
 *
 * Drop-in path: src/components/task-form/TaskFormShell.tsx
 */

import type { ReactNode, ChangeEvent } from 'react';

// ============================================================================
// FormField — wrapper that adds label, hint, error in consistent layout
// ============================================================================

export interface FormFieldProps {
  /** id of the input — used to wire label htmlFor */
  id: string;
  label: string;
  /** Mark as required (adds red asterisk after label) */
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: FormFieldProps): React.ReactElement {
  const hintId = hint !== undefined ? `${id}-hint` : undefined;
  const errorId = error !== undefined && error !== null ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter((s) => s !== undefined).join(' ') || undefined;

  return (
    <div className="space-y-1">
      <FormLabel htmlFor={id} required={required}>
        {label}
      </FormLabel>
      {/* Children inputs should set aria-describedby={describedBy} themselves
       *  if they need it. This wrapper just provides the structure. */}
      <div data-described-by={describedBy}>{children}</div>
      {hint !== undefined && (
        <FormHint id={hintId}>{hint}</FormHint>
      )}
      {error !== undefined && error !== null && (
        <FormError id={errorId}>{error}</FormError>
      )}
    </div>
  );
}

// ============================================================================
// FormLabel
// ============================================================================

export interface FormLabelProps {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}

export function FormLabel({ htmlFor, required, children }: FormLabelProps): React.ReactElement {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11.5px] font-medium text-slate-700"
    >
      {children}
      {required === true && (
        <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
      )}
    </label>
  );
}

// ============================================================================
// FormHint
// ============================================================================

export interface FormHintProps {
  id?: string;
  children: ReactNode;
}

export function FormHint({ id, children }: FormHintProps): React.ReactElement {
  return (
    <p id={id} className="text-[11px] text-slate-500">
      {children}
    </p>
  );
}

// ============================================================================
// FormError
// ============================================================================

export interface FormErrorProps {
  id?: string;
  children: ReactNode;
}

export function FormError({ id, children }: FormErrorProps): React.ReactElement {
  return (
    <p id={id} role="alert" className="text-[11px] font-medium text-red-700">
      {children}
    </p>
  );
}

// ============================================================================
// SegmentedControl — pill row picker
// ============================================================================

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  name,
  value,
  onChange,
  options,
  disabled = false,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-0.5"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`
              rounded px-3 py-1 text-[12px] font-medium
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:cursor-not-allowed disabled:opacity-50
              ${selected
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'}
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// RouteGrid — card-style picker for routing decisions
// ============================================================================

export interface RouteOption<T extends string> {
  value: T;
  label: string;
  /** One-line description shown below the label. */
  description?: string;
  /** Optional emoji or icon character for the card */
  icon?: ReactNode;
}

export interface RouteGridProps<T extends string> {
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: RouteOption<T>[];
  /** Number of columns (1, 2, or 4). Default 2. */
  columns?: 1 | 2 | 4;
  disabled?: boolean;
}

export function RouteGrid<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 2,
  disabled = false,
}: RouteGridProps<T>): React.ReactElement {
  const gridCols =
    columns === 1 ? 'grid-cols-1' :
    columns === 4 ? 'grid-cols-2 sm:grid-cols-4' :
    'grid-cols-1 sm:grid-cols-2';

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`grid gap-2 ${gridCols}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`
              flex flex-col items-start gap-1 rounded-lg border p-3 text-left
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:cursor-not-allowed disabled:opacity-50
              ${selected
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}
            `}
          >
            <div className="flex items-center gap-2">
              {opt.icon !== undefined && (
                <span aria-hidden="true" className="text-base">{opt.icon}</span>
              )}
              <span className={`text-[13px] font-semibold ${selected ? 'text-blue-900' : 'text-slate-900'}`}>
                {opt.label}
              </span>
            </div>
            {opt.description !== undefined && (
              <span className={`text-[11px] ${selected ? 'text-blue-700' : 'text-slate-500'}`}>
                {opt.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Native form controls — styled wrappers
// ============================================================================

export interface TextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
}

export function Textarea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled = false,
  describedBy,
}: TextareaProps): React.ReactElement {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-describedby={describedBy}
      className="
        block w-full rounded border border-slate-300 bg-white
        px-2.5 py-1.5 text-[13px] text-slate-900
        placeholder:text-slate-400
        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
        disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60
      "
    />
  );
}

export interface InputProps {
  id: string;
  type?: 'text' | 'number' | 'email' | 'tel';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
}

export function Input({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  describedBy,
}: InputProps): React.ReactElement {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-describedby={describedBy}
      className="
        block w-full rounded border border-slate-300 bg-white
        px-2.5 py-1.5 text-[13px] text-slate-900
        placeholder:text-slate-400
        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
        disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60
      "
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  describedBy,
}: SelectProps): React.ReactElement {
  return (
    <select
      id={id}
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      disabled={disabled}
      aria-describedby={describedBy}
      className="
        block w-full rounded border border-slate-300 bg-white
        px-2.5 py-1.5 text-[13px] text-slate-900
        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
        disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60
      "
    >
      {placeholder !== undefined && (
        <option value="" disabled>{placeholder}</option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
