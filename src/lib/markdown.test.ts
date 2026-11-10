import { describe, expect, it } from 'vitest';
import { renderDoc, renderDocs, rewriteHref, slug } from './markdown';

const pages = ['experiment', 'runbook'];

describe('docs rendering', () => {
  it('gives headings the anchors GitHub gives them', () => {
    expect(slug('Measures and thresholds')).toBe('measures-and-thresholds');
    expect(slug('`REVIEW.md` template')).toBe('reviewmd-template');
    expect(slug("This week's checklist")).toBe('this-weeks-checklist');
  });

  it('takes the first top heading as the title and lists the rest with ids', () => {
    const d = renderDoc('runbook', '# Runbook\n\n## Every Monday\n\nText.\n\n### Notes\n', pages);
    expect(d.title).toBe('Runbook');
    expect(d.headings).toEqual([
      { id: 'every-monday', text: 'Every Monday', depth: 2 },
      { id: 'notes', text: 'Notes', depth: 3 },
    ]);
    expect(d.html).toContain('<h2 id="every-monday">Every Monday<a class="anchor" href="#/docs/runbook#every-monday"');
    expect(d.html).not.toContain('<h1');
  });

  it('numbers a repeated heading so every anchor is unique', () => {
    const d = renderDoc('runbook', '## Records\n\n## Records\n', pages);
    expect(d.headings.map((h) => h.id)).toEqual(['records', 'records-1']);
  });

  it('keeps links between docs inside the app', () => {
    expect(rewriteHref('experiment.md#the-change-log', 'runbook', pages)).toBe('#/docs/experiment#the-change-log');
    expect(rewriteHref('runbook.md', 'experiment', pages)).toBe('#/docs/runbook');
    expect(rewriteHref('#when-a-review-fails', 'runbook', pages)).toBe('#/docs/runbook#when-a-review-fails');
  });

  it('sends links to code and other files to GitHub', () => {
    expect(rewriteHref('../src/lib/compute.ts', 'experiment', pages)).toBe('https://github.com/digdir/ai-review/blob/main/src/lib/compute.ts');
    expect(rewriteHref('../README.md#setup', 'runbook', pages)).toBe('https://github.com/digdir/ai-review/blob/main/README.md#setup');
    expect(rewriteHref('other.md', 'runbook', pages)).toBe('https://github.com/digdir/ai-review/blob/main/docs/other.md');
  });

  it('leaves outside links alone', () => {
    expect(rewriteHref('https://example.org/a#b', 'runbook', pages)).toBe('https://example.org/a#b');
  });

  it('shows raw HTML in a doc as text', () => {
    expect(renderDoc('runbook', 'Hi <script>alert(1)</script>\n', pages).html).not.toContain('<script>');
  });

  it('orders the pages as the docs nav lists them', () => {
    expect(renderDocs({ zeta: '# Z', runbook: '# R', experiment: '# E' }).map((p) => p.id)).toEqual(['experiment', 'runbook', 'zeta']);
  });
});
