/**
 * Denial Analysis Tool — app bootstrap.
 *
 * Runs once at app start to:
 *   1. Register the denial-tool action set with the @tensaw/actions
 *      dispatcher (12 actions per tech spec §7).
 *   2. Start the MSW worker in dev so action endpoints resolve against
 *      buildDenialHandlers from @tensaw/mock-server.
 *
 * bootstrap() is idempotent: concurrent callers share a cached promise.
 *
 * setRouterAdapter is wired inside <AppLayout> (we need React Router's
 * useNavigate to drive it), matching both existing apps.
 */

import { registerDenialActions } from './actions';

let bootstrapPromise: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = doBootstrap();
  return bootstrapPromise;
}

async function doBootstrap(): Promise<void> {
  // Register actions first so anything that depends on a registered
  // action id (MSW handler request schemas, useActionQuery callers) is
  // consistent.
  registerDenialActions();

  // Start MSW only in development when explicitly enabled.
  // In test, msw/node is wired by vitest.setup.ts.
  // In production, the real backend handles requests.
  const mswEnabled = import.meta.env.VITE_ENABLE_MSW === 'true';
  if (import.meta.env.DEV && !mswEnabled && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const isMswRegistration = (r: ServiceWorkerRegistration): boolean => {
      const scriptUrls = [
        r.active?.scriptURL,
        r.waiting?.scriptURL,
        r.installing?.scriptURL,
      ].filter((u): u is string => Boolean(u));
      return scriptUrls.some((u) => u.includes('mockServiceWorker.js'));
    };
    await Promise.all(
      registrations
        .filter(isMswRegistration)
        .map((r) => r.unregister()),
    );
  }

  if (import.meta.env.DEV && mswEnabled) {
    try {
      const { setupWorker } = await import('msw/browser');
      const { buildDenialHandlers } = await import('@tensaw/mock-server');
      const { config } = await import('@tensaw/runtime');
      const worker = setupWorker(...buildDenialHandlers(config.api.baseUrl));
      await worker.start({ quiet: true, onUnhandledRequest: 'bypass' });
    } catch (e) {
      console.warn('[bootstrap] MSW failed to start:', e);
    }
  }
}
