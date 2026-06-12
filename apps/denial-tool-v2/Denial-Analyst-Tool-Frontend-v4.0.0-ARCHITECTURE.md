# Denial Analyst Tool · Frontend — Architecture

Canonical architecture reference for the v4.0.0 build. Read this first if
you're orienting to the codebase; per-phase READMEs go deeper on specific
slices.

---

## 1 · Platform context

The Denial Analyst Tool (DAT) frontend is one application in the **Tensaw**
platform — Primrose RCM's internal toolset. The platform layout looks like:

```
                                      ┌─ Tensaw platform ──────────┐
                                      │                            │
            DAT FE (this)             │                            │
             │                        │                            │
             │  /api/v1/cases/*       │                            │
             │  /api/v1/lookups/*     │                            │
             ▼                        │                            │
     ┌──────────────────┐             │      ┌──────────────────┐  │
     │ denial-management│──tensaw-base│──────│ primrose-lookups │  │
     │  service v1.1.0  │  (auth +    │      │  service v1.0.0  │  │
     │     (DMS)        │   error fw) │      │ clinics/providers│  │
     └────┬─────────────┘             │      │  payers/facils   │  │
          │                           │      └─────┬────────────┘  │
          │ proxies                   │            │ Redis cache    │
          ▼                           │            ▼                │
   ┌──────────────────┐               │     ┌──────────────┐        │
   │ vendor RCM data  │               │     │ Primrose RO  │        │
   │ workflow engine  │               │     │   MySQL      │        │
   │ LLM gateway      │               │     └──────────────┘        │
   │ (OpenAI/Gemini)  │               │                             │
   └──────────────────┘               └─────────────────────────────┘
```

**Key boundaries the FE assumes:**
- DAT FE talks to **one BE service** (DMS). DMS handles all proxying.
- DMS hides the workflow engine, vendor data, and LLM internals — the FE
  sees `case.accept`, `case.detail`, `task.complete`, etc., not the internal
  engine state codes (those are visible but treated as opaque labels).
- `primrose-lookups-service` is called via DMS proxies (under
  `/api/v1/lookups/*`); FE doesn't talk to it directly.
- Auth + tenant scoping flow via JWT claims through tensaw-base. No
  Primrose USERS DB read from the FE.

---

## 2 · Domain model

The v4 domain model differs from v3's denial-centric model. Core terms:

### Case (replaces v3's "Classification")

A `Case` is the unit of work for an analyst. Each case represents a denial
that the LLM has classified and may or may not have entered a workflow yet.

```
case_status: 'proposed' | 'accepted' | 'overridden' | 'completed'
```

- **proposed** — LLM made a recommendation; no action taken yet
- **accepted** — analyst accepted the LLM's category; engine workflow started
- **overridden** — analyst picked a different category; different workflow started
- **completed** — workflow finished; case resolved

Cases carry:
- claim context (claim_id, patient, MRN, DOS, $ amounts)
- LLM classification (recommended_category, confidence, reasoning)
- workflow position (workflow_name, engine_state_code) once accepted
- origination metadata (originated_by_user_id, originated_at)
- special flags (is_high_dollar ≥ $750, high_dollar_shim_case_id)

### Queue

A `Queue` is a routing destination for tasks. Workflow engine assigns tasks
to queues, not to individual users.

Two queue types:
- **team** — multiple analysts pick from it (e.g. `denial_intake_analyst_primrose`,
  `coding_primrose`, `resolution_primrose`)
