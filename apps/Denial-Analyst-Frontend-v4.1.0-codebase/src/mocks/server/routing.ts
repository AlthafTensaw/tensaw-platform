/**
 * Mock dispatch routing for the v4.1 engine-handler simulator.
 *
 * Replaces v4.0.0's fixed-workflow model (ordered step arrays). In the
 * corrected model the engine is a state machine that, on each task completion,
 * decides the NEXT task and dispatches it to a team's queue. There is no fixed
 * N-step workflow to preview and no user_<id> return — work flows forward
 * team→team.
 *
 * This module encodes a plausible denial routing graph as a pure function:
 *   nextDispatch(task_type, outcome, facts) → { task_type, team } | null
 * where null means the case is resolved (it leaves the worklist).
 *
 * Drop-in path: src/mocks/server/routing.ts
 *
 * WIRING TODO: this graph is a mock approximation for dev/testing. The real
 * routing lives in the workflow engine. Faithful enough to walk cases
 * end-to-end; not a contract.
 */

import type { TaskType, Team } from '../../actions/schemas';
import { TASK_TYPE_DEFAULT_TEAM } from '../../actions/schemas';

export interface Dispatch {
  task_type: TaskType;
  team: Team;
}

type Outcome = 'SUCCESS' | 'NEEDS_INFO' | 'FAIL_FATAL';
type Facts = Record<string, unknown>;

/** Convenience: a dispatch to a task type using its default team. */
function to(task_type: TaskType): Dispatch {
  return { task_type, team: TASK_TYPE_DEFAULT_TEAM[task_type] };
}

/**
 * The routing function. Returns the next dispatch, or null when the case is
 * resolved. NEEDS_INFO generally re-dispatches the same task (the "park +
 * re-dispatch" behavior, collapsed to immediate for the mock).
 */
export function nextDispatch(
  task_type: TaskType,
  outcome: Outcome,
  facts: Facts,
): Dispatch | null {
  // NEEDS_INFO: re-dispatch the same task type (engine parks + re-dispatches).
  // A few task types route NEEDS_INFO elsewhere (handled in their cases below).
  const reDispatchSame: Dispatch = to(task_type);

  switch (task_type) {
    case 'ANALYST_TRIAGE_DENIAL': {
      if (outcome === 'FAIL_FATAL') return to('AM_DECIDE_DISPOSITION');
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      // SUCCESS — branch on clarification_type
      switch (facts.clarification_type) {
        case 'CODING':
          return to('CODER_REVIEW_RECORD');
        case 'AUTHORIZATION':
          return to('CALLER_GET_DENIAL_REASON');
        case 'MEDICAL_NECESSITY':
          return to('RESOLUTION_FILE_APPEAL');
        case 'EMR_NEEDED':
          return to('BHAVANA_PULL_EMR');
        case 'CREDENTIALING':
          return to('CZAR_VERIFY_CREDENTIALING');
        case 'DEMOGRAPHICS':
          return to('DEMO_RETRIEVE_ID');
        default:
          return to('ANALYST_INVESTIGATE_ROOT_CAUSE');
      }
    }

    case 'ANALYST_INVESTIGATE_ROOT_CAUSE': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return facts.route_to_caller === true
        ? to('CALLER_GET_DENIAL_REASON')
        : to('CODER_REVIEW_RECORD');
    }

    case 'CALLER_GET_DENIAL_REASON': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return to('RESOLUTION_FILE_APPEAL');
    }

    case 'PORTAL_CHECK_STATUS': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return to('ANALYST_AWAIT_PAYER_RESPONSE');
    }

    case 'BHAVANA_PULL_EMR': {
      // NEEDS_INFO (no access / not found) → escalate to patient outreach
      if (outcome === 'NEEDS_INFO') return to('ANALYST_PATIENT_OUTREACH');
      return to('RESOLUTION_FILE_APPEAL');
    }

    case 'ANALYST_PATIENT_OUTREACH': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return to('RESOLUTION_FILE_APPEAL');
    }

    case 'COORDINATOR_FACILITY_CONTACT': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return to('RESOLUTION_REFILE_CLAIM');
    }

    case 'CODER_REVIEW_RECORD': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      // SUCCESS — recommendation drives refile vs appeal
      return facts.recommendation === 'refile'
        ? to('RESOLUTION_REFILE_CLAIM')
        : to('RESOLUTION_FILE_APPEAL');
    }

    case 'RESOLUTION_REFILE_CLAIM':
      return to('ANALYST_AWAIT_PAYER_RESPONSE');

    case 'RESOLUTION_FILE_APPEAL':
      return to('ANALYST_AWAIT_PAYER_RESPONSE');

    case 'ANALYST_AWAIT_PAYER_RESPONSE': {
      // FAIL_FATAL (denied / upheld) → AM disposition
      if (outcome === 'FAIL_FATAL') return to('AM_DECIDE_DISPOSITION');
      // NEEDS_INFO (still waiting) → re-dispatch the await check
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      // SUCCESS (paid / overturned) → posting
      return to('POSTING_VALIDATE_PAYMENT');
    }

    case 'AM_DECIDE_DISPOSITION': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return facts.disposition === 'escalate'
        ? to('LIAISON_EXTERNAL_ESCALATION')
        : to('BILLING_PROCESS_DISPOSITION');
    }

    case 'POSTING_VALIDATE_PAYMENT':
      return null; // resolved

    case 'BILLING_PROCESS_DISPOSITION':
      return null; // resolved

    case 'DEMO_RETRIEVE_ID': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return to('RESOLUTION_REFILE_CLAIM');
    }

    case 'CZAR_VERIFY_CREDENTIALING': {
      // FAIL_FATAL (true gap) → AM
      if (outcome === 'FAIL_FATAL') return to('AM_DECIDE_DISPOSITION');
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      // SUCCESS (data lag) → appeal
      return to('RESOLUTION_FILE_APPEAL');
    }

    case 'LIAISON_EXTERNAL_ESCALATION': {
      if (outcome === 'NEEDS_INFO') return reDispatchSame;
      return null; // handed off externally; resolved from the worklist's POV
    }
  }
}

/**
 * A short human-readable label for the engine state code derived from the
 * current open task. Display-only; the FE treats state_code as opaque.
 */
export function stateCodeForTask(task_type: TaskType): string {
  // Mock convention: the state code is the task type minus any verb prefix,
  // upper-snake. Real engine emits its own codes.
  return task_type;
}
