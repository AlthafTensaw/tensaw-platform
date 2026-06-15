/**
 * Task completion forms (v4.1) — the 17 typed forms.
 *
 * Each is built on TaskFormScaffold (header + note + OutcomeActionBar + wiring)
 * and the TaskFormShell primitives, and assembles a facts_to_set object shaped
 * to its TaskFacts<T> schema (schemas §1.7). Gate-set forms first
 * (revision fork F-2): Triage, CoderReview, FileAppeal, AmDecide.
 *
 * Decision forms derive the primary OUTCOME from a field rather than offering
 * separate escape buttons:
 *   - BhavanaPullEmr:      found → SUCCESS, not found/no access → NEEDS_INFO
 *   - PatientOutreach:     info → SUCCESS, unresponsive → NEEDS_INFO
 *   - AwaitPayerResponse:  paid/overturned → SUCCESS, waiting → NEEDS_INFO, denied/upheld → FAIL_FATAL
 *   - CzarCredentialing:   verified/data_lag → SUCCESS, true_gap → FAIL_FATAL
 *
 * WIRING TODO: fact shapes are derived from handoff §6; confirm on OpenAPI regen.
 *
 * Drop-in path: src/components/task-form/TaskForms.tsx
 */

import { useState } from 'react';
import type { WorklistTask, HandlerOutcome, SubmissionMethod } from '../../actions/schemas';
import { TaskFormScaffold } from './TaskFormScaffold';
import {
  FormField,
  Input,
  Select,
  SegmentedControl,
} from './TaskFormShell';

export interface TaskFormProps {
  task: WorklistTask;
  onCompleted?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/** Yes/No segmented control bound to a boolean. */
function BoolSegment({
  name,
  value,
  onChange,
}: {
  name: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <SegmentedControl<'yes' | 'no'>
      name={name}
      value={value ? 'yes' : 'no'}
      onChange={(v) => onChange(v === 'yes')}
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
    />
  );
}

const METHOD_OPTIONS: Array<{ value: SubmissionMethod; label: string }> = [
  { value: 'PORTAL', label: 'Portal' },
  { value: 'FAX', label: 'Fax' },
  { value: 'MAIL', label: 'Mail' },
];

// ============================================================================
// GATE SET (F-2)
// ============================================================================

// 1 · ANALYST_TRIAGE_DENIAL
const CLARIFICATION_TYPES = [
  'MEDICAL_NECESSITY',
  'AUTHORIZATION',
  'CODING',
  'EMR_NEEDED',
  'CREDENTIALING',
  'DEMOGRAPHICS',
];
const APPEAL_POLICIES = ['ONE_APPEAL', 'TWO_APPEAL', 'NO_APPEAL'];

export function TriageDenialForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [clarificationType, setClarificationType] = useState(
    typeof task.case_facts.clarification_type === 'string' ? task.case_facts.clarification_type : '',
  );
  const [isHighDollar, setIsHighDollar] = useState(task.case_facts.is_high_dollar === true);
  const [appealPolicy, setAppealPolicy] = useState('');
  const [directFacilityAccess, setDirectFacilityAccess] = useState(false);
  const [faxOnFile, setFaxOnFile] = useState(false);

  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Confirm the clarification type and qualifier checks. These facts route the case to the right next team."
      primaryLabel="Complete triage"
      canSubmit={clarificationType !== '' && appealPolicy !== ''}
      getFacts={() => ({
        clarification_type: clarificationType,
        is_high_dollar: isHighDollar,
        appeal_policy: appealPolicy,
        direct_facility_access: directFacilityAccess,
        fax_number_on_file: faxOnFile,
      })}
    >
      <FormField id="clarification-type" label="Clarification type" required
        hint="Pre-filled from the LLM recommendation where available — change to override.">
        <Select
          id="clarification-type"
          value={clarificationType}
          onChange={setClarificationType}
          placeholder="— Pick a type —"
          options={CLARIFICATION_TYPES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))}
        />
      </FormField>
      <FormField id="appeal-policy" label="Appeal policy" required>
        <Select
          id="appeal-policy"
          value={appealPolicy}
          onChange={setAppealPolicy}
          placeholder="— Pick a policy —"
          options={APPEAL_POLICIES.map((p) => ({ value: p, label: p.replace(/_/g, ' ') }))}
        />
      </FormField>
      <FormField id="is-high-dollar" label="High-dollar?">
        <BoolSegment name="High-dollar" value={isHighDollar} onChange={setIsHighDollar} />
      </FormField>
      <FormField id="direct-facility-access" label="Direct facility access?">
        <BoolSegment name="Direct facility access" value={directFacilityAccess} onChange={setDirectFacilityAccess} />
      </FormField>
      <FormField id="fax-on-file" label="Fax number on file?">
        <BoolSegment name="Fax on file" value={faxOnFile} onChange={setFaxOnFile} />
      </FormField>
    </TaskFormScaffold>
  );
}

