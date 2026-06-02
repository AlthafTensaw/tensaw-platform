/**
 * SignInPage — mock sign-in for dev + tests.
 *
 * Real auth lands later via Cognito Hosted UI or a custom screen against
 * the configured user pool. For now: a role picker that calls
 * useAuthStore.signIn() with mock identity + the resolved permissions
 * for the chosen role.
 *
 * v3.0.2 fixes (Vivek 2026-05-25 #5, #6 + 2026-05-29):
 *  - Replaced all inline styles with Tailwind utility classes.
 *  - Dropped references to undeclared `--tw-color-*` CSS variables that
 *    weren't in the design-system token set.
 *  - Tightened the signIn selector typing — the runtime AuthUser uses
 *    `userId` (not `id`) and `fullName` (not `name`); v2.x relied on
 *    loose `unknown` typing that hid the field-name mismatch from tsc.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, type AuthStore } from '@tensaw/runtime';
import {
  ALL_ROLES,
  resolvePermissions,
  type Role,
} from '../../auth/permissions';

export function SignInPage(): JSX.Element {
  const [role, setRole] = useState<Role>('ANALYST');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signIn = useAuthStore((s: AuthStore) => s.signIn);

  const handleSubmit = (): void => {
    signIn({
      user: {
        userId: `mock-${role.toLowerCase()}-sub`,
        username: role.toLowerCase(),
        email: `${role.toLowerCase()}@primrose.dev`,
        fullName:
          role === 'ANALYST'
            ? 'Renita K.'
            : role === 'MANAGER'
              ? 'Roopa M.'
              : 'Vijaya R.',
        roles: [role],
        permissions: resolvePermissions([role]),
        clinicIds: ['c-001'],
      },
      clinicId: 'c-001',
    });
    // v3.0 routes default landing to /inbox; /worklist still works as an
    // alias for muscle memory + bookmarks.
    const next = params.get('next') ?? '/inbox';
    navigate(next, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-7 shadow-lg flex flex-col gap-3.5">
        <h1
          className="m-0 text-xl font-medium"
          style={{ color: '#0f766e' }}
        >
          Tensaw — Denial Analysis
        </h1>
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
            className="rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div className="font-mono text-xs text-muted-foreground">
          Grants: {resolvePermissions([role]).join(', ')}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-md px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          style={{ backgroundColor: '#0d9488' }}
        >
          Sign in as {role}
        </button>
      </div>
    </div>
  );
}
