/**
 * R8 interaction tests — the gate-set task forms (revision fork F-2).
 *
 * For TriageDenial, CoderReview, ResolutionFileAppeal, AmDecide:
 *   - primary button disabled until required fields are set
 *   - submit fires worklist.complete with the right facts_to_set
 * Plus a decision-form check (AwaitPayer → outcome mapping).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  TriageDenialForm,
  CoderReviewRecordForm,
  ResolutionFileAppealForm,
  AmDecideDispositionForm,
  AwaitPayerResponseForm,
} from '../src/components/task-form/TaskForms';
import { __setMutationMock } from '../stubs/tensaw/actions';
import { makeTask, setupV41Mocks } from '../src/test/helpers';

describe('v4.1 gate-set task forms', () => {
  beforeEach(() => {
    setupV41Mocks();
  });

  // ── ANALYST_TRIAGE_DENIAL ────────────────────────────────────────────────
  describe('TriageDenialForm', () => {
    it('disables Complete until clarification type + appeal policy are set', async () => {
      const user = userEvent.setup();
      render(<TriageDenialForm task={makeTask('ANALYST_TRIAGE_DENIAL')} />);

      const submit = screen.getByRole('button', { name: /complete triage/i });
      expect(submit).toBeDisabled();

      await user.selectOptions(screen.getByLabelText(/clarification type/i), 'AUTHORIZATION');
      expect(submit).toBeDisabled(); // appeal policy still unset

      await user.selectOptions(screen.getByLabelText(/appeal policy/i), 'ONE_APPEAL');
      await waitFor(() => expect(submit).not.toBeDisabled());
    });

    it('fires worklist.complete with the triage facts', async () => {
      const spy = vi.fn().mockResolvedValue(makeTask('ANALYST_TRIAGE_DENIAL', { status: 'COMPLETED' }));
      __setMutationMock('worklist.complete', spy);

      const user = userEvent.setup();
      render(<TriageDenialForm task={makeTask('ANALYST_TRIAGE_DENIAL')} />);

      await user.selectOptions(screen.getByLabelText(/clarification type/i), 'CODING');
      await user.selectOptions(screen.getByLabelText(/appeal policy/i), 'ONE_APPEAL');
      await user.click(screen.getByRole('button', { name: /complete triage/i }));

      await waitFor(() => expect(spy).toHaveBeenCalled());
      const arg = spy.mock.calls[0][0];
      expect(arg.task_id).toBe('T-ANALYST_TRIAGE_DENIAL');
      expect(arg.outcome).toBe('SUCCESS');
      expect(arg.facts_to_set.clarification_type).toBe('CODING');
      expect(arg.facts_to_set.appeal_policy).toBe('ONE_APPEAL');
      expect(typeof arg.facts_to_set.is_high_dollar).toBe('boolean');
    });
  });

  // ── CODER_REVIEW_RECORD ──────────────────────────────────────────────────
  describe('CoderReviewRecordForm', () => {
    it('disables Submit until a recommendation is picked', async () => {
      const user = userEvent.setup();
      render(<CoderReviewRecordForm task={makeTask('CODER_REVIEW_RECORD')} />);

      const submit = screen.getByRole('button', { name: /submit review/i });
      expect(submit).toBeDisabled();

      await user.click(screen.getByRole('radio', { name: /proceed to appeal/i }));
      await waitFor(() => expect(submit).not.toBeDisabled());
    });

    it('fires worklist.complete with recommendation + verify flags', async () => {
      const spy = vi.fn().mockResolvedValue(makeTask('CODER_REVIEW_RECORD', { status: 'COMPLETED' }));
      __setMutationMock('worklist.complete', spy);

      const user = userEvent.setup();
      render(<CoderReviewRecordForm task={makeTask('CODER_REVIEW_RECORD')} />);

      // Toggle CPT verified → Yes (scope to its group; three Yes/No groups exist)
      const cptGroup = screen.getByRole('radiogroup', { name: /cpt verified/i });
      await user.click(within(cptGroup).getByRole('radio', { name: /yes/i }));
      await user.click(screen.getByRole('radio', { name: /refile \(corrections\)/i }));
      await user.click(screen.getByRole('button', { name: /submit review/i }));

      await waitFor(() => expect(spy).toHaveBeenCalled());
      const facts = spy.mock.calls[0][0].facts_to_set;
      expect(facts.recommendation).toBe('refile');
      expect(typeof facts.cpt_verified).toBe('boolean');
      expect(typeof facts.modifier_verified).toBe('boolean');
    });
  });

  // ── RESOLUTION_FILE_APPEAL ───────────────────────────────────────────────
  describe('ResolutionFileAppealForm', () => {
    it('disables until method + tracking are set; pre-fills level', async () => {
      const user = userEvent.setup();
      render(
        <ResolutionFileAppealForm
          task={makeTask('RESOLUTION_FILE_APPEAL', { case_facts: { is_high_dollar: false, appeal_level: 1 } })}
        />,
      );

      // level pre-filled to 2
      expect(screen.getByLabelText(/appeal level/i)).toHaveValue(2);

      const submit = screen.getByRole('button', { name: /mark appeal filed/i });
      expect(submit).toBeDisabled();

      await user.click(screen.getByRole('radio', { name: /fax/i }));
      expect(submit).toBeDisabled(); // tracking still empty

      await user.type(screen.getByLabelText(/tracking #/i), 'AP-2026-1');
      await waitFor(() => expect(submit).not.toBeDisabled());
    });

    it('fires worklist.complete with appeal facts', async () => {
      const spy = vi.fn().mockResolvedValue(makeTask('RESOLUTION_FILE_APPEAL', { status: 'COMPLETED' }));
      __setMutationMock('worklist.complete', spy);

      const user = userEvent.setup();
      render(<ResolutionFileAppealForm task={makeTask('RESOLUTION_FILE_APPEAL')} />);

      await user.click(screen.getByRole('radio', { name: /portal/i }));
      await user.type(screen.getByLabelText(/tracking #/i), 'AP-1');
      await user.click(screen.getByRole('button', { name: /mark appeal filed/i }));

      await waitFor(() => expect(spy).toHaveBeenCalled());
      const facts = spy.mock.calls[0][0].facts_to_set;
      expect(facts.submission_method).toBe('PORTAL');
      expect(facts.tracking_number).toBe('AP-1');
      expect(typeof facts.appeal_level).toBe('number');
    });
  });

  // ── AM_DECIDE_DISPOSITION ────────────────────────────────────────────────
  describe('AmDecideDispositionForm', () => {
    it('disables until a disposition is picked, then fires with it', async () => {
      const spy = vi.fn().mockResolvedValue(makeTask('AM_DECIDE_DISPOSITION', { status: 'COMPLETED' }));
      __setMutationMock('worklist.complete', spy);

      const user = userEvent.setup();
      render(<AmDecideDispositionForm task={makeTask('AM_DECIDE_DISPOSITION')} />);

      const submit = screen.getByRole('button', { name: /record disposition/i });
      expect(submit).toBeDisabled();

      await user.click(screen.getByRole('radio', { name: /escalate/i }));
      await waitFor(() => expect(submit).not.toBeDisabled());

      await user.click(submit);
      await waitFor(() => expect(spy).toHaveBeenCalled());
      expect(spy.mock.calls[0][0].facts_to_set.disposition).toBe('escalate');
    });
  });

  // ── Decision form: AwaitPayer outcome mapping ────────────────────────────
  describe('AwaitPayerResponseForm (decision → outcome)', () => {
    it('maps "denied" to a FAIL_FATAL outcome', async () => {
      const spy = vi.fn().mockResolvedValue(makeTask('ANALYST_AWAIT_PAYER_RESPONSE', { status: 'COMPLETED' }));
      __setMutationMock('worklist.complete', spy);

      const user = userEvent.setup();
      render(<AwaitPayerResponseForm task={makeTask('ANALYST_AWAIT_PAYER_RESPONSE')} />);

      await user.selectOptions(screen.getByLabelText(/payer decision/i), 'denied');
      await user.click(screen.getByRole('button', { name: /record — denied/i }));

      await waitFor(() => expect(spy).toHaveBeenCalled());
      expect(spy.mock.calls[0][0].outcome).toBe('FAIL_FATAL');
      expect(spy.mock.calls[0][0].facts_to_set.payer_decision).toBe('denied');
    });

    it('maps "paid" to a SUCCESS outcome', async () => {
      const spy = vi.fn().mockResolvedValue(makeTask('ANALYST_AWAIT_PAYER_RESPONSE', { status: 'COMPLETED' }));
      __setMutationMock('worklist.complete', spy);

      const user = userEvent.setup();
      render(<AwaitPayerResponseForm task={makeTask('ANALYST_AWAIT_PAYER_RESPONSE')} />);

      await user.selectOptions(screen.getByLabelText(/payer decision/i), 'paid');
      await user.click(screen.getByRole('button', { name: /record — resolved/i }));

      await waitFor(() => expect(spy).toHaveBeenCalled());
      expect(spy.mock.calls[0][0].outcome).toBe('SUCCESS');
    });
  });
});
