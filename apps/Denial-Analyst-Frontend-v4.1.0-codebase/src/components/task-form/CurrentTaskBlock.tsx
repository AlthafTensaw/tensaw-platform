/**
 * CurrentTaskBlock (v4.1) — routes the active task's type to its completion form.
 *
 * The task-type-registry PATTERN (a switch over task_type) survives from
 * v4.0.0; the cases are the v4.1 forms (R8). Exhaustive over TaskType — adding
 * a new type without a case here fails to compile. GenericTaskForm remains the
 * fallback for the (unreachable) default.
 *
 * Drop-in path: src/components/task-form/CurrentTaskBlock.tsx
 */

import type { WorklistTask, TaskType } from '../../actions/schemas';
import { GenericTaskForm } from './GenericTaskForm';
import {
  TriageDenialForm,
  InvestigateRootCauseForm,
  CallerGetDenialReasonForm,
  PortalCheckStatusForm,
  BhavanaPullEmrForm,
  PatientOutreachForm,
  CoordinatorFacilityContactForm,
  CoderReviewRecordForm,
  ResolutionRefileClaimForm,
  ResolutionFileAppealForm,
  AwaitPayerResponseForm,
  AmDecideDispositionForm,
  PostingValidatePaymentForm,
  DemoRetrieveIdForm,
  CzarVerifyCredentialingForm,
  LiaisonExternalEscalationForm,
  BillingProcessDispositionForm,
} from './TaskForms';

export interface CurrentTaskBlockProps {
  task: WorklistTask;
  onCompleted?: () => void;
}

export function CurrentTaskBlock({ task, onCompleted }: CurrentTaskBlockProps): React.ReactElement {
  const taskType: TaskType = task.task_type;
  const props = { task, onCompleted };

  switch (taskType) {
    case 'ANALYST_TRIAGE_DENIAL':
      return <TriageDenialForm {...props} />;
    case 'ANALYST_INVESTIGATE_ROOT_CAUSE':
      return <InvestigateRootCauseForm {...props} />;
    case 'CALLER_GET_DENIAL_REASON':
      return <CallerGetDenialReasonForm {...props} />;
    case 'PORTAL_CHECK_STATUS':
      return <PortalCheckStatusForm {...props} />;
    case 'BHAVANA_PULL_EMR':
      return <BhavanaPullEmrForm {...props} />;
    case 'ANALYST_PATIENT_OUTREACH':
      return <PatientOutreachForm {...props} />;
    case 'COORDINATOR_FACILITY_CONTACT':
      return <CoordinatorFacilityContactForm {...props} />;
    case 'CODER_REVIEW_RECORD':
      return <CoderReviewRecordForm {...props} />;
    case 'RESOLUTION_REFILE_CLAIM':
      return <ResolutionRefileClaimForm {...props} />;
    case 'RESOLUTION_FILE_APPEAL':
      return <ResolutionFileAppealForm {...props} />;
    case 'ANALYST_AWAIT_PAYER_RESPONSE':
      return <AwaitPayerResponseForm {...props} />;
    case 'AM_DECIDE_DISPOSITION':
      return <AmDecideDispositionForm {...props} />;
    case 'POSTING_VALIDATE_PAYMENT':
      return <PostingValidatePaymentForm {...props} />;
    case 'DEMO_RETRIEVE_ID':
      return <DemoRetrieveIdForm {...props} />;
    case 'CZAR_VERIFY_CREDENTIALING':
      return <CzarVerifyCredentialingForm {...props} />;
    case 'LIAISON_EXTERNAL_ESCALATION':
      return <LiaisonExternalEscalationForm {...props} />;
    case 'BILLING_PROCESS_DISPOSITION':
      return <BillingProcessDispositionForm {...props} />;
    default: {
      const _exhaustive: never = taskType;
      void _exhaustive;
      return <GenericTaskForm task={task} onCompleted={onCompleted} />;
    }
  }
}
