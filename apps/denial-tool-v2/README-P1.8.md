# FE v4.0.0 · P1.8 — Task forms (CurrentTaskBlock + TaskFormShell + IntakeTriageForm)

**Phase:** P1.8 (fills the P1.7 InFlightView placeholder)
**Anchored on:** mockup #9 (in-flight with intake_triage form) + mockup #12 (reusable task form pattern)
**Status:** Code-complete; `tsc --strict` clean + 32/32 SSR smoke tests pass

---

## What's in this deliverable

5 source files + 1 updated file + 1 smoke test. Ships the form primitives, the action bar pattern, the mutation wrapper hook, the first concrete form (intake_triage), and the routing/fallback infrastructure.

| File | Lines | Drop-in path |
|---|---|---|
| `TaskFormShell.tsx` | 313 | `src/components/task-form/TaskFormShell.tsx` |
| `OutcomeActionBar.tsx` | 145 | `src/components/task-form/OutcomeActionBar.tsx` |
| `IntakeTriageForm.tsx` | 215 | `src/components/task-form/IntakeTriageForm.tsx` |
| `CurrentTaskBlock.tsx` | 173 | `src/components/task-form/CurrentTaskBlock.tsx` |
| `useTaskComplete.ts` | 56 | `src/hooks/useTaskComplete.ts` |
| `InFlightView.tsx` (updated) | 92 | `src/components/work-pane/InFlightView.tsx` |
| `sanity-check-v4-task-form.tsx` | 470 | `scripts/sanity-check-v4-task-form.tsx` |

Total: ~1500 lines added, ~50 lines modified (InFlightView).

---

## Architecture

```
┌─ InFlightView ───────────────────────────────────────────┐
│  WorkflowProgressStrip (workflow context)                │
│  ┌─ CurrentTaskBlock ─────────────────────────────────┐  │
│  │  TaskHeader (task type + id + queue chip + urgency)│  │
│  │  ┌─ Form (picked by task_type) ─────────────────┐  │  │
│  │  │  IntakeTriageForm                            │  │  │
│  │  │  ├ FormField + Select (category)             │  │  │
│  │  │  ├ FormField + SegmentedControl (priority)   │  │  │
│  │  │  ├ FormField + RouteGrid (route)             │  │  │
│  │  │  └ FormField + Textarea (notes)              │  │  │
│  │  │  ── OR ──                                    │  │  │
│  │  │  GenericTaskFallback (for not-yet-built)     │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │  OutcomeActionBar (Cancel | NEEDS_INFO | SUCCESS)  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

`CurrentTaskBlock` is the router: looks at `task.task_type`, picks the matching form, falls back to `GenericTaskFallback` for task types that haven't gotten a concrete form yet.

---

## TaskFormShell primitives

Composable parts every task form uses:

| Primitive | Purpose |
|---|---|
| `FormField` | Wrapper that pairs label + input + hint + error in a consistent vertical layout |
| `FormLabel` | Accessible `<label>` with optional required asterisk |
| `FormHint` | Helper text below input (hint for the analyst) |
| `FormError` | Validation error text with `role=alert` |
| `SegmentedControl<T>` | Pill-row picker for small enum sets (priority, etc.) |
| `RouteGrid<T>` | Card-style picker for routing decisions (e.g., triage route) |
| `Textarea` / `Input` / `Select` | Styled native form controls (controlled components) |

All are controlled — caller owns state. `SegmentedControl` and `RouteGrid` are generic over `T extends string` so you get compile-time correctness on option values.

---

## OutcomeActionBar — the universal action bar

Every task form ends with this bar. Per the design contract, outcome-coded:

```
┌────────────────────────────────────────────────────────────┐
│ [Cancel] [⚠ NEEDS_INFO] [✗ FAIL_FATAL]        [✓ SUCCESS] │
│            amber          red (rare)            emerald     │
└────────────────────────────────────────────────────────────┘
```

- **SUCCESS** (right, emerald) — always shown; disabled when `canSubmitSuccess=false`
- **NEEDS_INFO** (amber) — shown when `onNeedsInfo` provided
- **FAIL_FATAL** (red destructive) — shown when `onFailFatal` provided; rare per task type
- **Cancel** (outline) — shown when `onCancel` provided

Labels are configurable per form: intake_triage uses "Complete triage" / "Needs more info"; appeal forms might use "Submit appeal"; closing forms might use "Write off case" with FAIL_FATAL exposed.

While a mutation is in flight (`isPending=true`), all buttons disable and SUCCESS shows "Saving…".

---

## useTaskComplete hook

```ts
const { complete, isPending, error } = useTaskComplete(caseDetail, task);

