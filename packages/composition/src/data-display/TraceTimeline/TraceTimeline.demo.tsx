/**
 * TraceTimeline — living-documentation demo.
 *
 * Renders every meaningful state the component supports, with realistic
 * data that matches the **actual** backend response shape from
 * `GET /api/promptql/runs/{run_id}/trace` (PromptQL v6 envelope; see
 * `PATCH_README.md` "Sample `GET /runs/{id}/trace` response").
 *
 * The downstream wiring session should read this file to understand:
 *   1. What the API response looks like (the `SampleTrace*` constants).
 *   2. How to map that response into the component's `TraceStageData[]` prop
 *      (the `mapBackendStages()` helper).
 *   3. Which scenarios the component handles (the labeled sections below).
 *
 * Drop into any page (no provider required) to see the demo render.
 */

import { TraceTimeline, type TraceStageData } from './TraceTimeline';
import { CodeBlock } from '@tensaw/design-system';

// ---------------------------------------------------------------------------
// Backend envelope types — exactly matches PromptQL v6 PATCH_README.md
// ---------------------------------------------------------------------------

/** Stage layer — compiler nodes (1-9) vs execution nodes (10-12). */
type StageLayer = 'compiler' | 'execution';

/** Backend status values from the `pql_run_stage.status` ENUM. */
type BackendStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'warn'
  | 'error'
  | 'skipped';

/** Per-stage LLM-call subset (nullable when the stage didn't call an LLM). */
interface BackendLlmCall {
  model: string;
  provider: string;
  status: 'ok' | 'failed' | 'fallback';
  duration_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  request: string;
  response: string;
  error: string | null;
}

/** One row of the `pql_run_stage` table as the API returns it. */
interface BackendStage {
  stage_id: number;
  stage_order: number;
  stage_key: string;
  stage_label: string;
  stage_layer: StageLayer;
  status: BackendStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  summary: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  llm_call: BackendLlmCall | null;
  warnings: string[];
  error_text: string | null;
}

/** Full response shape from `GET /api/promptql/runs/{run_id}/trace`. */
interface BackendTraceResponse {
  run_id: number;
  run_status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'clarification_required';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  /** 9 for clarification-required runs, 12 otherwise. */
  total_stages_expected: 9 | 12;
  stages: BackendStage[];
}

// ---------------------------------------------------------------------------
// Sample envelopes — one per scenario
// ---------------------------------------------------------------------------

/**
 * Stages 1-9 are compiler nodes; 10-12 are execution. Field order and
 * shape match `PATCH_README.md` line 231 verbatim.
 */
const STAGE_DEFINITIONS: {
  stage_order: number;
  stage_key: string;
  stage_label: string;
  stage_layer: StageLayer;
}[] = [
  { stage_order: 1, stage_key: 'classify_turn',             stage_label: 'Classify Turn',              stage_layer: 'compiler' },
  { stage_order: 2, stage_key: 'resolve_intent',            stage_label: 'Resolve Intent',             stage_layer: 'compiler' },
  { stage_order: 3, stage_key: 'select_recipe',             stage_label: 'Select Recipe',              stage_layer: 'compiler' },
  { stage_order: 4, stage_key: 'select_path',               stage_label: 'Select Path',                stage_layer: 'compiler' },
  { stage_order: 5, stage_key: 'extract_resolve_entities',  stage_label: 'Extract & Resolve Entities', stage_layer: 'compiler' },
  { stage_order: 6, stage_key: 'resolve_parameters',        stage_label: 'Resolve Parameters',         stage_layer: 'compiler' },
  { stage_order: 7, stage_key: 'clarification_policy',      stage_label: 'Clarification Policy',       stage_layer: 'compiler' },
  { stage_order: 8, stage_key: 'build_blueprint',           stage_label: 'Build Blueprint',            stage_layer: 'compiler' },
  { stage_order: 9, stage_key: 'validate_blueprint',        stage_label: 'Validate Blueprint',         stage_layer: 'compiler' },
  { stage_order: 10, stage_key: 'sql_generation',           stage_label: 'Generate SQL',               stage_layer: 'execution' },
  { stage_order: 11, stage_key: 'query_execution',          stage_label: 'Execute Query',              stage_layer: 'execution' },
  { stage_order: 12, stage_key: 'result_shaping',           stage_label: 'Shape Result',               stage_layer: 'execution' },
];

