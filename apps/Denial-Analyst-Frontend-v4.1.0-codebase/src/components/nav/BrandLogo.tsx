/**
 * BrandLogo — wordmark for the TopNav left edge.
 *
 * Drop-in path: src/components/nav/BrandLogo.tsx
 */

import { Link } from 'react-router-dom';

export function BrandLogo(): React.ReactElement {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:text-white"
      aria-label="Denial Analyst Tool — home"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
      <span className="font-semibold tracking-tight">Denial Analyst Tool</span>
    </Link>
  );
}
