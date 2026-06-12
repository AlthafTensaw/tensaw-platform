/**
 * ReferencePanel — right-pane composition for the 3-pane shell.
 *
 * Reads ?case=<case_id> from URL. Queries case.detail (shared cache with the
 * middle pane's WorkPane — no duplicate request). Renders TabStrip + the
 * active tab's content.
 *
 * URL-driven tab state: ?tab=<analysis|payments|notes|files|appeal>
 *
 * Drop-in path: src/pages/ReferencePanel.tsx
 */

import { useActionQuery } from '@tensaw/actions';
import { useWorklistUrlState } from '../hooks/useWorklistUrlState';
import { useActiveTab } from '../hooks/useActiveTab';
import { TabStrip } from '../components/reference-panel/TabStrip';
import { AnalysisTab } from '../components/reference-panel/AnalysisTab';
import { PaymentsTab } from '../components/reference-panel/PaymentsTab';
import { NotesTab } from '../components/reference-panel/NotesTab';
import { FilesTab } from '../components/reference-panel/FilesTab';
import { AppealTab } from '../components/reference-panel/AppealTab';

export function ReferencePanel(): React.ReactElement {
  const { selectedCaseId } = useWorklistUrlState();

  if (selectedCaseId === null) {
    return <ReferencePanelEmpty />;
  }

  return <ReferencePanelLoaded caseId={selectedCaseId} />;
}

// Inner so hooks aren't conditional
interface ReferencePanelLoadedProps {
  caseId: string;
}

function ReferencePanelLoaded({ caseId }: ReferencePanelLoadedProps): React.ReactElement {
  const { activeTab, setActiveTab } = useActiveTab();

  // case.detail is shared with WorkPane — same cache key, same data
  const { data, isLoading, error } = useActionQuery(
    'case.detail',
    { case_id: caseId },
  );

  // Tab counts for the badges in the strip. These query the same endpoints
  // the tab content will, so the cache is warm by the time the user clicks.
  const { data: notesData } = useActionQuery('case.notes', { case_id: caseId });
  const { data: filesData } = useActionQuery('case.files', { case_id: caseId });
  const { data: appealData } = useActionQuery('case.appeal.get', { case_id: caseId });

  const notesCount = notesData?.notes.length;
  const filesCount = filesData?.files.length;
  const hasAppealDraft = appealData !== null && appealData !== undefined;

  if (isLoading && data === undefined) {
    return (
      <section
        aria-label="Reference panel"
        className="flex h-full flex-col border-l border-slate-200 bg-white"
      >
        <TabStrip
          activeTab={activeTab}
          onTabChange={setActiveTab}
          notesCount={notesCount}
          filesCount={filesCount}
          hasAppealDraft={hasAppealDraft}
        />
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-32 rounded bg-slate-200" />
            <div className="h-2 w-full rounded bg-slate-100" />
            <div className="h-2 w-5/6 rounded bg-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  if (error !== null && data === undefined) {
    return (
      <section
        aria-label="Reference panel"
        className="flex h-full flex-col border-l border-slate-200 bg-white"
      >
        <TabStrip activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="px-4 py-3">
          <div
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800"
          >
            <div className="font-semibold">Couldn't load case</div>
            <div className="mt-0.5 text-red-700">{error.message ?? 'Network or server error'}</div>
          </div>
        </div>
      </section>
    );
  }

  if (data === undefined) {
    return <ReferencePanelEmpty />;
  }

  return (
    <section
      aria-label="Reference panel"
      className="flex h-full flex-col border-l border-slate-200 bg-white"
    >
      <TabStrip
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notesCount={notesCount}
        filesCount={filesCount}
        hasAppealDraft={hasAppealDraft}
      />
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 overflow-hidden"
      >
        {activeTab === 'analysis' && <AnalysisTab case={data} />}
        {activeTab === 'payments' && <PaymentsTab case={data} />}
        {activeTab === 'notes' && <NotesTab case={data} />}
        {activeTab === 'files' && <FilesTab case={data} />}
        {activeTab === 'appeal' && <AppealTab case={data} />}
      </div>
    </section>
  );
}

// ============================================================================
// Empty state — no case selected
// ============================================================================

function ReferencePanelEmpty(): React.ReactElement {
  return (
    <section
      aria-label="Reference panel"
      className="flex h-full flex-col items-center justify-center border-l border-slate-200 bg-slate-50 px-6 py-12"
    >
      <FolderIcon />
      <h3 className="mt-3 text-sm font-semibold text-slate-700">
        Reference panel
      </h3>
      <p className="mt-1 max-w-xs text-center text-[12.5px] text-slate-500">
        Analysis, payments, notes, files, and appeal letter for the selected
        case will appear here.
      </p>
    </section>
  );
}

function FolderIcon(): React.ReactElement {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-slate-300">
      <path d="M6 14h12l3-3h13v18a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V14z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
