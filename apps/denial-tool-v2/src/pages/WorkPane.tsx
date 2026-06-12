/**
 * WorkPane — middle-pane composition for the 3-pane shell.
 *
 * Reads ?case=<case_id> from URL via useWorklistUrlState. Queries case.detail
 * and renders the state-appropriate view:
 *
 *   - No ?case=          → WorkPaneEmpty
 *   - case.detail loading→ WorkPaneSkeleton
 *   - case.detail errored→ WorkPaneError
 *   - case_status:
 *     · proposed         → ProposedView (LLM rec + Accept/Override action bar)
 *     · accepted         → InFlightView (P1.8 fills task form)
 *     · overridden       → InFlightView
 *     · completed        → CompletedView
 *
 * Drop-in path: src/pages/WorkPane.tsx
 */

import { useActionQuery } from '@tensaw/actions';
import { useWorklistUrlState } from '../hooks/useWorklistUrlState';
import {
  WorkPaneEmpty,
  WorkPaneSkeleton,
  WorkPaneError,
} from '../components/work-pane/WorkPaneStates';
import { WorkPaneHeader } from '../components/work-pane/WorkPaneHeader';
import { ProposedView } from '../components/work-pane/ProposedView';
import { InFlightView } from '../components/work-pane/InFlightView';
import { CompletedView } from '../components/work-pane/CompletedView';

export interface WorkPaneProps {
  /** Whether the caller has the denial.classify permission. Passed to
   *  ProposedView so it can show the Re-classify button. */
  canReclassify?: boolean;
}

export function WorkPane({ canReclassify = false }: WorkPaneProps): React.ReactElement {
  const { selectedCaseId } = useWorklistUrlState();

  if (selectedCaseId === null) {
    return <WorkPaneEmpty />;
  }

  return <WorkPaneLoaded caseId={selectedCaseId} canReclassify={canReclassify} />;
}

// Inner component so hooks aren't conditional
interface WorkPaneLoadedProps {
  caseId: string;
  canReclassify: boolean;
}

function WorkPaneLoaded({ caseId, canReclassify }: WorkPaneLoadedProps): React.ReactElement {
  const { data, isLoading, error, refetch } = useActionQuery(
    'case.detail',
    { case_id: caseId },
  );

  if (isLoading && data === undefined) {
    return (
      <section aria-label="Work pane" className="flex h-full flex-col bg-white">
        <WorkPaneSkeleton />
      </section>
    );
  }

  if (error !== null && data === undefined) {
    return (
      <section aria-label="Work pane" className="flex h-full flex-col bg-white">
        <WorkPaneError
          message={error.message ?? 'Network or server error'}
          onRetry={refetch}
        />
      </section>
    );
  }

  if (data === undefined) {
    // No data and no error — shouldn't happen but be defensive
    return (
      <section aria-label="Work pane" className="flex h-full flex-col bg-white">
        <WorkPaneEmpty />
      </section>
    );
  }

  return (
    <section
      aria-label="Work pane"
      className="flex h-full flex-col overflow-hidden bg-white"
    >
      <WorkPaneHeader case={data} />
      <div className="flex-1 overflow-hidden">
        {data.case_status === 'proposed' && (
          <ProposedView case={data} canReclassify={canReclassify} />
        )}
        {(data.case_status === 'accepted' || data.case_status === 'overridden') && (
          <InFlightView case={data} />
        )}
        {data.case_status === 'completed' && (
          <CompletedView case={data} />
        )}
      </div>
    </section>
  );
}
