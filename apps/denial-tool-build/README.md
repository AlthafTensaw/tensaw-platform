# Denial Analysis Tool — Frontend bundle (v3, post-PR-6)

**This is the v3 consolidated bundle.** It supersedes v1 (post-PR-4) and v2 (post-PR-5).

**What v3 adds over v2:** PR-6 — design-system alignment refactor. Custom components folded into platform primitives from `@tensaw/design-system`, `@tensaw/wired-components`, `@tensaw/composition`, `@tensaw/worklist`, and `@tensaw/visualization`. No backend changes.

For the comprehensive handoff (setup, testing, smoke test, debugging, etc.) read `UI_DEVELOPER_HANDOFF.md` (shipped separately). That doc covers PR-1 → PR-5; the PR-6 delta is documented in `PR6_README.md`.

## What changed in PR-6 (one-screen summary)

Custom components deleted and replaced with platform equivalents:

| Deleted | Replaced by |
|---|---|
| `RecommendationGrid` (251 LOC) | `DataExplorer` from `@tensaw/composition/data-display` with v2 expansion props |
| Custom `PrivacyField` (PR-5) | Thin wrapper over `@tensaw/design-system/rcm/privacy/PrivacyField` |
| Custom Override modal markup | `Dialog` + `ActionForm` |
| Manual `useActionMutation` in every button | `ActionButton` from `@tensaw/wired-components` |
| `PriorityChip` / `AgingChip` / `CurrentStatusBadge` | Inline `Pill` with tone tables in `cells.tsx` |
| `ConfidenceDot` | Inline 6px dot in `cells.tsx` (no platform equivalent) |
| Hand-rolled SVG cost chart | `LineChart` from `@tensaw/visualization/charts` |
| Hand-rolled `AppLayout` header | `AppShell` + `TopNav` + `Avatar` + `DropdownMenu` |
| Inline `style={{ … }}` | Tailwind utility classes |

Net file count: 60 → 55 (-5). Net LOC: ~600 deleted, ~400 added.

## Wire compatibility (unchanged from v2)

- Backend: `denial-tool-service` Phase 1.5 Day 14 (14 OpenAPI paths)
- Platform: `tensaw-ui-with-trace-expansion-v2.zip` or newer (row expansion present at all three grid layers)

Schemas, fixtures, mock handlers, action registry — all unchanged from PR-5.

## Integration (the same 6 steps as v2)

```bash
# 1. apps/denial-tool/
cp -r path/to/denial-tool-build/apps-denial-tool/. apps/denial-tool/

# 2. packages/mock-server/
cp -r path/to/denial-tool-build/packages-mock-server-patch/. packages/mock-server/

# 3-6. tsconfig + mock-server index + eslint + package.json patches
# (see ROOT_TSCONFIG_PATCH.md + the per-area *.patch.md files; unchanged from v2)
```

Then:

```bash
pnpm install
pnpm -F denial-tool typecheck
pnpm -F denial-tool lint
pnpm -F denial-tool test
pnpm -F denial-tool e2e
```

## What to read first

1. `UI_DEVELOPER_HANDOFF.md` — comprehensive handoff (still mostly accurate after PR-6; the directory layout, action endpoint table, and smoke test all hold; only §2 chronology and §4.1 layout need PR-6 mental-merging)
2. `PR6_README.md` — the design-system alignment delta in detail (read this if anything in the components looks unfamiliar vs v2)
3. `BACKEND_HANDBACK.md` — what the backend team still owes (`state_updated_at` errata)
4. `SCHEMA_DATA_GRID_EXPANSION_HANDBACK.md` — the platform-side row-expansion API PR-6 builds on

## Migration notes for the FE dev (the bits most likely to bite)

- **Selection state shape changed.** PR-5 used `Map<string, WorklistRow>`; PR-6 uses `string[]` to match `DataExplorer`'s controlled selection contract. `WorklistPage` rebuilds the row lookup with `useMemo`. If you had any code reading from the old Map, it needs the `selectedRows = useMemo(() => ids.map(id => byId.get(id)).filter(Boolean), [ids, byId])` pattern.
- **Mutation hook tuple shape.** All buttons now go through `ActionButton` from wired-components, which uses the `[fire, state]` tuple internally per your bug-report fix #1. If you're keeping inline `useActionMutation` anywhere, follow the tuple convention.
- **PrivacyField imports.** The wrapper (`apps/denial-tool/src/components/PrivacyField.tsx`) re-exports the platform one with the audit-dispatch adapter. Existing callers continue to import from the app path; nothing changes at the call site.
- **Cost chart data conversion.** The hand-rolled SVG plotted cents; the new `LineChart` plots USD as a number. The backend response shape is unchanged.

If anything doesn't typecheck against the actual platform package shapes (I worked from the v2 source tree's `.tsx` files), flag it. Component imports are the most likely place for drift.
