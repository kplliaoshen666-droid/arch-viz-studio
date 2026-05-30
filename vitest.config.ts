import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // shared/ + cli/ + app/ pure-logic tests run Node-side (no DOM needed).
    include: ['shared/**/*.test.ts', 'cli/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
  },
});