/**
 * Scenario 1: a fully-completed happy-path run.
 * All 12 stages ok. Realistic durations matching the canonical PromptQL
 * fixture in the v2 trace-components handoff §10.
 */
const SAMPLE_TRACE_COMPLETED: BackendTraceResponse = {
  run_id: 12345,
  run_status: 'completed',
  started_at: '2026-05-10T12:00:00.000Z',
  completed_at: '2026-05-10T12:00:01.230Z',
  duration_ms: 1230,
  total_stages_expected: 12,
  stages: [
    {
      stage_id: 90001, stage_order: 1, stage_key: 'classify_turn', stage_label: 'Classify Turn', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.001Z', completed_at: '2026-05-10T12:00:00.043Z', duration_ms: 42,
      summary: 'heuristic match: report (confidence 0.92)',
      input: { prompt_text: 'Show collections by month for client 99001 from January 2026 to March 2026' },
      output: { turn_type: 'report', confidence: 0.92, source: 'heuristic' },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90002, stage_order: 2, stage_key: 'resolve_intent', stage_label: 'Resolve Intent', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.044Z', completed_at: '2026-05-10T12:00:00.129Z', duration_ms: 85,
      summary: 'Family: collections (5 candidates)',
      input: { prompt_text: 'Show collections by month...' },
      output: {
        family_key: 'collections',
        recipe_candidates: [],
        metric_keys: ['collections_amount'],
        dimension_keys: ['month'],
        date_basis_key: 'payment_posted_date',
      },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90003, stage_order: 3, stage_key: 'select_recipe', stage_label: 'Select Recipe', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.230Z', completed_at: '2026-05-10T12:00:00.642Z', duration_ms: 412,
      summary: 'Matched collections_by_month v2 (confidence 0.91)',
      input: { prompt_text: 'Show collections...', family_key: 'collections' },
      output: {
        selected_recipe_key: 'collections_by_month',
        recipe_version: 2,
        confidence: 0.91,
        top_candidates: [
          { recipe_key: 'collections_by_month', version: 2, score: 0.84 },
          { recipe_key: 'payments_by_month', version: 1, score: 0.72 },
        ],
        needs_clarification: false,
      },
      llm_call: {
        model: 'gpt-4o-mini', provider: 'openai', status: 'ok', duration_ms: 387,
        prompt_tokens: 1247, completion_tokens: 87,
        request: "select_recipe(prompt='Show collections by month for client 99001 from January 2026 to March 2026', candidates=[{\"recipe_key\": \"collections_by_month\", \"score\": 0.84}, ...])",
        response: '{"recipe_key": "collections_by_month", "confidence": 0.91, "reasoning": "User asks for collections grouped by month — direct match"}',
        error: null,
      },
      warnings: [], error_text: null,
    },
    {
      stage_id: 90004, stage_order: 4, stage_key: 'select_path', stage_label: 'Select Path', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.643Z', completed_at: '2026-05-10T12:00:00.651Z', duration_ms: 8,
      summary: 'Path: recipe',
      input: { selected_recipe_key: 'collections_by_month' },
      output: { path_type: 'recipe', recipe_key: 'collections_by_month', recipe_version: 2 },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90005, stage_order: 5, stage_key: 'extract_resolve_entities', stage_label: 'Extract & Resolve Entities', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.652Z', completed_at: '2026-05-10T12:00:00.964Z', duration_ms: 312,
      summary: 'Resolved 1 entity, 0 unresolved',
      input: { prompt_text: 'Show collections...', recipe_key: 'collections_by_month' },
      output: {
        resolved: [{ entity_type: 'client', value: 99001, raw_text: 'client 99001' }],
        unresolved: [],
        date_range: { from: '2026-01-01', to: '2026-03-31' },
        date_basis_hint: 'payment_posted_date',
      },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90006, stage_order: 6, stage_key: 'resolve_parameters', stage_label: 'Resolve Parameters', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.965Z', completed_at: '2026-05-10T12:00:00.983Z', duration_ms: 18,
      summary: 'client_id=99001, date_range=2026-01-01..2026-03-31',
      input: { resolved: [{ entity_type: 'client', value: 99001 }] },
      output: {
        client_id: 99001,
        date_range: { from: '2026-01-01', to: '2026-03-31' },
        date_basis_key: 'payment_posted_date',
        grain: 'month',
        filters: [],
      },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90007, stage_order: 7, stage_key: 'clarification_policy', stage_label: 'Clarification Policy', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.984Z', completed_at: '2026-05-10T12:00:00.988Z', duration_ms: 4,
      summary: 'No clarification needed',
      input: { needs_clarification: false },
      output: { needs_clarification: false, questions: [] },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90008, stage_order: 8, stage_key: 'build_blueprint', stage_label: 'Build Blueprint', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:00.989Z', completed_at: '2026-05-10T12:00:01.020Z', duration_ms: 31,
      summary: 'Blueprint built (recipe v2)',
      input: { recipe_key: 'collections_by_month', recipe_version: 2 },
      output: {
        recipe_key: 'collections_by_month',
        recipe_version: 2,
        metrics: ['collections_amount'],
        dimensions: ['month'],
        grain: 'month',
        date_basis_key: 'payment_posted_date',
        client_id: 99001,
        sql_strategy: 'replica_collections_by_month',
        source_preference: 'replica',
      },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90009, stage_order: 9, stage_key: 'validate_blueprint', stage_label: 'Validate Blueprint', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:00:01.021Z', completed_at: '2026-05-10T12:00:01.033Z', duration_ms: 12,
      summary: 'Validation passed (0 warnings)',
      input: { recipe_key: 'collections_by_month' },
      output: { passed: true, errors: [], warnings: [] },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90010, stage_order: 10, stage_key: 'sql_generation', stage_label: 'Generate SQL', stage_layer: 'execution',
      status: 'ok', started_at: '2026-05-10T12:00:01.034Z', completed_at: '2026-05-10T12:00:01.043Z', duration_ms: 9,
      summary: 'SQL built via replica_collections_by_month strategy',
      input: { sql_strategy: 'replica_collections_by_month' },
      output: {
        sql: 'SELECT DATE_FORMAT(payment_posted_date, \'%Y-%m\') AS month, SUM(payment_amount) FROM fact_payments WHERE clinic_id = :client_id AND payment_posted_date BETWEEN :from_date AND :to_date GROUP BY 1 ORDER BY 1',
        bind_params: { client_id: 99001, from_date: '2026-01-01', to_date: '2026-03-31' },
      },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90011, stage_order: 11, stage_key: 'query_execution', stage_label: 'Execute Query', stage_layer: 'execution',
      status: 'ok', started_at: '2026-05-10T12:00:01.044Z', completed_at: '2026-05-10T12:00:01.231Z', duration_ms: 187,
      summary: '3 rows in 187ms',
      input: { sql: 'SELECT DATE_FORMAT...' },
      output: { row_count: 3, source: 'replica', latency_ms: 187 },
      llm_call: null, warnings: [], error_text: null,
    },
    {
      stage_id: 90012, stage_order: 12, stage_key: 'result_shaping', stage_label: 'Shape Result', stage_layer: 'execution',
      status: 'ok', started_at: '2026-05-10T12:00:01.232Z', completed_at: '2026-05-10T12:00:01.232Z', duration_ms: 0,
      summary: 'Columns reordered, formats applied',
      input: { row_count: 3 },
      output: { columns: ['month', 'total_collections'], rows_shaped: 3 },
      llm_call: null, warnings: [], error_text: null,
    },
  ],
};

