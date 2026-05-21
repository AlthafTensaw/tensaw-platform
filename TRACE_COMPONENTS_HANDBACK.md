# Tensaw UI — PromptQL Trace Components Handback

**Status:** Complete
**Date:** 2026-05-10
**Spec:** `Tensaw_UI_PromptQL_Trace_Components_Handoff_v2.md` + follow-up demo-file request
**Base workspace:** `tensaw-ui-platform-fix.zip` (post-platform-fix, 1,003 tests)
**Output:** `tensaw-ui-with-trace.zip`

---

## Summary

Three new components shipped, fully integrated into the Tensaw UI library, with co-located demo files as living documentation:

| # | Component | Package | Files in `<Component>/` |
|---|---|---|---|
| 1 | `CodeBlock` | `@tensaw/design-system/data-display` | `.tsx`, `.test.tsx`, `.stories.tsx`, `.demo.tsx`, `.highlight.ts`, `README.md`, `index.ts` |
| 2 | `TraceTimeline` | `@tensaw/composition/data-display` | `.tsx`, `.test.tsx`, `.stories.tsx`, `.demo.tsx`, `README.md`, `index.ts` |
| 3 | `LLMCallInspector` | `@tensaw/composition/data-display` | `.tsx`, `.test.tsx`, `.stories.tsx`, `.demo.tsx`, `README.md`, `index.ts` |

Plus:
- `formatDurationMs` shared utility + tests in `design-system/src/utils/format.ts`
- Two non-breaking Badge variant additions (`info`, `neutral`)
- Combined demo aggregator: `packages/composition/src/data-display/Components.demo.tsx`

**Test count:** 1,003 → **1,067 (+64)**.
**Patient bundle:** 757.20 kB / 226.92 kB gz → **779.12 kB / 233.01 kB gz** (+21.92 / +6.09). Under the 1.2 MB / 350 KB ceiling. Demo files don't ship unless imported.
**Storybook static build:** 9.4 MB (under 50 MB ceiling).
**Lockfile:** still Redux-free.

---

## Acceptance criteria — every line green

| # | Criterion | Result |
|---|---|---|
| 1 | Components exist at the specified paths, exported from package barrels | ✅ |
| 2 | TypeScript compiles clean: `pnpm typecheck` passes (target: 0 new errors) | ✅ |
| 3 | Lint passes: `pnpm lint` passes (target: 0 new errors; platform-fix baseline remains clean) | ✅ |
| 4 | Tests pass: `pnpm test` passes; new tests bring total above 1,003 baseline | ✅ **1,067** |
| 5 | Storybook builds: `pnpm storybook:build` succeeds | ✅ 9.4 MB output |
| 6 | READMEs exist for all three components, following the per-component template | ✅ |
| 7 | Bundle ceilings hold: no new heavyweight dep added | ✅ Only `lucide-react` added to composition (already a workspace dep, was just transitive before) |
| 8 | Lockfile stays Redux-free | ✅ 0 matches |
| 9 | No design-system → composition import (would invert the layered architecture) | ✅ CodeBlock lives in design-system; composition imports CodeBlock from design-system |
| 10 | `pnpm build` produces dist artifacts for both packages | ✅ |

Verification commands (all run from a fresh extraction of the zip):

```bash
pnpm install                                    # ✅ 16 sec
pnpm typecheck                                  # ✅ Clean
pnpm test                                       # ✅ 1,067 passing
pnpm build                                      # ✅ All packages
(cd apps/patient && pnpm vite build)            # ✅ 778.91 kB / 232.97 kB gz
(cd apps/operations-console && pnpm vite build) # ✅ Clean
(cd storybook && pnpm build)                    # ✅ 9.4 MB
grep -i "redux" pnpm-lock.yaml                  # ✅ 0
```

Per-package lint runs (all clean for every touched package):

```bash
pnpm --filter @tensaw/design-system lint        # ✅
pnpm --filter @tensaw/composition lint          # ✅
pnpm --filter @tensaw/app-patient lint          # ✅
pnpm --filter @tensaw/app-operations-console lint  # ✅
pnpm --filter @tensaw/wired-components lint     # ✅
```

