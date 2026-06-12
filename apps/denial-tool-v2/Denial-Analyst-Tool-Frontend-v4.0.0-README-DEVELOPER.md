# Denial Analyst Tool · Frontend — Developer README

Internal RCM platform's denial-management UI. React 18 + TypeScript, talks
to **denial-management-service v1.1.0** for case workflow + LLM appeal
generation. Built across 13 phases (P1.1–P1.15 minus P1.9).

This README orients you to **the codebase**. For architectural depth, read
[ARCHITECTURE.md](./ARCHITECTURE.md). For phase-by-phase history, see the
13 `README-P1.X.md` files.

---

## Quick start

```bash
# Install
npm install

# Run dev server with the bundled mock-server (no live BE needed)
VITE_USE_MOCKS=true npm run dev
# Navigate to http://localhost:5173/inbox

# Run dev against staging BE
VITE_API_BASE=https://dms-staging.primrose.internal npm run dev

# Run the full test suite
npm test              # vitest interactive suite (30 tests)
npm run test:smoke    # SSR sanity scripts (283 tests)

# Type-check
npm run typecheck     # tsc --strict --noEmit
```

If `npm run` scripts aren't wired into the package.json yet, the
equivalent commands are listed at the bottom of this README.

---

## What this app is

A three-pane workflow tool that AR analysts use to work denied insurance claims:

- **Left pane** — worklist of cases filtered by queue, payer, clinic, etc.
- **Middle pane** — the case being worked: LLM recommendation (accept or
  override), then the active task form once the workflow starts
- **Right pane** — reference data for the case: classification details,
  claim transactions, notes, files, appeal letter

Workflows are driven by a BE workflow engine. The FE submits task outcomes;
the engine decides the next task. Four workflows cover medical_necessity,
coding review, payer_call, and portal_first paths through resolution.

---

## Directory map (condensed)

```
src/
├── actions/            ← 24 typed actions (schemas + registry)
├── components/         ← UI by surface
│   ├── nav/              top bar
│   ├── worklist/         filter chips, pagination, states
│   ├── cards/            CaseCard
│   ├── work-pane/        proposed/in-flight/completed views + override dialog
│   ├── task-form/        11 task forms + primitives + action bar
│   ├── reference-panel/  5 tab components
│   └── LegacyRedirect.tsx
├── hooks/              ← 4 URL-state + mutation hooks
├── pages/              ← 3 pane-level compositions
├── lib/labels.ts       ← all the human-readable strings + color maps
├── utils/formatters.ts ← currency, date, confidence, urgency, initials
└── mocks/v4/           ← MSW v2 mock-server with engine simulator

stubs/                  ← test-only shims for @tensaw/actions + react-router-dom
                          (NOT included in production builds)
scripts/                ← 10 SSR sanity-check scripts (cheap structural tests)
tests/                  ← 6 vitest interactive tests
```

