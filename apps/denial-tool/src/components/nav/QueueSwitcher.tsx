/**
 * QueueSwitcher — top-nav dropdown for picking which queue you're viewing.
 *
 * Renders:
 *   - Trigger button with active queue label + chevron
 *   - Popover panel on open showing all queues with pending_count badges
 *   - Team queues at top, personal queue below a divider
 *   - Active queue highlighted; default queue marked with subtle indicator
 *
 * Closes on:
 *   - Item click (also triggers selection)
 *   - Outside click
 *   - Escape key
 *
 * Anchored on mockup #1 (queue switcher dropdown open).
 *
 * Drop-in path: src/components/nav/QueueSwitcher.tsx
 */

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { useActionQuery } from '@tensaw/actions';
import type { Queue } from '../../actions/schemas-v4';
import { useQueueState } from '../../hooks/useQueueState';

export function QueueSwitcher(): React.ReactElement {
  const { data, isLoading } = useActionQuery<{ queues: Queue[] }>('queue.list', {});
  const { activeQueueId, setActiveQueueId } = useQueueState();

  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent): void {
      if (rootRef.current === null) return;
      if (!rootRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  // Close on Escape
  const handleTriggerKey = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  const onPickQueue = useCallback(
    (queueId: string) => {
      setActiveQueueId(queueId);
      setIsOpen(false);
    },
    [setActiveQueueId],
  );

  const queues = data?.queues ?? [];
  const activeQueue = queues.find((q) => q.queue_id === activeQueueId);

  // Partition team vs personal
  const teamQueues = queues.filter((q) => q.queue_type === 'team');
  const personalQueues = queues.filter((q) => q.queue_type === 'personal');

  const triggerLabel = activeQueue?.queue_label
    ?? (isLoading ? 'Loading queues…' : 'Pick a queue');

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        disabled={isLoading && queues.length === 0}
        className="
          flex items-center gap-2 rounded-md px-3 py-2
          text-sm font-medium text-slate-100 hover:bg-slate-800
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:cursor-not-allowed disabled:opacity-60
        "
      >
        <span className="max-w-[16rem] truncate">{triggerLabel}</span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && queues.length > 0 && (
        <div
          role="listbox"
          aria-label="Select a queue"
          className="
            absolute left-0 top-full z-40 mt-1 w-72
            overflow-hidden rounded-lg border border-slate-700 bg-slate-900
            shadow-xl ring-1 ring-black/20
          "
        >
          {teamQueues.length > 0 && (
            <div className="py-1">
              <SectionLabel>Team queues</SectionLabel>
              {teamQueues.map((q) => (
                <QueueListItem
                  key={q.queue_id}
                  queue={q}
                  isActive={q.queue_id === activeQueueId}
                  onPick={onPickQueue}
                />
              ))}
            </div>
          )}

          {personalQueues.length > 0 && (
            <div className="border-t border-slate-700 py-1">
              <SectionLabel>Personal</SectionLabel>
              {personalQueues.map((q) => (
                <QueueListItem
                  key={q.queue_id}
                  queue={q}
                  isActive={q.queue_id === activeQueueId}
                  onPick={onPickQueue}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}

interface QueueListItemProps {
  queue: Queue;
  isActive: boolean;
  onPick: (queueId: string) => void;
}

function QueueListItem({ queue, isActive, onPick }: QueueListItemProps): React.ReactElement {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={() => onPick(queue.queue_id)}
      className={`
        flex w-full items-center justify-between gap-3 px-3 py-2 text-left
        text-sm focus:outline-none
        ${isActive ? 'bg-slate-800 text-white' : 'text-slate-200 hover:bg-slate-800/60 focus:bg-slate-800/60'}
      `}
    >
      <span className="flex items-center gap-2 min-w-0">
        {queue.queue_type === 'personal' ? (
          <PersonIcon />
        ) : (
          <UsersIcon />
        )}
        <span className="truncate">{queue.queue_label}</span>
        {queue.is_default_for_caller && (
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            default
          </span>
        )}
      </span>
      <span className="
        inline-flex h-5 min-w-[1.5rem] items-center justify-center
        rounded-full bg-slate-700 px-2
        text-[11px] font-semibold text-slate-200
      ">
        {queue.pending_count}
      </span>
    </button>
  );
}

// ============================================================================
// Inline icons (avoids lucide-react dependency for the smoke build)
// ============================================================================

function ChevronIcon({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 12c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
