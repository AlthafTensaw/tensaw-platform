# TraceTimeline

Vertical timeline of pipeline stages — each one a node in an executing pipeline (compiler, build, AI agent, ETL workflow) — with status, duration, a one-line summary, and an expandable details panel. Designed to update live: when the parent re-renders with new stage data, completed stages stay completed and a transitioning stage flashes briefly.

## Usage

```tsx
import { TraceTimeline, type TraceStageData } from '@tensaw/composition/data-display';
import { ReadOnlyFieldGrid } from '@tensaw/visualization/display';

const stages: TraceStageData[] = [
  {
    id: 'classify_turn',
    label: 'Classify Turn',
    technicalName: 'classify_turn',
    status: 'ok',
    durationMs: 42,
    summary: 'Heuristic match: report (confidence 0.92)',
    details: (
      <ReadOnlyFieldGrid
        fields={[
          { label: 'turn_type', value: 'report' },
          { label: 'confidence', value: '0.92' },
        ]}
      />
    ),
  },
  // ... more stages
];

<TraceTimeline stages={stages} autoExpandErrors />
```

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `stages` | `TraceStageData[]` | (required) | Render order matches array order. |
| `expandedIds` | `string[]` | — | Controlled expansion. When supplied, parent owns state; toggling fires `onExpandedChange`. |
| `defaultExpandedIds` | `string[]` | `[]` | Uncontrolled initial expansion. Ignored if `expandedIds` is provided. |
| `onExpandedChange` | `(ids: string[]) => void` | — | Fires when the user toggles a stage. In controlled mode, parent must apply the change. |
| `autoExpandErrors` | `boolean` | `true` | Stages with status `error` or `warn` open on first render. Sticky — once auto-expanded, the user can collapse manually. |
| `animateRunning` | `boolean` | `true` | Pulses the running-stage circle border. |
| `aria-label` | `string` | `"Pipeline trace"` | Accessible name on the root `<ol>`. |
| `className` | `string` | — | Class merge on the root list. |

### `TraceStageData`

```ts
interface TraceStageData {
  id: string;                   // stable, required
  label: string;                // human-readable
  technicalName?: string;       // mono, optional
  status: TraceStageStatus;     // see below
  durationMs?: number | null;   // null = not yet completed
  summary?: string;             // one-line
  details?: React.ReactNode;    // expanded panel
  startedAt?: string;           // ISO; consumer-only display hint
  completedAt?: string | null;
}

type TraceStageStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'warn'
  | 'error'
  | 'skipped';
```

## Status visuals

| Status | Dot | Badge | Summary color |
|---|---|---|---|
| `pending` | thin gray ring, empty | `Pending` (neutral) | muted |
| `running` | teal ring + breathing pulse, Spinner inside | `Running` (info) | italic muted |
| `ok` | filled teal, white CheckCircle2 | `OK` (success) | muted |
| `warn` | filled amber, white AlertTriangle | `Warn` (warning) | amber-700 |
| `error` | filled red, white XCircle | `Error` (error) | red-700 |
| `skipped` | dashed gray ring, MinusCircle | `Skipped` (neutral) | muted |

## Behaviors

**Controlled vs uncontrolled.** If `expandedIds` is provided, the component is fully controlled — it never mutates state internally; toggling fires `onExpandedChange(newIds)` and the parent must re-render. If only `defaultExpandedIds` is provided, the component manages expansion via internal `useState`. Auto-expanded errors flow into the internal state in uncontrolled mode; controlled parents handle that themselves.

**Auto-expand on errors.** Sticky. On first render and on each subsequent stages-reference change, error/warn stages get added to the expanded set if they haven't been auto-expanded yet. Once a user collapses an auto-expanded stage, it stays collapsed — we record the auto-expansion in a ref so the next render doesn't re-open it.

**Live update flash.** When a stage transitions from `running` to `ok`/`warn`/`error`, the row briefly highlights (`bg-teal-50/60`) for 600ms via CSS transition. A visually-hidden `aria-live="polite"` region announces the transition once (e.g. *"Classify Turn: ok in 42 milliseconds"*). Detection: a `useRef` carries the previous render's status; on transition, set a flag and clear it 600ms later.

**Keyboard.** Each stage row is a real `<button>`; Enter/Space toggles, Tab moves between buttons. The expanded panel is a `<div role="region">` with no inherent focus order — content inside receives natural focus.

## Accessibility

- Root: `<ol role="list" aria-label={ariaLabel}>` (uses `<ol>` because order is meaningful)
- Each stage: `<li role="listitem">`
- Expand button: `aria-expanded`, `aria-controls={`trace-stage-${id}-panel`}`
- Status circle: `aria-hidden="true"` (status is conveyed by the Badge text adjacent)
- Expanded panel: `id="trace-stage-${id}-panel"`, `role="region"`, `aria-label="${label} details"`
- Live announcements: `<span role="status" aria-live="polite" className="sr-only">` toggled in lockstep with the flash; throttled to terminal transitions only

## Related

- **`TimelineEntry`** in `@tensaw/visualization/display` — for **audit logs and historical events**, not pipeline traces. Different semantics: TimelineEntry has a `tone` (event category — neutral/success/warning/danger/info), no concept of `running`/`skipped`/expand-collapse/live updates. Borrowed the visual proportions; built fresh.
- **`Stepper`** in `@tensaw/design-system/navigation` — for **user-driven progression** (multi-step forms, wizards). TraceTimeline is for *observed execution* — the user watches; they don't drive it.
- **`LLMCallInspector`** in `@tensaw/composition/data-display` — natural payload for a stage's `details` when the stage made an LLM call.
- **`ReadOnlyFieldGrid`** in `@tensaw/visualization/display` — natural payload for `details` showing resolved parameters or extracted entities (key-value pairs).

## Anti-patterns

- ❌ **Don't use TraceTimeline as a generic stepper for forms or wizards.** Use `Stepper` from design-system instead. TraceTimeline is for *observed execution*, not user-driven progression.
- ❌ **Don't put interactive controls inside the Stage's top line.** The row click toggles expansion; nested clickable elements break that. Put any action buttons inside the expanded panel.
- ❌ **Don't force a re-mount on every poll cycle.** The component depends on referential stability of the `stages` array's stage objects to detect transitions. If you rebuild the array fresh each tick, the flash detection still works (status comparison via ref) but other optimizations may not. Pass new objects only for stages whose data actually changed.
- ❌ **Don't try to extend `TimelineEntry` to do this.** Different semantics. Build TraceTimeline as its own component and let TimelineEntry stay focused on audit logs.
- ❌ **Don't poll faster than ~250ms per refresh.** The flash animation is 600ms; sub-flash poll cycles will queue announcements that the user can't follow.
