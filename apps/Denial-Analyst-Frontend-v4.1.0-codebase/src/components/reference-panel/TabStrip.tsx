/**
 * TabStrip — horizontal tab selector at the top of the reference panel.
 *
 * Five tabs: Analysis, Payments, Notes, Files, Appeal. Each shows a label;
 * notes and files can show a count badge.
 *
 * Drop-in path: src/components/reference-panel/TabStrip.tsx
 */

import type { TabId } from '../../hooks/useActiveTab';

export interface TabStripProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** Optional count badges. undefined → no badge. */
  notesCount?: number;
  filesCount?: number;
  hasAppealDraft?: boolean;
}

interface TabDef {
  id: TabId;
  label: string;
}

const TAB_DEFS: TabDef[] = [
  { id: 'analysis', label: 'Analysis' },
  { id: 'payments', label: 'Payments' },
  { id: 'notes', label: 'Notes' },
  { id: 'files', label: 'Files' },
  { id: 'appeal', label: 'Appeal' },
];

export function TabStrip({
  activeTab,
  onTabChange,
  notesCount,
  filesCount,
  hasAppealDraft = false,
}: TabStripProps): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label="Reference panel tabs"
      className="flex items-center border-b border-slate-200 bg-white"
    >
      {TAB_DEFS.map((tab) => {
        const isActive = tab.id === activeTab;
        const badge = countForTab(tab.id, notesCount, filesCount, hasAppealDraft);

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-1.5 border-b-2 px-3 py-2
              text-[12px] font-medium
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
              ${isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800'}
            `}
          >
            <span>{tab.label}</span>
            {badge !== null && (
              <span
                aria-label={`${badge.count} ${tab.label.toLowerCase()}`}
                className={`
                  inline-flex items-center justify-center
                  rounded-full px-1.5 text-[10px] font-semibold min-w-[1.25rem]
                  ${isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'}
                `}
              >
                {badge.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function countForTab(
  id: TabId,
  notesCount: number | undefined,
  filesCount: number | undefined,
  hasAppealDraft: boolean,
): { count: number | string; label: string } | null {
  if (id === 'notes' && notesCount !== undefined && notesCount > 0) {
    return { count: notesCount, label: String(notesCount) };
  }
  if (id === 'files' && filesCount !== undefined && filesCount > 0) {
    return { count: filesCount, label: String(filesCount) };
  }
  if (id === 'appeal' && hasAppealDraft) {
    return { count: '•', label: '•' };
  }
  return null;
}
