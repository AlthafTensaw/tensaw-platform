/**
 * FilesTab — claim attachments list.
 *
 * File type tags color-coded per v3.0.4 mockup:
 *   EOB (blue) · Medical Record (coral) · Outbound Fax (slate) ·
 *   Appeal Draft (purple) · Clinical (amber) · Other (gray)
 *
 * Click preview → opens BE's inline-disposition stream in new tab.
 * Click download → triggers an attachment-disposition download via
 * temporary anchor.
 *
 * Upload UI is intentionally minimal in v3.0 — drag-and-drop is a v3.1
 * enhancement.
 */

import { config } from '@tensaw/runtime';
import type { WorklistRow } from '../../../actions/schemas';
import { useFiles } from '../../../hooks/useTabData';
import { formatDate, formatFileSize } from '../../../lib/formatters';
import type { FileMeta, FileType } from '../../../actions/schemasV3';

interface FilesTabProps {
  row: WorklistRow;
}

export function FilesTab({ row }: FilesTabProps): JSX.Element {
  const claimId = row.claim.claim_id;
  const { data, isLoading } = useFiles(claimId);

  const files = data?.files ?? [];

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {isLoading ? 'Loading…' : `${files.length} files attached`}
        </span>
        <button
          type="button"
          onClick={() => {
            // BE Ask 4 delivered: POST /v1/claims/{id}/files (multipart).
            // FE picker UI is v3.1 work. For v3.0 we surface the endpoint
            // but don't provide the picker — analysts upload from elsewhere
            // or via the existing Allofactor entry points.
            // eslint-disable-next-line no-alert
            window.alert(
              'File upload picker UI is planned for v3.1. The BE endpoint POST /v1/claims/{id}/files is available.',
            );
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add file
        </button>
      </div>

      {isLoading && files.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          Loading files…
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
          No files attached yet.
        </div>
      ) : (
        files.map((f) => <FileRow key={f.file_id} file={f} />)
      )}
    </div>
  );
}

function FileRow({ file }: { file: FileMeta }): JSX.Element {
  const onPreview = (): void => {
    const url = `${config.api.baseUrl}/v1/files/${file.file_id}/preview`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const onDownload = (): void => {
    // Create a temporary anchor with download attribute so the browser
    // routes to its save dialog rather than navigating away from the app.
    const url = `${config.api.baseUrl}/v1/files/${file.file_id}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename; // hint; BE's Content-Disposition wins
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isImg = file.mime_type.startsWith('image/');
  const iconLabel = isImg ? 'IMG' : 'PDF';
  const iconColor = isImg ? '#1d4ed8' : '#b91c1c';

  return (
    <div className="mb-1.5 flex items-center gap-2.5 rounded-md border border-border bg-background p-2.5">
      <div
        className="flex h-9 w-8 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold tracking-wide text-white"
        style={{ backgroundColor: iconColor }}
      >
        {iconLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="mb-0.5 truncate text-[12.5px] font-medium"
          title={file.filename}
        >
          {file.filename}
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <FileTypeTag type={file.file_type} />
          <span>{formatFileSize(file.size_bytes)}</span>
          <span className="text-border">·</span>
          <span>{file.uploaded_by_name}</span>
          <span className="text-border">·</span>
          <span>{formatDate(file.uploaded_at)}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 gap-0.5">
        <IconButton onClick={onPreview} title="Preview">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </IconButton>
        <IconButton onClick={onDownload} title="Download">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function FileTypeTag({ type }: { type: FileType }): JSX.Element {
  const config: Record<FileType, { label: string; bg: string; fg: string }> = {
    eob: { label: 'EOB', bg: '#dbeafe', fg: '#1e40af' },
    medical_record: { label: 'Medical Record', bg: '#ffe4e6', fg: '#9f1239' },
    outbound_fax: { label: 'Outbound Fax', bg: '#f1f5f9', fg: '#475569' },
    appeal_draft: { label: 'Appeal Draft', bg: '#ede9fe', fg: '#6d28d9' },
    clinical: { label: 'Clinical', bg: '#fef3c7', fg: '#92400e' },
    other: { label: 'Other', bg: '#f5f5f5', fg: '#737373' },
  };
  const c = config[type];
  return (
    <span
      className="inline-block rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}
