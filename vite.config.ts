import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { renderDocs } from './src/lib/markdown.ts';

const DOCS = fileURLToPath(new URL('./docs/', import.meta.url));
const ID = 'virtual:docs';

function docs(): Plugin {
  return {
    name: 'docs',
    resolveId: (id) => (id === ID ? '\0' + ID : undefined),
    load(id) {
      if (id !== '\0' + ID) return;
      const files = Object.fromEntries(
        readdirSync(DOCS)
          .filter((f) => f.endsWith('.md'))
          .map((f) => {
            this.addWatchFile(DOCS + f);
            return [f.slice(0, -3), readFileSync(DOCS + f, 'utf8')];
          }),
      );
      return `export default ${JSON.stringify(renderDocs(files))};`;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [svelte(), docs()],
  test: { include: ['src/**/*.test.ts', 'dashboard/**/*.test.mjs'] },
});
