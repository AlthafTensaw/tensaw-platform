/**
 * AppealTab — LLM-assisted appeal letter drafting.
 *
 * State machine:
 *   1. Loading      — initial fetch in flight
 *   2. Empty        — no draft yet; show generate CTA + template picker + prereqs
 *   3. Generating   — generate mutation in flight; loading state
 *   4. Draft        — letter rendered with toolbar (Edit, Regenerate, Save, Download)
 *   5. Editing      — letter as contenteditable HTML; Save persists; Cancel reverts
 *
 * Decisions baked in (v3.0.4 + user follow-ups):
 *   - Template scope: MVP of 1 (medical_necessity)
 *   - Edit mode: inline contenteditable HTML
 *   - Streaming: all-at-once (BE returns full draft after ~10s)
 *   - Fax sending: out of scope for v3.0 (PDF download only)
 *   - AI model: BE-configurable; FE shows the actual model used in the toolbar
 */

import { useState, useRef, useEffect } from 'react';
import { config } from '@tensaw/runtime';
import type { WorklistRow } from '../../../actions/schemas';
import {
  useAppeal,
  useGenerateAppeal,
  useSaveAppeal,
  useNotes,
  useFiles,
} from '../../../hooks/useTabData';
import { formatDateTime } from '../../../lib/formatters';
import type { AppealDraft, AppealResponse } from '../../../actions/schemasV3';

interface AppealTabProps {
  row: WorklistRow;
}

export function AppealTab({ row }: AppealTabProps): JSX.Element {
  const claimId = row.claim.claim_id;
  const { data, isLoading } = useAppeal(claimId);
  const { mutate: generate, isPending: isGenerating } =
    useGenerateAppeal(claimId);

  // Prereq info for the empty-state checklist
  const { data: notesData } = useNotes(claimId);
  const { data: filesData } = useFiles(claimId);
  const noteCount = notesData?.notes.length ?? 0;
  const fileCount = filesData?.files.length ?? 0;
  const hasMedicalRecord =
    filesData?.files.some((f) => f.file_type === 'medical_record') ?? false;

  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
        Loading appeal status…
      </div>
    );
  }

  const handleGenerate = (): void => {
    generate({ template: 'medical_necessity' });
  };

  if (isGenerating) {
    return <GeneratingState />;
  }

  if (data?.draft != null) {
    return <DraftView claimId={claimId} data={data} />;
  }

  return (
    <EmptyState
      noteCount={noteCount}
      fileCount={fileCount}
      hasMedicalRecord={hasMedicalRecord}
      claimNumber={String(claimId)}
      onGenerate={handleGenerate}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  noteCount,
  fileCount,
  hasMedicalRecord,
  claimNumber,
  onGenerate,
}: {
  noteCount: number;
  fileCount: number;
  hasMedicalRecord: boolean;
  claimNumber: string;
  onGenerate: () => void;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-background p-6 text-center">
      <div
        className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l3 7h7l-5.5 4.5 2.5 8L12 17l-7 4.5 2.5-8L2 9h7z" />
        </svg>
      </div>
      <div className="mb-1.5 text-[15px] font-semibold">
        Draft an appeal letter with AI
      </div>
      <div className="mx-auto mb-4 max-w-[320px] text-[12.5px] leading-relaxed text-muted-foreground">
        Generate a customized appeal letter for this denial. The AI uses the
        claim details, denial codes, prior denial history, and notes you've
        added.
      </div>
      <button
        type="button"
        onClick={onGenerate}
        className="inline-flex items-center gap-2 rounded-md px-4.5 py-2 text-[13px] font-semibold text-white"
        style={{ backgroundColor: '#6d28d9' }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l3 7h7l-5.5 4.5 2.5 8L12 17l-7 4.5 2.5-8L2 9h7z" />
        </svg>
        Generate appeal letter
      </button>

      <div className="mt-3.5 flex items-center justify-center gap-2 border-t border-border pt-3.5 text-[11.5px] text-muted-foreground">
        <span>Template:</span>
        <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-foreground">
          Medical necessity appeal
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {/* Prereq checklist */}
      <div
        className="mt-4 rounded-md p-3 text-left text-[11.5px]"
        style={{ backgroundColor: 'var(--muted)' }}
      >
        <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Context the AI will use
        </div>
        <PrereqItem ok label={`Claim metadata · claim ${claimNumber}`} />
        <PrereqItem ok label="Current denial codes" />
        <PrereqItem ok label="Prior denial history" />
        <PrereqItem
          ok={noteCount > 0}
          label={`Internal notes · ${noteCount}`}
        />
        <PrereqItem
          ok={hasMedicalRecord}
          label={
            hasMedicalRecord
              ? `Attached files · ${fileCount}`
              : 'Medical record summary not yet attached — consider adding from Files tab first'
          }
        />
      </div>
    </div>
  );
}

