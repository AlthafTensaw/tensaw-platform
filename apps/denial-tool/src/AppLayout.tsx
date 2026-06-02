import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AppShell } from '@tensaw/design-system/layout';
import { TopNav } from '@tensaw/design-system/navigation';
import { DropdownMenu } from '@tensaw/design-system/overlays';
import { useActionQuery } from '@tensaw/actions';
import { useAuthStore } from '@tensaw/runtime';
import { usePermissions } from './auth/permissions';
import type { TasksMineResponse } from './actions/schemas';

/**
 * v3.0.2 fix: replaced anchor tags with React Router NavLink so navigation
 * stays inside the SPA. The previous `<a href>` pattern triggered full-page
 * browser reloads, which cleared the in-memory Zustand auth store and
 * caused session loss / redirects back to sign-in (reported by Vivek,
 * 2026-05-25 and 2026-05-29). NavLink also provides `isActive` for free
 * so we no longer need the manual location.pathname derivation.
 */

const ACTIVE_CLS =
  'rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground';
const INACTIVE_CLS =
  'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground';

const ACTIVE_BADGE_CLS = `${ACTIVE_CLS} inline-flex items-center gap-2`;
const INACTIVE_BADGE_CLS = `${INACTIVE_CLS} inline-flex items-center gap-2`;

/**
 * MyTasksTab — fetches the task count via a page_size=1 query for the
 * nav-tab badge.
 *
 * v3.0.2 optimization (Vivek 2026-05-29): added `freshFor: 30_000` so the
 * badge doesn't refetch on every AppLayout re-mount. Badge value is allowed
 * to be up to 30s stale — perfectly fine for a glanceable counter, and it
 * means cross-page navigation reuses the cached value. Real-time-accurate
 * count would need a dedicated `/v1/tasks/mine/count` BE endpoint; tracked
 * for v3.1 alongside other small BE additions.
 */
function MyTasksTab(): JSX.Element {
  const { data } = useActionQuery<TasksMineResponse>(
    'denial.list-tasks-mine',
    BADGE_REQUEST,
    { freshFor: 30_000 },
  );
  const count = data?.total ?? 0;
  return (
    <NavLink
      to="/tasks"
      className={({ isActive }) =>
        isActive ? ACTIVE_BADGE_CLS : INACTIVE_BADGE_CLS
      }
    >
      My tasks
      {count > 0 ? (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold tabular-nums">
          {count > 99 ? '99+' : String(count)}
        </span>
      ) : null}
    </NavLink>
  );
}

// Stable reference for the badge request so the cache key doesn't change
// across renders. See useTabData.ts EMPTY_REQUEST for the same pattern.
const BADGE_REQUEST = Object.freeze({ page: 1, page_size: 1 });

export function AppLayout(): JSX.Element {
  const user = useAuthStore((s: { user: unknown }) => s.user);
  const signOut = useAuthStore((s: { signOut: () => void }) => s.signOut);
  const { has } = usePermissions();
  const navigate = useNavigate();

  const navLinks = (
    <nav className="flex items-center gap-1">
      <NavLink
        to="/inbox"
        className={({ isActive }) => (isActive ? ACTIVE_CLS : INACTIVE_CLS)}
      >
        Inbox
      </NavLink>
      <MyTasksTab />
      {has('denial.view_cost') ? (
        <NavLink
          to="/cost"
          className={({ isActive }) => (isActive ? ACTIVE_CLS : INACTIVE_CLS)}
        >
          Cost
        </NavLink>
      ) : null}
    </nav>
  );

  const u = user as { fullName?: string; roles?: string[] } | null;
  const initials = (u?.fullName ?? '')
    .split(' ')
    .map((s) => s[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // v3.0.2 fix: replaced platform <Avatar initials=...> with inline div.
  // The platform Avatar's `initials` prop caused a build error in Vivek's
  // integration (2026-05-29). Inlining is consistent with DenialCard's
  // AssigneeAvatar and removes the design-system API coupling for this
  // single use site.
  const avatarBg = colorForName(u?.fullName ?? '');

  const utilityNav = u ? (
    <DropdownMenu
      trigger={
        <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: avatarBg }}
            aria-label={u.fullName ?? 'User avatar'}
          >
            {initials}
          </span>
          <span className="hidden md:inline">{u.fullName}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {u.roles?.[0] ?? 'USER'}
          </span>
        </button>
      }
    >
      <button
        type="button"
        className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
        onClick={() => {
          signOut();
          navigate('/sign-in');
        }}
      >
        Sign out
      </button>
    </DropdownMenu>
  ) : null;

  return (
    <AppShell
      topNav={
        <TopNav
          logo={
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span aria-hidden>🩺</span>
              Denial analysis
            </div>
          }
          primaryNav={navLinks}
          utilityNav={utilityNav}
        />
      }
    >
      <Outlet />
    </AppShell>
  );
}

// Deterministic background color from a name string. Same palette used in
// DenialCard's AssigneeAvatar so the user-avatar color matches the assignee
// avatars in the left pane.
function colorForName(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palette = [
    '#b45309',
    '#1e40af',
    '#5b21b6',
    '#15803d',
    '#be185d',
    '#9f1239',
    '#0d9488',
  ];
  return palette[hash % palette.length]!;
}
