# DAT Frontend v4.1 — Integration & Handoff

**For:** Vipin (integration) · Vivek (staging) · **From:** orchestrator session
**State:** v4.1 complete. Engine-handler model. Single-version codebase, tsc clean, 203 SSR checks + 22 jsdom tests green.

---

## 1. Read this first — what changed from v4.0.0

v4.0.0 was built against a wrong handoff and **never shipped**. v4.1 is a full rework to the **engine-handler** model. If you integrated anything from v4.0.0, discard it. The four load-bearing reversals (full detail in `Denial-Analyst-Frontend-v4.1.0-arch.md` §1):

1. Worklist = DMS-local task table fed by engine pushes; **FE never calls the engine**.
2. No personal queue / `needs_my_review` / returned-to-originator — work flows **team→team**.
3. `is_high_dollar` is a **flag**, not a sidecar task/queue.
4. No `case_status` — the analyst **completes the dispatched task**; the LLM rec is context, not a gate.

---

## 2. Integration steps (Vipin)

1. **Drop in `src/`** over the prior FE source. The tree is single-version with canonical names (no `-v41` suffix). `@tensaw/actions` and `react-router-dom` are stubbed in `stubs/` for the smoke build — in the monorepo they resolve to the real packages; delete the stubs and confirm the real `useActionQuery`/`useActionMutation` signatures match (`QueryResponseMap`/`MutationResponseMap` in the stub document the expected action-id → response types).
2. **Wire the queue default.** `useTeamQueue(defaultTeam)` and `TopNav`/`WorklistPane` take a `defaultTeam` derived from the JWT roles (handoff §9). Pass the caller's role-default team from auth context.
3. **Permission flags (still TODO from the original handoff):** `canViewCost` (Cost link) is wired through `TopNav`; `canReclassify` is moot now (no reclassify action). Confirm `denial.view_cost` mapping.
4. **File upload (TODO):** `FilesTab` → `UploadPicker` still needs the real multipart-upload wiring (`case.file.upload`); it's stubbed for the smoke build.
5. **Mock vs real:** `src/mocks/server` is an MSW dispatch-loop simulator for local/dev. Gate it behind the existing dev flag; it must not ship to staging against the real DMS.
6. Run `tsc`, the `scripts/sanity-check-*` SSR scripts (`npx tsx`), and `npx vitest run` after wiring.

---

## 3. Staging test-plan rewrite (Vivek)

**Your v4.0.0 task-walk steps are wrong** — they referenced the old 4 named workflows (`medical_necessity_resolution`, etc.) and the accept/override flow. Those don't exist. Rewrite the walk against the **17 task types** and the dispatch model:

- A case enters at `ANALYST_TRIAGE_DENIAL` (denial_intake_analyst). Completing it with `facts_to_set` (clarification_type, appeal_policy, is_high_dollar, …) dispatches the **next** task to the **next team** — the engine decides, not the FE.
- Verify the worklist re-resolves after each completion: same `?case=` stays selected, the work pane shows the **new** active task's form.
- Exercise the decision forms' outcome mapping (AwaitPayer denied→FAIL_FATAL closes the case; CzarCredentialing true_gap→FAIL_FATAL; etc.).
- Filter checks: `task_type` (first-class), `is_high_dollar` toggle, clinic→payer cascade, aging, priority. Team switch via the queue dropdown (count badges from `worklist.counts`).
- Reference panel: Analysis renders `case_facts`; Notes/Files/Appeal/Payments are unchanged.

Keep your existing P0/P1/P2/P3 triage protocol + go/no-go matrix — only the task-walk content changes.

---

## 4. Open items

- **F-4 — Payments tab proxy:** unresolved. The Payments tab renders `case.transactions` as before; if posting/recoupment data should come from a different upstream in the engine-handler world, that's a BE decision still pending. No FE recommendation made.
- **F-5 — reopen completed work:** deferred to beta. Once a case has no open task it shows a read-only "No active task" state; there is no UI to reopen/redispatch. Accept-the-loss for v4.1.
- **Fact shapes (§6) are derived from the corrected handoff prose**, not a published OpenAPI. They're enforced by `TaskFactsByType` in `schemas.ts`; regenerate against the real `denial-management-service` OpenAPI when available and diff — any drift fails the schema tests, which is the intended tripwire.

---

## 5. Final state (verified)

- `tsc --strict`: clean
- SSR sanity: 9 scripts, 203 checks green (incl. all 17 forms' fact shapes validated against schemas + a full dispatch-loop walk in the mock)
- jsdom: 22 tests green (gate-set form submissions, reference-panel tabs, worklist filter, notes, redirect)
- Mockup: `Denial-Analyst-Frontend-v4.1.0-mockup.html`
- Architecture: `Denial-Analyst-Frontend-v4.1.0-arch.md`
