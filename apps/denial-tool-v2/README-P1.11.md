# FE v4.0.0 · P1.11 — Reference panel (5 tabs + file upload picker)

**Phase:** P1.11 (the right pane of the 3-pane shell)
**Anchored on:** mockups #14-18 (one per tab)
**Status:** Code-complete; `tsc --strict` clean + 26/26 SSR smoke tests pass

---

## What's in this deliverable

8 source files + 1 smoke test. Builds out the full right-pane tab strip with all 5 tabs wired to their v4 endpoints, plus the file upload picker that was deferred from v3.1.

| File | Lines | Drop-in path |
|---|---|---|
| `ReferencePanel.tsx` | 144 | `src/pages/ReferencePanel.tsx` |
| `TabStrip.tsx` | 105 | `src/components/reference-panel/TabStrip.tsx` |
| `AnalysisTab.tsx` | 175 | `src/components/reference-panel/AnalysisTab.tsx` |
| `PaymentsTab.tsx` | 232 | `src/components/reference-panel/PaymentsTab.tsx` |
| `NotesTab.tsx` | 246 | `src/components/reference-panel/NotesTab.tsx` |
| `FilesTab.tsx` | 327 | `src/components/reference-panel/FilesTab.tsx` |
| `AppealTab.tsx` | 386 | `src/components/reference-panel/AppealTab.tsx` |
| `useActiveTab.ts` | 65 | `src/hooks/useActiveTab.ts` |
| `sanity-check-v4-reference-panel.tsx` | 422 | `scripts/sanity-check-v4-reference-panel.tsx` |

Total: ~2100 lines added.

---

## Architecture

```
┌─ ReferencePanel (right pane) ──────────────────────────────────┐
│                                                                │
│  ┌─ TabStrip ────────────────────────────────────────────────┐ │
│  │ [Analysis] [Payments] [Notes ⊙7] [Files ⊙3] [Appeal ●]    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Active tab content ──────────────────────────────────────┐ │
│  │                                                           │ │
│  │  (one of: AnalysisTab, PaymentsTab, NotesTab,             │ │
│  │           FilesTab, AppealTab)                            │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

`ReferencePanel` reads `?case=<id>` from URL (shared with WorkPane via `useWorklistUrlState`), queries `case.detail` (same cache as the middle pane — **no duplicate request**), then branches:

- **No case selected** → friendly empty state
- **case.detail loading** → skeleton with the TabStrip visible
- **case.detail errored** → inline error + retry
- **case.detail loaded** → TabStrip + active tab content

`useActiveTab` manages `?tab=<id>` URL param (default: `analysis`). Switching tabs preserves all other URL state (queue, case, filters, page).

---

## Per-tab summary

### Analysis
**Endpoint:** none — renders from `case.detail` data already in cache.
**Content:** LLM recommendation block (category + confidence + reasoning), Workflow status (name + state code + status), Acceptance/Override metadata.
**No mutations.**

### Payments
**Endpoint:** `case.transactions`
**Content:** summary tiles (payments / adjustments / net received), chronological transaction list grouped by type. Each row: type badge + payer source (1°/2°/3°/Patient) + date + amount + CARC/RARC codes for denials + remit reason.
**No mutations.**

### Notes
**Endpoints:** `case.notes` (read), `case.note.add` (write)
**Content:** chronological notes timeline with source-coded styling — analyst notes are visually primary (white bg + blue badge); system/classifier/appeal notes are muted (slate/blue-tinted/purple-tinted, smaller text). Add-note form at bottom: textarea + Add button. Cache invalidates after add.

### Files
**Endpoints:** `case.files` (read), `case.file.upload` (write)
**Content:** files grouped by file_type (medical_record, operative_note, eob, denial_letter, appeal_draft, other), each with size + uploader + date. **Upload picker** at bottom: file-type dropdown + Choose file + Upload button.
**Note on upload:** the action layer takes metadata (file_type, file_name, idempotency_key); the actual multipart upload is wired by an uploader helper at the action transport layer. The form here builds and submits the metadata payload. Idempotency key is a `crypto.randomUUID()` generated client-side to prevent dedup on double-submit.

### Appeal
**Endpoints:** `case.appeal.get` (read), `case.appeal.generate` (write), `case.appeal.save` (write)
**Content:** branches on whether an appeal exists:

1. **No appeal yet (Generate view):**
   - Template picker (medical_necessity / prior_auth / timely_filing / coding_correction)
   - Description blurb under the picker
   - "Generate appeal" button with "10-30s" warning
   - Generation in progress: spinner + "Generating… (this can take up to 30s)"

2. **Draft exists (Edit view):**
   - Status pill (Draft / Finalized / Submitted)
   - Template + generation metadata (model + date)
   - Large editable textarea (monospaced — appeal letters are formatting-sensitive)
   - Action bar: [Regenerate] [Save draft / Saved] [Finalize]

3. **Finalized:**
   - Read-only textarea
   - Action bar shows: "Finalized. Mark as submitted once sent." + [Mark submitted]

4. **Submitted (terminal):**
   - Read-only textarea
   - Footer: "Submitted. Track payer response via the workflow's awaiting_payer_check."

The textarea has a `useEffect` that syncs with `appeal.body` when the appeal id or updated_at changes — so regenerating mid-edit refreshes the local state with the new content.

---

## Tab badges + prefetch pattern

`ReferencePanel` queries `case.notes`, `case.files`, `case.appeal.get` at the **panel level**, not the tab level. Reasons:

1. **Badge counts on the TabStrip** — needs counts before the user clicks a tab
2. **Prefetch** — when the user clicks the Notes tab, the data is already in cache → instant render

Tradeoff: even if the user never clicks Notes, we still fetched `case.notes`. For a workflow tool where users tab between these constantly, the tradeoff is worth it.

Badge logic:
- **Notes badge:** numeric count, shown when > 0
- **Files badge:** numeric count, shown when > 0
- **Appeal dot:** "●" indicator shown when an appeal exists in any status

Counts are hidden when zero (avoids `0` noise).

---

## URL state

| Param | Read by | Written by |
|---|---|---|
| `?tab` | `useActiveTab` | `TabStrip` (via setActiveTab) |
| `?case` | `useWorklistUrlState` | `CaseCard` (P1.5) |

The `tab` param defaults to `analysis` when missing. To keep URLs clean, the hook only writes the param when it's NOT the default — `?tab=notes` shows but `?tab=analysis` is omitted.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

### SSR smoke (26 tests)

```
=== TabStrip ===                            5/5  passed
  · all 5 tabs render
  · aria-selected="true" exactly once
  · count badges show notes/files when > 0
  · appeal dot when hasAppealDraft=true
  · count badges hidden when zero

