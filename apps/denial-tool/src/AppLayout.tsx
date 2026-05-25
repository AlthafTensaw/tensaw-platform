import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@tensaw/design-system/layout';
import { TopNav } from '@tensaw/design-system/navigation';
import { Avatar } from '@tensaw/design-system/primitives';
import { DropdownMenu } from '@tensaw/design-system/overlays';
import { useActionQuery } from '@tensaw/actions';
import { useAuthStore } from '@tensaw/runtime';
import { usePermissions } from './auth/permissions';
import type { TasksMineResponse } from './actions/schemas';

/**
 * MyTasksTab — fetches the task count via a page_size=1 query for the
 * nav-tab badge. Backend confirmed this pattern (see v1.8.0 response §7).
 */
function MyTasksTab({ active }: { active: boolean }): JSX.Element {
  const { data } = useActionQuery<TasksMineResponse>(
    'denial.list-tasks-mine',
    { page: 1, page_size: 1 },
  );
  const count = data?.total ?? 0;
  return (
    <Link
      to="/tasks"
      className={
        active
          ? 'rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground inline-flex items-center gap-2'
          : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-2'
      }
    >
      My tasks
      {count > 0 ? (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold tabular-nums">
          {count > 99 ? '99+' : String(count)}
        </span>
      ) : null}
    </Link>
  );
}

export function AppLayout(): JSX.Element {
  const user = useAuthStore((s: { user: unknown }) => s.user);
  const signOut = useAuthStore((s: { signOut: () => void }) => s.signOut);
  const { has } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string): boolean =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const navLinks = (
    <nav className="flex items-center gap-1">
      <Link
        to="/worklist"
        className={
          isActive('/worklist')
            ? 'rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground'
            : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
        }
      >
        Worklist
      </Link>
      <MyTasksTab active={isActive('/tasks')} />
      {has('denial.view_cost') ? (
        <Link
          to="/cost"
          className={
            isActive('/cost')
              ? 'rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground'
              : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
          }
        >
          Cost
        </Link>
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

  const utilityNav = u ? (
    <DropdownMenu
      trigger={
        <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
          <Avatar fallbackText={initials} alt={u.fullName ?? ''} size="sm" />
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
