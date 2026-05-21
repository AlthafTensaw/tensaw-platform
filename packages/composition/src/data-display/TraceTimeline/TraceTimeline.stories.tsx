import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ReadOnlyFieldGrid } from '@tensaw/visualization/display';

import { TraceTimeline, type TraceStageData } from './TraceTimeline';

const meta = {
  title: 'Data Display/TraceTimeline',
  component: TraceTimeline,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof TraceTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Canonical PromptQL pipeline fixtures
// ---------------------------------------------------------------------------

/** All-pending state — what the user sees at the moment a query is submitted. */
const PENDING_STAGES: TraceStageData[] = [
  { id: 'classify_turn', label: 'Classify Turn', technicalName: 'classify_turn', status: 'pending' },
  { id: 'resolve_intent', label: 'Resolve Intent', technicalName: 'resolve_intent', status: 'pending' },
  { id: 'select_recipe', label: 'Select Recipe', technicalName: 'select_recipe', status: 'pending' },
  { id: 'select_path', label: 'Select Path', technicalName: 'select_path', status: 'pending' },
  { id: 'extract_resolve_entities', label: 'Extract & Resolve Entities', technicalName: 'extract_and_resolve_entities', status: 'pending' },
  { id: 'resolve_parameters', label: 'Resolve Parameters', technicalName: 'resolve_parameters', status: 'pending' },
  { id: 'clarification_policy', label: 'Clarification Policy', technicalName: 'clarification_policy', status: 'pending' },
  { id: 'build_blueprint', label: 'Build Blueprint', technicalName: 'build_blueprint', status: 'pending' },
  { id: 'validate_blueprint', label: 'Validate Blueprint', technicalName: 'validate_blueprint', status: 'pending' },
];

/** First few completed, fourth running — the live mid-flight look. */
const SOME_RUNNING_STAGES: TraceStageData[] = [
  {
    id: 'classify_turn',
    label: 'Classify Turn',
    technicalName: 'classify_turn',
    status: 'ok',
    durationMs: 42,
    summary: 'Heuristic match: report (confidence 0.92)',
  },
  {
    id: 'resolve_intent',
    label: 'Resolve Intent',
    technicalName: 'resolve_intent',
    status: 'ok',
    durationMs: 86,
    summary: 'Family: collections (5 candidates)',
  },
  {
    id: 'select_recipe',
    label: 'Select Recipe',
    technicalName: 'select_recipe',
    status: 'ok',
    durationMs: 312,
    summary: 'Matched collections_by_month (embedding 0.71, LLM 0.93)',
  },
  {
    id: 'select_path',
    label: 'Select Path',
    technicalName: 'select_path',
    status: 'running',
    durationMs: null,
  },
  { id: 'extract_resolve_entities', label: 'Extract & Resolve Entities', technicalName: 'extract_and_resolve_entities', status: 'pending' },
  { id: 'resolve_parameters', label: 'Resolve Parameters', technicalName: 'resolve_parameters', status: 'pending' },
];

/** All complete — happy path. */
const ALL_OK_STAGES: TraceStageData[] = [
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
          { label: 'matched_pattern', value: '^show|give me|list' },
        ]}
      />
    ),
  },
  {
    id: 'resolve_intent',
    label: 'Resolve Intent',
    technicalName: 'resolve_intent',
    status: 'ok',
    durationMs: 86,
    summary: 'Family: collections (5 candidates)',
  },
  {
    id: 'select_recipe',
    label: 'Select Recipe',
    technicalName: 'select_recipe',
    status: 'ok',
    durationMs: 412,
    summary: 'Matched collections_by_month (embedding 0.71, LLM 0.93)',
  },
  {
    id: 'select_path',
    label: 'Select Path',
    technicalName: 'select_path',
    status: 'ok',
    durationMs: 9,
    summary: 'Path: recipe',
  },
  {
    id: 'extract_resolve_entities',
    label: 'Extract & Resolve Entities',
    technicalName: 'extract_and_resolve_entities',
    status: 'ok',
    durationMs: 412,
    summary: 'Resolved 3 entities in 412ms',
  },
  {
    id: 'resolve_parameters',
    label: 'Resolve Parameters',
    technicalName: 'resolve_parameters',
    status: 'ok',
    durationMs: 18,
    summary: 'client_id=70014, date_range=2026-03-01..2026-03-31',
    details: (
      <ReadOnlyFieldGrid
        fields={[
          { label: 'client_id', value: '70014' },
          { label: 'date_range', value: '2026-03-01..2026-03-31' },
          { label: 'grain', value: 'month' },
        ]}
      />
    ),
  },
  {
    id: 'clarification_policy',
    label: 'Clarification Policy',
    technicalName: 'clarification_policy',
    status: 'ok',
    durationMs: 4,
    summary: 'No clarification needed',
  },
  {
    id: 'build_blueprint',
    label: 'Build Blueprint',
    technicalName: 'build_blueprint',
    status: 'ok',
    durationMs: 31,
    summary: 'Blueprint built (recipe v2)',
  },
  {
    id: 'validate_blueprint',
    label: 'Validate Blueprint',
    technicalName: 'validate_blueprint',
    status: 'ok',
    durationMs: 12,
    summary: 'Validation passed (0 warnings)',
  },
];

