# FE v4.0.0 · P1.15 — Staging integration validation

**Phase:** P1.15 (final phase before production ship)
**Owner:** Vivek (execution); Vineeth-Second (triage + go/no-go decision)
**Estimated time:** 4-5 focused hours across phases 1-5; ~15 min for sign-off

---

## What's in this kit

| File | Purpose |
|---|---|
| `README-P1.15.md` | This document — test plan, triage protocol, go/no-go matrix, post-go-live checklist |
| `P1.15-status-template.md` | Fillable template — Vivek runs through, fills in ✓/✗/⚠ + notes |

The status template is the runnable artifact. This readme is the context + protocol around it.

---

## Pre-conditions (must be true before starting)

- [ ] v4.0.0 FE build is deployed to staging at the expected URL
- [ ] `denial-management-service v1.1.0` BE is deployed and stable on staging — confirmed by health probes (`/healthz` + `/readyz` returning 200)
- [ ] `primrose-lookups-service v1.0.0` is deployed and reachable from DMS
- [ ] Real test data exists in staging — at minimum 10 cases across the 4 case statuses (proposed / accepted / overridden / completed)
- [ ] Vivek has staging JWT credentials with both ANALYST and (optionally) MANAGER role bindings
- [ ] At least one HD test case (≥$750 net_pending) exists in staging
- [ ] At least one case with `originated_by_user_id` set (to test the returned-to-you bar)
- [ ] P1.14 v3 cleanup PR has merged — staging build no longer has v3 code paths active
- [ ] Browser dev tools / Network tab familiarity — Vivek will reference network requests during validation

If any of these is unchecked, hold the run.

---

## The 6-phase test plan

Phase order matters — each phase depends on the previous one passing. Don't skip ahead if Phase 1 fails; the test isn't meaningful with broken plumbing underneath.

---

### Phase 1 · Connectivity smoke (15 min)

**Goal:** Confirm the FE is talking to the real BE, not a leftover mock service worker.

| # | Step | Expected |
|---|---|---|
| 1.1 | Open staging URL in a fresh incognito window | Login page renders |
| 1.2 | Open dev tools → Network tab; check "Disable cache" | — |
| 1.3 | Log in with staging credentials | Lands on `/inbox` |
| 1.4 | Inspect Network tab: filter for `api/v1/` requests | Requests go to **staging BE host**, not `/__mock_*` |
| 1.5 | Look for `/healthz` or `/readyz` in network — or query manually | 200 response from BE |
| 1.6 | Check console for errors | No red errors; mocking-related logs absent |
| 1.7 | Look for the LegacyRedirect log when navigating to `/denials` | URL redirects to `/inbox`; console shows `[LegacyRedirect] /denials → /inbox` |

**Gate:** All 7 green → proceed to Phase 2. Any red → stop, file P0, coordinate with orchestrator before continuing.

---

### Phase 2 · Read-path validation (45 min)

**Goal:** Confirm every read endpoint returns sane data and renders correctly.

| # | Step | Expected |
|---|---|---|
| 2.1 | Default queue loads on `/inbox` | Real cases visible (not Henderson/Whitfield seed names) |
| 2.2 | Click queue switcher → see actual queues for this user | Default queue marked; pending counts realistic |
| 2.3 | Switch to a different queue | Case list changes; URL updates `?queue=` |
| 2.4 | Apply Category filter | Results narrow; URL updates `?category=` |
| 2.5 | Apply Clinic filter then Payer filter (cascade) | Payer chip enables only after Clinic picked |
| 2.6 | Page through (Next) if list is long enough | Results change; URL updates `?page=` |
| 2.7 | Click "Clear filters" | All filter params drop from URL; cases reload |
| 2.8 | Click a proposed case | Middle pane renders ProposedView |
| 2.9 | Verify LLM recommendation block shows real category + confidence + reasoning | No "TBD" or placeholder text; confidence is plausible (>0.5 typical) |
| 2.10 | Switch to Analysis tab | Real reasoning + tool_version visible |
| 2.11 | Switch to Payments tab | Real transactions render with CARC/RARC codes; payer source labels (1°/2°/Patient) correct |
| 2.12 | Switch to Notes tab | Existing system + classifier notes visible; analyst notes (if any) styled differently |
| 2.13 | Switch to Files tab | Existing files render with file_type grouping + size + uploader |
| 2.14 | Switch to Appeal tab | "Generate appeal" view shows (assuming no draft exists for this case) |
| 2.15 | Click an accepted/in-flight case | Middle pane renders InFlightView; workflow strip positioned at right step |
| 2.16 | Click a completed case | Middle pane renders CompletedView with full ✓ workflow |
| 2.17 | Browser back/forward — verify URL state restores correctly | Tab + case + queue persist; refresh re-loads state |

