/**
 * TopNav (v4.1) — top navigation bar for the engine-handler model.
 *
 * Layout:
 *   [BrandLogo]  [QueueSwitcher]   ........   [Cost?]  [UserMenu]
 *
 * Changes from v4.0.0:
 *   - Dropped NeedsMyReviewBadge + MyTasksLink (no needs_my_review, no personal
 *     task view — work flows team→team, handoff §0/§7).
 *   - QueueSwitcher picks a TEAM (fixed enum), not a dynamic queue_id.
 *   - Cost link retained (denial.view_cost gating survives).
 *
 * Permission gating delegated to the parent (passes canViewCost) — TopNav
 * doesn't reach into auth state. Keeps it testable.
 *
 * Drop-in path: src/components/nav/TopNav.tsx
 */

import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { QueueSwitcher } from './QueueSwitcher';
import { UserMenuStub } from './UserMenuStub';
import type { Team } from '../../actions/schemas';

export interface TopNavProps {
  /** Display name of the signed-in user (from auth context). */
  userName: string;
  /** True if the caller has the denial.view_cost permission. */
  canViewCost: boolean;
  /** Caller's role-default team queue (from JWT roles). */
  defaultTeam?: Team;
}

export function TopNav({ userName, canViewCost, defaultTeam }: TopNavProps): React.ReactElement {
  return (
    <header
      role="banner"
      className="sticky top-0 z-30 w-full border-b border-slate-800 bg-slate-900"
    >
      <div className="mx-auto flex h-12 items-center gap-2 px-3">
        <BrandLogo />
        <div className="ml-2">
          <QueueSwitcher defaultTeam={defaultTeam} />
        </div>

        <div className="flex-1" />

        <nav aria-label="Primary" className="flex items-center gap-1">
          {canViewCost && (
            <Link
              to="/cost"
              className="
                rounded-md px-3 py-2 text-sm font-medium text-slate-200
                hover:bg-slate-800 hover:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
            >
              Cost
            </Link>
          )}
          <UserMenuStub userName={userName} />
        </nav>
      </div>
    </header>
  );
}
