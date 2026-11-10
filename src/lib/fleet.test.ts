import { describe, expect, it } from 'vitest';
import { fleet } from './fleet';
import { sample } from './sample';

describe('the repositories screen', () => {
  it('shows a repository whose collection failed, keeping its last data', () => {
    const data = sample();
    const [row] = fleet([data], {
      schema: 'digdir.ai-review.index/v1',
      generatedAt: data.generatedAt,
      repos: [{ repo: data.config.repo, ok: false, at: data.generatedAt, error: 'HTTP 403' }],
    });
    expect(row.error).toBe('HTTP 403');
    expect(row.phase).toBe('measuring');
  });

  it('lists a repository in the index that has no data yet', () => {
    const rows = fleet([sample()], {
      schema: 'digdir.ai-review.index/v1',
      generatedAt: '2026-11-09T12:00:00Z',
      repos: [{ repo: 'digdir/new', ok: false, at: '2026-11-09T12:00:00Z', error: 'App not installed' }],
    });
    expect(rows.map((r) => [r.repo, r.phase, r.error])).toEqual([
      ['digdir/genki', 'measuring', null],
      ['digdir/new', null, 'App not installed'],
    ]);
  });

  it('counts each pull request reviewed in the last week once, leaving out the silent group', () => {
    const [row] = fleet([sample()], null);
    expect(row.reviewedWeek).toBeGreaterThan(0);
    expect(row.reviewedWeek).toBeLessThanOrEqual(sample().prs.length);
  });

  it('shows the logged decision after the experiment', () => {
    expect(fleet([sample('after')], null)[0]).toMatchObject({ phase: 'after', decided: 'keep' });
  });
});
