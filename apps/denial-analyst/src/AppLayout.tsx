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
import { TopNav, TopNavItem, TopNavUserMenu } from '@tensaw/design-system/navigation';
import { useAuthStore } from '@tensaw/runtime';
import { usePermissions } from './auth/permissions';
import { Stethoscope } from 'lucide-react';

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
      topNav={
        <TopNav
          logo={
            <div className="flex items-center gap-2 font-medium text-lg text-primary">
              <Stethoscope className="w-5 h-5" />
              <span>Denial analysis</span>
            </div>
          }
          primaryNav={navItems.map((item) => (
            <TopNavItem key={item.id} to={item.href}>
              {item.label}
            </TopNavItem>
          ))}
          utilityNav={
            user ? (
              <TopNavUserMenu
                user={{ name: user.fullName, email: user.email }}
                items={[
                  {
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
        />
      }
    >
      <Outlet />
    </AppShell>
  );
}
