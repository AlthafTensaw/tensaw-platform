/**
 * AppLayout — outer chrome via platform AppShell.
 *
 * Folded header + nav links to use platform AppShell, TopNav, TopNavItem,
 * and TopNavUserMenu from @tensaw/design-system.
 */

import { Outlet, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import {
  AppShell,
  TopNav,
  TopNavItem,
  TopNavUserMenu,
} from '@tensaw/design-system';
import { useAuthStore } from '@tensaw/runtime';
import { usePermissions } from './auth/permissions';

export function AppLayout() {
  const { user, signOut } = useAuthStore();
  const { has } = usePermissions();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/sign-in');
  };

  const userMenu = user ? (
    <TopNavUserMenu
      user={{ name: user.fullName, email: user.email }}
      items={[
        {
          label: 'Sign out',
          onSelect: handleSignOut,
        },
      ]}
    />
  ) : null;

  const topNav = (
    <TopNav
      logo={
        <span className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-teal-600" />
          Denial analysis
        </span>
      }
      primaryNav={
        <div className="flex gap-1">
          <TopNavItem to="/worklist">Worklist</TopNavItem>
          {has('denial.view_cost') && <TopNavItem to="/cost">Cost</TopNavItem>}
        </div>
      }
      utilityNav={userMenu}
    />
  );

  return (
    <AppShell topNav={topNav}>
      <Outlet />
    </AppShell>
  );
}
