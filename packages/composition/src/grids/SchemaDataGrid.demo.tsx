/**
 * SchemaDataGrid — row-expansion demo.
 *
 * Drop into any page to see every expansion configuration the grid
 * supports. Realistic data drawn from the denial-tool worklist scenario
 * (the use case that prompted shipping this feature).
 *
 * Each section is a self-contained `<SchemaDataGrid>` with controlled
 * state managed by a tiny `useState` cell at the top of the section.
 * The demo intentionally renders each variant with the same fixture so
 * you can compare visual treatments side-by-side.
 */

import { useState } from 'react';
import {
  SchemaDataGrid,
  type SchemaDataGridColumn,
} from './SchemaDataGrid';

// ---------------------------------------------------------------------------
// Fixture — a realistic denial-tool worklist row shape
// ---------------------------------------------------------------------------

interface WorklistRow {
  id: string;
  patient: string;
  payer: string;
  cpt: string;
  dos: string;
  amount: number;
  denial_reason: string;
  category: 'auth' | 'coding' | 'eligibility' | 'documentation';
}

const ROWS: WorklistRow[] = [
  {
    id: 'rec-001',
    patient: 'Anderson, Jane',
    payer: 'Aetna',
    cpt: '99213',
    dos: '2026-04-12',
    amount: 125.0,
    denial_reason: 'Missing prior authorization',
    category: 'auth',
  },
  {
    id: 'rec-002',
    patient: 'Brown, Kevin',
    payer: 'BCBS of TX',
    cpt: '93000',
    dos: '2026-04-15',
    amount: 240.5,
    denial_reason: 'Diagnosis code does not support medical necessity',
    category: 'coding',
  },
  {
    id: 'rec-003',
    patient: 'Chen, Liu',
    payer: 'United Healthcare',
    cpt: '99214',
    dos: '2026-04-18',
    amount: 188.0,
    denial_reason: 'Patient not covered on date of service',
    category: 'eligibility',
  },
  {
    id: 'rec-004',
    patient: 'Davis, Marcus',
    payer: 'Medicare',
    cpt: '93306',
    dos: '2026-04-20',
    amount: 412.75,
    denial_reason: 'Insufficient documentation of medical necessity',
    category: 'documentation',
  },
];

const COLUMNS: SchemaDataGridColumn<WorklistRow>[] = [
  { id: 'patient', header: 'Patient', accessorKey: 'patient', minWidth: 140 },
  { id: 'payer', header: 'Payer', accessorKey: 'payer', minWidth: 120 },
  { id: 'cpt', header: 'CPT', accessorKey: 'cpt', width: 80 },
  { id: 'dos', header: 'DOS', accessorKey: 'dos', width: 110 },
  {
    id: 'amount',
    header: 'Amount',
    accessor: (r) => `$${r.amount.toFixed(2)}`,
    align: 'right',
    width: 100,
  },
  {
    id: 'denial_reason',
    header: 'Denial reason',
    accessorKey: 'denial_reason',
    maxWidth: 240,
  },
];

// ---------------------------------------------------------------------------
// Renderer helpers — three flavors of expansion content
// ---------------------------------------------------------------------------

/** Bucket A: short field-list detail (~150 px tall). */
function FieldDetail({ row }: { row: WorklistRow }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        fontSize: 13,
      }}
    >
      <Field label="Record ID" value={row.id} />
      <Field label="Category" value={row.category} />
      <Field label="DOS" value={row.dos} />
      <Field label="CPT" value={row.cpt} />
      <Field label="Payer" value={row.payer} />
      <Field label="Amount" value={`$${row.amount.toFixed(2)}`} />
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Denial reason" value={row.denial_reason} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: '#6B7280',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#1F2937' }}>{value}</div>
    </div>
  );
}

/**
 * Bucket B: nested table detail. Fake "claim line items" — what you'd
 * actually do is render another `<SchemaDataGrid>` here, but for a self-
 * contained demo we render a plain table.
 */
