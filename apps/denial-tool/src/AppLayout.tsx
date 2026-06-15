import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AppShell } from '@tensaw/design-system/layout';
import { TopNav } from './components/nav/TopNav';
import { DropdownMenu } from '@tensaw/design-system/overlays';
import { useActionQuery } from '@tensaw/actions';
import { useAuthStore, getTokenProvider } from '@tensaw/runtime';
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



export function AppLayout(): JSX.Element {
  const user = useAuthStore((s: { user: unknown }) => s.user);
  const signOut = useAuthStore((s: { signOut: () => void }) => s.signOut);
  const { has } = usePermissions();
  const navigate = useNavigate();



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
        <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-slate-800">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: avatarBg }}
            aria-label={u.fullName ?? 'User avatar'}
          >
            {initials}
          </span>
          <span className="hidden md:inline">{u.fullName}</span>
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-300">
            {u.roles?.[0] ?? 'USER'}
          </span>
        </button>
      }
    >
      <button
        type="button"
        className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
        onClick={async () => {
          await getTokenProvider().signOut(); // Clears AWS Amplify tokens
          await signOut(); // Clears local Zustand state
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
          userMenu={utilityNav}
          canViewCost={has('denial.view_cost')}
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
