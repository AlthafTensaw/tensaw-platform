/**
 * AppealTab — LLM-generated appeal letter authoring.
 *
 * Three states:
 *   1. No appeal yet:    template picker + Generate button (10-30s wait)
 *   2. Draft exists:     editable textarea + Save/Finalize buttons + regenerate
 *   3. Finalized/submitted: read-only display, status pill visible
 *
 * Endpoints:
 *   - case.appeal.get      (GET — returns current appeal or null)
 *   - case.appeal.generate (POST template → returns new Appeal in draft)
 *   - case.appeal.save     (PUT body+status → updates Appeal)
 *
 * Drop-in path: src/components/reference-panel/AppealTab.tsx
 */

import { useState, useEffect, useCallback } from 'react';
import { useActionQuery, useActionMutation } from '@tensaw/actions';
import type { CaseDetail } from '../../actions/schemas-v4';
import type { Appeal, AppealTemplate, AppealStatus } from '../../actions/schemas-v4-tabs';

export interface AppealTabProps {
  case: CaseDetail;
}

const TEMPLATE_OPTIONS: { value: AppealTemplate; label: string; description: string }[] = [
  { value: 'medical_necessity', label: 'Medical necessity', description: 'Cite documentation supporting the service' },
  { value: 'prior_auth', label: 'Prior authorization', description: 'Argue auth was unnecessary or obtained' },
  { value: 'timely_filing', label: 'Timely filing', description: 'Demonstrate the claim was filed on time' },
  { value: 'coding_correction', label: 'Coding correction', description: 'Justify the codes used' },
];

export function AppealTab({ case: c }: AppealTabProps): React.ReactElement {
  const { data, isLoading, error, refetch } = useActionQuery(
    'case.appeal.get',
    { case_id: c.case_id },
  );

  if (isLoading && data === undefined) {
    return <SkeletonAppeal />;
  }

  if (error !== null && data === undefined) {
    return (
      <div className="px-4 py-3">
        <ErrorView
          message={error.message ?? 'Network or server error'}
          onRetry={refetch}
        />
      </div>
    );
  }

  // case.appeal.get returns the Appeal directly, or null/undefined if none exists
  const appeal = data as Appeal | null | undefined;

  if (appeal === undefined || appeal === null) {
    return <GenerateView caseId={c.case_id} />;
  }

  return <EditView appeal={appeal} caseId={c.case_id} />;
}

// ============================================================================
// GenerateView — no draft exists yet
// ============================================================================

interface GenerateViewProps {
  caseId: string;
}

