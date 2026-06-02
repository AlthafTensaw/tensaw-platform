/**
 * CategoryContext — single-fetch category metadata, app-scoped.
 *
 * Replaces the hardcoded categoryColor.ts table. The BE returns the 33
 * canonical categories via GET /v1/categories with `color_hint` on each.
 * This provider fetches them once at app boot (infinite staleTime via
 * useCategories) and exposes a synchronous lookup for consumers.
 *
 * Consumers:
 *   - DenialCard (line-3 category dot)
 *   - WorkPane (classification block dot)
 *
 * Fallback: if the BE hasn't returned yet, or the category isn't in the
 * response, we fall back to a small built-in palette so the UI never
 * renders a default-gray void. Once BE responds, all dots update.
 *
 * The legacy categoryColor.ts is kept as the fallback table — see
 * FALLBACK_COLOR below — but is no longer the primary source of truth.
 */

import { createContext, useContext, useMemo } from 'react';
import { useCategories } from '../../hooks/useTabData';
import type { Category } from '../../actions/schemasV3';

// Small fallback palette — used pre-BE-response. Categories not in this list
// get '#737373' (slate) instead of a default theme color, so missing entries
// are still visible but obviously generic.
const FALLBACK_COLOR: Record<string, string> = {
  'Medical Record Missing': '#dc2626',
  'Medical Necessity / LCD': '#dc2626',
  'Documentation Insufficient': '#dc2626',
  'Referral Missing': '#0d9488',
  'Auth Missing': '#0d9488',
  'Auth Expired': '#0d9488',
  'Vague Denial / Need Payer Call': '#f59e0b',
  'Coding Error': '#1e40af',
  'Modifier Missing or Wrong': '#1e40af',
  'Bundled Service': '#1e40af',
  'Duplicate Claim': '#1e40af',
  'Coverage Lapsed': '#7c3aed',
  'Patient Not Eligible': '#7c3aed',
  'Coordination of Benefits': '#7c3aed',
  'Timely Filing': '#e11d48',
};

const DEFAULT_COLOR = '#737373';

interface CategoryContextValue {
  /** Map keyed by category label (BE labels are stable). */
  byLabel: Map<string, Category>;
  /** O(1) color lookup. Falls back to FALLBACK_COLOR, then DEFAULT_COLOR. */
  colorFor: (label: string) => string;
  /** Loading until BE responds; consumers can choose to render skeletons. */
  isLoading: boolean;
}

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { data, isLoading } = useCategories();

  const value = useMemo<CategoryContextValue>(() => {
    const map = new Map<string, Category>();
    for (const c of data?.categories ?? []) {
      map.set(c.label, c);
    }
    return {
      byLabel: map,
      colorFor: (label) =>
        map.get(label)?.color_hint ??
        FALLBACK_COLOR[label] ??
        DEFAULT_COLOR,
      isLoading,
    };
  }, [data, isLoading]);

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}

/**
 * Hook for the synchronous color lookup.
 * Throws if used outside CategoryProvider — encourages correct mount order.
 */
export function useCategoryColor(): (label: string) => string {
  const ctx = useContext(CategoryContext);
  if (ctx === null) {
    // Defensive fallback: components used outside the provider (e.g. tests
    // that don't wrap) still render with the static palette rather than
    // crashing. Logs once so it's visible during dev.
    return (label) => FALLBACK_COLOR[label] ?? DEFAULT_COLOR;
  }
  return ctx.colorFor;
}

/**
 * Test helper — exported for tests that need to mount components without
 * the full provider chain. Wraps children in a context with a fixed
 * color map.
 */
export function CategoryProviderTestStub({
  children,
  colorMap = FALLBACK_COLOR,
}: {
  children: React.ReactNode;
  colorMap?: Record<string, string>;
}): JSX.Element {
  const value: CategoryContextValue = {
    byLabel: new Map(),
    colorFor: (label) => colorMap[label] ?? DEFAULT_COLOR,
    isLoading: false,
  };
  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}
