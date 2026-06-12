# FE v4.0.0 · P1.5 — CaseCard rewrite

**Phase:** P1.5 (worklist card for the new `{case, current_task}` row shape)
**Anchored on:** mockups #3 (worklist default) + #4 (needs_my_review returned-by bars)
**Status:** Code-complete; `tsc --strict` clean + 47/47 SSR smoke tests pass

---

## What's in this deliverable

5 source files + 1 smoke test. Sets up the formatter/label primitives that the rest of P1 will reuse.

| File | Lines | Drop-in path |
|---|---|---|
| `CaseCard.tsx` | 284 | `src/components/cards/CaseCard.tsx` |
| `QueueRoutingChip.tsx` | 32 | `src/components/cards/QueueRoutingChip.tsx` |
| `formatters.ts` | 91 | `src/utils/formatters.ts` |
| `labels.ts` | 170 | `src/lib/labels.ts` |
| `sanity-check-v4-case-card.tsx` | 420 | `scripts/sanity-check-v4-case-card.tsx` |

Total: ~1000 lines added.

---

## Card structure

```
┌──────────────────────────────────────────────────────────────┐
│ ← Returned to you for review · 06/10/26                      │  (returned bar, conditional)
├──────────────────────────────────────────────────────────────┤
│ Patient, Name   72834                              $1,354    │  L1
│ 02/24/26 · LSAT · Humana GP · 90-119d                        │  L2
│ ● Coding review — verify CPT + dx              [coding]      │  L3
│ [Accepted] [RK Renita K.] [HD] [Overdue 8d]                  │  L4
└──────────────────────────────────────────────────────────────┘
```

- **L1** — patient name (bold) + MRN (muted) | net pending dollar amount (right)
- **L2** — DOS · clinic alias · payer alias · aging bucket — dot-separated, with aging color-tinted by recency (180d+ red)
- **L3** — category cat-dot (color from `lib/labels`) + task hint text + queue routing chip
- **L4** — state pill + originator avatar/name + HD badge (conditional) + urgency chip

The whole card is a Link to `/inbox?queue=<current>&case=<case_id>`. Selected state (matching `?case=` in URL) gets a blue border + ring.

### State-aware rendering

| case_status | L3 task hint | L4 originator | L4 urgency |
|---|---|---|---|
| `proposed` | "Intake triage — confirm category" | "Unassigned" + em-dash avatar | from `classified_at` |
| `accepted` | `taskHint(current_task.task_type)` | initials + name | from `current_task.due_at` |
| `overridden` | `taskHint(current_task.task_type)` | initials + name | from `current_task.due_at` |
| `completed` | last task hint | initials + name | (usually null) |

The HD badge appears on L4 whenever `is_high_dollar === true`, regardless of state.

### Returned-to-you bar

Appears at top of card when:
- `current_task !== null`
- `current_task.task_type === 'coding_feedback_review'`
- `current_task.queue_id` starts with `user_` (personal queue)

This matches mockup #4. Other tasks of type `coding_feedback_review` on team queues do NOT show the bar (defensive — the bar is specifically about routing-back-to-originator pattern).

---

## Reusable primitives in this deliverable

These will be consumed by P1.6+ components.

### `src/utils/formatters.ts`

- `formatCurrency(amount)` — whole dollars without decimals, fractional with
- `formatDateShort(iso)` — YYYY-MM-DD → MM/DD/YY
- `formatConfidence(decimal)` — 0.92 → "92%"
- `deriveUrgency(dueIso, now?)` — returns `{ label, tone } | null` for the urgency chip
- `initialsForName(name)` — "Renita K." → "RK"

### `src/lib/labels.ts`

Single source of truth for taxonomy labels + colors:

- `taskTypeLabel(t)` / `taskHint(t)` — short label vs descriptive hint for the 11 task types
- `queueChipLabel(qid)` — short label for the routing chip; `user_*` → "personal"
- `categoryColor(c)` / `categoryLabel(c)` — cat-dot colors + display names for 9 denial categories
- `statePillStyle(s)` — `{ label, bgClass, textClass }` for each `case_status`
- `priorityLabel(p)` — low/normal/high display strings
- `agingBucketTone(b)` — `'normal' | 'warning' | 'severe'` for color-tinting the aging label

Any future component needing a queue chip, state pill, task hint, etc. pulls from these. One place to update if a label changes.

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

### SSR smoke (47 tests)

