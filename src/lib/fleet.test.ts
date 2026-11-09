import { describe, expect, it } from 'vitest';
import { fleet, overall } from './fleet';
import { sample } from './sample';

describe('the overview of all repositories', () => {
  it('gives GO only when every criterion is met, and NO-GO as soon as one is not', () => {
    expect(overall(['ok', 'ok'])).toBe('ok');
    expect(overall(['ok', 'bad', 'wait'])).toBe('bad');
    expect(overall(['ok', 'wait', 'early'])).toBe('wait');
    expect(overall(['ok', 'early'])).toBe('early');
  });

  it('shows a repository whose collection failed, keeping its last data', () => {
    const data = sample();
    const [row] = fleet([data], {
      schema: 'digdir.ai-review.index/v1',
      generatedAt: data.generatedAt,
      repos: [{ repo: data.config.repo, ok: false, at: data.generatedAt, error: 'HTTP 403' }],
    });
    expect(row.error).toBe('HTTP 403');
    expect(row.status).not.toBeNull();
  });

  it('lists a repository in the index that has no data yet', () => {
    const rows = fleet([sample()], {
      schema: 'digdir.ai-review.index/v1',
      generatedAt: '2026-11-09T12:00:00Z',
      repos: [{ repo: 'digdir/new', ok: false, at: '2026-11-09T12:00:00Z', error: 'App not installed' }],
    });
    expect(rows.map((r) => [r.repo, r.status, r.error])).toEqual([
      ['digdir/genki', expect.any(String), null],
      ['digdir/new', null, 'App not installed'],
    ]);
  });

  it('counts each pull request reviewed in the last week once, leaving out the silent group', () => {
    const [row] = fleet([sample()], null);
    expect(row.reviewedWeek).toBeGreaterThan(0);
    expect(row.reviewedWeek).toBeLessThanOrEqual(sample().prs.length);
  });
});
