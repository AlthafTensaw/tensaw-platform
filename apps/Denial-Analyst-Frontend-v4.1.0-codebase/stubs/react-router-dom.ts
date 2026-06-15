/**
 * Stub for react-router-dom — supports BOTH SSR snapshots and interactive tests.
 *
 * Uses a shared module-level store + subscription model so writes from one
 * component reflect in reads from another. In jsdom tests this is what
 * makes `setSearchParams` in a click handler actually visible to other
 * components that re-render. In SSR (no DOM), tests can pre-seed the store
 * via __setSearchParams.
 *
 * In production, the real react-router-dom drop-in is used.
 */
import {
  useState,
  useEffect,
  useCallback,
  createElement,
  type ReactNode,
  type MouseEvent,
} from 'react';

interface SearchParamsInterface {
  get(key: string): string | null;
  has(key: string): boolean;
  set(key: string, value: string): void;
  delete(key: string): void;
  toString(): string;
  forEach(cb: (value: string, key: string) => void): void;
}

class StubSearchParams implements SearchParamsInterface {
  private map = new Map<string, string>();
  constructor(init?: string | StubSearchParams | Record<string, string>) {
    if (init === undefined) return;
    if (typeof init === 'string') {
      const p = new URLSearchParams(init);
      p.forEach((v, k) => this.map.set(k, v));
    } else if (init instanceof StubSearchParams) {
      init.map.forEach((v, k) => this.map.set(k, v));
    } else {
      Object.entries(init).forEach(([k, v]) => this.map.set(k, v));
    }
  }
  get(key: string): string | null { return this.map.get(key) ?? null; }
  has(key: string): boolean { return this.map.has(key); }
  set(key: string, value: string): void { this.map.set(key, value); }
  delete(key: string): void { this.map.delete(key); }
  toString(): string {
    const p = new URLSearchParams();
    this.map.forEach((v, k) => p.set(k, v));
    return p.toString();
  }
  forEach(cb: (value: string, key: string) => void): void {
    this.map.forEach(cb);
  }
}

// ============================================================================
// Shared store — all useSearchParams calls subscribe to this
// ============================================================================

let sharedParams = new StubSearchParams();
const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach((fn) => fn());
}

/** Test helper: pre-seed URL params before render. */
export function __setSearchParams(init: string | Record<string, string>): void {
  sharedParams = new StubSearchParams(init);
  notify();
}

/** Test helper: snapshot current URL params (for assertions). */
export function __getSearchParams(): string {
  return sharedParams.toString();
}

/** Test helper: reset back to empty between tests. */
export function __resetSearchParams(): void {
  sharedParams = new StubSearchParams();
  notify();
}

/** Test helper: navigation pathname (since this is a Router stub, no real history). */
let pathname = '/';
export function __setPathname(p: string): void {
  pathname = p;
  notify();
}
export function __getPathname(): string {
  return pathname;
}
export function __resetPathname(): void {
  pathname = '/';
  notify();
}

// ============================================================================
// Hooks
// ============================================================================

export function useSearchParams(): [
  SearchParamsInterface,
  (next: SearchParamsInterface | string | Record<string, string>) => void,
] {
  // Use a small force-rerender pattern to subscribe to sharedParams changes
  const [, setTick] = useState(0);
  useEffect(() => {
    const rerender = (): void => setTick((t) => t + 1);
    subscribers.add(rerender);
    return () => {
      subscribers.delete(rerender);
    };
  }, []);

  const set = useCallback(
    (next: SearchParamsInterface | string | Record<string, string>) => {
      if (typeof next === 'string') sharedParams = new StubSearchParams(next);
      else if (next instanceof StubSearchParams) sharedParams = next;
      else sharedParams = new StubSearchParams(next as Record<string, string>);
      notify();
    },
    [],
  );
  return [sharedParams, set];
}

export function useLocation(): { pathname: string; search: string } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const rerender = (): void => setTick((t) => t + 1);
    subscribers.add(rerender);
    return () => { subscribers.delete(rerender); };
  }, []);

  return {
    pathname,
    search: sharedParams.toString() === '' ? '' : `?${sharedParams.toString()}`,
  };
}

export function useNavigate(): (to: string) => void {
  return useCallback((to: string) => {
    // Parse `to` into pathname + search
    const [path, query = ''] = to.split('?');
    pathname = path ?? '/';
    sharedParams = new StubSearchParams(query);
    notify();
  }, []);
}

// ============================================================================
// Components
// ============================================================================

interface LinkProps {
  to: string;
  children?: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  'aria-label'?: string;
}

export function Link(props: LinkProps): ReactNode {
  const { to, children, className, onClick, ...rest } = props;
  return createElement('a', { href: to, className, onClick, ...rest }, children);
}

export const NavLink = Link;

/**
 * Navigate component — render-time redirect. Used by P1.12 LegacyRedirect.
 * Sets pathname + search on mount.
 */
export function Navigate({ to, replace: _replace = false }: { to: string; replace?: boolean }): null {
  useEffect(() => {
    const [path, query = ''] = to.split('?');
    pathname = path ?? '/';
    sharedParams = new StubSearchParams(query);
    notify();
  }, [to]);
  return null;
}
