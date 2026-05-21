import preset from '../packages/design-system/tailwind.config.js';

export default {
  presets: [preset],
  content: [
    '../packages/design-system/src/**/*.{ts,tsx}',
    '../packages/composition/src/**/*.{ts,tsx}',
    '../packages/wired-components/src/**/*.{ts,tsx}',
  ],
};