/**
 * Scenario 2: in-flight run.
 * Stages 1–4 ok, stage 5 running, stages 6–12 pending. The component
 * pulses the running-stage circle and shows `—` for pending durations.
 */
const SAMPLE_TRACE_IN_FLIGHT: BackendTraceResponse = {
  run_id: 12346,
  run_status: 'running',
  started_at: '2026-05-10T12:05:00.000Z',
  completed_at: null,
  duration_ms: null,
  total_stages_expected: 12,
  stages: [
    ...SAMPLE_TRACE_COMPLETED.stages.slice(0, 4), // classify_turn → select_path ok
    {
      // extract_resolve_entities — running
      stage_id: 90105, stage_order: 5, stage_key: 'extract_resolve_entities', stage_label: 'Extract & Resolve Entities', stage_layer: 'compiler',
      status: 'running', started_at: '2026-05-10T12:05:00.652Z', completed_at: null, duration_ms: null,
      summary: null, input: { prompt_text: 'Show collections...' }, output: null, llm_call: null, warnings: [], error_text: null,
    },
    // Stages 6-12 pending — same definitions, no times yet
    ...STAGE_DEFINITIONS.slice(5).map((def) => ({
      ...def,
      stage_id: 90100 + def.stage_order,
      status: 'pending' as const,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      summary: null,
      input: null,
      output: null,
      llm_call: null,
      warnings: [],
      error_text: null,
    })),
  ],
};