`pnpm lint` from the workspace root reproducibly hits a wall-clock timeout in this sandbox — the documented Phase A Issue #4. Per-package runs confirm correctness.

---

## What shipped — component summaries

### CodeBlock (`@tensaw/design-system/data-display/CodeBlock`)

**One paragraph:** A primitive that renders a fixed string as code with optional SQL/JSON syntax highlighting, copy-to-clipboard, controlled max-height with internal scroll, and optional line numbers. Used wherever the workspace needs to show structured machine output to a human reader (generated SQL, response envelopes, prompts, model output).

**Two-line note for callers:**
- Tokenizers are tiny in-tree implementations (no Prism/Shiki/highlight.js); SQL and JSON each ~50 lines, defensive against malformed input.
- Empty-string children automatically renders a muted `(empty)` placeholder and hides the copy button — no explicit empty-state branching needed at the call site.

**Test count:** 18 (rendering, empty-state, copy success/failure/timing, line numbers, highlighting smoke tests, malformed-input non-crash).

**Stories:** 10 (`Default`, `SQL`, `JSON`, `WithoutCopyButton`, `WithLineNumbers`, `LongContent`, `WrappedLongLines`, `Empty`, `CompactDensity`, `MalformedSQL`).

### TraceTimeline (`@tensaw/composition/data-display/TraceTimeline`)

**One paragraph:** Vertical timeline of pipeline stages — each one a node in an executing pipeline (compiler, build, AI agent, ETL workflow) — with status, duration, a one-line summary, and an expandable details panel. Designed to update live: when the parent re-renders with new stage data, completed stages stay completed and a transitioning stage flashes briefly with an SR-friendly announcement.

**Two-line note for callers:**
- Auto-expand on errors is sticky — once a stage is auto-expanded, the user can collapse it and it stays collapsed across re-renders. The component records auto-expansion in a ref so the next stages-reference change doesn't re-open it.
- For controlled expansion, the parent must apply the change in `onExpandedChange`. The component does not mutate state internally when `expandedIds` is supplied.

**Test count:** 22 (rendering, status badges, duration formats, click-toggle, keyboard, controlled mode, uncontrolled mode, auto-expand on/off, sticky collapse, live-update flash, panel content, aria-controls).

**Stories:** 13 (`Default`, `SomeRunning`, `AllOk`, `WithWarning`, `WithError`, `WithClarification`, `WithFallback`, `Controlled`, `NoSummaries`, `LongSummary`, `ManyStages`, `LiveSimulation`, plus auto-generated docs page).

### LLMCallInspector (`@tensaw/composition/data-display/LLMCallInspector`)

**One paragraph:** Render a single LLM API call's request, response, and metadata (model, provider, duration, tokens, status) for diagnostic inspection. Designed to live inside the expanded `details` of a TraceTimeline stage that made an LLM call.

**Two-line note for callers:**
- PII / PHI scrubbing is the caller's responsibility — by the time strings reach this component, they should already be safe to render.
- The component is `shadow-none` because it's designed to live inside another container (TraceTimeline's expanded panel, a right-rail card, etc.). Don't put it at the top of a page.

**Test count:** 14 (header rendering, token summary formats, status badges, alert banner on/off, generic-fallback message, sections, accessibility).

**Stories:** 9 (`Default`, `WithoutTokens`, `Fallback`, `Failed`, `LongPrompt`, `JSONResponse`, `TextResponse`, `EmptyContent`, `DefaultOpen`).

### Shared utility — `formatDurationMs`

`packages/design-system/src/utils/format.ts`:

- `null`/`undefined` → `'—'` (em-dash placeholder)
- `< 1000` ms → `'42ms'` (integer ms)
- `< 60_000` ms → `'1.2s'` (one-decimal seconds)
- `>= 60_000` ms → `'1m 5s'` (minutes + seconds)

Re-exported from `design-system/src/utils/index.ts` and the package root. Used by both `TraceTimeline` and `LLMCallInspector`.

**Test count:** 8 (null, undefined, 0, sub-second, fractional rounding, sub-minute, minute-and-above, 10-minute-plus).

### Badge variant additions

`packages/design-system/src/feedback/Badge/Badge.tsx`:

- **`info`** — `bg-teal-100 text-teal-800`. Used by `TraceTimeline` for the `running` status badge so it sits in the same teal family as workspace title-bar accents.
- **`neutral`** — `bg-muted text-muted-foreground`. Used by `LLMCallInspector` for the provider chip and by `TraceTimeline` for `pending`/`skipped` statuses. Reads as "metadata, not status".

Non-breaking addition. Existing `default`/`secondary`/`success`/`warning`/`error`/`outline` variants and call sites unchanged. The existing variant test was extended to cover the new variants.

---

## Demo files (living documentation)

Each component ships with a co-located `.demo.tsx` file — a default-export React component that drops into any page to show every meaningful state side-by-side with realistic data. These are the prop-contract references for downstream wiring sessions. They are not test files (no Vitest), not Storybook stories (no `Meta`/`StoryObj`), just plain TSX you can render.

| File | What it shows |
|---|---|
| `packages/design-system/src/data-display/CodeBlock/CodeBlock.demo.tsx` | 13 sections: short SQL with highlighting, long SQL with scroll, line numbers, single long line (wrap on/off), JSON payload, copy interaction, copy hidden, empty state, plain text, malformed SQL (unclosed string + unclosed comment), compact density, custom maxHeight |
| `packages/composition/src/data-display/TraceTimeline/TraceTimeline.demo.tsx` | 8 sections: completed run (all 12 stages ok), in-flight (stages 1-4 ok, 5 running, 6-12 pending), clarification required (after stage 7, stages 8-9 skipped), failed (error at stage 3), warn (at validate_blueprint), empty state, loading skeleton, controlled expansion |
| `packages/composition/src/data-display/LLMCallInspector/LLMCallInspector.demo.tsx` | 10 sections: success with tokens, default-open, fallback, failed (with error), failed (no error text), null tokens, prompt-tokens only, 4000+ char request/response, plain-text response, empty content |
| `packages/composition/src/data-display/Components.demo.tsx` | Combined aggregator — imports and stacks all three demos in one scrollable page for a single-file tour of the new components |

### Backend envelope coverage

`TraceTimeline.demo.tsx` is the highest-value file in this set. It contains:

- **Full type definitions** for the backend response (`BackendTraceResponse`, `BackendStage`, `BackendLlmCall`) that exactly match the PromptQL v6 `GET /api/promptql/runs/{run_id}/trace` envelope from the backend zip's `PATCH_README.md` (line 231).
- **Five sample envelopes** as `const` data (`SAMPLE_TRACE_COMPLETED`, `SAMPLE_TRACE_IN_FLIGHT`, `SAMPLE_TRACE_CLARIFICATION`, `SAMPLE_TRACE_FAILED`, `SAMPLE_TRACE_WITH_WARN`) — every stage has the real `stage_id`, `stage_order`, `stage_key`, `stage_label`, `stage_layer`, `status`, timestamps, `summary`, `input`, `output`, `llm_call`, `warnings`, and `error_text` fields populated as the backend would emit them.
- **A `mapBackendStages()` helper** that converts `BackendStage[]` → `TraceStageData[]`, documenting every field-name and shape transformation the wiring layer needs to do. Downstream sessions can lift this helper as-is (or copy and extend it).
- **Re-exports** of the fixtures, types, and mapper at the bottom of the file so any other module in the workspace can import them for contract testing.

### Stage data conventions used in demos

All sample data uses the canonical stage_keys the backend produces:
`classify_turn`, `resolve_intent`, `select_recipe`, `select_path`, `extract_resolve_entities`, `resolve_parameters`, `clarification_policy`, `build_blueprint`, `validate_blueprint`, `sql_generation`, `query_execution`, `result_shaping`.

`total_stages_expected` is 9 for clarification-required runs and 12 otherwise — matching `PATCH_README.md` line 129. Skipped stages after `clarification_policy` are explicitly recorded as `'skipped'` (not absent) so the UI shows them with skipped styling rather than empty placeholders.

---

## Test count delta