function NestedTableDetail({ row }: { row: WorklistRow }) {
  const lines = [
    { line: 1, code: row.cpt, modifier: '', units: 1, billed: row.amount, paid: 0 },
    { line: 2, code: '99000', modifier: '25', units: 1, billed: 15.0, paid: 15.0 },
    { line: 3, code: '36415', modifier: '', units: 1, billed: 8.5, paid: 8.5 },
  ];
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        background: '#FFFFFF',
      }}
    >
      <thead>
        <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
          <th style={nestedTh}>Line</th>
          <th style={nestedTh}>Code</th>
          <th style={nestedTh}>Mod</th>
          <th style={{ ...nestedTh, textAlign: 'right' }}>Units</th>
          <th style={{ ...nestedTh, textAlign: 'right' }}>Billed</th>
          <th style={{ ...nestedTh, textAlign: 'right' }}>Paid</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.line} style={{ borderTop: '1px solid #E5E7EB' }}>
            <td style={nestedTd}>{l.line}</td>
            <td style={nestedTd}>{l.code}</td>
            <td style={nestedTd}>{l.modifier || '—'}</td>
            <td style={{ ...nestedTd, textAlign: 'right' }}>{l.units}</td>
            <td style={{ ...nestedTd, textAlign: 'right' }}>
              ${l.billed.toFixed(2)}
            </td>
            <td style={{ ...nestedTd, textAlign: 'right' }}>
              ${l.paid.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const nestedTh = {
  padding: '6px 10px',
  fontSize: 11,
  fontWeight: 600,
  color: '#6B7280',
};
const nestedTd = { padding: '6px 10px', color: '#1F2937' };

/**
 * Bucket C: large multi-section detail. Recommendation + audit log +
 * documents stacked, tall enough to exercise the maxHeight scroll.
 */
function LargeDetail({ row }: { row: WorklistRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section>
        <SectionTitle>Recommended action</SectionTitle>
        <p style={{ fontSize: 13, margin: 0 }}>
          File a Level 2 appeal citing CPT {row.cpt} and the {row.payer} medical
          policy on {row.denial_reason.toLowerCase()}. Attach the operative
          report and prior auth correspondence dated 2026-04-08.
        </p>
      </section>
      <section>
        <SectionTitle>Audit log</SectionTitle>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
          <li>2026-04-22 09:14 — Claim filed by Schwartz, Brian MD</li>
          <li>2026-04-25 14:02 — Initial denial received from {row.payer}</li>
          <li>2026-04-26 08:30 — Worklist assignment created</li>
          <li>2026-04-26 11:45 — Document request sent to provider</li>
          <li>2026-04-28 09:00 — Documents received</li>
          <li>2026-04-28 09:15 — Recommendation generated by RCM engine</li>
        </ul>
      </section>
      <section>
        <SectionTitle>Linked documents (4)</SectionTitle>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
          <li>denial_notice_{row.id}.pdf</li>
          <li>operative_report_{row.id}.pdf</li>
          <li>prior_auth_correspondence_{row.id}.pdf</li>
          <li>{row.payer}_medical_policy_2026.pdf</li>
        </ul>
      </section>
      <section>
        <SectionTitle>Notes</SectionTitle>
        <p style={{ fontSize: 12, margin: 0, color: '#6B7280' }}>
          No notes yet. Add a note when the appeal is filed.
        </p>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h4
      style={{
        margin: '0 0 6px',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: '#218D8D',
        fontWeight: 600,
      }}
    >
      {children}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6B7280' }}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Demo page
// ---------------------------------------------------------------------------

export default function SchemaDataGridDemo() {
  // Each section has its own expansion state. Keeping them separate makes
  // it easy to compare variants without one section's interaction affecting
  // another's.
  const [openA, setOpenA] = useState<string | null>('rec-002');
  const [openB, setOpenB] = useState<string | null>('rec-001');
  const [openC, setOpenC] = useState<string | null>(null);
  const [openD, setOpenD] = useState<string | null>('rec-002');
  const [openE, setOpenE] = useState<string | null>('rec-001');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>
        SchemaDataGrid — row expansion demo
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6B7280' }}>
        Live reference for the new expansion props on{' '}
        <code>{'<SchemaDataGrid>'}</code>. Each section below shows a
        different combination of <code>expandTrigger</code>,{' '}
        <code>rowDetailVariant</code>, and <code>rowDetailMaxHeight</code>.
        Data is a realistic denial-tool worklist fixture.
      </p>

      <Section
        title="1. Default — chevron trigger, inset variant"
        description="The most common configuration. Trailing chevron column toggles expansion; detail content gets a sunken background and 16px padding. Best for field-list details. (Click a different chevron to see single-row exclusivity — opening row B closes row A.)"
      >
        <SchemaDataGrid
          rows={ROWS}
          columns={COLUMNS}
          getRowId={(r) => r.id}
          expandedRowId={openA}
          onExpandedRowIdChange={setOpenA}
          renderRowDetail={(r) => <FieldDetail row={r} />}
        />
      </Section>

      <Section
        title="2. Flush variant — nested table"
        description='`rowDetailVariant="flush"` removes padding and background so the inner content sits edge-to-edge with the parent grid. Best for nested tables and full-bleed widgets. Notice how the inner table aligns with the outer columns.'
      >
        <SchemaDataGrid
          rows={ROWS}
          columns={COLUMNS}
          getRowId={(r) => r.id}
          expandedRowId={openB}
          onExpandedRowIdChange={setOpenB}
          renderRowDetail={(r) => <NestedTableDetail row={r} />}
          rowDetailVariant="flush"
        />
      </Section>

      <Section
        title="3. Capped height — large multi-section detail"
        description="`rowDetailMaxHeight={240}` caps the detail's height and adds internal scroll, so a very tall detail doesn't expand the page indefinitely. The grid grows by exactly 240 px + chrome regardless of inner content size. Click a row's chevron to see the scroll behavior."
      >
        <SchemaDataGrid
          rows={ROWS}
          columns={COLUMNS}
          getRowId={(r) => r.id}
          expandedRowId={openC}
          onExpandedRowIdChange={setOpenC}
          renderRowDetail={(r) => <LargeDetail row={r} />}
          rowDetailMaxHeight={240}
        />
      </Section>

      <Section
        title="4. Row trigger — no chevron"
        description='`expandTrigger="row"` removes the chevron column; clicking anywhere in the row toggles expansion. Use only when the row has no other click affordances. This grid has none, so the pattern is safe — but a grid with checkboxes or clickable badges should stay on the default chevron trigger.'
      >
        <SchemaDataGrid
          rows={ROWS}
          columns={COLUMNS}
          getRowId={(r) => r.id}
          expandedRowId={openD}
          onExpandedRowIdChange={setOpenD}
          renderRowDetail={(r) => <FieldDetail row={r} />}
          expandTrigger="row"
        />
      </Section>

      <Section
        title="5. Compact density + expansion"
        description="Expansion works at any density. Header chevron column and detail row inherit the compact cell padding from the parent grid; the inner content of the detail does not auto-shrink (consumer's choice). Wrap the detail in `[data-density='compact']` if you want it to match."
      >
        <div style={{ width: '100%' }}>
          <SchemaDataGrid
            rows={ROWS}
            columns={COLUMNS}
            getRowId={(r) => r.id}
            density="compact"
            expandedRowId={openE}
            onExpandedRowIdChange={setOpenE}
            renderRowDetail={(r) => <FieldDetail row={r} />}
          />
        </div>
      </Section>

      <Section
        title="6. No expansion (regression check)"
        description="Without `renderRowDetail`, the grid behaves identically to its prior shape: no chevron column, no expansion mechanics, no extra `<tr>` per row. Existing call sites are not affected by this feature."
      >
        <SchemaDataGrid
          rows={ROWS}
          columns={COLUMNS}
          getRowId={(r) => r.id}
        />
      </Section>
    </div>
  );
}
