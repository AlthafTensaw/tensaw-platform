/**
 * AssigneePicker — popover-based assignee selector for a workflow step.
 *
 * Renders the current assignee inline (avatar + name + chevron). Clicking
 * opens a typeahead popover backed by useUserDirectory(). Selection fires
 * onSelect; the "Unassigned" row fires onClear.
 *
 * Display name format: `${first_name} ${last_name[0]}.` per backend's PHI-light
 * directory shape (no full last names, no emails).
 */

import { useState, type ChangeEvent } from 'react';
import { Popover } from '@tensaw/design-system/overlays';
import { Input } from '@tensaw/design-system/primitives';
import { Icon } from '@tensaw/design-system/primitives';
import {
  avatarColorFor,
  displayNameFor,
  useUserDirectory,
} from '../hooks/useUserDirectory';
import type { UserDirectoryEntry } from '../actions/schemas';

interface AssigneePickerProps {
  value: number | null;
  onSelect: (userId: number) => void;
  onClear: () => void;
  disabled?: boolean;
}

function Avatar({
  user,
  size = 18,
}: {
  user: UserDirectoryEntry;
  size?: number;
}): JSX.Element {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: avatarColorFor(user.user_id),
        fontSize: size <= 18 ? 9 : 11,
      }}
      aria-hidden
    >
      {user.initials}
    </span>
  );
}

export function AssigneePicker({
  value,
  onSelect,
  onClear,
  disabled,
}: AssigneePickerProps): JSX.Element {
  const { lookup, search, isLoading } = useUserDirectory();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const current = lookup(value);
  const matches = search(q);

  const handlePick = (userId: number): void => {
    onSelect(userId);
    setOpen(false);
    setQ('');
  };

  const handleUnassigned = (): void => {
    onClear();
    setOpen(false);
    setQ('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      sideOffset={4}
      trigger={
        <button
          type="button"
          disabled={disabled ?? false}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-xs hover:border-muted-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {current ? (
            <>
              <Avatar user={current} />
              <span>{displayNameFor(current)}</span>
            </>
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Icon name="UserMinus" size="xs" />
              Unassigned
            </span>
          )}
          <Icon name="ChevronDown" size="xs" className="text-muted-foreground" />
        </button>
      }
    >
      <div className="w-64 p-1">
        <div className="px-2 pt-1 pb-2">
          <Input
            value={q}
            onChange={(e: ChangeEvent<HTMLInputElement>) => { setQ(e.target.value); }}
            placeholder="Find a teammate…"
            aria-label="Search users"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={handleUnassigned}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left text-xs text-muted-foreground"
          >
            <Icon name="UserMinus" size="xs" />
            Unassigned
          </button>
          <div className="my-1 border-t border-border" />
          {isLoading ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Loading…
            </div>
          ) : matches.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No matches
            </div>
          ) : (
            matches.map((u) => (
              <button
                key={u.user_id}
                type="button"
                onClick={() => { handlePick(u.user_id); }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left text-sm"
              >
                <Avatar user={u} />
                <span className="font-medium">{displayNameFor(u)}</span>
                <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wide">
                  {u.role_id === 110
                    ? 'AR'
                    : u.role_id === 120
                      ? 'EMR'
                      : u.role_id === 130
                        ? 'Iris'
                        : u.role_id === 200
                          ? 'Mgr'
                          : `R${String(u.role_id)}`}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Popover>
  );
}
