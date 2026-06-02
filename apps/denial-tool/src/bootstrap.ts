/**
 * Denial Analysis Tool — app bootstrap (v3.0).
 *
 * Runs once at app start to:
 *   1. Register the v2.x action set (12 actions per tech spec §7)
 *   2. Register the v3.0 action set (9 new actions for right-pane tabs)
 *   3. Start the MSW worker in dev with both v2 and v3 handlers
 *
 * bootstrap() is idempotent: concurrent callers share a cached promise.
 */

import { registerDenialActions } from './actions';
import { registerDenialV3Actions } from './actions/registryV3';

let bootstrapPromise: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = doBootstrap();
  return bootstrapPromise;
}

async function doBootstrap(): Promise<void> {
  registerDenialActions();
  registerDenialV3Actions();

  if (import.meta.env.DEV) {
    try {
      const { setupWorker } = await import('msw/browser');
      const { buildDenialHandlers, buildDenialV3Handlers } = await import(
        '@tensaw/mock-server'
      );
      const { config } = await import('@tensaw/runtime');
      const worker = setupWorker(
        ...buildDenialHandlers(config.api.baseUrl),
        ...buildDenialV3Handlers(config.api.baseUrl),
      );
      await worker.start({ quiet: true, onUnhandledRequest: 'bypass' });
    } catch (e) {
      console.warn('[bootstrap] MSW failed to start:', e);
    }
  }
}