/** Run that produced a warning at validate. */
const WITH_WARNING_STAGES: TraceStageData[] = ALL_OK_STAGES.map((s) =>
  s.id === 'validate_blueprint'
    ? {
        ...s,
        status: 'warn' as const,
        summary: 'Validation passed (1 warning: param coercion applied)',
      }
    : s,
);

/** Run that errored mid-pipeline; subsequent stages skipped. */
const WITH_ERROR_STAGES: TraceStageData[] = [
  ALL_OK_STAGES[0]!,
  ALL_OK_STAGES[1]!,
  ALL_OK_STAGES[2]!,
  ALL_OK_STAGES[3]!,
  {
    id: 'extract_resolve_entities',
    label: 'Extract & Resolve Entities',
    technicalName: 'extract_and_resolve_entities',
    status: 'error',
    durationMs: 287,
    summary: 'Entity resolution failed: clinic name "ABC Cardio" not found',
    details: (
      <ReadOnlyFieldGrid
        fields={[
          { label: 'error_code', value: 'ENTITY_NOT_FOUND' },
          { label: 'unresolved_text', value: 'ABC Cardio' },
          { label: 'attempted_resolutions', value: '12' },
        ]}
      />
    ),
  },
  {
    id: 'resolve_parameters',
    label: 'Resolve Parameters',
    technicalName: 'resolve_parameters',
    status: 'skipped',
  },
  {
    id: 'clarification_policy',
    label: 'Clarification Policy',
    technicalName: 'clarification_policy',
    status: 'skipped',
  },
  { id: 'build_blueprint', label: 'Build Blueprint', technicalName: 'build_blueprint', status: 'skipped' },
  { id: 'validate_blueprint', label: 'Validate Blueprint', technicalName: 'validate_blueprint', status: 'skipped' },
];

/** Run halted on a Tier-1 clarification. */
const WITH_CLARIFICATION_STAGES: TraceStageData[] = [
  ALL_OK_STAGES[0]!,
  ALL_OK_STAGES[1]!,
  ALL_OK_STAGES[2]!,
  ALL_OK_STAGES[3]!,
  ALL_OK_STAGES[4]!,
  ALL_OK_STAGES[5]!,
  {
    id: 'clarification_policy',
    label: 'Clarification Policy',
    technicalName: 'clarification_policy',
    status: 'warn',
    durationMs: 6,
    summary: 'Tier 1 clarification required: select date basis',
  },
  { id: 'build_blueprint', label: 'Build Blueprint', technicalName: 'build_blueprint', status: 'skipped' },
  { id: 'validate_blueprint', label: 'Validate Blueprint', technicalName: 'validate_blueprint', status: 'skipped' },
];