/**
 * Scenario 3: run that hit clarification_required after stage 7.
 * Per backend semantics, `clarification_policy` ends ok-with-questions and
 * subsequent stages are recorded as `'skipped'` (not absent) so the UI
 * can show them with skipped styling. `total_stages_expected` becomes 9
 * (the compiler portion only — execution never runs).
 */
const SAMPLE_TRACE_CLARIFICATION: BackendTraceResponse = {
  run_id: 12347,
  run_status: 'clarification_required',
  started_at: '2026-05-10T12:10:00.000Z',
  completed_at: '2026-05-10T12:10:00.487Z',
  duration_ms: 487,
  total_stages_expected: 9,
  stages: [
    ...SAMPLE_TRACE_COMPLETED.stages.slice(0, 6), // stages 1-6 ok
    {
      // clarification_policy — needs_clarification true
      stage_id: 90207, stage_order: 7, stage_key: 'clarification_policy', stage_label: 'Clarification Policy', stage_layer: 'compiler',
      status: 'ok', started_at: '2026-05-10T12:10:00.480Z', completed_at: '2026-05-10T12:10:00.487Z', duration_ms: 7,
      summary: 'Tier 1 clarification required: select date basis (1 question)',
      input: { unresolved_params: ['date_basis'] },
      output: {
        needs_clarification: true,
        questions: [
          {
            question_text: 'Which date basis should be used?',
            options: ['payment_posted_date', 'date_of_service'],
            param_key: 'date_basis_key',
            tier: 1,
          },
        ],
      },
      llm_call: null, warnings: [], error_text: null,
    },
    // Stages 8-9 skipped (build_blueprint, validate_blueprint)
    ...STAGE_DEFINITIONS.slice(7, 9).map((def) => ({
      ...def,
      stage_id: 90200 + def.stage_order,
      status: 'skipped' as const,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      summary: null,
      input: null,
      output: null,
      llm_call: null,
      warnings: [],
      error_text: null,
    })),
  ],
};

/**
 * Scenario 4: a failed run.
 * Stage 3 (select_recipe) errors out — all LLM providers exhausted.
 * Subsequent stages skipped. The UI auto-expands error stages by default
 * so the user sees the diagnostic without clicking.
 */
const SAMPLE_TRACE_FAILED: BackendTraceResponse = {
  run_id: 12348,
  run_status: 'failed',
  started_at: '2026-05-10T12:15:00.000Z',
  completed_at: '2026-05-10T12:15:05.234Z',
  duration_ms: 5234,
  total_stages_expected: 12,
  stages: [
    ...SAMPLE_TRACE_COMPLETED.stages.slice(0, 2), // classify_turn, resolve_intent ok
    {
      // select_recipe — error
      stage_id: 90303, stage_order: 3, stage_key: 'select_recipe', stage_label: 'Select Recipe', stage_layer: 'compiler',
      status: 'error', started_at: '2026-05-10T12:15:00.230Z', completed_at: '2026-05-10T12:15:05.234Z', duration_ms: 5004,
      summary: 'All LLM providers exhausted',
      input: { prompt_text: 'Show me everything wibbly wobbly' },
      output: null,
      llm_call: {
        model: 'gpt-4o-mini', provider: 'openai', status: 'failed', duration_ms: 5000,
        prompt_tokens: 1247, completion_tokens: null,
        request: 'select_recipe(prompt=\'Show me everything wibbly wobbly\', candidates=[...])',
        response: '',
        error: 'openai: timeout after 2000ms; anthropic: 429 rate limit; gemini: connection refused',
      },
      warnings: [],
      error_text: 'All LLM providers exhausted. OpenAI: timeout. Anthropic: rate-limited. Gemini: connection refused.',
    },
    // Stages 4-12 skipped
    ...STAGE_DEFINITIONS.slice(3).map((def) => ({
      ...def,
      stage_id: 90300 + def.stage_order,
      status: 'skipped' as const,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      summary: null,
      input: null,
      output: null,
      llm_call: null,
      warnings: [],
      error_text: null,
    })),
  ],
};

