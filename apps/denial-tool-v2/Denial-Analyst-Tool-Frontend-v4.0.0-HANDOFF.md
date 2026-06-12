# FE v4.0.0 · Handoff to Vipin

**From:** Vineeth-Second (orchestrator session)
**To:** Vipin (FE executor)
**Package:** `Denial-Analyst-Tool-Frontend-v4.0.0-complete.zip`
**Verification at handoff:** `tsc --strict` clean · 283/283 SSR · 30/30 vitest

---

## TL;DR

Consolidated v4.0.0 build is ready. 8 things you do, in order:

1. Unzip into a fresh branch off `main`
2. `npm install` + run the test suites to confirm green on your box
3. Integrate into the FE monorepo (notes below)
4. Wire the **multipart upload transport** in the app shell (the one TODO)
5. Wire **permission flags** (`canViewCost`, `canReclassify`) from auth context
6. Open the integration PR
7. Execute **P1.14 cleanup** (separate PR, after the integration PR merges)
8. Hand off to Vivek for **P1.15 staging validation**

Everything below is the detail behind these 8 steps.

---

## What's in the package

| Bucket | Contents |
|---|---|
| Source | ~70 files / ~14k lines under `src/` + 2 stubs under `stubs/` |
| Tests | 10 SSR sanity scripts (283 tests) + 6 vitest interactive (30 tests) |
| Test deps | vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom |
| Mock server | Full v4 MSW set under `src/mocks/v4/` with engine simulator |
| Docs | 13 phase readmes + `ARCHITECTURE.md` + `README-DEVELOPER.md` + this handoff |
| Scripts | `v3-cleanup-discovery.sh` (P1.14 inventory tool) |
| Templates | `P1.15-status-template.md` (Vivek's run sheet) |

Status: every check that can be run from the orchestrator session is green.

---

## Integration plan

### 1 · Land the package in your branch

```bash
git checkout main && git pull
git checkout -b feat/v4-fe-integration
unzip Denial-Analyst-Tool-Frontend-v4.0.0-complete.zip -d /tmp/v4
# Then merge into the monorepo path (your call where — likely apps/dat-frontend/ or similar)
```

Don't merge it into the monorepo yet — keep it as a parallel folder while
you verify the test suites run on your box.

### 2 · Verify green on your box

```bash
cd /tmp/v4/Denial-Analyst-Tool-Frontend-v4.0.0-complete
npm install
npx tsc --noEmit                                # should be silent + exit 0
npx vitest run                                  # 30 tests, ~10s
for s in scripts/sanity-check-v4-*; do npx tsx "$s" 2>&1 | tail -2; done
# Should report 283 total passing, 0 failed
```

If any of these are red on your box but were green at handoff, **stop and
ping the orchestrator before proceeding** — there's likely an env or tooling
gap to surface.

### 3 · Integrate into the monorepo

Three things to know before merging:

**a) The `stubs/` folder doesn't merge.** Stubs exist for the isolated test
environment in the archive (no real `@tensaw/actions` or `react-router-dom`
package present). Production uses the real packages. Drop the `stubs/`
directory and remove the corresponding alias entries from:

- `tsconfig.json` — `paths` block has aliases for `@tensaw/actions` and `react-router-dom`
- `vitest.config.ts` — `resolve.alias` block has the same

After removing aliases, vitest + tsc resolve to the real packages from
`node_modules`. Verify with `npx tsc --noEmit` again.

**b) The mock-server lives at `src/mocks/v4/`.** The existing FE monorepo
probably has `src/mocks/` with v3 handlers. **Don't merge them yet** —
that's P1.14 territory. For the integration PR, put the v4 mocks under
`src/mocks/v4/` and let v3 mocks stay alongside. The flag-based switch
between them happens in the app shell:

```ts
// app shell pseudo-code
if (import.meta.env.VITE_USE_MOCKS === 'true') {
  if (import.meta.env.VITE_API_VERSION === 'v4') {
    await import('./mocks/v4').then(m => m.start());
  } else {
    await import('./mocks').then(m => m.start()); // v3
  }
}
```

(Exact form depends on your existing mocks bootstrap.) After P1.14 cleanup,
the v3 mocks go away and the v4 mocks slide up to `src/mocks/`.

**c) The `package.json` in the archive has minimal deps.** The monorepo's
own package.json drives the build; the archive's is just enough for the
isolated test environment. You'll need to:

