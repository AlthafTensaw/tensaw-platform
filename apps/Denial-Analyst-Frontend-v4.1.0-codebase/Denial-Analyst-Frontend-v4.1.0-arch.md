# Denial Analyst Tool — Frontend v4.1 · Architecture

**Model:** engine-handler. A workflow engine owns case progression and **dispatches tasks** to the denial-management-service (DMS); DMS is a *handler*. The frontend reads a DMS-local worklist and **completes the dispatched task**. The FE never calls the engine.

This supersedes v4.0.0 (never shipped). v4.1 is now the only model in the codebase — the v4.0.0 surface and all coexistence scaffolding were removed in R12.

---

## 1. The four reversals from v4.0.0

| # | v4.0.0 (wrong) | v4.1 (correct) |
|---|---|---|
| 1 | Worklist was an engine projection of cases | Worklist = DMS-local `analyst_worklist_task` table, one row per **dispatched task**, fed by engine pushes |
| 2 | Personal `user_<id>` queue + `needs_my_review` + returned-to-originator | No personal queue, no review-back. Work flows forward **team → team** |
| 3 | High-dollar was a parallel sidecar task + HD queue | `is_high_dollar` is a **flag** on `case_facts` — a filter toggle + a badge, nothing more |
| 4 | `case_status` lifecycle (proposed→accepted→…); "Accept LLM rec" started a workflow | No `case_status`. The workflow is already running; the analyst **completes the active task**. "Accepting the rec" is folded into completing `ANALYST_TRIAGE_DENIAL` |

The LLM recommendation is now **context** shown beside the active task's form — there is no Accept/Override affordance.

---

## 2. Request / response shapes

**Worklist row** (`GET /api/v1/worklist`, `GET /api/v1/worklist/{task_id}`):

```
{ task_id, case_id, task_type, status, priority, team, dispatched_at,
  case_context { case_type, state_code, task_type, clinic_id, payer_id },
  case_facts  { is_high_dollar, ... },          // passthrough; flag required
  claim_summary { claim_id, patient_name, mrn, dos,
                  net_pending (STRING), aging_bucket,
                  primary_payer_name, clinic_name } }
```

**Complete** (`POST /api/v1/worklist/{task_id}/complete`):

```
{ outcome: 'SUCCESS' | 'NEEDS_INFO' | 'FAIL_FATAL',
  facts_to_set: { ... },        // per task_type (§6 shapes)
  completion_note?: string }
```

The FE only ever sends `SUCCESS` / `NEEDS_INFO` / `FAIL_FATAL`. `RETRY_LATER` / `NEEDS_HUMAN` / `SUPERSEDED` are engine-internal.

**Case detail** (`GET /api/v1/cases/{case_id}`, action `case.detail`): no `case_status`; carries `state_code`, `open_task_ids`, `recommended_category/confidence/reasoning`, and financials as **decimal strings**.

`net_pending` and all financials are strings end-to-end; the FE formats with `formatCurrencyStr`.

Notes / files / appeals / lookups / categories endpoints are **unchanged** from v3/v4.

---

## 3. Teams (13) and task types (17)

**Teams** (the queue dimension; `?queue=<team>`): `denial_intake_analyst`, `ar_analyst`, `emr_support`, `coding`, `am`, `resolution`, `coordinator`, `demo`, `credentialing`, `liaison`, `billing`, `portal_status`, `calling`.

**Human task types** (each routes to a completion form): `ANALYST_TRIAGE_DENIAL`, `ANALYST_INVESTIGATE_ROOT_CAUSE`, `CALLER_GET_DENIAL_REASON`, `PORTAL_CHECK_STATUS`, `BHAVANA_PULL_EMR`, `ANALYST_PATIENT_OUTREACH`, `COORDINATOR_FACILITY_CONTACT`, `CODER_REVIEW_RECORD`, `RESOLUTION_REFILE_CLAIM`, `RESOLUTION_FILE_APPEAL`, `ANALYST_AWAIT_PAYER_RESPONSE`, `AM_DECIDE_DISPOSITION`, `POSTING_VALIDATE_PAYMENT`, `DEMO_RETRIEVE_ID`, `CZAR_VERIFY_CREDENTIALING`, `LIAISON_EXTERNAL_ESCALATION`, `BILLING_PROCESS_DISPOSITION`. (`FAX_FACILITY_BATCH` is automated and never appears in the worklist.)

Decision forms map a field to the outcome: BhavanaPullEmr (found→SUCCESS / else→NEEDS_INFO), PatientOutreach (info→SUCCESS / unresponsive→NEEDS_INFO), AwaitPayer (paid·overturned→SUCCESS / waiting→NEEDS_INFO / denied·upheld→FAIL_FATAL), CzarCredentialing (verified·data_lag→SUCCESS / true_gap→FAIL_FATAL).

