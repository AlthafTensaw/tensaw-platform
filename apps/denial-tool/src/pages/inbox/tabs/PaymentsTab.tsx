/**
 * PaymentsTab — full EOB breakdown + transactions log.
 *
 * Layout per v3.0.4 mockup:
 *   - 4 summary tiles: Total Billed · Total Paid · Total Adj · Balance
 *   - Per-CPT cards with 2x4 financial grid (8 fields)
 *   - Transactions table: Date · Type · Party/Mode · Amount
 */

import { useMemo } from 'react';
import type { WorklistRow } from '../../../actions/schemas';
import {
  useLineItems,
  useTransactions,
} from '../../../hooks/useTabData';
import {
  formatDate,
  formatMoneyFull,
  formatMoneyShort,
  formatMoneySigned,
} from '../../../lib/formatters';
import type { LineItem, Transaction } from '../../../actions/schemasV3';

interface PaymentsTabProps {
  row: WorklistRow;
}

export function PaymentsTab({ row }: PaymentsTabProps): JSX.Element {
  const claimId = row.claim.claim_id;
  const { data: lineItemsData, isLoading: liLoading } = useLineItems(claimId);
  const { data: txnData, isLoading: txnLoading } = useTransactions(claimId);

  const lineItems = lineItemsData?.line_items ?? [];
  const transactions = txnData?.transactions ?? [];

  const totals = useMemo(() => sumLineItems(lineItems), [lineItems]);

  return (
    <div>
      {/* Summary tiles */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <SummaryTile label="Total Billed" value={formatMoneyShort(totals.billed)} />
        <SummaryTile
          label="Total Paid"
          value={formatMoneyShort(totals.totalPaid)}
          variant="paid"
        />
        <SummaryTile label="Total Adj" value={formatMoneyShort(totals.adj)} />
        <SummaryTile
          label="Balance"
          value={formatMoneyShort(totals.balance)}
          variant="balance"
        />
      </div>

      {/* Per-CPT cards */}
      <div className="mb-3 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Line items · {lineItems.length}</span>
      </div>

      {liLoading && lineItems.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          Loading line items…
        </div>
      ) : lineItems.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          No line items available.
          <div className="mt-1 text-[10.5px]">
            Pending BE: GET /v1/claims/{String(claimId)}/line-items
          </div>
        </div>
      ) : (
        lineItems.map((li) => <PaymentsLineItemCard key={li.line_id} item={li} />)
      )}

      {/* Transactions */}
      <div className="mb-2 mt-3.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Transactions · {transactions.length}
      </div>

      {txnLoading && transactions.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          Loading transactions…
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          No transactions yet.
          <div className="mt-1 text-[10.5px]">
            Pending BE: GET /v1/claims/{String(claimId)}/transactions
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-background text-[11.5px]">
          <div
            className="grid items-center gap-2 bg-muted px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ gridTemplateColumns: '70px 80px 1fr 80px' }}
          >
            <span>Date</span>
            <span>Type</span>
            <span>Party / Mode</span>
            <span className="text-right">Amount</span>
          </div>
          {transactions.map((t) => (
            <TransactionRow key={t.transaction_id} txn={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface LineItemTotals {
  billed: number;
  totalPaid: number;
  adj: number;
  balance: number;
}

function sumLineItems(items: LineItem[]): LineItemTotals {
  let billed = 0;
  let insPaid = 0;
  let patPaid = 0;
  let adj = 0;
  let balance = 0;
  for (const i of items) {
    billed += Number(i.billed);
    insPaid += Number(i.insurance_paid);
    patPaid += Number(i.patient_paid);
    adj += Number(i.contractual_adjustment);
    balance += Number(i.balance);
  }
  return { billed, totalPaid: insPaid + patPaid, adj, balance };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: 'paid' | 'balance';
}): JSX.Element {
  const bg =
    variant === 'balance' ? '#fef2f2' : 'var(--background)';
  const border =
    variant === 'balance' ? '#fee2e2' : 'var(--border)';
  const valColor =
    variant === 'balance'
      ? '#dc2626'
      : variant === 'paid'
        ? '#166534'
        : undefined;
  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className="font-mono text-[16px] font-bold tabular-nums"
        style={valColor !== undefined ? { color: valColor } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function PaymentsLineItemCard({ item }: { item: LineItem }): JSX.Element {
  const isDenied = item.line_status === 'denied';
  const isPaid = item.line_status === 'paid';
  return (
    <div className="mb-2.5 rounded-md border border-border bg-background p-3">
      <div className="mb-2.5 flex items-baseline gap-1.5 border-b border-border pb-2">
        <span className="font-mono text-[13px] font-bold">
          CPT {item.procedure_code}
        </span>
        <span className="flex-1 truncate text-[11px] text-muted-foreground">
          {item.procedure_description}
        </span>
        {isDenied ? (
          <span
            className="rounded border px-1.5 py-px text-[9px] font-bold uppercase"
            style={{ borderColor: '#dc2626', color: '#dc2626' }}
          >
            Denied
          </span>
        ) : null}
        {isPaid ? (
          <span
            className="rounded px-1.5 py-px text-[9px] font-bold uppercase"
            style={{ backgroundColor: '#dcfce7', color: '#166534' }}
          >
            Paid
          </span>
        ) : null}
      </div>

      {/* 2x4 grid of all 8 financial fields */}
      <div
        className="grid gap-px overflow-hidden rounded"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          backgroundColor: 'var(--border)',
        }}
      >
        <Cell label="Billed" value={formatMoneyShort(item.billed)} />
        <Cell label="Allowed" value={formatMoneyShort(item.allowed)} />
        <Cell
          label="Cont Adj"
          value={formatMoneyShort(item.contractual_adjustment)}
        />
        <Cell label="Coins" value={formatMoneyShort(item.coinsurance)} />
        <Cell label="Ded" value={formatMoneyShort(item.deductible)} />
        <Cell
          label="Ins Paid"
          value={formatMoneyShort(item.insurance_paid)}
          color={Number(item.insurance_paid) > 0 ? '#166534' : undefined}
        />
        <Cell
          label="Pat Paid"
          value={formatMoneyShort(item.patient_paid)}
        />
        <Cell
          label="Balance"
          value={formatMoneyShort(item.balance)}
          color={Number(item.balance) > 0 ? '#dc2626' : undefined}
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): JSX.Element {
  const isZero = value === '$0';
  return (
    <div
      className="px-2 py-1.5"
      style={{ backgroundColor: 'var(--muted)' }}
    >
      <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className="font-mono text-[11.5px] font-semibold tabular-nums"
        style={{
          color: color ?? (isZero ? 'var(--muted-foreground)' : undefined),
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TransactionRow({ txn }: { txn: Transaction }): JSX.Element {
  const amountNum = Number(txn.amount);
  const isCredit = amountNum < 0;
  const isZero = amountNum === 0;

  const typeLabel = {
    charge: 'Charge',
    payment: 'Payment',
    adjustment: 'Cont Adj',
    denial: 'Denial',
    refund: 'Refund',
  }[txn.type];

  const typeStyle: Record<string, { bg: string; fg: string }> = {
    charge: { bg: '#f1f5f9', fg: '#475569' },
    payment: { bg: '#dcfce7', fg: '#166534' },
    adjustment: { bg: '#dbeafe', fg: '#1e40af' },
    denial: { bg: '#fee2e2', fg: '#991b1b' },
    refund: { bg: '#fef3c7', fg: '#92400e' },
  };

  const style = typeStyle[txn.type] ?? typeStyle.charge!;

  const partyMode = [
    txn.party === 'system'
      ? null
      : txn.party.charAt(0).toUpperCase() + txn.party.slice(1),
    txn.mode !== null ? txn.mode.toUpperCase() : null,
    txn.reference,
    txn.description,
  ]
    .filter((s) => s !== null && s !== '')
    .join(' · ');

  return (
    <div
      className="grid items-center gap-2 border-t border-border px-3 py-1.5"
      style={{ gridTemplateColumns: '70px 80px 1fr 80px' }}
    >
      <span className="font-mono">{formatDate(txn.posted_at)}</span>
      <span>
        <span
          className="inline-block rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: style.bg, color: style.fg }}
        >
          {typeLabel}
        </span>
      </span>
      <span className="truncate text-[11px] text-muted-foreground">
        {partyMode}
      </span>
      <span
        className="text-right font-mono font-semibold tabular-nums"
        style={{
          color: isZero
            ? 'var(--muted-foreground)'
            : isCredit
              ? '#166534'
              : 'var(--foreground)',
        }}
      >
        {isZero ? '$0' : formatMoneySigned(txn.amount)}
      </span>
    </div>
  );
}

// Keep formatMoneyFull imported for future use (transaction drill-in)
void formatMoneyFull;
