/**
 * AnalysisTab tests — v3.0.1.
 *
 * Coverage:
 *   - Denial pattern callout derives from events ("1st denial..." / "3rd denial...")
 *   - Events grouped by procedure_code; events with null procedure_code are
 *     skipped (BE Ask 9 guarantees population; we defensively drop nulls
 *     instead of creating a phantom "__unknown__" group as v3.0.0 did)
 *   - Reverse-chronological order within each CPT
 *   - Current event marker on the most-recent event globally
 *   - Per-CPT cards default expanded when current event lives in that CPT;
 *     others default collapsed
 *   - Toggle expand/collapse via header click
 *   - Paid CPT shows "No denials on this line — paid in full" empty state
 *   - Events with no remit codes show the "must call payer" empty state
 *   - Multi-CPT ordering: denied first by balance desc, paid after
 *
 * Mocks the two hooks (useLineItems + useActionQuery for events) directly.
 * Skips MSW because the unit-test boundary is the component, not the wire.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AnalysisTab } from '../AnalysisTab';
import type {
  Classification,
  ClaimSummary,
  DenialEvent,
  WorklistRow,
} from '../../../../actions/schemas';
import type { LineItem } from '../../../../actions/schemasV3';

// ---- mocks ----------------------------------------------------------------

const mockLineItems = vi.fn<() => { line_items: LineItem[] } | undefined>();
const mockDenialEvents = vi.fn<() => DenialEvent[] | undefined>();

vi.mock('../../../../hooks/useTabData', () => ({
  useLineItems: () => ({
    data: mockLineItems()
      ? { claim_id: '300138', line_items: mockLineItems()!.line_items }
      : undefined,
    isLoading: mockLineItems() === undefined,
    error: null,
  }),
}));

vi.mock('@tensaw/actions', () => ({
  useActionQuery: () => ({
    data: mockDenialEvents(),
    isLoading: mockDenialEvents() === undefined,
    error: null,
  }),
}));

// ---- fixtures -------------------------------------------------------------

function buildLineItem(overrides: Partial<LineItem> = {}): LineItem {
  return {
    line_id: 'li-1',
    procedure_code: '99214',
    procedure_description: 'Office visit, Level 4',
    modifiers: [],
    billed: '250.00',
    allowed: '180.00',
    contractual_adjustment: '70.00',
    coinsurance: '0.00',
    deductible: '0.00',
    insurance_paid: '0.00',
    patient_paid: '20.00',
    balance: '230.00',
    line_status: 'denied',
    service_date: '2026-02-24',
    ...overrides,
  };
}

function buildEvent(overrides: Partial<DenialEvent> = {}): DenialEvent {
  return {
    event_id: 1,
    classification_id: 'class-1',
    claim_id: 300138,
    occurred_at: '2026-05-18T08:00:00Z',
    procedure_code: '99214',
    carc_codes: [{ code: 'CO-50', reason_text: 'Not deemed a medical necessity' }],
    rarc_codes: [],
    history_id: 'h-1',
    event_kind: 'denial',
    ...overrides,
  } as DenialEvent;
}

function buildRow(): WorklistRow {
  const classification: Classification = {
    classification_id: 'class-1',
    claim_id: 300138,
    classified_at: '2026-05-26T09:00:00Z',
    classification_source: 'rule',
    rule_id: null,
    tool_version: 'v1',
    training_guide_version: 'tg-v1',
    training_guide_section: null,
    confidence: 'high',
    primary_category: 'Medical Record Missing',
    branch_chosen: null,
    alternate_categories: [],
    workflow_steps: [],
    recommended_owner: 'AR analyst',
    sla_next_action_date: '2026-05-30',
    priority_chips: [],
    risk_flags: [],
    requires_human_review: false,
    reasoning_summary: 'records missing',
    state: 'recommended',
  };
  const claim: ClaimSummary = {
    claim_id: 300138,
    clinic: 'LSAT',
    clinic_name: 'Live Specialty Allergy Treatment',
    clinic_alias: 'LSAT',
    primary_payer_name: 'Humana Gold Plus',
    primary_payer_alias: 'Humana GP',
    facility_name: null,
    facility_alias: null,
    patient_name: 'Henderson, Joel',
    mrn: '72834',
    dos: '2026-02-24',
    amount: '335.00',
    net_pending: '230.00',
    aging_bucket: '90-119 day',
    cpt_lines: ['99214'],
    appeal_status: null,
    current_status_code: 5,
    current_status_label: 'Denied',
  };
  return { claim, classification };
}

// ---- tests ----------------------------------------------------------------

beforeEach(() => {
  mockLineItems.mockReset();
  mockDenialEvents.mockReset();
});

describe('AnalysisTab', () => {
  describe('Denial pattern callout', () => {
    it('says "1st denial" when there is exactly one event', () => {
      mockLineItems.mockReturnValue({ line_items: [buildLineItem()] });
      mockDenialEvents.mockReturnValue([buildEvent()]);

      render(<AnalysisTab row={buildRow()} />);
      expect(
        screen.getByText(/1st denial on this claim/),
      ).toBeInTheDocument();
    });

    it('says "3rd denial" when there are three events', () => {
      mockLineItems.mockReturnValue({ line_items: [buildLineItem()] });
      mockDenialEvents.mockReturnValue([
        buildEvent({ event_id: 1, occurred_at: '2026-01-20T00:00:00Z' }),
        buildEvent({ event_id: 2, occurred_at: '2026-03-15T00:00:00Z' }),
        buildEvent({ event_id: 3, occurred_at: '2026-05-18T00:00:00Z' }),
      ]);

      render(<AnalysisTab row={buildRow()} />);
      expect(
        screen.getByText(/3rd denial on this claim/),
      ).toBeInTheDocument();
    });

    it('omits the pattern when there are no events', () => {
      mockLineItems.mockReturnValue({ line_items: [buildLineItem()] });
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      expect(screen.queryByText(/denial on this claim/)).toBeNull();
    });
  });

  describe('Event grouping by procedure_code', () => {
    it('groups events under their matching CPT card', () => {
      mockLineItems.mockReturnValue({
        line_items: [
          buildLineItem({ line_id: 'li-1', procedure_code: '99214' }),
          buildLineItem({
            line_id: 'li-2',
            procedure_code: '93000',
            line_status: 'paid',
            balance: '0.00',
          }),
        ],
      });
      mockDenialEvents.mockReturnValue([
        buildEvent({
          event_id: 1,
          procedure_code: '99214',
          carc_codes: [{ code: 'CO-50', reason_text: 'Not necessary' }],
        }),
      ]);

      render(<AnalysisTab row={buildRow()} />);
      // CO-50 should appear (it's a child of the 99214 card which is denied + expanded)
      expect(screen.getByText('CO-50')).toBeInTheDocument();
    });

    it('skips events with null procedure_code (BE Ask 9 contract)', () => {
      mockLineItems.mockReturnValue({
        line_items: [buildLineItem({ procedure_code: '99214' })],
      });
      mockDenialEvents.mockReturnValue([
        buildEvent({ procedure_code: '99214', event_id: 1 }),
        buildEvent({
          procedure_code: null as unknown as string,
          event_id: 2,
          carc_codes: [{ code: 'PHANTOM', reason_text: 'should be skipped' }],
        }),
      ]);

      render(<AnalysisTab row={buildRow()} />);
      // PHANTOM code should NOT appear — we drop null-procedure events
      // rather than create an "__unknown__" group.
      expect(screen.queryByText('PHANTOM')).toBeNull();
    });

    it('orders events reverse-chronologically within a CPT', () => {
      mockLineItems.mockReturnValue({
        line_items: [buildLineItem({ procedure_code: '99214' })],
      });
      mockDenialEvents.mockReturnValue([
        buildEvent({
          event_id: 1,
          occurred_at: '2026-01-20T00:00:00Z',
          carc_codes: [{ code: 'CO-50', reason_text: 'first denial' }],
        }),
        buildEvent({
          event_id: 2,
          occurred_at: '2026-05-18T00:00:00Z',
          carc_codes: [{ code: 'CO-109', reason_text: 'latest denial' }],
        }),
      ]);

      render(<AnalysisTab row={buildRow()} />);
      const latest = screen.getByText('CO-109');
      const earlier = screen.getByText('CO-50');
      // Latest event renders above (earlier in DOM order) than the older one
      expect(
        latest.compareDocumentPosition(earlier) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('marks the globally-most-recent event as CURRENT', () => {
      mockLineItems.mockReturnValue({
        line_items: [buildLineItem({ procedure_code: '99214' })],
      });
      mockDenialEvents.mockReturnValue([
        buildEvent({ event_id: 1, occurred_at: '2026-01-20T00:00:00Z' }),
        buildEvent({ event_id: 2, occurred_at: '2026-05-18T00:00:00Z' }),
      ]);

      render(<AnalysisTab row={buildRow()} />);
      // The CURRENT pill appears on the latest event row
      expect(screen.getByText('CURRENT')).toBeInTheDocument();
    });
  });

  describe('Per-CPT card expand/collapse', () => {
    it('defaults expanded for the denied CPT containing the current event', () => {
      mockLineItems.mockReturnValue({
        line_items: [buildLineItem({ procedure_code: '99214' })],
      });
      mockDenialEvents.mockReturnValue([buildEvent({ procedure_code: '99214' })]);

      render(<AnalysisTab row={buildRow()} />);
      // Events section visible (CO-50 reason text rendered)
      expect(screen.getByText('CO-50')).toBeInTheDocument();
    });

    it('defaults collapsed for paid CPT cards', () => {
      mockLineItems.mockReturnValue({
        line_items: [
          buildLineItem({
            line_id: 'li-paid',
            procedure_code: '93000',
            line_status: 'paid',
            balance: '0.00',
            insurance_paid: '65.00',
          }),
        ],
      });
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      // Paid empty state should NOT appear until expanded
      expect(
        screen.queryByText(/No denials on this line/),
      ).toBeNull();
    });

    it('toggles open on header click for collapsed paid CPT', () => {
      mockLineItems.mockReturnValue({
        line_items: [
          buildLineItem({
            line_id: 'li-paid',
            procedure_code: '93000',
            line_status: 'paid',
            balance: '0.00',
          }),
        ],
      });
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      const header = screen.getByText('CPT 93000');
      // walk up to the clickable button
      const button = header.closest('button');
      expect(button).not.toBeNull();
      fireEvent.click(button!);
      expect(screen.getByText(/No denials on this line/)).toBeInTheDocument();
    });
  });

  describe('Empty states inside event sections', () => {
    it('shows "No denials on this line — paid in full" for paid CPT when expanded', () => {
      mockLineItems.mockReturnValue({
        line_items: [
          buildLineItem({
            procedure_code: '93000',
            line_status: 'paid',
            balance: '0.00',
          }),
        ],
      });
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      fireEvent.click(screen.getByText('CPT 93000').closest('button')!);
      expect(
        screen.getByText(/No denials on this line — paid in full/),
      ).toBeInTheDocument();
    });

    it('shows "No remit codes — payer must be called" when event has no CARC/RARC', () => {
      mockLineItems.mockReturnValue({
        line_items: [buildLineItem({ procedure_code: '99214' })],
      });
      mockDenialEvents.mockReturnValue([
        buildEvent({
          procedure_code: '99214',
          carc_codes: [],
          rarc_codes: [],
        }),
      ]);

      render(<AnalysisTab row={buildRow()} />);
      expect(screen.getByText(/No remit codes/)).toBeInTheDocument();
    });
  });

  describe('Multi-CPT ordering', () => {
    it('puts denied CPTs before paid ones', () => {
      mockLineItems.mockReturnValue({
        line_items: [
          buildLineItem({
            line_id: 'li-paid',
            procedure_code: '93000',
            line_status: 'paid',
            balance: '0.00',
          }),
          buildLineItem({
            line_id: 'li-denied',
            procedure_code: '99214',
            line_status: 'denied',
            balance: '230.00',
          }),
        ],
      });
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      const denied = screen.getByText('CPT 99214');
      const paid = screen.getByText('CPT 93000');
      expect(
        denied.compareDocumentPosition(paid) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('orders multiple denied CPTs by balance descending', () => {
      mockLineItems.mockReturnValue({
        line_items: [
          buildLineItem({
            line_id: 'li-low',
            procedure_code: '11111',
            line_status: 'denied',
            balance: '50.00',
          }),
          buildLineItem({
            line_id: 'li-high',
            procedure_code: '22222',
            line_status: 'denied',
            balance: '500.00',
          }),
        ],
      });
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      const high = screen.getByText('CPT 22222');
      const low = screen.getByText('CPT 11111');
      // Higher balance ($500) renders first
      expect(
        high.compareDocumentPosition(low) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe('Loading + empty states', () => {
    it('shows loading indicator while line items load', () => {
      mockLineItems.mockReturnValue(undefined);
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      expect(screen.getByText('Loading line items…')).toBeInTheDocument();
    });

    it('shows "Pending BE" empty state when no line items', () => {
      mockLineItems.mockReturnValue({ line_items: [] });
      mockDenialEvents.mockReturnValue([]);

      render(<AnalysisTab row={buildRow()} />);
      expect(
        screen.getByText(/No line items available/),
      ).toBeInTheDocument();
    });
  });
});

// Used in nested-element assertions to keep the linter happy
void within;
