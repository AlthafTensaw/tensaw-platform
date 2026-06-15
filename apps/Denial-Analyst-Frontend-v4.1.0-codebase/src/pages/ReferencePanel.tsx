/**
 * ReferencePanel (v4.1) — right-pane composition for the engine-handler model.
 *
 * Reads ?case=; queries case.detail (shared cache with WorkPane).
 * Renders TabStrip (reused) + the active tab. AnalysisTab is the v41 version
 * (case_facts-driven); Notes/Files/Appeal/Payments are the now-version-agnostic
 * shared tabs (caseId prop).
 *
 * ?tab=<analysis|payments|notes|files|appeal>
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
  if (selectedCaseId === null) return <ReferencePanelEmpty />;
  return <ReferencePanelLoaded caseId={selectedCaseId} />;
}

function ReferencePanelLoaded({ caseId }: { caseId: string }): React.ReactElement {
  const { activeTab, setActiveTab } = useActiveTab();

  const { data, isLoading, error } = useActionQuery('case.detail', { case_id: caseId });

  const { data: notesData } = useActionQuery('case.notes', { case_id: caseId });
  const { data: filesData } = useActionQuery('case.files', { case_id: caseId });
  const { data: appealData } = useActionQuery('case.appeal.get', { case_id: caseId });

  const notesCount = notesData?.notes.length;
  const filesCount = filesData?.files.length;
  const hasAppealDraft = appealData !== null && appealData !== undefined;

  const Shell = ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <section aria-label="Reference panel" className="flex h-full flex-col border-l border-slate-200 bg-white">
      <TabStrip
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notesCount={notesCount}
        filesCount={filesCount}
        hasAppealDraft={hasAppealDraft}
      />
      {children}
    </section>
  );

  if (isLoading && data === undefined) {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-32 rounded bg-slate-200" />
            <div className="h-2 w-full rounded bg-slate-100" />
            <div className="h-2 w-5/6 rounded bg-slate-100" />
          </div>
        </div>
      </Shell>
    );
  }

  if (error !== null && data === undefined) {
    return (
      <Shell>
        <div className="px-4 py-3">
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            <div className="font-semibold">Couldn't load case</div>
            <div className="mt-0.5 text-red-700">{error.message ?? 'Network or server error'}</div>
          </div>
        </div>
      </Shell>
    );
  }

  if (data === undefined) return <ReferencePanelEmpty />;

  return (
    <Shell>
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 overflow-hidden"
      >
        {activeTab === 'analysis' && <AnalysisTab detail={data} />}
        {activeTab === 'payments' && <PaymentsTab caseId={caseId} />}
        {activeTab === 'notes' && <NotesTab caseId={caseId} />}
        {activeTab === 'files' && <FilesTab caseId={caseId} />}
        {activeTab === 'appeal' && <AppealTab caseId={caseId} />}
      </div>
    </Shell>
  );
}

function ReferencePanelEmpty(): React.ReactElement {
  return (
    <section
      aria-label="Reference panel"
      className="flex h-full flex-col items-center justify-center border-l border-slate-200 bg-slate-50 px-6 py-12"
    >
      <FolderIcon />
      <h3 className="mt-3 text-sm font-semibold text-slate-700">Reference panel</h3>
      <p className="mt-1 max-w-xs text-center text-[12.5px] text-slate-500">
        Analysis, payments, notes, files, and appeal letter for the selected case will appear here.
      </p>
    </section>
  );
}

function FolderIcon(): React.ReactElement {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-slate-300">
      <path d="M6 14h12l3-3h13v18a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V14z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
