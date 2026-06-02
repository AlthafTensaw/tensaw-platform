/**
 * DenialCard tests — v3.0.1.
 *
 * Coverage:
 *   - Renders all 4 lines: patient/MRN/DOS/$, clinic/payer/aging, next-task,
 *     state pill + assignee + urgency
 *   - Patient name formatted "Lastname, F" (truncated)
 *   - Money formatted with no decimals
 *   - Clinic + payer aliases displayed when present, fall back to truncated
 *     name when alias missing (the v3.0.0 bug we fixed)
 *   - "All steps complete" state when no incomplete steps
 *   - Multi-select checkbox visible only when showCheckbox=true
 *   - Click → fires onClick; Cmd-click also fires onClick (parent handles
 *     the multi-select toggle)
 *   - Overdue urgency badge when effective_due_date is in the past
 *
 * Uses CategoryProviderTestStub to avoid needing a wired QueryClient.
 * Uses buildTestRow() factory so fixture changes happen in one place.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DenialCard } from '../DenialCard';
import { CategoryProviderTestStub } from '../CategoryContext';
import type {
  Classification,
  ClaimSummary,
  WorkflowStep,
  WorklistRow,
} from '../../../actions/schemas';

// ---- fixtures -------------------------------------------------------------

const TODAY = new Date();
const isoDay = (offsetDays: number): string => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

function buildStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    step: 1,
    action: 'Pull medical records from facility',
    owner: 'AR analyst',
    sla_days: 5,
    mode: 'Manual',
    day: null,
    completed_at: null,
    completed_by: null,
    assigned_to_user_id: 101,
    assigned_by_user_id: null,
    assignee_name: 'Vipin K.',
    assigned_at: null,
    due_date: null,
    effective_due_date: isoDay(3),
    priority: 'normal',
    status: 'pending',
    ...overrides,
  };
}

function buildClassification(
  overrides: Partial<Classification> = {},
): Classification {
  return {
    classification_id: '00000000-0000-0000-0000-000000000001',
    claim_id: 300138,
    classified_at: '2026-05-26T09:00:00Z',
    classification_source: 'rule',
    rule_id: 'MR-04-AUTO',
    tool_version: 'rule-engine-v1.2',
    training_guide_version: 'tg-v1',
    training_guide_section: null,
    confidence: 'high',
    primary_category: 'Medical Record Missing',
    branch_chosen: null,
    alternate_categories: [],
    workflow_steps: [buildStep()],
    recommended_owner: 'AR analyst',
    sla_next_action_date: isoDay(3),
    priority_chips: [],
    risk_flags: [],
    requires_human_review: false,
    reasoning_summary: 'Initial denial — needs records',
    state: 'recommended',
    ...overrides,
  };
}

function buildClaim(overrides: Partial<ClaimSummary> = {}): ClaimSummary {
  return {
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
    cpt_lines: ['99214', '93000'],
    appeal_status: null,
    current_status_code: 5,
    current_status_label: 'Denied',
    ...overrides,
  };
}

function buildRow(opts: {
  claim?: Partial<ClaimSummary>;
  classification?: Partial<Classification>;
} = {}): WorklistRow {
  return {
    claim: buildClaim(opts.claim),
    classification: buildClassification(opts.classification),
  };
}

function renderCard(
  props: {
    row?: WorklistRow;
    isSelected?: boolean;
    isMultiSelected?: boolean;
    showCheckbox?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    onCheckboxToggle?: () => void;
  } = {},
) {
  const onClick = props.onClick ?? vi.fn();
  const onCheckboxToggle = props.onCheckboxToggle ?? vi.fn();
  const result = render(
    <CategoryProviderTestStub>
      <DenialCard
        row={props.row ?? buildRow()}
        isSelected={props.isSelected ?? false}
        isMultiSelected={props.isMultiSelected ?? false}
        showCheckbox={props.showCheckbox ?? false}
        onClick={onClick}
        onCheckboxToggle={onCheckboxToggle}
      />
    </CategoryProviderTestStub>,
  );
  return { ...result, onClick, onCheckboxToggle };
}

// ---- tests ----------------------------------------------------------------

describe('DenialCard', () => {
  describe('Line 1 — patient/MRN/DOS/$', () => {
    it('renders patient name as "Lastname, F"', () => {
      renderCard();
      expect(screen.getByText('Henderson, J')).toBeInTheDocument();
    });

    it('renders MRN as a separate token', () => {
      renderCard();
      expect(screen.getByText('72834')).toBeInTheDocument();
    });

    it('renders DOS in mm/dd/yy format', () => {
      renderCard({ row: buildRow({ claim: { dos: '2026-02-24' } }) });
      expect(screen.getByText('02/24/26')).toBeInTheDocument();
    });

    it('renders net pending as $X with no decimals', () => {
      renderCard({ row: buildRow({ claim: { net_pending: '1353.93' } }) });
      expect(screen.getByText('$1,354')).toBeInTheDocument();
    });

    it('shows em-dash for missing patient name (defensive)', () => {
      renderCard({ row: buildRow({ claim: { patient_name: null } }) });
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('truncates very long lastnames to 10 chars + first initial', () => {
      renderCard({
        row: buildRow({
          claim: { patient_name: 'Featherstonehaugh, Cornelius' },
        }),
      });
      expect(screen.getByText('Feathersto, C')).toBeInTheDocument();
    });
  });

  describe('Line 2 — clinic/payer/aging', () => {
    it('uses primary_payer_alias when present (preferred over name)', () => {
      renderCard();
      expect(screen.getByText('Humana GP')).toBeInTheDocument();
      // Full payer name should NOT appear in the card body
      expect(screen.queryByText('Humana Gold Plus')).not.toBeInTheDocument();
    });

    it('falls back to truncated primary_payer_name when alias missing', () => {
      renderCard({
        row: buildRow({
          claim: {
            primary_payer_alias: null,
            primary_payer_name: 'Tricare West Region',
          },
        }),
      });
      // Truncated to 10 chars with ellipsis
      expect(screen.getByText('Tricare W…')).toBeInTheDocument();
    });

    it('uses clinic_alias when present', () => {
      renderCard({
        row: buildRow({
          claim: { clinic_alias: 'PRIM_BHM', clinic: 'PRIM_BHM' },
        }),
      });
      expect(screen.getByText('PRIM_BHM')).toBeInTheDocument();
    });

    it('treats legacy clinic field as alias when clinic_alias absent (back-compat)', () => {
      // This is the v3.0.0 bug we fixed: when clinic_alias is null, we
      // should NOT wrap claim.clinic as a "name" to truncate — it's already
      // the alias.
      renderCard({
        row: buildRow({
          claim: { clinic_alias: null, clinic: 'PRIM_NSH' },
        }),
      });
      expect(screen.getByText('PRIM_NSH')).toBeInTheDocument();
    });

    it('renders aging bucket compacted (strips " day" suffix)', () => {
      renderCard({
        row: buildRow({ claim: { aging_bucket: '120-179 day' } }),
      });
      expect(screen.getByText('120-179d')).toBeInTheDocument();
    });
  });

  describe('Line 3 — next task / all complete', () => {
    it('shows the first incomplete step action', () => {
      renderCard();
      expect(
        screen.getByText('Pull medical records from facility'),
      ).toBeInTheDocument();
    });

    it('shows "All steps complete" when all steps have completed_at', () => {
      renderCard({
        row: buildRow({
          classification: {
            state: 'accepted',
            workflow_steps: [
              buildStep({ completed_at: '2026-05-20T10:00:00Z' }),
              buildStep({ step: 2, completed_at: '2026-05-21T10:00:00Z' }),
            ],
          },
        }),
      });
      expect(screen.getByText('All steps complete')).toBeInTheDocument();
    });

    it('skips already-completed steps to find next', () => {
      renderCard({
        row: buildRow({
          classification: {
            workflow_steps: [
              buildStep({
                step: 1,
                action: 'First',
                completed_at: '2026-05-20T10:00:00Z',
              }),
              buildStep({
                step: 2,
                action: 'Second pending task',
                completed_at: null,
              }),
            ],
          },
        }),
      });
      expect(screen.getByText('Second pending task')).toBeInTheDocument();
      expect(screen.queryByText('First')).not.toBeInTheDocument();
    });
  });

  describe('Line 4 — state/assignee/urgency', () => {
    it('renders state pill capitalized', () => {
      renderCard();
      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('renders assignee_name from workflow step', () => {
      renderCard();
      expect(screen.getByText('Vipin K.')).toBeInTheDocument();
    });

    it('shows "Unassigned" when assignee_name is null', () => {
      renderCard({
        row: buildRow({
          classification: {
            workflow_steps: [buildStep({ assignee_name: null })],
          },
        }),
      });
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('shows overdue badge when effective_due_date is in the past', () => {
      renderCard({
        row: buildRow({
          classification: {
            workflow_steps: [
              buildStep({ effective_due_date: isoDay(-5) }),
            ],
          },
        }),
      });
      expect(screen.getByText(/Overdue 5d/)).toBeInTheDocument();
    });

    it('shows "Today" badge when effective_due_date is today', () => {
      renderCard({
        row: buildRow({
          classification: {
            workflow_steps: [
              buildStep({ effective_due_date: isoDay(0) }),
            ],
          },
        }),
      });
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('hides urgency badge when due date is in the future', () => {
      renderCard({
        row: buildRow({
          classification: {
            workflow_steps: [
              buildStep({ effective_due_date: isoDay(7) }),
            ],
          },
        }),
      });
      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });

  describe('Selection + multi-select', () => {
    it('fires onClick when the card is clicked', () => {
      const { container, onClick } = renderCard();
      const card = container.querySelector('[role="button"]');
      expect(card).not.toBeNull();
      fireEvent.click(card!);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('hides checkbox when showCheckbox=false', () => {
      const { container } = renderCard({ showCheckbox: false });
      expect(
        container.querySelector('[role="checkbox"]'),
      ).toBeNull();
    });

    it('shows checkbox when showCheckbox=true', () => {
      const { container } = renderCard({ showCheckbox: true });
      expect(
        container.querySelector('[role="checkbox"]'),
      ).not.toBeNull();
    });

    it('marks checkbox aria-checked when isMultiSelected=true', () => {
      const { container } = renderCard({
        showCheckbox: true,
        isMultiSelected: true,
      });
      const cb = container.querySelector('[role="checkbox"]');
      expect(cb?.getAttribute('aria-checked')).toBe('true');
    });

    it('fires onCheckboxToggle (not onClick) when checkbox is clicked', () => {
      const onClick = vi.fn();
      const onCheckboxToggle = vi.fn();
      const { container } = renderCard({
        showCheckbox: true,
        onClick,
        onCheckboxToggle,
      });
      const cb = container.querySelector('[role="checkbox"]');
      expect(cb).not.toBeNull();
      fireEvent.click(cb!);
      expect(onCheckboxToggle).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('applies selected styling when isSelected=true', () => {
      const { container } = renderCard({ isSelected: true });
      const card = container.querySelector('[role="button"]');
      // selected state uses border-l-primary class
      expect(card?.className).toContain('border-l-primary');
    });
  });
});
