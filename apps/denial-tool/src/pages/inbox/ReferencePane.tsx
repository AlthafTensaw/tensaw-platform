/**
 * ReferencePane — right pane of the v3.0 3-pane shell.
 *
 * Tab strip + active-tab body. Tabs in display order:
 *   Analysis · Payments · Notes · Files · Appeal
 *
 * Tab state is local. Switching tabs doesn't lose left/middle pane state.
 * Each tab loads its own data lazily via hooks (useNotes, useFiles, etc.).
 */

import { useState } from 'react';
import type { WorklistRow } from '../../actions/schemas';
import { AnalysisTab } from './tabs/AnalysisTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { NotesTab } from './tabs/NotesTab';
import { FilesTab } from './tabs/FilesTab';
import { AppealTab } from './tabs/AppealTab';
import { useNotes, useFiles } from '../../hooks/useTabData';

type TabId = 'analysis' | 'payments' | 'notes' | 'files' | 'appeal';

interface ReferencePaneProps {
  row: WorklistRow;
}

export function ReferencePane({ row }: ReferencePaneProps): JSX.Element {
  const [active, setActive] = useState<TabId>('analysis');
  const claimId = row.claim.claim_id;

  // Fetch counts for badge display on tab strip (cheap — caches via React Query)
  const { data: notesData } = useNotes(claimId);
  const { data: filesData } = useFiles(claimId);
  const notesCount = notesData?.notes.length ?? 0;
  const filesCount = filesData?.files.length ?? 0;

  return (
    <div className="flex flex-col overflow-hidden border-l border-border bg-muted/30">
      {/* Tab strip */}
      <div className="flex border-b border-border bg-background px-3.5">
        <Tab
          id="analysis"
          label="Analysis"
          active={active === 'analysis'}
          onSelect={setActive}
        />
        <Tab
          id="payments"
          label="Payments"
          active={active === 'payments'}
          onSelect={setActive}
        />
        <Tab
          id="notes"
          label="Notes"
          badge={notesCount}
          active={active === 'notes'}
          onSelect={setActive}
        />
        <Tab
          id="files"
          label="Files"
          badge={filesCount}
          active={active === 'files'}
          onSelect={setActive}
        />
        <Tab
          id="appeal"
          label="Appeal"
          active={active === 'appeal'}
          onSelect={setActive}
        />
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto p-4">
        {active === 'analysis' ? <AnalysisTab row={row} /> : null}
        {active === 'payments' ? <PaymentsTab row={row} /> : null}
        {active === 'notes' ? <NotesTab row={row} /> : null}
        {active === 'files' ? <FilesTab row={row} /> : null}
        {active === 'appeal' ? <AppealTab row={row} /> : null}
      </div>
    </div>
  );
}

function Tab({
  id,
  label,
  badge,
  active,
  onSelect,
}: {
  id: TabId;
  label: string;
  badge?: number;
  active: boolean;
  onSelect: (id: TabId) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => { onSelect(id); }}
      className={[
        '-mb-px border-b-2 px-3 py-3 text-[12.5px] font-medium',
        active
          ? 'border-primary font-semibold text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {label}
      {badge !== undefined && badge > 0 ? (
        <span
          className={[
            'ml-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[9.5px] font-semibold',
            active
              ? 'bg-primary/15 text-primary-foreground/90'
              : 'bg-muted text-muted-foreground',
          ].join(' ')}
          style={active ? { color: '#134e4a' } : undefined}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
