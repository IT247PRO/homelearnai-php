import { fileURLToPath, URL } from 'node:url';

// Explicit config path, not the bare `tailwindcss: {}` shorthand — Tailwind v3's PostCSS
// plugin resolves an unspecified config relative to process.cwd(), and the dev server (root
// server.ts) now runs with cwd at the repo root (a parent of client/), where no
// tailwind.config.js exists, so it was silently falling back to zero content and emitting
// only the Preflight base reset.
const tailwindConfigPath = fileURLToPath(new URL('./tailwind.config.js', import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: tailwindConfigPath },
    autoprefixer: {},
  },
};
