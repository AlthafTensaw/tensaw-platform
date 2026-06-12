# FE v4.0.0 · P1.4 — TopNav rewrite (QueueSwitcher + needs_my_review badge)

**Phase:** P1.4 (first UI component deliverable of the v4 rewrite)
**Companion to:** `FE-v4.0.0-design-contract.md` §3 and mockup file `Denial-Analyst-Tool-Frontend-v4.0.0-nav-and-worklist-mockup.html` (mockups #1, #2)
**Status:** Code-complete; `tsc --strict` clean + 19/19 SSR smoke tests pass

---

## What's in this deliverable

Six React components + one hook + a runtime smoke test. Replaces the v3 TopNav wholesale.

| File | Lines | Drop-in path |
|---|---|---|
| `TopNav.tsx` | 55 | `src/components/nav/TopNav.tsx` |
| `QueueSwitcher.tsx` | 168 | `src/components/nav/QueueSwitcher.tsx` |
| `MyTasksLink.tsx` | 33 | `src/components/nav/MyTasksLink.tsx` |
| `NeedsMyReviewBadge.tsx` | 47 | `src/components/nav/NeedsMyReviewBadge.tsx` |
| `BrandLogo.tsx` | 17 | `src/components/nav/BrandLogo.tsx` |
| `UserMenuStub.tsx` | 26 | `src/components/nav/UserMenuStub.tsx` |
| `useQueueState.ts` | 56 | `src/hooks/useQueueState.ts` |
| `sanity-check-v4-topnav.tsx` | 220 | `scripts/sanity-check-v4-topnav.tsx` |

Total: ~620 lines added.

### `QueueSwitcher.tsx` — the main piece

The dropdown anchored on mockup #1. Trigger button shows the active queue label + chevron; click opens a popover listing all queues with their `pending_count` badges. Team queues at the top, personal queue below a divider, default queue marked with a subtle "default" tag, active queue highlighted with a darker background.

Behaviors:
- Reads + writes `?queue=<queue_id>` URL state via `useQueueState`
- Closes on outside click (mousedown listener with cleanup)
- Closes on Escape
- Disabled state while `queue.list` loads
- Truncates long queue names with `truncate` Tailwind class

Built without Radix UI to keep the dependency surface flat. If your team prefers `@radix-ui/react-dropdown-menu` for the keyboard nav primitives, easy swap.

### `NeedsMyReviewBadge.tsx` — the red bubble

Reads count from `queue.list` (the queue where `queue_type === 'personal'`, `pending_count`). Renders nothing when count is 0 — the badge only appears when there's actual work. Caps display at 99+. ARIA label includes singular/plural handling.

### `useQueueState.ts` — single source of truth

Returns `{ activeQueueId, setActiveQueueId, isLoading }`. Resolution order:
1. `?queue=<queue_id>` if present in URL
2. The `is_default_for_caller=true` queue from `queue.list` otherwise
3. `null` while `queue.list` is loading and URL has nothing

The WorklistPage (P1.6) consumes the same hook to drive its `case.worklist` query — guaranteeing the switcher and page stay synced via URL.

---

## Visual layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● Denial Analyst Tool   [Denial Intake — Primrose ▾]    [Cost]  My tasks ●3  V│
└──────────────────────────────────────────────────────────────────────────────┘
                            ↑                                       ↑       ↑
                            queue switcher                          badge   user
```

When QueueSwitcher is open:

```
[Denial Intake — Primrose ▾]
  ┌───────────────────────────────────────┐
  │ TEAM QUEUES                           │
  │ 👥 Denial Intake — Primrose default 6 │  ← active (darker bg)
  │ 👥 Coding partner — Primrose       1  │
  │ 👥 Resolution — Primrose           2  │
  │ 👥 AM Review — Primrose            0  │
  │ 👥 Posting — Primrose              0  │
  │ 👥 High-Dollar Desk — Primrose     2  │
  ├───────────────────────────────────────┤
  │ PERSONAL                              │
  │ 👤 My personal queue               3  │
  └───────────────────────────────────────┘
```

---

## Verification

### TypeScript strict compile

```
$ npx tsc --noEmit
(no output, exit 0)
```

All 7 component/hook files compile under `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. Zero errors.

### SSR smoke (19 tests)

```
=== BrandLogo / UserMenuStub ===          2/2  passed
  · wordmark renders with /​/ href
  · user initial + name appear

=== NeedsMyReviewBadge ===                6/6  passed
  · empty render when count=0 (no empty bubble)
  · displays count + bg-red-500 class
  · singular vs plural a11y label
  · caps at 99+ for large counts
  · reads from queue.list when no prop given
  · empty render when personal queue pending_count=0

=== MyTasksLink ===                       3/3  passed
  · href encodes /inbox?queue=user_42
  · embedded badge count=3
  · falls back to /inbox without personal queue

=== QueueSwitcher ===                     3/3  passed
  · trigger renders default queue label
  · "Loading queues" placeholder while query in flight
  · dropdown panel NOT rendered by default (aria-expanded=false)

=== TopNav (composed) ===                 5/5  passed
  · brand + switcher + tasks + user all present
  · Cost link hidden when canViewCost=false
  · Cost link visible when canViewCost=true (href=/cost)
  · sticky + bg-slate-900 + role=banner
  · badge appears inside the nav

19 passed · 0 failed
```

### What SSR smoke does NOT cover

renderToString doesn't run `useEffect` and resets `useState` per render, so:
- **Open-dropdown state** is not tested (the panel only renders when `isOpen=true`)
- **Click-outside-to-close** behavior isn't tested
- **Escape-to-close** isn't tested
- **Selection updates URL** isn't tested

Those need jsdom + `@testing-library/react`. Deferred to the formal test suite (P1.13). The components are structured to be trivially testable there — clear prop boundaries, no internal magic.

---

## Integration steps

1. Drop the 7 files into the locations above
2. In your app router, replace the v3 `<TopNav />` mount point with:
   ```tsx
   import { TopNav } from './components/nav/TopNav';
   // ...
   <TopNav
     userName={currentUser.displayName}
     canViewCost={permissions.has('denial.view_cost')}
   />
   ```
3. If you used a `useCurrentQueue` or similar hook in v3, swap it for `useQueueState`. The two are not interchangeable but the API is small (`{ activeQueueId, setActiveQueueId }`).
4. Remove v3's `<QueueLabel>` or static "Recommended denials" heading — it's gone in v4 (the QueueSwitcher trigger label replaces it).
5. Run dev server with `VITE_USE_MOCKS=true` (from P1.3) and verify:
   - Trigger shows "Denial Intake — Primrose" by default
   - Click opens dropdown with 7 queues
   - Picking a queue updates `?queue=...` in URL
   - Red badge shows "3" on My tasks (seed has 3 needs_my_review cases)

---

## A few notes on the design

### Why not use Radix DropdownMenu?

v3 uses Radix elsewhere but the QueueSwitcher styling (section dividers, custom queue-item layout with avatar + label + default tag + count badge) was easier to write directly than to override Radix's `DropdownMenuItem` defaults. Click-outside + Escape are handled with a 15-line `useEffect` instead. If your team prefers consistency with the rest of the Radix-based UI, swapping in `@radix-ui/react-dropdown-menu` is straightforward — the structure already maps to `Root`, `Trigger`, `Content`, `Item`.

### Why `UserMenuStub` instead of the real `UserMenu`?

The real UserMenu has sign-out, profile, theme toggle — none of which is touched by P1.4. The stub fills the layout slot; replace with the existing component in production. Imports stay clean (`./UserMenuStub` → `./UserMenu`).

### Why not a separate "queue list panel" subcomponent?

I considered splitting `QueueSwitcher` into `QueueSwitcherTrigger` + `QueueSwitcherPanel` for testability. Decided against — the trigger and panel share state (isOpen, refs) and splitting them would require prop-drilling without clear benefit. The `QueueListItem` IS its own subcomponent inside the file for repeated rendering.

### Permission gating delegated upward

`TopNav` takes `canViewCost` as a prop rather than reaching into an auth context directly. Two reasons:
1. Easier to test (no context mocking needed)
2. The app's auth context might use a different shape; not for the nav to know

The parent component that mounts `<TopNav />` consults auth state once and passes the boolean down.

---

## What comes next (P1.5)

Per the design contract §8, next is **CaseCard rewrite** — the 4-line card used in the worklist for the new `{case, current_task}` row shape. Anchored on mockup #3 (worklist default) and mockup #4 (needs_my_review with returned-by bars).

Key v3→v4 changes in CaseCard:
- Card is now keyed off `case_id` not `claim_id`
- Adds the queue routing chip (line 3) showing where the current task lives
- Adds the HD corner badge (amber/gold) for `is_high_dollar` cases
- Adds the "returned to you" bar at top for `coding_feedback_review` tasks on personal queue
- Removes Owner filter chip (deprecated in v4)
- Per-step `assignee_name` → `originated_by` reference

Both `task.mine` and `case.worklist` now return the right shape for this from the P1.3 mock; CaseCard is purely a rendering job.

Say "start P1.5" and I'll ship it.

---

## Files in this deliverable

| File | Drop-in location |
|---|---|
| `TopNav.tsx` | `src/components/nav/TopNav.tsx` |
| `QueueSwitcher.tsx` | `src/components/nav/QueueSwitcher.tsx` |
| `MyTasksLink.tsx` | `src/components/nav/MyTasksLink.tsx` |
| `NeedsMyReviewBadge.tsx` | `src/components/nav/NeedsMyReviewBadge.tsx` |
| `BrandLogo.tsx` | `src/components/nav/BrandLogo.tsx` |
| `UserMenuStub.tsx` | `src/components/nav/UserMenuStub.tsx` |
| `useQueueState.ts` | `src/hooks/useQueueState.ts` |
| `sanity-check-v4-topnav.tsx` | `scripts/sanity-check-v4-topnav.tsx` |
| `README-P1.4.md` | reference only |