/**
 * Scenario 5: run that completed with a `warn` on stage 9
 * (validate_blueprint). Non-fatal — execution still ran.
 */
const SAMPLE_TRACE_WITH_WARN: BackendTraceResponse = {
  ...SAMPLE_TRACE_COMPLETED,
  run_id: 12349,
  stages: SAMPLE_TRACE_COMPLETED.stages.map((s) =>
    s.stage_key === 'validate_blueprint'
      ? {
          ...s,
          status: 'warn' as const,
          summary: 'Validation passed (1 warning: param coercion applied)',
          warnings: ['param coercion: from_date "2026-01" → "2026-01-01"'],
        }
      : s,
  ),
};

// ---------------------------------------------------------------------------
// Backend → component mapper
// ---------------------------------------------------------------------------

/**
 * Map the backend `BackendStage[]` array into the component's
 * `TraceStageData[]` prop shape. This is what the wiring layer would do
 * with the response from `GET /api/promptql/runs/{id}/trace`.
 *
 * Naming differences resolved:
 *   - `stage_key`     → `id`
 *   - `stage_label`   → `label`
 *   - `stage_key`     → `technicalName` (shown mono next to label)
 *   - `duration_ms`   → `durationMs`
 *   - `started_at`    → `startedAt`
 *   - `completed_at`  → `completedAt`
 *   - `summary`/`error_text` → `summary` (error_text wins on `error` status)
 *
 * `details` is composed from `input`/`output`/`llm_call`/`warnings` — the
 * caller decides how to render them. Here we use a simple <CodeBlock> with
 * the JSON output as a reasonable default; the PromptQL Workspace build
 * will likely substitute a richer rendering (LLMCallInspector + a
 * ReadOnlyFieldGrid for input/output).
 */
function mapBackendStages(stages: BackendStage[]): TraceStageData[] {
  return stages.map((s) => {
    const summaryOrError =
      s.status === 'error' && s.error_text ? s.error_text : s.summary ?? undefined;

    return {
      id: s.stage_key,
      label: s.stage_label,
      technicalName: s.stage_key,
      status: s.status,
      durationMs: s.duration_ms,
      summary: summaryOrError,
      startedAt: s.started_at ?? undefined,
      completedAt: s.completed_at,
      details: renderStageDetails(s),
    };
  });
}

/**
 * Render the expanded-panel content for one stage. Real implementations
 * will compose this from richer components (LLMCallInspector for the
 * `llm_call` slot, ReadOnlyFieldGrid for `input`/`output` key-value
 * structures). This demo keeps it readable by JSON-stringifying.
 */
function renderStageDetails(s: BackendStage): React.ReactNode {
  if (!s.output && !s.llm_call && s.warnings.length === 0) return undefined;
  const payload = {
    ...(s.input ? { input: s.input } : {}),
    ...(s.output ? { output: s.output } : {}),
    ...(s.llm_call ? { llm_call: s.llm_call } : {}),
    ...(s.warnings.length > 0 ? { warnings: s.warnings } : {}),
  };
  return <CodeBlock language="json">{JSON.stringify(payload, null, 2)}</CodeBlock>;
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 13,
            color: 'var(--muted-foreground, #6B7280)',
          }}
        >
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Demo page
// ---------------------------------------------------------------------------

