/**
 * useUserDirectory — single-fetch + cache of GET /v1/users.
 *
 * v1.7.2 introduces a small user directory (12-50 users in production) used
 * by the per-step assignee picker. Since the list changes rarely, we fetch
 * once per session, cache in React Query for 10 minutes, and expose three
 * helpers:
 *
 *   - users          — full UserDirectoryEntry[]
 *   - lookup(id)     — UserDirectoryEntry | null for a given user_id
 *   - search(q)      — substring match across first_name / last_name / initials
 *
 * Color picking is deterministic on user_id (mod 8) so the same user always
 * renders with the same avatar color across components and across remounts.
 */

import { useMemo } from 'react';
import { useActionQuery } from '@tensaw/actions';
import type { UserDirectoryEntry, UserDirectoryResponse } from '../actions/schemas';

const STALE_MS = 10 * 60 * 1000;

const AVATAR_COLORS = [
  '#0d9488', // teal
  '#b45309', // amber
  '#1e40af', // blue
  '#5b21b6', // purple
  '#be185d', // pink
  '#15803d', // green
  '#9f1239', // coral
  '#7c2d12', // brown
] as const;

export function avatarColorFor(userId: number): string {
  const idx = userId % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx] ?? AVATAR_COLORS[0]!;
}

export function displayNameFor(user: UserDirectoryEntry): string {
  const lastInitial = user.last_name.charAt(0);
  return `${user.first_name} ${lastInitial}.`;
}

interface UseUserDirectoryResult {
  users: readonly UserDirectoryEntry[];
  isLoading: boolean;
  lookup: (userId: number | null | undefined) => UserDirectoryEntry | null;
  search: (q: string) => readonly UserDirectoryEntry[];
}

export function useUserDirectory(): UseUserDirectoryResult {
  // Empty request -> backend returns the default set (active=true, role_id=110)
  const request = useMemo(() => ({}), []);
  const { data, isLoading } = useActionQuery<UserDirectoryResponse>(
    'denial.list-users',
    request,
    { freshFor: STALE_MS },
  );

  const users = data?.users ?? [];

  const lookup = useMemo(
    () =>
      (userId: number | null | undefined): UserDirectoryEntry | null => {
        if (userId == null) return null;
        return users.find((u) => u.user_id === userId) ?? null;
      },
    [users],
  );

  const search = useMemo(
    () =>
      (q: string): readonly UserDirectoryEntry[] => {
        const needle = q.trim().toLowerCase();
        if (needle.length === 0) return users;
        return users.filter(
          (u) =>
            u.first_name.toLowerCase().includes(needle) ||
            u.last_name.toLowerCase().includes(needle) ||
            u.initials.toLowerCase().includes(needle),
        );
      },
    [users],
  );

  return { users, isLoading, lookup, search };
}
