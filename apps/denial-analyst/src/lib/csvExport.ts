import type { WorklistRow } from '../actions/schemas';

export function exportSelectedRowsToCSV(
  rows: readonly WorklistRow[],
  _options?: { user?: { fullName?: string } }
): void {
  if (rows.length === 0) return;

  const headers = [
    'Claim ID',
    'Clinic',
    'Primary Payer',
    'DOS',
    'Amount',
    'Net Pending',
    'Aging Bucket',
    'Primary Category',
    'Confidence',
    'Recommended Owner',
    'State'
  ];

  const csvRows = [
    headers.join(','),
    ...rows.map((row) => {
      const claim = row.claim;
      const cl = row.classification;
      const fields = [
        claim.claim_id,
        `"${(claim.clinic ?? '').replace(/"/g, '""')}"`,
        `"${(claim.primary_payer_name ?? '').replace(/"/g, '""')}"`,
        claim.dos,
        claim.amount,
        claim.net_pending,
        `"${(claim.aging_bucket ?? '').replace(/"/g, '""')}"`,
        `"${cl.primary_category.replace(/"/g, '""')}"`,
        cl.confidence,
        `"${cl.recommended_owner.replace(/"/g, '""')}"`,
        cl.state
      ];
      return fields.join(',');
    })
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `denial_claims_export_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
