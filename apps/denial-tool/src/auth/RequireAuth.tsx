/**
 * Route guards for denial-tool.
 *
 * RequireAuth — redirects unauthenticated users to /sign-in with a `next` param.
 * RequirePermission — adds a permission check; renders an inline "insufficient
 * access" surface for authenticated users who lack the required permission.
 *
 * Both pull from useAuthStore. The store is populated either:
 *   - By Cognito sign-in (real auth)
 *   - By the mock SignInPage role picker (dev/test)
 *
 * Either way, `user.permissions[]` is the resolved set from the user's
 * Cognito groups via auth/permissions.ts.
 */

import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, type AuthStore } from '@tensaw/runtime';
import type { Permission } from './permissions';

export function RequireAuth(): ReactElement | null {
  const status = useAuthStore((s: AuthStore) => s.status);
  const user = useAuthStore((s: AuthStore) => s.user);
  const location = useLocation();

  // While the persist middleware is rehydrating from localStorage the status
  // stays 'unknown' for one render. Return null to avoid a premature redirect.
  if (status === 'unknown') return null;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  return <Outlet />;
}

interface RequirePermissionProps {
  permission: Permission;
}

export function RequirePermission({
  permission,
}: RequirePermissionProps): ReactElement | null {
  const status = useAuthStore((s: AuthStore) => s.status);
  const user = useAuthStore((s: AuthStore) => s.user);
  const location = useLocation();

  if (status === 'unknown') return null;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  if (!user.permissions?.includes(permission)) {
    return (
      <div style={forbiddenStyle}>
        <h2 style={forbiddenTitleStyle}>Insufficient access</h2>
        <p style={forbiddenBodyStyle}>
          This view requires the <code>{permission}</code> permission.
          Your account does not have it. Contact your tenant administrator
          if you believe this is an error.
        </p>
      </div>
    );
  }
  return <Outlet />;
}

const forbiddenStyle: React.CSSProperties = {
  padding: '40px',
  maxWidth: 480,
  margin: '40px auto',
  textAlign: 'center',
  color: 'var(--tw-color-text-primary)',
};

const forbiddenTitleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 500,
  marginBottom: 8,
};

const forbiddenBodyStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--tw-color-text-muted)',
  lineHeight: 1.6,
};
