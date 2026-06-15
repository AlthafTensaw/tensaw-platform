/**
 * QueueSwitcher (v4.1) — top-nav dropdown for picking which TEAM queue you're
 * viewing. Engine-handler model: queues are the fixed Team enum (handoff §7),
 * not a dynamic engine list. No personal user_<id> queue.
 *
 * Renders:
 *   - Trigger with the active team label + chevron
 *   - Popover listing all teams with per-team open-count badges
 *     (from worklist.counts)
 *
 * Closes on item click / outside click / Escape.
 *
 * Drop-in path: src/components/nav/QueueSwitcher.tsx
 */

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { TeamSchema, TEAM_LABELS, type Team } from '../../actions/schemas';
import { useTeamQueue } from '../../hooks/useTeamQueue';

export interface QueueSwitcherProps {
  /** Caller's role-default team (shell passes from JWT roles). */
  defaultTeam?: Team;
}

export function QueueSwitcher({ defaultTeam }: QueueSwitcherProps): React.ReactElement {
  const { activeTeam, setActiveTeam } = useTeamQueue(defaultTeam);
  const { data: countsData } = useActionQuery('worklist.counts', {});
  const counts = countsData?.counts ?? {};

  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent): void {
      if (rootRef.current === null) return;
      if (!rootRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  const handleTriggerKey = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  const onPick = useCallback(
    (team: Team) => {
      setActiveTeam(team);
      setIsOpen(false);
    },
    [setActiveTeam],
  );

  const teams = TeamSchema.options as readonly Team[];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        className="
          flex items-center gap-2 rounded-md px-3 py-2
          text-sm font-medium text-slate-100 hover:bg-slate-800
          focus:outline-none focus:ring-2 focus:ring-blue-500
        "
      >
        <span className="text-[10.5px] uppercase tracking-wider text-slate-400">Queue</span>
        <span className="max-w-[16rem] truncate">{TEAM_LABELS[activeTeam]}</span>
        {counts[activeTeam] !== undefined && (
          <span className="
            inline-flex h-5 min-w-[1.5rem] items-center justify-center
            rounded-full bg-slate-700 px-2 text-[11px] font-semibold text-slate-200
          ">
            {counts[activeTeam]}
          </span>
        )}
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select a team queue"
          className="
            absolute left-0 top-full z-40 mt-1 w-72 max-h-[70vh] overflow-y-auto
            rounded-lg border border-slate-700 bg-slate-900 shadow-xl ring-1 ring-black/20
          "
        >
          <div className="py-1">
            <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-slate-500">
              Team queues
            </div>
            {teams.map((team) => (
              <TeamListItem
                key={team}
                team={team}
                isActive={team === activeTeam}
                count={counts[team]}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

interface TeamListItemProps {
  team: Team;
  isActive: boolean;
  count: number | undefined;
  onPick: (team: Team) => void;
}

function TeamListItem({ team, isActive, count, onPick }: TeamListItemProps): React.ReactElement {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={() => onPick(team)}
      className={`
        flex w-full items-center justify-between gap-3 px-3 py-2 text-left
        text-sm focus:outline-none
        ${isActive ? 'bg-slate-800 text-white' : 'text-slate-200 hover:bg-slate-800/60 focus:bg-slate-800/60'}
      `}
    >
      <span className="flex items-center gap-2 min-w-0">
        <UsersIcon />
        <span className="truncate">{TEAM_LABELS[team]}</span>
      </span>
      {count !== undefined && count > 0 && (
        <span className="
          inline-flex h-5 min-w-[1.5rem] items-center justify-center
          rounded-full bg-slate-700 px-2 text-[11px] font-semibold text-slate-200
        ">
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Inline icons
// ============================================================================

function ChevronIcon({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 12c0-2 1.6-3.2 3.5-3.2s3.5 1.2 3.5 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 12c0-1.4 1-2.3 2.5-2.3s2.5 0.9 2.5 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
