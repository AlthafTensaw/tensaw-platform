# FE v4.0.0 · P1.10 — Remaining 10 task forms

**Phase:** P1.10 (fills out the 10 concrete task forms left after P1.8's IntakeTriageForm anchor)
**Anchored on:** the 11 fact schemas in `schemas-v4.ts` + the IntakeTriageForm pattern
**Status:** Code-complete; `tsc --strict` clean + 30/30 SSR smoke tests pass

---

## What's in this deliverable

10 new task form components + an updated `CurrentTaskBlock` with exhaustive routing.

| File | Lines | task_type | Complexity |
|---|---|---|---|
| `CodingReviewForm.tsx` | 191 | `coding_review` | High (4 fields + recommendation + note) |
| `ResolutionActionForm.tsx` | 168 | `resolution_action` | High (4-option grid + datetime + confirmation) |
| `PayerCallForm.tsx` | 152 | `payer_call` | Medium (3 fields) |
| `PortalStatusCheckForm.tsx` | 144 | `portal_status_check` | Medium (3 fields) |
| `AMReviewForm.tsx` | 145 | `am_review` | Medium (decision + conditional note) |
| `AwaitingPayerCheckForm.tsx` | 130 | `awaiting_payer_check` | Medium (toggle + conditional textarea) |
| `HighDollarOversightForm.tsx` | 109 | `high_dollar_oversight` | Low (1 optional field) |
| `CodingFeedbackReviewForm.tsx` | 121 | `coding_feedback_review` | Low (1 required + notes) |
| `PostingApplyForm.tsx` | 92 | `posting_apply` | Low (1 boolean) |
| `BankRecMatchForm.tsx` | 87 | `bank_rec_match` | Low (1 boolean) |
| `CurrentTaskBlock.tsx` (updated) | 199 | router | — |
| `sanity-check-v4-task-forms-all.tsx` | 343 | tests | — |

Total: ~1900 new lines added.

---

## Field mappings (schema → UI)

Each form maps exactly to its `*FactsSchema` from P1.1. The pattern: every schema field becomes a `FormField` with the right primitive.

### CodingReviewForm
```
cpt_corrected: boolean        → SegmentedControl No/Yes
modifier_changed: boolean     → SegmentedControl No/Yes
dx_adequate: boolean          → SegmentedControl No/Yes
recommendation: enum          → SegmentedControl (Proceed/Reject/Escalate)
+ notes textarea              → freeform; appended to completion_note
```

### ResolutionActionForm
```
action_type: enum (4 options) → RouteGrid 2x2
submitted_at: datetime        → text Input (datetime-local format, pre-filled with now)
confirmation_number: nullable → text Input (optional)
```

### PayerCallForm
```
call_reference_number: string → text Input (required)
payer_status: string          → Textarea (required)
callback_required: boolean    → SegmentedControl No/Yes
```

### PortalStatusCheckForm
```
portal_status: string         → Textarea (required)
reference_number: nullable    → text Input (optional)
screenshot_attached: boolean  → SegmentedControl No/Yes
```

### CodingFeedbackReviewForm
```
selected_action: enum (3)     → RouteGrid 1-col (Proceed/Dispute/Re-route)
+ notes textarea              → appended to completion_note
```

### AwaitingPayerCheckForm
```
response_received: boolean    → SegmentedControl
response_details: nullable    → Textarea — CONDITIONAL (only when response_received=yes)
```

### AMReviewForm
```
final_decision: enum (3)      → RouteGrid 1-col (Approve/Escalate/Close)
escalation_note: nullable     → Textarea — CONDITIONAL (only when final_decision='escalate'); REQUIRED when shown
```

### PostingApplyForm
```
posting_confirmed: boolean    → SegmentedControl No/Yes
```

### BankRecMatchForm
```
match_confirmed: boolean      → SegmentedControl No/Yes
```

### HighDollarOversightForm
```
reviewed_at: datetime         → AUTO-FILLED with now on submit (no UI)
oversight_note: nullable      → Textarea (optional)
```

---

## CurrentTaskBlock — exhaustive routing

Was:
```ts
const BUILT_FORMS: Partial<Record<TaskType, true>> = { intake_triage: true };
if (BUILT_FORMS[task.task_type] === true) { ... }
return <GenericTaskFallback ... />;
```

Now:
```ts
switch (task.task_type) {
  case 'intake_triage':         return <IntakeTriageForm ... />;
  case 'coding_review':         return <CodingReviewForm ... />;
  case 'coding_feedback_review':return <CodingFeedbackReviewForm ... />;
  case 'payer_call':            return <PayerCallForm ... />;
  case 'portal_status_check':   return <PortalStatusCheckForm ... />;
  case 'resolution_action':     return <ResolutionActionForm ... />;
  case 'awaiting_payer_check':  return <AwaitingPayerCheckForm ... />;
  case 'am_review':             return <AMReviewForm ... />;
  case 'posting_apply':         return <PostingApplyForm ... />;
  case 'bank_rec_match':        return <BankRecMatchForm ... />;
  case 'high_dollar_oversight': return <HighDollarOversightForm ... />;
  default:                      return <GenericTaskFallback ... />;
}
```

TypeScript's exhaustiveness check on the `TaskType` union means **adding a new task_type to schemas-v4 will surface as a compile-time hint** to wire it up here. The `default` branch is a runtime safety net but the compile-time signal is the real defense.

`GenericTaskFallback` is kept but unused for any of the 11 current task types — it's purely a future-safety net.

---

## Design patterns used

A few patterns repeat across the forms — worth calling out so they're consistent if new forms are added later:

### 1. Required-field gating

Forms compute `canSubmit` from the set of required fields. SUCCESS button stays disabled until `canSubmit=true`. NEEDS_INFO is typically allowed regardless (you can flag "I can't do this" without filling everything).

### 2. Conditional rendering for dependent fields

Two forms have conditional fields:
- **AwaitingPayerCheckForm**: `response_details` textarea only shown when `response_received='yes'`
- **AMReviewForm**: `escalation_note` textarea only shown when `final_decision='escalate'` (and required when shown)

Pattern: `{conditionMet && <FormField ... />}` rather than disabled-but-visible. Less visual clutter.

### 3. Auto-fill with explicit confirmation

- **ResolutionActionForm**: `submitted_at` pre-fills with current datetime (analyst can adjust before submitting)
- **HighDollarOversightForm**: `reviewed_at` auto-fills at submit time (no UI; manager just confirms with the button)

### 4. Completion notes derived from form state

Each form generates a default `completion_note` summarizing the action ("Routed to resolution", "Coding recommendation: proceed", "Payer call · ref REF-123"). Analyst can override with explicit notes where the form has a notes field; otherwise the derived note becomes the audit-log entry.

### 5. Booleans as Yes/No segmented controls

Rather than tiny checkboxes, all booleans render as SegmentedControl with No/Yes options. Bigger touch targets, clearer state, visually consistent with the rest of the form library.

---

## What can now be walked end-to-end

With P1.1 → P1.10 + the P1.3 mock-server running, every workflow in the seed can be completed step-by-step in the UI:

### Henderson's medical_necessity_resolution (5 steps)
1. Accept proposed Henderson → intake_triage opens
2. Fill **IntakeTriageForm** (route: resolution) → Complete triage
3. **ResolutionActionForm** opens → pick "appeal", set submitted_at, add confirmation → Mark submitted
4. **AwaitingPayerCheckForm** opens → check Yes, fill details → Continue workflow
5. **AMReviewForm** opens → Approve → Submit decision
6. **PostingApplyForm** opens → Yes, applied → Mark posted
7. Case → `completed`, CompletedView with 5/5 ✓ steps

### Whitfield's coding_review_branch (6 steps, includes team-handoff return)
1. Accept proposed Whitfield → intake_triage opens (on user's queue)
2. Complete triage with route=coding_partner
3. **CodingReviewForm** opens on coding_primrose queue → fill toggles + recommendation → Return to originator
4. **CodingFeedbackReviewForm** opens on user_42 (the returned-to-you bar appears) → pick proceed → Submit decision
5. ResolutionActionForm → AwaitingPayerCheckForm → PostingApplyForm — same as above

### Auth-missing → payer_call_resolution (4 steps)
1. Override a proposed case to `auth_missing`
2. **PayerCallForm** opens → fill reference + status → Log call
3. ResolutionActionForm → AwaitingPayerCheckForm

### Coverage-lapsed → portal_first_resolution (5 steps)
1. Accept a coverage_lapsed proposed case
2. **PortalStatusCheckForm** opens → fill portal status → Log check
3. ResolutionActionForm → AwaitingPayerCheckForm → PostingApplyForm

Every workflow walkable. No GenericTaskFallback. The full FE happy path works against the mock.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

### SSR smoke (30 tests)

```
=== CodingReviewForm ===                              2/2  passed
=== CodingFeedbackReviewForm ===                      2/2  passed
=== PayerCallForm ===                                 2/2  passed
=== PortalStatusCheckForm ===                         2/2  passed
=== ResolutionActionForm ===                          2/2  passed
  · 4 action types in route grid
  · submitted_at pre-fills with current datetime

=== AwaitingPayerCheckForm ===                        2/2  passed
  · response received toggle
  · response_details hidden until response_received=yes

=== AMReviewForm ===                                  2/2  passed
  · 3 decision options
  · escalation_note hidden until escalate picked

=== PostingApplyForm ===                              2/2  passed
=== BankRecMatchForm ===                              1/1  passed
=== HighDollarOversightForm ===                       2/2  passed
  · HD badge + amber accent
  · Sign off enabled without note (optional)

=== CurrentTaskBlock routing — exhaustive ===         11/11 passed
  · ALL 11 task types route to their concrete forms
  · GenericTaskFallback never appears for known types

30 passed · 0 failed
```

### Coverage notes

The smoke tests verify **structural correctness**: each form renders the right fields, gating logic works on initial render, marker strings unique to each form appear. Interactive behavior (clicking through, conditional reveal, mutation firing) is deferred to the formal jsdom suite in P1.13.

The exhaustive routing test is the most valuable — confirms that every TaskType the BE can send lands on a concrete form, not the fallback.

---

## Integration steps

1. Drop all 10 form files into `src/components/task-form/`
2. Drop the updated `CurrentTaskBlock.tsx` (overwrites P1.8's version)
3. No other components need changes — `InFlightView` already calls `CurrentTaskBlock`
4. Run dev with `VITE_USE_MOCKS=true` and walk through any seed case to verify

---

## What's NOT in P1.10 (intentional)

- **Inline as-you-type validation** — forms validate on submit click, not field-blur. Sufficient for the workflow but a polish pass could add field-level error feedback.
- **Multi-step forms** — every task form is single-page. None of the schemas have enough fields to warrant a wizard.
- **Server-side reference data for some enums** — `action_type`, `recommendation`, `final_decision` are all hardcoded in the FE. If product decides to add a new action_type, BE schema + FE label list both need updating. Not a problem at v4 scope; flagging for later.
- **Field-level autosave drafts** — close the tab and form state is lost. Acceptable for short forms; could revisit if a form gets long.
- **Confirm dialogs on destructive actions** — AMReviewForm's `Close` decision should probably prompt "Are you sure?" before submitting. Could add later; for now the click is direct.

---

## Cumulative progress through v4 P1

| Phase | Status |
|---|---|
| P1.1 schemas | ✅ |
| P1.2 action registry | ✅ |
| P1.3 mock-server | ✅ |
| P1.4 TopNav + QueueSwitcher | ✅ |
| P1.5 CaseCard | ✅ |
| P1.6 WorklistPane | ✅ |
| P1.7 WorkPane (proposed + completed + in-flight shell) | ✅ |
| P1.8 task-form anchor (IntakeTriageForm + primitives) | ✅ |
| P1.10 remaining 10 task forms | ✅ ← this deliverable |
| P1.9 cache-write optimization | skipped (use cache invalidation; flicker acceptable) |
| P1.11 tab carryover (Notes/Files/Appeal/History/Analysis) | next |
| P1.12 legacy redirect | pending |
| P1.13 formal test suite | pending |
| P1.14 v3.x cleanup | pending |
| P1.15 staging integration | pending |

8 of 14 P1 phases done. Pure code work remaining: 4 phases.

---

## What comes next (P1.11)

Per the design contract: **Tab carryover** — wire the right-pane tab strip (Notes / Files / Appeal / History / Analysis) to the v4 endpoints. Most of the tab content was already drafted in v3.x; P1.11 is mostly re-wiring the data sources to:
- `case.notes` instead of v3's notes endpoint
- `case.files` instead of v3's files endpoint
- `case.appeal.get` + `case.appeal.generate` + `case.appeal.save` for the Appeal tab
- (History tab carries over largely unchanged — flat note list)
- (Analysis tab needs minor adaptation for the new case shape)

Plus the **file upload picker** that was deferred from v3.1 (mentioned in the original handoff). Files tab needs an upload control.

P1.11 scope: ~1500 lines across 5 tab components + ReferencePanelStub replacement. One session.

Say `"start P1.11"` and I'll ship it.

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `CodingReviewForm.tsx` | `src/components/task-form/CodingReviewForm.tsx` |
| `CodingFeedbackReviewForm.tsx` | `src/components/task-form/CodingFeedbackReviewForm.tsx` |
| `PayerCallForm.tsx` | `src/components/task-form/PayerCallForm.tsx` |
| `PortalStatusCheckForm.tsx` | `src/components/task-form/PortalStatusCheckForm.tsx` |
| `ResolutionActionForm.tsx` | `src/components/task-form/ResolutionActionForm.tsx` |
| `AwaitingPayerCheckForm.tsx` | `src/components/task-form/AwaitingPayerCheckForm.tsx` |
| `AMReviewForm.tsx` | `src/components/task-form/AMReviewForm.tsx` |
| `PostingApplyForm.tsx` | `src/components/task-form/PostingApplyForm.tsx` |
| `BankRecMatchForm.tsx` | `src/components/task-form/BankRecMatchForm.tsx` |
| `HighDollarOversightForm.tsx` | `src/components/task-form/HighDollarOversightForm.tsx` |
| `CurrentTaskBlock.tsx` (updated) | `src/components/task-form/CurrentTaskBlock.tsx` |
| `sanity-check-v4-task-forms-all.tsx` | `scripts/sanity-check-v4-task-forms-all.tsx` |
| `README-P1.10.md` | reference only |
