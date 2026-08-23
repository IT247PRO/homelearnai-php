import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Inline (empty) postcss config so Vite doesn't walk up to the repo-root
  // postcss.config.js (the original Laravel app's Tailwind setup) — this is a
  // server-only test suite with no CSS involved.
  css: {
    postcss: {},
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
