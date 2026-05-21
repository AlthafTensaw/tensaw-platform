/**
 * SignInPage — mock sign-in for dev + tests.
 *
 * Real auth lands later via Cognito Hosted UI or a custom screen against
 * the configured user pool. For now: a role picker that calls
 * useAuthStore.signIn() with mock identity + the resolved permissions
 * for the chosen role.
 *
 * The dispatcher's permission gate works identically against either
 * source — `user.permissions[]` is the only contract.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@tensaw/runtime';
import {
  ALL_ROLES,
  resolvePermissions,
  type Role,
} from '../../auth/permissions';

export function SignInPage(): JSX.Element {
  const [role, setRole] = useState<Role>('ANALYST');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signIn = useAuthStore((s) => s.signIn);

  const handleSubmit = () => {
    signIn({
      user: {
        userId: `mock-${role.toLowerCase()}-sub`,
        username: `${role.toLowerCase()}@primrose.dev`,
        email: `${role.toLowerCase()}@primrose.dev`,
        fullName: role === 'ANALYST' ? 'Renita K.' : role === 'MANAGER' ? 'Roopa M.' : 'Vijaya R.',
        roles: [role],
        permissions: resolvePermissions([role]),
        clinicIds: [],
      },
      clinicId: null,
    });
    const next = params.get('next') ?? '/worklist';
    navigate(next, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-[380px] p-7 bg-card rounded-xl border shadow-lg flex flex-col gap-3.5">
        <h1 className="m-0 text-xl font-medium text-teal-700">Tensaw — Denial Analysis</h1>
        <p className="m-0 text-sm text-muted-foreground">
          Mock sign-in (development). Production uses Cognito Hosted UI.
        </p>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Role
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
            }}
            className="px-2.5 py-2 border rounded-md text-sm bg-transparent"
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs text-muted-foreground font-mono">
          Grants: {resolvePermissions([role]).join(', ')}
        </div>

        <button 
          type="button" 
          onClick={handleSubmit} 
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white border-none rounded-md font-medium cursor-pointer text-sm transition-colors"
        >
          Sign in as {role}
        </button>
      </div>
    </div>
  );
}