/** Unmatched-prompt fallback path. */
const WITH_FALLBACK_STAGES: TraceStageData[] = ALL_OK_STAGES.map((s) => {
  if (s.id === 'select_recipe') {
    return {
      ...s,
      status: 'warn' as const,
      summary: 'No recipe match — routing to fallback path',
    };
  }
  if (s.id === 'validate_blueprint') {
    return {
      ...s,
      status: 'warn' as const,
      summary: 'Result unverified — fallback path produced unbound output',
    };
  }
  return s;
});

const NO_SUMMARY_STAGES: TraceStageData[] = [
  { id: 'a', label: 'Classify Turn', status: 'ok', durationMs: 42 },
  { id: 'b', label: 'Resolve Intent', status: 'ok', durationMs: 86 },
  { id: 'c', label: 'Select Recipe', status: 'running', durationMs: null },
];

const LONG_SUMMARY_STAGES: TraceStageData[] = [
  {
    id: 'a',
    label: 'Resolve Parameters',
    status: 'ok',
    durationMs: 18,
    summary:
      'Resolved client_id=70014 (ABC Cardiology), date_range=2026-03-01..2026-03-31 (calendar quarter), grain=month, payer_id=ALL, billing_provider_id=NULL (omitted by user, default applied), service_type=ALL (omitted by user, default applied), include_voided=false',
  },
];

const MANY_STAGES: TraceStageData[] = Array.from({ length: 25 }, (_, i) => ({
  id: `stage-${i}`,
  label: `Stage ${i + 1}`,
  technicalName: `stage_${i + 1}`,
  status: i < 12 ? 'ok' : i === 12 ? 'running' : 'pending',
  durationMs: i < 12 ? 30 + i * 17 : null,
  summary: i < 12 ? `Stage ${i + 1} completed normally.` : undefined,
}));

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: { stages: PENDING_STAGES },
};

export const SomeRunning: Story = {
  args: { stages: SOME_RUNNING_STAGES },
};

export const AllOk: Story = {
  args: { stages: ALL_OK_STAGES },
};

export const WithWarning: Story = {
  args: { stages: WITH_WARNING_STAGES },
};

export const WithError: Story = {
  args: { stages: WITH_ERROR_STAGES },
};

export const WithClarification: Story = {
  args: { stages: WITH_CLARIFICATION_STAGES },
};

export const WithFallback: Story = {
  args: { stages: WITH_FALLBACK_STAGES },
};

export const Controlled: Story = {
  render: () => {
    const [expanded, setExpanded] = useState<string[]>(['classify_turn']);
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Currently expanded:{' '}
          <span className="font-mono">{JSON.stringify(expanded)}</span>
        </div>
        <TraceTimeline
          stages={ALL_OK_STAGES}
          expandedIds={expanded}
          onExpandedChange={setExpanded}
          autoExpandErrors={false}
        />
      </div>
    );
  },
};

export const NoSummaries: Story = {
  args: { stages: NO_SUMMARY_STAGES },
};

export const LongSummary: Story = {
  args: { stages: LONG_SUMMARY_STAGES },
};

export const ManyStages: Story = {
  args: { stages: MANY_STAGES },
};

export const LiveSimulation: Story = {
  render: () => {
    const [tick, setTick] = useState(0);
    const [running, setRunning] = useState(false);

    useEffect(() => {
      if (!running) return undefined;
      const id = setInterval(() => {
        setTick((t) => Math.min(t + 1, ALL_OK_STAGES.length));
      }, 800);
      return () => {
        clearInterval(id);
      };
    }, [running]);

    const stages: TraceStageData[] = ALL_OK_STAGES.map((s, i) => {
      if (i < tick) return s;
      if (i === tick && running) {
        return { ...s, status: 'running', durationMs: null, summary: undefined };
      }
      return { ...s, status: 'pending', durationMs: undefined, summary: undefined };
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTick(0);
              setRunning(true);
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            Pause
          </button>
          <span className="text-sm text-muted-foreground">
            tick: {tick} / {ALL_OK_STAGES.length}
          </span>
        </div>
        <TraceTimeline stages={stages} />
      </div>
    );
  },
};
