import { describe, expect, it } from 'vitest';
import { DEFAULTS, compute, filterFindings } from './compute';
import { sample } from './sample';
import type { Data, Finding, Pr, Run } from './types';

const START = '2026-11-09';
const iso = (s: string) => new Date(s).toISOString();

function pr(n: number, created: string, merged: string | null, extra: Partial<Pr> = {}): Pr {
  return {
    n, title: 'Change something', state: merged ? 'MERGED' : 'OPEN', draft: false, created: iso(created), merged: merged && iso(merged),
    lines: 10, files: [`f${n}.ts`], bot: false, human_review: false, arm: null, author_kind: null, findings: [], ...extra,
  };
}

function finding(outcome: string, severity = 'Important', extra: Partial<Finding> = {}): Finding {
  return { posted: iso('2026-11-10T10:00:00Z'), severity, path: 'apps/api/src/x.ts', outcome, replies: 0, url: '', ...extra };
}

function review(prNumber: number, startedAt = '2026-11-10T09:00:00Z'): Run {
  return { run_id: `r${prNumber}`, pr_number: prNumber, job: 'review', started_at: iso(startedAt), completed: true, cost_usd: 1, subagents: 5, source: 'record' };
}

function data(prs: Pr[], runs: Run[] = [], now = '2026-11-20T12:00:00Z'): Data {
  return {
    schema: 'test', generatedAt: iso(now), config: { repo: 'digdir/genki', baselineFrom: '2026-10-19', start: START },
    prs, runs, ci: [], azure: [], now: Date.parse(now),
  };
}

function reviewedWithFindings(count: number, outcomes: (i: number) => string, severity = 'Important') {
  const prs = Array.from({ length: count }, (_, i) =>
    pr(500 + i, '2026-11-10T08:00:00Z', '2026-11-10T12:00:00Z', { arm: 'treated', findings: [finding(outcomes(i), severity)] }),
  );
  return data(prs, prs.map((p) => review(p.n)));
}

const status = (d: Data, name: RegExp) => compute(d, DEFAULTS).criteria.find((c) => name.test(c.name))!.status;

describe('change log', () => {
  it('shows each logged change in the feed with its kind and pull request', () => {
    const d = { ...data([]), changes: [{ date: '2026-11-12', kind: 'rule' as const, ref: 'digdir/genki#430', note: 'Tighter rule for tenant checks' }] };
    expect(compute(d, DEFAULTS).events).toContainEqual(expect.objectContaining({ kind: 'CHANGE', text: 'rule · #430 · Tighter rule for tenant checks' }));
  });
});

describe('criteria', () => {
  it('waits with the Important fixed rate until there are ten findings', () => {
    expect(status(reviewedWithFindings(9, () => 'fixed'), /Important fix rate/)).toBe('early');
  });

  it('passes the Important fixed rate at or above the target', () => {
    expect(status(reviewedWithFindings(10, (i) => (i < 5 ? 'fixed' : 'open')), /Important fix rate/)).toBe('ok');
  });

  it('fails the Important fixed rate below the target', () => {
    expect(status(reviewedWithFindings(10, (i) => (i < 4 ? 'fixed' : 'open')), /Important fix rate/)).toBe('bad');
  });

  it('judges the dismissed share only after twenty findings', () => {
    expect(status(reviewedWithFindings(19, () => 'dismissed', 'Nit'), /dismissed/)).toBe('early');
    expect(status(reviewedWithFindings(20, () => 'dismissed', 'Nit'), /dismissed/)).toBe('bad');
    expect(status(reviewedWithFindings(20, (i) => (i < 9 ? 'dismissed' : 'fixed'), 'Nit'), /dismissed/)).toBe('ok');
  });

  it('holds precision while nothing is graded', () => {
    expect(status(reviewedWithFindings(3, () => 'fixed'), /Precision/)).toBe('wait');
  });

  it('counts only Important findings confirmed fixed as missed by CI', () => {
    const d = reviewedWithFindings(4, (i) => (i < 3 ? 'fixed' : 'open'));
    expect(compute(d, DEFAULTS).ciMissed).toBe(3);
    expect(status(d, /automated checks/)).toBe('ok');
  });
});

