import preset from '@tensaw/design-system/tailwind.config.js';

export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
    '../../packages/composition/src/**/*.{ts,tsx}',
    '../../packages/worklist/src/**/*.{ts,tsx}',
    '../../packages/wired-components/src/**/*.{ts,tsx}',
  ],
};