=== AnalysisTab ===                         4/4  passed
  · LLM rec block with category + confidence
  · reasoning text
  · workflow block (when workflow_name set)
  · acceptance metadata block

=== PaymentsTab ===                         3/3  passed
  · empty state
  · transactions render with type badges, payer source, CARC/RARC
  · summary tiles with net received

=== NotesTab ===                            4/4  passed
  · empty state
  · notes render with source-coded styling
  · add-note form with textarea + button
  · Add button disabled when body empty

=== FilesTab ===                            4/4  passed
  · empty state
  · files grouped by type with size + uploader
  · upload picker with type select + Choose + Upload
  · Upload button disabled when no file selected

=== AppealTab ===                           5/5  passed
  · Generate view when no appeal exists
  · all 4 template options
  · Edit view with textarea when draft exists
  · finalized: Mark submitted button, no Finalize/Regenerate
  · submitted: read-only message

=== ReferencePanel ===                      1/1  passed
  · empty state when no ?case=

26 passed · 0 failed
```

### What SSR can't cover (deferred to P1.13)

- Clicking a tab actually switches content
- Typing in the note body enables Add button
- Selecting a file populates the picker
- Generate button clicks → mutation fires → cache invalidates → Edit view appears
- Save vs Finalize button transitions
- Regenerate while editing replaces body
- Tab badge counts update after add-note / upload-file

These need jsdom + user-event. The components are structured for those tests — controlled state, no internal side effects beyond URL writes + mutation calls.

---

## Integration steps

1. Drop the 8 new files into the paths above
2. In your 3-pane shell, mount `<ReferencePanel />` as the right pane:
   ```tsx
   <ThreePaneShell
     left={<WorklistPane />}
     middle={<WorkPane canReclassify={...} />}
     right={<ReferencePanel />}
   />
   ```
3. The shell renders; clicking a case card populates middle + right panes (same `?case=` URL param drives both)
4. Tab strip behavior: click "Notes" → URL gets `?tab=notes`; reload preserves the active tab; switching cases keeps the same active tab

---

## Two design decisions worth flagging

### 1. Appeal textarea is monospaced

Appeal letters are formatting-sensitive: cite numbers, dates, policy references all need alignment for readability. A proportional font breaks the visual structure of the LLM-generated content. Monospace keeps line breaks meaningful.

Tradeoff: looks less polished. If product wants prose-style display, swap `font-mono` to `font-sans` — single-line change. A richer alternative would be a markdown renderer with edit/preview toggle; deferred for now.

### 2. Upload picker submits metadata, not multipart

The action registry's `case.file.upload` request schema takes metadata fields (`file_type`, `file_name`, `idempotency_key`) — the actual binary upload goes through a separate transport-layer helper that builds FormData.

Why: the action registry pattern in this codebase is JSON-payload-oriented. Multipart uploads are a special case typically handled by a dedicated uploader (axios + FormData or similar). Keeping the action registry pure JSON keeps the typing clean; the uploader is wired separately.

P1.11 ships the picker UI + metadata payload submission. The team will need to add the multipart transport — likely a few lines in whatever fetch interceptor wires actions to the backend. Flagging this as a small integration TODO.

---

## What's NOT in P1.11 (intentional cuts)

- **Rich-text editor for appeal** — current textarea is plain text/monospace. A WYSIWYG editor (TipTap, Lexical) would be nicer but adds significant dep weight. Defer to product feedback.
- **Drag-and-drop file uploads** — current picker is click-to-choose. Drag-drop is a polish pass; the upload action stays the same.
- **Multi-file upload** — one file at a time. Schema supports it conceptually but UI doesn't.
- **File preview / inline view** — clicking a file row doesn't open it. PDF/image previews would need a viewer modal; out of scope.
- **Note editing / deletion** — notes are append-only. Schema supports neither edit nor delete; matches BE intent for audit-log integrity.
- **Appeal PDF render** — Finalize doesn't produce a downloadable PDF. There's an implicit render-pdf step (per the schema docs) but it's a BE concern that emits an `appeal_draft` file. FE just shows finalized status and the file shows up in the Files tab.
- **Real multipart upload transport wiring** — see "Design decisions" above.

---

## Cumulative progress

| Phase | Status |
|---|---|
| P1.1 schemas | ✅ |
| P1.2 action registry | ✅ |
| P1.3 mock-server | ✅ |
| P1.4 TopNav | ✅ |
| P1.5 CaseCard | ✅ |
| P1.6 WorklistPane | ✅ |
| P1.7 WorkPane | ✅ |
| P1.8 task-form anchor | ✅ |
| P1.9 cache-write optimization | skipped |
| P1.10 remaining 10 task forms | ✅ |
| P1.11 reference panel (5 tabs + upload picker) | ✅ ← this |
| P1.12 legacy /denials/* redirect | next |
| P1.13 formal test suite (jsdom) | pending |
| P1.14 v3.x cleanup | pending |
| P1.15 staging integration | pending |

**9 of 13 active P1 phases done.** Pure code work remaining: P1.12 (small redirect), P1.13 (test suite), P1.14 (cleanup). After that it's staging integration with Vivek.

---

## What comes next (P1.12)

**Legacy /denials/* redirect** — small task. The v3.x app routed under `/denials/...`; v4 routes under `/inbox/...`. P1.12 ships a redirect component that catches old URLs and forwards to the v4 equivalent. ~50 lines + a small test.

This is the smallest remaining phase. Could be bundled with P1.13 (formal test suite startup) if you want to save a turn.

Say `"start P1.12"` and I'll ship it. Or `"start P1.12+P1.13"` if you want them bundled.

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `ReferencePanel.tsx` | `src/pages/ReferencePanel.tsx` |
| `TabStrip.tsx` | `src/components/reference-panel/TabStrip.tsx` |
| `AnalysisTab.tsx` | `src/components/reference-panel/AnalysisTab.tsx` |
| `PaymentsTab.tsx` | `src/components/reference-panel/PaymentsTab.tsx` |
| `NotesTab.tsx` | `src/components/reference-panel/NotesTab.tsx` |
| `FilesTab.tsx` | `src/components/reference-panel/FilesTab.tsx` |
| `AppealTab.tsx` | `src/components/reference-panel/AppealTab.tsx` |
| `useActiveTab.ts` | `src/hooks/useActiveTab.ts` |
| `sanity-check-v4-reference-panel.tsx` | `scripts/sanity-check-v4-reference-panel.tsx` |
| `README-P1.11.md` | reference only |