- **personal** — `user_<id>` queue, used for the team-handoff return pattern
  (coding partner sends a case back to the originator's personal queue)

### Task

A `Task` is one step in a workflow. Each task has:
- `task_type` — one of 11 (intake_triage, coding_review, payer_call,
  portal_status_check, resolution_action, coding_feedback_review,
  awaiting_payer_check, am_review, posting_apply, bank_rec_match,
  high_dollar_oversight)
- `state_code` — engine state (OPEN, COMPLETED, etc.)
- `queue_id` — which queue routes this task
- `priority_code` — low / normal / high
- `due_at` — for urgency-coding

Tasks complete with one of three outcomes:
- **SUCCESS** — task done, engine advances to next step
- **NEEDS_INFO** — task can't complete; engine may spawn a different next task
- **FAIL_FATAL** — terminal failure (rare; engine closes the case)

### Workflow

A `Workflow` is a named sequence of task types. v4 has 4 workflows seeded:

| Workflow name | Steps |
|---|---|
| `medical_necessity_resolution` | intake_triage → resolution_action → awaiting_payer_check → am_review → posting_apply |
| `coding_review_branch` | intake_triage → coding_review → coding_feedback_review → resolution_action → awaiting_payer_check → posting_apply |
| `payer_call_resolution` | intake_triage → payer_call → resolution_action → awaiting_payer_check |
| `portal_first_resolution` | intake_triage → portal_status_check → resolution_action → awaiting_payer_check → posting_apply |

Workflow choice is determined at the moment of case.accept / case.override —
the category determines which workflow runs. The FE shows a **preview** of
the workflow steps in ProposedView (dashed circles) and **progress**
(filled/current/dashed) once accepted.

### HD sidecar

High-dollar cases (net_pending ≥ $750) spawn a parallel `high_dollar_oversight`
task on the manager queue alongside the main workflow. This is the "sidecar"
pattern — a side-channel task that doesn't gate the main workflow but
requires manager sign-off independently. The amber accent on HD cards
and the HD badge in the work pane header signal this throughout the UI.

---

## 3 · Three-pane shell

The main route is `/inbox`. It mounts a three-pane layout:

```
┌─ TopNav ──────────────────────────────────────────────────────────────┐
│ [Logo] [QueueSwitcher ▾]    [Needs review badge] [My tasks]  [user ▾] │
├────────────────────┬──────────────────────────────┬───────────────────┤
│                    │                              │                   │
│  WorklistPane      │  WorkPane                    │  ReferencePanel   │
│  (left)            │  (middle)                    │  (right)          │
│                    │                              │                   │
│  Filter chips      │  Persistent claim banner     │  Tab strip:       │
│  Card list         │  ───────────────────────     │  Analysis         │
│  Pagination        │  ProposedView    OR          │  Payments         │
│                    │  InFlightView    OR          │  Notes            │
│  ?queue +          │  CompletedView               │  Files            │
│  ?category +       │                              │  Appeal           │
│  ?clinic_id + ...  │  ?case=                      │                   │
│  ?page             │                              │  ?tab=            │
└────────────────────┴──────────────────────────────┴───────────────────┘
```

The three panes are **independent components** that don't directly
communicate. They coordinate via **URL state**: each pane reads what it
needs from the URL params and renders accordingly.

- `?queue=<id>` — set by QueueSwitcher; WorklistPane reads to filter case list
- `?case=<id>` — set by CaseCard click; WorkPane + ReferencePanel both read it
- `?tab=<id>` — set by TabStrip; ReferencePanel reads to pick active tab
- Filter params drive WorklistPane only

This pattern makes deep-linking work for free (paste a URL → all three panes
restore) and avoids prop-drilling between sibling panes.

---

## 4 · Action registry + data flow

### Pattern

Every BE endpoint is a registered "action":

```ts
defineAction({
  actionId: 'case.detail',
  kind: 'query',
  endpoint: 'GET /api/v1/cases/{case_id}',
  permission: 'denial.read',
  request: z.object({ case_id: z.string() }),
  response: CaseDetailSchema,
  cache: {
    tag: 'case-detail',
    invalidatedBy: INVALIDATE['case-detail'],
  },
});
```

Components consume actions via two hooks:

```ts
const { data, isLoading, error, refetch } = useActionQuery('case.detail', { case_id });
const [fireAccept, { isPending, error }] = useActionMutation('case.accept');
```

Both are fully typed — TypeScript narrows the params and response shape from
the actionId. Calling `useActionQuery('case.detail', { case_id: undefined })`
is a compile error.

### 24 registered actions

14 queries + 10 mutations. 4 endpoints intentionally NOT registered (binary
streams + 301 redirects) — those are accessed via direct fetch.

Reads:
- case.worklist, case.detail, case.tasks, task.mine, queue.list
- case.notes, case.files, case.transactions, case.appeal.get
- category.list, lookup.clinics, lookup.providers, lookup.payers, lookup.facilities

Writes:
- case.accept, case.override, case.reclassify
- task.complete, case.signal
- case.note.add, case.file.upload
- case.appeal.generate, case.appeal.save, case.reveal-phi

### Cache invalidation — INVALIDATE matrix

When a mutation fires, the FE knows which query tags to invalidate so the
affected components re-fetch:

```ts
export const INVALIDATE = {
  'case-detail': ['case.accept', 'case.override', 'task.complete', 'case.note.add', ...],
  'worklist':    ['case.accept', 'case.override', 'task.complete'],
  'notes':       ['case.note.add', 'case.accept', 'case.override', 'task.complete'],
  'files':       ['case.file.upload', 'case.appeal.generate'],
  // ...
};
```

This is declarative — the registry uses it at definition time to wire
the React Query cache. Adding a new mutation that affects existing data:
add the action id to the relevant tag's list.

---

## 5 · URL-driven state

The FE has **eight** URL params total:

| Param | Source | Consumers |
|---|---|---|
| `?queue` | QueueSwitcher | WorklistPane (filter), TopNav (selected display) |
| `?case` | CaseCard click | WorkPane (which case to render), ReferencePanel (which case for tabs) |
| `?category` | WorklistFiltersBar | WorklistPane (filter) |
| `?clinic_id` | WorklistFiltersBar | WorklistPane (filter); gates ?primary_payer_id |
| `?primary_payer_id` | WorklistFiltersBar | WorklistPane (filter); requires ?clinic_id |
| `?aging` | WorklistFiltersBar | WorklistPane (filter) |
| `?priority` | WorklistFiltersBar | WorklistPane (filter) |
| `?page` | WorklistPagination | WorklistPane (page number) |
| `?tab` | TabStrip | ReferencePanel (active tab) |

### Cross-param rules (codified in hooks)

- **Changing `?queue`** drops `?page` and `?case` (the old page/case belongs
  to the previous queue's context)
- **Changing any filter** drops `?page` (new filter = new result set)
- **Clearing `?clinic_id`** also clears `?primary_payer_id` (cascade)
- **`?tab=analysis`** is implicit (default) — the param is removed when
  switching back to it, to keep URLs clean

These rules live in `useQueueState`, `useWorklistUrlState`, and
`useActiveTab`. Any future UI that writes URL state should go through these
hooks, not directly to `useSearchParams`, so the rules stay enforced.

---

## 6 · Component layering

```
┌─ pages/ ─────────────────────────────────────────────────────────┐
│  WorklistPane.tsx · WorkPane.tsx · ReferencePanel.tsx            │
│  (top-level pane composition; reads URL, queries data)           │
└────┬─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─ components/{nav,worklist,work-pane,task-form,reference-panel}/ ─┐
│  Subview-level (ProposedView, InFlightView, NotesTab, ...)       │
│  Branches on case_status or task_type or active tab              │
└────┬─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─ components/task-form/TaskFormShell.tsx ─────────────────────────┐
│  Primitives: FormField, SegmentedControl, RouteGrid, Textarea... │
│  Pure presentational components, no data deps                    │
└──────────────────────────────────────────────────────────────────┘
```

- **Pages** own data fetching + URL state reads
- **Subviews** receive `case` and/or `task` as props, branch on status
- **Primitives** are pure presentation, no hooks beyond useState for self-contained state

This keeps the dependency direction one-way (pages → subviews → primitives)
and makes the primitives reusable across surfaces.

---

## 7 · Task forms — the 11-type registry pattern

Each of the 11 task types has its own form component. `CurrentTaskBlock` is
a router that picks the form based on `task.task_type`:

```ts
switch (task.task_type) {
  case 'intake_triage':         return <IntakeTriageForm ... />;
  case 'coding_review':         return <CodingReviewForm ... />;
  // ... all 11
  default:                      return <GenericTaskFallback ... />;
}
```

The `default` branch is a runtime safety net — TypeScript's exhaustiveness
check on the `TaskType` union catches missing cases at compile time, so the
runtime fallback is never hit for the 11 known types.

### Common pattern across all 11 forms

```ts
export function FooForm({ case, task }) {
  const { complete, isPending, error } = useTaskComplete(case, task);
  const [field1, setField1] = useState(...);
  // ... more fields

  const canSubmit = field1 !== null && /* required fields */;

  const submit = async (outcome) => {
    await complete(outcome, { field1, ... }, completionNote);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <section>
          <FormField id="field1" label="..." required>
            <SegmentedControl ... value={field1} onChange={setField1} />
          </FormField>
          {/* ... */}
        </section>
      </div>
      <OutcomeActionBar
        successLabel="Complete"
        onSuccess={() => submit('SUCCESS')}
        needsInfoLabel="Need more info"
        onNeedsInfo={() => submit('NEEDS_INFO')}
        isPending={isPending}
        canSubmitSuccess={canSubmit}
      />
    </div>
  );
}
```

To add a new task form (e.g. if BE adds a 12th task type), copy IntakeTriageForm,
edit fields to match the new fact schema, add a case to CurrentTaskBlock's
switch. Three-line change to the router. ~150-200 lines for the form itself.

---

## 8 · Mock server (dev mode)

For local dev without a live BE, the FE bundles a **full mock server** using
MSW v2. Activated with `VITE_USE_MOCKS=true`.

```
src/mocks/v4/
├── workflows.ts   — 4 workflow definitions (steps + transitions)
├── db.ts          — in-memory database (cases, tasks, notes, files, appeals)
├── seed.ts        — 15 hand-crafted seed cases across all 4 case statuses
├── handlers.ts    — MSW handlers for all 24 actions + /healthz + /readyz
└── index.ts       — MSW setup glue
```

### Engine simulator

The mock server includes a **real workflow engine simulator** — `task.complete`
actually advances the workflow:

1. Look up the task's workflow
2. Find the task's position in the workflow
3. Apply the outcome (SUCCESS / NEEDS_INFO / FAIL_FATAL)
4. Spawn the next task on the appropriate queue (using `user_<id>` placeholder
   substitution for the team-handoff return)
5. Update the case's engine_state_code

This makes the mock walkable end-to-end — accept Henderson, walk all 5 steps
of medical_necessity_resolution, watch the case transition to completed. Same
for the other 3 workflows.

### Identity in dev

`X-Mock-User-Id` header drives the "current user" identity. Defaults to
`user_42` (Vipin K. in the seed). Change the header to test originator/coding
handoff between two different users.

---

## 9 · Cross-cutting concerns

### Auth + permissions

- **JWT-based.** Tensaw-base resolves claims; FE receives a typed user
  context with role + clinic_ids + permission flags.
- **Coarse role enum:** `ANALYST | MANAGER | ADMIN`. The FE never decides
  permissions itself — it reads them from the auth context.
- **Permission props.** Components that gate UI on permissions (Re-classify
  button, cost visibility, PHI reveal) take `canViewCost`,
  `canReclassify`, etc. as **props**, not derived from auth context
  internally. The shell consults auth once and passes down. Testable in
  isolation; auth context shape can change without breaking the components.

### PHI policy

- **Cleartext display is intentional** for this internal tool — patient name,
  MRN, DOS all show without masking.
- Masking infrastructure is kept **dormant** (registered as `case.reveal-phi`
  audit action) — wireable if compliance posture changes.
- When sharing screenshots/issues outside the engineering huddle, redact
  manually (no auto-redaction tooling in v4).

### Tenancy

- Multi-clinic by JWT clinic_ids. Worklist queries are auto-scoped by the BE
  via JWT claims — FE never sends a clinic_id filter unrelated to the JWT.
- Clinic filter chip in WorklistFiltersBar restricts to a subset of the user's
  accessible clinics; can't widen beyond JWT scope.

### Error handling

- Inline error rendering for tab/pane-level failures (red banner + Retry)
- Mutation errors surface in the form's footer
- No global toast/notification system in v4 — out of scope
- Network failures → React Query's retry behavior + manual Retry button

### File upload

- **Multipart transport not wired in v4.** The `case.file.upload` action
  registers metadata (file_type, file_name, idempotency_key); the actual
  binary upload goes through a transport-layer helper that builds FormData.
- The FE app shell needs to add this in the fetch interceptor — flagged as
  the main pre-prod TODO.

---

## 10 · Testing strategy

Two complementary test suites:

### SSR sanity scripts (`scripts/sanity-check-v4-*`)

- 10 scripts, 283 tests total
- Run with `npx tsx scripts/sanity-check-v4-foo.tsx`
- Use `renderToString` + string assertions
- Cheap to run; catch structural regressions (missing fields, wrong labels,
  layout containers not rendering)
- Don't cover interactions (no click, no type)

### Jsdom interactive tests (`tests/*.test.tsx`)

- 6 files, 30 tests total
- Run with `npx vitest run`
- Use `@testing-library/react` + `user-event`
- Cover the patterns SSR can't reach: clicks, dropdowns, form submission,
  modals (Escape + backdrop), tab switching, mutation invocation

**Both stay.** SSR catches things vitest doesn't (rendering containers,
class names, structural assertions); vitest catches things SSR can't
(interactions, URL state changes after click). Total at archive time: 313
tests across both suites.

---

## 11 · Conventions referenced

These are codified in Tensaw-wide docs (per the convention-first principle):

- **`/api/v1/<resource>`** for all business endpoints; `/healthz` + `/readyz`
  at root (no version prefix)
- **Envelope ownership** — BE wraps the response envelope; FE doesn't use
  an adapter layer
- **Cascade lookup structure** — clinic selection precedes provider/payer/facility
  (URL: `/api/v1/lookups/clinics/{id}/providers`)
- **Test fixture safety** — malicious byte literals assembled via `bytes.fromhex(...)`
  to avoid Windows Defender / webshell false positives. (BE concern; flagging
  here because FE test seed could trip the same wire.)

---

## 12 · Design decisions worth knowing

These are tradeoffs made deliberately during the build. Reversible if the
context changes.

### Page-based pagination (not infinite scroll)

WorklistPane uses Prev/Next buttons. Reason: simpler with React Query's
query-keyed cache (each page = its own query). Infinite scroll requires
`useInfiniteQuery` and array concatenation in component state.
Tradeoff: less smooth for very long lists. Worklist sizes (<100 typical)
don't benefit.

### OverrideDialog excludes the recommended category

The dropdown filters out `recommendedCategory`. Picking the same category
the LLM already picked, after clicking Override, is a confusing no-op.
1-line change if product wants all categories shown.

### Permission flags as props, not context

`canViewCost`, `canReclassify` etc. are props. Shell consults auth once
and passes down. Components testable without auth-context mocking; auth
shape can change without breaking components.

### Custom modal (no Radix Dialog)

OverrideDialog uses a simple `fixed inset-0` overlay + click-outside +
Escape handling. Reasons: no Radix dep, fewer LoC, simpler to test.
Tradeoff: no focus trap (defer to a11y polish pass).

### Generic task fallback retained as safety net

Even though all 11 task types route to concrete forms, `GenericTaskFallback`
stays in CurrentTaskBlock for future task types. If BE adds a 12th type
before the FE wires its form, fallback handles it gracefully (lets the
analyst complete with a free-text note instead of crashing).

### Appeal textarea is monospaced

Appeal letters are formatting-sensitive — cite numbers, dates, policy refs
need alignment. Proportional fonts break the visual structure of LLM
output. 1-line change to `font-sans` if product prefers prose-style.

### Booleans render as SegmentedControl, not checkboxes

Bigger touch targets, clearer state, visually consistent with the rest of
the form library. "Yes / No" instead of a small checkbox.

### Tab badge counts prefetch at the panel level

ReferencePanel queries `case.notes`, `case.files`, `case.appeal.get` upfront
— for badges AND to warm the cache so tab clicks render instantly.
Tradeoff: if user never clicks Notes, we still fetched it. Worth it for a
tool where users tab between these constantly.

### LegacyRedirect drops v3 query params

v3's `?denial=DEN-123` IDs don't map to v4's `?case=case_000001` (different
ID schemes). Trying to preserve a v3 ID would be misleading. Better to
land users on `/inbox` where they can find the case via search/filters.