describe('findings', () => {
  it('keeps shadow findings out of the posted findings and fixed rates', () => {
    const d = data([
      pr(1, '2026-11-10T08:00:00Z', '2026-11-10T12:00:00Z', { arm: 'shadow', findings: [finding('open')] }),
      pr(2, '2026-11-10T08:00:00Z', '2026-11-10T12:00:00Z', { arm: 'treated', findings: [finding('fixed')] }),
    ]);
    const m = compute(d, DEFAULTS);
    expect(m.F).toHaveLength(2);
    expect(m.posted).toHaveLength(1);
    expect(m.important.k).toBe(1);
    expect(m.important.n).toBe(1);
  });

  it('leaves bot pull requests out of merge statistics', () => {
    const d = data([pr(1, '2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z', { bot: true }), pr(2, '2026-11-10T08:00:00Z', '2026-11-10T10:00:00Z')]);
    expect(compute(d, DEFAULTS).since.map((p) => p.n)).toEqual([2]);
  });

  it('filters shadow findings only when asked for and sorts Important first', () => {
    const d = data([
      pr(1, '2026-11-10T08:00:00Z', null, { arm: 'treated', findings: [finding('open', 'Nit'), finding('fixed', 'Important')] }),
      pr(2, '2026-11-10T08:00:00Z', null, { arm: 'shadow', findings: [finding('open', 'Nit')] }),
    ]);
    const m = compute(d, DEFAULTS);
    expect(filterFindings(m.F, 'All', 'All').map((f) => f.severity)).toEqual(['Important', 'Nit']);
    expect(filterFindings(m.F, 'All', 'shadow').map((f) => f.pr)).toEqual([2]);
    expect(filterFindings(m.F, 'Nit', 'fixed')).toEqual([]);
  });
});

describe('weekly series', () => {
  const merges = (count: number, day: string) => Array.from({ length: count }, (_, i) => pr(100 + i, `${day}T08:00:00Z`, `${day}T10:00:00Z`));

  it('buckets weeks from the Monday of the baseline start', () => {
    const m = compute(data([], [], '2026-11-12T12:00:00Z'), DEFAULTS);
    expect(m.weeks.map((w) => new Date(w.w).toISOString().slice(0, 10))).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(m.weeks.map((w) => w.phase)).toEqual(['base', 'base', 'base', 'review']);
  });

  it('counts a merge in the week it was merged, not created', () => {
    const d = data([pr(1, '2026-11-06T08:00:00Z', '2026-11-10T08:00:00Z')], [], '2026-11-12T12:00:00Z');
    const m = compute(d, DEFAULTS);
    expect(m.weeks.map((w) => w.n)).toEqual([0, 0, 0, 1]);
  });

  it('hides a week with fewer merged pull requests than minCell', () => {
    const d = data(merges(4, '2026-10-20'), [], '2026-10-25T12:00:00Z');
    const [w] = compute(d, DEFAULTS).weeks;
    expect(w.n).toBe(4);
    expect(w.hidden).toBe(true);
    expect(w.med).toBeNull();
    expect(w.noHuman).toBeNull();
  });

  it('shows a week once it reaches minCell', () => {
    const d = data(merges(5, '2026-10-20'), [], '2026-10-25T12:00:00Z');
    const [w] = compute(d, DEFAULTS).weeks;
    expect(w.hidden).toBe(false);
    expect(w.med).toBe(2);
    expect(w.noHuman).toBe(1);
  });

  it('respects a stricter minCell from the config', () => {
    const d = data(merges(5, '2026-10-20'), [], '2026-10-25T12:00:00Z');
    expect(compute(d, { ...DEFAULTS, minCell: 10 }).weeks[0].hidden).toBe(true);
  });
});

describe('sample data', () => {
  const d = sample();
  const m = compute(d, DEFAULTS);

  it('is the same on every call', () => {
    expect(sample()).toEqual(d);
  });

  it('covers three baseline weeks and six review weeks', () => {
    expect(m.weeks.filter((w) => w.phase === 'base')).toHaveLength(3);
    expect(m.weeks.filter((w) => w.phase === 'review')).toHaveLength(6);
    expect(m.week).toBe(6);
  });

  it('has enough data for every criterion to be judged', () => {
    expect(m.criteria).toHaveLength(7);
    expect(m.criteria.filter((c) => c.status === 'early' || c.status === 'wait')).toHaveLength(0);
  });

  it('keeps fixed rates and intervals between 0 and 1', () => {
    for (const r of [...m.bySev, ...m.kinds, m.dismissed, m.precision, m.followAcc]) {
      expect(r.v).toBeGreaterThanOrEqual(0);
      expect(r.v).toBeLessThanOrEqual(1);
      expect(r.ci![0]).toBeLessThanOrEqual(r.v!);
      expect(r.ci![1]).toBeGreaterThanOrEqual(r.v!);
    }
  });

  it('compares merge time with the shadow group when it is large enough', () => {
    expect(m.shadowT.n).toBeGreaterThanOrEqual(10);
    expect(m.criteria.find((c) => /Time to merge/.test(c.name))!.value).toMatch(/shadow group$/);
  });
});
