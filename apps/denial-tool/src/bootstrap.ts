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

export function loadUserFromToken(token: string) {
  let email = 'user@example.com';
  let payload: any = {};
  try {
    payload = JSON.parse(atob(token.split('.')[1] || ''));
    email = payload.email || email;
  } catch {}

  const groups = payload['cognito:groups'] || [];
  // Use window to avoid circular dependencies with lazy loading in bootstrap
  const role = (window as any)._pickHighestRole?.(groups) || 'ANALYST';
  const extractedClinics = (window as any)._extractClinicIds?.(groups)?.map((id: any) => `c-${String(id).padStart(3, '0')}`) || [];
  const clinicIds = extractedClinics.length > 0 ? extractedClinics : ['c-001'];

  return {
    user: {
      userId: payload.sub || 'real-user',
      username: payload['cognito:username'] || email.split('@')[0],
      email,
      fullName: payload.display_name || payload.name || 'Cognito User',
      roles: [role],
      permissions: (window as any)._resolvePermissions?.([role]) || [],
      clinicIds: clinicIds
    },
    clinicId: clinicIds[0]
  };
}

async function doBootstrap(): Promise<void> {
  registerDenialActions();
  registerDenialV3Actions();

  if (import.meta.env.DEV && import.meta.env.VITE_API_MODE !== 'real') {
    try {
      const { setupWorker } = await import('msw/browser');
      const { config } = await import('@tensaw/runtime');
      
      let handlers: any[] = [];
      if (import.meta.env.VITE_API_VERSION === 'v4') {
        const { handlersV4, seedV4 } = await import('./mocks/v4');
        seedV4();
        handlers = handlersV4(config.api.baseUrl);
      } else {
        const { buildDenialHandlers } = await import('@tensaw/mock-server');
        const { buildDenialV3Handlers } = await import('../mock-server-patches/denialV3Handlers');
        handlers = [
          ...buildDenialHandlers(config.api.baseUrl),
          ...buildDenialV3Handlers(config.api.baseUrl),
        ];
      }
      
      const worker = setupWorker(...handlers);
      await worker.start({ quiet: true, onUnhandledRequest: 'bypass' });
    } catch (e) {
      console.warn('[bootstrap] MSW failed to start:', e);
    }
  }

  const { bootstrapApp } = await import('@tensaw/runtime');
  
  await bootstrapApp({
    loadAuthUser: async (token: string) => {
      // Lazy load permissions to avoid circular deps during startup, store them on window
      const { resolvePermissions, pickHighestRole, extractClinicIds } = await import('./auth/permissions');
      (window as any)._resolvePermissions = resolvePermissions;
      (window as any)._pickHighestRole = pickHighestRole;
      (window as any)._extractClinicIds = extractClinicIds;
      return loadUserFromToken(token);
    }
  });
}
