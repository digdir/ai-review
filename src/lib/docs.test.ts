import { describe, expect, it } from 'vitest';
import { DOCS, docHref, docLabel } from './docs';
import { CRITERIA } from './labels';

const sources = import.meta.glob(['../**/*.svelte', '../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const links = Object.entries(sources).flatMap(([file, text]) =>
  [...text.matchAll(/doc(?:=\{|: )\[\s*'([\w-]+)',\s*'([\w-]+)'\s*\]|docHref\('([\w-]+)'(?:,\s*'([\w-]+)')?\)/g)].map((m) => ({
    file,
    page: m[1] ?? m[3],
    anchor: m[2] ?? m[4],
  })),
);
const exists = (page: string, anchor?: string) => {
  const p = DOCS.find((d) => d.id === page);
  return !!p && (!anchor || p.headings.some((h) => h.id === anchor));
};

describe('docs in the app', () => {
  it('renders every page in docs/ with a title', () => {
    expect(DOCS.map((d) => d.id)).toEqual(expect.arrayContaining(['experiment', 'working-with-the-review', 'runbook', 'grading', 'joining', 'platform']));
    for (const d of DOCS) expect(d.title).not.toBe(d.id);
  });

  it('every link into the docs lands on a page and heading that exist', () => {
    expect(links.length).toBeGreaterThan(20);
    expect(links.filter((l) => !exists(l.page, l.anchor))).toEqual([]);
  });

  it('every criterion explains itself with a link to its heading', () => {
    for (const c of CRITERIA) expect(exists(...c.doc), c.key).toBe(true);
  });

  it('links between docs resolve inside the app', () => {
    const inApp = DOCS.flatMap((d) => [...d.html.matchAll(/href="#\/docs\/([\w-]+)(?:#([\w-]+))?"/g)].map((m) => [m[1], m[2]] as const));
    expect(inApp.length).toBeGreaterThan(0);
    expect(inApp.filter(([p, a]) => !exists(p, a))).toEqual([]);
  });

  it('names the heading a link goes to', () => {
    expect(docHref('runbook', 'when-a-review-fails')).toBe('#/docs/runbook#when-a-review-fails');
    expect(docLabel('runbook', 'when-a-review-fails')).toBe('When a review fails, in Runbook');
  });
});
