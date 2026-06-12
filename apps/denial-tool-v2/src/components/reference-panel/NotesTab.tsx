/**
 * NotesTab — case notes timeline + add-note form.
 *
 * Reads from case.notes. System/classifier/appeal notes show muted; analyst
 * notes show as primary content. Add-note form at bottom fires case.note.add
 * which invalidates the notes cache.
 *
 * Drop-in path: src/components/reference-panel/NotesTab.tsx
 */

import { useState, useCallback } from 'react';
import { useActionQuery, useActionMutation } from '@tensaw/actions';
import type { CaseDetail } from '../../actions/schemas-v4';
import type { Note, NoteSource } from '../../actions/schemas-v4-tabs';

export interface NotesTabProps {
  case: CaseDetail;
}

export function NotesTab({ case: c }: NotesTabProps): React.ReactElement {
  const { data, isLoading, error, refetch } = useActionQuery(
    'case.notes',
    { case_id: c.case_id },
  );
  const [fireAdd, { isPending: addPending, error: addError }] = useActionMutation('case.note.add');

  const [noteBody, setNoteBody] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    setSubmitError(null);
    if (noteBody.trim() === '') return;
    try {
      await fireAdd({
        case_id: c.case_id,
        body: noteBody.trim(),
      });
      setNoteBody('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add note');
    }
  }, [noteBody, c.case_id, fireAdd]);

  const notes: Note[] = data?.notes ?? [];
  const sorted = [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex h-full flex-col">
      {/* Notes timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && data === undefined && <SkeletonNotes />}

        {error !== null && data === undefined && (
          <ErrorView
            message={error.message ?? 'Network or server error'}
            onRetry={refetch}
          />
        )}

        {!isLoading && error === null && sorted.length === 0 && (
          <div className="py-8 text-center text-[12.5px] text-slate-500">
            No notes yet. Add the first one below.
          </div>
        )}

        {sorted.length > 0 && (
          <ol aria-label="Notes timeline" className="space-y-1.5">
            {sorted.map((n) => (
              <li key={n.note_id}>
                <NoteRow note={n} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Add-note form */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <label htmlFor="note-body" className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
          Add a note
        </label>
        <textarea
          id="note-body"
          rows={2}
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="Visible to anyone on the case. Will be timestamped with your name."
          disabled={addPending}
          className="
            block w-full rounded border border-slate-300 bg-white
            px-2.5 py-1.5 text-[12.5px] text-slate-900
            placeholder:text-slate-400
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
            disabled:opacity-60
          "
        />
        {(submitError !== null || addError !== null) && (
          <div role="alert" className="mt-1.5 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
            {submitError ?? addError?.message}
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={addPending || noteBody.trim() === ''}
            className="
              rounded bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white
              hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {addPending ? 'Adding…' : 'Add note'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function NoteRow({ note }: { note: Note }): React.ReactElement {
  const style = noteStyle(note.source);

  return (
    <div className={`rounded border ${style.borderClass} ${style.bgClass} px-3 py-2`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`
          inline-flex items-center rounded px-1.5 py-0.5
          text-[9.5px] font-semibold uppercase tracking-wider
          ${style.badgeBgClass} ${style.badgeTextClass}
        `}>
          {style.label}
        </span>
        {note.author_user_name !== null && (
          <span className="text-[11px] text-slate-600">{note.author_user_name}</span>
        )}
        <span className="ml-auto text-[10.5px] text-slate-500">
          {new Date(note.created_at).toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
          })}
        </span>
      </div>
      <p className={`whitespace-pre-line text-[12.5px] ${style.bodyClass}`}>
        {note.body}
      </p>
    </div>
  );
}

function noteStyle(s: NoteSource): {
  label: string;
  bgClass: string;
  borderClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  bodyClass: string;
} {
  switch (s) {
    case 'analyst':
      return {
        label: 'Note',
        bgClass: 'bg-white',
        borderClass: 'border-slate-200',
        badgeBgClass: 'bg-blue-100',
        badgeTextClass: 'text-blue-800',
        bodyClass: 'text-slate-900',
      };
    case 'classifier':
      return {
        label: 'Classifier',
        bgClass: 'bg-blue-50/40',
        borderClass: 'border-blue-100',
        badgeBgClass: 'bg-blue-100',
        badgeTextClass: 'text-blue-700',
        bodyClass: 'text-slate-700',
      };
    case 'appeal':
      return {
        label: 'Appeal',
        bgClass: 'bg-purple-50/40',
        borderClass: 'border-purple-100',
        badgeBgClass: 'bg-purple-100',
        badgeTextClass: 'text-purple-700',
        bodyClass: 'text-slate-700',
      };
    case 'system':
      return {
        label: 'System',
        bgClass: 'bg-slate-50',
        borderClass: 'border-slate-200',
        badgeBgClass: 'bg-slate-200',
        badgeTextClass: 'text-slate-700',
        bodyClass: 'text-slate-600',
      };
  }
}

function SkeletonNotes(): React.ReactElement {
  return (
    <div role="status" aria-label="Loading notes" className="space-y-1.5">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse rounded border border-slate-200 bg-white px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-2 w-12 rounded bg-slate-200" />
          </div>
          <div className="mb-1 h-2 w-full rounded bg-slate-100" />
          <div className="h-2 w-4/5 rounded bg-slate-100" />
        </div>
      ))}
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
        <div className="font-semibold">Couldn't load notes</div>
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
