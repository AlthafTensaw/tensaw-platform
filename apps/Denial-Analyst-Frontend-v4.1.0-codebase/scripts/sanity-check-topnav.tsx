/**
 * SSR sanity for the v4.1 TopNav + QueueSwitcher (engine-handler model).
 * Run with: npx tsx scripts/sanity-check-topnav.tsx
 */

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { __setQueryMock, __resetMocks } from '../stubs/tensaw/actions';
import { __setSearchParams, __resetSearchParams } from '../stubs/react-router-dom';

import { TopNav } from '../src/components/nav/TopNav';
import { QueueSwitcher } from '../src/components/nav/QueueSwitcher';
import { TeamSchema, TEAM_LABELS } from '../src/actions/schemas';

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
  const clean = html.replace(/<!-- -->/g, '');
  if (!clean.includes(needle)) {
    throw new Error(`HTML did not include "${needle}"\n  ${clean.slice(0, 400)}`);
  }
}
function expectExcludes(html: string, needle: string): void {
  const clean = html.replace(/<!-- -->/g, '');
  if (clean.includes(needle)) throw new Error(`HTML unexpectedly included "${needle}"`);
}

function setCounts(counts: Record<string, number>): void {
  __setQueryMock('worklist.counts', { counts });
}

// ============================================================================
// TopNav
// ============================================================================

console.log('=== TopNav (v41) ===');

check('renders brand + queue switcher + user', () => {
  __resetMocks();
  __resetSearchParams();
  setCounts({ denial_intake_analyst: 6 });
  const html = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: false }),
  );
  expectIncludes(html, 'role="banner"');
  expectIncludes(html, 'Vipin K.');
  expectIncludes(html, 'Denial Intake'); // default team label
});

check('has NO Needs-my-review badge and NO My-tasks link', () => {
  __resetMocks();
  __resetSearchParams();
  setCounts({});
  const html = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: false }),
  );
  expectExcludes(html, 'Needs my review');
  expectExcludes(html, 'My tasks');
});

check('Cost link hidden without permission, shown with it', () => {
  __resetMocks();
  __resetSearchParams();
  setCounts({});
  const noCost = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: false }),
  );
  expectExcludes(noCost, '>Cost<');

  const withCost = renderToString(
    createElement(TopNav, { userName: 'Vipin K.', canViewCost: true }),
  );
  expectIncludes(withCost, '>Cost<');
});

// ============================================================================
// QueueSwitcher
// ============================================================================

console.log('\n=== QueueSwitcher (v41) ===');

check('trigger shows the active team label + count badge', () => {
  __resetMocks();
  __resetSearchParams();
  setCounts({ denial_intake_analyst: 6 });
  const html = renderToString(createElement(QueueSwitcher, {}));
  expectIncludes(html, 'Denial Intake');
  expectIncludes(html, '>6<'); // count badge for the active team
  expectIncludes(html, 'aria-haspopup="listbox"');
});

check('?queue= drives the active team', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ queue: 'coding' });
  setCounts({ coding: 3 });
  const html = renderToString(createElement(QueueSwitcher, {}));
  expectIncludes(html, TEAM_LABELS.coding); // 'Coding'
  expectIncludes(html, '>3<');
});

check('defaultTeam prop is used when ?queue= is absent', () => {
  __resetMocks();
  __resetSearchParams();
  setCounts({ am: 2 });
  const html = renderToString(createElement(QueueSwitcher, { defaultTeam: 'am' }));
  expectIncludes(html, TEAM_LABELS.am); // 'Account Management'
});

check('invalid ?queue= falls back to default team', () => {
  __resetMocks();
  __resetSearchParams();
  __setSearchParams({ queue: 'user_42' }); // not a valid Team
  setCounts({});
  const html = renderToString(createElement(QueueSwitcher, { defaultTeam: 'resolution' }));
  expectIncludes(html, TEAM_LABELS.resolution);
  // The personal-queue value must not appear as a team label
  expectExcludes(html, 'user_42');
});

// SSR renders the trigger collapsed (isOpen=false), so the listbox isn't in the
// markup. Assert the data the open list WOULD render is well-formed instead.
check('all 13 teams have labels (the switcher list source)', () => {
  for (const team of TeamSchema.options) {
    if (typeof TEAM_LABELS[team] !== 'string' || TEAM_LABELS[team].length === 0) {
      throw new Error(`missing label for team ${team}`);
    }
  }
  if (TeamSchema.options.length !== 13) {
    throw new Error(`expected 13 teams, got ${TeamSchema.options.length}`);
  }
});

check('no team label is a personal/user_ queue', () => {
  for (const team of TeamSchema.options) {
    if (String(team).startsWith('user_')) {
      throw new Error(`personal queue leaked into team enum: ${team}`);
    }
  }
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) process.exit(1);
