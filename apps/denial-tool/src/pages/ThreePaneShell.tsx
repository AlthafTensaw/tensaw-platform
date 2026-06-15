import { usePermissions } from '../auth/permissions';
import { WorklistPane } from './WorklistPane';
import { WorkPane } from './WorkPane';
import { ReferencePanel } from './ReferencePanel';

export function ThreePaneShell(): JSX.Element {
  const { has } = usePermissions();
  // We use `denial.classify_claim` as the permission string for canReclassify
  const canReclassify = has('denial.classify_claim');

  return (
    <div className="grid h-[calc(100vh-52px)] grid-cols-[360px_1fr_440px] overflow-hidden">
      <WorklistPane />
      <WorkPane canReclassify={canReclassify} />
      <ReferencePanel />
    </div>
  );
}