await complete('SUCCESS', { triage_category: '...', priority: 'normal', triage_route: 'resolution' }, 'Routed to Resolution');
```

Wraps the `task.complete` mutation. Takes `case_detail` + `task`, returns a `complete(outcome, facts, note?)` function. Forms own their own facts state and validation; the hook is just the mutation-fire shim.

Schema-level fact validation (TaskFacts<T>) happens in the concrete form components before they call `complete`. The hook accepts `Record<string, unknown>` because the BE accepts any record (the schema is `z.record(z.unknown())`).

---

## IntakeTriageForm — the anchor pattern

The first concrete form, modeling what P1.10 will build for the other 10 task types.

Fields (per `IntakeTriageFactsSchema` from P1.1):
- **Category** — `Select` populated from `category.list`, pre-filled from `case.recommended_category`
- **Priority** — `SegmentedControl` (low/normal/high), defaults to `'normal'`
- **Route** — `RouteGrid` (resolution / coding_partner / direct_appeal / other), no default — analyst must pick
- **Notes** — `Textarea`, optional; appended to `completion_note` since the schema doesn't carry notes in facts

Validation: SUCCESS button stays disabled until category + route are both set. NEEDS_INFO is available immediately (you can flag "I can't triage this" without filling everything).

### Schema alignment surprise

While building, I initially wrote route options as `'resolution' | 'coding_partner' | 'payer_call' | 'portal_check'`. The actual `IntakeTriageFactsSchema` in P1.1 had `'resolution' | 'coding_partner' | 'direct_appeal' | 'other'`. Caught immediately by `tsc --strict`. Realigned the form's route values + labels + descriptions to match.

Worth flagging because as we build the remaining 10 task forms in P1.10, this kind of drift is likely. The pattern: **let TypeScript catch it via the TaskFactsByType registry**, then update the form to match the schema (since the schema is the BE contract).

---

## CurrentTaskBlock — form router + fallback

```ts
const BUILT_FORMS: Partial<Record<TaskType, true>> = {
  intake_triage: true,
};
```

When a task type isn't in `BUILT_FORMS`, the component renders `GenericTaskFallback` — a simple "this form coming in P1.10" placeholder that still wires `task.complete` so Vivek can manually advance the workflow during integration testing.

### Adding a new form

When P1.10 builds, say, `CodingReviewForm`:

1. Create `src/components/task-form/CodingReviewForm.tsx` (mirroring `IntakeTriageForm.tsx`'s shape)
2. Add to `BUILT_FORMS`: `coding_review: true,`
3. Add the route case in `TaskFormForType`: `if (task.task_type === 'coding_review') return <CodingReviewForm ... />;`

3-line change per new form once the pattern is established.

---

## What can now be done end-to-end

With everything from P1.1 → P1.8 + the P1.3 mock-server:

1. Click Henderson card (proposed) → ProposedView with LLM rec
2. Click **Accept recommendation** → case transitions to accepted, intake_triage opens
3. WorkPane re-renders to InFlightView showing:
   - Workflow progress strip (step 1 ringed blue: "Intake triage")
   - Task header (Intake triage · eng_t_xxx · denial_intake chip · urgency)
   - **IntakeTriageForm** with category pre-filled, priority Normal, route empty
4. Pick a route → SUCCESS button enables
5. Click **Complete triage** → `task.complete` fires
6. Mock simulator advances; case-detail invalidates
7. WorkPane re-renders showing the NEXT task (resolution_action on resolution_primrose)
8. CurrentTaskBlock now renders **GenericTaskFallback** (resolution_action form isn't built yet)
9. Type a note + Mark complete → advances further
10. Eventually reaches `case_status='completed'` → CompletedView with full workflow checkmarks

**Henderson's full medical_necessity_resolution workflow walkable end-to-end now** — IntakeTriage with real form, the other 4 steps via Generic fallback. Same for Whitfield (coding_review_branch) and the other accepted cases in the seed.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

### SSR smoke (32 tests)

```
=== TaskFormShell primitives ===          5/5  passed
  · FormField wrapper / Label asterisk / Hint id / Error role=alert

=== SegmentedControl ===                  2/2  passed
  · radiogroup + aria-checked + disabled propagation

=== RouteGrid ===                         2/2  passed
  · 4 options with icons + descriptions
  · selected card has blue border + ring

=== Native form controls ===              3/3  passed
  · Textarea rows/placeholder
  · Input type attribute
  · Select options + placeholder