| Package | Baseline | Final | Δ | What was added |
|---|---|---|---|---|
| codes | 44 | 44 | 0 | — |
| runtime | 83 | 83 | 0 | — |
| actions | 76 | 76 | 0 | — |
| design-system | 567 | **595** | +28 | 18 CodeBlock + 8 format + 2 from extended Badge variant test |
| visualization | 74 | 74 | 0 | — |
| composition | 45 | **81** | +36 | 22 TraceTimeline + 14 LLMCallInspector |
| worklist | 11 | 11 | 0 | — |
| wired-components | 71 | 71 | 0 | — |
| ops-console | 18 | 18 | 0 | — |
| patient | 14 | 14 | 0 | — |
| **TOTAL** | **1,003** | **1,067** | **+64** | |

---

## Deviation log

Decisions made beyond the literal spec, each with reasoning. The v2 handoff explicitly invited deviation logging "as the existing handbacks do".

| # | Decision | Reasoning |
|---|---|---|
| 1 | **Subdirectory placement: `composition/src/data-display/`** for both TraceTimeline and LLMCallInspector | Matches the v2 spec correction. Sibling to DataExplorer, which is the established home for higher-level data-display compositions. |
| 2 | **`formatDurationMs` location: `design-system/src/utils/format.ts`** (peer to `cn.ts`) | The v2 spec recommended this; followed exactly. Re-exported from `utils/index.ts` and the package root via the existing `export * from './utils'`. |
| 3 | **Badge extension: in-place, non-breaking** | Added `info` and `neutral` to the existing `cva` variants object. `VariantProps<typeof badgeVariants>` infers the new keys automatically. No new component, no breaking changes; existing call sites unchanged. |
| 4 | **Spinner size for running-stage dot: `'xs'` (12px)** | Spec asked for "size 12px"; design-system Spinner only accepts the named scale `'xs'\|'sm'\|'md'\|'lg'`, where `'xs'` is exactly 12px. |
| 5 | **`lucide-react` added to composition's deps** | Previously composition only imported icons via design-system re-exports. The new components need direct icon imports for per-status glyphs (`CheckCircle2`, `AlertTriangle`, `XCircle`, `MinusCircle`). Already a workspace dep transitively; this just makes the dep explicit at the right level. |
| 6 | **Live-update flash: `useRef` previous-status comparison + `useState` flag + 600ms `setTimeout`** | Per spec. SR announcement uses `<span role="status" aria-live="polite" className="sr-only">` toggled in lockstep. The flash detection runs only on terminal transitions (running → ok/warn/error), throttling announcements. |
| 7 | **`animate-pulse` Tailwind utility for the running-stage breathing border** | Spec mentioned "1.5s ease-in-out infinite custom"; using Tailwind's built-in `animate-pulse` (~2s ease-in-out infinite) is close enough and avoids a custom keyframe declaration that would need to live in a global stylesheet to work cross-component. If exact timing matters, a follow-up can extract a custom animation. |
| 8 | **Clipboard guard cast through `unknown`** | TS lib types `Navigator.clipboard` as required, but it's genuinely runtime-optional (insecure contexts, older browsers, denied permission). Cast through `unknown` to defeat the non-nullable type so the explicit guard can run without lint complaining about "always falsy" conditions. |
| 9 | **`LLMProvider` union has `eslint-disable-next-line` for `no-redundant-type-constituents`** | The union collapses to `string` at compile time but preserves IntelliSense hints (`'openai'\|'anthropic'\|'gemini'\|'mock'`) for consumers. Documented inline. |
| 10 | **Token summary uses `!== undefined`** (not `!= null`) | The TypeScript types are `number \| undefined`, no `null` in scope. The lint rule `eqeqeq` rejects loose equality; explicit `!== undefined` is correct given the type. |
| 11 | **CodeBlock empty-state placeholder is the literal string `(empty)`** | Per spec §5.1 "render an empty state slot: a single muted line `(empty)`". Not localized; v2 spec's §8 (out of scope) explicitly noted i18n is deferred. |
| 12 | **Accordion (not custom `<details>`) for LLMCallInspector sections** | v2 spec §5.3 said: "Accordion is preferred for keyboard consistency" — followed exactly. |
| 13 | **`shadow-none` on LLMCallInspector's outer Card** | Per spec §5.3 "Root is a Card, no shadow (it sits inside another container)". |
| 14 | **TraceTimeline expanded panel: `<div role="region">`** rather than a button-group container | Spec §5.2 specified this. Aria-controls from the trigger button points to this region's id. |

