import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts', 'dashboard/**/*.test.mjs'] },
});
