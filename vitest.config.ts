import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // shared/ + cli/ are Node-side; app/ adds a jsdom project in Phase 3.
    include: ['shared/**/*.test.ts', 'cli/**/*.test.ts'],
    environment: 'node',
  },
});
