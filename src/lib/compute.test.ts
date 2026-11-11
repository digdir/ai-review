import { describe, expect, it } from 'vitest';
import { hashLogin } from './author';
import { DEFAULTS, compute, emptyRereviews, filterFindings, ruleToday, sweepState, timing, type Criterion } from './compute';
import { sample } from './sample';
import type { Change, CrossRun, Data, Finding, Pr, Run, SweepRun } from './types';

const START = '2026-11-09';
const iso = (s: string) => new Date(s).toISOString();

function pr(n: number, created: string, merged: string | null, extra: Partial<Pr> = {}): Pr {
  return {
    n, title: 'Change something', state: merged ? 'MERGED' : 'OPEN', draft: false, created: iso(created), merged: merged && iso(merged),
    lines: 10, files: [`f${n}.ts`], bot: false, human_review: false, arm: null, author_kind: null, findings: [], ...extra,
  };
}

function finding(outcome: string, severity = 'Important', extra: Partial<Finding> = {}): Finding {
  return { posted: iso('2026-11-24T10:00:00Z'), severity, path: 'apps/api/src/x.ts', outcome, replies: 0, url: '', ...extra };
}

function review(prNumber: number, startedAt = '2026-11-24T09:00:00Z', extra: Partial<Run> = {}): Run {
  return { run_id: `r${prNumber}-${startedAt}`, pr_number: prNumber, job: 'review', started_at: iso(startedAt), completed: true, cost_usd: 1, subagents: 5, source: 'record', ...extra };
}

function data(prs: Pr[], runs: Run[] = [], now = '2026-12-01T12:00:00Z', changes: Change[] = []): Data {
  return {
    schema: 'test', generatedAt: iso(now), config: { repo: 'digdir/genki', baselineFrom: '2026-10-19', start: START },
    prs, runs, ci: [], azure: [], changes, now: Date.parse(now),
  };
}

function reviewed(count: number, outcome: (i: number) => string, opts: { severity?: string; day?: string; now?: string; changes?: Change[] } = {}) {
  const day = opts.day ?? '2026-11-24';
  const prs = Array.from({ length: count }, (_, i) =>
    pr(500 + i, `${day}T08:00:00Z`, `${day}T12:00:00Z`, { arm: 'treated', findings: [finding(outcome(i), opts.severity ?? 'Important', { posted: iso(`${day}T10:00:00Z`) })] }),
  );
  return data(prs, prs.map((p) => review(p.n, `${day}T09:00:00Z`)), opts.now ?? '2026-12-01T12:00:00Z', opts.changes ?? []);
}

const status = (d: Data, key: Criterion['key']) => compute(d, DEFAULTS).criteria.find((c) => c.key === key)!.status;

describe('phases', () => {
  const at = (t: string) => timing(Date.parse(t), START, DEFAULTS);

  it('is setup in weeks 1 and 2', () => {
    expect(at('2026-11-09T00:00:00Z')).toMatchObject({ phase: 'setup', week: 1, day: 1 });
    expect(at('2026-11-22T23:59:00Z')).toMatchObject({ phase: 'setup', week: 2 });
  });

  it('starts measuring on the Monday of week 3', () => {
    expect(at('2026-11-23T00:00:00Z')).toMatchObject({ phase: 'measuring', week: 3, day: 15 });
    expect(new Date(at('2026-11-23T00:00:00Z').measureMs).toISOString().slice(0, 10)).toBe('2026-11-23');
  });

  it('is after the experiment from the Monday after week 6', () => {
    expect(at('2026-12-20T23:59:00Z').phase).toBe('measuring');
    expect(at('2026-12-21T00:00:00Z')).toMatchObject({ phase: 'after', week: 7 });
  });

  it('reads every criterion as too early in the setup weeks, even with enough data', () => {
    const d = reviewed(30, () => 'fixed', { day: '2026-11-10', now: '2026-11-20T12:00:00Z' });
    const m = compute(d, DEFAULTS);
    expect(m.phase).toBe('setup');
    expect(m.criteria.map((c) => c.status)).toEqual(Array(7).fill('early'));
    expect(m.rule).toBeNull();
  });
});

