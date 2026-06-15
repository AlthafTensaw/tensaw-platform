/**
 * Test stub for @tensaw/actions. In the real workspace this resolves to the
 * platform package providing defineAction + useActionQuery + useActionMutation.
 *
 * For compile-check + render-test purposes we expose:
 *   - defineAction: minimal-shape registry
 *   - useActionQuery: returns { data, isLoading, error } with derived types
 *   - useActionMutation: returns [fire, { isPending, error }] tuple
 */
import { z } from 'zod';
import type { NotesResponse, FilesResponse, TransactionsResponse, CategoriesResponse, LookupResponse, Note, FileEntity, Appeal } from '../../src/actions/schemas-v4-tabs';
// v4.1 (engine-handler model) — aliased to avoid clashing with v4.0.0 names
// during the R-phase transition. v4.0.0 keys removed in R12.
import type {
  WorklistResponse as WorklistResponseV41,
  WorklistTask as WorklistTaskV41,
  Team as TeamV41,
  CaseDetail as CaseDetailV41,
} from '../../src/actions/schemas';

export interface ActionDefinition<TReq = unknown, TRes = unknown> {
  actionId: string;
  kind: 'query' | 'mutation';
  endpoint: string;
  permission: string;
  description: string;
  request: z.ZodType<TReq>;
  response: z.ZodType<TRes>;
  cache?: { tag: string; invalidatedBy: readonly string[] };
}

const REGISTRY = new Map<string, ActionDefinition>();

export function defineAction<TReq, TRes>(def: ActionDefinition<TReq, TRes>): void {
  if (REGISTRY.has(def.actionId)) {
    throw new Error(`Duplicate actionId: ${def.actionId}`);
  }
  REGISTRY.set(def.actionId, def as ActionDefinition);
}

export function getRegistry(): ReadonlyMap<string, ActionDefinition> {
  return REGISTRY;
}

export function clearRegistry(): void { REGISTRY.clear(); }

// ============================================================================
// Action-ID → response-type mapping (typed hook surface)
// ============================================================================

export interface QueryResponseMap {
  'case.notes': NotesResponse;
  'case.files': FilesResponse;
  'case.transactions': TransactionsResponse;
  'case.appeal.get': Appeal;
  'category.list': CategoriesResponse;
  'lookup.clinics': LookupResponse;
  'lookup.providers': LookupResponse;
  'lookup.payers': LookupResponse;
  'lookup.facilities': LookupResponse;
  // ── engine-handler model ──
  'worklist.list': WorklistResponseV41;
  'worklist.task': WorklistTaskV41;
  'worklist.counts': { counts: Partial<Record<TeamV41, number>> };
  'case.detail': CaseDetailV41;
}

export interface MutationResponseMap {
  'case.note.add': Note;
  'case.file.upload': FileEntity;
  'case.appeal.generate': Appeal;
  'case.appeal.save': Appeal;
  'case.reveal-phi': { audit_id: string; recorded_at: string };
  // ── engine-handler model ──
  'worklist.complete': WorklistTaskV41;
}

export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface MutationState {
  isPending: boolean;
  error: Error | null;
}

// Default mock implementation — returns isLoading=true so components must
// handle that state. Tests override these via __setQueryMock.
const queryMocks = new Map<string, unknown>();
const mutationMocks = new Map<string, (input: unknown) => Promise<unknown>>();

export function __setQueryMock<K extends keyof QueryResponseMap>(
  id: K,
  data: QueryResponseMap[K],
): void {
  queryMocks.set(id, data);
}

export function __setMutationMock<K extends keyof MutationResponseMap>(
  id: K,
  fn: (input: unknown) => Promise<MutationResponseMap[K]>,
): void {
  mutationMocks.set(id, fn);
}

export function __resetMocks(): void {
  queryMocks.clear();
  mutationMocks.clear();
}

export function useActionQuery<K extends keyof QueryResponseMap>(
  id: K,
  _params: unknown,
): QueryResult<QueryResponseMap[K]> {
  const mocked = queryMocks.get(id) as QueryResponseMap[K] | undefined;
  return {
    data: mocked,
    isLoading: mocked === undefined,
    error: null,
    refetch: () => {},
  };
}

export function useActionMutation<K extends keyof MutationResponseMap>(
  id: K,
): [
  (input: unknown) => Promise<MutationResponseMap[K]>,
  MutationState,
] {
  const fn = mutationMocks.get(id) as
    | ((input: unknown) => Promise<MutationResponseMap[K]>)
    | undefined;
  const fire = fn ?? (() => Promise.reject(new Error(`no mock for ${id}`)));
  return [fire, { isPending: false, error: null }];
}