// 8 · CODER_REVIEW_RECORD
export function CoderReviewRecordForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [cptVerified, setCptVerified] = useState(false);
  const [dxVerified, setDxVerified] = useState(false);
  const [modifierVerified, setModifierVerified] = useState(false);
  const [recommendation, setRecommendation] = useState<'refile' | 'appeal' | ''>('');
  const [coderNote, setCoderNote] = useState('');

  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Verify CPT / dx / modifiers and recommend whether to refile with corrections or proceed to appeal."
      primaryLabel="Submit review"
      canSubmit={recommendation !== ''}
      getFacts={() => ({
        cpt_verified: cptVerified,
        dx_verified: dxVerified,
        modifier_verified: modifierVerified,
        recommendation,
        coder_note: coderNote === '' ? null : coderNote,
      })}
    >
      <FormField id="cpt-verified" label="CPT verified?">
        <BoolSegment name="CPT verified" value={cptVerified} onChange={setCptVerified} />
      </FormField>
      <FormField id="dx-verified" label="Diagnosis verified?">
        <BoolSegment name="Dx verified" value={dxVerified} onChange={setDxVerified} />
      </FormField>
      <FormField id="modifier-verified" label="Modifier verified?">
        <BoolSegment name="Modifier verified" value={modifierVerified} onChange={setModifierVerified} />
      </FormField>
      <FormField id="recommendation" label="Recommendation" required>
        <SegmentedControl<'refile' | 'appeal'>
          name="Recommendation"
          value={recommendation === '' ? null : recommendation}
          onChange={setRecommendation}
          options={[
            { value: 'refile', label: 'Refile (corrections)' },
            { value: 'appeal', label: 'Proceed to appeal' },
          ]}
        />
      </FormField>
      <FormField id="coder-note" label="Notes for the next handler">
        <Input id="coder-note" value={coderNote} onChange={setCoderNote} placeholder="What you found" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 10 · RESOLUTION_FILE_APPEAL
export function ResolutionFileAppealForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const priorLevel = typeof task.case_facts.appeal_level === 'number' ? task.case_facts.appeal_level : 0;
  const [appealLevel, setAppealLevel] = useState(String(priorLevel + 1));
  const [evidenceAttached, setEvidenceAttached] = useState(false);
  const [method, setMethod] = useState<SubmissionMethod | ''>('');
  const [tracking, setTracking] = useState('');

  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Record the appeal submission — level, evidence, method, and tracking number."
      primaryLabel="Mark appeal filed"
      canSubmit={method !== '' && tracking.trim() !== '' && appealLevel.trim() !== ''}
      getFacts={() => ({
        appeal_level: Number(appealLevel),
        evidence_attached: evidenceAttached,
        submission_method: method,
        tracking_number: tracking.trim(),
      })}
    >
      <FormField id="appeal-level" label="Appeal level" required>
        <Input id="appeal-level" type="number" value={appealLevel} onChange={setAppealLevel} />
      </FormField>
      <FormField id="evidence-attached" label="Evidence attached?">
        <BoolSegment name="Evidence attached" value={evidenceAttached} onChange={setEvidenceAttached} />
      </FormField>
      <FormField id="appeal-method" label="Submission method" required>
        <SegmentedControl<SubmissionMethod>
          name="Submission method"
          value={method === '' ? null : method}
          onChange={setMethod}
          options={METHOD_OPTIONS}
        />
      </FormField>
      <FormField id="appeal-tracking" label="Tracking #" required>
        <Input id="appeal-tracking" value={tracking} onChange={setTracking} placeholder="e.g. APP-2026-061201" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 12 · AM_DECIDE_DISPOSITION
