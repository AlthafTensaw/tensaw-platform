/**
 * AppLayout — outer chrome via platform AppShell.
 *
 * PR-6: hand-rolled flex header + nav links → platform AppShell +
 * TopNav. Avatar from primitives. The auth/role display + sign-out are
 * passed as the AppShell's `userMenu` slot. The Cost nav link is
 * filtered by permission so analysts don't see it.
 */

import { Outlet, useNavigate } from 'react-router-dom';
import { AppShell } from '@tensaw/design-system/layout';
import { TopNav } from '@tensaw/design-system/navigation';
import { Avatar } from '@tensaw/design-system/primitives';
import { DropdownMenu } from '@tensaw/design-system/overlays';
import { useAuthStore } from '@tensaw/runtime';
import { usePermissions } from './auth/permissions';

export function AppLayout() {
  const { user, signOut } = useAuthStore();
  const { has } = usePermissions();
  const navigate = useNavigate();

  const navItems = [
    { id: 'worklist', label: 'Worklist', href: '/worklist' },
    ...(has('denial.view_cost')
      ? [{ id: 'cost', label: 'Cost', href: '/cost' }]
      : []),
  ];

  const initials = (user?.fullName ?? '')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AppShell
      title="Denial analysis"
      brandIcon="stethoscope"
      topNav={<TopNav items={navItems} />}
      userMenu={
        user ? (
          <DropdownMenu
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 text-sm"
              >
                <Avatar initials={initials} size="sm" tone="info" />
                <span className="hidden md:inline">{user.fullName}</span>
                <span className="text-xs uppercase tracking-wide bg-secondary px-2 py-0.5 rounded-full">
                  {user.roles?.[0] ?? 'USER'}
                </span>
              </button>
            }
            items={[
              {
                id: 'signout',
                label: 'Sign out',
                onSelect: () => {
                  signOut();
                  navigate('/sign-in');
                },
              },
            ]}
          />
        ) : null
      }
    >
      <Outlet />
    </AppShell>
  );
}
