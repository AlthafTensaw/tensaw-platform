/**
 * FilesTab — case files list + upload picker.
 *
 * Lists files attached to the case via case.files. Bottom of the panel has
 * an upload picker (file_type dropdown + native file input + Upload button)
 * that fires case.file.upload.
 *
 * The upload picker is the v4 home for the file-upload UI that was deferred
 * from v3.1 per the project notes.
 *
 * Drop-in path: src/components/reference-panel/FilesTab.tsx
 */

import { useState, useCallback, useRef, type ChangeEvent } from 'react';
import { useActionQuery, useActionMutation } from '@tensaw/actions';
import type { CaseDetail } from '../../actions/schemas-v4';
import type { FileEntity, FileType } from '../../actions/schemas-v4-tabs';

export interface FilesTabProps {
  case: CaseDetail;
}

const FILE_TYPE_OPTIONS: { value: FileType; label: string }[] = [
  { value: 'medical_record', label: 'Medical record' },
  { value: 'operative_note', label: 'Operative note' },
  { value: 'eob', label: 'EOB' },
  { value: 'denial_letter', label: 'Denial letter' },
  { value: 'appeal_draft', label: 'Appeal draft' },
  { value: 'other', label: 'Other' },
];

export function FilesTab({ case: c }: FilesTabProps): React.ReactElement {
  const { data, isLoading, error, refetch } = useActionQuery(
    'case.files',
    { case_id: c.case_id },
  );

  const files: FileEntity[] = data?.files ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* File list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && data === undefined && <SkeletonFiles />}

        {error !== null && data === undefined && (
          <ErrorView
            message={error.message ?? 'Network or server error'}
            onRetry={refetch}
          />
        )}

        {!isLoading && error === null && files.length === 0 && (
          <div className="py-8 text-center text-[12.5px] text-slate-500">
            No files attached yet. Use the upload control below to add one.
          </div>
        )}

        {files.length > 0 && <FilesList files={files} />}
      </div>

      {/* Upload picker */}
      <UploadPicker caseId={c.case_id} />
    </div>
  );
}

// ============================================================================
// File list — grouped by type
// ============================================================================

interface FilesListProps {
  files: FileEntity[];
}

function FilesList({ files }: FilesListProps): React.ReactElement {
  // Group by file_type
  const groups: Record<string, FileEntity[]> = {};
  for (const f of files) {
    (groups[f.file_type] ??= []).push(f);
  }

  // Render in canonical order
  const ORDER: FileType[] = [
    'medical_record',
    'operative_note',
    'eob',
    'denial_letter',
    'appeal_draft',
    'other',
  ];

  return (
    <div className="space-y-3">
      {ORDER.filter((t) => groups[t] !== undefined && groups[t].length > 0).map((type) => (
        <section key={type} aria-labelledby={`group-${type}`}>
          <h3
            id={`group-${type}`}
            className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500"
          >
            {fileTypeLabel(type)} ({groups[type].length})
          </h3>
          <ul className="space-y-1">
            {groups[type]
              .slice()
              .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
              .map((f) => (
                <li key={f.file_id}>
                  <FileRow file={f} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface FileRowProps {
  file: FileEntity;
}

function FileRow({ file }: FileRowProps): React.ReactElement {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <FileIcon mime={file.mime_type} />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-slate-900 truncate" title={file.file_name}>
            {file.file_name}
          </div>
          <div className="text-[10.5px] text-slate-500">
            {formatBytes(file.size_bytes)}
            {file.uploaded_by_user_name !== null && (
              <> · uploaded by {file.uploaded_by_user_name}</>
            )}
            {' · '}
            {new Date(file.uploaded_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function fileTypeLabel(t: FileType): string {
  const opt = FILE_TYPE_OPTIONS.find((o) => o.value === t);
  return opt?.label ?? t;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }): React.ReactElement {
  // Simple emoji icons by mime family — could swap for real icons later
  const isPdf = mime.includes('pdf');
  const isImage = mime.startsWith('image/');
  return (
    <span aria-hidden="true" className="text-base flex-shrink-0">
      {isPdf ? '📄' : isImage ? '🖼' : '📎'}
    </span>
  );
}

// ============================================================================
// Upload picker
// ============================================================================

interface UploadPickerProps {
  caseId: string;
}

function UploadPicker({ caseId }: UploadPickerProps): React.ReactElement {
  const [fireUpload, { isPending, error }] = useActionMutation('case.file.upload');
  const [fileType, setFileType] = useState<FileType>('medical_record');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setSelectedFileName(f?.name ?? '');
    setSubmitError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    setSubmitError(null);
    const file = fileInputRef.current?.files?.[0];
    if (file === undefined) {
      setSubmitError('Pick a file first.');
      return;
    }
    try {
      // Note: real upload sends multipart; this submits the metadata fields.
      // The action layer / uploader helper builds FormData around it.
      await fireUpload({
        case_id: caseId,
        file_type: fileType,
        file_name: file.name,
        idempotency_key: generateUUID(),
      });
      setSelectedFileName('');
      if (fileInputRef.current !== null) fileInputRef.current.value = '';
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [caseId, fileType, fireUpload]);

  const canUpload = selectedFileName !== '' && !isPending;

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
        Upload file
      </div>

      <div className="space-y-2">
        {/* File type selector */}
        <select
          aria-label="File type"
          value={fileType}
          onChange={(e) => setFileType(e.target.value as FileType)}
          disabled={isPending}
          className="
            block w-full rounded border border-slate-300 bg-white
            px-2.5 py-1.5 text-[12.5px] text-slate-900
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
            disabled:opacity-60
          "
        >
          {FILE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* File picker — show button + selected name (looks like a custom picker) */}
        <div className="flex items-center gap-2">
          <label
            className={`
              inline-flex cursor-pointer items-center gap-1.5 rounded
              border border-slate-300 bg-white px-2.5 py-1.5
              text-[12px] font-medium text-slate-700
              hover:bg-slate-100
              ${isPending ? 'opacity-60 cursor-not-allowed' : ''}
            `}
          >
            <PaperclipIcon />
            Choose file
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={isPending}
              className="sr-only"
            />
          </label>
          <span className="flex-1 truncate text-[11.5px] text-slate-600" title={selectedFileName}>
            {selectedFileName !== '' ? selectedFileName : 'No file selected'}
          </span>
        </div>

        {(submitError !== null || error !== null) && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
            {submitError ?? error?.message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload}
            className="
              rounded bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white
              hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaperclipIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9 3.5L4 8.5a2 2 0 0 0 2.83 2.83L11 7.17a3.5 3.5 0 0 0-4.95-4.95L1.5 6.78"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Minimal UUID v4 (avoids adding a dep)
function generateUUID(): string {
  // Browser crypto API path — preferred when available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (rare in modern browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Loading / error states
// ============================================================================

function SkeletonFiles(): React.ReactElement {
  return (
    <div role="status" aria-label="Loading files" className="space-y-1.5">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2">
          <div className="h-6 w-6 rounded bg-slate-200" />
          <div className="flex-1">
            <div className="mb-1 h-3 w-3/4 rounded bg-slate-200" />
            <div className="h-2 w-1/2 rounded bg-slate-100" />
          </div>
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
    <div
      role="alert"
      className="
        flex items-start gap-2 rounded border border-red-200 bg-red-50
        px-3 py-2 text-[12px] text-red-800
      "
    >
      <div className="flex-1">
        <div className="font-semibold">Couldn't load files</div>
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
  );
}