function GenerateView({ caseId }: GenerateViewProps): React.ReactElement {
  const [fireGenerate, { isLoading: isPending, error }] = useActionMutation('case.appeal.generate');
  const [template, setTemplate] = useState<AppealTemplate>('medical_necessity');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setSubmitError(null);
    try {
      await fireGenerate({ case_id: caseId, template });
      // appeal-get invalidates automatically → tab re-renders into EditView
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Generation failed');
    }
  }, [caseId, template, fireGenerate]);

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <section className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
        <header>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Generate appeal letter
          </h3>
          <p className="mt-0.5 text-[12.5px] text-slate-700">
            Use the LLM to draft an appeal based on the case context and your chosen template. Generation takes <strong>10-30 seconds</strong>.
          </p>
        </header>

        <div>
          <label htmlFor="appeal-template" className="block text-[11.5px] font-medium text-slate-700 mb-1">
            Template
          </label>
          <select
            id="appeal-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value as AppealTemplate)}
            disabled={isPending}
            className="
              block w-full rounded border border-slate-300 bg-white
              px-2.5 py-1.5 text-[13px] text-slate-900
              focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
              disabled:opacity-60
            "
          >
            {TEMPLATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            {TEMPLATE_OPTIONS.find((o) => o.value === template)?.description}
          </p>
        </div>

        {(submitError !== null || error !== null) && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11.5px] text-red-800">
            {submitError ?? error?.message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="
              inline-flex items-center gap-1.5 rounded
              bg-blue-600 px-3 py-1.5 text-[12.5px] font-medium text-white
              hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {isPending ? (
              <>
                <SpinnerIcon />
                Generating… (this can take up to 30s)
              </>
            ) : (
              <>
                <SparkleIcon />
                Generate appeal
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// EditView — draft (or finalized/submitted) exists
// ============================================================================

interface EditViewProps {
  appeal: Appeal;
  caseId: string;
}

function EditView({ appeal, caseId }: EditViewProps): React.ReactElement {
  const [fireSave, { isLoading: savePending, error: saveError }] = useActionMutation('case.appeal.save');
  const [fireGenerate, { isLoading: regenPending, error: regenError }] = useActionMutation('case.appeal.generate');

  const [body, setBody] = useState(appeal.body);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // If the appeal updates server-side (e.g. regenerate), sync local state
  // when the appeal_id or updated_at changes.
  useEffect(() => {
    setBody(appeal.body);
  }, [appeal.appeal_id, appeal.updated_at, appeal.body]);

  const isEditable = appeal.status === 'draft';
  const isDirty = body !== appeal.body;

  const handleSave = useCallback(async (newStatus?: AppealStatus) => {
    setSubmitError(null);
    try {
      await fireSave({
        case_id: caseId,
        appeal_id: appeal.appeal_id,
        body,
        ...(newStatus !== undefined && { status: newStatus }),
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed');
    }
  }, [caseId, appeal.appeal_id, body, fireSave]);

  const handleRegenerate = useCallback(async () => {
    setSubmitError(null);
    try {
      await fireGenerate({ case_id: caseId, template: appeal.template });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Regenerate failed');
    }
  }, [caseId, appeal.template, fireGenerate]);

  const displayError = submitError ?? saveError?.message ?? regenError?.message ?? null;
  const isPending = savePending || regenPending;

  return (
    <div className="flex h-full flex-col">
      {/* Header with status + metadata */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={appeal.status} />
          <span className="text-[11px] text-slate-500">
            Template: {TEMPLATE_OPTIONS.find((o) => o.value === appeal.template)?.label ?? appeal.template}
          </span>
          {appeal.generated_at !== null && (
            <span className="ml-auto text-[10.5px] text-slate-500">
              Generated {new Date(appeal.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {appeal.generated_by_model !== null && (
                <> · {appeal.generated_by_model}</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Body textarea (or read-only display) */}
      <div className="flex-1 overflow-hidden px-4 py-3">
        <textarea
          aria-label="Appeal letter body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!isEditable || isPending}
          rows={20}
          className={`
            block h-full w-full rounded border border-slate-300
            px-3 py-2 text-[12.5px] leading-relaxed text-slate-900
            font-mono
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
            ${!isEditable || isPending ? 'bg-slate-50 cursor-default' : 'bg-white'}
          `}
        />
      </div>

      {displayError !== null && (
        <div role="alert" className="mx-4 mb-2 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11.5px] text-red-800">
          {displayError}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2">
        {isEditable && (
          <>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isPending}
              className="
                rounded border border-slate-300 bg-white px-2.5 py-1.5
                text-[11.5px] font-medium text-slate-700
                hover:bg-slate-50
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              {regenPending ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isPending || !isDirty}
              className="
                ml-auto rounded border border-slate-300 bg-white px-3 py-1.5
                text-[12px] font-medium text-slate-700
                hover:bg-slate-50
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              {savePending ? 'Saving…' : isDirty ? 'Save draft' : 'Saved'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('finalized')}
              disabled={isPending}
              title="Lock the draft. Status moves to finalized."
              className="
                rounded bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white
                hover:bg-emerald-700
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              Finalize
            </button>
          </>
        )}

        {appeal.status === 'finalized' && (
          <>
            <span className="text-[11.5px] text-slate-600">
              Finalized. Mark as submitted once sent to the payer.
            </span>
            <button
              type="button"
              onClick={() => handleSave('submitted')}
              disabled={isPending}
              className="
                ml-auto rounded bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white
                hover:bg-blue-700
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              Mark submitted
            </button>
          </>
        )}

        {appeal.status === 'submitted' && (
          <span className="text-[11.5px] text-slate-600">
            Submitted. Track payer response via the workflow's awaiting_payer_check.
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function StatusPill({ status }: { status: AppealStatus }): React.ReactElement {
  const style =
    status === 'draft' ? { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Draft' } :
    status === 'finalized' ? { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Finalized' } :
    { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Submitted' };

  return (
    <span className={`
      inline-flex items-center rounded px-1.5 py-0.5
      text-[10px] font-semibold uppercase tracking-wider
      ${style.bg} ${style.text}
    `}>
      {style.label}
    </span>
  );
}

function SparkleIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1l1.2 3.8L12 6l-3.8 1.2L7 11l-1.2-3.8L2 6l3.8-1.2L7 1z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="animate-spin">
      <path d="M7 1a6 6 0 1 1-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SkeletonAppeal(): React.ReactElement {
  return (
    <div role="status" aria-label="Loading appeal" className="px-4 py-3 animate-pulse">
      <div className="mb-2 h-3 w-32 rounded bg-slate-200" />
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4">
        <div className="mb-2 h-2 w-full rounded bg-slate-200" />
        <div className="mb-2 h-2 w-5/6 rounded bg-slate-200" />
        <div className="mb-2 h-2 w-4/5 rounded bg-slate-200" />
        <div className="h-2 w-3/4 rounded bg-slate-200" />
      </div>
    </div>
  );
}

function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <div
      role="alert"
      className="
        flex items-start gap-2 rounded border border-red-200 bg-red-50
        px-3 py-2 text-[12px] text-red-800
      "
    >
      <div className="flex-1">
        <div className="font-semibold">Couldn't load appeal</div>
        <div className="mt-0.5 text-red-700">{message}</div>
      </div>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-red-300 bg-white px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      )}
    </div>
  );
}
