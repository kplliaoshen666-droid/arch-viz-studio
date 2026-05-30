import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Run from the repo root via `vite --config app/vite.config.ts`; root is this app dir.
export default defineConfig({
  root: import.meta.dirname,
  base: './', // relative asset paths so the built viewer works from file:// (Phase 4)
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
