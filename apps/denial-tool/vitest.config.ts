import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts', './src/test/setup.ts'],
    passWithNoTests: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/playwright/**',
      '**/eslint-plugins/**',
    ],
    include: [
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    // Integration tests import the full app graph (runtime → composition →
    // worklist → page). First-import compile is slow under jsdom; patient
    // hit 15s on cold start. Mirroring.
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      // Stubs for isolated v4 tests — replace with real packages in production
      '@tensaw/actions': path.resolve(__dirname, './stubs/tensaw/actions.ts'),
      'react-router-dom': path.resolve(__dirname, './stubs/react-router-dom.ts'),
    },
  },
});
