/**
 * LegacyRedirect — catches v3 /denials/* URLs and forwards to v4 /inbox.
 *
 * The v3 frontend routed under /denials/...; v4 routes under /inbox/.... Old
 * bookmarks should land users in the new app rather than 404. We don't
 * attempt to preserve v3-specific params (denial IDs don't map cleanly to v4
 * case IDs) — the user gets the default inbox view.
 *
 * Mount this at the v3 path:
 *   <Route path="/denials/*" element={<LegacyRedirect />} />
 *
 * Drop-in path: src/components/LegacyRedirect.tsx
 */

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export interface LegacyRedirectProps {
  /** Target v4 route. Default '/inbox'. */
  to?: string;
}

export function LegacyRedirect({ to = '/inbox' }: LegacyRedirectProps): React.ReactElement {
  const location = useLocation();

  // Log so analysts know they hit a legacy URL. Helps surface lingering
  // bookmarks for cleanup or doc updates.
  useEffect(() => {
    const fromUrl = `${location.pathname}${location.search}`;
    // eslint-disable-next-line no-console
    console.info(`[LegacyRedirect] ${fromUrl} → ${to}`);
  }, [location.pathname, location.search, to]);

  return <Navigate to={to} replace />;
}
