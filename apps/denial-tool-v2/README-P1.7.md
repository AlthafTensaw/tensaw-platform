# FE v4.0.0 · P1.7 — WorkPane state-aware rewrite

**Phase:** P1.7 (the largest single component in v4)
**Anchored on:** mockups #8 (proposed), #9 (in-flight + intake form)
**Status:** Code-complete; `tsc --strict` clean + 34/34 SSR smoke tests pass

---

## What's in this deliverable

8 source files + 1 smoke test. Ships the full state-aware WorkPane shell with `ProposedView` fully wired (Accept/Override/Re-classify), `InFlightView` as a structural placeholder for P1.8, and `CompletedView` for the terminal state.

| File | Lines | Drop-in path |
|---|---|---|
| `WorkPane.tsx` | 92 | `src/pages/WorkPane.tsx` |
| `WorkPaneHeader.tsx` | 213 | `src/components/work-pane/WorkPaneHeader.tsx` |
| `WorkPaneStates.tsx` | 137 | `src/components/work-pane/WorkPaneStates.tsx` |
| `ProposedView.tsx` | 250 | `src/components/work-pane/ProposedView.tsx` |
| `OverrideDialog.tsx` | 209 | `src/components/work-pane/OverrideDialog.tsx` |
| `InFlightView.tsx` | 124 | `src/components/work-pane/InFlightView.tsx` |
| `CompletedView.tsx` | 105 | `src/components/work-pane/CompletedView.tsx` |
| `WorkflowProgressStrip.tsx` | 144 | `src/components/work-pane/WorkflowProgressStrip.tsx` |
| `sanity-check-v4-work-pane.tsx` | 432 | `scripts/sanity-check-v4-work-pane.tsx` |

Total: ~1700 lines added.

---

## State-aware branching

```
       ┌──────────────────────────────────────────┐
       │  WorkPane                                │
       └────┬─────────────────────────────────────┘
            │
   ┌────────┼──────────┬─────────────────┬──────────────────┐
   │        │          │                 │                  │
   ▼        ▼          ▼                 ▼                  ▼
?case=    case.detail  case.detail       case.detail        case.detail
 null     loading      errored           returned + status: returned + status:
   │        │          │                 │ proposed         │ accepted/overridden/completed
   ▼        ▼          ▼                 ▼                  ▼
Empty   Skeleton    Error+Retry     ProposedView         InFlightView (accepted/overridden)
                                                          CompletedView (completed)
```

The **WorkPaneHeader** (claim banner) is persistent — it renders above the branch content for all three loaded states.

---

## ProposedView (mockup #8)

Anchored on mockup #8. Contents:

1. **LLM recommendation card** — blue-tinted block with:
   - Category cat-dot color + label
   - Confidence percentage
   - Reasoning text
   - "Classified [date]" + tool_version

2. **Workflow preview strip** — dashed circles showing what would run if Accept were clicked. Step labels pulled from `category.list[recommended_category].workflow_step_labels`.

3. **Action bar** (sticky at bottom):
   - `[✓ Accept recommendation]` — primary, emerald, fires `case.accept`
   - `[⤴ Override…]` — opens `OverrideDialog`
   - `[↻ Re-classify]` — only when `canReclassify` prop is true (manager-only); fires `case.reclassify`

### Override flow

`OverrideDialog` is a self-contained modal:
- Backdrop click + Escape close it
- Category dropdown populated from `category.list`, **excluding** the LLM's recommended category (you can't "override" to the same answer — that's just Accept)
- Optional reasoning textarea
- Submit fires `case.override` mutation
- On success, dialog closes; cache invalidation re-fetches `case.detail`, pane re-renders as overridden state

No Radix dep — same minimal-modal pattern as QueueSwitcher's dropdown.

---

## InFlightView (P1.7 vs P1.8)

P1.7 ships **structural placeholder** for `accepted` and `overridden` states:

✅ Workflow progress strip showing completed/current/upcoming steps
✅ Current task summary card (task_type + task_id + queue chip + urgency)
✅ Task-type hint text from `lib/labels`

⏳ Coming in P1.8:
- Task-type-specific form rendering (intake_triage has different fields from payer_call, etc.)
- TaskFormShell with outcome-coded action bar (green=SUCCESS, amber=NEEDS_INFO, red=FAIL_FATAL)
- `task.complete` mutation wiring

The placeholder bar at bottom says "Task form rendering ships in P1.8 — current task structure is shown above." Vivek can verify the workflow strip + task summary work end-to-end now; the form filling-in happens next.

