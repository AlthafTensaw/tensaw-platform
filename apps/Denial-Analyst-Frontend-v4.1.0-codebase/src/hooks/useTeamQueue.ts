/**
 * useTeamQueue — "which team queue am I viewing" (v4.1, engine-handler model).
 *
 * Replaces v4.0.0's useQueueState. The key change: a "queue" is now a fixed
 * Team (from the TeamSchema enum, handoff §7), not a dynamic queue_id fetched
 * from the engine via queue.list. There is no personal user_<id> queue.
 *
 * Reads `?queue=<team>` from the URL, validated against TeamSchema. Falls back
 * to a role-derived default team (passed by the shell from the JWT role —
 * handoff §9), then to 'denial_intake_analyst'.
 *
 * Drop-in path: src/hooks/useTeamQueue.ts
 */

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TeamSchema, type Team } from '../actions/schemas';

const FALLBACK_TEAM: Team = 'denial_intake_analyst';

export interface TeamQueueState {
  /** The active team queue. */
  activeTeam: Team;
  /** Update the active team (writes ?queue=, drops ?page= and ?case=). */
  setActiveTeam: (team: Team) => void;
}

/**
 * @param defaultTeam the caller's role-default team (shell passes this from
 *   JWT roles). When omitted, falls back to denial_intake_analyst.
 */
export function useTeamQueue(defaultTeam?: Team): TeamQueueState {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get('queue');
  const parsed = raw !== null ? TeamSchema.safeParse(raw) : null;
  const activeTeam: Team = parsed?.success
    ? parsed.data
    : defaultTeam ?? FALLBACK_TEAM;

  const setActiveTeam = useCallback(
    (team: Team) => {
      const next: Record<string, string> = {};
      const existing = searchParams.toString();
      if (existing) {
        const p = new URLSearchParams(existing);
        p.forEach((v, k) => {
          // Drop ?page= and ?case= when switching queues — they belong to the
          // previous queue's context.
          if (k !== 'queue' && k !== 'page' && k !== 'case') next[k] = v;
        });
      }
      next.queue = team;
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  return { activeTeam, setActiveTeam };
}