**Gate:** ≥15 green → proceed. Any rendering blanks, undefined values, or schema mismatches → file P1 with screenshot + the failing endpoint's request/response.

---

### Phase 3 · Write-path validation, happy paths (90 min)

**Goal:** Walk all 4 seeded workflows end-to-end against real BE.

#### 3.A · medical_necessity_resolution (5 steps)
| # | Step | Expected |
|---|---|---|
| 3.A.1 | Pick a proposed case with category=medical_necessity | ProposedView |
| 3.A.2 | Click Accept recommendation | Pane re-renders to InFlightView; intake_triage opens; URL ?case= persists |
| 3.A.3 | Fill IntakeTriageForm: priority=Normal, route=resolution; Complete triage | Engine advances to resolution_action; ResolutionActionForm appears |
| 3.A.4 | Fill ResolutionActionForm: action_type=appeal, submitted_at=now, confirmation=A-...; Mark submitted | Workflow advances to awaiting_payer_check |
| 3.A.5 | AwaitingPayerCheckForm: response_received=Yes, fill details; Continue workflow | Advances to AMReviewForm |
| 3.A.6 | AMReviewForm: final_decision=approve; Submit decision | Advances to PostingApplyForm |
| 3.A.7 | PostingApplyForm: posting_confirmed=Yes; Mark posted | Case → completed; CompletedView renders |
| 3.A.8 | Verify Notes tab shows system+classifier notes for each transition | All 5 steps logged |

#### 3.B · coding_review_branch (6 steps incl. team-handoff return)
| # | Step | Expected |
|---|---|---|
| 3.B.1 | Pick a proposed case where the LLM's category routes through coding | ProposedView |
| 3.B.2 | Accept → fill IntakeTriageForm: route=coding_partner; Complete | Engine spawns coding_review task on the coding queue |
| 3.B.3 | Switch to the coding queue (or impersonate a coding user) | Case appears as needs_review |
| 3.B.4 | Fill CodingReviewForm: 3 toggles + recommendation=proceed + notes; Return to originator | Task closes; case moves to originator's personal queue |
| 3.B.5 | Switch back to originator's personal queue (user_\<id\>) | Case appears with **returned-to-you bar** at top of CaseCard |
| 3.B.6 | Click case → fill CodingFeedbackReviewForm: selected_action=proceed; Submit decision | Advances to resolution_action |
| 3.B.7 | Walk through ResolutionAction → Awaiting → Posting same as 3.A | Reaches completed |

#### 3.C · payer_call_resolution (4 steps via override)
| # | Step | Expected |
|---|---|---|
| 3.C.1 | Pick a proposed case where LLM picked something other than auth_missing | ProposedView |
| 3.C.2 | Click Override → pick "Auth Missing" + add reasoning; Submit override | Pane re-renders; payer_call task spawned |
| 3.C.3 | Fill PayerCallForm: reference, status, callback toggle; Log call | Advances to ResolutionAction |
| 3.C.4 | Continue through resolution → awaiting | Reaches completed (or awaiting state if no response yet) |

#### 3.D · portal_first_resolution (5 steps)
| # | Step | Expected |
|---|---|---|
| 3.D.1 | Override a case to a category that triggers portal-first | PortalStatusCheckForm appears |
| 3.D.2 | Fill PortalStatusCheckForm: status, optional ref, screenshot toggle; Log check | Advances to ResolutionAction |
| 3.D.3 | Continue workflow to completion | Reaches completed |

**Gate:** All 4 workflows complete with no engine errors → proceed. Any task.complete returning unexpected `next_task` (or 4xx) → file P0/P1 depending on whether it's reproducible.

**Special attention:** the team-handoff in 3.B is the most-novel piece — `originated_by_user_id` flows through `user_<id>` placeholder in the workflow definition. If the returned-to-you bar doesn't appear in 3.B.5, that's a high-priority finding.

---

### Phase 4 · Edge cases + error states (45 min)

| # | Step | Expected |
|---|---|---|
| 4.1 | Find an HD case (net_pending ≥ $750) | HD badge visible on CaseCard + WorkPaneHeader; amber accent |
| 4.2 | Accept HD case → HighDollarOversight sidecar task spawns | Task appears on manager queue |
| 4.3 | Fill HighDollarOversightForm; Sign off | Sidecar closes; main workflow unaffected |
| 4.4 | Find or create a case with multiple ICD codes | All codes render in WorkPaneHeader |
| 4.5 | Add a note via NotesTab → mutation fires, note appears | Optimistic OR after re-fetch (acceptable either way) |
| 4.6 | Upload a file via FilesTab (PDF, ~100KB) | File appears in list after upload; uploader name = current user |
| 4.7 | Generate an appeal via AppealTab | Wait 10-30s; draft renders; status pill = "Draft" |
| 4.8 | Edit the appeal body; click Save draft | Saves; "Saved" indicator briefly |
| 4.9 | Click Finalize | Status moves to "Finalized"; textarea read-only |
| 4.10 | Click Mark submitted | Status moves to "Submitted"; read-only footer message |
| 4.11 | **Network failure simulation**: disable network briefly, retry an action | Error state renders; Retry button visible; network re-enabled → succeeds |
| 4.12 | Submit a task with intentionally invalid data (if you can force it) | Inline error shown; no crash |
| 4.13 | Submit task while another tab has the same case open (concurrency) | One submission succeeds, other fails with engine error; UI handles gracefully |
| 4.14 | Refresh the page mid-workflow | URL state restores; case detail re-renders correctly |
| 4.15 | Try to override an already-accepted case (if possible) | UI prevents OR BE rejects cleanly with visible error |