describe('read-when thresholds', () => {
  it('waits with the Important fix rate until there are ten findings', () => {
    expect(status(reviewed(9, () => 'fixed'), 'fix')).toBe('early');
    expect(status(reviewed(10, (i) => (i < 5 ? 'fixed' : 'open')), 'fix')).toBe('met');
    expect(status(reviewed(10, (i) => (i < 4 ? 'fixed' : 'open')), 'fix')).toBe('notmet');
  });

  it('judges the dismissed share only after twenty findings, and under half is met', () => {
    expect(status(reviewed(19, () => 'dismissed', { severity: 'Nit' }), 'dismissed')).toBe('early');
    expect(status(reviewed(20, () => 'dismissed', { severity: 'Nit' }), 'dismissed')).toBe('notmet');
    expect(status(reviewed(20, (i) => (i < 9 ? 'dismissed' : 'fixed'), { severity: 'Nit' }), 'dismissed')).toBe('met');
  });

  it('waits with precision until fifty findings are graded', () => {
    const d = reviewed(3, () => 'fixed');
    const grades = (n: number) => ({ grades: Array.from({ length: n }, () => ({ week: 3, severity: 'Nit', grade: 'right_worth' as const })), followup: [] });
    expect(status({ ...d, grading: grades(49) }, 'precision')).toBe('early');
    expect(status({ ...d, grading: grades(50) }, 'precision')).toBe('met');
  });

  it('waits with the missed-by-the-checks count until week 6 before calling it short', () => {
    expect(status(reviewed(1, () => 'fixed', { now: '2026-12-01T12:00:00Z' }), 'missed')).toBe('early');
    expect(status(reviewed(1, () => 'fixed', { now: '2026-12-17T12:00:00Z' }), 'missed')).toBe('notmet');
    expect(status(reviewed(3, () => 'fixed', { now: '2026-12-01T12:00:00Z' }), 'missed')).toBe('met');
  });

  it('projects the cost only from day five of the month', () => {
    const d = { ...reviewed(1, () => 'fixed', { now: '2026-12-03T12:00:00Z' }), azure: [{ date: '2026-12-01', nok: 100 }] };
    expect(status(d, 'cost')).toBe('early');
    expect(status({ ...d, now: Date.parse('2026-12-06T12:00:00Z') }, 'cost')).toBe('met');
  });

  it('compares time to merge only from twenty reviewed merged pull requests', () => {
    const merges = (count: number) => Array.from({ length: count }, (_, i) => pr(700 + i, '2026-11-24T08:00:00Z', '2026-11-24T10:00:00Z', { arm: 'shadow' }));
    const d = reviewed(19, () => 'fixed');
    expect(status({ ...d, prs: [...d.prs, ...merges(10)] }, 'ttm')).toBe('early');
    const e = reviewed(20, () => 'fixed');
    expect(status({ ...e, prs: [...e.prs, ...merges(10)] }, 'ttm')).toBe('notmet');
  });
});

describe('decision period and all weeks', () => {
  it('leaves findings from the setup weeks out of the criteria but keeps them on the repository screen', () => {
    const d = reviewed(10, () => 'fixed', { day: '2026-11-10', now: '2026-11-25T12:00:00Z' });
    const m = compute(d, DEFAULTS);
    expect(m.important.n).toBe(0);
    expect(m.criteria.find((c) => c.key === 'fix')!.status).toBe('early');
    expect(m.repo.important).toMatchObject({ k: 10, n: 10 });
    expect(m.repo.allFix.n).toBe(10);
  });

  it('reads the decision period, weeks 3 to 6, after week 6 until the decision is logged', () => {
    const d = reviewed(10, () => 'fixed', { day: '2026-11-24', now: '2027-01-20T12:00:00Z' });
    const m = compute(d, DEFAULTS);
    expect(m.phase).toBe('after');
    expect(m.health).toBe(false);
    expect(m.important.n).toBe(10);
    expect(m.checklist.map((c) => c.name)).toContain('Decision');
  });

  it('reads the last four weeks as health once the decision is logged', () => {
    const decision: Change = { date: '2026-12-22', kind: 'protocol', item: 'decision', outcome: 'keep', note: 'Keep' };
    const d = reviewed(10, () => 'fixed', { day: '2026-11-24', now: '2027-01-20T12:00:00Z', changes: [decision] });
    const m = compute(d, DEFAULTS);
    expect(m.health).toBe(true);
    expect(m.decided?.outcome).toBe('keep');
    expect(m.important.n).toBe(0);
    expect(m.rule).toBeNull();
  });

  it('keeps grading stopped after week 6 unless the change log says it continues', () => {
    const decision: Change = { date: '2026-12-22', kind: 'protocol', item: 'decision', outcome: 'keep', note: 'Keep' };
    const d = reviewed(1, () => 'fixed', { now: '2027-01-20T12:00:00Z', changes: [decision] });
    expect(compute(d, DEFAULTS).gradingContinues).toBe(false);
    const more: Change = { date: '2026-12-23', kind: 'protocol', item: 'grading', note: 'Grade 15 a month' };
    expect(compute({ ...d, changes: [decision, more] }, DEFAULTS).gradingContinues).toBe(true);
  });
});

