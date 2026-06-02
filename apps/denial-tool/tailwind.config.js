/**
 * Tailwind config for denial-tool — v3.0.2.
 *
 * Extends the shared `@tensaw/design-system` Tailwind preset so the
 * platform palette, spacing, and component utilities are available.
 * Content globs cover both this app's source AND the workspace packages
 * we import from, so utility classes embedded in shared components
 * also get included in the final bundle.
 *
 * If `@tensaw/design-system/tailwind-preset` doesn't exist in your
 * workspace, swap the `presets` line for a direct config equivalent —
 * but the preset is the supported path for monorepo consistency.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@tensaw/design-system/tailwind-preset')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
    // Pull in any utility classes used by shared packages we render
    '../../packages/design-system/src/**/*.{ts,tsx}',
    '../../packages/composition/src/**/*.{ts,tsx}',
    '../../packages/runtime/src/**/*.{ts,tsx}',
    '../../packages/actions/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // App-specific extensions on top of the preset. Most styling lives
      // in the design-system preset; add denial-tool-specific tokens here
      // if needed.
      colors: {
        // The reference-pane teal used in the work surface banner.
        // Matches the mockup palette.
        'banner-teal': '#134e4a',
        'accent-teal': '#0d9488',
        'accent-teal-soft': '#f0fdfa',
      },
    },
  },
  plugins: [],
};