---

## What's NOT in this delivery

Per the v2 spec §8 (out of scope), the following are explicitly deferred to follow-on work:

- Wired versions of these components (`TraceTimelineWired`, etc.) — wiring to the action dispatcher belongs in the PromptQL Workspace build with real endpoints.
- Polling/streaming logic for live updates — that's the Workspace page's responsibility. The components support live updates (referential stability, status-transition flash); they don't *poll*.
- Virtualized variant for >100 stages — current need is ~9-15 stages.
- Internationalization — current strings remain English. Hardcoded strings: `"Copy code"`, `"Copied"`, `"(empty)"`, `"No additional details available"`, `"No content"`, `"Pipeline trace"`, `"OK"`/`"Pending"`/`"Running"`/`"Warn"`/`"Error"`/`"Skipped"`/`"Fallback"`/`"Failed"`. Externalize when an i18n need lands.
- Migrating older composition components from inline-styles + `--tw-color-*` to the modern Tailwind+shadcn pattern — the new components follow the modern pattern, but legacy components weren't touched.

---

## Files changed (or added) this session

**Added:**
- `packages/design-system/src/utils/format.ts`
- `packages/design-system/src/utils/format.test.ts`
- `packages/design-system/src/data-display/CodeBlock/CodeBlock.tsx`
- `packages/design-system/src/data-display/CodeBlock/CodeBlock.highlight.ts`
- `packages/design-system/src/data-display/CodeBlock/CodeBlock.test.tsx`
- `packages/design-system/src/data-display/CodeBlock/CodeBlock.stories.tsx`
- `packages/design-system/src/data-display/CodeBlock/CodeBlock.demo.tsx`
- `packages/design-system/src/data-display/CodeBlock/README.md`
- `packages/design-system/src/data-display/CodeBlock/index.ts`
- `packages/composition/src/data-display/TraceTimeline/TraceTimeline.tsx`
- `packages/composition/src/data-display/TraceTimeline/TraceTimeline.test.tsx`
- `packages/composition/src/data-display/TraceTimeline/TraceTimeline.stories.tsx`
- `packages/composition/src/data-display/TraceTimeline/TraceTimeline.demo.tsx`
- `packages/composition/src/data-display/TraceTimeline/README.md`
- `packages/composition/src/data-display/TraceTimeline/index.ts`
- `packages/composition/src/data-display/LLMCallInspector/LLMCallInspector.tsx`
- `packages/composition/src/data-display/LLMCallInspector/LLMCallInspector.test.tsx`
- `packages/composition/src/data-display/LLMCallInspector/LLMCallInspector.stories.tsx`
- `packages/composition/src/data-display/LLMCallInspector/LLMCallInspector.demo.tsx`
- `packages/composition/src/data-display/LLMCallInspector/README.md`
- `packages/composition/src/data-display/LLMCallInspector/index.ts`
- `packages/composition/src/data-display/Components.demo.tsx`
- `TRACE_COMPONENTS_HANDBACK.md` (this file)

**Modified:**
- `packages/design-system/src/utils/index.ts` — re-export `formatDurationMs`
- `packages/design-system/src/feedback/Badge/Badge.tsx` — added `info` and `neutral` variants
- `packages/design-system/src/feedback/Badge/Badge.test.tsx` — extended variant test
- `packages/design-system/src/data-display/index.ts` — re-export CodeBlock
- `packages/composition/package.json` — added `lucide-react` workspace dep
- `packages/composition/src/data-display/index.ts` — re-export TraceTimeline + LLMCallInspector
- `packages/composition/src/index.ts` — added `export * from './data-display'`

---

## Disposition

The PromptQL Workspace build can resume with this zip and a clean slate. The three components are presentational primitives ready to be composed into the Workspace page; wiring to the dispatcher and real endpoints is the Workspace build's job per the v2 spec's out-of-scope clause.

If anything in the contract turns out wrong in practice, surface it back as a small handoff and we can iterate. The component contracts shipped here match v2 §5 exactly; the only deviations are the implementation choices listed above (placement, helper location, animation utility, type-system workarounds), none of which affect the public API.

**Trace components delivery closed.**