export default function TraceTimelineDemo() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>
        TraceTimeline — demo
      </h2>
      <p
        style={{
          margin: '0 0 24px',
          fontSize: 14,
          color: 'var(--muted-foreground, #6B7280)',
        }}
      >
        Live reference for <code>{'<TraceTimeline>'}</code>. Each section
        shows a different run scenario; data shape matches the PromptQL v6
        backend's <code>GET /api/promptql/runs/{'{run_id}'}/trace</code>{' '}
        envelope verbatim. See the <code>mapBackendStages()</code> helper at
        the bottom of this file for the response → component mapping.
      </p>

      <Section
        title="1. Completed run (happy path)"
        description="All 12 stages ok. run_status=completed. Compiler stages 1-9 + execution 10-12. Auto-expansion off; click any row to inspect its `details` panel (input/output/llm_call JSON)."
      >
        <TraceTimeline
          stages={mapBackendStages(SAMPLE_TRACE_COMPLETED.stages)}
          autoExpandErrors={false}
        />
      </Section>

      <Section
        title="2. In-flight run (live mid-pipeline)"
        description="Stages 1-4 ok, stage 5 running, stages 6-12 pending. The running stage breathes via animate-pulse; pending stages show `—` for duration. This is what the user sees during live polling."
      >
        <TraceTimeline
          stages={mapBackendStages(SAMPLE_TRACE_IN_FLIGHT.stages)}
          autoExpandErrors={false}
        />
      </Section>

      <Section
        title="3. Clarification required (after stage 7)"
        description="Stages 1-7 ok; clarification_policy returns needs_clarification=true with one Tier-1 question. Stages 8-9 recorded as skipped (build_blueprint, validate_blueprint). total_stages_expected drops from 12 to 9 — the execution layer never runs. The clarification stage's expanded details show the question payload."
      >
        <TraceTimeline
          stages={mapBackendStages(SAMPLE_TRACE_CLARIFICATION.stages)}
          defaultExpandedIds={['clarification_policy']}
        />
      </Section>

      <Section
        title="4. Failed run (error at stage 3)"
        description="select_recipe errored — all LLM providers exhausted. Stages 4-12 recorded as skipped. autoExpandErrors=true (the default) opens the error stage on mount so the user sees the diagnostic without clicking. error_text replaces the normal summary."
      >
        <TraceTimeline
          stages={mapBackendStages(SAMPLE_TRACE_FAILED.stages)}
          autoExpandErrors
        />
      </Section>

      <Section
        title="5. Completed run with warn"
        description="All stages ran; validate_blueprint flagged a non-fatal coercion. Run still completed successfully — warn is for informational diagnostics, not failures. autoExpandErrors opens the warn stage on mount."
      >
        <TraceTimeline
          stages={mapBackendStages(SAMPLE_TRACE_WITH_WARN.stages)}
          autoExpandErrors
        />
      </Section>

      <Section
        title="6. Empty state"
        description='Pre-v6 runs (no `pql_run_stage` rows) and freshly-created runs return `stages: []`. The component renders an empty list with the aria-label still set on the root <ol>. Callers should render an EmptyState above the timeline when stages.length === 0.'
      >
        {SAMPLE_TRACE_COMPLETED.stages.length > 0 ? (
          // Demonstrating the empty array behavior.
          <TraceTimeline stages={[]} aria-label="Empty trace" />
        ) : null}
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: 'var(--muted-foreground, #6B7280)',
          }}
        >
          ↑ Above renders nothing — the component is well-behaved on empty input
          but callers must provide their own empty-state messaging.
        </p>
      </Section>

      <Section
        title="7. Loading / skeleton state"
        description="The component itself has no loading state; while the API request is in flight, render a TraceTimeline with all stages at status='pending' (or 12 dummy stages with the canonical stage_keys). This is also what total_stages_expected enables — render placeholders for not-yet-returned stages."
      >
        <TraceTimeline
          stages={STAGE_DEFINITIONS.map((def) => ({
            id: def.stage_key,
            label: def.stage_label,
            technicalName: def.stage_key,
            status: 'pending',
            durationMs: null,
          }))}
          autoExpandErrors={false}
        />
      </Section>

      <Section
        title="8. Controlled expansion"
        description="Pass `expandedIds` for full control; the component does not mutate state internally. Useful for sync'ing expansion across multiple instances or persisting to URL state. The parent must apply the change via `onExpandedChange`."
      >
        <TraceTimeline
          stages={mapBackendStages(SAMPLE_TRACE_COMPLETED.stages)}
          expandedIds={['classify_turn', 'select_recipe']}
          onExpandedChange={() => {
            /* In real apps: setExpandedIds(next); demo is read-only. */
          }}
          autoExpandErrors={false}
        />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports for downstream sessions to reuse the fixtures + mapper
// ---------------------------------------------------------------------------

export {
  SAMPLE_TRACE_COMPLETED,
  SAMPLE_TRACE_IN_FLIGHT,
  SAMPLE_TRACE_CLARIFICATION,
  SAMPLE_TRACE_FAILED,
  SAMPLE_TRACE_WITH_WARN,
  STAGE_DEFINITIONS,
  mapBackendStages,
  type BackendTraceResponse,
  type BackendStage,
  type BackendLlmCall,
};
