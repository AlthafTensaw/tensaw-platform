/**
 * Components.demo.tsx — combined demo aggregator.
 *
 * Single drop-in entry point that renders all three new trace-related
 * components' demos stacked. Open this in any page and you get a full
 * tour of CodeBlock, TraceTimeline, and LLMCallInspector in one view.
 *
 * The component demos are co-located with each component:
 *   - packages/design-system/src/data-display/CodeBlock/CodeBlock.demo.tsx
 *   - packages/composition/src/data-display/TraceTimeline/TraceTimeline.demo.tsx
 *   - packages/composition/src/data-display/LLMCallInspector/LLMCallInspector.demo.tsx
 *
 * Drop into any page:
 *   import ComponentsDemo from '@tensaw/composition/src/data-display/Components.demo';
 *   <ComponentsDemo />
 *
 * Each child demo is a default export wrapped in its own padded container —
 * the aggregator just stacks them with a divider between.
 */

// Cross-package source imports are allowed in this monorepo because every
// workspace package's `main` points to `./src/index.ts` (no build step
// needed between them). For demos we import the file directly rather than
// going through the package barrel — demos aren't part of the public API.
import CodeBlockDemo from '../../../design-system/src/data-display/CodeBlock/CodeBlock.demo';
import TraceTimelineDemo from './TraceTimeline/TraceTimeline.demo';
import LLMCallInspectorDemo from './LLMCallInspector/LLMCallInspector.demo';

function Divider() {
  return (
    <div
      style={{
        margin: '48px 0',
        height: 1,
        background: 'var(--border, #E5E7EB)',
      }}
    />
  );
}

export default function ComponentsDemo() {
  return (
    <div>
      <header
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '32px 24px 16px',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>
          PromptQL trace components — combined demo
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--muted-foreground, #6B7280)',
          }}
        >
          Living documentation for the three trace components shipped in this
          revision: <code>CodeBlock</code>, <code>TraceTimeline</code>,{' '}
          <code>LLMCallInspector</code>. Each demo below is a self-contained
          file (<code>{'<Component>.demo.tsx'}</code>) co-located with the
          component source. All sample data matches the PromptQL v6 backend's{' '}
          <code>GET /api/promptql/runs/{'{run_id}'}/trace</code> envelope
          shape — see <code>TraceTimeline.demo.tsx</code> for the type
          definitions and the response → component mapping helper.
        </p>
      </header>

      <CodeBlockDemo />

      <Divider />

      <TraceTimelineDemo />

      <Divider />

      <LLMCallInspectorDemo />
    </div>
  );
}