---

## 4. File map (post-rename)

```
src/actions/
  schemas.ts            WorklistTask + 17 task-fact schemas + TaskFactsByType
                        (exhaustive compile guard) + Team/TEAM_LABELS + CaseDetail
  schemas-v4-tabs.ts    shared: Notes/Files/Appeal/Transactions/Categories/Lookups
  index.ts              action registry (19 actions) + INVALIDATE matrix
src/hooks/
  useTeamQueue.ts             ?queue= ⇒ Team (role-default fallback)
  useWorklistUrlState.ts      filters (task_type first-class + is_high_dollar) + page
  useTaskComplete.ts          fires worklist.complete
  useActiveTab.ts             ?tab= (shared)
src/pages/
  WorklistPane.tsx      reads worklist.list, renders task-row CaseCards
  WorkPane.tsx          ?case= → case.detail → active task → completion form
  ReferencePanel.tsx    TabStrip + AnalysisTab + 4 shared tabs
src/components/
  cards/CaseCard.tsx           dispatched-task row (task_type headline)
  nav/{TopNav,QueueSwitcher}.tsx
  worklist/WorklistFilters.tsx + shared States/Pagination
  work-pane/{WorkPaneHeader,CurrentStateStrip,LlmRecContext}.tsx
  task-form/
    TaskFormScaffold.tsx       shared wrapper (note + OutcomeActionBar + wiring)
    TaskForms.tsx              all 17 typed forms
    CurrentTaskBlock.tsx       exhaustive task_type → form router
    GenericTaskForm.tsx        fallback
    OutcomeActionBar.tsx, TaskFormShell.tsx   (shared primitives)
  reference-panel/
    AnalysisTab.tsx            case_facts + LLM rec as context
    {Notes,Files,Appeal,Payments}Tab.tsx   version-agnostic (caseId prop)
src/lib/labels.ts        TASK_TYPE_LABELS + taskHint + formatCurrencyStr + agingBucketTone
src/mocks/server/        dispatch-loop simulator (routing, db, seed, handlers)
```

The 4 reference tabs were refactored to take `caseId: string` (they only need the id), so they're shared infrastructure with no version coupling.

---

## 5. Action registry

19 actions. Dropped from v4: `case.tasks`, `task.mine`, `queue.list`, `case.accept`, `case.override`, `case.reclassify`, `case.signal`. Renamed: `case.worklist`→`worklist.list`, `task.complete`→`worklist.complete`. Added: `worklist.task`, `worklist.counts`.

`worklist.complete` is the cache driver in the `INVALIDATE` matrix — completing a task invalidates `worklist.list`, `worklist.counts`, and `case.detail` (+ notes), so the pane re-resolves the case's *new* active task automatically.

`case.detail` returns the v4.1 shape. (During the R1–R11 build it lived under a parallel `case.detail.v41` key for v4/v41 coexistence; R12 collapsed it back to `case.detail`.)

---

## 6. Mock — dispatch-loop simulator (`src/mocks/server`)

`routing.ts` implements a pure `nextDispatch(task_type, outcome, facts) → {task_type, team} | null` over all 17 types. `db.ts` holds the local worklist table; `completeTask` runs the loop (close the row → merge facts → system note → dispatch the next task or resolve the case). `seed.ts` seeds 15 cases + 15 OPEN rows. This lets the FE exercise the full team→team flow with no engine.

---

## 7. Verification

- `tsc --strict`: clean.
- 9 SSR sanity scripts (`scripts/sanity-check-*`): 203 checks — schemas, registry, mock end-to-end walk, nav, card, worklist pane, work pane, **17 task forms with per-type fact-shape validation against `TaskFactsByType`**, reference panel.
- jsdom (vitest + RTL): 22 tests — gate-set form fill→submit→assert `worklist.complete` payload, reference-panel tab switching, worklist filter toggle, notes add, legacy redirect.

The fact-shape validation is the key contract guarantee: every form emits a `facts_to_set` that parses against its §6-derived schema, so OpenAPI drift surfaces at the schema boundary.

---

## 8. Revision journey (R1–R13)

R1 schemas · R2 registry · R3 mock · R4 TopNav/QueueSwitcher · R5 CaseCard · R6 WorklistPane · R7 WorkPane (kill 3-state branching) · R8 17 task forms · R9 Analysis tab · R10 tests · R11 mockup · R12 cleanup (delete v4, collapse `case.detail`, rename) · R13 integration. Throughout R1–R11 the v4.0.0 surface stayed green via parallel files; R12 removed it.