---

## CompletedView

Simple terminal-state view:
- Green "Case completed" banner with last-updated timestamp
- Full workflow strip with all steps marked complete
- List of recent tasks (most-recent 5)

Re-open flow isn't here — out of scope per the v4 contract.

---

## WorkflowProgressStrip — reusable

The strip component has two modes — same component, different visual:

**`mode="preview"`**: all steps dashed, no "current" marker. Used in ProposedView.
**`mode="progress"`**: completed steps filled green with ✓, current step ringed blue, upcoming dashed. Requires `currentIndex` prop.

Both modes render the same `<ol>` element with `aria-current="step"` on the current step. Step labels are passed in by the parent — the strip is a pure rendering component.

Will be heavily reused by P1.8's CurrentTaskBlock and P1.X surfaces showing case progress at-a-glance.

---

## WorkPaneHeader — persistent claim banner

```
┌──────────────────────────────────────────────────────────────────┐
│ Henderson, J  MRN 72834  Claim 300138  [Proposed] [HD]    $230.00│
│                                                          PENDING │
│ DOS 02/24/26 · LSAT · Dr. M. Patel · Humana GP · LSAT Outpatient │
│ ┌────────┬────────┬──────────┬──────────┬────────────┐           │
│ │ Billed │ Paid 1°│ Pending 1│ Aging    │ Category   │           │
│ │ $250   │ $0     │ $230     │ 90-119d  │ ● Medical… │           │
│ └────────┴────────┴──────────┴──────────┴────────────┘           │
│ ICD J45.20 J30.1                                                 │
└──────────────────────────────────────────────────────────────────┘
```

5 stat tiles, aging color-tinted (severe = red, warning = amber), category with cat-dot. ICD codes only show when present. Facility name conditional too. HD badge conditional on `is_high_dollar`.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

### SSR smoke (34 tests)

```
=== WorkflowProgressStrip ===              4/4  passed
  · preview mode all dashed
  · progress mode shows checkmarks for completed
  · current step has ring highlight
  · empty steps returns null

=== WorkPaneStates ===                     3/3  passed
  · Empty / Skeleton / Error variants

=== WorkPaneHeader ===                     7/7  passed
  · patient/MRN/claim_id/status pill render
  · currency formatted
  · HD badge conditional on is_high_dollar
  · stat tiles (Billed / Paid / Pending / Aging / Category)
  · ICD codes shown when present
  · provider + facility shown

=== ProposedView ===                       8/8  passed
  · LLM rec block with category + confidence
  · reasoning rendered
  · workflow preview with 5 dashed steps
  · Accept button emerald (primary)
  · Override button (secondary)
  · Re-classify gated by canReclassify prop
  · OverrideDialog hidden by default

=== OverrideDialog ===                     4/4  passed
  · title + recommended category context + form fields
  · dropdown excludes recommended category
  · submit button amber (override accent)
  · role=dialog + aria-modal=true

=== InFlightView ===                       3/3  passed
  · workflow strip with current step
  · current task card with type + urgency
  · P1.8 placeholder note

=== CompletedView ===                      3/3  passed
  · green completed banner
  · workflow strip with all steps complete
  · recent tasks listed

=== WorkPane composition ===               2/2  passed
  · Empty state when no ?case=
  · Empty branch keeps aria-label intact

34 passed · 0 failed
```

### What SSR can't cover (deferred to P1.13)

- `Accept` button click → mutation → cache invalidation → pane re-renders as accepted
- Override dialog open → fill form → submit → dialog closes
- Escape closes dialog
- Backdrop click closes dialog
- Loading state on Accept button (`Accepting…` text)

The mock-server (P1.3) exercises the *server side* of these flows end-to-end (the smoke test in P1.3 walks Henderson through accept → 5 task completions → completed). The FE *click-driven* equivalent needs jsdom + @testing-library/react in P1.13.

---

## What you can do end-to-end now

With everything from P1.1 → P1.7 + the P1.3 mock-server:

1. Launch dev with `VITE_USE_MOCKS=true`
2. Land on default queue, see 6 proposed cases
3. Click Henderson card → URL gets `?case=case_000001`
4. Middle pane (`WorkPane`) renders Henderson's ProposedView:
   - LLM rec: "Medical Necessity, 92% confidence"
   - Workflow preview: 5 dashed circles
