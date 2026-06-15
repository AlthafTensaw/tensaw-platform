/**
 * useActiveTab — URL-driven state for the right-pane tab selection.
 *
 * URL convention: ?tab=<analysis|payments|notes|files|appeal>
 * Default when missing: 'analysis'.
 *
 * Preserves all other URL params on change (queue, case, filters, page).
 *
 * Drop-in path: src/hooks/useActiveTab.ts
 */

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TabId = 'analysis' | 'payments' | 'notes' | 'files' | 'appeal';

const VALID_TABS: readonly TabId[] = [
  'analysis',
  'payments',
  'notes',
  'files',
  'appeal',
] as const;

const DEFAULT_TAB: TabId = 'analysis';

function isValidTab(v: string): v is TabId {
  return (VALID_TABS as readonly string[]).includes(v);
}

export interface ActiveTabState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

export function useActiveTab(): ActiveTabState {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get('tab');
  const activeTab: TabId = raw !== null && isValidTab(raw) ? raw : DEFAULT_TAB;

  const setActiveTab = useCallback(
    (tab: TabId) => {
      const next: Record<string, string> = {};
      const existing = searchParams.toString();
      if (existing) {
        const p = new URLSearchParams(existing);
        p.forEach((v, k) => {
          if (k !== 'tab') next[k] = v;
        });
      }
      // Only write the param if it's not the default — keeps URLs cleaner
      if (tab !== DEFAULT_TAB) {
        next.tab = tab;
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  return { activeTab, setActiveTab };
}

export { VALID_TABS, DEFAULT_TAB };