```
=== Formatters ===                            8/8  passed
  · currency (whole + fractional)
  · date (compact + full ISO input)
  · confidence rounding
  · initials (multi-word, single-word, empty fallback)

=== Urgency derivation ===                    5/5  passed
  · overdue, today, due-in-3d, beyond-7d (null), null due_at (null)

=== Labels ===                                8/8  passed
  · task hints, queue chip aliases, category colors,
    state pill styles, aging tones

=== QueueRoutingChip ===                      3/3  passed
  · team queue (gray), personal queue (orange), title= full queue_id

=== CaseCard — proposed state ===             7/7  passed
  · all card fields render
  · "Proposed" pill (blue)
  · generic intake triage hint on L3
  · "Unassigned" originator
  · link to /inbox?case=...
  · HD badge hidden
  · QueueRoutingChip hidden (no current_task)

=== CaseCard — accepted state (Whitfield HD overdue) ===  7/7  passed
  · "Accepted" pill (emerald)
  · HD badge present (amber)
  · "RK" initials avatar + "Renita K."
  · "Overdue 8d" urgency in red
  · "coding" queue chip with title= full id
  · "Coding review — verify CPT + dx" hint
  · 180d+ aging in severe red tone

=== CaseCard — returned-to-you (needs_my_review) ===  4/4  passed
  · ReturnedToYouBar at top with red gradient
  · "personal" queue chip in orange
  · non-returned tasks DON'T show the bar
  · "Coding partner completed review" hint

=== CaseCard — completed state ===            1/1  passed
=== CaseCard — overridden state ===           1/1  passed

=== CaseCard — edge cases ===                 3/3  passed
  · null patient_name → "Unknown patient"
  · null aging_bucket → em-dash
  · a11y label includes patient + amount + status

47 passed · 0 failed
```

### What's NOT covered by SSR (deferred to P1.13)

- Click navigation actually happens (Link interactivity)
- `useSearchParams` updates the URL when the parent re-renders
- Focus-ring on keyboard nav
- Hover state visual

These need jsdom + `@testing-library/react` + user-event. The components are structured for those tests — clear prop boundaries, no internal effects beyond the link.

---

## Integration steps

1. Drop the 5 files into the paths above
2. Anywhere the v3 worklist rendered a `<DenialCard />` (or whatever it was called), replace with:
   ```tsx
   import { CaseCard } from './components/cards/CaseCard';

   {rows.map((row) => (
     <CaseCard key={row.case.case_id} row={row} />
   ))}
   ```
3. The `WorklistPage` rewrite (P1.6) will be the actual consumer; for now CaseCard works in any list context that has `WorklistRow[]`
4. Verify against the mock-server (P1.3):
   - Click `?queue=user_42` in the URL → see 3 returned-bar cards
   - Click `?queue=coding_primrose` → see 1 card with `coding` chip + HD badge + overdue
   - Click `?queue=denial_intake_analyst_primrose` → see 6 proposed cards with blue pills

---

## One contract-adjacent decision

**ReturnedToYouBar shows generic text + return date.** The mockup #4 has richer text like "Returned by **Coding (Bhavana M.)** · 06/10/26". That requires the BE to expand `WorklistRow` with previous-task completion data (who completed it, when, what their outcome was). My v4 schema doesn't have that field yet.

For P1.5, the bar shows "Returned to you for review · {opened_at}". This works for now — the analyst sees they were routed something to review. Once the BE adds (or doesn't) the previous-task fields, this is a 2-line change in CaseCard.

The alternative would have been to extend the schema speculatively — but I'd rather not commit FE to a shape the BE hasn't confirmed. Flag it as a follow-up; the contract change can come from a BE session.

---

## What comes next (P1.6)

Per the design contract §8: **WorklistPage rewrite** — wires CaseCard to the actual `case.worklist` query, handles URL params, pagination, filter chips, empty state. This is the first page-level component for v4 and uses every primitive we've shipped so far.

Concretely, P1.6 includes:
- `WorklistPage.tsx` — the left pane of the 3-pane shell
- `WorklistFilters.tsx` — the dynamic filter row (clinic, payer, category, aging, priority)
- `WorklistEmptyState.tsx` — what shows when there are no cases (per mockup #7)
- Pagination handling (page param in URL, load-more button)
- Loading state (skeleton cards)
- Error state (toast or inline)

Say `"start P1.6"` and I'll ship it.

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `CaseCard.tsx` | `src/components/cards/CaseCard.tsx` |
| `QueueRoutingChip.tsx` | `src/components/cards/QueueRoutingChip.tsx` |
| `formatters.ts` | `src/utils/formatters.ts` |
| `labels.ts` | `src/lib/labels.ts` |
| `sanity-check-v4-case-card.tsx` | `scripts/sanity-check-v4-case-card.tsx` |
| `README-P1.5.md` | reference only |
