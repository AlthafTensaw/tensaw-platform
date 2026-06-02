
 /**
 * PostCSS config for denial-tool — v3.0.2.
 *
 * Vite auto-detects this file at the app root. Tailwind processes
 * utility classes from the src directory into the final CSS bundle.
 * Autoprefixer adds vendor prefixes per the browserslist config.
 */

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};