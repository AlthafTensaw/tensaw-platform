# Denial Analyst Tool · Frontend v4.0.0 — Complete

Internal RCM platform's denial-management UI. Built across 13 active P1
phases (P1.9 skipped) for **denial-management-service v1.1.0**.

This archive contains:
- All source code (`src/`, `stubs/`)
- All SSR sanity scripts (`scripts/`)
- All jsdom interactive tests (`tests/`)
- Test infrastructure (`vitest.config.ts`, `src/test/setup.ts`, `src/test/helpers.tsx`)
- Per-phase READMEs (`README-P1.X.md`)
- v3 cleanup discovery script (`v3-cleanup-discovery.sh`)
- P1.15 status template (`P1.15-status-template.md`)

---

## Status

| Phase | Status |
|---|---|
| P1.1 — schemas | ✅ shipped |
| P1.2 — action registry | ✅ shipped |
| P1.3 — mock-server | ✅ shipped |
| P1.4 — TopNav + QueueSwitcher | ✅ shipped |
| P1.5 — CaseCard | ✅ shipped |
| P1.6 — WorklistPane | ✅ shipped |
| P1.7 — WorkPane (state-aware) | ✅ shipped |
| P1.8 — task-form primitives + IntakeTriageForm | ✅ shipped |
| ~~P1.9 — cache-write optimization~~ | skipped |
| P1.10 — remaining 10 task forms | ✅ shipped |
| P1.11 — reference panel (5 tabs + upload picker) | ✅ shipped |
| P1.12 — legacy /denials redirect | ✅ shipped |
| P1.13 — formal jsdom test suite | ✅ shipped |
| P1.14 — v3.x cleanup plan | ✅ plan shipped (Vipin executes) |
| P1.15 — staging integration kit | ✅ kit shipped (Vivek executes) |

---

## Verification at archive time

| Check | Result |
|---|---|
| `tsc --strict --noEmit` | clean across all source files |
| SSR smoke suite (`scripts/sanity-check-v4-*`) | **283/283** pass across 10 scripts |
| jsdom interactive suite (`tests/*.test.tsx`) | **30/30** pass across 6 test files |

Re-verify before merging into the FE monorepo:

```bash
npm install
npx tsc --noEmit
npx vitest run
for s in scripts/sanity-check-v4-*; do npx tsx "$s"; done
```

---

## Directory map

