/**
 * v3.0 React Query hooks for right-pane tab data.
 *
 * Wraps useActionQuery / useActionMutation for the 9 v3.0 endpoints.
 *
 * Hook signatures match the project's actions API:
 *   useActionQuery(actionId, request, { skip?, freshFor? })
 *   useActionMutation(actionId)  → [fire(request), { data, isLoading, error, reset }]
 *
 * Skip-on-null pattern: when claimId is null we pass `skip: true` so the
 * dispatcher doesn't fire — matches the project's existing skip pattern
 * (see useTasksMine for prior art).
 */

import { useActionQuery, useActionMutation } from '@tensaw/actions';
import type {
  LineItemListResponse,
  TransactionListResponse,
  NoteListResponse,
  NoteCreateRequest,
  Note,
  FileListResponse,
  AppealResponse,
  AppealDraft,
  AppealGenerateRequest,
  AppealSaveRequest,
  CategoryListResponse,
} from '../actions/schemasV3';

const claimKey = (claimId: string | number): string => String(claimId);

// Stable empty request reference for parameter-less queries. Inline `{}`
// creates a new object identity per render, which can defeat downstream
// memoization. Reported by Vivek (2026-05-29): caused useCategories to
// re-fetch on every render despite freshFor: Infinity. Same pattern
// applied to any other parameter-less query.
const EMPTY_REQUEST = Object.freeze({});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useLineItems(claimId: string | number | null) {
  return useActionQuery<LineItemListResponse>(
    'denial.list-line-items',
    claimId !== null ? { claim_id: claimKey(claimId) } : {},
    { skip: claimId === null },
  );
}

export function useTransactions(claimId: string | number | null) {
  return useActionQuery<TransactionListResponse>(
    'denial.list-transactions',
    claimId !== null ? { claim_id: claimKey(claimId) } : {},
    { skip: claimId === null },
  );
}

export function useNotes(claimId: string | number | null) {
  return useActionQuery<NoteListResponse>(
    'denial.list-notes',
    claimId !== null ? { claim_id: claimKey(claimId) } : {},
    { skip: claimId === null },
  );
}

export function useFiles(claimId: string | number | null) {
  return useActionQuery<FileListResponse>(
    'denial.list-files',
    claimId !== null ? { claim_id: claimKey(claimId) } : {},
    { skip: claimId === null },
  );
}

export function useAppeal(claimId: string | number | null) {
  return useActionQuery<AppealResponse>(
    'denial.get-appeal',
    claimId !== null ? { claim_id: claimKey(claimId) } : {},
    { skip: claimId === null },
  );
}

export function useCategories() {
  return useActionQuery<CategoryListResponse>(
    'denial.list-categories',
    EMPTY_REQUEST,
    { freshFor: Number.MAX_SAFE_INTEGER }, // never refetch — single boot fetch
  );
}

// ---------------------------------------------------------------------------
// Mutations — return { mutate, isPending, error } facade over [fire, state]
// ---------------------------------------------------------------------------

export function useCreateNote(claimId: string | number) {
  const [fire, state] = useActionMutation<
    NoteCreateRequest & { claim_id: string },
    Note
  >('denial.create-note');
  return {
    mutate: (req: NoteCreateRequest) => {
      void fire({ ...req, claim_id: claimKey(claimId) });
    },
    isPending: state.isLoading,
    error: state.error,
  };
}

export function useGenerateAppeal(claimId: string | number) {
  const [fire, state] = useActionMutation<
    AppealGenerateRequest & { claim_id: string },
    AppealDraft
  >('denial.generate-appeal');
  return {
    mutate: (req: AppealGenerateRequest) => {
      void fire({ ...req, claim_id: claimKey(claimId) });
    },
    isPending: state.isLoading,
    error: state.error,
  };
}

export function useSaveAppeal(claimId: string | number) {
  const [fire, state] = useActionMutation<
    AppealSaveRequest & { claim_id: string },
    AppealDraft
  >('denial.save-appeal');
  return {
    mutate: (req: AppealSaveRequest) => {
      void fire({ ...req, claim_id: claimKey(claimId) });
    },
    isPending: state.isLoading,
    error: state.error,
  };
}