---

## 13 · What's NOT in v4 (intentional)

- **Rich-text appeal editor.** Plain textarea, monospaced. WYSIWYG is heavier
  than this version warrants.
- **Real-time updates / push notifications.** No websocket; manual refresh
  if another user updates a case while you're viewing.
- **Drag-drop file upload.** Click-to-choose only.
- **Multi-file upload.** One at a time.
- **File preview / inline view.** Files list with download links; no
  PDF/image viewer modal.
- **Note edit / delete.** Append-only by design (BE audit-log integrity).
- **Appeal PDF render to file.** Finalize doesn't auto-produce a downloadable
  PDF. The render-pdf step happens BE-side; the resulting file shows in
  the Files tab when ready.
- **Saved filter presets.** No "My HD queue" save.
- **Bulk actions on selected cards.** No multi-select + reclassify-all.
- **Tensaw admin panel for alias CRUD.** Confirmed as separate app (Option A
  per project memory).
- **Alias migration from denial-tool YAML → primrose-lookups-service DB.**
  Deferred to a future release.

All flagged for v4.1+ planning.

---

## 14 · Reading order for new contributors

1. **This document** — overall architecture
2. **README.md** — developer onboarding + run instructions
3. **README-P1.1** — schemas (everything builds on these types)
4. **README-P1.2** — action registry (how endpoints become hooks)
5. **README-P1.3** — mock-server (essential for understanding dev mode)
6. **README-P1.7** — WorkPane (the most complex component; understanding it unlocks the rest)
7. **README-P1.8 + P1.10** — task forms (the most repeated pattern)
8. Other phase readmes as needed

---

## 15 · Where to escalate questions

- **Component-level / bug-level** — same workflow as v3: open in the FE repo,
  tag Vipin (executor) + Vineeth-Second (orchestrator)
- **Schema / contract / endpoint shape** — surface to the orchestrator;
  may require coordination with the DMS BE session
- **Workflow engine behavior** — DMS BE session; FE expects the engine to
  advance per the workflows.ts definitions, but BE is authoritative
- **Lookups data** — primrose-lookups-service session
- **Tensaw-base / auth** — Tensaw platform session (separate from DAT)

For architecture-level changes (new workflow, new task type, new tab),
draft a proposal and run it past the orchestrator before implementing —
shared conventions and starter kits may need updates first.