function PrereqItem({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}): JSX.Element {
  return (
    <div
      className="flex items-center gap-1.5 py-0.5"
      style={{ color: ok ? undefined : '#92400e' }}
    >
      {ok ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: '#16a34a', flexShrink: 0 }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: '#92400e', flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generating state
// ---------------------------------------------------------------------------

function GeneratingState(): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-background p-8 text-center">
      <div
        className="mx-auto mb-3.5 flex h-12 w-12 animate-pulse items-center justify-center rounded-full"
        style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l3 7h7l-5.5 4.5 2.5 8L12 17l-7 4.5 2.5-8L2 9h7z" />
        </svg>
      </div>
      <div className="mb-1.5 text-[14px] font-semibold">
        Drafting your appeal…
      </div>
      <div className="mx-auto max-w-[300px] text-[12.5px] text-muted-foreground">
        The AI is reading the claim context and writing a tailored letter.
        This usually takes 5–15 seconds.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft view (with edit mode toggle)
// ---------------------------------------------------------------------------

function DraftView({
  claimId,
  data,
}: {
  claimId: string | number;
  data: AppealResponse;
}): JSX.Element {
  const draft = data.draft!;
  const [editing, setEditing] = useState(false);
  const [bodyHtml, setBodyHtml] = useState(draft.body_html);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const { mutate: regenerate, isPending: isRegenerating } =
    useGenerateAppeal(claimId);
  const { mutate: save, isPending: isSaving } = useSaveAppeal(claimId);
  const [isRendering, setIsRendering] = useState(false);

  // Sync local edit state when a new draft arrives from the server
  // (e.g. after regenerate).
  useEffect(() => {
    setBodyHtml(draft.body_html);
    if (editorRef.current !== null) {
      editorRef.current.innerHTML = draft.body_html;
    }
  }, [draft.body_html, draft.appeal_id]);

  const handleSave = (): void => {
    const current = editorRef.current?.innerHTML ?? bodyHtml;
    save({ appeal_id: draft.appeal_id, body_html: current });
    setEditing(false);
  };

  const handleRegenerate = (): void => {
    regenerate({ template: draft.template });
  };

  const handleDownloadPdf = async (): Promise<void> => {
    if (isRendering) return;
    setIsRendering(true);
    try {
      const url =
        `${config.api.baseUrl}/v1/claims/${String(claimId)}` +
        `/appeal/${draft.appeal_id}/render-pdf`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/pdf' },
      });
      if (!response.ok) {
        throw new Error(`PDF render failed: ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `appeal-${draft.appeal_id}.pdf`;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer URL revocation so the browser has time to start the download.
      setTimeout(() => { URL.revokeObjectURL(objectUrl); }, 1000);
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(
        `PDF render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
          style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l3 7h7l-5.5 4.5 2.5 8L12 17l-7 4.5 2.5-8L2 9h7z" />
          </svg>
          AI draft
        </span>
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {formatDateTime(draft.generated_at)} · {draft.ai_model_used}
        </span>
        <div className="ml-auto flex gap-1">
          {!editing ? (
            <ToolbarBtn onClick={() => { setEditing(true); }}>
              <PencilIcon />
              Edit
            </ToolbarBtn>
          ) : (
            <>
              <ToolbarBtn
                primary
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => {
                  setEditing(false);
                  if (editorRef.current !== null) {
                    editorRef.current.innerHTML = draft.body_html;
                  }
                }}
              >
                Cancel
              </ToolbarBtn>
            </>
          )}
          <ToolbarBtn
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            <RegenerateIcon />
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
          </ToolbarBtn>
        </div>
      </div>

      {/* Letter body — contenteditable when editing */}
      <div
        ref={editorRef}
        contentEditable={editing}
        suppressContentEditableWarning
        className="appeal-letter rounded-md border border-border bg-background p-5 text-[12px] leading-relaxed"
        style={editing ? { outline: '2px solid #0d9488', outlineOffset: '-2px' } : undefined}
        dangerouslySetInnerHTML={{ __html: draft.body_html }}
      />

      {/* Generation context footer */}
      <div className="mt-2.5 rounded-md border border-border bg-muted p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#6d28d9' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Generated using
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#16a34a' }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>
            Claim metadata
            {draft.context_used.has_denial_codes ? ' · denial codes' : ''}
            {draft.context_used.prior_events_count > 0
              ? ` · ${draft.context_used.prior_events_count} prior events`
              : ''}
            {draft.context_used.notes_count > 0
              ? ` · ${draft.context_used.notes_count} notes`
              : ''}
            {draft.context_used.files_count > 0
              ? ` · ${draft.context_used.files_count} supporting docs`
              : ''}
          </span>
        </div>
        <div className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          Bracketed placeholders <code className="rounded bg-background px-1 py-px text-[10px]">[from policy file]</code> indicate
          missing data the analyst needs to fill before sending. Always review
          AI-generated content before submission.
        </div>
      </div>

      {/* Send actions */}
      <div className="mt-3.5 flex gap-1.5">
        <ToolbarBtn
          onClick={() => { void handleDownloadPdf(); }}
          disabled={isRendering}
        >
          <DownloadIcon />
          {isRendering ? 'Rendering…' : 'Download PDF'}
        </ToolbarBtn>
        <span className="ml-auto flex items-center text-[10.5px] text-muted-foreground">
          Fax sending out of scope for v3.0 — download &amp; send manually
        </span>
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50',
        primary
          ? 'border-primary bg-primary text-primary-foreground hover:opacity-90'
          : 'border-border bg-background hover:bg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function PencilIcon(): JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function RegenerateIcon(): JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function DownloadIcon(): JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// AppealDraft import is used inside DraftView signature; ref it explicitly
// so it isn't tree-shaken by tsc as unused.
void ((): AppealDraft | null => null);