=== OutcomeActionBar ===                  6/6  passed
  · SUCCESS emerald + ml-auto
  · NEEDS_INFO shown/hidden by handler
  · FAIL_FATAL red destructive
  · SUCCESS disabled when canSubmitSuccess=false
  · Saving… label when isPending

=== IntakeTriageForm ===                  7/7  passed
  · heading + description
  · category pre-filled from LLM recommendation
  · priority defaults to Normal
  · route grid 4 options matching schema enum
  · notes optional
  · SUCCESS disabled until route picked
  · action bar shows Complete + Needs more info

=== CurrentTaskBlock routing ===          4/4  passed
  · intake_triage → IntakeTriageForm
  · other task types → GenericTaskFallback
  · GenericTaskFallback gates SUCCESS until note typed
  · task header shows id + queue chip + urgency

=== InFlightView (updated) ===            3/3  passed
  · renders workflow strip + CurrentTaskBlock
  · P1.7 placeholder is gone
  · NoOpenTasksView when engine_tasks_open=[]

32 passed · 0 failed
```

### What SSR can't cover (deferred to P1.13)

- Typing in form fields actually updates state
- SUCCESS button enables AFTER user picks a route
- Click SUCCESS → mutation fires → cache invalidates → next task appears
- Tab navigation through form fields
- Form submission via Enter key

These need jsdom + @testing-library/react + user-event. The components are designed for those tests — clear prop boundaries, controlled state, hooks for side effects.

---

## Integration steps

1. Drop all 5 new files into the paths above
2. Drop the updated `InFlightView.tsx` (overwrites P1.7's version)
3. No other components need changes — `WorkPane.tsx` from P1.7 already routes accepted/overridden status to `InFlightView`, and `InFlightView` now wires through to the real form
4. Run dev with `VITE_USE_MOCKS=true`
5. Accept Henderson → see real IntakeTriageForm → walk through workflow

---

## What's NOT in P1.8 (intentional cuts)

- **The other 10 task forms** — `CodingReviewForm`, `PayerCallForm`, `ResolutionActionForm`, `PortalStatusCheckForm`, `CodingFeedbackReviewForm`, `AwaitingPayerCheckForm`, `AMReviewForm`, `PostingApplyForm`, `BankRecMatchForm`, `HighDollarOversightForm` — these are P1.10 deliverables. GenericTaskFallback fills the gap.
- **Form state persistence** — if user navigates away and back, form values reset. Out of scope.
- **Autosave / drafts** — Out of scope; explicit submit required.
- **Inline validation as user types** — Form is gated on canSubmit; per-field as-you-type validation is a polish pass.
- **Confirm dialogs for destructive outcomes** — FAIL_FATAL should probably prompt "Are you sure?" before submitting. Hardly used in P1.8 yet (no form exposes it), but worth flagging.

---

## What comes next

Per the design contract §8, next is **P1.9 — small companion: wire the engine response (next_task) into the case.detail cache for instant transition** OR jump to **P1.10 — build out the remaining 10 task forms following the IntakeTriageForm pattern**.

P1.9 is a small optimization — when `task.complete` returns `{ case, next_task }`, set those into the React Query cache directly so the WorkPane re-renders without a roundtrip. Without it, we wait for the cache invalidation to refetch. Both work; the latter is slightly slower.

P1.10 is the bigger ask but the IntakeTriageForm pattern is established now — each form is ~150-200 lines. 10 forms × ~180 lines = ~1800 lines, doable in 1-2 sessions.

Two options:
- `"start P1.9"` — small response-wiring deliverable (~1 small session)
- `"start P1.10"` — start building the remaining 10 forms (1-2 sessions; bundle if you want all)

If P1.9 isn't critical (the cache invalidation works fine, just adds a brief loading flicker), skip straight to P1.10.

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `TaskFormShell.tsx` | `src/components/task-form/TaskFormShell.tsx` |
| `OutcomeActionBar.tsx` | `src/components/task-form/OutcomeActionBar.tsx` |
| `IntakeTriageForm.tsx` | `src/components/task-form/IntakeTriageForm.tsx` |
| `CurrentTaskBlock.tsx` | `src/components/task-form/CurrentTaskBlock.tsx` |
| `useTaskComplete.ts` | `src/hooks/useTaskComplete.ts` |
| `InFlightView.tsx` (updated) | `src/components/work-pane/InFlightView.tsx` |
| `sanity-check-v4-task-form.tsx` | `scripts/sanity-check-v4-task-form.tsx` |
| `README-P1.8.md` | reference only |
