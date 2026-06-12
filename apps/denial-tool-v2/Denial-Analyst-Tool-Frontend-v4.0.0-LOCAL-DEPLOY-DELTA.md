# Local deploy — delta from v3.x

Only documents what's **changed** since the previous local deploy instructions.
The bulk of your setup (Node version, monorepo bootstrap, lint config, etc.)
stays the same.

---

## What's new

### 1 · BE endpoint changes

| | Before (v3) | After (v4) |
|---|---|---|
| Backend service | `denial-tool-service v2.0.1` | `denial-management-service v1.1.0` (DMS) |
| Path prefix | `/api/v1/denials/...` | `/api/v1/cases/...` (and `/api/v1/lookups/...`) |
| Health probes | `/healthz`, `/readyz` | unchanged (still at root) |
| Lookups | embedded in denial-tool | separate service: `primrose-lookups-service v1.0.0`, proxied via DMS |

If you have a local `.env` with `VITE_API_BASE` pointing at v3's denial-tool,
update it to point at v4's DMS instead:

```bash
# .env.local
VITE_API_BASE=https://dms-staging.primrose.internal
# OR for fully local:
# VITE_API_BASE=http://localhost:8000
```

---

### 2 · Mock-server convention

The mock-server moved from `src/mocks/` (v3) to `src/mocks/v4/` (v4).
After P1.14 cleanup deletes v3 mocks, `src/mocks/v4/` slides up to
`src/mocks/`.

Activation flag is unchanged — still `VITE_USE_MOCKS=true`:

```bash
VITE_USE_MOCKS=true npm run dev
```

**New:** the v4 mock-server includes a full **engine simulator** — `task.complete`
actually advances the workflow client-side. You can walk Henderson's 5-step
medical_necessity workflow end-to-end against the mock without a live BE.

**New:** identity in the mock is driven by `X-Mock-User-Id` header. Defaults
to `user_42` (Vipin K. in the seed). To test the team-handoff flow as two
different users, open two browser windows with different `X-Mock-User-Id`
values (set via a browser extension or curl-based smoke).

15 seed cases across all 4 case statuses. See `README-P1.3.md` for the
seed-data inventory.

---

### 3 · New test deps

Install these into the monorepo's devDependencies:

```bash
npm install --save-dev \
  vitest@^1.6 \
  jsdom@^24 \
  @testing-library/react@^16 \
  @testing-library/user-event@^14 \
  @testing-library/jest-dom@^6
```

If the monorepo already has vitest at a different version, **check
compatibility** before bumping. Older monorepo Vitest 0.x has different
config syntax; this build was authored against 1.6.

---

### 4 · New test commands

Two test suites in v4 (vs. v3's single jest setup, if you had one):

```bash
# Fast structural tests via SSR (283 tests, ~5s)
for s in scripts/sanity-check-v4-*; do npx tsx "$s"; done

# Interactive tests with jsdom (30 tests, ~10s)
npx vitest run

# Watch mode for active development
npx vitest

# Type-check
npx tsc --noEmit
```

Recommended `package.json` additions if not already present:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "for s in scripts/sanity-check-v4-*; do npx tsx \"$s\"; done",
    "test:all": "npm run typecheck && npm run test && npm run test:smoke"
  }
}
```

---

### 5 · Bundled `vitest.config.ts`

New file at repo root. Configures:

- `environment: 'jsdom'` for interactive tests
- `globals: true` (so vitest's `describe`/`it`/`expect` work without imports)
- `setupFiles: ['./src/test/setup.ts']` — extends expect with jest-dom matchers
- `resolve.alias` for `@tensaw/actions` + `react-router-dom` → the stubs

**Drop the aliases when integrating into the monorepo** — production uses
real packages. Keep the rest of the config.

---

### 6 · Multipart upload — needs wiring

The `case.file.upload` action ships with a JSON request schema (metadata
only). The actual binary upload needs FormData + the right fetch interceptor.

**This is the one real TODO in v4** — not addressed in the orchestrator
session because the fetch interceptor lives in the FE app shell, not in
this build.

See `HANDOFF.md §4` for the snippet.

---

### 7 · Routes

| | Before (v3) | After (v4) |
|---|---|---|
| Main route | `/denials` | `/inbox` |
| Old route handling | n/a | `/denials/*` → `<LegacyRedirect />` → `/inbox` |

Update any bookmarks. The redirect drops query params (v3 `?denial=...` IDs
don't translate to v4 `?case=...`); users land at the inbox and find the
case via search/filters.

URL params for the main route (`/inbox`):

```
/inbox?queue=<id>&case=<case_id>&category=<code>&clinic_id=<id>
       &primary_payer_id=<id>&aging=<bucket>&priority=<level>
       &page=<n>&tab=<analysis|payments|notes|files|appeal>
```

All optional. Cross-param rules in the hooks (queue change drops page+case,
filter change drops page, clinic clears payer).

---

### 8 · Permission flags

`canViewCost` and `canReclassify` are now **props** that the shell passes
to TopNav + WorkPane, not derived from auth context internally.

The shell needs to consult `useAuthContext()` (or whatever your auth context
shape is) once and pass the booleans down. See `HANDOFF.md §5`.

---

## What's unchanged

For completeness — the following did NOT change from v3:

- Node version requirement
- Vite as the bundler
- React + TypeScript versions (React 18, TS strict)
- ESLint / Prettier config (assuming monorepo-wide)
- Zod for schema validation
- React Query as the underlying cache (via `@tensaw/actions`)
- Tailwind CSS (utility classes only)
- Storage for build artifacts
- Deploy pipeline (still whatever monorepo uses)

---

## Quick reference

```bash
# Install
npm install

# Dev (mocks)
VITE_USE_MOCKS=true npm run dev

# Dev (staging BE)
VITE_API_BASE=https://dms-staging.primrose.internal npm run dev

# Tests
npm run typecheck                  # tsc --noEmit
npm test                           # vitest interactive (30 tests)
npm run test:smoke                 # SSR sanity scripts (283 tests)
npm run test:all                   # all three above

# Discovery for v3 cleanup (during P1.14)
bash v3-cleanup-discovery.sh
```

---

## Anything else?

If something doesn't match what you expect for a local run, check:

1. `package.json` deps — confirm the test deps installed
2. `vitest.config.ts` — confirm aliases match your monorepo's resolution
3. `tsconfig.json` paths block — same
4. Env vars (`VITE_USE_MOCKS`, `VITE_API_BASE`) — confirm they're set

If still stuck, ping the orchestrator session.

— end of delta —