export function AmDecideDispositionForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [disposition, setDisposition] = useState<'write_off' | 'cash_rate' | 'escalate' | ''>('');
  const [note, setNote] = useState('');

  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Decide the disposition for this denial: write-off, accept the cash rate, or escalate."
      primaryLabel="Record disposition"
      canSubmit={disposition !== ''}
      getFacts={() => ({
        disposition,
        disposition_note: note === '' ? null : note,
      })}
    >
      <FormField id="disposition" label="Disposition" required>
        <SegmentedControl<'write_off' | 'cash_rate' | 'escalate'>
          name="Disposition"
          value={disposition === '' ? null : disposition}
          onChange={setDisposition}
          options={[
            { value: 'write_off', label: 'Write off' },
            { value: 'cash_rate', label: 'Cash rate' },
            { value: 'escalate', label: 'Escalate' },
          ]}
        />
      </FormField>
      <FormField id="disposition-note" label="Notes for the audit trail">
        <Input id="disposition-note" value={note} onChange={setNote} placeholder="Optional" />
      </FormField>
    </TaskFormScaffold>
  );
}

// ============================================================================
// BATCH 2 (the remaining 13)
// ============================================================================

// 2 · ANALYST_INVESTIGATE_ROOT_CAUSE
export function InvestigateRootCauseForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [rootCause, setRootCause] = useState('');
  const [routeToCaller, setRouteToCaller] = useState(false);
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Capture the real denial reason. Route to the calling team if a payer call is needed."
      primaryLabel="Submit findings"
      canSubmit={rootCause.trim() !== ''}
      getFacts={() => ({ root_cause: rootCause.trim(), route_to_caller: routeToCaller })}
      showNeedsInfo
    >
      <FormField id="root-cause" label="Root cause" required>
        <Input id="root-cause" value={rootCause} onChange={setRootCause} placeholder="What actually caused the denial" />
      </FormField>
      <FormField id="route-to-caller" label="Route to calling team?">
        <BoolSegment name="Route to caller" value={routeToCaller} onChange={setRouteToCaller} />
      </FormField>
    </TaskFormScaffold>
  );
}

// 3 · CALLER_GET_DENIAL_REASON
export function CallerGetDenialReasonForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [ref, setRef] = useState('');
  const [rootCause, setRootCause] = useState('');
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Call the payer; capture the call reference number and the denial reason."
      primaryLabel="Log call"
      canSubmit={ref.trim() !== '' && rootCause.trim() !== ''}
      getFacts={() => ({ call_reference_number: ref.trim(), root_cause: rootCause.trim() })}
      showNeedsInfo
    >
      <FormField id="call-ref" label="Call reference #" required>
        <Input id="call-ref" value={ref} onChange={setRef} placeholder="e.g. CALL-887234" />
      </FormField>
      <FormField id="caller-root-cause" label="Denial reason" required>
        <Input id="caller-root-cause" value={rootCause} onChange={setRootCause} placeholder="What the payer said" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 4 · PORTAL_CHECK_STATUS
export function PortalCheckStatusForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState('');
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Look up the claim status in the payer portal and record it."
      primaryLabel="Record status"
      canSubmit={status.trim() !== ''}
      getFacts={() => ({ portal_status: status.trim(), portal_detail: detail === '' ? null : detail })}
      showNeedsInfo
    >
      <FormField id="portal-status" label="Portal status" required>
        <Input id="portal-status" value={status} onChange={setStatus} placeholder="e.g. in_review / finalized" />
      </FormField>
      <FormField id="portal-detail" label="Detail">
        <Input id="portal-detail" value={detail} onChange={setDetail} placeholder="Optional" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 5 · BHAVANA_PULL_EMR  (decision: found → SUCCESS, else → NEEDS_INFO)