```
v400-work/
├── src/
│   ├── actions/
│   │   ├── schemas-v4.ts          # P1.1 — Case, EngineTask, Queue, WorklistRow, 11 task fact schemas
│   │   ├── schemas-v4-tabs.ts     # P1.2 — Note, FileEntity, Appeal, Transaction, Category, LookupItem
│   │   └── index-v4.ts            # P1.2 — registerCaseActions() — 24 actions (14 read + 10 write)
│   │
│   ├── components/
│   │   ├── LegacyRedirect.tsx     # P1.12 — /denials/* → /inbox
│   │   ├── cards/
│   │   │   ├── CaseCard.tsx           # P1.5 — 4-line worklist card
│   │   │   └── QueueRoutingChip.tsx   # P1.5
│   │   ├── nav/
│   │   │   ├── TopNav.tsx             # P1.4 — top bar shell
│   │   │   ├── QueueSwitcher.tsx      # P1.4 — queue picker dropdown
│   │   │   ├── NeedsMyReviewBadge.tsx # P1.4
│   │   │   ├── MyTasksLink.tsx        # P1.4
│   │   │   ├── BrandLogo.tsx          # P1.4
│   │   │   └── UserMenuStub.tsx       # P1.4
│   │   ├── worklist/
│   │   │   ├── WorklistFilters.tsx    # P1.6 — 5 filter chips with click-to-open dropdown
│   │   │   ├── WorklistStates.tsx     # P1.6 — skeleton, empty, error
│   │   │   └── WorklistPagination.tsx # P1.6
│   │   ├── work-pane/
│   │   │   ├── WorkPaneHeader.tsx       # P1.7 — persistent claim banner with 5 stat tiles
│   │   │   ├── WorkPaneStates.tsx       # P1.7
│   │   │   ├── WorkflowProgressStrip.tsx # P1.7 — preview + progress modes
│   │   │   ├── ProposedView.tsx         # P1.7 — LLM rec + accept/override/reclassify
│   │   │   ├── OverrideDialog.tsx       # P1.7 — modal for override flow
│   │   │   ├── InFlightView.tsx         # P1.8 — workflow strip + CurrentTaskBlock
│   │   │   └── CompletedView.tsx        # P1.7
│   │   ├── task-form/                   # P1.8 + P1.10
│   │   │   ├── TaskFormShell.tsx        # primitives — FormField, SegmentedControl, RouteGrid, ...
│   │   │   ├── OutcomeActionBar.tsx     # SUCCESS / NEEDS_INFO / FAIL_FATAL
│   │   │   ├── CurrentTaskBlock.tsx     # task header + exhaustive routing to 11 forms
│   │   │   ├── IntakeTriageForm.tsx     # P1.8 anchor
│   │   │   ├── CodingReviewForm.tsx     # P1.10
│   │   │   ├── CodingFeedbackReviewForm.tsx  # P1.10
│   │   │   ├── PayerCallForm.tsx        # P1.10
│   │   │   ├── PortalStatusCheckForm.tsx # P1.10
│   │   │   ├── ResolutionActionForm.tsx # P1.10
│   │   │   ├── AwaitingPayerCheckForm.tsx # P1.10
│   │   │   ├── AMReviewForm.tsx         # P1.10
│   │   │   ├── PostingApplyForm.tsx     # P1.10
│   │   │   ├── BankRecMatchForm.tsx     # P1.10
│   │   │   └── HighDollarOversightForm.tsx # P1.10
│   │   └── reference-panel/             # P1.11
│   │       ├── TabStrip.tsx
│   │       ├── AnalysisTab.tsx
│   │       ├── PaymentsTab.tsx
│   │       ├── NotesTab.tsx
│   │       ├── FilesTab.tsx              # includes upload picker
│   │       └── AppealTab.tsx             # generate / edit / finalize / submit
│   │
│   ├── hooks/
│   │   ├── useQueueState.ts          # P1.4 — queue picker URL state
│   │   ├── useWorklistUrlState.ts    # P1.6 — filter + page URL state
│   │   ├── useTaskComplete.ts        # P1.8 — task.complete mutation wrapper
│   │   └── useActiveTab.ts           # P1.11 — ?tab= URL state
│   │
│   ├── pages/
│   │   ├── WorklistPane.tsx          # P1.6 — left pane composition
│   │   ├── WorkPane.tsx              # P1.7 — middle pane state-aware composition
│   │   └── ReferencePanel.tsx        # P1.11 — right pane with tabs
│   │
│   ├── lib/
│   │   └── labels.ts                 # P1.5 — task_type/queue/category/state/priority labels + colors
│   │
│   ├── utils/
│   │   └── formatters.ts             # P1.5 — currency / date / confidence / urgency / initials
│   │
│   ├── mocks/v4/                     # P1.3 — MSW v2 mock-server with engine simulator
│   │   ├── workflows.ts              # 4 workflow definitions
│   │   ├── db.ts                     # in-memory database
│   │   ├── seed.ts                   # 15 hand-crafted seed cases
│   │   ├── handlers.ts               # all 24 endpoint handlers
│   │   └── index.ts                  # MSW setup
│   │
│   └── test/                         # P1.13
│       ├── setup.ts                  # jest-dom matchers + per-test reset
│       └── helpers.tsx               # baseCase, queues, categories, setupStandardMocks
│
├── stubs/
│   ├── tensaw/actions.ts             # @tensaw/actions stub (real package in prod)
│   └── react-router-dom.ts           # router stub with shared store for tests
│
├── scripts/                          # SSR sanity-check harnesses
│   ├── sanity-check-v4-schemas.ts          # P1.1 — 24 tests
│   ├── sanity-check-v4-registry.ts         # P1.2 — 26 tests
│   ├── sanity-check-v4-mock-server.ts      # P1.3 — 25 tests
│   ├── sanity-check-v4-topnav.tsx          # P1.4 — 19 tests
│   ├── sanity-check-v4-case-card.tsx       # P1.5 — 47 tests
│   ├── sanity-check-v4-worklist-pane.tsx   # P1.6 — 20 tests
│   ├── sanity-check-v4-work-pane.tsx       # P1.7 — 34 tests
│   ├── sanity-check-v4-task-form.tsx       # P1.8 — 32 tests
│   ├── sanity-check-v4-task-forms-all.tsx  # P1.10 — 30 tests
│   └── sanity-check-v4-reference-panel.tsx # P1.11 — 26 tests
│
├── tests/                            # P1.13 jsdom interactive tests
│   ├── legacy-redirect.test.tsx       # 4 tests (P1.12)
│   ├── worklist-filters.test.tsx      # 5 tests
│   ├── intake-triage-form.test.tsx    # 5 tests
│   ├── override-dialog.test.tsx       # 6 tests
│   ├── reference-panel-tabs.test.tsx  # 5 tests
│   └── notes-tab.test.tsx             # 5 tests
│
├── vitest.config.ts
├── tsconfig.json
├── package.json
│
├── v3-cleanup-discovery.sh           # P1.14 — read-only inventory script
├── P1.15-status-template.md          # P1.15 — fillable validation template
│
└── README-P1.X.md                    # 13 phase-specific READMEs (1 per phase)
```

---

## Tech stack