- Add the test deps to the monorepo's devDependencies:
  - `vitest@^1.6`
  - `jsdom@^24`
  - `@testing-library/react@^16`
  - `@testing-library/user-event@^14`
  - `@testing-library/jest-dom@^6`
- Confirm the monorepo's React + zod + msw versions match (React 18.3+,
  zod 3.25+, msw 2.14+). If they differ significantly, ping the orchestrator.

### 4 · Wire the multipart upload transport

This is the **one real TODO** that the orchestrator session couldn't ship.

`case.file.upload` action registers with a JSON request schema (metadata
only: file_type, file_name, idempotency_key). The actual binary upload
needs FormData + the right Content-Type at the fetch interceptor level.

What to do:

```ts
// In the fetch interceptor (wherever you intercept @tensaw/actions calls)
// when actionId === 'case.file.upload':
const formData = new FormData();
formData.append('file', selectedFileBlob);            // from the picker's <input type="file">
formData.append('file_type', request.file_type);
formData.append('file_name', request.file_name);
formData.append('idempotency_key', request.idempotency_key);

return fetch(url, {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Idempotency-Key': request.idempotency_key,
    // NOTE: don't set Content-Type — browser auto-sets multipart boundary
  },
});
```

The `FilesTab.tsx` component already has the picker UI + holds the file in
a ref. The action call passes metadata only. The interceptor builds the
FormData around it.

Test this end-to-end against staging before opening the PR.

### 5 · Wire permission flags

`canViewCost` and `canReclassify` are component props, not derived from
auth context internally. The app shell needs to pass them down:

```tsx
const user = useAuthContext();
const canReclassify = user.permissions.includes('denial.classify');
const canViewCost   = user.permissions.includes('denial.cost.view');

<ThreePaneShell
  topNav={<TopNav canViewCost={canViewCost} />}
  middle={<WorkPane canReclassify={canReclassify} />}
  // ...
/>
```

Use whatever your auth context shape is — the components only care about
the boolean. See **`ARCHITECTURE.md` §9** for the reasoning behind props-not-context.

### 6 · Open the integration PR

PR title: `feat(v4-fe): integrate Denial Analyst Tool v4.0.0`

Include in the body:

- Link to the orchestrator session's archive (this zip)
- Summary of what's integrated (paste this handoff's TL;DR)
- Manual smoke confirmation: `/inbox` loads against `VITE_USE_MOCKS=true`
- Test results: `tsc --strict` green, vitest 30/30, SSR 283/283
- Note that v3 still coexists; P1.14 PR removes it

**Don't squash-merge** — keep individual commits readable in case rollback
granularity matters.

---

## After integration PR merges

### 7 · Execute P1.14 cleanup

See `README-P1.14.md` and run `bash v3-cleanup-discovery.sh` from the FE
repo root. The discovery script categorizes v3 files into 8 stages
(leaves → trunks). Work through stages A-H in separate commits, verify
between each.

The most surgical step is **Stage E** — MSW handler files that mix v3
and v4 actions need surgical edits, not whole-file deletion. The
discovery script flags these as "MIXED".

When done, the discovery script should report 0 across all stages.

### 8 · Hand off to Vivek for P1.15

After both PRs (integration + cleanup) are on staging:

- Send Vivek the P1.15 readme + status template (both in this archive)
- Coordinate a 4-5h block for him to run through the test plan
- Watch for surfaced findings in real time; route them per the severity
  matrix in the P1.15 readme:
  - **P0** (ship-blocker) → orchestrator immediately
  - **P1** (must-fix-pre-prod) → orchestrator + you
  - **P2/P3** → log + batch for later

When the filled template comes back GO, coordinate the prod deploy.

---

## Design decisions you might want to know about

Five things the orchestrator made deliberate calls on. Reversible if context
changes, but worth knowing about upfront:

### a) Page-based pagination, not infinite scroll

Worklist uses Prev/Next. Simpler with React Query's keyed cache; worklist
sizes <100 don't benefit from infinite scroll.

### b) OverrideDialog excludes the LLM-recommended category