describe('the weekly trend', () => {
  it('gives the fixed and dismissed share of the findings posted in each week', () => {
    const m = compute(reviewed(4, (i) => (i < 2 ? 'fixed' : i === 2 ? 'dismissed' : 'open')), DEFAULTS);
    const w3 = m.repo.perWeek.find((w) => w.week === 3)!;
    expect(w3).toMatchObject({ posted: 4, fixed: { k: 2, n: 4 }, dismissed: { k: 1, n: 4 } });
    expect(m.repo.perWeek.find((w) => w.week === 1)).toMatchObject({ posted: 0, setup: true });
  });
});

describe('the decision rule today', () => {
  const c = (key: Criterion['key'], s: Criterion['status']): Criterion => ({ key, status: s, value: null, text: '', sub: '', n: 0, fill: null, tick: 0, tickLabel: '' });
  const all = (over: Partial<Record<Criterion['key'], Criterion['status']>>) =>
    (['fix', 'dismissed', 'precision', 'missed', 'ttm', 'rework', 'cost'] as const).map((k) => c(k, over[k] ?? 'met'));
  const now = Date.parse('2026-12-10T12:00:00Z');

  it('gives keep when nothing is missed', () => {
    expect(ruleToday(all({}), [], now).outcome).toBe('keep');
    expect(ruleToday(all({ precision: 'early' }), [], now).text).toMatch(/precision/);
  });

  it('gives adjust when a criterion is missed and a recent change has not had time', () => {
    const change: Change = { date: '2026-12-08', kind: 'procedure', note: 'Post before CI' };
    expect(ruleToday(all({ ttm: 'notmet' }), [change], now)).toMatchObject({ outcome: 'adjust' });
  });

  it('gives stop when the dismissed rate misses after the rules were tightened', () => {
    const rule: Change = { date: '2026-11-17', kind: 'rule', note: 'Tighter' };
    expect(ruleToday(all({ dismissed: 'notmet' }), [rule], now).outcome).toBe('stop');
  });

  it('gives stop when the cost is over the cap with no change to bring it down', () => {
    expect(ruleToday(all({ cost: 'notmet' }), [], now).outcome).toBe('stop');
  });
});

describe('runs', () => {
  it('counts a review of a head commit already reviewed on the same pull request as an empty re-review', () => {
    const runs = [
      review(1, '2026-11-24T09:00:00Z', { head_sha: 'a' }),
      review(1, '2026-11-24T10:00:00Z', { head_sha: 'a' }),
      review(1, '2026-11-24T11:00:00Z', { head_sha: 'b' }),
      review(2, '2026-11-24T11:00:00Z', { head_sha: 'a' }),
      review(3, '2026-11-24T11:00:00Z'),
      review(3, '2026-11-24T12:00:00Z'),
    ];
    expect(emptyRereviews(runs)).toBe(1);
  });

  it('shows permission denials as not recorded when no run record has the field', () => {
    expect(compute(data([], [review(1)]), DEFAULTS).ops.denials).toBeNull();
    expect(compute(data([], [review(1, undefined, { permission_denials: 2 }), review(2, undefined, { permission_denials: 0 })]), DEFAULTS).ops.denials).toEqual({ runs: 2, total: 2, max: 2 });
  });
});

describe('finding list', () => {
  it('shows silent-group findings as recorded and keeps them out of the posted findings', () => {
    const d = data([
      pr(1, '2026-11-24T08:00:00Z', null, { arm: 'shadow', recorded: [{ posted: iso('2026-11-24T09:00:00Z'), severity: 'Nit', title: 'Quiet', path: 'a.ts' }] }),
      pr(2, '2026-11-24T08:00:00Z', null, { arm: 'treated', findings: [finding('fixed')] }),
    ]);
    const m = compute(d, DEFAULTS);
    expect(m.rows.map((f) => [f.group, f.outcome])).toEqual([
      ['silent', 'recorded'],
      ['reviewed', 'fixed'],
    ]);
    expect(m.posted).toHaveLength(1);
    expect(filterFindings(m.rows, { severity: 'All', outcome: 'All', group: 'silent', author: null }).map((f) => f.title)).toEqual(['Quiet']);
  });

  it('uses the finding title and falls back to the path, never the text', () => {
    const d = data([pr(2, '2026-11-24T08:00:00Z', null, { arm: 'treated', findings: [finding('open', 'Nit', { title: 'Short title' }), finding('open')] })]);
    expect(compute(d, DEFAULTS).rows.map((f) => f.title)).toEqual(['Short title', 'apps/api/src/x.ts']);
  });
});