5. Click **Accept recommendation**:
   - `case.accept` mutation fires
   - Mock simulator transitions to accepted, opens intake_triage on Denial Intake queue
   - `case-detail` cache invalidates → WorkPane re-renders as InFlightView
   - Workflow strip shows step 1 (Intake triage) ringed blue, no completed steps yet
   - Current task card shows task details + urgency
6. Switch to Coding queue → see Whitfield card with coding_review task
7. Click Whitfield → see InFlightView positioned at step 2 (Coding review)
8. Try Override on a fresh proposed case:
   - Click Override → dialog opens with category picker
   - Pick "Auth Missing" + add reasoning → Submit
   - Dialog closes; case transitions to overridden; payer_call workflow starts

What you can't do yet (P1.8): complete the current task to advance the workflow. The mock supports it but the FE UI for filling out the task-type-specific form hasn't been built.

---

## Integration steps

1. Drop the 8 files into the paths above
2. In your router, mount `<WorkPane />` as the middle pane:
   ```tsx
   <ThreePaneShell
     left={<WorklistPane />}
     middle={<WorkPane canReclassify={permissions.has('denial.classify')} />}
     right={<ReferencePanelStub />}  // P1.11
   />
   ```
3. Make sure the cache invalidation rules from P1.2 are in effect — when `case.accept` fires, the `case-detail` tag should invalidate, triggering the re-render. This is automatic if you registered the v4 actions per P1.2 integration steps.

---

## Two design decisions worth flagging

### 1. OverrideDialog excludes the recommended category from the dropdown

A user explicitly clicking "Override" then picking the same category as the LLM recommended would be a confusing no-op. The dropdown filters out `recommendedCategory` so the only options are *actually different* categories. If they want to confirm the LLM was right, they click Accept instead.

If you'd rather show all categories (so users can compare them in the dropdown), 1-line change in `ProposedView`.

### 2. canReclassify is a prop, not derived from auth context inside the component

Same pattern as `canViewCost` in P1.4's TopNav. WorkPane takes a `canReclassify` prop; parent passes it after consulting auth state once. Reasons: testable without auth-context mocking, and the auth context shape can change without breaking the work pane.

---

## What's NOT in P1.7 (intentional cuts)

- **Task form rendering** — P1.8 deliverable (CurrentTaskBlock + TaskFormShell + IntakeTriageForm)
- **Reference panel** (right pane) — P1.11 deliverable (Notes/Files/Appeal/History/Analysis tabs)
- **Reveal-PHI audit click handling** — would attach to the PHI fields in the header but `case.reveal-phi` mutation wiring is a polish pass
- **Realtime updates** — if another user updates the case while we're viewing, we don't push updates. Manual refresh works.
- **Override → re-Override** — once a case is overridden, you can't re-override (state machine restricts). Not a v4 limitation, just noting.

---

## What comes next (P1.8)

Per the design contract §8: **CurrentTaskBlock + TaskFormShell + IntakeTriageForm** — fills in the InFlightView placeholder with real task-form rendering.

P1.8 scope:
- `TaskFormShell.tsx` — the form skeleton (label, field, hint, segmented buttons, route-grid, textarea primitives)
- `CurrentTaskBlock.tsx` — wraps a task with form + outcome-coded action bar
- `IntakeTriageForm.tsx` — first concrete task form (the anchor for the other 10)
- `task.complete` mutation wiring

After P1.8, Henderson can be walked through the full workflow end-to-end in the UI: accept → fill intake_triage → see resolution_action open → repeat → completed state.

Say `"start P1.8"` and I'll ship it.

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `WorkPane.tsx` | `src/pages/WorkPane.tsx` |
| `WorkPaneHeader.tsx` | `src/components/work-pane/WorkPaneHeader.tsx` |
| `WorkPaneStates.tsx` | `src/components/work-pane/WorkPaneStates.tsx` |
| `ProposedView.tsx` | `src/components/work-pane/ProposedView.tsx` |
| `OverrideDialog.tsx` | `src/components/work-pane/OverrideDialog.tsx` |
| `InFlightView.tsx` | `src/components/work-pane/InFlightView.tsx` |
| `CompletedView.tsx` | `src/components/work-pane/CompletedView.tsx` |
| `WorkflowProgressStrip.tsx` | `src/components/work-pane/WorkflowProgressStrip.tsx` |
| `sanity-check-v4-work-pane.tsx` | `scripts/sanity-check-v4-work-pane.tsx` |
| `README-P1.7.md` | reference only |
