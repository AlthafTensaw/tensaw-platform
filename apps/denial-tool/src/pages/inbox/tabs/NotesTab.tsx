/**
 * NotesTab — claim notes thread (analyst + system + payer call notes).
 *
 * Reads via useNotes; creates via useCreateNote.
 *
 * Add-note composer is inline (collapsible). Defaults source to "internal".
 * Body is plain text; rich text is out of scope for v3.0.
 */

import { useState } from 'react';
import type { WorklistRow } from '../../../actions/schemas';
import { useNotes, useCreateNote } from '../../../hooks/useTabData';
import { formatDateTime } from '../../../lib/formatters';
import type { Note, NoteSource } from '../../../actions/schemasV3';

interface NotesTabProps {
  row: WorklistRow;
}

export function NotesTab({ row }: NotesTabProps): JSX.Element {
  const claimId = row.claim.claim_id;
  const { data, isLoading } = useNotes(claimId);
  const { mutate: createNote, isPending: isCreating } =
    useCreateNote(claimId);

  const [composerOpen, setComposerOpen] = useState(false);
  const [draftBody, setDraftBody] = useState('');
  const [draftSource, setDraftSource] = useState<NoteSource>('internal');

  const notes = data?.notes ?? [];

  const handleSubmit = (): void => {
    if (draftBody.trim() === '' || isCreating) return;
    createNote({
      source: draftSource as 'internal' | 'payer_call',
      body: draftBody.trim(),
    });
    setDraftBody('');
    setComposerOpen(false);
  };

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {isLoading ? 'Loading…' : `${notes.length} notes · newest first`}
        </span>
        {!composerOpen ? (
          <button
            type="button"
            onClick={() => { setComposerOpen(true); }}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
          >
            + Add note
          </button>
        ) : null}
      </div>

      {composerOpen ? (
        <div className="mb-3 rounded-md border border-primary/30 bg-background p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Source
            </span>
            <select
              value={draftSource}
              onChange={(e) => { setDraftSource(e.target.value as NoteSource); }}
              className="rounded border border-border bg-background px-2 py-0.5 text-[11px]"
            >
              <option value="internal">Internal</option>
              <option value="payer_call">Payer call</option>
            </select>
          </div>
          <textarea
            value={draftBody}
            onChange={(e) => { setDraftBody(e.target.value); }}
            placeholder="Add a note about this claim…"
            rows={4}
            className="w-full resize-y rounded border border-border bg-background p-2 text-[12.5px] outline-none focus:border-primary"
          />
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={draftBody.trim() === '' || isCreating}
              className="rounded-md bg-primary px-3 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? 'Saving…' : 'Save note'}
            </button>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(false);
                setDraftBody('');
              }}
              className="rounded-md border border-border bg-background px-3 py-1 text-[12px] hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {isLoading && notes.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          No notes yet. Add one to start tracking conversation on this claim.
        </div>
      ) : (
        notes.map((n) => <NoteRow key={n.note_id} note={n} />)
      )}
    </div>
  );
}

function NoteRow({ note }: { note: Note }): JSX.Element {
  return (
    <div className="mb-2.5 rounded-md border border-border bg-background p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium">
          <AuthorAvatar name={note.author_name} isSystem={note.source === 'system' || note.source === 'allofactor'} />
          <span>{note.author_name}</span>
          <SourceTag source={note.source} />
        </div>
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {formatDateTime(note.created_at)}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed">
        {note.body}
      </div>
    </div>
  );
}

function AuthorAvatar({
  name,
  isSystem,
}: {
  name: string;
  isSystem: boolean;
}): JSX.Element {
  if (isSystem) {
    return (
      <span
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7.5px] font-bold text-white"
        style={{ backgroundColor: '#4338ca' }}
      >
        SY
      </span>
    );
  }
  const initials = name
    .split(/[\s,.]+/)
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    '#b45309',
    '#1e40af',
    '#5b21b6',
    '#15803d',
    '#be185d',
    '#9f1239',
  ];
  return (
    <span
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7.5px] font-bold text-white"
      style={{ backgroundColor: colors[hash % colors.length]! }}
    >
      {initials}
    </span>
  );
}

function SourceTag({ source }: { source: NoteSource }): JSX.Element {
  const labels: Record<NoteSource, string> = {
    internal: 'Internal',
    payer_call: 'Payer call',
    allofactor: 'Allofactor',
    appeal: 'Appeal',
    system: 'System',
  };
  return (
    <span
      className="inline-block rounded px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: '#f1f5f9', color: '#475569' }}
    >
      {labels[source]}
    </span>
  );
}
