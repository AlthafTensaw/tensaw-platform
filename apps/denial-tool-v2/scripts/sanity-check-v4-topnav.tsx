/**
 * Runtime smoke for the P1.4 TopNav components.
 *
 * Renders each component to HTML via react-dom/server and asserts on the
 * output. Covers:
 *   - NeedsMyReviewBadge: shows/hides based on count, caps at 99+, a11y label
 *   - MyTasksLink: href includes the personal queue id
 *   - QueueSwitcher: trigger label reflects active queue; closed by default
 *   - TopNav: composes everything; Cost link conditional on canViewCost
 *
 * Tradeoffs: SSR doesn't run useEffect (so click-outside hook doesn't fire)
 * and useState resets on each render — so we can't easily test the OPEN
 * dropdown state via renderToString. That coverage is left for the formal
 * test suite in P1.13 (jsdom + @testing-library/react).
 *
 * Run with: npx tsx scripts/sanity-check-v4-topnav.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

// Mock helpers from the stub
import { __setQueryMock, __resetMocks } from '../stubs/tensaw/actions';

import { NeedsMyReviewBadge } from '../src/components/nav/NeedsMyReviewBadge';
import { MyTasksLink } from '../src/components/nav/MyTasksLink';
import { QueueSwitcher } from '../src/components/nav/QueueSwitcher';
import { TopNav } from '../src/components/nav/TopNav';
import { BrandLogo } from '../src/components/nav/BrandLogo';
import { UserMenuStub } from '../src/components/nav/UserMenuStub';

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ ${label}`);
    console.log(`    ${msg}`);
    failed++;
  }
}

function expectIncludes(html: string, needle: string): void {
  if (!html.includes(needle)) {
    throw new Error(`HTML did not include "${needle}"\n  full HTML: ${html.slice(0, 500)}`);
  }
}

function expectExcludes(html: string, needle: string): void {
  if (html.includes(needle)) {
    throw new Error(`HTML unexpectedly included "${needle}"`);
  }
}

// ============================================================================
// Fixtures
// ============================================================================

const sevenQueues = [
  { queue_id: 'denial_intake_analyst_primrose', queue_label: 'Denial Intake — Primrose', queue_type: 'team' as const, is_default_for_caller: true, pending_count: 6 },
  { queue_id: 'coding_primrose', queue_label: 'Coding partner — Primrose', queue_type: 'team' as const, is_default_for_caller: false, pending_count: 1 },
  { queue_id: 'resolution_primrose', queue_label: 'Resolution — Primrose', queue_type: 'team' as const, is_default_for_caller: false, pending_count: 2 },
  { queue_id: 'am_review_primrose', queue_label: 'AM Review — Primrose', queue_type: 'team' as const, is_default_for_caller: false, pending_count: 0 },
  { queue_id: 'posting_primrose', queue_label: 'Posting — Primrose', queue_type: 'team' as const, is_default_for_caller: false, pending_count: 0 },
  { queue_id: 'high_dollar_oversight_primrose', queue_label: 'High-Dollar Desk — Primrose', queue_type: 'team' as const, is_default_for_caller: false, pending_count: 2 },
  { queue_id: 'user_42', queue_label: 'My personal queue', queue_type: 'personal' as const, is_default_for_caller: false, pending_count: 3 },
];

// ============================================================================
// BrandLogo + UserMenuStub (smoke)
// ============================================================================

console.log('=== BrandLogo / UserMenuStub ===');

check('BrandLogo renders the wordmark', () => {
  __resetMocks();
  const html = renderToString(createElement(BrandLogo));
  expectIncludes(html, 'Denial Analyst Tool');
  expectIncludes(html, 'href="/"');
});

check('UserMenuStub renders the user initial + name', () => {
  const html = renderToString(createElement(UserMenuStub, { userName: 'Vipin K.' }));
  expectIncludes(html, '>V<');     // the initial
  expectIncludes(html, 'Vipin K.'); // the name
});

// ============================================================================
// NeedsMyReviewBadge
// ============================================================================

console.log('\n=== NeedsMyReviewBadge ===');

check('renders nothing when explicit count is 0', () => {
  __resetMocks();
  const html = renderToString(createElement(NeedsMyReviewBadge, { count: 0 }));
  if (html.length !== 0 && html !== '<!-- -->') {
    throw new Error(`expected empty render, got: ${html}`);
  }
});

check('renders the count when explicit count is 3', () => {
  const html = renderToString(createElement(NeedsMyReviewBadge, { count: 3 }));
  expectIncludes(html, '>3<');
  expectIncludes(html, 'bg-red-500');
  expectIncludes(html, 'aria-label="3 tasks waiting for your review"');
});

check('singular a11y label for count of 1', () => {
  const html = renderToString(createElement(NeedsMyReviewBadge, { count: 1 }));
  expectIncludes(html, 'aria-label="1 task waiting for your review"');
});

check('caps display at 99+ when count exceeds 99', () => {
  const html = renderToString(createElement(NeedsMyReviewBadge, { count: 145 }));
  expectIncludes(html, '99+');
});

check('reads from queue.list when no explicit count given', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(createElement(NeedsMyReviewBadge));
  expectIncludes(html, '>3<'); // user_42 has pending_count=3
});

check('shows nothing when personal queue has pending_count=0', () => {
  __setQueryMock('queue.list', {
    queues: sevenQueues.map((q) =>
      q.queue_type === 'personal' ? { ...q, pending_count: 0 } : q,
    ),
  });
  const html = renderToString(createElement(NeedsMyReviewBadge));
  if (html.length !== 0 && html !== '<!-- -->') {
    throw new Error(`expected empty render when count=0, got: ${html}`);
  }
});

// ============================================================================
// MyTasksLink
// ============================================================================

console.log('\n=== MyTasksLink ===');

check('href includes personal queue id from queue.list', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(createElement(MyTasksLink));
  expectIncludes(html, 'href="/inbox?queue=user_42"');
  expectIncludes(html, 'My tasks');
});

check('embedded badge shows count=3', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(createElement(MyTasksLink));
  expectIncludes(html, '>3<');
});

check('falls back to /inbox when no personal queue in list', () => {
  __setQueryMock('queue.list', {
    queues: sevenQueues.filter((q) => q.queue_type !== 'personal'),
  });
  const html = renderToString(createElement(MyTasksLink));
  expectIncludes(html, 'href="/inbox"');
});

// ============================================================================
// QueueSwitcher
// ============================================================================

console.log('\n=== QueueSwitcher ===');

check('trigger renders default queue label when no URL param', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(createElement(QueueSwitcher));
  // Default queue is denial_intake_analyst_primrose
  expectIncludes(html, 'Denial Intake — Primrose');
  // Trigger has chevron + aria-expanded=false (dropdown closed)
  expectIncludes(html, 'aria-expanded="false"');
  expectIncludes(html, 'aria-haspopup="listbox"');
});

check('renders Loading state when queue.list has no data', () => {
  __resetMocks();
  const html = renderToString(createElement(QueueSwitcher));
  expectIncludes(html, 'Loading queues');
});

check('does NOT render the dropdown panel by default (closed)', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(createElement(QueueSwitcher));
  // None of the non-active queue labels should appear (only the active one
  // in the trigger button)
  expectExcludes(html, 'Resolution — Primrose');
  expectExcludes(html, 'High-Dollar Desk — Primrose');
  expectExcludes(html, 'role="listbox"');
});

// ============================================================================
// TopNav (composition)
// ============================================================================

console.log('\n=== TopNav (composed) ===');

check('renders brand + queue switcher + my tasks (canViewCost=false)', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: false }),
  );
  expectIncludes(html, 'Denial Analyst Tool');     // brand
  expectIncludes(html, 'Denial Intake — Primrose'); // active queue
  expectIncludes(html, 'My tasks');                 // link
  expectIncludes(html, 'Vipin K.');                 // user menu
});

check('Cost link hidden when canViewCost=false', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: false }),
  );
  expectExcludes(html, '>Cost<');
});

check('Cost link visible when canViewCost=true', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(
    createElement(TopNav, { userName: 'Renita K.', canViewCost: true }),
  );
  expectIncludes(html, '>Cost<');
  expectIncludes(html, 'href="/cost"');
  expectIncludes(html, 'Renita K.');
});

check('sticky positioning + dark background classes present', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: false }),
  );
  expectIncludes(html, 'sticky');
  expectIncludes(html, 'bg-slate-900');
  expectIncludes(html, 'role="banner"');
});

check('badge with count appears in the rendered nav', () => {
  __setQueryMock('queue.list', { queues: sevenQueues });
  const html = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: false }),
  );
  // The badge should appear inside My tasks link
  expectIncludes(html, 'tasks waiting for your review');
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
