import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Served from https://<user>.github.io/devin-demo-battleship/ on GitHub Pages,
// from / during local development.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/devin-demo-battleship/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
