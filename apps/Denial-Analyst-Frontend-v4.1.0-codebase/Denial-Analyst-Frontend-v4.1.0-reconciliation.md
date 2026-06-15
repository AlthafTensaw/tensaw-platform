# Cross-Session Reconciliation — Primrose RCM Denial Tool
**As of 2026-06-14 · orchestrator (Vineeth-Second) view**

## Purpose & method
Reconcile the pending cross-session items (the "Sessions 1/2 → consolidated FE handoff" plan) against the actual current state. The Session 1/2 source artifacts were produced in **other** Claude sessions and are not in this session's workspace, so this pass reconciles against the retrieved session records (orchestrator + backend build chats) plus the FE v4.1 codebase this session just delivered. Where a deep code-level cross-check would need the actual bundles, that's flagged.

**Headline:** the "Sessions 1/2 pending consolidation" framing is **stale** — it predates an architecture migration that overtook it. The live state is the v3.0 split architecture with the frontend at **v4.1 (engine-handler)**. Details below.

---

## 1. Authoritative current topology

```
                         ┌────────────────────────────┐
  Analyst (browser) ───▶ │ DAT Frontend v4.1           │  ← this session
                         │ engine-handler model         │
                         └──────────────┬──────────────┘
                                        │  HTTPS, /api/v1/, one backend only
                         ┌──────────────▼──────────────┐
                         │ denial-management-service    │  v1.1.0  (Session B, reworked)
                         │ (tenant cloud; case-centric) │  136/137 tests · 92% cov
                         └───┬───────────┬───────────┬──┘
                  workflow-  │   tensaw-  │   rcm-data-access-service v1.0.0 (Session A)
                  runtime    │   llm-gw   │   (in vendor env; fronts Allofactor v3 MySQL)
                  (engine)   │            │   75 tests · 95% cov · firewall-only auth
```

The engine is **request-driven** (no poller): the analyst completes a task → DMS signals the engine → the engine routes the next task to the next team's queue → workers query their queue on demand. This is exactly the model the FE v4.1 implements.

---

## 2. Reconciliation findings vs the stale plan

| Item (as remembered) | Actual status | Action |
|---|---|---|
| **Session 1 — `denial-tool-service v2.1.0`** (envelope, worklist search, /api/v1/ migration, 385 tests) "pending consolidation" | **Superseded.** The entire `denial-tool-service v2.x` line was replaced by the v3.0 split (it violated Tensaw constraints via direct vendor-DB access). v2.1.0 is a dead-end increment; it was never consolidated and should not be. | **Retire.** Do not fold into any FE handoff. Keep only as historical reference / for the `MIGRATION_FROM_DENIAL_TOOL_V2` lineage. |
| **Session 2 — `primrose-lookups-service v1.0.0`** "pending consolidation" + "future org-wide lookups/alias DB" | **Built (Jun 1) but not on the v3.0 critical path.** The orchestrator **folded lookups scope into `rcm-data-access-service`** for the live path; a follow-up lookups session was aborted. The standalone service + the org-wide alias-DB vision still stand as a **future** roadmap item (DMS backlog lists "alias migration to primrose-lookups-service" as *deferred*). | **Shelve as future.** Lookups for DMS/FE come from rcm-data-access today. Revisit primrose-lookups-service only for the org-wide rollout. |
| **Consolidated FE v3.1.0 handoff** "pending generation" | **Obsolete.** The FE did not go v3.1.0; it went **v4.0.0** (against DMS v1.1.0) then was reworked to **v4.1** (this session) after a corrected engine-handler handoff. | **Drop.** The current handoff is `Denial-Analyst-Frontend-v4.1.0-dev-handoff.md` + `Denial-Analyst-Frontend-v4.1.0-arch.md`. |
| Orchestrator "pending Sessions 1/2" memory | **Stale** — reflects the pre-migration (v3.1.0-era) plan. | See §6 — recommend correcting the record. |

**Net:** there is nothing left to "consolidate" from Sessions 1/2. The work that mattered flowed into the v3.0 services + FE v4.1; the rest was superseded.

---

## 3. FE v4.1 ↔ DMS v1.1.0 contract alignment (the part that matters going forward)

The FE v4.1 this session delivered was built against the **corrected** engine-handler handoff. Cross-checking its encoded assumptions against the DMS v1.1.0 record:

| Contract point | FE v4.1 | DMS v1.1.0 | Aligned? |
|---|---|---|---|
| URL convention | `/api/v1/` business + `/healthz`,`/readyz` at root | 23–24 business routes under `/api/v1`, health unversioned at root | ✅ |
| Single backend | FE calls DMS only; never the engine | DMS proxies/orchestrates vendor + engine + LLM | ✅ |
| Task completion | `POST /worklist/{task_id}/complete` with `SUCCESS/NEEDS_INFO/FAIL_FATAL` | DMS reports `HandlerOutcome` to engine; FE-facing outcomes are these three | ✅ |
| Worklist row | null-tolerant `claim_summary` (nullable patient_name etc.); `net_pending` STRING | "null-tolerant claim/task join"; financials as decimal strings | ✅ |
| Case detail | `recommended_category` + `recommended_confidence` + `recommended_**reasoning**` | classifier emits `recommended_category` + `recommended_**owner**` + `confidence` | ⚠️ **verify** |
| Notes/files/appeals/lookups/categories | unchanged endpoints | unchanged | ✅ |
| Demo fixture | claim **300138** (Henderson) in the mock | migration preserves claim **300138** (clinic 5, wrong_payer_misrouted, proposed, conf 0.9) | ✅ (mock category differs — cosmetic) |

**⚠️ One field to confirm:** the FE's `CaseDetail` carries `recommended_reasoning`; the DMS classifier record mentions `recommended_owner`. The corrected handoff specified `reasoning`; the v2.x→v3.0 classifier simplification emitted `owner`. **Verify the exact field name(s) against the DMS OpenAPI** — if DMS emits `recommended_owner` (and/or both), the FE's `LlmRecContext`/`AnalysisTab` need a one-field adjustment. This is the only substantive FE/BE contract risk found.

---

## 4. Open wiring/integration items inherited from the DMS v1.1.0 backlog (affect FE go-live)

- **workflow-runtime + tensaw-llm-gateway WIRING TODOs** — DMS coded these against mocked interfaces (respx) pending published contracts. Until confirmed, live task dispatch + live classification aren't exercised end-to-end. FE behaves correctly regardless (it only talks to DMS), but staging E2E depends on these.
- **File download (S3) + mTLS** — deferred in DMS. Affects `FilesTab` download wiring on the FE (already a FE TODO in `Denial-Analyst-Frontend-v4.1.0-dev-handoff.md`).
- **Worklist claim-side sort** — deferred in DMS. If the FE worklist needs server-side sort beyond current filters, it waits on this.
- **Three v2.0.0 BE asks carried to v3.1** — specifics not in the retrieved record; confirm with the DMS owner whether any are FE-facing.
- **rcm-data-access pyproject package-name bug** — noted during Session A cross-check; confirm it was patched before deploy.
- **DMS stale test (1/137)** — one test needed a one-line `mock_engine` fixture patch; confirm it's green in the shipped bundle.

---

## 5. Consolidated quality status

| Service / surface | Version | Tests | Coverage | Notes |
|---|---|---|---|---|
| rcm-data-access-service | 1.0.0 | 75 | ~95% | firewall-only auth (by decision); pkg-name bug noted |
| denial-management-service | 1.1.0 | 136/137 | ~92% | phantom WorkflowRuntimeClient removed; 1 stale test |
| DAT Frontend | 4.1 | 22 jsdom + 203 SSR checks | tsc strict clean | engine-handler; single-version tree (this session) |
| denial-tool-service | 2.1.0 | (385) | — | **superseded — retired** |
| primrose-lookups-service | 1.0.0 | (built) | — | **shelved — future org-wide** |

---

## 6. Recommended actions

1. **Confirm the `recommended_reasoning` vs `recommended_owner` field** against the DMS OpenAPI (§3). Only substantive FE/BE risk. One-field FE fix if it diverges.
2. **Hand the FE to Vipin/Vivek** with `Denial-Analyst-Frontend-v4.1.0-dev-handoff.md` (integration + staging-test rewrite to the 17 task types) — no further consolidation needed.
3. **Close out the stale "Sessions 1/2 / FE v3.1.0" tracking** — superseded/shelved per §2.
4. **Correct the orchestrator record** (see note below).

> **Memory note:** my stored notes still list "Sessions 1/2 deliverables pending cross-check" and "consolidated FE v3.1.0 handoff pending" as live, and frame primrose-lookups-service as a near-term shared service. Per this reconciliation those are stale. I can update my memory to reflect (a) denial-tool-service v2.1.0 superseded, (b) primrose-lookups-service shelved/future, (c) FE at v4.1 not v3.1.0 — **say the word and I'll make those edits.** I'm not changing the record unilaterally.