- **React 18** + **TypeScript** (strict mode)
- **React Query** (via `@tensaw/actions` — `useActionQuery` / `useActionMutation`)
- **Zod** for schema validation
- **MSW v2** for mocks (Node-based for tests; service-worker for dev)
- **Tailwind CSS** (class-based; no compiler magic — only utility classes)
- **react-router-dom** for routing (stubbed; real package in production)
- **Vitest** + **@testing-library/react** + **@testing-library/user-event** for interactive tests
- **tsx** for running SSR sanity scripts directly

---

## Integration into the FE monorepo

This archive is structured for direct drop-in into the `tensaw-v1.3.0` React/TypeScript
monorepo. Notes for the integration PR:

1. **The `stubs/` folder doesn't merge into prod.** Production uses real
   `@tensaw/actions` and `react-router-dom`. The stubs are needed for the
   isolated SSR + jsdom test environment in this archive.

2. **Aliases in `tsconfig.json` + `vitest.config.ts`** map `@tensaw/actions`
   and `react-router-dom` to the stubs. Drop these alias entries when
   merging into the monorepo (real packages take over).

3. **`src/mocks/v4/`** is the v4 MSW handler set. The existing FE monorepo
   may have a `src/mocks/` directory with v3 handlers. P1.14 (cleanup plan)
   covers the merge strategy — mixed files get surgical edits, pure-v3
   files get deleted whole.

4. **`scripts/sanity-check-v4-*`** can stay as-is in CI as cheap structural
   smoke tests, OR can be dropped in favor of the jsdom suite in `tests/`.
   Both verify different things (SSR structure vs interactive behavior);
   recommend keeping both.

5. **File upload multipart wiring** (mentioned in P1.11 readme) — the
   `case.file.upload` action submits metadata JSON; the actual binary
   transport needs a few lines in the fetch interceptor. Not in this
   archive — small TODO for the FE app shell wiring.

6. **`canViewCost` + `canReclassify`** are props, not derived from auth
   context. The shell needs to pass them based on the user's permissions
   per the auth context the FE app already has.

---

## Per-phase readmes

Each phase has its own README with:
- File inventory + line counts
- Design decisions + tradeoffs
- Verification results
- Integration steps specific to that phase
- What's NOT in that phase (intentional cuts)

Read order for someone new to the codebase:

1. **README-P1.1** — schemas (start here; everything builds on these types)
2. **README-P1.2** — action registry (how queries/mutations are wired)
3. **README-P1.3** — mock-server (the engine simulator that makes the FE walkable end-to-end)
4. **README-P1.4** through **README-P1.11** — UI shells in dependency order
5. **README-P1.12-P1.13** — redirect + test suite
6. **README-P1.14** — v3 cleanup plan (execution doc for Vipin)
7. **README-P1.15** — staging integration kit (execution doc for Vivek)

---

## End-to-end walkthrough (what to expect after merging)

With this archive integrated, the team can walk every seeded workflow against
the mock server (`VITE_USE_MOCKS=true`):

- **medical_necessity_resolution** (Henderson): 5 steps — intake → resolution → awaiting → AM review → posting → completed
- **coding_review_branch** (Whitfield, with team-handoff return): 6 steps — intake → coding_review (on coding queue) → coding_feedback_review (returned to originator with the "Returned to you" bar) → resolution → awaiting → posting
- **payer_call_resolution** (override flow): 4 steps — intake → payer_call → resolution → awaiting
- **portal_first_resolution**: 5 steps — intake → portal_status_check → resolution → awaiting → posting

No GenericTaskFallback hit for any seeded workflow — all 11 task types route to concrete forms.

---

## Build summary

| Metric | Count |
|---|---|
| Source files | ~70 |
| Source lines | ~14,000 |
| SSR sanity tests | 283 |
| jsdom interactive tests | 30 |
| Phase READMEs | 13 |
| Total tests | 313 |

This is the complete v4.0.0 build from the orchestrator session's perspective.
P1.14 (cleanup) and P1.15 (staging integration) are the next executional steps,
performed against the live FE monorepo by Vipin and Vivek respectively.

---

## Questions

Open them in the orchestrator session. Each phase readme has its own
"What's NOT in this phase" section that calls out intentional scope cuts and
flags where follow-up work belongs.

For the build to fail in the next phase or in production, the most common
suspects (in order of likelihood) are:
1. **Real multipart transport for file upload** — not wired yet (P1.11 flag)
2. **`useActionQuery`/`useActionMutation` API drift** — if the real `@tensaw/actions`
   diverged from what the stub assumed; verify integration with the actual package
3. **Auth context shape** — `canViewCost` / `canReclassify` props need to be
   wired from somewhere; verify the shell wires them correctly
4. **Cache invalidation tags** — the INVALIDATE matrix in `actions/index-v4.ts`
   names tags by string; verify they match what the real registry expects

— end —
