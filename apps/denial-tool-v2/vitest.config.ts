import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: {
      '@tensaw/actions': path.resolve(__dirname, './stubs/tensaw/actions.ts'),
      'react-router-dom': path.resolve(__dirname, './stubs/react-router-dom.ts'),
    },
  },
});