describe('the username filter', () => {
  it('hashes the lowercased login with SHA-256, the same as the collector', async () => {
    expect(await hashLogin('Kari-H ')).toBe('e4a36f6e82a6053005f8ada8f317d194296f37bde98eac3f0e40f2c239fa6fc0');
  });

  it('finds an author by the hash of what the viewer typed, without any login in the data', async () => {
    const d = sample();
    const m = compute(d, DEFAULTS);
    const mine = filterFindings(m.rows, { severity: 'All', outcome: 'All', group: 'All', author: await hashLogin('kari-h') });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((f) => f.author === mine[0].author)).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/kari-h/);
  });
});

describe('things to check out', () => {
  const now = '2026-12-01T12:00:00Z';
  const items = (d: Data) => compute(d, DEFAULTS).checkout;

  it('shows nothing when there is nothing to show', () => {
    expect(items(data([], [], now))).toEqual([]);
  });

  it('picks the latest Important and the latest dismissed finding', () => {
    const d = data([
      pr(1, '2026-11-24T08:00:00Z', null, { arm: 'treated', findings: [finding('fixed', 'Important', { title: 'Old', posted: iso('2026-11-24T10:00:00Z') })] }),
      pr(2, '2026-11-25T08:00:00Z', null, { arm: 'treated', findings: [finding('fixed', 'Important', { title: 'New', posted: iso('2026-11-25T10:00:00Z') }), finding('dismissed', 'Nit', { title: 'No' })] }),
    ], [], now);
    const k = items(d);
    expect(k.find((x) => x.kind === 'Important')).toMatchObject({ title: 'New', pr: 2 });
    expect(k.find((x) => x.kind === 'Dismissed')).toMatchObject({ title: 'No', pr: 2 });
  });

  it('picks the open pull request that has waited longest on answers', () => {
    const d = data([
      pr(1, '2026-11-24T08:00:00Z', null, { arm: 'treated', findings: [finding('open', 'Nit', { posted: iso('2026-11-30T10:00:00Z') })] }),
      pr(2, '2026-11-24T08:00:00Z', null, { arm: 'treated', findings: [finding('open', 'Nit', { posted: iso('2026-11-29T10:00:00Z') })] }),
      pr(3, '2026-11-24T08:00:00Z', '2026-11-25T08:00:00Z', { arm: 'treated', findings: [finding('open', 'Nit', { posted: iso('2026-11-20T10:00:00Z') })] }),
    ], [], now);
    expect(items(d).find((x) => x.kind === 'Waiting')).toMatchObject({ pr: 2 });
  });

  it('picks the latest rule change with its reason', () => {
    const changes: Change[] = [
      { date: '2026-11-17', kind: 'rule', ref: 'digdir/genki#431', note: 'First' },
      { date: '2026-11-24', kind: 'rule', ref: 'digdir/genki#447', note: 'Second', because: 'Noise' },
      { date: '2026-11-25', kind: 'workflow', ref: 'digdir/genki#450', note: 'Not a rule' },
    ];
    expect(items(data([], [], now, changes)).find((x) => x.kind === 'Rule')).toMatchObject({ title: 'Second', pr: 447, meta: expect.arrayContaining(['Because: Noise']) });
  });

  it('picks the latest escaped fix, and the costliest run and largest pull request of the last seven days', () => {
    const d = data(
      [
        pr(1, '2026-11-20T08:00:00Z', null, { escaped: true }),
        pr(2, '2026-11-27T08:00:00Z', null, { escaped: true }),
        pr(3, '2026-11-28T08:00:00Z', null, { arm: 'treated', lines: 900 }),
        pr(4, '2026-11-28T08:00:00Z', null, { arm: 'treated', lines: 90 }),
        pr(5, '2026-11-10T08:00:00Z', null, { arm: 'treated', lines: 5000 }),
      ],
      [review(3, '2026-11-28T09:00:00Z', { cost_usd: 0.5 }), review(4, '2026-11-28T09:00:00Z', { cost_usd: 2 }), review(5, '2026-11-10T09:00:00Z', { cost_usd: 9 })],
      now,
    );
    const k = items(d);
    expect(k.find((x) => x.kind === 'Escaped')?.pr).toBe(2);
    expect(k.find((x) => x.kind === 'Costliest')?.pr).toBe(4);
    expect(k.find((x) => x.kind === 'Largest')?.pr).toBe(3);
  });
});