export function BhavanaPullEmrForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [found, setFound] = useState<'yes' | 'no' | ''>('');
  const [reason, setReason] = useState('');
  const isFound = found === 'yes';
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Did the EMR have the requested item? If not, note why (no access / not found)."
      primaryLabel={isFound ? 'Record — found' : 'Record — not available'}
      primaryOutcome={isFound ? 'SUCCESS' : 'NEEDS_INFO'}
      canSubmit={found !== '' && (isFound || reason.trim() !== '')}
      getFacts={() => ({
        emr_item_found: isFound,
        unavailable_reason: isFound ? null : reason.trim(),
      })}
    >
      <FormField id="emr-found" label="Item found in EMR?" required>
        <SegmentedControl<'yes' | 'no'>
          name="EMR found"
          value={found === '' ? null : found}
          onChange={setFound}
          options={[{ value: 'yes', label: 'Found' }, { value: 'no', label: 'Not found / no access' }]}
        />
      </FormField>
      {found === 'no' && (
        <FormField id="emr-reason" label="Why unavailable?" required>
          <Input id="emr-reason" value={reason} onChange={setReason} placeholder="No access / not in record / …" />
        </FormField>
      )}
    </TaskFormScaffold>
  );
}

// 6 · ANALYST_PATIENT_OUTREACH  (decision: info_obtained → SUCCESS, else → NEEDS_INFO)
export function PatientOutreachForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [method, setMethod] = useState<'call' | 'sms' | 'letter' | ''>('');
  const [result, setResult] = useState<'info_obtained' | 'unresponsive' | ''>('');
  const [note, setNote] = useState('');
  const success = result === 'info_obtained';
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Log the patient outreach attempt and its result."
      primaryLabel={success ? 'Record — info obtained' : 'Record — unresponsive'}
      primaryOutcome={success ? 'SUCCESS' : 'NEEDS_INFO'}
      canSubmit={method !== '' && result !== ''}
      getFacts={() => ({
        outreach_method: method,
        outreach_result: result,
        outreach_note: note === '' ? null : note,
      })}
    >
      <FormField id="outreach-method" label="Method" required>
        <SegmentedControl<'call' | 'sms' | 'letter'>
          name="Outreach method"
          value={method === '' ? null : method}
          onChange={setMethod}
          options={[{ value: 'call', label: 'Call' }, { value: 'sms', label: 'SMS' }, { value: 'letter', label: 'Letter' }]}
        />
      </FormField>
      <FormField id="outreach-result" label="Result" required>
        <SegmentedControl<'info_obtained' | 'unresponsive'>
          name="Outreach result"
          value={result === '' ? null : result}
          onChange={setResult}
          options={[{ value: 'info_obtained', label: 'Info obtained' }, { value: 'unresponsive', label: 'Unresponsive' }]}
        />
      </FormField>
      <FormField id="outreach-note" label="Note">
        <Input id="outreach-note" value={note} onChange={setNote} placeholder="Optional" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 7 · COORDINATOR_FACILITY_CONTACT
export function CoordinatorFacilityContactForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Record the result of contacting the facility."
      primaryLabel="Log contact"
      canSubmit={result.trim() !== ''}
      getFacts={() => ({ contact_result: result.trim(), contact_note: note === '' ? null : note })}
      showNeedsInfo
    >
      <FormField id="contact-result" label="Contact result" required>
        <Input id="contact-result" value={result} onChange={setResult} placeholder="e.g. reached / left message" />
      </FormField>
      <FormField id="contact-note" label="Note">
        <Input id="contact-note" value={note} onChange={setNote} placeholder="Optional" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 9 · RESOLUTION_REFILE_CLAIM
