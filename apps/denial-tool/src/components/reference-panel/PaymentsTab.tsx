/**
 * PaymentsTab — claim transactions (payments, adjustments, denials, refunds).
 *
 * Vendor-sourced data via case.transactions endpoint. Renders chronological
 * list with type-coded amounts and CARC/RARC codes for denial rows.
 *
 * Drop-in path: src/components/reference-panel/PaymentsTab.tsx
 */

import { useActionQuery } from '@tensaw/actions';
import type { CaseDetail } from '../../actions/schemas-v4';
import type { TransactionsResponse, Transaction, TransactionType, PayerSource } from '../../actions/schemas-v4-tabs';
import { formatCurrency, formatDateShort } from '../../utils/formatters';

export interface PaymentsTabProps {
  case: CaseDetail;
}

export function PaymentsTab({ case: c }: PaymentsTabProps): React.ReactElement {
  const { data, isLoading, error, refetch } = useActionQuery<TransactionsResponse>(
    'case.transactions',
    { case_id: c.case_id },
  );

  if (isLoading && data === undefined) {
    return <SkeletonRows />;
  }
  if (error !== null && data === undefined) {
    return (
      <ErrorView
        message={error.message ?? 'Network or server error'}
        onRetry={refetch}
      />
    );
  }
  const transactions: Transaction[] = data?.transactions ?? [];

  if (transactions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[12.5px] text-slate-500">
        No transactions yet on this claim.
      </div>
    );
  }

  // Sort newest first
  const sorted = [...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  // Totals
  const netByType = sorted.reduce<Record<TransactionType, number>>(
    (acc, t) => {
      acc[t.transaction_type] = (acc[t.transaction_type] ?? 0) + t.amount;
      return acc;
    },
    { payment: 0, adjustment: 0, denial: 0, refund: 0 },
  );
  const totalReceived = netByType.payment - netByType.refund;

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-1.5">
        <SummaryTile label="Payments" value={formatCurrency(netByType.payment)} tone="green" />
        <SummaryTile label="Adjustments" value={formatCurrency(netByType.adjustment)} tone="neutral" />
        <SummaryTile label="Net received" value={formatCurrency(totalReceived)} tone="emphasis" />
      </div>

      {/* Transaction list */}
      <ol className="space-y-1.5" aria-label="Transactions">
        {sorted.map((t) => (
          <li key={t.transaction_id}>
            <TransactionRow t={t} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

interface SummaryTileProps {
  label: string;
  value: string;
  tone: 'green' | 'neutral' | 'emphasis';
}

function SummaryTile({ label, value, tone }: SummaryTileProps): React.ReactElement {
  const valueClass =
    tone === 'green' ? 'text-emerald-700' :
    tone === 'emphasis' ? 'text-slate-900 font-semibold' :
    'text-slate-700';

  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 text-[12px] tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

interface TransactionRowProps {
  t: Transaction;
}

function TransactionRow({ t }: TransactionRowProps): React.ReactElement {
  const typeStyle = transactionTypeStyle(t.transaction_type);

  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`
            inline-flex items-center rounded px-1.5 py-0.5
            text-[9.5px] font-semibold uppercase tracking-wider
            ${typeStyle.bgClass} ${typeStyle.textClass}
          `}>
            {typeStyle.label}
          </span>
          <span className="text-[11px] text-slate-500">
            {payerSourceLabel(t.payer_source)}
          </span>
          <span className="text-[11px] text-slate-500">
            {formatDateShort(t.transaction_date)}
          </span>
        </div>
        <div className={`
          text-[13px] font-semibold tabular-nums flex-shrink-0
          ${t.amount < 0 ? 'text-red-700' : t.transaction_type === 'payment' ? 'text-emerald-700' : 'text-slate-700'}
        `}>
          {formatCurrency(t.amount)}
        </div>
      </div>

      {/* CARC/RARC codes for denial rows */}
      {(t.carc_code !== null || t.rarc_code !== null) && (
        <div className="mt-1 flex items-center gap-1 text-[10.5px]">
          {t.carc_code !== null && (
            <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-700">
              CARC {t.carc_code}
            </span>
          )}
          {t.rarc_code !== null && (
            <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-700">
              RARC {t.rarc_code}
            </span>
          )}
        </div>
      )}

      {t.remit_reason_text !== null && t.remit_reason_text !== '' && (
        <p className="mt-1 text-[11.5px] text-slate-600">{t.remit_reason_text}</p>
      )}
    </div>
  );
}

function SkeletonRows(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading transactions"
      className="space-y-1.5 px-4 py-3"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse rounded border border-slate-200 bg-white px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-3 w-16 rounded bg-slate-200" />
          </div>
          <div className="h-2 w-32 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <div className="px-4 py-3">
      <div
        role="alert"
        className="
          flex items-start gap-2 rounded border border-red-200 bg-red-50
          px-3 py-2 text-[12px] text-red-800
        "
      >
        <div className="flex-1">
          <div className="font-semibold">Couldn't load transactions</div>
          <div className="mt-0.5 text-red-700">{message}</div>
        </div>
        {onRetry !== undefined && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-red-300 bg-white px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Style maps
// ============================================================================

function transactionTypeStyle(t: TransactionType): { label: string; bgClass: string; textClass: string } {
  switch (t) {
    case 'payment':
      return { label: 'Payment', bgClass: 'bg-emerald-100', textClass: 'text-emerald-800' };
    case 'denial':
      return { label: 'Denial', bgClass: 'bg-red-100', textClass: 'text-red-800' };
    case 'adjustment':
      return { label: 'Adjustment', bgClass: 'bg-slate-100', textClass: 'text-slate-700' };
    case 'refund':
      return { label: 'Refund', bgClass: 'bg-amber-100', textClass: 'text-amber-800' };
  }
}

function payerSourceLabel(p: PayerSource): string {
  switch (p) {
    case 'primary': return '1°';
    case 'secondary': return '2°';
    case 'tertiary': return '3°';
    case 'patient': return 'Patient';
  }
}