describe('sample data', () => {
  it('is the same on every call', () => {
    expect(sample('measuring')).toEqual(sample('measuring'));
  });

  it('has one moment for each phase', () => {
    expect(compute(sample('setup'), DEFAULTS).phase).toBe('setup');
    expect(compute(sample('measuring'), DEFAULTS)).toMatchObject({ phase: 'measuring', week: 5 });
    expect(compute(sample('after'), DEFAULTS)).toMatchObject({ phase: 'after', health: true });
  });

  it('has something in every list on the overview in week 5', () => {
    const m = compute(sample('measuring'), DEFAULTS);
    expect(m.checkout.length).toBeGreaterThanOrEqual(6);
    expect(m.repo.escaped.length).toBeGreaterThan(0);
    expect(m.ops.emptyRereviews).toBeGreaterThan(0);
    expect(m.rule).not.toBeNull();
  });
});

describe('security sweep', () => {
  const passes = { tenancy: 'success', rights: 'success', secrets: 'success', coordinate: 'success' };
  const sweep = (extra: Partial<SweepRun> = {}): SweepRun => ({ run_id: 's1', started_at: iso('2026-12-07T03:17:00Z'), conclusion: 'success', passes, cost_usd: 20, ...extra });
  const d = (sweeps: SweepRun[] | null | undefined, azure: Data['azure'] = []) => ({ ...reviewed(1, () => 'fixed', { day: '2026-12-02', now: '2026-12-08T12:00:00Z' }), sweeps, azure });

  it('adds the sweep to the month from the run records until Azure cost arrives', () => {
    const m = compute(d([sweep(), sweep({ run_id: 's0', started_at: iso('2026-11-30T03:17:00Z') })]), DEFAULTS);
    expect(m.ops.sweep.month).toEqual({ runs: 1, usd: 20, nok: 20 * DEFAULTS.usdNok });
    expect(m.monthNok).toBeCloseTo(21 * DEFAULTS.usdNok);
  });

  it('does not add the sweep to the Azure cost, which already includes it', () => {
    expect(compute(d([sweep()], [{ date: '2026-12-01', nok: 300 }]), DEFAULTS).monthNok).toBe(300);
  });

  it('leaves the sweep out of the cost per reviewed pull request', () => {
    expect(compute(d([sweep()]), DEFAULTS).ops.cost.perPr).toBeCloseTo(DEFAULTS.usdNok);
  });

  it('tells a repository without a sweep from one whose runs could not be read and one with no runs yet', () => {
    expect(compute(d(undefined), DEFAULTS).ops.sweep).toMatchObject({ configured: false, known: false });
    expect(compute(d(null), DEFAULTS).ops.sweep).toMatchObject({ configured: true, known: false });
    expect(compute(d([]), DEFAULTS).ops.sweep).toMatchObject({ configured: true, known: true, runs: [] });
  });

  it('calls a run incomplete when a pass failed, even though the workflow succeeded', () => {
    expect(sweepState(sweep())).toBe('completed');
    expect(sweepState(sweep({ passes: { ...passes, coordinate: 'skipped' } }))).toBe('completed');
    expect(sweepState(sweep({ passes: { ...passes, rights: 'failure' } }))).toBe('incomplete');
    expect(sweepState(sweep({ passes: { ...passes, tenancy: 'skipped' } }))).toBe('incomplete');
  });

  it('reads failed, cancelled, skipped and running runs from the workflow', () => {
    expect(sweepState(sweep({ conclusion: 'failure', passes: null, cost_usd: null }))).toBe('failed');
    expect(sweepState(sweep({ conclusion: 'startup_failure', passes: null }))).toBe('failed');
    expect(sweepState(sweep({ conclusion: 'cancelled' }))).toBe('cancelled');
    expect(sweepState(sweep({ conclusion: 'skipped', passes: null }))).toBe('skipped');
    expect(sweepState(sweep({ conclusion: 'running', passes: null }))).toBe('running');
    expect(sweepState(sweep({ passes: null }))).toBe('unchecked');
  });
});

