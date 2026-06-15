/**
 * TopNav — v4 top navigation bar.
 *
 * Layout:
 *   [BrandLogo]  [QueueSwitcher]     ........     [CostLink?]  [MyTasksLink]  [UserMenu]
 *
 * - QueueSwitcher: new in v4 (replaces v3's static "Recommended denials" header)
 * - MyTasksLink:   carries the red NeedsMyReviewBadge
 * - CostLink:      only shown for callers with the denial.view_cost permission
 *
 * Permission gating is delegated to the parent (which passes `canViewCost`).
 * The TopNav doesn't reach into auth state directly — keeps it testable.
 *
 * Drop-in path: src/components/nav/TopNav.tsx
 */

import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { QueueSwitcher } from './QueueSwitcher';
import { MyTasksLink } from './MyTasksLink';


export interface TopNavProps {
  /** Real UserMenu node to render (sign out, avatar, etc). */
  userMenu: React.ReactNode;
  /** True if the caller has the denial.view_cost permission. */
  canViewCost: boolean;
}

export function TopNav({ userMenu, canViewCost }: TopNavProps): React.ReactElement {
  return (
    <header
      role="banner"
      className="
        sticky top-0 z-30 w-full
        border-b border-slate-800 bg-slate-900
      "
    >
      <div className="mx-auto flex h-12 items-center gap-2 px-3">
        <BrandLogo />
        <div className="ml-2">
          <QueueSwitcher />
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
          <MyTasksLink />
          {userMenu}
        </nav>
      </div>
    </header>
  );
}