export function ResolutionRefileClaimForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [content, setContent] = useState('');
  const [method, setMethod] = useState<SubmissionMethod | ''>('');
  const [tracking, setTracking] = useState('');
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Record the refiled claim — what changed, the method, and the tracking number."
      primaryLabel="Mark refiled"
      canSubmit={content.trim() !== '' && method !== '' && tracking.trim() !== ''}
      getFacts={() => ({
        refiled_content: content.trim(),
        submission_method: method,
        tracking_number: tracking.trim(),
      })}
    >
      <FormField id="refile-content" label="What was refiled" required>
        <Input id="refile-content" value={content} onChange={setContent} placeholder="e.g. corrected CPT 99214→99215" />
      </FormField>
      <FormField id="refile-method" label="Submission method" required>
        <SegmentedControl<SubmissionMethod>
          name="Submission method"
          value={method === '' ? null : method}
          onChange={setMethod}
          options={METHOD_OPTIONS}
        />
      </FormField>
      <FormField id="refile-tracking" label="Tracking #" required>
        <Input id="refile-tracking" value={tracking} onChange={setTracking} placeholder="e.g. RF-001" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 11 · ANALYST_AWAIT_PAYER_RESPONSE  (decision drives outcome)
export function AwaitPayerResponseForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [decision, setDecision] = useState<'paid' | 'overturned' | 'still_waiting' | 'denied' | 'upheld' | ''>('');
  const [note, setNote] = useState('');

  const outcome: HandlerOutcome =
    decision === 'paid' || decision === 'overturned'
      ? 'SUCCESS'
      : decision === 'still_waiting'
        ? 'NEEDS_INFO'
        : 'FAIL_FATAL';

  const primaryLabel =
    decision === 'still_waiting' ? 'Defer — still waiting'
      : decision === 'denied' || decision === 'upheld' ? 'Record — denied'
        : 'Record — resolved';

  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Has the payer responded? Record the decision — it determines how the case proceeds."
      primaryLabel={primaryLabel}
      primaryOutcome={outcome}
      canSubmit={decision !== ''}
      getFacts={() => ({
        response_received: decision !== 'still_waiting',
        payer_decision: decision === '' ? null : decision,
        response_note: note === '' ? null : note,
      })}
    >
      <FormField id="payer-decision" label="Payer decision" required>
        <Select
          id="payer-decision"
          value={decision}
          onChange={(v) => setDecision(v as typeof decision)}
          placeholder="— Pick a decision —"
          options={[
            { value: 'paid', label: 'Paid' },
            { value: 'overturned', label: 'Overturned (approved)' },
            { value: 'still_waiting', label: 'Still waiting' },
            { value: 'denied', label: 'Denied' },
            { value: 'upheld', label: 'Upheld (denial stands)' },
          ]}
        />
      </FormField>
      <FormField id="payer-note" label="Note">
        <Input id="payer-note" value={note} onChange={setNote} placeholder="ERA reference, etc." />
      </FormField>
    </TaskFormScaffold>
  );
}

// 13 · POSTING_VALIDATE_PAYMENT
export function PostingValidatePaymentForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [priorVerified, setPriorVerified] = useState(false);
  const [recoupChecked, setRecoupChecked] = useState(false);
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Verify the prior payment and check for any recoupment before closing."
      primaryLabel="Validate payment"
      canSubmit
      getFacts={() => ({ prior_payment_verified: priorVerified, recoupment_checked: recoupChecked })}
    >
      <FormField id="prior-verified" label="Prior payment verified?">
        <BoolSegment name="Prior payment verified" value={priorVerified} onChange={setPriorVerified} />
      </FormField>
      <FormField id="recoup-checked" label="Recoupment checked?">
        <BoolSegment name="Recoupment checked" value={recoupChecked} onChange={setRecoupChecked} />
      </FormField>
    </TaskFormScaffold>
  );
}