describe('cross-model review', () => {
  const cross = (extra: Partial<CrossRun> = {}): CrossRun => ({
    run_id: 'c1', pr_number: 500, arm: 'treated', started_at: iso('2026-12-07T09:30:00Z'), completed: true, stopped_at_budget: false, model: 'gpt-6.1-sol',
    cost_usd: 2, tokens: { input: 1000, output: 100, cache_read: 0 }, returned: 3, duplicates: 1, posted: 2, ...extra,
  });
  const base = () => reviewed(6, (i) => (i < 4 ? 'fixed' : 'open'), { day: '2026-12-02', now: '2026-12-08T12:00:00Z' });
  const withCross = (runs: CrossRun[] = [cross()]) => {
    const d = base();
    d.prs[0].findings.push(finding('dismissed', 'Important', { reviewer: 'cross-model', posted: iso('2026-12-02T10:05:00Z') }));
    d.prs[1].findings.push(finding('dismissed', 'Nit', { reviewer: 'cross-model', posted: iso('2026-12-02T10:05:00Z') }));
    d.prs[2].findings.push(finding('fixed', 'Important', { reviewer: 'cross-model', posted: iso('2026-12-02T10:05:00Z') }));
    return { ...d, cross: runs };
  };
  const main = (d: Data) => {
    const m = compute(d, DEFAULTS);
    return { rows: m.rows, posted: m.posted, repo: m.repo, criteria: m.criteria, counts: m.counts, board: m.board, checkout: m.checkout, ours: m.ours, cost: m.ops.cost };
  };

  it("a cross-model thread does not count toward the main review's metrics", () => {
    expect(main(withCross([]))).toEqual(main(base()));
    expect(compute(withCross([]), DEFAULTS).repo.dismissed.k).toBe(0);
  });

  it('a cross-model run is never the last main review run', () => {
    const plain = compute(base(), DEFAULTS);
    const m = compute(withCross([cross({ started_at: iso('2026-12-08T11:00:00Z') })]), DEFAULTS);
    expect(m.lastRun).toEqual(plain.lastRun);
    expect(m.reviews).toEqual(plain.reviews);
    expect(m.reviewedSet).toEqual(plain.reviewedSet);
    expect(m.firstReview).toEqual(plain.firstReview);
  });

  it('counts its own findings, fix and dismissed shares and duplicates apart', () => {
    const c = compute(withCross([cross(), cross({ run_id: 'c2', pr_number: 501, arm: 'shadow', duplicates: 2, posted: 0 })]), DEFAULTS).ops.cross;
    expect(c).toMatchObject({ configured: true, prs: 2, silentRuns: 1, posted: 3, important: 2, duplicates: 3 });
    expect([c.fixed.k, c.fixed.n, c.dismissed.k, c.dismissed.n]).toEqual([1, 3, 2, 3]);
    expect(compute(base(), DEFAULTS).ops.cross).toMatchObject({ configured: false, posted: 0, runs: [] });
  });

  it('cross-model cost is kept apart from the cost per reviewed pull request', () => {
    const plain = compute(base(), DEFAULTS);
    const m = compute(withCross([cross(), cross({ run_id: 'c2', cost_usd: null })]), DEFAULTS);
    const perPr = ({ perPr, perFix, perImportantFix, run }: typeof m.ops.cost) => ({ perPr, perFix, perImportantFix, run });
    expect(perPr(m.ops.cost)).toEqual(perPr(plain.ops.cost));
    expect(m.ops.cross.cost).toEqual({ usd: 2, priced: 1, monthUsd: 2, monthNok: 2 * DEFAULTS.usdNok });
    expect(m.ops.cross.tokens).toEqual({ input: 2000, output: 200 });
    expect(m.monthNok).toBeCloseTo(plain.monthNok + 2 * DEFAULTS.usdNok);
    expect(compute({ ...withCross(), azure: [{ date: '2026-12-01', nok: 300 }] }, DEFAULTS).monthNok).toBe(300);
  });

  it('shows no cost when no cross-model run record carries one', () => {
    expect(compute(withCross([cross({ cost_usd: null })]), DEFAULTS).ops.cross.cost).toMatchObject({ usd: null, priced: 0 });
  });
});
