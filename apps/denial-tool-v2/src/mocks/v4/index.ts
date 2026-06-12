/**
 * Barrel export for the v4 mock-server.
 *
 *   import { seedV4, handlersV4 } from './mocks/v4';
 *
 * Drop-in path: src/mocks/v4/index.ts
 */

export { seedV4 } from './seed';
export { handlersV4 } from './handlers';

// Power-user exports for tests / debugging
export { db } from './db';
export { WORKFLOWS, CATEGORY_TO_WORKFLOW } from './workflows';