// 14 · DEMO_RETRIEVE_ID
export function DemoRetrieveIdForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [idType, setIdType] = useState<'medicare' | 'medicaid' | ''>('');
  const [idValue, setIdValue] = useState('');
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Retrieve the patient's Medicare/Medicaid ID."
      primaryLabel="Record ID"
      canSubmit={idType !== '' && idValue.trim() !== ''}
      getFacts={() => ({ id_type: idType, id_value: idValue.trim() })}
      showNeedsInfo
    >
      <FormField id="id-type" label="ID type" required>
        <SegmentedControl<'medicare' | 'medicaid'>
          name="ID type"
          value={idType === '' ? null : idType}
          onChange={setIdType}
          options={[{ value: 'medicare', label: 'Medicare' }, { value: 'medicaid', label: 'Medicaid' }]}
        />
      </FormField>
      <FormField id="id-value" label="ID value" required>
        <Input id="id-value" value={idValue} onChange={setIdValue} placeholder="e.g. 1EG4-TE5-MK72" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 15 · CZAR_VERIFY_CREDENTIALING  (decision: true_gap → FAIL_FATAL)
export function CzarVerifyCredentialingForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [status, setStatus] = useState<'verified' | 'data_lag' | 'true_gap' | ''>('');
  const [npi, setNpi] = useState('');
  const outcome: HandlerOutcome = status === 'true_gap' ? 'FAIL_FATAL' : 'SUCCESS';
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Verify NPI / taxonomy / credentialing. A true gap closes to AM; a data lag proceeds to appeal."
      primaryLabel={status === 'true_gap' ? 'Record — true gap' : 'Record — verified'}
      primaryOutcome={outcome}
      canSubmit={status !== ''}
      getFacts={() => ({
        credentialing_status: status,
        npi_or_taxonomy: npi === '' ? null : npi.trim(),
      })}
    >
      <FormField id="cred-status" label="Credentialing status" required>
        <SegmentedControl<'verified' | 'data_lag' | 'true_gap'>
          name="Credentialing status"
          value={status === '' ? null : status}
          onChange={setStatus}
          options={[
            { value: 'verified', label: 'Verified' },
            { value: 'data_lag', label: 'Data lag' },
            { value: 'true_gap', label: 'True gap' },
          ]}
        />
      </FormField>
      <FormField id="npi" label="NPI / taxonomy">
        <Input id="npi" value={npi} onChange={setNpi} placeholder="Optional" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 16 · LIAISON_EXTERNAL_ESCALATION
export function LiaisonExternalEscalationForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Record the result of the external escalation."
      primaryLabel="Log escalation"
      canSubmit={result.trim() !== ''}
      getFacts={() => ({ escalation_result: result.trim(), escalation_note: note === '' ? null : note })}
      showNeedsInfo
    >
      <FormField id="escalation-result" label="Escalation result" required>
        <Input id="escalation-result" value={result} onChange={setResult} placeholder="e.g. submitted / acknowledged" />
      </FormField>
      <FormField id="escalation-note" label="Note">
        <Input id="escalation-note" value={note} onChange={setNote} placeholder="Optional" />
      </FormField>
    </TaskFormScaffold>
  );
}

// 17 · BILLING_PROCESS_DISPOSITION
export function BillingProcessDispositionForm({ task, onCompleted }: TaskFormProps): React.ReactElement {
  const [applied, setApplied] = useState<'cash_rate' | 'write_off' | ''>('');
  const [note, setNote] = useState('');
  return (
    <TaskFormScaffold
      task={task}
      onCompleted={onCompleted}
      intro="Apply the cash-rate or write-off disposition decided by AM."
      primaryLabel="Apply disposition"
      canSubmit={applied !== ''}
      getFacts={() => ({ disposition_applied: applied, billing_note: note === '' ? null : note })}
    >
      <FormField id="disposition-applied" label="Disposition applied" required>
        <SegmentedControl<'cash_rate' | 'write_off'>
          name="Disposition applied"
          value={applied === '' ? null : applied}
          onChange={setApplied}
          options={[{ value: 'cash_rate', label: 'Cash rate' }, { value: 'write_off', label: 'Write off' }]}
        />
      </FormField>
      <FormField id="billing-note" label="Note">
        <Input id="billing-note" value={note} onChange={setNote} placeholder="Optional" />
      </FormField>
    </TaskFormScaffold>
  );
}