For a full file inventory + line counts, see the per-phase READMEs (each
phase's file list is in its README under "Files in this deliverable").

---

## Code conventions

### URL is the source of truth

Three panes coordinate via URL params, not props or context. To wire a new
URL-driven control, go through the existing hooks:

- `useQueueState` — `?queue=`
- `useWorklistUrlState` — `?case=`, filters, `?page=`
- `useActiveTab` — `?tab=`

Don't call `useSearchParams` directly from a component — the cross-param
rules (e.g. changing queue drops page+case) live in the hooks.

### Action registry, not raw fetch

Every endpoint is registered via `defineAction` and consumed via
`useActionQuery` / `useActionMutation`:

```tsx
const { data, isLoading } = useActionQuery('case.detail', { case_id });
const [fire, { isPending }] = useActionMutation('case.accept');
```

Both are fully typed — the action id narrows params and response shape.
TypeScript catches mismatched calls at compile time.

### Permission flags are props

`canViewCost`, `canReclassify`, etc. are passed as props from the shell.
Components don't read auth context internally. Reasons: testable in
isolation, auth shape can change without breaking components.

### Form pattern (for task forms)

All 11 task forms follow the same shape:

```tsx
export function FooForm({ case, task }) {
  const { complete, isPending } = useTaskComplete(case, task);
  const [field1, setField1] = useState(...);
  // ... more fields

  const canSubmit = /* required fields filled */;

  const submit = async (outcome) => {
    await complete(outcome, { field1, ... }, completionNote);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* FormField + primitives */}
      </div>
      <OutcomeActionBar
        successLabel="..."
        onSuccess={() => submit('SUCCESS')}
        canSubmitSuccess={canSubmit}
        isPending={isPending}
      />
    </div>
  );
}
```

### Booleans are SegmentedControl, not checkboxes

For Yes/No fields, use `<SegmentedControl<'no' | 'yes'>>` — bigger touch
targets, visually consistent with the rest of the form library.

### Tailwind utility classes only

No custom CSS. No `@apply`. Use the utility classes already in the design
language (see `lib/labels.ts` for color/styling helpers per category, queue,
priority, etc.).

---

## Common dev tasks

### Add a new task type (12th task type)

1. Add the fact schema in `src/actions/schemas-v4.ts`:
   ```ts
   export const NewTaskFactsSchema = z.object({ ... });
   export type NewTaskFacts = z.infer<typeof NewTaskFactsSchema>;
   ```
2. Add the type to the `TaskTypeSchema` union + register in `TaskFactsByType`
3. Create `src/components/task-form/NewTaskForm.tsx` — copy `IntakeTriageForm`,
   swap the field set
4. Add the case to `CurrentTaskBlock.tsx`'s switch:
   ```ts
   case 'new_task_type': return <NewTaskForm case={c} task={task} />;
   ```
5. Add a label in `src/lib/labels.ts` for `taskTypeLabel`, `taskHint`,
   and any new queue routing
6. Add SSR + jsdom tests following the existing patterns
7. Run `npm run typecheck && npm test && npm run test:smoke`

### Add a new BE endpoint

1. Add response schema to `schemas-v4.ts` or `schemas-v4-tabs.ts`
2. Add `defineAction` block to `src/actions/index-v4.ts` — set `actionId`,
   `kind`, `endpoint`, `request`, `response`, `cache` (tag + invalidatedBy)
3. If it's a mutation, add to the INVALIDATE matrix — list which other tags
   it invalidates so dependent queries re-fetch
4. Update `src/mocks/v4/handlers.ts` with a mock handler
5. Use the new action in components via `useActionQuery` / `useActionMutation`

### Add a 6th tab to the reference panel

1. Create `src/components/reference-panel/NewTab.tsx`
2. Add to `useActiveTab.ts`'s `VALID_TABS` array + the `TabId` union
3. Add to `TabStrip.tsx`'s `TAB_DEFS`
4. Add the branch in `ReferencePanel.tsx`:
   ```ts
   {activeTab === 'newtab' && <NewTab case={data} />}
   ```
5. Tests

### Add a new filter to the worklist

1. Add the filter field to `WorklistFilters` interface in `useWorklistUrlState.ts`
2. Add to `EMPTY_FILTERS`, the `useMemo` reader, and `FILTER_KEYS`
3. Add a `<FilterChip>` in `WorklistFiltersBar` consuming the new param
4. Add the param to the `queryParams` build in `WorklistPane.tsx`
5. Make sure the BE's `case.worklist` request schema accepts the new field

---

## Test infrastructure

Two complementary suites:

### SSR sanity scripts (`scripts/`)

```bash
# Run one
npx tsx scripts/sanity-check-v4-task-form.tsx

# Run all
for s in scripts/sanity-check-v4-*; do
  echo "→ $s"
  npx tsx "$s" 2>&1 | tail -2
done
```

Use `renderToString` + string matching. Fast (~5s total). Catches structural
regressions: missing fields, wrong labels, layout containers not rendering.
Doesn't cover interactions.

### Jsdom interactive tests (`tests/`)

```bash
# Run all
npx vitest run

# Watch mode
npx vitest

# Run one file
npx vitest run tests/intake-triage-form.test.tsx
```

`@testing-library/react` + `user-event`. Covers clicks, typing, dropdowns,
modals (Escape + backdrop), tab switching, mutation invocation. Slower
(~10s); catches what SSR can't.

Both stay in CI.

---

## Mock server (dev mode)

Activated with `VITE_USE_MOCKS=true`. Bundles a full **engine simulator**
that replicates the BE workflow behavior end-to-end. Walk Henderson's
medical_necessity workflow accept → 5 task completions → completed state,
all client-side.

See `src/mocks/v4/` and the **P1.3 readme** for details.

`X-Mock-User-Id` header drives the "current user" identity. Defaults to
`user_42` (Vipin K. in the seed data). Override to test multi-user
scenarios (e.g. originator + coding partner handoff).

---

## Where to read more

| Topic | File |
|---|---|
| System architecture, design tradeoffs, conventions | `ARCHITECTURE.md` |
| Domain types (Case, Task, Workflow, ...) | `README-P1.1.md` |
| How action registry works, INVALIDATE matrix | `README-P1.2.md` |
| Mock server + engine simulator | `README-P1.3.md` |
| Top bar + queue switcher | `README-P1.4.md` |
| Worklist card design | `README-P1.5.md` |
| Filter chips + pagination | `README-P1.6.md` |
| **WorkPane state-aware composition** (largest component) | `README-P1.7.md` |
| Task form primitives + IntakeTriageForm | `README-P1.8.md` |
| The other 10 task forms (CodingReview, ResolutionAction, ...) | `README-P1.10.md` |
| Reference panel (5 tabs + upload picker) | `README-P1.11.md` |
| Legacy redirect + jsdom test suite | `README-P1.12-P1.13.md` |
| v3 cleanup plan | `README-P1.14.md` |
| Staging integration kit | `README-P1.15.md` |

---

## Tech stack

| Layer | Tech |
|---|---|
| Language | TypeScript (strict mode) |
| Framework | React 18 |
| Data fetching | React Query (via `@tensaw/actions`) |
| Schema validation | Zod |
| Routing | react-router-dom |
| Styling | Tailwind CSS (utility classes only) |
| Mock server | MSW v2 |
| Test runner | Vitest |
| Component tests | @testing-library/react + user-event + jest-dom |
| Type-check + run scripts | tsc + tsx |

---

## NPM scripts (recommended `package.json` additions)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "for s in scripts/sanity-check-v4-*; do npx tsx \"$s\"; done",
    "test:all": "npm run typecheck && npm run test && npm run test:smoke"
  }
}
```

The current `package.json` in this archive has minimal scripts — Vipin
should expand these when integrating into the monorepo (the monorepo may
already have a turbo/lerna setup with its own conventions).

---

## Open questions / known limitations at archive time

These are flagged in detail in the phase readmes; summarizing the ones
likeliest to affect day-to-day work:

1. **Multipart file upload transport not wired.** `case.file.upload` action
   submits metadata; the binary transport (FormData + fetch interceptor)
   needs adding in the FE app shell. P1.11 readme explains.
2. **Permission props.** `canViewCost`, `canReclassify` are props; the shell
   needs to wire them from the auth context. Not auto-derived.
3. **No real-time updates.** If another user updates a case while you're
   viewing, manual refresh required. No push.
4. **Appeal editor is plain monospace textarea.** Functional; not WYSIWYG.
5. **Tab badge counts prefetch at panel mount.** Tradeoff documented in
   P1.11 readme (worth it for tab-heavy workflows; minor cost otherwise).

---

## When something breaks

The most-common failure modes (in rough order of likelihood):

1. **Cache invalidation stale after mutation** — check the INVALIDATE matrix
   in `src/actions/index-v4.ts`; the mutation may not list the affected tag
2. **Component renders wrong / blank** — verify the response shape matches
   what the component reads; schema drift between BE and FE is the usual
   culprit
3. **URL param not propagating** — make sure the writer is going through
   the proper hook (useQueueState / useWorklistUrlState / useActiveTab),
   not raw setSearchParams
4. **Test breaks after refactor** — SSR sanity scripts assert on rendered
   strings; if you changed a label, update the assertion. Vitest tests
   assert on accessible names; tighten the regex if a name now matches
   multiple elements (this happened during the P1.13 build — see the IntakeTriage
   `/^Resolution Records on hand/` pattern)
5. **TypeScript error after schema change** — TaskFactsByType registry
   in `schemas-v4.ts` means a schema change ripples through all 11 task
   forms; let tsc guide the fix

---

## End

For anything not covered here, the **per-phase readmes** are the next level
of detail. For broader architectural context, [ARCHITECTURE.md](./ARCHITECTURE.md)
is the canonical reference.

For pull requests, hand-offs, or staging coordination, route through the
orchestrator session (Vineeth-Second).
