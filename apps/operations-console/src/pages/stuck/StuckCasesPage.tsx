/**
 * Stuck Cases — operations triage dashboard.
 *
 * Per frontend tech spec §5.4 + BRD §2.4 wireframes.
 *
 * Cases group by `stuck_reason` (fatal_error / max_attempts / overdue).
 * Each group is an Accordion section (default-open) listing the cards.
 * Card click → navigate to Case Detail.
 *
 * Empty state has positive framing: "Workflows are running smoothly."
 *
 * Note: this screen is one of the auth-widening targets — backend
 * Phase A widened `GET /v1/admin/stuck-cases` from ALL_ADMIN_ROLES to
 * CONSOLE_READ_ROLES so all read-capable users (including CLINIC_*)
 * can reach it.
 */
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';

import { useActionQuery } from '@tensaw/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Badge,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from '@tensaw/design-system';

import type {
  StuckCaseRow,
  StuckCasesResponse,
} from '../../actions/schemas';

const REASON_LABELS: Record<string, string> = {
  fatal_error: 'Fatal error',
  max_attempts: 'Max attempts exhausted',
  overdue: 'Overdue (no recent activity)',
};

const REASON_ORDER = ['fatal_error', 'max_attempts', 'overdue'];

function ReasonIcon({ reason }: { reason: string }) {
  switch (reason) {
    case 'fatal_error':
      return <XCircle size={18} className="text-red-600" />;
    case 'max_attempts':
      return <AlertTriangle size={18} className="text-amber-600" />;
    case 'overdue':
      return <Clock size={18} className="text-orange-600" />;
    default:
      return <AlertTriangle size={18} className="text-muted-foreground" />;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function StuckCasesPage() {
  const { data, isLoading, error } = useActionQuery<StuckCasesResponse>(
    'admin.stuck-cases',
    { limit: 200 },
  );

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Stuck cases</h1>
        <Alert
          variant="error"
          title="Failed to load stuck cases"
          description={error.message}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Stuck cases</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  if (total === 0) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Stuck cases</h1>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<CheckCircle size={32} className="text-green-600" />}
              title="No stuck cases"
              description="Workflows are running smoothly."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group by stuck_reason
  const groups = new Map<string, StuckCaseRow[]>();
  for (const r of items) {
    const reason = r.stuck_reason || 'overdue';
    const existing = groups.get(reason);
    if (existing) {
      existing.push(r);
    } else {
      groups.set(reason, [r]);
    }
  }

  // Order groups deterministically by REASON_ORDER, then alpha for any
  // unknown reasons.
  const orderedReasons = [
    ...REASON_ORDER.filter((r) => groups.has(r)),
    ...[...groups.keys()]
      .filter((r) => !REASON_ORDER.includes(r))
      .sort(),
  ];

  return (
    <div className="space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Stuck cases</h1>
        <p className="text-sm text-muted-foreground">
          {total} case{total === 1 ? '' : 's'} need attention.
        </p>
      </header>

      <Accordion type="multiple" defaultValue={orderedReasons}>
        {orderedReasons.map((reason) => {
          const rows = groups.get(reason) ?? [];
          return (
            <AccordionItem key={reason} value={reason}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <ReasonIcon reason={reason} />
                  <span className="font-medium">
                    {REASON_LABELS[reason] ?? reason}
                  </span>
                  <Badge variant="warning">{rows.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pt-2">
                  {rows.map((row) => (
                    <li key={row.case_id}>
                      <Link
                        to={`/cases/${row.case_id}`}
                        className="block rounded-md border border-border p-3 hover:bg-muted/50"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-mono text-sm">
                            {row.case_id}
                          </span>
                          <Badge variant="secondary">{row.state_code}</Badge>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
                          <div>Type: {row.case_type}</div>
                          <div>
                            Attempts:{' '}
                            {row.max_attempts !== null
                              ? `${row.attempt_count}/${row.max_attempts}`
                              : row.attempt_count}
                          </div>
                          <div>Opened: {formatDateTime(row.opened_at)}</div>
                          <div>
                            Next action: {formatDateTime(row.next_action_at)}
                          </div>
                        </div>
                        {row.last_error_code ? (
                          <div className="mt-1 text-xs text-red-600">
                            {row.last_error_code}
                            {row.last_error_retryable === false
                              ? ' (terminal)'
                              : ''}
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