**Gate:** All critical interactions work; degraded states render reasonably → proceed.

---

### Phase 5 · Performance + cross-checks (30 min)

| # | Step | Expected |
|---|---|---|
| 5.1 | Time worklist load: cold cache | < 2s for first page |
| 5.2 | Time worklist load: warm cache | < 500ms |
| 5.3 | Time case detail load (clicking a card) | < 1s |
| 5.4 | Time task.complete round-trip | < 1.5s typical, up to 5s acceptable if engine work is heavy |
| 5.5 | Appeal.generate timing | 10-30s expected (LLM call); OpenAI primary, Gemini fallback |
| 5.6 | Tab switching latency (warm cache) | Instant — data prefetched by ReferencePanel |
| 5.7 | Lighthouse score on /inbox | Aim for ≥90 perf, ≥95 a11y |
| 5.8 | Console errors during a full workflow walk | Zero; warnings acceptable if non-React |
| 5.9 | Network tab — verify no duplicate requests | case.detail fired once per case open, not multiple times |

**Multi-user scenario (if time permits):**
| 5.10 | Two analysts on different queues simultaneously | Each sees their own filtered view; no cross-contamination |
| 5.11 | Originator + coding partner handoff in 3.B with two real users | Returned-to-you bar shows correct originator name |

**Gate:** No performance regressions vs the v3 baseline → proceed.

---

### Phase 6 · Sign-off (15 min)

Review the filled-in status template. Apply the go/no-go matrix below. If GO → coordinate production deploy with the orchestrator. If NO-GO → escalate the blockers, plan re-test.

---

## Triage protocol — when something fails

### Severity ladder

| Sev | Definition | Examples | Routing | Time to fix |
|---|---|---|---|---|
| **P0** | Ship-blocker. v4 cannot go to prod. | FE crashes on load; mutations corrupt data; auth broken; LegacyRedirect doesn't work | Immediate escalation to orchestrator session | Same-day or block release |
| **P1** | Must-fix-before-prod. Workflow degradation but not a crash. | A task form doesn't submit; tab content doesn't load; cache invalidation stale; HD badge missing | Orchestrator → assigned to FE (Vipin) or BE session | Within 1-2 days |
| **P2** | Post-prod acceptable. Cosmetic or minor UX. | Spacing issue; tooltip text wrong; non-critical loading spinner missing | Logged in tracker, batched for next iteration | Within 1-2 weeks |
| **P3** | Won't fix at v4.0.0. Nice-to-have. | Drag-drop upload; rich-text appeal editor; PDF preview | Backlog for v4.1+ | Whenever |

### Routing matrix — who owns the fix

| Symptom | Likely owner | Notes |
|---|---|---|
| Component renders wrong / missing data | FE (Vipin) | Verify the response shape matches what the component expects |
| Response shape doesn't match schema | BE session | Schema is BE's source of truth; FE adapts if BE confirms shape is correct |
| Engine workflow doesn't advance | BE session | Mock simulator passed P1.3; staging engine should match |
| Auth/JWT/tenant-scope issue | BE session | Tensaw-base territory |
| LegacyRedirect doesn't fire | FE (Vipin) | Router config |
| Appeal generation times out | BE session | OpenAI gateway / Gemini fallback config |
| Lookups (clinics/providers/payers) wrong | `primrose-lookups-service` session | Different service from DMS |
| Cache stale after mutation | FE (Vipin) | INVALIDATE matrix in `actions/index-v4.ts` |
| File upload fails | FE (Vipin) + possibly BE | Multipart transport is the FE's wiring piece per P1.11 |

### Issue capture template

When filing an issue, include:

```markdown
**Severity:** P0 / P1 / P2 / P3

**Phase / Step:** e.g. Phase 3.B.5

**Summary:** One-line description.

**Reproduce:**
1. Step 1
2. Step 2

**Expected:** What should happen

**Actual:** What happened

**Network trace:**
- Request: METHOD /api/v1/path
- Response status: NNN
- Response body (key fields, redact PHI if sharing publicly):
  ```json
  { ... }
  ```

**Browser console:** Any errors / warnings (paste verbatim, redact tokens)

**Environment:**
- Build SHA: <git sha>
- BE version: <denial-management-service version>
- User role: ANALYST / MANAGER
- Browser: Chrome 124.x / Safari 17.x / etc.

**Suspected owner:** FE (Vipin) / BE session / orchestrator coordination
```

### PHI redaction reminder

Cleartext PHI display is intentional in this internal tool, but when sharing screenshots / response bodies **outside the immediate engineering huddle** (in tickets, PRs, slack channels), redact:
- Patient name → "Patient, X"
- MRN → "MRN-redacted"
- DOB / DOS where they reveal identity in combination with other fields

Inside the engineering huddle (orchestrator session, Vipin, Vivek, BE owner), unredacted is fine for diagnosis. Use judgment.

---

## Go / no-go decision matrix

For each row, check the box. Production ship requires **all rows green**.

| # | Criterion | Green |
|---|---|---|
| 1 | All 6 phases of the test plan completed | ☐ |
| 2 | Zero open P0 issues | ☐ |
| 3 | Zero open P1 issues — OR — orchestrator + product accept the risk in writing | ☐ |
| 4 | All 4 workflows (3.A-3.D) complete end-to-end in Phase 3 | ☐ |
| 5 | Team-handoff returned-to-you bar works (3.B.5) | ☐ |
| 6 | HD sidecar works (4.1-4.3) | ☐ |
| 7 | Appeal generation completes successfully (4.7) | ☐ |
| 8 | LegacyRedirect catches /denials/* (1.7) | ☐ |
| 9 | Performance acceptable (Phase 5) | ☐ |
| 10 | Status template signed off by Vivek (sign-off section completed) | ☐ |
| 11 | Vineeth-Second has reviewed the filled-in template + any P1 risk acceptances | ☐ |
| 12 | BE (DMS v1.1.0) confirmed stable on staging for ≥24h | ☐ |

12/12 → **GO**. Coordinate prod deploy.
<12/12 → **NO-GO**. List blockers + estimate fix time, schedule re-test.

---

## Production ship coordination

Once GO:

1. **Orchestrator session** confirms with Vineeth-Second
2. **BE session** confirms DMS + primrose-lookups-service prod deploys done
3. **FE deploy** to prod with same build SHA tested on staging
4. **Smoke verify on prod** — re-run the 1.x connectivity steps against prod URLs
5. **Comms** to AR team: v4 is live; legacy bookmarks auto-redirect
6. **Monitoring window** — orchestrator session watches for 24h:
   - Error rate via logs
   - User reports via team Slack
   - Performance metrics (if dashboards exist)
   - Any P0/P1 surfacing → immediate rollback discussion

---

## Post-go-live monitoring (first 24h)

| Item | Watch | Threshold for action |
|---|---|---|
| FE error rate | Sentry / browser error logs | Spike >2x baseline → investigate |
| BE 5xx rate | DMS logs | Spike >2x baseline → escalate to BE session |
| Task.complete failures | DMS handler errors | Any cluster of failures on same task_type → may be FE-sent fact mismatch |
| LLM appeal.generate failures | DMS / OpenAI logs | Increased fallback to Gemini OK; both failing → escalate |
| File upload failures | DMS logs | Any clustering → multipart transport issue, escalate to FE |
| User complaints | Team channel | Aggregate by symptom; triage with the same P0-P3 matrix |

Rollback path: revert the FE deploy to v3.0.3 (still tagged in git; BE on v1.1.0 is backwards-compatible with v3 reads per the design, though writes would fail). For a clean revert, would need BE to also roll back to v3-compatible DMS — confirm with BE session before pulling the trigger.

---

## What "done" looks like

- FE v4.0.0 in production
- AR analysts using it day-to-day
- v3 code deleted (P1.14)
- Legacy bookmarks redirect (P1.12)
- Test suite green (P1.13)
- All 4 workflows walkable end-to-end (P1.3-P1.11)

After this phase, **v4.0.0 is shipped**. The project completes its 13-phase plan (P1.9 skipped per earlier decision).

Next-iteration work (not P1.X anymore):
- Real-time updates (push notifications when case state changes)
- Rich-text appeal editor
- Drag-drop file upload
- Tensaw admin panel for alias CRUD (deferred per memory)
- Alias migration from YAML in denial-tool to primrose-lookups-service DB (deferred per memory)
- HANDBACK doc refresh (slightly stale per memory)

These belong to v4.1+ planning, not P1.15.

---

## Files in this deliverable

| File | Purpose |
|---|---|
| `README-P1.15.md` | This document |
| `P1.15-status-template.md` | Fillable template Vivek runs through |

Both delivered to /mnt/user-data/outputs/.