The category dropdown filters out the LLM's pick. Picking the same category
after clicking Override is a confusing no-op (that's what Accept is for).
1-line change if product wants all categories shown.

### c) Booleans render as Yes/No SegmentedControl, not checkboxes

Bigger touch targets, clearer visual state. All 11 task forms use this pattern.

### d) Custom modal, not Radix Dialog

OverrideDialog rolls its own modal with fixed-position overlay + Escape +
backdrop. No Radix dep. Tradeoff: no focus trap. Defer focus-trap to a11y
polish pass (P1.13 covers Escape + backdrop already).

### e) Appeal textarea is monospaced

Appeal letters are formatting-sensitive — citation numbers, dates, refs need
alignment. Proportional fonts break the LLM-output structure. 1-line change
to `font-sans` if product wants prose-style.

For the full design-decisions list with rationale, see `ARCHITECTURE.md §12`.

---

## Things that might surprise you

These caught me during the build — calling them out so you don't re-trip them:

### Schema-vs-form alignment

When I first built `IntakeTriageForm` (P1.8), I wrote the triage_route values
as `'resolution' | 'coding_partner' | 'payer_call' | 'portal_check'`. The
actual schema in P1.1 had `'resolution' | 'coding_partner' | 'direct_appeal' | 'other'`.
`tsc --strict` caught it. **Pattern:** when building any task form, let
TypeScript validate the facts object against `TaskFactsByType[task_type]`
before submit — it's the safety net against this drift.

### MSW v2 path-matching

MSW v2 in Node mode requires the `*` wildcard prefix on handler paths,
not the relative path. The P1.3 mock-server uses `http.get('*/api/v1/...')`,
not `http.get('/api/v1/...')`. If you add new handlers and they don't fire,
this is usually why.

### React SSR comments break naive string assertions

`renderToString` inserts `<!-- -->` between text and `{interpolation}`.
"Page 1" renders as "Page <!-- -->1". The SSR sanity scripts strip these
in `expectIncludes` helpers — if you write new sanity tests, copy that
pattern.

### Accessible names include description text

In the task-form RouteGrid, each button's accessible name is `label + description`
(both spans are inside the button, neither aria-hidden). So `name: /resolution/i`
matched **both** "Resolution Records on hand..." AND "Direct appeal Straightforward,
skip resolution, draft now". Tighten regex with `^` anchor: `/^Resolution Records/i`.

### Cache invalidation requires explicit declaration

The INVALIDATE matrix in `actions/index-v4.ts` declares which tags each
mutation invalidates. **If a mutation should refresh a query but doesn't,
this is the first place to look.** I caught one of these during the build
(payer-name filter was registered but the worklist wasn't invalidating
correctly on a related mutation — see the project memory notes).

---

## What's intentionally NOT in this build

Flagged for v4.1+ planning, NOT scope creep for the current ship:

- Real-time updates (websocket / push)
- Rich-text appeal editor
- Drag-drop file upload
- Multi-file upload
- File preview / PDF viewer modal
- Note edit / delete (BE has it as append-only by design)
- Appeal PDF render-to-file (BE concern)
- Saved filter presets
- Bulk actions on selected cards
- Tensaw admin panel for alias CRUD (separate app per the memory)
- Alias migration from denial-tool YAML → primrose-lookups-service DB

These all have legitimate cases but none gate v4.0.0.

---

## Where to escalate

| Question type | Route to |
|---|---|
| "Does this PR look right?" | Vineeth-Second (orchestrator) |
| Schema / contract / endpoint shape | Orchestrator → DMS BE session |
| Workflow engine doesn't advance | Orchestrator → DMS BE session |
| Lookups data | Orchestrator → primrose-lookups-service session |
| Tensaw-base / auth | Tensaw platform session (separate from DAT) |
| "Should I change a design decision?" | Orchestrator first — some are part of the broader convention story |

---

## Verification checklist before opening the integration PR

- [ ] Package unzipped + tested in isolation; all suites green on your box
- [ ] Stubs removed; aliases removed from tsconfig + vitest.config
- [ ] Real `@tensaw/actions` + `react-router-dom` resolve from node_modules
- [ ] Multipart upload transport wired in the fetch interceptor
- [ ] `canViewCost` + `canReclassify` wired from auth context to props
- [ ] `VITE_USE_MOCKS=true npm run dev` boots /inbox; Henderson workflow walkable
- [ ] `VITE_API_BASE=<staging>` mode connects to real DMS (smoke-only — don't write yet)
- [ ] `npx tsc --noEmit` green
- [ ] `npx vitest run` 30/30
- [ ] `npm run test:smoke` 283/283
- [ ] Phase readmes + ARCHITECTURE + DEVELOPER-README all in the PR (or in a /docs folder)

All checked → open the PR.

---

## End of handoff

Questions / blockers / "did you really mean X?" — reach out to me
(orchestrator session) directly. I have full context on every phase
decision since I made them. Don't second-guess silently — ping early,
ship clean.

The 13-phase build is complete. The remaining work is yours and Vivek's.

— Vineeth-Second
